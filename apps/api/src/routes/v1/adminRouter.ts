import { Router, Request, Response } from 'express';
import { supabase } from '../../lib/supabase';
import { AuthService } from '../../services/AuthService';
import { ApiKeyService } from '../../services/ApiKeyService';
import { AuditService } from '../../services/AuditService';
import { EmailService } from '../../services/EmailService';
import { EmailQueueService } from '../../services/EmailQueueService';
import { logger } from '../../lib/logger';
import { generateRandomToken, hashToken } from '../../lib/cryptography';
import { z } from 'zod';

const router = Router();
const keyService = new ApiKeyService();
const auditService = new AuditService();
const emailService = new EmailService();
const emailQueueService = new EmailQueueService();

// Note: verifyAdmin middleware is applied in index.ts for the /api/v1/admin base path

// Schema
const createKeySchema = z.object({
    ownerId: z.string(),
    planName: z.enum(['Free', 'Pro', 'Enterprise']),
    ipAllowlist: z.array(z.string()).optional()
});

/**
 * GET /api/v1/admin/me
 * Session Introspection
 */
router.get('/me', (req: Request, res: Response) => {
    // If request reached here, it passed verifyAdmin middleware (user is admin)
    const user = (req as any).user;

    // ROTATE SESSION: New JWT + New CSRF on every check
    // This ensures if a token is stolen, the CSRF part becomes stale or invalid if refreshed elsewhere
    const authService = new AuthService();
    const result = authService.rotateSession(user);

    // Set Hardened Cookie
    res.cookie('admin_token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        domain: process.env.NODE_ENV === 'production' ? '.txproof.xyz' : undefined,
        maxAge: 30 * 60 * 1000 // 30 minutes
    });

    res.json({
        authenticated: true,
        csrfToken: result.csrfToken, // Send new CSRF token to client
        user: { role: user.role, address: user.address }
    });
});

/**
 * GET /api/v1/admin/keys
 * List all API Keys
 */
