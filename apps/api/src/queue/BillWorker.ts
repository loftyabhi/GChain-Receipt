import { Worker, Job } from 'bullmq';
import { BillService } from '../services/BillService';

interface BillJobData {
    txHash: string;
    chainId: number;
    connectedWallet?: string;
}

/**
 * Redis connection configuration (must match BillQueue)
 */
// Parse REDIS_URL if available (Render/Heroku style)
let connection: any = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: (times: number) => {
        const delay = Math.min(times * 1000, 30000);
        console.log(`[BillWorker] Redis reconnect attempt ${times}, waiting ${delay}ms`);
        return delay;
    }
};

if (process.env.REDIS_URL) {
    try {
        const url = new URL(process.env.REDIS_URL);
        connection = {
            ...connection,
            host: url.hostname,
            port: parseInt(url.port, 10),
            password: url.password,
            username: url.username,
            tls: url.protocol === 'rediss:' ? { rejectUnauthorized: false } : undefined
        };
        console.log(`[BillWorker] Using Redis at ${connection.host}:${connection.port}`);
    } catch (err) {
        console.warn('[BillWorker] Invalid REDIS_URL, falling back to individual env vars');
    }
}

// Single shared BillService instance (reuses browser instance internally if optimized)
const billService = new BillService();

/**
 * Worker process for generating PDF bills
 * Handles retries, timeouts, and graceful failures
 */
export const billWorker = new Worker<BillJobData>('bill-generation', async (job: Job<BillJobData>) => {
    const startTime = Date.now();
    console.log(`[Worker] Processing Job ${job.id}: ${job.data.txHash} on Chain ${job.data.chainId}`);

    try {
        // Update job progress (optional, useful for monitoring)
        await job.updateProgress(10);

        const result = await billService.generateBill(job.data);

        await job.updateProgress(100);

        const duration = Date.now() - startTime;
        console.log(`[Worker] Job ${job.id} completed in ${duration}ms`);

        return result;
    } catch (error: any) {
        const duration = Date.now() - startTime;
        console.error(`[Worker] Job ${job.id} failed after ${duration}ms:`, error.message);

        // Log stack trace for debugging
        if (error.stack) {
            console.error(`[Worker] Stack trace:`, error.stack);
        }

        // Re-throw to trigger BullMQ retry logic
        throw error;
    }
}, {
    connection,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '3', 10), // Configurable concurrency
    limiter: {
        max: 10, // Max 10 jobs per duration
        duration: 1000 // Per second (rate limiting to avoid overwhelming blockchain RPCs)
    }
});

// Event: Job completed successfully
billWorker.on('completed', (job) => {
    console.log(`[Worker] ✓ Job ${job.id} completed successfully`);
});

// Event: Job failed (exhausted retries)
billWorker.on('failed', (job, err) => {
    console.error(`[Worker] ✗ Job ${job?.id} failed permanently: ${err.message}`);

    // Log full error details for external monitoring systems
    const errorDetails = {
        jobId: job?.id,
        txHash: job?.data?.txHash,
        chainId: job?.data?.chainId,
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString(),
        attemptsMade: job?.attemptsMade
    };

    console.error('[Worker] Failed job details:', JSON.stringify(errorDetails, null, 2));

    // Integration point for external alerting (Sentry, Slack, email, etc.)
    // Example: if (process.env.SENTRY_DSN) { Sentry.captureException(err, { extra: errorDetails }); }
});

// Event: Worker error (not job-specific)
billWorker.on('error', (error) => {
    console.error('[Worker] Worker-level error:', error);
});

// Event: Worker becomes active
billWorker.on('active', (job) => {
    console.log(`[Worker] Job ${job.id} started processing`);
});

/**
 * Graceful shutdown handler
 * Allows in-flight jobs to complete before exiting
 */
export const closeBillWorker = async () => {
    console.log('[Worker] Initiating graceful shutdown...');
    // await billService.dispose(); // Method removed
    await billWorker.close();
    console.log('[Worker] All jobs completed, worker closed');
};

// Handle process termination signals
process.on('SIGTERM', async () => {
    console.log('[Worker] SIGTERM received');
    await closeBillWorker();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('[Worker] SIGINT received');
    await closeBillWorker();
    process.exit(0);
});
