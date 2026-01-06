import { supabase } from '../lib/supabase';
import { BillService } from './BillService';

const MAX_CONCURRENT_JOBS = parseInt(process.env.MAX_CONCURRENT_JOBS || '2', 10);
const PROCESSING_TIMEOUT_MINS = parseInt(process.env.JOB_PROCESSING_TIMEOUT_MINUTES || '5', 10);

export class SoftQueueService {
    private billService: BillService;
    private processingSlots = 0; // Local "Token Bucket" for Concurrency
    // DELETED: isProcessing is gone.

    constructor() {
        this.billService = new BillService();
    }

    /**
     * Enqueue a job (Wait-Free / Idempotent).
     * Returns existing job if found.
     */
    async enqueue(txHash: string, chainId: number, connectedWallet?: string) {
        // 1. Check existing
        const { data: existing } = await supabase
            .from('bill_jobs')
            .select('*')
            .eq('tx_hash', txHash)
            .eq('chain_id', chainId)
            .single();

        if (existing) {
            return {
                jobId: existing.id,
                status: existing.status,
            };
        }

        // 2. Insert new
        const { data, error } = await supabase
            .from('bill_jobs')
            .insert({
                tx_hash: txHash,
                chain_id: chainId,
                status: 'pending',
                metadata: connectedWallet ? { connectedWallet } : {}
            })
            .select()
            .single();

        if (error) {
            console.error('[SoftQueue] Enqueue DB Error:', JSON.stringify(error, null, 2)); // Debugging
            if (error.code === '23505') { // Unique constraint
                const { data: raceExisting } = await supabase
                    .from('bill_jobs')
                    .select('*')
                    .eq('tx_hash', txHash)
                    .eq('chain_id', chainId)
                    .single();
                return { jobId: raceExisting?.id, status: raceExisting?.status || 'pending' };
            }
            throw new Error(`DB Error: ${error.message} (Code: ${error.code})`);
        }

        return { jobId: data.id, status: 'pending' };
    }

    /**
     * Event-Driven Processor.
     * Should be called when:
     * 1. A new job is Enqueued (Trigger)
     * 2. A job Completes/Fails (Chain Reaction)
     * 3. A Poll request happens (Wake Up / Recovery)
     */
    async processNext() {
        // 1. Local Concurrency Check (Token Bucket)
        // If we are already running MAX jobs locally, do not spawn another processor.
        if (this.processingSlots >= MAX_CONCURRENT_JOBS) return;

        // Take a slot
        this.processingSlots++;

        try {
            // 2. Global Crash Check (Optional / Periodic)
            await this.recoverStaleJobs();

            // 3. Atomic Claim (RPC)
            // This is the source of truth.
            const { data, error: rpcError } = await supabase.rpc('claim_next_bill_job');

            if (rpcError) {
                console.error('[SoftQueue] RPC Error:', rpcError);
                return;
            }

            // CHECK: RPC returns an array
            const job = (data && data.length > 0) ? data[0] : null;

            if (!job) {
                // Queue Empty. Stop recursion.
                return;
            }

            // 4. Execute Job
            console.log(`[SoftQueue] Processing Job ${job.id} (${job.tx_hash})...`);

            // Start Heartbeat (Keep-Alive)
            const heartbeat = setInterval(async () => {
                await supabase.from('bill_jobs').update({ heartbeat_at: new Date().toISOString() }).eq('id', job.id);
            }, 10000); // 10s Pulse

            try {
                // Extract metadata
                const wallet = job.metadata?.connectedWallet;

                const result = await this.billService.generateBill({
                    txHash: job.tx_hash,
                    chainId: job.chain_id,
                    connectedWallet: wallet
                });

                // Complete
                await supabase
                    .from('bill_jobs')
                    .update({
                        status: 'completed',
                        bill_id: result.billData.BILL_ID,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', job.id);

                console.log(`[SoftQueue] Job ${job.id} Completed.`);

            } catch (err: any) {
                console.error(`[SoftQueue] Job ${job.id} Failed:`, err.message);
                await supabase
                    .from('bill_jobs')
                    .update({
                        status: 'failed',
                        error: err.message,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', job.id);
            } finally {
                clearInterval(heartbeat);

                // Chain Reaction: Try to pick up the next job immediately
                this.processingSlots--;

                // Trigger next attempt
                setImmediate(() => this.processNext());
            }

        } catch (err) {
            console.error('[SoftQueue] Unhandled Execution Error:', err);
            this.processingSlots--; // Release slot on crash
        }
    }

    private async recoverStaleJobs() {
        const staleTime = new Date(Date.now() - PROCESSING_TIMEOUT_MINS * 60 * 1000).toISOString();
        const { data: stuckJobs } = await supabase
            .from('bill_jobs')
            .select('id')
            .eq('status', 'processing')
            .lt('heartbeat_at', staleTime); // Uses heartbeat, not updated_at

        if (stuckJobs && stuckJobs.length > 0) {
            console.warn(`[SoftQueue] Recovering ${stuckJobs.length} stuck jobs...`);
            await supabase
                .from('bill_jobs')
                .update({ status: 'pending', error: 'Recovered from crash', updated_at: new Date().toISOString() })
                .in('id', stuckJobs.map(j => j.id));
        }
    }

    /**
     * Get Status & Position
     */
    async getJobStatus(jobId: string) {
        const { data: job, error } = await supabase
            .from('bill_jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (error || !job) return null;

        let queuePosition = 0;
        let estimatedWaitSeconds = 0;
        let billData = null;

        const AVG_TIME = parseInt(process.env.BILL_AVG_PROCESS_TIME_SECONDS || '6', 10);

        if (job.status === 'pending' || job.status === 'processing') {
            if (job.status === 'processing') {
                queuePosition = 0;
                estimatedWaitSeconds = AVG_TIME;
            } else {
                const { count } = await supabase
                    .from('bill_jobs')
                    .select('*', { count: 'exact', head: true })
                    .in('status', ['pending', 'processing'])
                    .lt('created_at', job.created_at);

                queuePosition = (count || 0) + 1;
                estimatedWaitSeconds = Math.ceil((queuePosition / MAX_CONCURRENT_JOBS) * AVG_TIME);
            }
        }

        if (job.status === 'completed') {
            const { data: billRecord } = await supabase
                .from('bills')
                .select('bill_json')
                .eq('tx_hash', job.tx_hash)
                .eq('chain_id', job.chain_id)
                .single();

            if (billRecord && billRecord.bill_json) {
                billData = billRecord.bill_json;
            } else {
                billData = { BILL_ID: job.bill_id, STATUS: 'completed' };
            }
        }

        return {
            id: job.id,
            state: job.status,
            result: job.status === 'completed' ? {
                billData: billData,
                pdfPath: `/print/bill/${job.bill_id}`
            } : null,
            error: job.error,
            queuePosition,
            estimatedWaitMs: estimatedWaitSeconds * 1000
        };
    }
}
