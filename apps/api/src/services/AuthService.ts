import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { UserService } from './UserService';

interface AuthResponse {
    token: string;
    csrfToken: string;
    expiresIn: number;
    user?: {
        id: string;
        wallet: string;
        plan_id?: string;
    };
}

export class AuthService {
    private readonly jwtSecret: string;
    private readonly adminAddress = process.env.ADMIN_ADDRESS?.toLowerCase();

    constructor() {
        if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
            throw new Error('CRITICAL SECURITY: JWT_SECRET must be set in production environment.');
        }
        this.jwtSecret = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';
    }

    /**
     * DB-Backed Nonce Generation (Replay Protection)
     * 1. Generate random nonce.
     * 2. Store in DB with 5 min expiry.
     */
    async generateAndStoreNonce(walletAddress: string): Promise<string> {
        const nonceStr = `Sign to login to TxProof.\nNonce: ${randomBytes(16).toString('hex')}`;
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 mins

        const { error } = await supabase.from('auth_nonces').insert({
            wallet_address: walletAddress.toLowerCase(),
            nonce: nonceStr,
            expires_at: expiresAt
        });

        if (error) {
            logger.error('Failed to store nonce', { error: error.message, wallet: walletAddress });
            throw new Error('Failed to generate secure nonce');
        }

        return nonceStr;
    }

    /**
     * Verify signature AND consume nonce (One-Time Use)
     */
    async verifyAndConsumeNonce(walletAddress: string, signature: string, nonce: string): Promise<boolean> {
        // 1. Verify Signature
        let recoveredAddress: string;
        try {
            recoveredAddress = ethers.verifyMessage(nonce, signature).toLowerCase();
        } catch (e) {
            throw new Error('Invalid signature format');
        }

        if (recoveredAddress !== walletAddress.toLowerCase()) {
            throw new Error('Signature mismatch');
        }

        // 2. DB Verification
        const { data: nonceRecord, error } = await supabase
            .from('auth_nonces')
            .select('*')
            .eq('nonce', nonce)
            .eq('wallet_address', recoveredAddress)
            .single();

        if (error || !nonceRecord) {
            throw new Error('Invalid or non-existent nonce');
        }

        if (nonceRecord.used_at) {
            throw new Error('Replay detected: Nonce already used');
        }

        if (new Date(nonceRecord.expires_at) < new Date()) {
            throw new Error('Nonce expired');
        }

        // 3. Mark as Used
        const { error: updateError } = await supabase
            .from('auth_nonces')
            .update({ used_at: new Date().toISOString() })
            .eq('id', nonceRecord.id);

        if (updateError) {
            throw new Error('Failed to consume nonce');
        }

        return true;
    }

    /**
     * Login Standard User
     * 1. Verify Nonce.
     * 2. Get/Create User in DB.
     * 3. Issue Token.
     */
    async loginUser(walletAddress: string, signature: string, nonce: string): Promise<AuthResponse> {
        // 1. Verify
        await this.verifyAndConsumeNonce(walletAddress, signature, nonce);

        // 2. Identity Resolution (Centralized)
        const userService = new UserService();
        const userId = await userService.ensureUser(walletAddress);

        // 3. Status Check
        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('id, wallet_address, account_status')
            .eq('id', userId)
            .single();

        if (fetchError || !user) {
            throw new Error('User retrieval failed after creation');
        }

        if (user.account_status !== 'active') {
            throw new Error(`Login failed: Account is ${user.account_status}. Please contact support.`);
        }

        // 4. Issue Token
        const csrfToken = randomBytes(32).toString('hex');
        const csrfHash = createHash('sha256').update(csrfToken).digest('hex');

        const token = jwt.sign({
            role: 'user',
            id: user.id, // UUID
            address: user.wallet_address,
            csrfHash
        }, this.jwtSecret, { expiresIn: '24h' });

        return {
            token,
            csrfToken,
            expiresIn: 86400,
            user: {
                id: user.id,
                wallet: user.wallet_address
            }
        };
    }

    /**
     * Verify a wallet signature and issue a JWT if the signer is an admin.
     */
    async loginAdmin(address: string, signature: string, nonce: string): Promise<AuthResponse> {
        if (!this.adminAddress) {
            throw new Error('ADMIN_ADDRESS environment variable not set');
        }

        const recoveredAddress = ethers.verifyMessage(nonce, signature).toLowerCase();

        if (recoveredAddress !== address.toLowerCase()) {
            throw new Error('Signature verification failed: Address mismatch');
        }

        if (recoveredAddress !== this.adminAddress) {
            throw new Error('Unauthorized: Wallet is not an admin');
        }

        const csrfToken = randomBytes(32).toString('hex');
        const csrfHash = createHash('sha256').update(csrfToken).digest('hex');

        const token = jwt.sign({
            role: 'admin',
            address: recoveredAddress,
            csrfHash
        }, this.jwtSecret, {
            expiresIn: '30m',
        });

        return {
            token,
            csrfToken,
            expiresIn: 1800,
        };
    }

    rotateSession(currentPayload: any): AuthResponse {
        const csrfToken = randomBytes(32).toString('hex');
        const csrfHash = createHash('sha256').update(csrfToken).digest('hex');

        const token = jwt.sign({
            role: currentPayload.role || 'admin',
            id: currentPayload.id, // Preserve ID if exists
            address: currentPayload.address,
            csrfHash
        }, this.jwtSecret, { expiresIn: '30m' });

        return { token, csrfToken, expiresIn: 1800 };
    }

    generateNonce(): string {
        return `Sign this message to login to TxProof Manager.\nNonce: ${Date.now()}-${Math.random().toString(36).substring(7)}`;
    }

    verifyToken(token: string): any {
        try {
            return jwt.verify(token, this.jwtSecret);
        } catch (error) {
            throw new Error('Invalid or expired token');
        }
    }
}
