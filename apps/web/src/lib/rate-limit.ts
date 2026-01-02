type RateLimitStore = Map<string, { count: number; lastReset: number }>;

const rateLimitStore: RateLimitStore = new Map();

interface RateLimitConfig {
    interval: number; // Window size in milliseconds
    uniqueTokenPerInterval: number; // Max unique IPs to track (prevent memory leaks)
}

export function rateLimit(config: RateLimitConfig) {
    return {
        check: async (limit: number, token: string) => {
            const now = Date.now();
            const windowStart = now - config.interval;

            // Clean up old entries to prevent memory leaks
            if (rateLimitStore.size > config.uniqueTokenPerInterval) {
                for (const [key, value] of rateLimitStore.entries()) {
                    if (value.lastReset < windowStart) {
                        rateLimitStore.delete(key);
                    }
                }
            }

            const record = rateLimitStore.get(token) || { count: 0, lastReset: now };

            // Reset if window has passed
            if (record.lastReset < windowStart) {
                record.count = 0;
                record.lastReset = now;
            }

            record.count += 1;
            rateLimitStore.set(token, record);

            if (record.count > limit) {
                throw new Error('Rate limit exceeded');
            }

            return true; // Use boolean for simpler checking
        },
    };
}
