import { supabase } from '../lib/supabase';
import { BillService } from './BillService';
import { WebhookService } from './WebhookService'; // [NEW] Import

const MAX_CONCURRENT_JOBS = parseInt(process.env.MAX_CONCURRENT_JOBS || '2', 10);
const PROCESSING_TIMEOUT_MINS = parseInt(process.env.JOB_PROCESSING_TIMEOUT_MINUTES || '5', 10);

export class SoftQueueService {
    private billService: BillService;
    private webhookService: WebhookService; // [NEW] Dependency
    private processingSlots = 0;

    constructor() {
        this.billService = new BillService();
        this.webhookService = new WebhookService();
    }

    /**
     * Enqueue a job (Wait-Free / Idempotent).
     */
    async enqueue(txHash: string, chainId: number, options: { connectedWallet?: string, apiKeyId?: string, userId?: string, priority?: number } = {}) {
        const { connectedWallet, apiKeyId, userId, priority = 0 } = options;

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
                metadata: connectedWallet ? { connectedWallet } : {},
                api_key_id: apiKeyId || null,
                user_id: userId || null,
                priority: priority // 0 for free/anon, 10+ for paid
            })
            .select()
            .single();

        if (error) {
            console.error('[SoftQueue] Enqueue DB Error:', JSON.stringify(error, null, 2));
            if (error.code === '23505') {
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
     */
    async processNext() {
        if (this.processingSlots >= MAX_CONCURRENT_JOBS) return;

        this.processingSlots++;

        try {
            await this.recoverStaleJobs();

            // 3. Atomic Claim (RPC) - V2 for Priority
            const { data, error: rpcError } = await supabase.rpc('claim_next_bill_job_v2');

            if (rpcError) {
                console.error('[SoftQueue] RPC Error:', rpcError);
                return;
            }

            // RPC returns Table Row type
            const job = (data && data.length > 0) ? data[0] : null;

            if (!job) {
                this.processingSlots--;
                return;
            }

            console.log(`[SoftQueue] Processing Job ${job.id} (${job.tx_hash}) Priority: ${job.priority || 0}...`);

            // [HARDENING] Re-Verify API Key Status (Prevent processing if banned after enqueue)
            if (job.api_key_id) {
                const { data: keyData } = await supabase
                    .from('api_keys')
                    .select('is_active, abuse_flag')
                    .eq('id', job.api_key_id)
                    .single();

                if (keyData) {
                    if (!keyData.is_active || keyData.abuse_flag) {
                        console.warn(`[Security] Worker blocked job ${job.id} (Key Banned/Inactive)`);

                        await supabase
                            .from('bill_jobs')
                            .update({
                                status: 'failed',
                                error: JSON.stringify({ code: 'SECURITY_VIOLATION', message: 'API Key banned or inactive during processing' }),
                                updated_at: new Date().toISOString(),
                                finished_at: new Date().toISOString()
                            })
                            .eq('id', job.id);

                        this.processingSlots--;
                        return; // SKUIP PROCESSING
                    }
                }
            }

            const startTime = Date.now();

            const heartbeat = setInterval(async () => {
                await supabase.from('bill_jobs').update({ heartbeat_at: new Date().toISOString() }).eq('id', job.id);
            }, 10000);

            try {
                const wallet = job.metadata?.connectedWallet;

                const result = await this.billService.generateBill({
                    txHash: job.tx_hash,
                    chainId: job.chain_id,
                    connectedWallet: wallet
                });

                const duration = Date.now() - startTime;

                // Detect Cache Hit (Basic duration heuristic for now or if BillService is updated)
                const isCacheHit = (result as any).cacheHit === true;

                // Complete
                await supabase
                    .from('bill_jobs')
                    .update({
                        status: 'completed',
                        bill_id: result.billData.BILL_ID,
                        updated_at: new Date().toISOString(),
                        finished_at: new Date().toISOString(),
                        duration_ms: duration,
                        cache_hit: isCacheHit
                    })
                    .eq('id', job.id);

                console.log(`[SoftQueue] Job ${job.id} Completed in ${duration}ms.`);

                // [Webhook] Dispatch Success
                if (job.api_key_id) {
                    this.webhookService.dispatch('bill.completed', {
                        id: job.id,
                        billId: result.billData.BILL_ID,
                        txHash: job.tx_hash,
                        chainId: job.chain_id,
                        status: 'completed',
                        durationMs: duration
                    }, job.api_key_id).catch(err => console.error('[Webhook] Dispatch Error:', err));
                }

            } catch (err: any) {
                console.error(`[SoftQueue] Job ${job.id} Failed:`, err.message);
                await supabase
                    .from('bill_jobs')
                    .update({
                        status: 'failed',
                        error: err.message,
                        updated_at: new Date().toISOString(),
                        finished_at: new Date().toISOString(),
                        duration_ms: Date.now() - startTime
                    })
                    .eq('id', job.id);

                // [Webhook] Dispatch Failure
                if (job.api_key_id) {
                    this.webhookService.dispatch('bill.failed', {
                        id: job.id,
                        txHash: job.tx_hash,
                        chainId: job.chain_id,
                        status: 'failed',
                        error: err.message
                    }, job.api_key_id).catch(err => console.error('[Webhook] Dispatch Error:', err));
                }
            } finally {
                clearInterval(heartbeat);
                this.processingSlots--;
                setImmediate(() => this.processNext());
            }

        } catch (err) {
            console.error('[SoftQueue] Unhandled Execution Error:', err);
            this.processingSlots--;
        }
    }

    private async recoverStaleJobs() {
        const staleTime = new Date(Date.now() - PROCESSING_TIMEOUT_MINS * 60 * 1000).toISOString();
        const { data: stuckJobs } = await supabase
            .from('bill_jobs')
            .select('id')
            .eq('status', 'processing')
            .lt('heartbeat_at', staleTime);

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
                // Approximate position based on Priority
                const { count } = await supabase
                    .from('bill_jobs')
                    .select('*', { count: 'exact', head: true })
                    .in('status', ['pending', 'processing'])
                    // Count jobs with higher priority OR same priority but older
                    .or(`priority.gt.${job.priority || 0},and(priority.eq.${job.priority || 0},created_at.lt.${job.created_at})`);

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
                pdfPath: `/print/bill/${job.bill_id}`,
                duration_ms: job.duration_ms
            } : null,
            error: job.error,
            queuePosition,
            estimatedWaitMs: estimatedWaitSeconds * 1000
        };
    }
}
