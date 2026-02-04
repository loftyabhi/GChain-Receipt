import { Request, Response, NextFunction } from 'express';
import { ApiKeyService, ApiKeyDetails } from '../services/ApiKeyService';
import { AnalyticsService } from '../services/AnalyticsService';

const apiKeyService = new ApiKeyService();
const analyticsService = new AnalyticsService();

// Extended Request type to include auth context
export interface AuthenticatedRequest extends Request {
    auth?: ApiKeyDetails;
}

// In-Memory Token Bucket for Realtime RPS (Per Instance)
// Key: api_key_id -> { tokens, lastRefill }
const buckets = new Map<string, { tokens: number, lastRefill: number }>();

function checkRealtimeLimit(keyId: string, limitRps: number): boolean {
    const now = Date.now();
    const bucket = buckets.get(keyId) || { tokens: limitRps, lastRefill: now };

    // Refill logic
    const elapsed = (now - bucket.lastRefill) / 1000; // seconds
    if (elapsed > 0) {
        const added = elapsed * limitRps;
        bucket.tokens = Math.min(limitRps, bucket.tokens + added);
        bucket.lastRefill = now;
    }

    if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        buckets.set(keyId, bucket);
        return true;
    }

    return false;
}

export const saasMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    // 4. Auth & API Key Key Context Resolution
    let details: ApiKeyDetails | null = null;
    let authMethod = 'apikey';

    try {
        // Priority 1: User Auth (Bearer JWT)
        if (authHeader?.startsWith('Bearer ') && !authHeader.startsWith('Bearer sk_')) {
            authMethod = 'jwt';
            const token = authHeader.split(' ')[1];
            try {
                // Lazy load AuthService
                const { AuthService } = require('../services/AuthService');
                const authService = new AuthService();
                const payload = authService.verifyToken(token);

                if (payload && payload.id) {
                    // Resolve Primary Key
                    // Usage: user.primary_api_key_id (Future Optimization)
                    // Current: getActiveKeyForUser acts as the resolver.
                    details = await apiKeyService.getActiveKeyForUser(payload.id);

                    if (!details) {
                        // Strict Guard: No valid API Key context found for this user.
                        // We do NOT auto-create keys here to avoid side effects (mutating billing state) in middleware.
                        return res.status(400).json({
                            code: 'NO_LINKED_API_KEY',
                            error: 'No active API Key linked to your account. Please create one in the Dashboard.'
                        });
                    }
                }
            } catch (e) {
                // Std: If Bearer provided but invalid -> 401
                return res.status(401).json({ code: 'INVALID_TOKEN', error: 'Invalid Authentication Token' });
            }
        }

        // Priority 2: Machine Auth (X-API-Key)
        else if (req.headers['x-api-key']) {
            authMethod = 'apikey';
            const key = Array.isArray(req.headers['x-api-key']) ? req.headers['x-api-key'][0] : req.headers['x-api-key'];
            if (key) details = await apiKeyService.verifyKey(key);
        }

        // Priority 3: Legacy Machine Auth (Bearer sk_)
        else if (apiKey && apiKey.startsWith('sk_')) {
            authMethod = 'legacy';
            details = await apiKeyService.verifyKey(apiKey);
        }

        // 1. Authentication Check
        if (!details) {
            if (authMethod === 'jwt') {
                return res.status(403).json({ code: 'NO_ACTIVE_API_KEY', error: 'Dashboard users must have an active API Key to use this feature. Please create one in Settings.' });
            }
            return res.status(401).json({ code: 'MISSING_API_KEY', error: 'Missing or invalid API Key' });
        }

        // 1.1 Hard Abuse/Invalid Check - (Already checked in Service, but double safety)
        if (details.ipAllowlist && details.ipAllowlist.length > 0) {
            const clientIp = req.ip || '0.0.0.0';
            if (!details.ipAllowlist.includes(clientIp)) {
                return res.status(403).json({ code: 'IP_NOT_ALLOWED', error: 'IP Address not allowed' });
            }
        }

        // 2. Realtime Rate Limit (RPS)
        if (!checkRealtimeLimit(details.id, details.plan.rate_limit_rps)) {
            return res.status(429).json({ code: 'RATE_LIMIT_EXCEEDED', error: 'Too Many Requests (Rate Limit)' });
        }

        // 3. Quota Limit (Monthly)
        const quota = await apiKeyService.checkAndIncrementUsage(details.id);

        // Standard Headers (Stripe-like)
        res.setHeader('X-Quota-Limit', quota.limit);
        res.setHeader('X-Quota-Used', quota.used);
        res.setHeader('X-Quota-Remaining', quota.remaining);

        if (!quota.allowed) {
            // Overage logic handled in Service or here?
            return res.status(402).json({
                code: 'QUOTA_EXCEEDED',
                error: 'Monthly Quota Exceeded. Please upgrade your plan.'
            });
        }

        // Attach context
        (req as AuthenticatedRequest).auth = details;

        // Response Hook for Logging (Latency & Status)
        const start = Date.now();
        res.on('finish', () => {
            if (!details) return;

            const duration = Date.now() - start;
            // Fire & Forget Logging
            analyticsService.trackRequest({
                apiKeyId: details.id,
                endpoint: req.originalUrl || req.path,
                method: req.method,
                status: res.statusCode,
                duration,
                ip: req.ip || 'unknown',
                userAgent: req.get('user-agent'),
                metadata: { auth_mode: authMethod }
            }).catch(console.error);
        });

        next();

    } catch (error) {
        console.error('Middleware Error:', error);
        res.status(500).json({ code: 'INTERNAL_AUTH_ERROR', error: 'Internal Auth Error' });
    }
};
