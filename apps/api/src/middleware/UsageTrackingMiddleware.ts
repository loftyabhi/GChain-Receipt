import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

/**
 * Usage Tracking Middleware
 * Logs all API requests to api_usage table for real metrics
 * Non-blocking: failures don't affect request processing
 */
export function usageTrackingMiddleware(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();

    // Extract API key ID from request (set by auth middleware)
    const apiKeyId = (req as any).apiKeyId || null;

    // Capture original response methods
    const originalSend = res.send;
    const originalJson = res.json;

    let responseBody: any = null;
    let responseSent = false;

    // Intercept response
    res.send = function (data: any) {
        if (!responseSent) {
            responseBody = data;
            responseSent = true;
            logRequest();
        }
        return originalSend.call(this, data);
    };

    res.json = function (data: any) {
        if (!responseSent) {
            responseBody = data;
            responseSent = true;
            logRequest();
        }
        return originalJson.call(this, data);
    };

    // Also handle response finish event as fallback
    res.on('finish', () => {
        if (!responseSent) {
            responseSent = true;
            logRequest();
        }
    });

    async function logRequest() {
        const duration = Date.now() - startTime;

        try {
            const requestSize = req.headers['content-length']
                ? parseInt(req.headers['content-length'])
                : 0;

            const responseSize = res.get('content-length')
                ? parseInt(res.get('content-length') || '0')
                : (responseBody ? JSON.stringify(responseBody).length : 0);

            // Extract error message from response if status >= 400
            let errorMessage = null;
            if (res.statusCode >= 400 && responseBody) {
                if (typeof responseBody === 'string') {
                    try {
                        const parsed = JSON.parse(responseBody);
                        errorMessage = parsed.error || parsed.message || null;
                    } catch {
                        errorMessage = responseBody.substring(0, 200);
                    }
                } else if (responseBody.error || responseBody.message) {
                    errorMessage = responseBody.error || responseBody.message;
                }
            }

            // Extract user info at the END of request (after auth middleware ran)
            const finalUserId = (req as any).user?.id || null;
            const finalApiKeyId = (req as any).apiKeyId || apiKeyId; // Update in case auth middleware set it

            // STRICT ENFORCEMENT: Only log usage if we have a valid identity (User or API Key)
            // Anonymous/Public traffic is NOT logged to usage_events to prevent DB constraint violations.
            if (!finalApiKeyId && !finalUserId) {
                return;
            }

            // Determine Scope (Strict)
            let scope: 'api_key' | 'user';
            if (finalApiKeyId) {
                scope = 'api_key';
            } else {
                scope = 'user';
            }

            // Log to database (fire and forget - don't await)
            supabase
                .from('usage_events')
                .insert({
                    api_key_id: finalApiKeyId,
                    user_id: finalUserId,
                    scope: scope,
                    endpoint: req.path,
                    method: req.method,
                    status_code: res.statusCode,
                    duration_ms: duration,
                    request_size_bytes: requestSize,
                    response_size_bytes: responseSize,
                    user_agent: req.headers['user-agent'] || null,
                    ip_address: req.ip || req.connection.remoteAddress || null,
                    error_message: errorMessage
                })
                .then(({ error }) => {
                    if (error) {
                        logger.error('Failed to log API usage', {
                            error: error.message,
                            endpoint: req.path
                        });
                    }
                });
        } catch (error: any) {
            // Never let logging errors affect the request
            logger.error('Usage tracking error', {
                error: error.message,
                endpoint: req.path
            });
        }
    }

    next();
}
