import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { EmailService } from './EmailService';
import { AuditService } from './AuditService';

const EMAIL_SEND_INTERVAL_MS = 2000;
const MAX_EMAIL_ATTEMPTS = 5;

export class EmailQueueService {
    private emailService: EmailService;
    private auditService: AuditService;
    private isProcessing: boolean = false;

    // Circuit Breaker State
    private failureWindow: boolean[] = []; // Last 50 attempts
    private circuitOpenUntil: number = 0;

    // Domain Throttling State
    private domainLastSent: Map<string, number> = new Map();

    constructor() {
        this.emailService = new EmailService();
        this.auditService = new AuditService();
    }

    /**
     * Enqueue a new email job
     */
    async enqueueJob(params: {
        userId?: string;
        recipientEmail: string;
        category: 'transactional' | 'promotional';
        templateId: string;
        priority?: 'high' | 'normal' | 'low';
        metadata?: any;
    }) {
        const { userId, recipientEmail, category, templateId, metadata, priority = 'normal' } = params;

        // 1. Strict Verification Check
        if (userId) {
            const { data: user } = await supabase
                .from('users')
                .select('is_email_verified')
                .eq('id', userId)
                .single();

            if (user && !user.is_email_verified) {
                logger.warn('Skipping email enqueue for unverified user', { userId, recipientEmail, category });
                throw new Error('Cannot send email to unverified user.');
            }
        }

        // 2. Insert Job
        const { data, error } = await supabase
            .from('email_jobs')
            .insert({
                user_id: userId,
                recipient_email: recipientEmail,
                category,
                template_id: templateId,
                status: 'pending',
                priority,
                metadata
            })
            .select()
            .single();

        if (error) {
            logger.error('Failed to enqueue email job', error);
            throw new Error('Failed to queue email.');
        }

        logger.info('Enqueued email job', { jobId: data.id, recipientEmail, priority });
        return data;
    }

    /**
     * Worker Loop: Process one job at a time with delay
     */
    async processQueue() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            // 0. Circuit Breaker Check
            if (Date.now() < this.circuitOpenUntil) {
                logger.warn('Circuit Breaker OPEN. Pausing queue.');
                return;
            }

            // 1. Claim Job (Atomic) - Now checks priority via RPC
            const { data: jobs, error } = await supabase.rpc('claim_next_email_job');

            if (error) {
                logger.error('Error claiming email job', error);
                return;
            }

            if (!jobs || jobs.length === 0) {
                return; // Queue empty
            }

            const job = jobs[0]; // RPC returns array
            logger.info('Processing email job', { jobId: job.id });

            // 1.5 Domain Throttling Check
            const domain = job.recipient_email.split('@')[1];
            const lastSent = this.domainLastSent.get(domain) || 0;
            const now = Date.now();
            if (now - lastSent < 2000) { // 2s per domain throttle
                // Reschedule instead of processing (don't block the valid queue)
                logger.info(`Throttling domain ${domain}. Rescheduling job ${job.id}.`);
                await supabase.from('email_jobs').update({
                    status: 'pending',
                    scheduled_at: new Date(now + 2000).toISOString()
                }).eq('id', job.id);
                return;
            }
            // Mark send time immediately to block others
            this.domainLastSent.set(domain, now);

