import { Router, Request, Response } from 'express';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import { saasMiddleware, AuthenticatedRequest } from '../../middleware/saasAuth';
import { ApiKeyService } from '../../services/ApiKeyService';
import { EmailQueueService } from '../../services/EmailQueueService';
import { UsageController } from '../../controllers/UsageController';
import { randomBytes, createHash } from 'crypto';
import { z } from 'zod';

const router = Router();
const apiKeyService = new ApiKeyService();
const emailQueueService = new EmailQueueService();
const usageController = new UsageController();

// Apply Auth Middleware
router.use(saasMiddleware);

/**
 * GET /auth
 * Verify current session and return user details
 */
router.get('/auth', async (req: Request, res: Response) => {
    try {
        const user = (req as AuthenticatedRequest).user;
        if (!user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        // Fetch latest user data
        const { data: userData, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error || !userData) {
            return res.status(404).json({ error: 'User record not found' });
        }

        res.json({
            id: userData.id,
            wallet_address: userData.wallet_address,
            email: userData.email,
            is_email_verified: userData.is_email_verified,
            account_status: userData.account_status,
            name: userData.name,
            monthly_quota: userData.monthly_quota
        });
    } catch (error: any) {
        logger.error('Auth check error', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /verify
 * Trigger verification email
 */
router.post('/verify', async (req: Request, res: Response) => {
    try {
        const user = (req as AuthenticatedRequest).user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { email } = req.body;

        // 1. Validate Email
        const emailSchema = z.string().email();
        if (!emailSchema.safeParse(email).success) {
            return res.status(400).json({ error: 'Invalid email address' });
        }

        // 2. Update User Email (if changed)
        const { error: updateError } = await supabase
            .from('users')
            .update({ email, is_email_verified: false })
            .eq('id', user.id);

        if (updateError) throw updateError;

        // 3. Generate Token
        const rawToken = randomBytes(32).toString('hex');
        const tokenHash = createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h

        // 4. Store Token
        const { error: tokenError } = await supabase
            .from('email_verification_tokens')
            .insert({
                user_id: user.id,
                token_hash: tokenHash,
                expires_at: expiresAt
            });

        if (tokenError) throw tokenError;

        // 5. Get Template
        const { data: template } = await supabase
            .from('email_templates')
            .select('id')
            .eq('name', 'admin-verification')
            .single();

        if (!template) throw new Error('Verification template not found');

        // 6. Enqueue Email
        const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://txproof.xyz'}/verify?token=${rawToken}`;

        await emailQueueService.enqueueJob({
            userId: user.id,
            recipientEmail: email,
            category: 'transactional',
            templateId: template.id,
            priority: 'high',
            metadata: {
                verifyUrl,
                expiryMinutes: 1440
            }
        });

        res.json({ success: true, message: 'Verification email sent' });

    } catch (error: any) {
        logger.error('Verification trigger error', { error: error.message });
        res.status(500).json({ error: 'Failed to send verification email' });
    }
});

/**
 * GET /keys
 * List API keys
 */
router.get('/keys', async (req: Request, res: Response) => {
    try {
        const user = (req as AuthenticatedRequest).user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { data: keys, error } = await supabase
            .from('api_keys')
            .select('*, plan:plans(name)')
            .eq('owner_user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json(keys);
    } catch (error: any) {
        logger.error('List keys error', { error: error.message });
        res.status(500).json({ error: 'Failed to list keys' });
    }
});

/**
 * POST /keys
 * Create new API key
 */
router.post('/keys', async (req: Request, res: Response) => {
    try {
        const user = (req as AuthenticatedRequest).user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { name, plan } = req.body;

        const result = await apiKeyService.createKey(user.wallet_address, plan || 'Free', {
            ownerUserId: user.id
        });

        // Update name if provided
        if (name) {
            await supabase.from('api_keys').update({ name }).eq('id', result.id);
        }

        res.status(201).json(result);
    } catch (error: any) {
        logger.error('Create key error', { error: error.message });
        res.status(500).json({ error: 'Failed to create key' });
    }
});

/**
 * GET /usage
 * Relay to UsageController
 */
router.get('/usage', (req, res) => usageController.getUsage(req, res));

/**
 * GET /usage/history
 * Relay to UsageController
 */
router.get('/usage/history', (req, res) => usageController.getHistory(req, res));

/**
 * POST /upgrade
 * Plan upgrade stub
 */
router.post('/upgrade', async (req: Request, res: Response) => {
    // Placeholder for Stripe/billing integration
    res.status(501).json({ error: 'Self-serve upgrades coming soon. Contact sales.' });
});

export { router as userRouter };
