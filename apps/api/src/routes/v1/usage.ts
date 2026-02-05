import { Router } from 'express';
import { UsageController } from '../../controllers/UsageController';

const router = Router();
const usageController = new UsageController();

/**
 * GET /v1/usage
 * Returns real API usage metrics for the authenticated API key
 */
router.get('/', (req, res) => usageController.getUsage(req, res));

/**
 * GET /v1/usage/history
 * Returns recent API request log for the authenticated API key
 */
router.get('/history', (req, res) => usageController.getHistory(req, res));

/**
 * GET /v1/usage/stats
 * Returns aggregated statistics by endpoint, status code, etc.
 */
router.get('/stats', (req, res) => usageController.getStats(req, res));

export default router;
