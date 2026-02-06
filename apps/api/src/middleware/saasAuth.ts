import { Request, Response, NextFunction } from 'express';
import { ApiKeyService, ApiKeyDetails } from '../services/ApiKeyService';
import { UsageService } from '../services/UsageService';

const apiKeyService = new ApiKeyService();
const usageService = new UsageService();

export interface AuthenticatedRequest extends Request {
    auth?: ApiKeyDetails; // Public API Context
    user?: { id: string; wallet_address: string; role?: string }; // Internal User Context
    apiKeyId?: string; // INVARIANT: ALWAYS PRESENT
}

// Trust Configuration
const INTERNAL_DOMAINS = ['backend.txproof.xyz', 'localhost', '127.0.0.1'];

function isInternalRequest(req: Request): boolean {
    const host = req.get('host') || '';
    const hostname = host.split(':')[0];
    return INTERNAL_DOMAINS.includes(hostname);
}

/**
 * SaaS Governance Middleware (STRICT)
 * 
 * Responsibilities:
 * 1. Authenticate (JWT or API Key)
 * 2. Resolve 'apiKeyId' (System or User Key)
 * 3. Enforce Quota (Increment Usage)
 * 4. Reject ANYTHING that fails 1, 2, or 3.
 */
export const saasMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const isInternal = isInternalRequest(req);
    const authHeader = req.headers['authorization'];
    const apiKeyHeader = req.headers['x-api-key'];

    let quotaResult = null;

    try {
        // =================================================================
        // PATH A: INTERNAL / JWT
        // =================================================================
        if (isInternal && authHeader?.startsWith('Bearer ') && !authHeader?.includes('sk_')) {
            // 1. Verify JWT
            const token = authHeader.split(' ')[1];

            try {
                // Dynamic import to break potential cycle if AuthService imports middleware
                const { AuthService } = require('../services/AuthService');
                const authService = new AuthService();
                const payload = authService.verifyToken(token);

                (req as AuthenticatedRequest).user = {
                    id: payload.id,
                    wallet_address: payload.wallet_address,
                    role: payload.role
                };

                // 2. INJECT SYSTEM KEY
                const sysKeyId = await apiKeyService.getSystemApiKeyId();
                (req as AuthenticatedRequest).apiKeyId = sysKeyId;

                // 3. Increment Usage (Unlimited, but tracked)
                // We use incrementApiKeyUsage even for system to keep tracking consistent
                quotaResult = await usageService.incrementApiKeyUsage(sysKeyId, 1);

            } catch (e: any) {
                return res.status(401).json({ code: 'AUTH_FAILED', error: 'Invalid JWT' });
            }
        }

        // =================================================================
        // PATH B: EXTERNAL / API KEY
        // =================================================================
        else {
            let key = '';
            if (apiKeyHeader) {
                key = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
            } else if (authHeader?.startsWith('Bearer ')) {
                key = authHeader.slice(7);
            }

            if (!key) {
                return res.status(401).json({ code: 'MISSING_KEY', error: 'API Key Required (X-API-Key)' });
            }

            // 1. Verify Key
            const details = await apiKeyService.verifyKey(key);
            if (!details) {
                return res.status(401).json({ code: 'INVALID_KEY', error: 'Invalid API Key' });
            }

            (req as AuthenticatedRequest).auth = details;

            // 2. Attach ID
            const keyId = details.id;
            (req as AuthenticatedRequest).apiKeyId = keyId;

            // 3. Enforce Quota
            quotaResult = await usageService.incrementApiKeyUsage(keyId, 1);
        }

        // =================================================================
        // STRICT ENFORCEMENT
        // =================================================================
        if (!quotaResult) {
            return res.status(500).json({ code: 'INTERNAL_ERROR', error: 'Usage tracking failed' });
        }

        res.setHeader('X-Quota-Limit', quotaResult.limit);
        res.setHeader('X-Quota-Used', quotaResult.used);
        res.setHeader('X-Quota-Remaining', quotaResult.remaining);

        if (!quotaResult.allowed) {
            return res.status(429).json({
                code: 'QUOTA_EXCEEDED',
                error: 'Monthly quota exceeded. Upgrade your plan.'
            });
        }

        next();

    } catch (error: any) {
        console.error('SaaS Middleware Error:', error);
        res.status(500).json({ code: 'INTERNAL_ERROR', error: 'Authentication Error' });
    }
};
