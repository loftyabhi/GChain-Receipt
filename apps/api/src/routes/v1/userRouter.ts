import { Router, Request, Response, NextFunction } from 'express';
import { supabase } from '../../lib/supabase';
import { AuthService } from '../../services/AuthService';
import { ApiKeyService } from '../../services/ApiKeyService';
import { EmailService } from '../../services/EmailService';
import { AuditService } from '../../services/AuditService';
import { logger } from '../../lib/logger';
import { z } from 'zod';
import { generateRandomToken, hashToken } from '../../lib/cryptography';
import { strictRateLimiter } from '../../middleware/publicRateLimiter';

const router = Router();
const authService = new AuthService();
const keyService = new ApiKeyService();
const emailService = new EmailService();
const auditService = new AuditService();

// Validation Schemas
const nonceSchema = z.object({
    walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address")
});

const loginSchema = z.object({
    walletAddress: z.string(),
    signature: z.string(),
    nonce: z.string()
});

const createKeySchema = z.object({
    name: z.string().min(1).max(50).optional()
});

// Middleware to verify User JWT
const verifyUser = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing token' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const payload = authService.verifyToken(token);
        // Strict Role Check? Users are role='user'.
        if (payload.role !== 'user' && payload.role !== 'admin') {
            // Allow admins to impersonate/debug if needed, but primarily 'user'.
            return res.status(403).json({ error: 'Invalid role' });
        }
        req.user = payload;
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

/**
 * POST /auth/nonce
 * Public: Generate nonce for wallet
 */
router.post('/auth/nonce', async (req: Request, res: Response) => {
    try {
        const { walletAddress } = nonceSchema.parse(req.body);
        const nonce = await authService.generateAndStoreNonce(walletAddress);
        res.json({ nonce });
    } catch (e: any) {
        logger.warn('Nonce generation failed', { error: e.message });
        res.status(400).json({ error: e.message || 'Invalid Request' });
    }
});

/**
 * POST /auth/login
 * Public: Verify signature, login, return JWT
 */
router.post('/auth/login', async (req: Request, res: Response) => {
    try {
        const { walletAddress, signature, nonce } = loginSchema.parse(req.body);
        const result = await authService.loginUser(walletAddress, signature, nonce);
        res.json(result); // { token, user, ... }
    } catch (e: any) {
        logger.warn('Login failed', { error: e.message });
        res.status(401).json({ error: e.message || 'Authentication failed' });
    }
});

// Profile Update Schema
const updateProfileSchema = z.object({
    name: z.string().max(100).optional(),
    email: z.string().email().optional().or(z.literal('')),
    social_config: z.record(z.string()).optional()
});

/**
 * GET /me
 * Authenticated: Get current user profile & quota overview
 */
