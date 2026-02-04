import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

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
        // 1. Crypto Verification
        let recoveredAddress: string;
        try {
            recoveredAddress = ethers.verifyMessage(nonce, signature).toLowerCase();
        } catch (e) {
            throw new Error('Invalid signature format');
        }

        if (recoveredAddress !== walletAddress.toLowerCase()) {
            throw new Error('Signature mismatch');
        }

        // 2. DB Verification (Check existence, expiry, and usage)
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

        // 3. Mark as Used (Atomic-ish due to single row update)
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

        // 2. Upsert User (Ensure ID exists)
        // We select first to get ID if exists
        let { data: user, error: fetchError } = await supabase
            .from('users')
            .select('id, wallet_address, account_status')
            .eq('wallet_address', walletAddress.toLowerCase())
            .single();

        if (!user) {
            // Create new user
            const { data: newUser, error: createError } = await supabase
                .from('users')
                .insert({ wallet_address: walletAddress.toLowerCase(), account_status: 'active' })
                .select()
                .single();

            if (createError || !newUser) {
                logger.error('Failed to create user', createError);
                throw new Error('User creation failed');
            }
            user = newUser;
        }

        if (!user) {
            throw new Error('User not found');
        }

        if (user.account_status !== 'active') {
            throw new Error(`Login failed: Account is ${user.account_status}. Please contact support.`);
        }

        // 3. Issue Token
        const csrfToken = randomBytes(32).toString('hex');
        const csrfHash = createHash('sha256').update(csrfToken).digest('hex');

        const token = jwt.sign({
            role: 'user',
            id: user.id, // UUID
            address: user.wallet_address,
            csrfHash
        }, this.jwtSecret, { expiresIn: '24h' }); // Users get longer sessions?

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
     * @param address The wallet address claiming to be admin.
     * @param signature The signature produced by the wallet.
     * @param nonce The nonce that was signed (e.g., "Login to Chain Receipt at 1234567890").
     */
    async loginAdmin(address: string, signature: string, nonce: string): Promise<AuthResponse> {
        if (!this.adminAddress) {
            throw new Error('ADMIN_ADDRESS environment variable not set');
        }

        // 1. Recover Address from Signature
        const recoveredAddress = ethers.verifyMessage(nonce, signature).toLowerCase();

        // 2. Verify Address matches Claim
        if (recoveredAddress !== address.toLowerCase()) {
            throw new Error('Signature verification failed: Address mismatch');
        }

        // 3. Verify Address is Admin
        if (recoveredAddress !== this.adminAddress) {
            throw new Error('Unauthorized: Wallet is not an admin');
        }

        // 4. Generate CSRF Token and Hash
        const csrfToken = randomBytes(32).toString('hex');
        const csrfHash = createHash('sha256').update(csrfToken).digest('hex');

        // 5. Issue Token with CSRF Hash
        const token = jwt.sign({
            role: 'admin',
            address: recoveredAddress,
            csrfHash // Bind session to this specific CSRF token
        }, this.jwtSecret, {
            expiresIn: '30m',
        });

        return {
            token,
            csrfToken,
            expiresIn: 1800, // 30 minutes
        };
    }

    /**
     * Issue a rotated session (new JWT + new CSRF) for an existing valid user
     */
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

    /**
     * Generate a random nonce message for the user to sign.
     * (Deprecated for Users, used for Admin simple flow?)
     * Admin flow doesn't check DB nonces currently. We keep this for Admin legacy.
     */
    generateNonce(): string {
        return `Sign this message to login to TxProof Manager.\nNonce: ${Date.now()}-${Math.random().toString(36).substring(7)}`;
    }

    /**
     * Verify a JWT token.
     * @param token The JWT token string.
     * @returns The decoded payload if valid, throws error otherwise.
     */
    verifyToken(token: string): any {
        try {
            return jwt.verify(token, this.jwtSecret);
        } catch (error) {
            throw new Error('Invalid or expired token');
        }
    }
}
