import { NextResponse } from 'next/server';
import { createPublicClient, http, parseAbiItem, formatEther } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { createClient } from '@supabase/supabase-js';

// --- Configuration ---
export const dynamic = 'force-dynamic'; // Defaults to auto, but we want to ensure no caching for live leaderboard
export const revalidate = 0;

// Ensure these are set in your .env.local
const VAULT_ADDRESS = process.env.NEXT_PUBLIC_SUPPORT_VAULT_ADDRESS as `0x${string}`;
const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
// Fallback RPC if Alchemy not present
const RPC_URL = process.env.BASE_RPC_URL || (ALCHEMY_KEY ? `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}` : "https://sepolia.base.org");

const IS_TESTNET = true; // TODO: Drive this from env (e.g. NEXT_PUBLIC_CHAIN_ID)

// Supabase Init
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Key for privileged operations (RLS Bypass)
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// --- Types ---
type ContributorStats = {
    address: string;
    total: number;
    count: number;
    lastDate: number;
    anonymous: boolean;
};

// --- Viem Client ---
const client = createPublicClient({
    chain: IS_TESTNET ? baseSepolia : base,
    transport: http(RPC_URL)
});

const CONTRIBUTED_EVENT = parseAbiItem(
    'event Contributed(address indexed contributor, address indexed token, uint256 amount, bool isAnonymous, uint256 timestamp)'
);

async function getContributors() {
    // 1. Init Supabase
    if (!SUPABASE_URL || !SUPABASE_KEY) return [];
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    try {
        // [ENTERPRISE] NO RPC Calls. Read only from Indexed DB.

        // Fetch Sorted Data from DB
        const { data: allData, error } = await supabase
            .from('contributors')
            .select('*')
            .order('total_amount_wei', { ascending: false })
            .limit(50);

        if (error) throw error;

        // Map to frontend format
        return allData?.map((c: any) => ({
            address: c.wallet_address,
            total: parseFloat(formatEther(c.total_amount_wei)), // Wei -> Eth
            count: c.contribution_count,
            lastDate: new Date(c.last_contribution_at).getTime() / 1000,
            anonymous: c.is_anonymous
        })) || [];

    } catch (e) {
        console.error("DB Read Failed:", e);
        return [];
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'top';
        const userAddress = searchParams.get('address');

        // Fetch and Index Data (Incremental)
        const allContributors = await getContributors();

        // --- Privacy Masking & formatting ---
        const publicData = allContributors.map((c: any) => ({
            address: c.anonymous ? null : c.address,
            displayName: c.anonymous ? "Anonymous Supporter" : c.address,
            total: parseFloat(typeof c.total === 'number' ? c.total.toFixed(4) : c.total), // Safety check
            count: c.count,
            lastDate: c.lastDate,
            isAnonymous: c.anonymous
        }));

        if (type === 'top') {
            return NextResponse.json({
                contributors: publicData, // Already sliced to 50 in DB query
                lastUpdated: Date.now()
            });
        }

        if (type === 'stats') {
            const totalRaised = allContributors.reduce((acc: any, curr: any) => acc + curr.total, 0);
            return NextResponse.json({
                totalRaised: parseFloat(totalRaised.toFixed(4)),
                contributorCount: allContributors.length
            });
        }

        if (type === 'me' && userAddress) {
            const found = allContributors.find((c: any) => c.address.toLowerCase() === userAddress.toLowerCase());
            return NextResponse.json({
                you: found ? {
                    total: parseFloat(found.total.toFixed(4)),
                    rank: allContributors.indexOf(found) + 1,
                    anonymous: found.anonymous
                } : null
            });
        }

        return NextResponse.json({ error: "Invalid type" }, { status: 400 });

    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
