import { Router, Request, Response } from 'express';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import { saasMiddleware, AuthenticatedRequest } from '../../middleware/saasAuth';
import { ApiKeyService } from '../../services/ApiKeyService';
import { EmailQueueService } from '../../services/EmailQueueService';
import { AuthService } from '../../services/AuthService';
import { UsageController } from '../../controllers/UsageController';
import { randomBytes, createHash } from 'crypto';
import { z } from 'zod';

const router = Router();
const apiKeyService = new ApiKeyService();
const emailQueueService = new EmailQueueService();
const authService = new AuthService();
const usageController = new UsageController();

// --- Public Routes (No Auth Required) ---

/**
 * POST /auth/nonce
 * Generate login nonce for wallet signing
 */
router.post('/auth/nonce', async (req: Request, res: Response) => {
    try {
        const { walletAddress } = req.body;
        if (!walletAddress) return res.status(400).json({ error: 'Wallet address required' });

        const nonce = await authService.generateAndStoreNonce(walletAddress);
        res.json({ nonce });
    } catch (error: any) {
        logger.error('Nonce generation failed', { error: error.message });
        res.status(500).json({ error: 'Failed to generate nonce' });
    }
});

/**
 * POST /auth/login
 * Verify signature and issue JWT
 */
router.post('/auth/login', async (req: Request, res: Response) => {
    try {
        const { walletAddress, signature, nonce } = req.body;
        if (!walletAddress || !signature || !nonce) {
            return res.status(400).json({ error: 'Missing login credentials' });
        }

        const result = await authService.loginUser(walletAddress, signature, nonce);
        res.json(result);
    } catch (error: any) {
        logger.error('Login failed', { error: error.message, wallet: req.body.walletAddress });
        res.status(401).json({ error: error.message || 'Login failed' });
    }
});

// --- Protected Routes (Require SaaS Auth) ---
router.use(saasMiddleware);

/**
 * GET /me
 * Verify current session and return user details
 */
