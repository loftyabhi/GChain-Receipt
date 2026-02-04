import { Router, Request, Response } from 'express';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';

const router = Router();

/**
 * GET /v1/usage
 * Returns real API usage metrics for the authenticated API key
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        // Extract API key ID from auth middleware
        const apiKeyId = (req as any).apiKeyId;

        if (!apiKeyId) {
            return res.status(401).json({ error: 'API key required' });
        }

        // Get API key details with quota
        const { data: apiKey, error: keyError } = await supabase
            .from('api_keys')
            .select('name, quota_limit, plan_tier')
            .eq('id', apiKeyId)
            .single();

        if (keyError || !apiKey) {
            return res.status(404).json({ error: 'API key not found' });
        }

        // Get time range (default: current month)
        const startDate = req.query.start_date as string || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        const endDate = req.query.end_date as string || new Date().toISOString();

        // Count total API requests in date range
        const { count, error: countError } = await supabase
            .from('usage_events')
            .select('*', { count: 'exact', head: true })
            .eq('api_key_id', apiKeyId)
            .gte('created_at', startDate)
            .lte('created_at', endDate);

        if (countError) {
            logger.error('Failed to fetch usage count', { apiKeyId, error: countError.message });
            return res.status(500).json({ error: 'Failed to fetch usage metrics' });
        }

        const totalRequests = count || 0;
        const quotaLimit = apiKey.quota_limit || 50000;

        // Return real plan and usage data
        const plan = {
            name: apiKey.plan_tier || 'Professional',
            limit: quotaLimit,
            rateLimitRps: quotaLimit >= 100000 ? 100 : 50
        };

        const usage = {
            total: totalRequests,
            remaining: Math.max(0, quotaLimit - totalRequests),
            period: {
                start: startDate,
                end: endDate
            }
        };

        logger.info('Usage metrics retrieved', { apiKeyId, requests: totalRequests });

        res.json({ plan, usage });
    } catch (error: any) {
        logger.error('Usage endpoint error', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch usage' });
    }
});

/**
 * GET /v1/usage/history
 * Returns recent API request log for the authenticated API key
 */
router.get('/history', async (req: Request, res: Response) => {
    try {
        const apiKeyId = (req as any).apiKeyId;

        if (!apiKeyId) {
            return res.status(401).json({ error: 'API key required' });
        }

        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;

        // Fetch real API logs from database
        const { data: logs, error } = await supabase
            .from('usage_events')
            .select('endpoint, method, status_code, duration_ms, created_at, error_message')
            .eq('api_key_id', apiKeyId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            logger.error('Failed to fetch API history', { apiKeyId, error: error.message });
            return res.status(500).json({ error: 'Failed to fetch request history' });
        }

        // Transform to response format
        const formattedLogs = (logs || []).map(log => ({
            status: log.status_code,
            method: log.method,
            endpoint: log.endpoint,
            duration_ms: log.duration_ms || 0,
            created_at: log.created_at,
            error: log.error_message || undefined
        }));

        logger.info('API history retrieved', { apiKeyId, count: formattedLogs.length });

        res.json(formattedLogs);
    } catch (error: any) {
        logger.error('History endpoint error', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

/**
 * GET /v1/usage/stats
 * Returns aggregated statistics by endpoint, status code, etc.
 */
router.get('/stats', async (req: Request, res: Response) => {
    try {
        const apiKeyId = (req as any).apiKeyId;

        if (!apiKeyId) {
            return res.status(401).json({ error: 'API key required' });
        }

        const startDate = req.query.start_date as string || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const endDate = req.query.end_date as string || new Date().toISOString();

        // Aggregate by endpoint
        const { data: endpointStats } = await supabase
            .rpc('aggregate_usage_by_endpoint', {
                p_api_key_id: apiKeyId,
                p_start_date: startDate,
                p_end_date: endDate
            })
            .limit(10);

        // Aggregate by status code
        const { data: statusStats } = await supabase
            .rpc('aggregate_usage_by_status', {
                p_api_key_id: apiKeyId,
                p_start_date: startDate,
                p_end_date: endDate
            });

        res.json({
            by_endpoint: endpointStats || [],
            by_status: statusStats || [],
            period: { start: startDate, end: endDate }
        });
    } catch (error: any) {
        logger.error('Stats endpoint error', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

export default router;
