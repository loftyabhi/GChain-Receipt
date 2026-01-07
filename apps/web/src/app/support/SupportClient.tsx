'use client';

import { Navbar } from '@/components/Navbar';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Shield, Zap, Globe, Heart, ArrowRight, User, Loader2, ChevronDown } from 'lucide-react';
import { useAccount, useWriteContract, useSwitchChain, useChainId, useReadContract } from 'wagmi';
import { RefreshCw } from 'lucide-react'; // Import Refresh Icon
import { parseEther, parseUnits } from 'viem';
// Removed AppKit imports
import { base } from 'wagmi/chains';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

const FEATURES_SUPPORTED = [
    { icon: <Zap size={24} />, title: 'Free Tools', desc: 'Keeping receipt generation free for everyone Forever.' },
    { icon: <Shield size={24} />, title: 'Privacy First', desc: 'No tracking, no data selling, complete anonymity.' },
    { icon: <Globe size={24} />, title: 'Multi-Chain', desc: 'Supporting 10+ networks with high-performance RPCs.' },
    { icon: <Heart size={24} />, title: 'Open Source', desc: 'Community-driven development and transparent code.' },
];



// --- Types & Config ---
type Token = {
    symbol: string;
    name: string;
    address: `0x${string}`; // Use zero address for native ETH
    decimals: number;
    isNative: boolean;
};

const NATIVE_ETH_ADDRESS = '0x0000000000000000000000000000000000000000';

const INITIAL_TOKEN: Token = { symbol: 'ETH', name: 'Ethereum', address: NATIVE_ETH_ADDRESS, decimals: 18, isNative: true };

