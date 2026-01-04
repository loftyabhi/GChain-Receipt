import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';
import { AuthService } from './services/AuthService';
import { AdminService } from './services/AdminService';
import { BillService } from './services/BillService';
import { addBillJob, billQueue } from './queue/BillQueue';
import './queue/BillWorker'; // Start Worker

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

import { supabase } from './lib/supabase';
import { IndexerService } from './services/IndexerService';

// Start Background Services
const indexer = new IndexerService();
// indexer.start(); // REMOVED: Serverless/Request-driven only

// Services
const authService = new AuthService();
const adminService = new AdminService();
const billService = new BillService();

// Serve generated PDFs via Supabase Redirect
app.get('/bills/:fileName', async (req: Request, res: Response) => {
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

// Services - Initialized above
// const authService = new AuthService();
// const adminService = new AdminService();

// --- Schemas ---

const billGenerateSchema = z.object({
    txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid Transaction Hash format"),
    chainId: z.number().int().positive("Chain ID must be a positive integer"),
    connectedWallet: z.string().optional()
});

// --- Routes ---

// 1. Health Check
app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// 2. Resolve Bill (Async Queue)
app.post('/api/v1/bills/resolve', async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Validation
        const validation = billGenerateSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ error: 'Invalid Input', details: validation.error.issues });
            return;
        }

        const { txHash, chainId, connectedWallet } = validation.data;

        console.log(`[API] Received request: ${txHash} -> Adding to Queue`);

        const job = await addBillJob({
            txHash,
            chainId,
            connectedWallet
        });

        res.json({
            success: true,
            jobId: job.id,
            message: 'Request queued'
        });

    } catch (error) {
        next(error);
    }
});

// 2.1 Check Job Status
app.get('/api/v1/bills/job/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const job = await billQueue.getJob(req.params.id);

        if (!job) {
            res.status(404).json({ error: 'Job not found' });
            return;
        }

        const state = await job.getState();
        const result = job.returnvalue;
        const failedReason = job.failedReason;

        res.json({
            id: job.id,
            state, // completed, failed, active, waiting
            data: result ? result.billData : null,
            pdfUrl: result ? result.pdfPath : null,
            error: failedReason
        });

    } catch (error) {
        next(error);
    }
});

// 2.2 Trigger Indexer (Public but rate-limited by nature of cost)
app.post('/api/v1/indexer/trigger', async (req: Request, res: Response) => {
    // Force call for user actions, manual triggers
    // We purposefully don't await this if we want it background? 
    // Actually, Vercel/Render might kill the process if we don't await. 
    // Best practice for "Serverless-Safe": Await it, or use a proper Queue.
    // For now, let's await it to ensure it runs at least one batch.
    // Use ?force=true to override locks if needed.
    const force = req.query?.force === 'true' || req.body?.force === true;

    // We launch it in background if it takes too long? 
    // API timeout is usually 10s-60s. Indexing 10 blocks is fast.
    try {
        await indexer.sync({ force });
        res.json({ success: true, message: 'Indexer sync cycle completed' });
    } catch (e: any) {
        res.status(500).json({ error: e.message || "Indexer failed" });
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

// 4. Oracle Debug Route - REMOVED for Production Security
// Use Admin Service or internal logs for debugging.

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



// Ads
// Public Random Ad
app.get('/api/v1/ads/random', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const placement = (req.query.placement as 'web' | 'pdf') || 'web';
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
    console.log(`⚡ Chain Receipt API running on port ${port}`);
});