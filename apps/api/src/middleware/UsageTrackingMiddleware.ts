import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

/**
 * Usage Tracking Middleware (STRICT)
 * 
 * INVARIANT: logs ONLY if `apiKeyId` is present in request.
 * Since saasMiddleware now enforces apiKeyId injection for everything 
 * (including internal via System Key), this effectively logs ALL business traffic.
 * 
 * Routes that skip saasMiddleware (e.g., health checks) will SKIP logging.
 */
export function usageTrackingMiddleware(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();

    // Capture references
    const originalSend = res.send;
    const originalJson = res.json;

    let responseBody: any = null;
    let responseSent = false;

    // Helper to extract error
    const extractError = (body: any, code: number) => {
        if (code < 400) return null;
        if (typeof body === 'string') return body.substring(0, 200);
        if (body?.error) return body.error;
        if (body?.message) return body.message;
        return null;
    };

    // Logging Logic
    const logRequest = () => {
        const duration = Date.now() - startTime;

        // 1. RESOLVE API KEY ID (Strict Requirement)
        // Set by saasMiddleware or verifyAdmin
        const apiKeyId = (req as any).apiKeyId;

        if (!apiKeyId) {
            // Strict Mode: No Key = No Log (prevents DB constraint failure)
            // This is correct/safe for health checks / static assets / unauthenticated rejections
            return;
        }

        const requestSize = parseInt(req.headers['content-length'] || '0');
        const responseSize = parseInt(res.get('content-length') || '0') || (responseBody ? JSON.stringify(responseBody).length : 0);
        const errorMessage = extractError(responseBody, res.statusCode);
        const userId = (req as any).user?.id || null; // Optional context

        // Fire & Forget Insert
        supabase.from('usage_events').insert({
            api_key_id: apiKeyId,      // NOT NULL
            user_id: userId,           // Nullable
            endpoint: req.path,
            method: req.method,
            status_code: res.statusCode,
            duration_ms: duration,
            request_size_bytes: requestSize,
            response_size_bytes: responseSize,
            user_agent: req.headers['user-agent'] || null,
            ip_address: req.ip || req.socket.remoteAddress || null,
            error_message: errorMessage
        }).then(({ error }) => {
            if (error) console.error('Usage Log Failed:', error.message);
        });
    };

    // Interceptors
    res.send = function (data) {
        if (!responseSent) { responseBody = data; responseSent = true; logRequest(); }
        return originalSend.call(this, data);
    };

    res.json = function (data) {
        if (!responseSent) { responseBody = data; responseSent = true; logRequest(); }
        return originalJson.call(this, data);
    };

    res.on('finish', () => {
        if (!responseSent) { responseSent = true; logRequest(); }
    });

    next();
}
