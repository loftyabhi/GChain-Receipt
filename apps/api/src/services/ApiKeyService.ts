import { createHash, randomBytes } from 'crypto';
import { supabase } from '../lib/supabase';

export interface ApiKeyDetails {
    id: string;
    owner_id: string;
    plan: {
        id: string;
        name: string;
        rate_limit_rps: number;
        monthly_quota: number;
        priority_level: number;
    };
    environment: 'live' | 'test';
    permissions: string[];
    ipAllowlist?: string[] | null;
}

export class ApiKeyService {

    /**
     * Generate a new API Key.
     * Returns the raw key (Display Once) and stores the hash.
     */
    async createKey(ownerId: string, planName: 'Free' | 'Pro' | 'Enterprise' = 'Free', options?: { ownerUserId?: string }) {
        // 1. Get Plan ID
        const { data: plan } = await supabase
            .from('plans')
            .select('id, monthly_quota')
            .eq('name', planName)
            .single();

        if (!plan) throw new Error(`Plan ${planName} not found`);

        // 2. Generate Key
        const random = randomBytes(24).toString('hex');
        const rawKey = `sk_live_${random}`;
        const prefix = `sk_live_${random.substring(0, 4)}`;
        const hash = createHash('sha256').update(rawKey).digest('hex');

        // 3. Store
        const { data, error } = await supabase
            .from('api_keys')
            .insert({
                key_hash: hash,
                prefix: prefix,
                owner_id: ownerId,
                owner_user_id: options?.ownerUserId || null,
                plan_id: plan.id,
                plan_tier: planName,
                quota_limit: plan.monthly_quota,
                environment: 'live',
                is_active: true
            })
            .select()
            .single();

        if (error) throw error;

        return {
            id: data.id,
            key: rawKey,
            prefix
        };
    }

    /**
     * Authenticate a request.
     */
    async verifyKey(rawKey: string): Promise<ApiKeyDetails | null> {
        const hash = createHash('sha256').update(rawKey).digest('hex');

        const { data, error } = await supabase
            .from('api_keys')
            .select(`
                id,
                owner_id,
                environment,
                permissions,
                is_active,
                ip_allowlist,
                abuse_flag,
                plan:plans (
                    id, 
                    name, 
                    rate_limit_rps, 
                    monthly_quota,
                    max_burst,
                    priority_level
                )
            `)
            .eq('key_hash', hash)
            .single();

        if (error || !data) return null;

        // 1. Hard Abuse Validation
        if (data.abuse_flag) {
            console.warn(`[Security] Blocked abuse-flagged key: ${data.id}`);
            return null;
        }

        if (!data.is_active) return null;

        // Flatten checks
        return {
            id: data.id,
            owner_id: data.owner_id,
            environment: data.environment,
            permissions: data.permissions,
            ipAllowlist: data.ip_allowlist,
            plan: data.plan as any
        };
    }

    /**
     * Find an active key for a user (for Dashboard/JWT usage).
     */
    async getActiveKeyForUser(userId: string): Promise<ApiKeyDetails | null> {
        const { data, error } = await supabase
            .from('api_keys')
            .select(`
                id,
                owner_id,
                environment,
                permissions,
                is_active,
                ip_allowlist,
                abuse_flag,
                plan:plans (
                    id, 
                    name, 
                    rate_limit_rps, 
                    monthly_quota,
                    max_burst,
                    priority_level
                )
            `)
            .eq('owner_user_id', userId)
            .eq('is_active', true)
            .limit(1)
            .single();

        if (error || !data) return null;

        if (data.abuse_flag) return null;

        return {
            id: data.id,
            owner_id: data.owner_id,
            environment: data.environment,
            permissions: data.permissions,
            ipAllowlist: data.ip_allowlist,
            plan: data.plan as any
        };
    }

    /**
     * Check if key has quota remaining and increment usage.
     * Returns detailed object for header injection.
     */
    /**
     * Check if key has quota remaining and increment usage.
     * Returns detailed object for header injection.
     */
    async checkAndIncrementUsage(keyId: string): Promise<{
        allowed: boolean;
        used: number;
        limit: number;
        remaining: number
    }> {
        // 1. Get Current Usage and Plan Limit
        const { data: keyData, error: keyError } = await supabase
            .from('api_keys')
            .select(`
                id, quota_limit,
                plan:plans (monthly_quota, name)
            `)
            .eq('id', keyId)
            .single();

        if (keyError || !keyData) {
            return { allowed: false, used: 0, limit: 0, remaining: 0 };
        }

        // Fix: Handle partial/array TS inference
        const planObj = Array.isArray(keyData.plan) ? keyData.plan[0] : keyData.plan;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const planLimit = (planObj as any)?.monthly_quota;

        const limit = planLimit || keyData.quota_limit || 100;

        // 2. Increment usage mechanism
        const { data: rpcResult, error } = await supabase.rpc('increment_api_usage', {
            p_key_id: keyId,
            p_cost: 1
        });

        if (error) {
            console.error('Usage RPC Error:', error);
            // Default closed behavior for safety
            return { allowed: false, used: limit, limit, remaining: 0 };
        }

        const isAllowed = !!rpcResult; // RPC returns boolean

        // 3. Get accurate count for headers
        const { data: agg } = await supabase
            .from('api_usage_aggregates')
            .select('request_count')
            .eq('api_key_id', keyId)
            .eq('period_start', new Date().toISOString().slice(0, 7) + '-01') // YYYY-MM-01
            .single();

        const currentUsed = (agg?.request_count || 0);
        const remaining = Math.max(0, limit - currentUsed);

        return {
            allowed: isAllowed,
            used: currentUsed,
            limit,
            remaining
        };
    }

    /**
     * Async Log (Fire & Forget)
     */
    async logRequest(log: { apiKeyId: string, endpoint: string, status: number, duration: number, ip: string }) {
        // In high scale, push to a queue. For now, direct insert.
        await supabase.from('api_usage').insert({
            api_key_id: log.apiKeyId,
            endpoint: log.endpoint,
            status_code: log.status,
            duration_ms: log.duration,
            ip_address: log.ip
        });
    }
}