            try {
                // 2. Load Template
                const { data: template } = await supabase
                    .from('email_templates')
                    .select('*')
                    .eq('id', job.template_id)
                    .single();

                if (!template) {
                    throw new Error(`Template ${job.template_id} not found`);
                }

                // 3. User Preference Check (Double Check)
                if (job.category === 'promotional') {
                    if (job.recipient_email) {
                        const { data: user } = await supabase.from('users').select('allow_promotional_emails').eq('email', job.recipient_email).single();
                        if (user && !user.allow_promotional_emails) {
                            throw new Error('User has opted out of promotional emails.');
                        }
                    }
                }

                // 4. Render Email
                const variables = { ...job.metadata, email: job.recipient_email };
                let { html, text } = this.emailService.render(template.html_content, template.html_content.replace(/<[^>]*>?/gm, ''), variables);

                // 4.5 Inject Tracking
                html = this.emailService.injectTracking(html, job.id);

                // 5. Send
                await this.emailService.sendRaw(job.recipient_email, template.subject, html, text);

                // 6. Success Update
                await supabase.from('email_jobs').update({
                    status: 'sent',
                    sent_at: new Date().toISOString(),
                    rendered_html: html
                }).eq('id', job.id);

                await this.auditService.log({
                    actorId: 'system_worker',
                    action: `EMAIL_SENT_${job.category.toUpperCase()}`,
                    targetId: job.recipient_email,
                    metadata: { jobId: job.id, templateId: job.template_id }
                });

                // Circuit Breaker: Success
                this.recordCircuitStatus(true);

            } catch (jobError: any) {
                logger.error('Email Job Failed', { jobId: job.id, error: jobError.message });

                // Circuit Breaker: Failure
                this.recordCircuitStatus(false);

                // Backoff Logic
                const { data: currentJob } = await supabase.from('email_jobs').select('attempt_count').eq('id', job.id).single();

                let newStatus = 'pending'; // Default to retry
                let scheduledAt = new Date();

                // Non-retriable errors
                const isPermanent = jobError.message.includes('opted out') || jobError.message.includes('unverified');

                // 2s -> 10s -> 30s -> 2m -> (Limit)
                // attempt 1 (failed) -> attempt_count 1. Next: 2
                // mapping attempt_count (previous failures + 1):
                // 1 -> 2s, 2 -> 10s, 3 -> 30s, 4 -> 120s
                const attempts = currentJob?.attempt_count || 1;

                if (attempts >= MAX_EMAIL_ATTEMPTS || isPermanent) {
                    newStatus = 'permanent_fail';
                } else {
                    let delayMs = 2000;
                    if (attempts === 2) delayMs = 10000; // 10s
                    if (attempts === 3) delayMs = 30000; // 30s
                    if (attempts >= 4) delayMs = 120000; // 2m

                    scheduledAt = new Date(Date.now() + delayMs);
                    logger.info(`Rescheduling job ${job.id} (Attempt ${attempts + 1}) for ${scheduledAt.toISOString()}`);
                }

                await supabase.from('email_jobs').update({
                    status: newStatus,
                    error: jobError.message,
                    scheduled_at: newStatus === 'pending' ? scheduledAt.toISOString() : undefined
                }).eq('id', job.id);

                await this.auditService.log({
                    actorId: 'system_worker',
                    action: 'EMAIL_FAILED',
                    targetId: job.recipient_email,
                    metadata: { jobId: job.id, error: jobError.message, attempts }
                });
            }

            // 7. Throttling
            await new Promise(resolve => setTimeout(resolve, EMAIL_SEND_INTERVAL_MS));

        } catch (e) {
            logger.error('Queue processing loop error', e);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Start the worker loop (typically called at app startup)
     */
    startWorker() {
        setInterval(() => {
            this.processQueue();
        }, 5000); // Check every 5 seconds (The processQueue has internal throttling too)
    }

    private recordCircuitStatus(success: boolean) {
        this.failureWindow.push(success);
        if (this.failureWindow.length > 50) this.failureWindow.shift();

        // Check failure rate if we have enough data (e.g. 20 samples)
        if (this.failureWindow.length >= 20) {
            const failures = this.failureWindow.filter(s => !s).length;
            const rate = failures / this.failureWindow.length;

            // If > 20% fail, open circuit for 5 minutes
            if (rate > 0.2) {
                logger.error(`Triggering Circuit Breaker! Failure Rate: ${rate * 100}%. Pausing for 5m.`);
                this.circuitOpenUntil = Date.now() + (5 * 60 * 1000);
                this.failureWindow = []; // Reset window
            }
        }
    }
}
