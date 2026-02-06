/**
 * Public Rate Limiter Utility
 * 
 * NOTE: As of Strict Architecture, this is a DEFENSE-IN-DEPTH layer only.
 * It does NOT authorize usage. It protects the *Auth Endpoints* (login/nonce) mostly.
 * 
 * Actual API usage is governed by ApiKey (SaaS) middleware.
 */
import { Request, Response, NextFunction } from 'express';

// Configuration
const PUBLIC_RATE_LIMIT = parseInt(process.env.PUBLIC_RATE_LIMIT_RPM || '60');
const CLEANUP_INTERVAL_MS = 60 * 1000;

interface BucketEntry {
    tokens: number;
    lastRefill: number;
    violations: number;
}

const buckets = new Map<string, BucketEntry>();

// Cleanup
setInterval(() => {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000;
    for (const [ip, entry] of buckets.entries()) {
        if (now - entry.lastRefill > staleThreshold) {
            buckets.delete(ip);
        }
    }
}, CLEANUP_INTERVAL_MS);

function getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; retryAfterMs: number } {
    const now = Date.now();
    // Allow burst but strict average
    const tokensPerMs = PUBLIC_RATE_LIMIT / 60000;

    let bucket = buckets.get(ip);
    if (!bucket) {
        bucket = { tokens: PUBLIC_RATE_LIMIT, lastRefill: now, violations: 0 };
        buckets.set(ip, bucket);
    }

    const elapsed = now - bucket.lastRefill;
    const refillAmount = elapsed * tokensPerMs;
    bucket.tokens = Math.min(PUBLIC_RATE_LIMIT, bucket.tokens + refillAmount);
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return { allowed: true, remaining: Math.floor(bucket.tokens), retryAfterMs: 0 };
    }

    bucket.violations += 1;
    const retryAfterMs = Math.ceil((1 - bucket.tokens) / tokensPerMs);
    return { allowed: false, remaining: 0, retryAfterMs };
}

/**
 * STRICT RATE LIMITER MIDDLEWARE
 * Use for unauthenticated routes like /auth/login or /verification
 */
export const publicRateLimiter = (req: Request, res: Response, next: NextFunction) => {
    const clientIp = getClientIp(req);
    const { allowed, remaining, retryAfterMs } = checkRateLimit(clientIp);

    res.setHeader('X-RateLimit-Limit', PUBLIC_RATE_LIMIT);
    res.setHeader('X-RateLimit-Remaining', remaining);

    if (!allowed) {
        const retryAfterSec = Math.ceil(retryAfterMs / 1000);
        console.warn(`[PublicRateLimit] IP ${clientIp} blocked`);
        return res.status(429).json({
            code: 'RATE_LIMIT_EXCEEDED',
            error: 'Too Many Requests',
            retryAfter: retryAfterSec
        });
    }

    next();
};

export const strictRateLimiter = publicRateLimiter; // Alias
