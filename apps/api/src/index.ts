import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';
import { AuthService } from './services/AuthService';
import { AdminService } from './services/AdminService';
import { BillService } from './services/BillService';
import { SoftQueueService } from './services/SoftQueueService';

// Security Middleware
import { hybridAuth } from './middleware/hybridAuth';
import { publicRateLimiter } from './middleware/publicRateLimiter';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

const allowedOrigins = [
    'https://txproof.xyz',
    'https://www.txproof.xyz',
    'https://api.txproof.xyz', // Playground
    'http://localhost:3000',
    'http://localhost:3001'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// Host Header Guard to protect backend.txproof.xyz
// Goal: Allow 'txproof.xyz' frontend to use it, but block other browsers/public users.
app.use((req: Request, res: Response, next: NextFunction) => {
    const host = req.get('host');

    // Strict rules for the Private Backend Domain
    if (host === 'backend.txproof.xyz') {
        const origin = req.get('origin');

        // If request comes from a browser (has Origin)
        if (origin) {
            // ONLY Allow the official frontend
            const isAllowedFrontend = origin === 'https://txproof.xyz' || origin === 'https://www.txproof.xyz';

            if (!isAllowedFrontend) {
                // Block random sites / users trying to hit backend directly
                res.status(403).json({ error: 'Direct browser access forbidden. Use https://txproof.xyz' });
                return;
            }
            // If it IS the allowed frontend, pass through.
        }
        // If No Origin (Server-to-Server / Curl / Mobile App), pass through (assumes API Key/Auth layers handle security)
    }
    next();
});
app.use(express.json());

import { supabase } from './lib/supabase';
import contributionsRouter from './routes/contributions';
import tokensRouter from './routes/tokens';
import pdfsRouter from './routes/v1/pdfs';
import adminRouter from './routes/v1/adminRouter';

// Services
const authService = new AuthService();
const adminService = new AdminService();
const billService = new BillService();
const softQueueService = new SoftQueueService();

// Register Routes
app.use('/api/contributions', contributionsRouter);
app.use('/api/v1/tokens', tokensRouter);

// SaaS Platform Routes
app.use('/api/v1/pdfs', pdfsRouter);
// Note: Admin router mounted below after verifyAdmin definition


// Serve generated PDFs via Supabase Redirect - Rate Limited (can trigger regeneration)
app.get('/bills/:fileName', publicRateLimiter, async (req: Request, res: Response) => {
    const { fileName } = req.params;
    try {
        // 1. Check if file exists in Storage
        const { data: files } = await supabase.storage.from('receipts').list('', {
            search: fileName,
            limit: 1
        });

        // 2. If missing, attempt regeneration (Self-Healing)
        if (!files || files.length === 0) {
            console.log(`[API] File ${fileName} missing. Triggering self-healing...`);
            try {
                await billService.regenerateFromId(fileName);
                console.log(`[API] Self-healing successful for ${fileName}`);
            } catch (regenError: any) {
                console.error(`[API] Self-healing failed: ${regenError.message}`);
                // If regeneration fails (e.g. invalid ID or tx not found), return 404
                return res.status(404).send('Receipt not found and could not be regenerated.');
            }
        }

        // 3. Serve URL (Guaranteed to exist now)
        const { data } = supabase.storage.from('receipts').getPublicUrl(fileName);
        if (data?.publicUrl) {
            res.redirect(307, data.publicUrl);
        } else {
            res.status(404).send('Receipt not found');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Error resolving receipt URL');
    }
});

// New Endpoint: Get Bill JSON Data (For Client-Side Rendering) - Rate Limited
app.get('/api/v1/bills/:billId/data', publicRateLimiter, async (req: Request, res: Response) => {
    const { billId } = req.params;
    const jsonKey = billId.endsWith('.json') ? billId : `${billId}.json`;
    const cleanId = billId.replace('.json', '');

    try {
        // 1. Storage Check
        const { data, error } = await supabase.storage
            .from('receipts')
            .download(jsonKey);

        if (data) {
            const text = await data.text();
            res.json(JSON.parse(text));
            return;
        }

        console.log(`[API] Storage miss for ${jsonKey}. Starting DB Fallback...`);

        // 2. DB Fallback
        const parts = cleanId.split('-');
        // Expect: BILL-{chainId}-{blockNumber}-{shortHash}
        // Example: BILL-8453-123456-0xb65f
        // Allow case-insensitive prefix check
        if (parts.length >= 4 && parts[0].toUpperCase() === 'BILL') {
            const chainId = parseInt(parts[1]);
            const shortHash = parts[3];

            if (!isNaN(chainId) && shortHash) {
                // Query DB
                const { data: dbBill, error: dbError } = await supabase
                    .from('bills')
                    .select('bill_json')
                    .eq('chain_id', chainId)
                    .ilike('tx_hash', `${shortHash}%`)
                    .limit(1)
                    .maybeSingle();

                if (dbBill && dbBill.bill_json) {
                    console.log(`[API] DB Fallback Hit! Serving JSON.`);
                    res.json(dbBill.bill_json);

                    // 3. Cache Repair
                    (async () => {
                        try {
                            const jsonBuffer = Buffer.from(JSON.stringify(dbBill.bill_json));
                            await supabase.storage
                                .from('receipts')
                                .upload(jsonKey, jsonBuffer, {
                                    contentType: 'application/json',
                                    upsert: true
                                });
                            console.log(`[API] Cache repaired.`);
                        } catch (e: any) {
                            console.warn(`[API] Cache repair failed: ${e.message}`);
                        }
                    })();
                    return;
                }
            }
        }

        // 3. Regen Fallback
        console.log(`[API] Falling back to Regen...`);
        try {
            await billService.regenerateFromId(cleanId);
            const { data: retryData } = await supabase.storage.from('receipts').download(jsonKey);
            if (retryData) {
                console.log(`[API] Regen success.`);
                const text = await retryData.text();
                res.json(JSON.parse(text));
                return;
            }
        } catch (regenError: any) {
            console.error(`[API] Regen failed: ${regenError.message}`);
        }

        res.status(404).json({ error: 'Bill data not found' });

    } catch (error: any) {
        console.error('[API] Error fetching bill data:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// --- Schemas ---

const billGenerateSchema = z.object({
    txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid Transaction Hash format"),
    chainId: z.number().int().positive("Chain ID must be a positive integer"),
    connectedWallet: z.string().optional()
});

// --- Routes ---

// 1. Health Check
app.get('/health', (req: Request, res: Response) => {
    // Basic health check
    res.json({ status: 'ok', timestamp: Date.now() });
});

// 2. Resolve Bill (Soft Queue) - SECURED with Hybrid Auth
app.post('/api/v1/bills/resolve', hybridAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Validation
        const validation = billGenerateSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ error: 'Invalid Input', details: validation.error.issues });
            return;
        }

        const { txHash, chainId, connectedWallet } = validation.data;

        console.log(`[API] Enqueueing request: ${txHash}`);

        // Enqueue (Idempotent)
        const job = await softQueueService.enqueue(txHash, chainId, { connectedWallet });

        // Trigger Processing (Redundant but explicit as per plan)
        // enqueue() calls it internally, but we ensure it runs.
        setImmediate(() => softQueueService.processNext().catch(e => console.error(e)));

        res.json({
            success: true,
            jobId: job.jobId,
            status: job.status,
            message: 'Request queued'
        });

    } catch (error) {
        next(error);
    }
});

// 2.1 Check Job Status (Soft Queue) - SECURED with Hybrid Auth
app.get('/api/v1/bills/job/:id', hybridAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const status = await softQueueService.getJobStatus(req.params.id);

        if (!status) {
            res.status(404).json({ error: 'Job not found' });
            return;
        }

        // Critical: Every poll attempts to advance the queue (Crash Recovery / Wake-up)
        // This ensures if server restarted, polling clients restart the worker loop.
        if (status.state === 'pending' || status.state === 'processing') {
            setImmediate(() => softQueueService.processNext().catch(e => console.error('[SoftQueue] Poll-Trigger Error:', e)));
        }

        // Strict Polling Enforcement: Advise client to wait 2 seconds before next poll
        res.set('Retry-After', '2');

        res.json({
            id: status.id,
            state: status.state,
            data: status.result?.billData || null,
            pdfUrl: status.result?.pdfPath || null,
            error: status.error,
            queuePosition: status.queuePosition,
            estimatedWaitMs: status.estimatedWaitMs
        });

    } catch (error) {
        next(error);
    }
});