router.get('/me', async (req: Request, res: Response) => {
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

        // Calculate Effective Quota (Sum of all Active Keys)
        const { data: keyQuotas } = await supabase
            .from('api_keys')
            .select('quota_limit')
            .eq('owner_user_id', user.id)
            .eq('is_active', true);

        const effectiveQuota = keyQuotas?.reduce((sum, k) => sum + (k.quota_limit || 0), 0) || userData.monthly_quota;

        res.json({
            id: userData.id,
            wallet_address: userData.wallet_address,
            email: userData.email,
            is_email_verified: userData.is_email_verified,
            account_status: userData.account_status,
            name: userData.name,
            monthly_quota: effectiveQuota,
            allow_promotional_emails: userData.allow_promotional_emails,
            social_config: userData.social_config
        });
    } catch (error: any) {
        logger.error('Auth check error', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /me
 * Update user profile
 */
router.put('/me', async (req: Request, res: Response) => {
    try {
        const user = (req as AuthenticatedRequest).user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { allow_promotional_emails, name, email, social_config } = req.body;
        const updates: any = {};

        // 1. Handle Preference Updates
        if (typeof allow_promotional_emails === 'boolean') {
            updates.allow_promotional_emails = allow_promotional_emails;
        }

        // 2. Handle Identity Updates
        if (name !== undefined) updates.name = name;

        // 3. Handle Email Update (Securely)
        if (email !== undefined) {
            // Fetch current state to check verification status
            const { data: currentUser } = await supabase
                .from('users')
                .select('is_email_verified, email')
                .eq('id', user.id)
                .single();

            if (currentUser?.is_email_verified && currentUser.email !== email) {
                // STRICT: Prevent changing verified email
                return res.status(403).json({ error: 'Cannot change a verified email address.' });
            }

            if (email !== currentUser?.email) {
                // CHECK DUPLICATE VERIFIED EMAIL
                const { data: conflict } = await supabase
                    .from('users')
                    .select('id')
                    .eq('email', email)
                    .eq('is_email_verified', true)
                    .neq('id', user.id)
                    .single();

                if (conflict) {
                    return res.status(409).json({ error: 'Email is already taken by a verified account.' });
                }

                updates.email = email;
                updates.is_email_verified = false; // Reset verification on change
            }
        }

        // 4. Handle Social Config Updates
        if (social_config && typeof social_config === 'object') {
            const allowedPlatforms = ['twitter', 'github', 'discord', 'telegram'];

            for (const platform of allowedPlatforms) {
                let handle = (social_config as any)[platform];
                if (handle && typeof handle === 'string') {
                    handle = handle.trim();
                    // Update the config object with trimmed version to save clean data
                    (social_config as any)[platform] = handle;

                    // Check for duplicates (Case Insensitive)
                    const { data: socialConflict } = await supabase
                        .from('users')
                        .select('id')
                        // Use ilike for case-insensitive match on the JSON value
                        .ilike(`social_config->>${platform}`, handle)
                        .neq('id', user.id)
                        .limit(1)
                        .maybeSingle();

                    if (socialConflict) {
                        return res.status(409).json({ error: `${platform} handle '${handle}' is already claimed by another user.` });
                    }
                }
            }
            updates.social_config = social_config;
        }

        if (Object.keys(updates).length === 0) {
            return res.json({ message: 'No changes' });
        }

        const { error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', user.id);

        if (error) throw error;

        res.json({ success: true });
    } catch (error: any) {
        logger.error('Update profile error', { error: error.message });
        res.status(500).json({ error: 'Failed to update profile' });
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
 * GET /usage
 * Relay to UsageController for User-Level Usage
 */
router.get('/usage', (req, res) => usageController.getUsage(req, res));

/**
 * GET /usage/history
 * Relay to UsageController
 */
router.get('/usage/history', (req, res) => usageController.getHistory(req, res));

/**
 * GET /usage/stats
 * Relay to UsageController
 */
router.get('/usage/stats', (req, res) => usageController.getStats(req, res));

/**
 * POST /keys
 * Create a new API Key (Verified Email Required)
 */
router.post('/keys', async (req: Request, res: Response) => {
    try {
        const user = (req as AuthenticatedRequest).user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { name } = req.body; // 'name' here effectively maps to Plan Name (e.g. Free, Pro)

        // 1. Strict Email Verification Check
        const { data: userData } = await supabase
            .from('users')
            .select('is_email_verified')
            .eq('id', user.id)
            .single();

        if (!userData || !userData.is_email_verified) {
            return res.status(403).json({ error: 'You must verify your email address before creating API keys.' });
        }

        // 2. Create Key
        // Validate plan name or default to Free
        const validPlans = ['Free', 'Start-up', 'Pro', 'Enterprise'];
        const planName = validPlans.includes(name) ? name : 'Free';

        const result = await apiKeyService.createKey(user.wallet_address, planName as any, { ownerUserId: user.id });
        res.json(result);

    } catch (error: any) {
        logger.error('Create key error', { error: error.message });
        res.status(500).json({ error: 'Failed to create key' });
    }
});

/**
 * Revoke Key
 */
router.post('/keys/:id/revoke', async (req: Request, res: Response) => {
    try {
        const user = (req as AuthenticatedRequest).user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { id } = req.params;

        // Verify ownership
        const { data: key } = await supabase
            .from('api_keys')
            .select('id')
            .eq('id', id)
            .eq('owner_user_id', user.id)
            .single();

        if (!key) return res.status(404).json({ error: 'Key not found' });

        await supabase
            .from('api_keys')
            .update({ is_active: false })
            .eq('id', id);

        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/keys', async (req: Request, res: Response) => {
    try {
        const user = (req as AuthenticatedRequest).user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { data: keys, error } = await supabase
            .from('api_keys')
            .select('*, plan:plans(name, monthly_quota)')
            .eq('owner_user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Calculate start of current month
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

        // Hydrate keys with REAL usage_month count
        // We use Promise.all to fetch counts in parallel. For < 20 keys this is fast enough.
        const safeKeys = await Promise.all(keys.map(async (k) => {
            const { count } = await supabase
                .from('usage_events')
                .select('*', { count: 'exact', head: true })
                .eq('api_key_id', k.id)
                .gte('created_at', startOfMonth);

            return {
                ...k,
                usage_month: count || 0
            };
        }));

        res.json(safeKeys);
    } catch (error: any) {
        logger.error('List keys error', { error: error.message });
        res.status(500).json({ error: 'Failed to list keys' });
    }
});

/**
 * POST /upgrade
 * Plan upgrade stub
 */
router.post('/upgrade', async (req: Request, res: Response) => {
    // Placeholder for Stripe/billing integration
    res.status(501).json({ error: 'Self-serve upgrades coming soon. Contact sales.' });
});

export { router as userRouter };
