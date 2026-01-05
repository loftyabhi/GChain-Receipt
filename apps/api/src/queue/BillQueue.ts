import { Queue, QueueOptions } from 'bullmq';

interface BillJobData {
    txHash: string;
    chainId: number;
    connectedWallet?: string;
}

/**
 * Redis connection configuration with fallbacks
 * Supports both local development and production environments with authentication
 */
const getConnectionOptions = () => {
    if (process.env.REDIS_URL) {
        try {
            const url = new URL(process.env.REDIS_URL);
            return {
                host: url.hostname,
                port: parseInt(url.port || '6379', 10),
                password: url.password || undefined,
                username: url.username || undefined,
                tls: url.protocol === 'rediss:' ? { rejectUnauthorized: false } : undefined
            };
        } catch (e) {
            console.warn('[BillQueue] Invalid REDIS_URL, falling back to individual env vars');
        }
    }
    return {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD
    };
};

const connection = {
    ...getConnectionOptions(),
    maxRetriesPerRequest: null, // Required by BullMQ (it manages retries internally)
    enableReadyCheck: true,
    retryStrategy: (times: number) => {
        // Exponential backoff with max 30 seconds between retries
        const delay = Math.min(times * 1000, 30000);
        console.log(`[BillQueue] Redis reconnect attempt ${times}, waiting ${delay}ms`);
        return delay;
    }
};

const queueOptions: QueueOptions = {
    connection,
    defaultJobOptions: {
        attempts: 1,
        backoff: {
            type: 'exponential',
            delay: 2000 // Start with 2s, doubles each retry
        },
        removeOnComplete: {
            count: 100, // Keep last 100 completed jobs for debugging
            age: 24 * 3600 // Remove jobs older than 24 hours
        },
        removeOnFail: {
            count: 100, // Keep last 100 failed jobs for debugging
            age: 24 * 3600 // Remove failed jobs older than 24 hours
        }
    }
};

export const billQueue = new Queue<BillJobData>('bill-generation', queueOptions);

// Handle queue errors to prevent crashes
billQueue.on('error', (error) => {
    console.error('[BillQueue] Queue error:', error);
});

/**
 * Add a bill generation job to the queue
 * @param data - Transaction details for bill generation
 * @returns Promise resolving to the created job
 */
export const addBillJob = async (data: BillJobData) => {
    try {
        const job = await billQueue.add('generate-bill', data, {
            jobId: `bill-${data.txHash}-${Date.now()}`, // Allow regeneration (timestamp ensures uniqueness)
            priority: 1 // Default priority, can be adjusted per job
        });

        console.log(`[BillQueue] Job ${job.id} added to queue for tx ${data.txHash}`);
        return job;
    } catch (error) {
        console.error('[BillQueue] Failed to add job:', error);
        throw error;
    }
};

/**
 * Graceful shutdown: close queue connections
 * Call this during application shutdown
 */
export const closeBillQueue = async () => {
    console.log('[BillQueue] Closing queue connections...');
    await billQueue.close();
    console.log('[BillQueue] Queue closed');
};
