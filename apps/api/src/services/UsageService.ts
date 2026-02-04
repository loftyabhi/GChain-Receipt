import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

export interface UsageResult {
    allowed: boolean;
    used: number;
    limit: number;
    remaining: number;
}

export class UsageService {

    /**
     * Increment usage for an Internal User (JWT)
     */
    async incrementUserUsage(userId: string, cost: number = 1): Promise<UsageResult> {
        return this.callRpc('user', userId, cost);
    }

    /**
     * Increment usage for a Public API Key
     */
    async incrementApiKeyUsage(keyId: string, cost: number = 1): Promise<UsageResult> {
        return this.callRpc('api_key', keyId, cost);
    }

    /**
     * Private helper to call the unified RPC
     */
    private async callRpc(scope: 'user' | 'api_key', id: string, cost: number): Promise<UsageResult> {
        try {
            const { data, error } = await supabase.rpc('increment_usage', {
                p_scope: scope,
                p_id: id,
                p_cost: cost
            });

            if (error) {
                logger.error('Usage RPC Error', { scope, id, error: error.message });
                // Fail closed for safety
                return { allowed: false, used: 0, limit: 0, remaining: 0 };
            }

            // RPC returns a single object if updated directly, or array if setof table?
            // "RETURNS TABLE" usually returns an array of objects in Supabase clients.
            if (Array.isArray(data) && data.length > 0) {
                const res = data[0];
                return {
                    allowed: res.allowed,
                    used: res.used,
                    limit: res.limit_val, // RPC returned 'limit_val'
                    remaining: res.remaining
                };
            }

            // Fallback
            return { allowed: false, used: 0, limit: 0, remaining: 0 };

        } catch (e: any) {
            logger.error('Usage Service Exception', { message: e.message });
            return { allowed: false, used: 0, limit: 0, remaining: 0 };
        }
    }
}
