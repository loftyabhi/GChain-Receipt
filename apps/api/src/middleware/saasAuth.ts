import { Request, Response, NextFunction } from 'express';
import { ApiKeyService, ApiKeyDetails } from '../services/ApiKeyService';
import { UsageService } from '../services/UsageService';
import { AnalyticsService } from '../services/AnalyticsService';

const apiKeyService = new ApiKeyService();
const usageService = new UsageService();
const analyticsService = new AnalyticsService();

// Extended Request type to include auth context
export interface AuthenticatedRequest extends Request {
    auth?: ApiKeyDetails; // Public API Context
    user?: { id: string; wallet_address: string; role?: string }; // Internal User Context
}

// Trust Configuration
const INTERNAL_DOMAINS = ['backend.txproof.xyz', 'localhost', '127.0.0.1'];
const PUBLIC_DOMAINS = ['api.txproof.xyz'];

function isInternalRequest(req: Request): boolean {
    const host = req.get('host') || '';
    // Strip port for localhost check
    const hostname = host.split(':')[0];
    return INTERNAL_DOMAINS.includes(hostname);
}

export const saasMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const isInternal = isInternalRequest(req);
    const authHeader = req.headers['authorization'];
    const apiKeyHeader = req.headers['x-api-key'];

    // Auth State
    let authContext: 'user' | 'api_key' | null = null;
    let quotaResult = null;
    let resourceId = '';

    try {
        // =================================================================
        // TRUST ZONE 1: INTERNAL (First-Party)
        // =================================================================
        if (isInternal) {
            // Requirement 1: MUST be JWT
            if (!authHeader?.startsWith('Bearer ') || authHeader.startsWith('Bearer sk_')) {
                // If they try to use an API key internally -> BLOCK
                if (apiKeyHeader || authHeader?.startsWith('Bearer sk_')) {
                    return res.status(403).json({
                        code: 'AUTH_MISMATCH',
                        error: 'API Keys are not accepted on internal endpoints. Use JWT.'
                    });
                }
                return res.status(401).json({ code: 'MISSING_AUTH', error: 'Authentication Required (JWT)' });
            }

            // Verify JWT
            const token = authHeader.split(' ')[1];
            try {
                // Lazy Load to avoid circular deps if any
                const { AuthService } = require('../services/AuthService');
                const authService = new AuthService();
                const payload = authService.verifyToken(token);

                if (!payload || !payload.id) {
                    throw new Error('Invalid Token Payload');
                }

                // Attach Context
                (req as AuthenticatedRequest).user = {
                    id: payload.id,
                    wallet_address: payload.wallet_address,
                    role: payload.role
                };

                authContext = 'user';
                resourceId = payload.id;

            } catch (e) {
                return res.status(401).json({ code: 'INVALID_TOKEN', error: 'Invalid or Expired Session' });
            }

            // Strict Ban Check (Database Hit)
            const { data: userStatus } = await import('../lib/supabase').then(m => m.supabase
                .from('users')
                .select('account_status')
                .eq('id', (req as AuthenticatedRequest).user?.id) // Safe access after assignment
                .single()
            );

            if (userStatus && userStatus.account_status !== 'active') {
                return res.status(403).json({
                    code: 'ACCOUNT_SUSPENDED',
                    error: `Your account has been ${userStatus.account_status}. Contact support.`
                });
            }

            // Check User Quota
            quotaResult = await usageService.incrementUserUsage(resourceId, 1);
        }

        // =================================================================
        // TRUST ZONE 2: PUBLIC (Developer API)
        // =================================================================
        else {
            // Requirement 2: MUST be API Key
            let key = '';
            if (apiKeyHeader) {
                key = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
            } else if (authHeader?.startsWith('Bearer sk_')) {
                key = authHeader.slice(7);
            } else {
                // If they try to use JWT externally -> BLOCK
                if (authHeader?.startsWith('Bearer ')) {
                    return res.status(403).json({
                        code: 'AUTH_MISMATCH',
                        error: 'JWT Authentication is not accepted on Public API. Use X-API-Key.'
                    });
                }
                return res.status(401).json({ code: 'MISSING_API_KEY', error: 'X-API-Key Header Required' });
            }

            const details = await apiKeyService.verifyKey(key);
            if (!details) {
                return res.status(401).json({ code: 'INVALID_API_KEY', error: 'Invalid or Inactive API Key' });
            }

            // Attach Context
            (req as AuthenticatedRequest).auth = details;

            authContext = 'api_key';
            resourceId = details.id;

            // Check API Key Quota
            quotaResult = await usageService.incrementApiKeyUsage(resourceId, 1);
        }

        // =================================================================
        // QUOTA ENFORCEMENT & HEADERS
        // =================================================================
        if (!quotaResult) {
            return res.status(500).json({ code: 'INTERNAL_ERROR', error: 'Quota Check Failed' });
        }

        res.setHeader('X-Quota-Limit', quotaResult.limit);
        res.setHeader('X-Quota-Used', quotaResult.used);
        res.setHeader('X-Quota-Remaining', quotaResult.remaining);

        if (!quotaResult.allowed) {
            return res.status(429).json({
                code: 'QUOTA_EXCEEDED',
                error: isInternal
                    ? 'Monthly usage limit reached. Contact support to increase standard quota.'
                    : 'Plan quota exceeded. Please upgrade your plan.'
            });
        }

        // =================================================================
        // LOGGING (Fire & Forget)
        // =================================================================
        const start = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - start;
            // TODO: Update AnalyticsService to handle 'user' scope logs if needed
            // For now, only logging API Key traffic or adapt AnalyticsService later
            // analyticsService.trackRequest(...)
        });

        next();

    } catch (error) {
        console.error('Middleware Critical Error:', error);
        res.status(500).json({ code: 'INTERNAL_AUTH_ERROR', error: 'Internal Auth Error' });
    }
};
