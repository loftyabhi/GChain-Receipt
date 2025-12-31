import { Worker, Job } from 'bullmq';
import { BillService } from '../services/BillService';

interface BillJobData {
    txHash: string;
    chainId: number;
    connectedWallet?: string;
}

const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
};

const billService = new BillService();

export const billWorker = new Worker<BillJobData>('bill-generation', async (job: Job<BillJobData>) => {
    console.log(`[Worker] Processing Job ${job.id}: ${job.data.txHash} on Chain ${job.data.chainId}`);

    try {
        const result = await billService.generateBill(job.data);
        console.log(`[Worker] Job ${job.id} Completed`);
        return result;
    } catch (error) {
        console.error(`[Worker] Job ${job.id} Failed:`, error);
        throw error;
    }
}, {
    connection,
    concurrency: 5 // Process 5 bills in parallel
});

billWorker.on('completed', job => {
    console.log(`[Worker] Job ${job.id} has completed!`);
});

billWorker.on('failed', (job, err) => {
    console.log(`[Worker] Job ${job?.id} has failed with ${err.message}`);
});