router.get('/keys', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('api_keys')
            .select(`
                *,
                plan:plans(name)
            `)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;
        res.json(data);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/v1/admin/keys
 * Issue new API Key
 */
router.post('/keys', async (req: Request, res: Response) => {
    try {
        const { ownerId, planName, ipAllowlist } = createKeySchema.parse(req.body);
        const result = await keyService.createKey(ownerId, planName);

        // Update IP Allowlist if provided (createKey doesn't take it directly yet)
        if (ipAllowlist) {
            await supabase.from('api_keys').update({ ip_allowlist: ipAllowlist }).eq('id', result.id);
        }

        await auditService.log({
            actorId: 'admin_user',
            action: 'KEY_CREATE',
            targetId: result.id,
            metadata: { plan: planName, owner: ownerId, ipAllowlist },
            ip: req.ip
        });

        res.json(result);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

/**
 * PUT /api/v1/admin/keys/:id
 * Update Key Plan/Status/Abuse/IPs
 */
router.put('/keys/:id', async (req: Request, res: Response) => {
    try {
        const { isActive, planName, abuseFlag, ipAllowlist } = req.body;
        const updates: any = {};

        if (typeof isActive === 'boolean') updates.is_active = isActive;
        if (typeof abuseFlag === 'boolean') updates.abuse_flag = abuseFlag;
        if (Array.isArray(ipAllowlist)) updates.ip_allowlist = ipAllowlist;

        if (planName) {
            const { data: plan } = await supabase.from('plans').select('id').eq('name', planName).single();
            if (plan) updates.plan_id = plan.id;
        }

        const { data, error } = await supabase
            .from('api_keys')
            .update(updates)
            .eq('id', req.params.id)
            .select();

        if (error) throw error;

        await auditService.log({
            actorId: 'admin_user',
            action: 'KEY_UPDATE',
            targetId: req.params.id,
            metadata: { updates },
            ip: req.ip
        });

        res.json(data);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/v1/admin/audit
 * View Audit Logs
 */
router.get('/audit', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;
        res.json(data);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/v1/admin/usage
 * Dashboard Metrics & Analytics
 */
router.get('/usage', async (req: Request, res: Response) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        // 1. Basic Counts
        const { count: requestsToday } = await supabase
            .from('api_usage')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', today);

        // 2. Recent Errors
        const { data: errors } = await supabase
            .from('api_usage')
            .select('*')
            .gte('status_code', 400)
            .order('created_at', { ascending: false })
            .limit(10);

        // 3. Top Users (Aggregation via View preferred, using simplified groupBy here if small, 
        // implies we should stick to basic stats or use the new 'aggregates' table)
        // Let's use `api_usage_aggregates` for top quotas
        const { data: topKeys } = await supabase
            .from('api_usage_aggregates')
            .select('api_key_id, request_count, api_keys(prefix, owner_id)')
            .eq('period_start', today.substring(0, 7) + '-01') // This Month
            .order('request_count', { ascending: false })
            .limit(5);

        // 4. SLA Metrics (from new view)
        const { data: sla } = await supabase
            .from('distinct_daily_metrics')
            .select('*')
            .limit(1);

        res.json({
            metrics: {
                requestsToday,
                activeKeys: (await supabase.from('api_keys').select('id', { count: 'exact', head: true }).eq('is_active', true)).count,
                avgLatency: sla?.[0]?.p50_latency || 0,
                failureRate: sla?.[0]?.failure_count || 0
            },
            recentErrors: errors,
            topKeys: topKeys,
            sla: sla?.[0]
        });

    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

import { ContributionService } from '../../services/ContributionService';

const contributionService = new ContributionService();

/**
 * GET /api/v1/admin/contributions
 * List contribution events or pending transactions
 */
router.get('/contributions', async (req: Request, res: Response) => {
    try {
        const { status } = req.query;

        // Pending Queue
        if (status === 'pending') {
            const { data, error } = await supabase
                .from('pending_contributions')
                .select('*')
                .in('status', ['pending', 'failed'])
                .order('created_at', { ascending: false })
                .limit(50);
            if (error) throw error;
            return res.json(data);
        }

        // History (Contributor Events)
        let query = supabase
            .from('contributor_events')
            .select('*')
            .order('block_timestamp', { ascending: false })
            .limit(50);

        // Optional filtering by validity
        if (status === 'valid') {
            query = query.eq('is_valid', true);
        } else if (status === 'invalid') {
            query = query.eq('is_valid', false);
        }

        const { data, error } = await query;

        if (error) throw error;
        res.json(data);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/v1/admin/contributions/sync
 * Secure Manual Sync (Audit Safe)
 */
router.post('/contributions/sync', async (req: Request, res: Response) => {
    try {
        const { txHash } = req.body;
        if (!txHash) return res.status(400).json({ error: 'Missing txHash' });

        const result = await contributionService.manualSync(txHash);

        // Log the sync attempt
        await auditService.log({
            actorId: (req as any).user?.address || 'admin',
            action: 'CONTRIBUTION_SYNC',
            targetId: txHash,
            metadata: { result },
            ip: req.ip
        });

        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/v1/admin/contributions/:id/invalidate
 * Soft Invalidation (Financial Integrity Safe)
 */
router.post('/contributions/:id/invalidate', async (req: Request, res: Response) => {
    try {
        const { reason } = req.body;
        if (!reason) return res.status(400).json({ error: 'Reason is required for invalidation' });

        const actorId = (req as any).user?.address || 'admin';
        await contributionService.invalidateContribution(req.params.id, reason, actorId);

        res.json({ success: true, message: 'Contribution invalidated.' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/v1/admin/contributions/:id/revalidate
 * Restore an invalidated contribution
 */
router.post('/contributions/:id/revalidate', async (req: Request, res: Response) => {
    try {
        const { reason } = req.body;
        const actorId = (req as any).user?.address || 'admin';
        await contributionService.revalidateContribution(req.params.id, reason || 'Manual Revalidation', actorId);

        res.json({ success: true, message: 'Contribution revalidated.' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/v1/admin/users
 * List all users with profile data
 */
router.get('/users', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;
        res.json(data);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/v1/admin/users/:id/logs
 * View specific user activity logs
 */
router.get('/users/:id/logs', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // 1. Get user's API keys
        const { data: keys } = await supabase.from('api_keys').select('id').eq('owner_user_id', id);
        const keyIds = keys?.map(k => k.id) || [];

        // 2. Get API usage logs for these keys
        const { data, error } = await supabase
            .from('api_usage')
            .select('*')
            .in('api_key_id', keyIds)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;
        res.json(data);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/v1/admin/users/:id/verify
 * Manually verify a user's email (Deletes pending tokens + Audit Log)
 */
router.post('/users/:id/verify', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const actorId = (req as any).user?.address || 'admin';

        // 1. Update User
        const { data, error } = await supabase
            .from('users')
            .update({ is_email_verified: true })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // 2. Delete any pending verification tokens
        await supabase
            .from('email_verification_tokens')
            .delete()
            .eq('user_id', id);

        // 3. Audit Log
        await auditService.log({
            actorId,
            action: 'EMAIL_VERIFIED_MANUAL',
            targetId: id,
            metadata: { user: data.wallet_address, email: data.email },
            ip: req.ip
        });

        res.json({ success: true, user: data });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});


/**
 * POST /api/v1/admin/users/:id/send-verification
 * Admin: Trigger verification email with custom expiry
 */
router.post('/users/:id/send-verification', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { expiryMinutes } = z.object({
            expiryMinutes: z.number().int().min(1).max(43200).optional().default(15) // Default 15m, Max 30 days
        }).parse(req.body);

        const actorId = (req as any).user?.address || 'admin';

        // 1. Fetch User
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('email, is_email_verified')
            .eq('id', id)
            .single();

        if (userError || !user) throw new Error('User not found');
        if (!user.email) return res.status(400).json({ error: 'User has no email address' });

        // 2. Invalidate Check: Delete existing tokens
        await supabase
            .from('email_verification_tokens')
            .delete()
            .eq('user_id', id);

        // 3. Generate New Token
        const token = generateRandomToken(32);
        const tokenHash = hashToken(token);
        const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

        // 4. Store Token
        const { error: tokenError } = await supabase
            .from('email_verification_tokens')
            .insert({
                user_id: id,
                token_hash: tokenHash,
                expires_at: expiresAt.toISOString(),
                last_requested_at: new Date().toISOString()
            });

        if (tokenError) throw tokenError;

        // 5. Send Email
        // 5. Get Template & Enqueue
        const { data: template } = await supabase
            .from('email_templates')
            .select('id')
            .eq('name', 'admin-verification')
            .single();

        if (!template) {
            // Fallback for immediate fix if template missing, or throw
            throw new Error('Verification email template not configured (admin-verification)');
        }

        const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://txproof.xyz'}/verify/${token}`;

        await emailQueueService.enqueueJob({
            recipientEmail: user.email,
            category: 'transactional',
            templateId: template.id,
            priority: 'high',
            metadata: {
                verifyUrl,
                expiryMinutes: expiryMinutes.toString()
            }
        });

        // 6. Audit Log
        await auditService.log({
            actorId,
            action: 'ADMIN_VERIFICATION_EMAIL_SENT',
            targetId: id,
            metadata: {
                email: user.email,
                expiryMinutes,
                expiresAt: expiresAt.toISOString()
            },
            ip: req.ip
        });

        res.json({ success: true, message: `Verification email sent (Expires in ${expiryMinutes}m)` });
    } catch (e: any) {
        logger.error('Admin Verify Error', { error: e.message });
        res.status(500).json({ error: e.message });
    }
});




/**
 * EMAIL OPERATIONS
 * ============================================================================
 */

/**
 * GET /api/v1/admin/email/templates
 * List all templates
 */
router.get('/email/templates', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('email_templates')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;
        res.json(data);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/v1/admin/email/templates
 * Create a new template
 */
router.post('/email/templates', async (req: Request, res: Response) => {
    try {
        const { name, subject, htmlContent, category } = req.body;

        // Basic validation
        if (!name || !subject || !htmlContent || !category) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const { data, error } = await supabase
            .from('email_templates')
            .insert({
                name,
                subject,
                html_content: htmlContent,
                category
            })
            .select()
            .single();

        if (error) throw error;

        await auditService.log({
            actorId: (req as any).user?.address || 'admin',
            action: 'EMAIL_TEMPLATE_CREATED',
            targetId: data.id,
            metadata: { name, category },
            ip: req.ip
        });

        res.json(data);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * PUT /api/v1/admin/email/templates/:id
 * Update template
 */
router.put('/email/templates/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, subject, htmlContent, category, isActive } = req.body;

        const updates: any = { updated_at: new Date().toISOString() };
        if (name) updates.name = name;
        if (subject) updates.subject = subject;
        if (htmlContent) updates.html_content = htmlContent;
        if (category) updates.category = category;
        if (typeof isActive === 'boolean') updates.is_active = isActive;

        const { data, error } = await supabase
            .from('email_templates')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        await auditService.log({
            actorId: (req as any).user?.address || 'admin',
            action: 'EMAIL_TEMPLATE_UPDATED',
            targetId: id,
            metadata: { name: data.name },
            ip: req.ip
        });

        res.json(data);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/v1/admin/email/send
 * Launch an email campaign or send single email
 */
router.post('/email/send', async (req: Request, res: Response) => {
    try {
        const { category, templateId, audience, segmentConfig } = req.body;

        // Validation
        if (!category || !templateId || !audience) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const actorId = (req as any).user?.address || 'admin';

        // 1. Resolve Recipients
        let recipients: { id: string, email: string }[] = [];

        if (audience === 'single') {
            if (!segmentConfig?.email) return res.status(400).json({ error: 'Missing target email for single send' });
            // Potentially lookup user ID if exists, or send generic
            const { data: user } = await supabase.from('users').select('id, email').eq('email', segmentConfig.email).single();
            if (user) {
                recipients.push(user);
            } else {
                // For now, only allowing existing users to be safe with verified check
                return res.status(400).json({ error: 'Recipient must be a registered user.' });
            }
        } else if (audience === 'verified_users') {
            const { data } = await supabase
                .from('users')
                .select('id, email')
                .eq('is_email_verified', true);
            if (data) recipients = data;
        } else if (audience === 'all_users') {
            // BE CAREFUL: "all_users" logic should probably still filter by verified for certain things?
            // The prompt said "only verified emails used" for security requirements.
            // So "all_users" effectively means "all verified users" if we strictly enforce verification in queue.
            // Let's filter here too to save queue worker from erroring.
            const { data } = await supabase
                .from('users')
                .select('id, email')
                .eq('is_email_verified', true);
            if (data) recipients = data;
        }

        if (recipients.length === 0) {
            return res.json({ success: true, message: 'No valid recipients found for criteria.', jobsCreated: 0 });
        }

        // 2. Enqueue Jobs
        let jobsCreated = 0;
        for (const recipient of recipients) {
            try {
                await emailQueueService.enqueueJob({
                    userId: recipient.id,
                    recipientEmail: recipient.email,
                    category,
                    templateId,
                    metadata: { source: 'admin_campaign', actorId }
                });
                jobsCreated++;
            } catch (err) {
                // Log but continue (e.g. unverified user skipped if enqueue checks again)
                logger.warn(`Skipped recipient ${recipient.email}: ${(err as Error).message}`);
            }
        }

        // 3. Audit Log
        await auditService.log({
            actorId,
            action: 'EMAIL_CAMPAIGN_LAUNCHED',
            targetId: templateId,
            metadata: { category, audience, jobsCreated },
            ip: req.ip
        });

        res.json({ success: true, message: `Campaign queued for ${jobsCreated} recipients.`, jobsCreated });

    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/v1/admin/email/stats
 * Dashboard stats
 */
router.get('/email/stats', async (req: Request, res: Response) => {
    try {
        const { count: queued } = await supabase.from('email_jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        const { count: sent } = await supabase.from('email_jobs').select('*', { count: 'exact', head: true }).eq('status', 'sent');
        const { count: failed } = await supabase.from('email_jobs').select('*', { count: 'exact', head: true }).in('status', ['failed', 'permanent_fail']);

        // Recent failures
        const { data: recentFailures } = await supabase
            .from('email_jobs')
            .select('id, recipient_email, error, attempt_count, created_at')
            .in('status', ['failed', 'permanent_fail'])
            .order('created_at', { ascending: false })
            .limit(10);

        res.json({
            queued,
            sent,
            failed,
            recentFailures
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
