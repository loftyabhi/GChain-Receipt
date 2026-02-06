import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { WebhookService } from '../../services/WebhookService';
import { ApiKeyService } from '../../services/ApiKeyService';
import { saasMiddleware, AuthenticatedRequest } from '../../middleware/saasAuth';

const router = Router();
const webhookService = new WebhookService();
const apiKeyService = new ApiKeyService();

// Protected by SaaS Auth
router.use(saasMiddleware);

// Helper to resolve API Key ID
async function resolveApiKeyId(req: AuthenticatedRequest): Promise<string> {
    if (req.auth?.id) return req.auth.id;
    if (req.user?.id) {
        const key = await apiKeyService.getActiveKeyForUser(req.user.id);
        if (key) return key.id;
    }
    throw new Error('No active API key found for user');
}

// Schema
const createWebhookSchema = z.object({
    url: z.string().url(),
    events: z.array(z.string()).min(1)
});

// GET /api/v1/webhooks
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        // If user has no keys, they can't have webhooks. Return empty list.
        const authReq = req as AuthenticatedRequest;
        if (authReq.user?.id) {
            const key = await apiKeyService.getActiveKeyForUser(authReq.user.id);
            if (!key) {
                return res.json([]);
            }
            const hooks = await webhookService.listWebhooks(key.id);
            return res.json(hooks);
        }

        const apiKeyId = await resolveApiKeyId(req as AuthenticatedRequest);
        const hooks = await webhookService.listWebhooks(apiKeyId);
        res.json(hooks);
    } catch (e: any) {
        if (e.message.includes('No active API key')) {
            // Should have been caught above, but just in case
            res.json([]);
        } else {
            next(e);
        }
    }
});

// POST /api/v1/webhooks
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const validation = createWebhookSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ error: 'Invalid Input', details: validation.error.issues });
            return;
        }

        const apiKeyId = await resolveApiKeyId(req as AuthenticatedRequest);
        const result = await webhookService.createWebhook(apiKeyId, validation.data.url, validation.data.events);

        // Returns secret ONLY here
        res.status(201).json(result);
    } catch (e: any) {
        if (e.message.includes('No active API key')) {
            res.status(400).json({ error: 'No active API key found. Please create one first.' });
        } else {
            next(e);
        }
    }
});

// DELETE /api/v1/webhooks/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const apiKeyId = await resolveApiKeyId(req as AuthenticatedRequest);
        await webhookService.deleteWebhook(req.params.id, apiKeyId);
        res.json({ success: true });
    } catch (e: any) {
        if (e.message.includes('No active API key')) {
            res.status(400).json({ error: 'No active API key found.' });
        } else {
            next(e);
        }
    }
});

export default router;