// 3. Admin Login
app.post('/api/v1/auth/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { address, signature, nonce } = req.body;
        const result = await authService.loginAdmin(address, signature, nonce);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// 5. Admin Routes (Protected)

// Middleware to verify Admin JWT
const verifyAdmin = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).json({ error: 'No token provided' });
        return;
    }

    const token = authHeader.split(' ')[1];

    try {
        authService.verifyToken(token);
        next();
    } catch (error) {
        res.status(403).json({ error: 'Invalid or expired token' });
    }
};

// SaaS Admin Dashboard
app.use('/api/v1/admin', verifyAdmin, adminRouter);


// Ads
// Public Random Ad - Rate Limited
app.get('/api/v1/ads/random', publicRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const placement = (req.query.placement as 'web' | 'pdf') || 'web';
        // Prevent caching to ensure random distribution (Equal Proportion)
        res.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.json(await adminService.getRandomAd(placement));
    } catch (e) { next(e); }
});

app.get('/api/v1/admin/ads', verifyAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.json(await adminService.getAds());
    } catch (e) { next(e); }
});

app.post('/api/v1/admin/ads', verifyAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.json(await adminService.saveAd(req.body));
    } catch (e) { next(e); }
});

app.delete('/api/v1/admin/ads/:id', verifyAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
        await adminService.deleteAd(req.params.id);
        res.json({ success: true });
    } catch (e) { next(e); }
});

// --- Centralized Error Handler ---

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('[API ERROR]', err);

    // Distinguish between operational errors and programming errors if possible
    // For now, straightforward mapping:
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';

    res.status(status).json({
        error: message,
        // In production, might want to hide stack trace
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

app.listen(port, () => {
    console.log(`⚡ TxProof API running on port ${port} (SafeQueue Mode)`);
});