router.get('/me', verifyUser, async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error || !user) throw new Error('User not found');

        res.json({
            id: user.id,
            wallet: user.wallet_address,
            name: user.name,
            email: user.email,
            is_email_verified: user.is_email_verified,
            social_config: user.social_config || {}
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * PUT /me
 * Authenticated: Update user profile
 */
router.put('/me', verifyUser, async (req: Request, res: Response) => {
    try {
        const { name, email, social_config } = updateProfileSchema.parse(req.body);
        const userId = req.user.id;

        // Fetch current to check email change
        const { data: current } = await supabase.from('users').select('email, is_email_verified').eq('id', userId).single();

        const updates: any = {};
        if (name !== undefined) updates.name = name;
        if (social_config !== undefined) updates.social_config = social_config;

        if (email !== undefined && email !== current?.email) {
            if (current?.is_email_verified) {
                throw new Error('Verified email cannot be changed. Please contact support.');
            }
            updates.email = email;
            updates.is_email_verified = false; // Reset verification on change
            // Trigger verification email logic here if implemented
        }

        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

/**
 * GET /keys
 * Authenticated: List user's API keys with plan usage
 */
router.get('/keys', verifyUser, async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;

        // Fetch keys joined with Plan
        const { data: keys, error } = await supabase
            .from('api_keys')
            .select(`
                id, prefix, name, created_at, is_active, owner_user_id,
                plan:plans (name, monthly_quota, allows_branding, allows_webhooks),
                overage_count
            `)
            .eq('owner_user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Enhance with real-time usage for this month
        // We could do a separate query or join api_usage_aggregates
        // Doing separate for simplicity
        const keysWithUsage = await Promise.all(keys.map(async (k: any) => {
            const { data: agg } = await supabase
                .from('api_usage_aggregates')
                .select('request_count')
                .eq('api_key_id', k.id)
                .eq('period_start', new Date().toISOString().slice(0, 7) + '-01')
                .single();

            return {
                ...k,
                usage_month: agg?.request_count || 0,
                monthly_limit: k.plan?.monthly_quota
            };
        }));

        res.json(keysWithUsage);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /keys
 * Authenticated: Create new API key
 */
router.post('/keys', verifyUser, async (req: Request, res: Response) => {
    try {
        const { name } = createKeySchema.parse(req.body);
        const userId = req.user.id;

        // 1. Abuse Check: Max 3 active keys per user
        // (Unless Enterprise plan? For now hard limit for abuse prevention defined in plan)
        const { count } = await supabase
            .from('api_keys')
            .select('*', { count: 'exact', head: true })
            .eq('owner_user_id', userId)
            .eq('is_active', true);

        if ((count || 0) >= 3) {
            return res.status(429).json({ error: 'Key limit reached (Max 3). Revoke an existing key or upgrade.' });
        }

        // 2. Create Key (Default to Free Plan)
        // Better: Use `keyService.createKey` with the WALLET address as OwnerID (legacy TEXT), 
        // AND then immediately update `owner_user_id`.

        const result = await keyService.createKey(req.user.address, 'Free'); // Default Free

        // Link to UUID User
        await supabase
            .from('api_keys')
            .update({
                owner_user_id: userId,
                name: name || 'My API Key'
            })
            .eq('id', result.id);

        res.json({ ...result, name });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

/**
 * POST /keys/:id/revoke
 * Authenticated: Revoke/Deactivate key
 */
router.post('/keys/:id/revoke', verifyUser, async (req: Request, res: Response) => {
    try {
        const keyId = req.params.id;
        const userId = req.user.id;

        // Strict Scoping: Must own key
        const { error } = await supabase
            .from('api_keys')
            .update({ is_active: false })
            .eq('id', keyId)
            .eq('owner_user_id', userId); // Scoped

        if (error) throw error;
        res.json({ success: true });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

/**
 * GET /usage
 * Authenticated: User-scoped usage analytics (Aggregate of all keys user owns)
 */
router.get('/usage', verifyUser, async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        // Logic to get all user keys, then sum up their api_usage
        // Or use an RPC that aggregates by user_id

        // For simplicity: Return usage of ALL keys
        const { data: keys } = await supabase.from('api_keys').select('id').eq('owner_user_id', userId);
        const keyIds = keys?.map(k => k.id) || [];

        if (keyIds.length === 0) return res.json({ total: 0, by_day: [] });

        // Get aggregate usage for these keys
        const { data: logs } = await supabase
            .from('api_usage')
            .select('created_at, status_code')
            .in('api_key_id', keyIds)
            .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
            .order('created_at', { ascending: true });

        // Client can process this or we aggregate here.
        // Return raw-ish or bucketted?
        // Bucketted by day is nice.

        res.json({
            logs_count: logs?.length || 0,
            logs_sample: logs?.slice(0, 1000) // careful with size
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /upgrade
 * Authenticated: Request plan upgrade (Lead Gen)
 */
router.post('/upgrade', verifyUser, async (req: Request, res: Response) => {
    try {
        const { plan } = req.body;
        const userId = req.user.id;

        logger.info('Upgrade Request', { userId, plan, wallet: req.user.address });

        res.json({
            success: true,
            message: 'Upgrade request received. Our team will contact you shortly.'
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /verify/request
 * Authenticated: Request email verification link (IP-based strict rate limit + 24h cooldown)
 */
router.post('/verify/request', verifyUser, strictRateLimiter, async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const userIp = req.ip || 'unknown';

        // 1. Fetch user to check if already verified and get email
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('email, is_email_verified')
            .eq('id', userId)
            .single();

        if (userError || !user) throw new Error('User not found');
        if (user?.is_email_verified) return res.status(400).json({ error: 'Email already verified' });
        if (!user.email) return res.status(400).json({ error: 'No email address on profile' });

        // 2. Check Rate Limit (once per 24 hours per user)
        const { data: existingToken } = await supabase
            .from('email_verification_tokens')
            .select('last_requested_at')
            .eq('user_id', userId)
            .order('last_requested_at', { ascending: false })
            .limit(1)
            .single();

        if (existingToken) {
            const lastRequest = new Date(existingToken.last_requested_at).getTime();
            const now = Date.now();
            const diff = now - lastRequest;
            const oneDay = 24 * 60 * 60 * 1000;

            if (diff < oneDay) {
                const hoursRemaining = Math.ceil((oneDay - diff) / (1000 * 60 * 60));
                return res.status(429).json({
                    error: `Please wait ${hoursRemaining} hours before requesting another verification email.`
                });
            }
        }

        // 3. Invalidate/Delete any existing tokens for this user
        await supabase
            .from('email_verification_tokens')
            .delete()
            .eq('user_id', userId);

        // 4. Generate Token (Secure Random String)
        const token = generateRandomToken(32);
        const tokenHash = hashToken(token);
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes (Enterprise Standard)

        // 5. Store Hashed Token
        const { error: tokenError } = await supabase
            .from('email_verification_tokens')
            .insert({
                user_id: userId,
                token_hash: tokenHash,
                expires_at: expiresAt.toISOString(),
                last_requested_at: new Date().toISOString()
            });

        if (tokenError) throw tokenError;

        // 6. Audit Log
        await auditService.log({
            actorId: userId,
            action: 'EMAIL_VERIFICATION_SENT',
            targetId: userId,
            metadata: { email: user.email },
            ip: userIp
        });

        // 7. Send Email (Send raw token, store only hash)
        await emailService.sendVerificationEmail(user.email, token);

        res.json({ success: true, message: 'Verification email sent. Valid for 15 minutes.' });
    } catch (e: any) {
        logger.error('Verification request failed', { userId: req.user.id, error: e.message });
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /verify/:token
 * Public: Process verification link (Hashing lookup)
 * Idempotent: Returns success if already verified.
 */
router.post('/verify/:token', async (req: Request, res: Response) => {
    try {
        const { token } = req.params;
        const incomingHash = hashToken(token);
        const userIp = req.ip || 'unknown';

        // 1. Find Token by Hash
        const { data: tokenData, error: tokenError } = await supabase
            .from('email_verification_tokens')
            .select('user_id, expires_at')
            .eq('token_hash', incomingHash)
            .single();

        if (tokenError || !tokenData) {
            return res.status(400).json({ error: 'Invalid or expired verification link' });
        }

        // 2. Check Expiry (15m enforced)
        if (new Date(tokenData.expires_at) < new Date()) {
            return res.status(400).json({ error: 'Verification link has expired' });
        }

        // 3. Update User & Delete Token (Single-use)
        // Idempotency check: fetch user first
        const { data: user } = await supabase
            .from('users')
            .select('is_email_verified')
            .eq('id', tokenData.user_id)
            .single();

        if (user?.is_email_verified) {
            // Clean up token anyway
            await supabase.from('email_verification_tokens').delete().eq('token_hash', incomingHash);
            return res.json({ success: true, message: 'Email already verified' });
        }

        const { error: userUpdateError } = await supabase
            .from('users')
            .update({ is_email_verified: true })
            .eq('id', tokenData.user_id);

        if (userUpdateError) throw userUpdateError;

        await supabase
            .from('email_verification_tokens')
            .delete()
            .eq('token_hash', incomingHash);

        // 4. Audit Log
        await auditService.log({
            actorId: tokenData.user_id,
            action: 'EMAIL_VERIFIED_SUCCESS',
            targetId: tokenData.user_id,
            ip: userIp
        });

        res.json({ success: true, message: 'Email successfully verified' });

    } catch (e: any) {
        logger.error('Email verification process failed', { error: e.message });
        res.status(500).json({ error: 'Verification failed. Please contact support.' });
    }
});


export const userRouter = router;
