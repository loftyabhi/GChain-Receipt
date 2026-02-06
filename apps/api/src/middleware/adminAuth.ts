import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { AuthService } from '../services/AuthService';
import { ApiKeyService } from '../services/ApiKeyService';

const authService = new AuthService();
const apiKeyService = new ApiKeyService();

/**
 * Enterprise-grade Admin Verification Middleware
 * 
 * STRICT ARCHITECTURE UPDATE:
 * - Enforces correct JWT authentication.
 * - INJECTS 'SYSTEM_INTERNAL_API_KEY' ID into request context.
 * - This ensures downstream usage logging always has a valid API Key ID.
 */
export const verifyAdmin = async (req: Request, res: Response, next: NextFunction) => {
    // 1. Try Cookie first (Browser flow)
    let token = req.cookies?.admin_token;

    // 2. Fallback to Header (Dev/CLI flow)
    const authHeader = req.headers.authorization;
    if (!token && authHeader) {
        token = authHeader.split(' ')[1];
    }

    if (!token) {
        // Strict: No token = No Access
        res.status(401).json({ error: 'No token provided' });
        return;
    }

    try {
        const payload = authService.verifyToken(token);

        // Security: Explicit Role Check
        if (payload.role !== 'admin') {
            throw new Error('Unauthorized: Admin role required');
        }

        // Security: Verify current authorized address checks
        const currentAdmin = process.env.ADMIN_ADDRESS?.toLowerCase();
        if (!currentAdmin || payload.address?.toLowerCase() !== currentAdmin) {
            throw new Error('Unauthorized: Session no longer matches configured admin');
        }

        // Security: CSRF Check for mutating requests
        const isMutating = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
        if (isMutating) {
            const csrfHeader = req.headers['x-csrf-token'];
            if (!csrfHeader || Array.isArray(csrfHeader)) {
                throw new Error('Security Error: Missing CSRF Token');
            }

            const headerHash = createHash('sha256').update(csrfHeader as string).digest('hex');

            // Compare with hash stored in JWT
            if (payload.csrfHash && headerHash !== payload.csrfHash) {
                throw new Error('Security Error: Invalid CSRF Token');
            }
        }

        // Attach user to request
        (req as any).user = payload;

        // =========================================================
        // STRICT INVARIANT: INJECT SYSTEM API KEY ID
        // =========================================================
        // Admin traffic is internal traffic. It must be logged against the System Key.
        try {
            const systemKeyId = await apiKeyService.getSystemApiKeyId();
            (req as any).apiKeyId = systemKeyId;
        } catch (sysError) {
            console.error('CRITICAL: Failed to resolve System API Key during Admin Auth', sysError);
            throw new Error('System Integrity Failure: Internal Key Missing');
        }

        // Anti-Caching for privileged data
        res.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
        res.set('Pragma', 'no-cache');

        next();
    } catch (error: any) {
        res.status(403).json({ error: error.message || 'Invalid or expired token' });
    }
};
