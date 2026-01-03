'use client';

import { Navbar } from '@/components/Navbar';
import { motion } from 'framer-motion';
import { Wallet, Shield, Zap, Globe, Heart, ArrowRight, User, Loader2 } from 'lucide-react';
import { useAccount, useWriteContract, useSwitchChain, useChainId } from 'wagmi';
import { parseEther } from 'viem';
// Removed AppKit imports
import { baseSepolia } from 'wagmi/chains';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

const FEATURES_SUPPORTED = [
    { icon: <Zap size={24} />, title: 'Free Tools', desc: 'Keeping receipt generation free for everyone Forever.' },
    { icon: <Shield size={24} />, title: 'Privacy First', desc: 'No tracking, no data selling, complete anonymity.' },
    { icon: <Globe size={24} />, title: 'Multi-Chain', desc: 'Supporting 10+ networks with high-performance RPCs.' },
    { icon: <Heart size={24} />, title: 'Open Source', desc: 'Community-driven development and transparent code.' },
];

const ROADMAP_ITEMS = [
    { status: 'Live', title: 'PDF Receipt Generation', desc: 'Instant audit-ready receipts for any transaction.' },
    { status: 'In Progress', title: 'Enterprise Dashboard', desc: 'Bulk export and team management features.' },
    { status: 'Planned', title: 'Tax Tool Integrations', desc: 'Direct sync with Quickbooks and Xero.' },
    { status: 'Planned', title: 'DAO Governance', desc: 'Community voting on future features.' },
];

export default function SupportClient() {
    const { address, isConnected } = useAccount();
    // Removed useAppKit
    const [contributionAmount, setContributionAmount] = useState('');
    const [topContributors, setTopContributors] = useState<any[]>([]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        fetch('/api/contributors?type=top')
            .then(res => res.json())
            .then(data => {
                if (data.contributors) {
                    setTopContributors(data.contributors);
                }
            })
            .catch(err => console.error('Failed to fetch contributors:', err));
    }, []);

    const [isPending, setIsPending] = useState(false);
    const { writeContractAsync } = useWriteContract();
    const { switchChainAsync } = useSwitchChain();
    const chainId = useChainId();

    // Minimal ABI for contribution
    const VAULT_ABI = [
        { inputs: [{ internalType: 'bool', name: 'isAnonymous', type: 'bool' }], name: 'contributeNative', outputs: [], stateMutability: 'payable', type: 'function' }
    ] as const;

    const VAULT_ADDRESS = process.env.NEXT_PUBLIC_SUPPORT_VAULT_ADDRESS as `0x${string}`;
    const TARGET_CHAIN_ID = baseSepolia.id;

    const handleContribute = async () => {
        if (!isConnected) {
            toast.info("Please connect your wallet in the navigation bar first.");
            return;
        }

        if (!contributionAmount || isNaN(Number(contributionAmount))) {
            toast.error("Invalid Amount", { description: "Please enter a valid ETH amount" });
            return;
        }

        if (!VAULT_ADDRESS) {
            toast.error("Configuration Error", { description: "Contract address missing" });
            return;
        }

        // Auto-switch Network
        if (chainId !== TARGET_CHAIN_ID) {
            const loadingId = toast.loading("Switching network to Base Sepolia...");
            try {
                await switchChainAsync({ chainId: TARGET_CHAIN_ID });
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
            const hash = await writeContractAsync({
                address: VAULT_ADDRESS,
                abi: VAULT_ABI,
                functionName: 'contributeNative',
                args: [false], // Anonymous flag
                value: parseEther(contributionAmount),
            });

            toast.success("Contribution Successful!", {
                id: toastId,
                description: `Tx Hash: ${hash.slice(0, 10)}...`
            });
            setContributionAmount('');
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
                                    <span className="text-sm font-bold bg-white/10 px-3 py-1.5 rounded-lg text-zinc-300">ETH</span>
                                </div>
                            </div>

                            <button
                                onClick={handleContribute}
                                disabled={isPending}
                                className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-4 font-bold text-white transition-all hover:bg-violet-500 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-violet-600/20 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isPending ? <Loader2 className="animate-spin" /> : (mounted && isConnected ? 'Confirm Contribution' : 'Connect Wallet to Support')}
                                {!isPending && <ArrowRight size={18} />}
                            </button>
                            <p className="text-center text-xs text-zinc-500">
                                Supports Native ETH on Base Sepolia.
                            </p>
                        </div>
                    </motion.div>

                    {/* C. Top Contributors */}
                    <div className="mb-24">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-bold text-white mb-3">Top Contributors</h2>
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

                    {/* E. Future Plans */}
                    <div className="max-w-4xl mx-auto">
                        <h2 className="text-3xl font-bold text-white mb-12 text-center">Roadmap</h2>
                        <div className="grid gap-4">
                            {ROADMAP_ITEMS.map((item, idx) => (
                                <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-6 p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                                    <div className="min-w-[120px]">
                                        <span className={`inline-flex items-center justify-center w-full px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide ${item.status === 'Live' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                            item.status === 'In Progress' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                                'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                                            }`}>
                                            {item.status}
                                        </span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white text-lg mb-1">{item.title}</h4>
                                        <p className="text-zinc-400">{item.desc}</p>
                                    </div>
                                </div>
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
