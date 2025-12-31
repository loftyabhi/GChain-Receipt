import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PriceOracleService } from './services/PriceOracleService';
import { AuthService } from './services/AuthService';
import { BillService } from './services/BillService';

dotenv.config();

const app = express();
const port = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// Serve generated PDFs statically
import path from 'path';
app.use('/bills', express.static(path.join(__dirname, '../client/public/bills')));

// Services
const priceOracle = new PriceOracleService();
const authService = new AuthService();

// Routes

// 1. Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// 2. Resolve Bill (Async Queue)
import { addBillJob, billQueue } from './queue/BillQueue';
import './queue/BillWorker'; // Start Worker

app.post('/api/v1/bills/resolve', async (req, res) => {
    try {

        const { txHash, chainId, connectedWallet } = req.body;
        if (!txHash || !chainId) {
            res.status(400).json({ error: 'Missing txHash or chainId' });
            return;
        }

        console.log(`Received request: ${txHash} -> Adding to Queue`);

        const job = await addBillJob({
            txHash,
            chainId: Number(chainId),
            connectedWallet // Pass optional connected wallet
        });

        res.json({
            success: true,
            jobId: job.id,
            message: 'Request queued'
        });

    } catch (error) {
        console.error('Queue Error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// 2.1 Check Job Status
app.get('/api/v1/bills/job/:id', async (req, res) => {
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
        res.status(500).json({ error: (error as Error).message });
    }
});

// 3. Admin Login
app.post('/api/v1/auth/login', async (req, res) => {
    try {
        const { address, signature, nonce } = req.body;
        const result = await authService.loginAdmin(address, signature, nonce);
        res.json(result);
    } catch (error) {
        res.status(401).json({ error: (error as Error).message });
    }
});

// 4. Get Price (Debug Route)
app.get('/api/v1/oracle/price', async (req, res) => {
    try {
        const { chainId, token, timestamp } = req.query;
        // @ts-ignore
        const price = await priceOracle.getPrice(Number(chainId), String(token), Number(timestamp));
        res.json(price);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// 5. Admin Routes (Protected)
import { AdminService } from './services/AdminService';
const adminService = new AdminService();

// Middleware to verify Admin JWT
const verifyAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).json({ error: 'No token provided' });
        return;
    }

    const token = authHeader.split(' ')[1];

    try {
        const payload = authService.verifyToken(token);
        // Optional: Attach user to request if needed
        // (req as any).user = payload;
        next();
    } catch (error) {
        res.status(403).json({ error: 'Invalid or expired token' });
    }
};

// Plans (Public)
app.get('/api/v1/plans', (req, res) => {
    res.json(adminService.getPlans());
});

app.post('/api/v1/admin/plans', verifyAdmin, (req, res) => {
    res.json(adminService.savePlan(req.body));
});

app.get('/api/v1/admin/plans', verifyAdmin, (req, res) => {
    res.json(adminService.getPlans());
});

app.delete('/api/v1/admin/plans/:id', verifyAdmin, (req, res) => {
    adminService.deletePlan(req.params.id);
    res.json({ success: true });
});

// Ads
// Public Random Ad
app.get('/api/v1/ads/random', (req, res) => {
    const placement = (req.query.placement as 'web' | 'pdf') || 'web';
    res.json(adminService.getRandomAd(placement));
});

app.get('/api/v1/admin/ads', (req, res) => {
    res.json(adminService.getAds());
});

app.post('/api/v1/admin/ads', verifyAdmin, (req, res) => {
    res.json(adminService.saveAd(req.body));
});

app.delete('/api/v1/admin/ads/:id', verifyAdmin, (req, res) => {
    adminService.deleteAd(req.params.id);
    res.json({ success: true });
});

app.listen(port, () => {
    console.log(`⚡ GChain Receipt API running on port ${port}`);
});
