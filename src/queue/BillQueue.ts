import { Queue } from 'bullmq';
// import { CreateBillDto } from '../dto/all'; 

interface BillJobData {
    txHash: string;
    chainId: number;
    connectedWallet?: string;
}

// Reuse the Redis connection for efficiency if needed, but BullMQ manages its own connections by default
const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
};

export const billQueue = new Queue<BillJobData>('bill-generation', {
    connection
});

export const addBillJob = async (data: BillJobData) => {
    return await billQueue.add('generate-bill', data, {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 200      // Keep last 200 failed jobs
    });
};
