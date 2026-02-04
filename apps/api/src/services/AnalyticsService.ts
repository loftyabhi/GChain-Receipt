import { supabase } from '../lib/supabase';

export class AnalyticsService {

    /**
     * Track detailed API request metrics
     */
    async trackRequest(data: {
        apiKeyId: string;
        endpoint: string;
        method: string;
        status: number;
        duration: number;
        ip: string;
        userAgent?: string;
        metadata?: Record<string, any>;
    }) {
        // In high-volume systems, this would buffer to Redis or use a log drain.
        // Direct DB insert for < 100 RPS is fine with Postgres.
        try {
            await supabase.from('api_usage').insert({
                api_key_id: data.apiKeyId,
                endpoint: data.endpoint,
                status_code: data.status,
                duration_ms: data.duration,
                ip_address: data.ip,
                user_agent: data.userAgent,
                metadata: data.metadata || {}
            });
        } catch (e) {
            console.error('[Analytics] Failed to track request:', e);
        }
    }

    /**
     * Get real-time usage for a key (for hard limit checks)
     * This supplements the atomic increment logic.
     */
    async getCurrentMonthUsage(apiKeyId: string): Promise<number> {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { data } = await supabase
            .from('api_usage_aggregates')
            .select('request_count')
            .eq('api_key_id', apiKeyId)
            .eq('period_start', startOfMonth.toISOString())
            .single();

        return data?.request_count || 0;
    }

    /**
     * Retrieve SLA Metrics (p50, p95, failure rate)
     */
    async getSlaMetrics() {
        // Uses the database view created in migration
        const { data, error } = await supabase
            .from('distinct_daily_metrics')
            .select('*')
            .limit(24);

        if (error) throw error;
        return data;
    }
}
