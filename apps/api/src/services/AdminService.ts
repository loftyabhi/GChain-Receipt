import { supabase } from '../lib/supabase';

// --- PLANS ---
// Removed as part of cleanup


export interface Ad {
    id: string; // DB ID is number
    name?: string; // Descriptive Name
    contentHtml: string;
    isActive: boolean;
    clickUrl?: string; // Schema: click_url
    placement?: 'web' | 'pdf' | 'both'; // Schema: placement (added via migration)
}

export class AdminService {
    constructor() { }

    // --- ADS ---

    async getAds(): Promise<Ad[]> {
        const { data, error } = await supabase
            .from('ad_profiles')
            .select('*')
            .eq('is_deleted', false)
            .order('id', { ascending: true });

        if (error) {
            console.error('[AdminService] getAds error:', error);
            return [];
        }

        return data.map((row: any) => ({
            id: row.id.toString(),
            name: row.name,
            contentHtml: row.html_content,
            isActive: row.is_active,
            clickUrl: row.click_url,
            placement: row.placement || 'both'
        }));
    }

    async getRandomAd(placement: 'web' | 'pdf' = 'web'): Promise<Ad | null> {
        // Logic: active = true, is_deleted = false, placement IN ('both', placement)
        // Since we can't do complex random efficiently in Supabase-js without RPC, 
        // we'll fetch active ones and pick random in memory (assuming low count of ads).
        const { data, error } = await supabase
            .from('ad_profiles')
            .select('*')
            .eq('is_active', true)
            .eq('is_deleted', false);

        if (error || !data || data.length === 0) return null;

        // Filter by placement
        const validAds = data.filter((row: any) => {
            const rowPlacement = row.placement || 'both';
            return rowPlacement === 'both' || rowPlacement === placement;
        });

        if (validAds.length === 0) return null;

        const randomRow = validAds[Math.floor(Math.random() * validAds.length)];

        return {
            id: randomRow.id.toString(),
            name: randomRow.name,
            contentHtml: randomRow.html_content,
            isActive: randomRow.is_active,
            clickUrl: randomRow.click_url,
            placement: randomRow.placement || 'both'
        };
    }

    async saveAd(ad: Ad): Promise<Ad> {
        const MAX_INT = 2147483647;
        const inputId = Number(ad.id);
        const isUpdate = ad.id && !isNaN(inputId) && inputId <= MAX_INT;

        const payload: any = {
            name: ad.name || null,
            html_content: ad.contentHtml,
            click_url: ad.clickUrl || '',
            is_active: ad.isActive,
            placement: ad.placement || 'both'
        };

        let result;

        if (isUpdate) {
            // UPDATE / UPSERT (Explicit ID)
            payload.id = inputId;
            // We use upsert to ensure it creates if missing (though unlikely with ID)
            // or updates if existing.
            result = await supabase
                .from('ad_profiles')
                .upsert(payload)
                .select()
                .single();
        } else {
            // CREATE (New Ad, Ignore Timestamp ID)
            // We explicitly use INSERT to let the DB handle auto-increment
            result = await supabase
                .from('ad_profiles')
                .insert(payload)
                .select()
                .single();
        }

        const { data, error } = result;

        if (error) {
            console.error('[AdminService] saveAd error:', error);
            throw error;
        }

        return {
            id: data.id.toString(),
            name: data.name,
            contentHtml: data.html_content,
            isActive: data.is_active,
            clickUrl: data.click_url,
            placement: data.placement || 'both'
        };
    }

    async deleteAd(id: string): Promise<void> {
        if (!id || isNaN(Number(id))) return;
        // Soft delete
        await supabase
            .from('ad_profiles')
            .update({ is_deleted: true, deleted_at: new Date().toISOString() })
            .eq('id', Number(id));
    }
}
