import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

export class UserService {
    /**
     * Centralized "Get or Create" User logic.
     * Ensures strict wallet normalization and atomic identity handling.
     * 
     * @param walletAddress - The raw wallet address (will be normalized)
     * @returns The User ID (UUID)
     */
    async ensureUser(walletAddress: string): Promise<string> {
        if (!walletAddress) {
            throw new Error('Wallet address is required for identity creation');
        }

        const normalizedWallet = walletAddress.toLowerCase();

        try {
            // 1. Try to Insert (Idempotent via ON CONFLICT)
            // We use upsert with "ignoreDuplicates" strictly to ensure we get a handle.
            // However, Supabase JS upsert with ignoreDuplicates doesn't always return data if row exists.

            /* 
               Strategy: 
               1. Try Select.
               2. If miss, Try Insert.
               3. If Insert fails (race), Try Select again.
            */

            // Attempt 1: Fast Path (Select)
            const { data: existing } = await supabase
                .from('users')
                .select('id')
                .eq('wallet_address', normalizedWallet)
                .single();

            if (existing) {
                return existing.id;
            }

            // Attempt 2: Create
            const { data: created, error: createError } = await supabase
                .from('users')
                .insert({
                    wallet_address: normalizedWallet,
                    account_status: 'active'
                })
                .select('id')
                .single();

            if (created) {
                logger.info('New Identity Created', { wallet: normalizedWallet, id: created.id });
                return created.id;
            }

            // If error is duplicate key, somebody beat us to it.
            if (createError && createError.code === '23505') { // Unique violation
                const { data: retry } = await supabase
                    .from('users')
                    .select('id')
                    .eq('wallet_address', normalizedWallet)
                    .single();

                if (retry) return retry.id;
            }

            throw createError || new Error('Failed to ensure user identity');

        } catch (error: any) {
            logger.error('UserService.ensureUser Failure', { wallet: normalizedWallet, error: error.message });
            throw error;
        }
    }
}