export default function SupportClient() {
    const { address, isConnected } = useAccount();

    // State
    const [contributionAmount, setContributionAmount] = useState('');
    const [selectedToken, setSelectedToken] = useState<Token>(INITIAL_TOKEN);
    const [supportedTokens, setSupportedTokens] = useState<Token[]>([INITIAL_TOKEN]); // Start with ETH
    const [isApproving, setIsApproving] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [topContributors, setTopContributors] = useState<any[]>([]);
    const [mounted, setMounted] = useState(false);

    // --- Fetch Tokens ---
    useEffect(() => {
        const fetchTokens = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
                const res = await fetch(`${apiUrl}/api/v1/tokens`);
                if (res.ok) {
                    const tokens = await res.json();
                    if (tokens && tokens.length > 0) {
                        // Ensure ETH is always first/present or merge
                        // Map API response to Component Token type
                        const mappedTokens: Token[] = tokens.map((t: any) => ({
                            symbol: t.symbol,
                            name: t.name,
                            address: t.address,
                            decimals: t.decimals,
                            isNative: t.is_native
                        }));

                        // If API has tokens, use them. ensure uniqueness if merging?
                        // For now strictly replace allowed list
                        setSupportedTokens(mappedTokens);

                        // Update selected if previously native/default and we loaded new config
                        if (selectedToken.isNative) {
                            const eth = mappedTokens.find(t => t.isNative);
                            if (eth) setSelectedToken(eth);
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to fetch tokens", err);
            }
        };
        fetchTokens();
    }, []);

    const [isRefreshing, setIsRefreshing] = useState(false);

    // --- Data Fetching with Polling ---
    const fetchContributors = async () => {
        try {
            const res = await fetch(`/api/contributors?type=top&ts=${Date.now()}`); // Bust cache
            const data = await res.json();
            if (data.contributors) {
                setTopContributors(data.contributors);
            }
        } catch (err) {
            console.error('Failed to fetch contributors:', err);
            throw err; // Propagate for manual handler
        }
    };

    const handleManualRefresh = async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        const toastId = toast.loading("Refreshing leaderboard...");
        try {
            await fetchContributors();
            toast.success("Leaderboard Refreshed", { id: toastId });
        } catch (error) {
            toast.error("Failed to refresh", { id: toastId });
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        setMounted(true);
        fetchContributors().catch(e => console.error("Initial fetch failed", e));

        // POLL: Update every 60 seconds (1 minute)
        const interval = setInterval(() => {
            fetchContributors().catch(e => console.error("Auto-refresh failed", e));
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    const [isPending, setIsPending] = useState(false);
    const { writeContractAsync } = useWriteContract();
    const { switchChainAsync } = useSwitchChain();
    const chainId = useChainId();

    // Minimal ABI for contribution
    const VAULT_ABI = [
        { inputs: [{ internalType: 'bool', name: 'isAnonymous', type: 'bool' }], name: 'contributeNative', outputs: [], stateMutability: 'payable', type: 'function' },
        { inputs: [{ internalType: 'address', name: 'token', type: 'address' }, { internalType: 'uint256', name: 'amount', type: 'uint256' }, { internalType: 'bool', name: 'isAnonymous', type: 'bool' }], name: 'contributeERC20', outputs: [], stateMutability: 'nonpayable', type: 'function' }
    ] as const;

    const ERC20_ABI = [
        { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
        { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
        { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] }
    ] as const;


    const VAULT_ADDRESS = process.env.NEXT_PUBLIC_SUPPORT_VAULT_ADDRESS as `0x${string}`;
    const TARGET_CHAIN_ID = base.id;

    // Read allowance
    const { data: allowance, refetch: refetchAllowance } = useReadContract({
        address: selectedToken.address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address as `0x${string}`, VAULT_ADDRESS],
        query: { enabled: !!address && !selectedToken.isNative && !!VAULT_ADDRESS }
    });

    // Check if approval needed
    const needsApproval = !selectedToken.isNative && contributionAmount && !isNaN(Number(contributionAmount)) &&
        (allowance === undefined || allowance < parseUnits(contributionAmount, selectedToken.decimals));

    const handleApprove = async () => {
        if (!isConnected || !VAULT_ADDRESS || selectedToken.isNative) return;
        try {
            setIsApproving(true);
            const amountToApprove = parseUnits(contributionAmount, selectedToken.decimals);
            const hash = await writeContractAsync({
                address: selectedToken.address,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [VAULT_ADDRESS, amountToApprove],
                chainId: TARGET_CHAIN_ID
            });
            toast.info(`Approving ${selectedToken.symbol}...`, { description: "Waiting for confirmation" });

            // Wait for confirmation (simplified delay for now)
            await new Promise(r => setTimeout(r, 4000));
            await refetchAllowance();
            toast.success("Approved!");
        } catch (err: any) {
            console.error("Approval failed", err);
            toast.error("Approval Failed", { description: err.message });
        } finally {
            setIsApproving(false);
        }
    };

    const handleContribute = async () => {
        if (!isConnected) {
            toast.info("Please connect your wallet in the navigation bar first.");
            return;
        }

        if (!contributionAmount || isNaN(Number(contributionAmount))) {
            toast.error("Invalid Amount", { description: `Please enter a valid ${selectedToken.symbol} amount` });
            return;
        }

        if (!VAULT_ADDRESS) {
            toast.error("Configuration Error", { description: "Contract address missing" });
            return;
        }

        // Auto-switch Network
        if (chainId !== TARGET_CHAIN_ID) {
            const loadingId = toast.loading("Switching network to Base Mainnet...");
            try {
                await switchChainAsync({ chainId: TARGET_CHAIN_ID });
                await new Promise(r => setTimeout(r, 1000)); // [FIX] Wait for wallet state to stabilize
                toast.dismiss(loadingId);
            } catch (switchError: any) {
                toast.dismiss(loadingId);
                if (switchError.message.includes("User rejected")) {
                    toast.warning("Switch Cancelled");
                } else {
                    toast.error("Network Error", { description: "Failed to switch network" });
                }
                return;
            }
        }

        const toastId = toast.loading("Confirm contribution in wallet...");

        try {
            setIsPending(true);
            let hash;

            if (selectedToken.isNative) {
                hash = await writeContractAsync({
                    address: VAULT_ADDRESS,
                    abi: VAULT_ABI,
                    functionName: 'contributeNative',
                    args: [isAnonymous],
                    value: parseEther(contributionAmount),
                    chainId: TARGET_CHAIN_ID,
                });
            } else {
                // ERC20 Contribution
                hash = await writeContractAsync({
                    address: VAULT_ADDRESS,
                    abi: VAULT_ABI,
                    functionName: 'contributeERC20',
                    args: [selectedToken.address, parseUnits(contributionAmount, selectedToken.decimals), isAnonymous],
                    chainId: TARGET_CHAIN_ID
                });
            }

            toast.success("Contribution Successful!", {
                id: toastId,
                description: `Tx Hash: ${hash.slice(0, 10)}...`
            });
            setContributionAmount('');

            // [Push-Based] Submit txHash to backend for verification
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
                const res = await fetch(`${apiUrl}/api/contributions/submit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ txHash: hash, isAnonymous })
                });

                const data = await res.json();
                console.log('[Contribution] Backend response:', data);

                if (res.ok) {
                    toast.info("Verifying...", { description: data.message });
                } else {
                    console.warn('[Contribution] Backend submission warning:', data);
                }
            } catch (err) {
                console.error("Backend submission failed", err);
                // Don't block UI, it might be retried or picked up later if we had a scanner
            }

            // [Auto-Refresh] Wait for Indexer to process (5s is enough now due to trigger) then refresh list
            setTimeout(() => {
                fetchContributors();
                toast.success("Leaderboard Updated!");
            }, 5000); // Faster feedback now
        } catch (err: any) {
            console.error('Contribution failed:', err);
            let errorMsg = err.message || "Transaction failed";

            if (errorMsg.includes("User rejected")) {
                toast.dismiss(toastId);
                toast.warning("Transaction Rejected");
            } else {
                toast.error("Transaction Failed", {
                    id: toastId,
                    description: errorMsg.length > 50 ? "Check console for details" : errorMsg
                });
            }
        } finally {
            setIsPending(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-purple-500/30 overflow-x-hidden flex flex-col">
            <Navbar />

            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/5 blur-[120px]" />
                <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/5 blur-[120px]" />
            </div>

            <main className="flex-grow relative z-10 pt-32 pb-20 px-6">
                <div className="max-w-6xl mx-auto">

                    {/* A. Hero / Intro */}
                    <div className="text-center mb-24">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-pink-300 text-xs font-bold tracking-wide uppercase mb-8 shadow-sm backdrop-blur-sm"
                        >
                            <Heart size={14} className="text-pink-400" />
                            Public Utility Infrastructure
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 leading-[1.1] mb-6 tracking-tight"
                        >
                            Support the Ecosystem
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="max-w-2xl mx-auto text-lg text-zinc-400 leading-relaxed"
                        >
                            Chain Receipt operates as a free public good, sustained by ethical advertising and community grants. Your contributions ensure the platform remains accessible to all.
                        </motion.p>
                    </div>

                    {/* B. Support Options */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="max-w-xl mx-auto bg-white/5 rounded-3xl shadow-2xl border border-white/10 p-8 md:p-12 mb-24 relative overflow-hidden backdrop-blur-xl"
                    >
                        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 rounded-full blur-[80px] -mr-16 -mt-16 pointer-events-none"></div>

                        <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3 relative z-10">
                            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400">
                                <Wallet size={24} />
                            </div>
                            Make a Contribution
                        </h2>

                        <div className="space-y-8 relative z-10">
                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-2 pl-1">Select Amount</label>
                                <div className="bg-black/30 rounded-2xl p-4 border border-white/5 flex items-center justify-between transition-colors focus-within:border-violet-500/50">
                                    <input
                                        type="number"
                                        placeholder="0.0"
                                        value={contributionAmount}
                                        onChange={(e) => setContributionAmount(e.target.value)}
                                        className="bg-transparent text-3xl font-bold text-white outline-none w-full placeholder:text-zinc-700"
                                    />
                                    {/* Scalable Token Dropdown */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl transition-all border border-white/5"
                                        >
                                            <span className="text-sm font-bold text-white">{selectedToken.symbol}</span>
                                            <ChevronDown size={14} className={`text-zinc-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                                        </button>

                                        <AnimatePresence>
                                            {isDropdownOpen && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    className="absolute top-full right-0 mt-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
                                                >
                                                    <div className="p-2 space-y-1">
                                                        {supportedTokens.map((token) => (
                                                            <button
                                                                key={token.symbol}
                                                                onClick={() => {
                                                                    setSelectedToken(token);
                                                                    setIsDropdownOpen(false);
                                                                }}
                                                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${selectedToken.symbol === token.symbol ? 'bg-violet-600/20 text-violet-300' : 'hover:bg-white/5 text-zinc-300'}`}
                                                            >
                                                                <span className="font-bold">{token.symbol}</span>
                                                                <span className="text-xs text-zinc-500">{token.name}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            </div>


                            {/* Anonymous Toggle */}
                            <div className="flex items-center gap-3 bg-black/20 p-4 rounded-xl border border-white/5 cursor-pointer hover:bg-black/30 transition-colors" onClick={() => setIsAnonymous(!isAnonymous)}>
                                <div className={`w-6 h-6 rounded-md border flex items-center justify-center transition-colors ${isAnonymous ? 'bg-violet-600 border-violet-600' : 'bg-transparent border-zinc-600'}`}>
                                    {isAnonymous && <User size={14} className="text-white" />}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-white">Contribute Anonymously</span>
                                    <span className="text-xs text-zinc-500">Anonymous means hidden from this site’s leaderboard. Blockchain transactions remain public.</span>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                {needsApproval && (
                                    <button
                                        onClick={handleApprove}
                                        disabled={isApproving}
                                        className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-4 font-bold text-white transition-all hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-600/20 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {isApproving ? <Loader2 className="animate-spin" /> : `Approve ${selectedToken.symbol}`}
                                    </button>
                                )}
                                <button
                                    onClick={handleContribute}
                                    disabled={isPending || isApproving || !!needsApproval}
                                    className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-6 py-4 font-bold text-white transition-all shadow-lg disabled:opacity-70 disabled:cursor-not-allowed ${needsApproval ? 'bg-zinc-700 text-zinc-400' : 'bg-violet-600 hover:bg-violet-500 hover:scale-[1.02] active:scale-[0.98] shadow-violet-600/20'}`}
                                >
                                    {isPending ? <Loader2 className="animate-spin" /> : (mounted && isConnected ? (needsApproval ? 'Waiting for Approval' : 'Confirm Contribution') : 'Connect Wallet to Support')}
                                    {(!isPending && !needsApproval) && <ArrowRight size={18} />}
                                </button>
                            </div>

                            <p className="text-center text-xs text-zinc-500">
                                Supports Native ETH on Base Mainnet.
                            </p>
                        </div>
                    </motion.div>

                    {/* C. Top Contributors */}
                    <div className="mb-24">
                        <div className="text-center mb-12">
                            <div className="flex items-center justify-center gap-2">
                                <h2 className="text-3xl font-bold text-white mb-3">Top Contributors</h2>
                                <button
                                    onClick={handleManualRefresh}
                                    disabled={isRefreshing}
                                    className={`p-2 rounded-full hover:bg-white/10 text-zinc-500 hover:text-white transition-all ${isRefreshing ? 'animate-spin text-white' : ''}`}
                                    title="Refresh List"
                                >
                                    <RefreshCw size={16} />
                                </button>
                            </div>
                            <p className="text-zinc-400">Hall of fame for our generous supporters.</p>
                        </div>

                        {topContributors.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {topContributors.map((c, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, y: 10 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: idx * 0.1 }}
                                        className="p-6 rounded-3xl bg-white/5 border border-white/10 relative overflow-hidden group hover:bg-white/10 hover:border-violet-500/30 transition-all duration-300"
                                    >
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-violet-500 to-blue-500 p-[1px]">
                                                <div className="h-full w-full rounded-full bg-[#0a0a0a] flex items-center justify-center">
                                                    <span className="text-xs font-bold text-white">
                                                        #{idx + 1}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="text-xs font-mono text-zinc-500 bg-white/5 px-2 py-1 rounded">
                                                {new Date(c.lastDate * 1000).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-bold text-white mb-1 truncate">
                                            {c.displayName === 'Anonymous Supporter' ? (
                                                <span className="text-zinc-500 italic">Anonymous</span>
                                            ) : (
                                                `${c.address.slice(0, 6)}...${c.address.slice(-4)}`
                                            )}
                                        </h3>
                                        <p className="text-2xl font-bold text-violet-400">
                                            {c.total} ETH
                                        </p>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-center py-20 rounded-3xl border border-white/5 bg-white/5 border-dashed"
                            >
                                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-zinc-500 mb-6">
                                    <User size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Be the first supporter</h3>
                                <p className="text-zinc-500">Your contribution will be permanently recognized here.</p>
                            </motion.div>
                        )}
                    </div>

                    {/* D. Features You Support */}
                    <div className="mb-24">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-bold text-white mb-3">Fueling Development</h2>
                            <p className="text-zinc-400">Your contributions maintain these core principles.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {FEATURES_SUPPORTED.map((feature, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: idx * 0.1 }}
                                    className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-violet-500/30 hover:bg-white/10 transition-all duration-300"
                                >
                                    <div className="mb-6 text-violet-400 bg-white/5 w-12 h-12 rounded-xl flex items-center justify-center">{feature.icon}</div>
                                    <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                                    <p className="text-sm text-zinc-400 leading-relaxed">{feature.desc}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>



                    {/* Legal Disclaimer */}
                    <div className="max-w-2xl mx-auto text-center pt-24 pb-12">
                        <p className="text-xs text-zinc-600 leading-relaxed max-w-lg mx-auto">
                            <strong>Disclaimer:</strong> Support is voluntary and non-refundable.
                            Contributions are a way to show appreciation for the free tools provided.
                            No ownership, equity, voting rights, or service entitlement is implied by your contribution.
                            The project remains free and open-source.
                        </p>
                    </div>

                </div>
            </main>
        </div>
    );
}
