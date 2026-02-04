'use client';

import { ArrowRight, Search, Loader2, Shield, CheckCircle, FileText, Lock, X } from 'lucide-react'; // Added Lock, X for modal
import { useState } from 'react';
import { useAccount, useConnect } from 'wagmi'; // Added useConnect
import { useRouter } from 'next/navigation'; // Added useRouter
import { motion, AnimatePresence } from 'framer-motion'; // Added AnimatePresence for modal
import AdBanner from '../AdBanner';
import { toast } from 'sonner';
import { trackTxLookup, trackEvent } from '@/lib/analytics';

export function BillGenerator() {
    const { address, isConnected } = useAccount();
    const { connect, connectors } = useConnect();
    const router = useRouter();
    const [txHash, setTxHash] = useState('');
    const [loading, setLoading] = useState(false);
    const [billData, setBillData] = useState<any>(null);
    const [pdfUrl, setPdfUrl] = useState('');
    const [chainId, setChainId] = useState(8453);
    const [showLoginModal, setShowLoginModal] = useState(false);

    const generateBill = async (e: React.FormEvent) => {
        e.preventDefault();

        // Security Gate: Check authentication
        if (!isConnected || !address) {
            setShowLoginModal(true);
            return;
        }

        // Authenticated users: redirect to dashboard
        toast.info("Redirecting to Dashboard for secure generation...");
        router.push('/dashboard');
        return;

        // NOTE: The code below is kept for reference but won't execute due to redirect above
        // This ensures homepage NEVER makes PDF API calls
        /*
        if (!txHash) {
            toast.error("Please enter a transaction hash");
            return;
        }

        // Sanitize input: remove all whitespace/newlines
        const cleanTxHash = txHash.trim().replace(/\s/g, '');

        setLoading(true);
        setBillData(null);
        setPdfUrl('');

        const toastId = toast.loading("Initializing secure documentation compilation...");
        trackTxLookup(chainId.toString(), 'started');

        try {
            // 1. Initiate Job
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/bills/resolve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    txHash: cleanTxHash,
                    chainId,
                    connectedWallet: address // Pass connected wallet to determine IN/OUT direction
                })
            });

            const data = await response.json();

            // Handle rate limiting (429)
            if (response.status === 429) {
                const retryAfter = data.retryAfterMs ? Math.ceil(data.retryAfterMs / 1000) : 30;
                throw new Error(`Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`);
            }

            if (!response.ok) {
                throw new Error(data.error || 'Failed to start generation');
            }

            const jobId = data.jobId;
            toast.loading("Queued for processing...", { id: toastId });

            // 2. Poll for Completion
            const pollInterval = setInterval(async () => {
                try {
                    const jobRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/bills/job/${jobId}`);
                    const jobData = await jobRes.json();

                    // Handle rate limiting during polling (429) - show warning but continue
                    if (jobRes.status === 429) {
                        const retryAfter = jobData.retryAfterMs ? Math.ceil(jobData.retryAfterMs / 1000) : 5;
                        toast.loading(`Rate limited, retrying in ${retryAfter}s...`, { id: toastId });
                        return; // Skip this poll cycle, will retry on next interval
                    }

                    if (!jobRes.ok) {
                        // If job not found or server error, stop polling
                        clearInterval(pollInterval);
                        setLoading(false);
                        toast.error(jobData.error || 'Job not found', { id: toastId });
                        return;
                    }

                    if (jobData.state === 'pending') {
                        const pos = jobData.queuePosition || 1;
                        const waitSec = Math.ceil((jobData.estimatedWaitMs || 0) / 1000);
                        const waitMsg = waitSec > 0 ? `~${waitSec}s` : 'soon';
                        toast.loading(`Queue Position: #${pos} (Est. Wait: ${waitMsg})`, { id: toastId });
                    } else if (jobData.state === 'processing') {
                        toast.loading("Processing transaction data...", { id: toastId });
                    } else if (jobData.state === 'completed') {
                        clearInterval(pollInterval);
                        setPdfUrl(jobData.pdfUrl); // Already includes /print/bill/...
                        setBillData(jobData.data);
                        setLoading(false);
                        trackTxLookup(chainId.toString(), 'success');
                        toast.success("Documentation compiled successfully.", { id: toastId });
                    } else if (jobData.state === 'failed') {
                        clearInterval(pollInterval);
                        setLoading(false);
                        trackTxLookup(chainId.toString(), 'failed', jobData.error);
                        toast.error(jobData.error || 'Generation Interrupted', { id: toastId });
                    }
                    // else: active/processing, keep polling
                } catch (pollErr) {
                    clearInterval(pollInterval);
                    setLoading(false);
                    toast.error('Polling failed relative to server connection', { id: toastId });
                }
            }, 2000); // Check every 2s

        } catch (err: any) {
            setLoading(false);
            trackTxLookup(chainId.toString(), 'failed', err.message);
            toast.error(err.message, { id: toastId });
        }
        */
    }

    const handleChainChange = (newChainId: number) => {
        setChainId(newChainId);
        trackEvent('chain_selected', { chain: newChainId.toString() });
    };

    const handleLogin = () => {
        // Use the same priority connection strategy as Navbar
        const preferred = connectors.find(c => c.name === 'MetaMask') || connectors.find(c => c.id === 'injected') || connectors[0];
        if (preferred) {
            connect({ connector: preferred });
            setShowLoginModal(false);
            toast.success("Wallet connected! Redirecting to Dashboard...");
            setTimeout(() => router.push('/dashboard'), 1000);
        } else {
            toast.error('No suitable wallet connector found');
        }
    };

    return (
        <>
            {/* Login Modal */}
            <AnimatePresence>
                {showLoginModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                        onClick={() => setShowLoginModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative max-w-md w-full bg-[#0F0F11] rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
                        >
                            {/* Close Button */}
                            <button
                                onClick={() => setShowLoginModal(false)}
                                className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors z-10"
                                aria-label="Close modal"
                            >
                                <X size={24} />
                            </button>

                            {/* Background Gradient */}
                            <div className="absolute top-0 right-0 w-48 h-48 bg-violet-600/20 rounded-full blur-[80px] -mr-16 -mt-16 pointer-events-none"></div>

                            <div className="relative p-8">
                                {/* Icon */}
                                <div className="flex justify-center mb-6">
                                    <div className="h-16 w-16 rounded-full bg-violet-600/10 border border-violet-500/20 flex items-center justify-center">
                                        <Lock className="text-violet-400" size={32} />
                                    </div>
                                </div>

                                {/* Title */}
                                <h2 className="text-2xl font-bold text-white text-center mb-3">
                                    Secure Sign In Required
                                </h2>

                                {/* Subtitle */}
                                <p className="text-zinc-400 text-center mb-6">
                                    Connect your wallet to generate professional blockchain receipts
                                </p>

                                {/* Security Message */}
                                <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-4 mb-6">
                                    <div className="flex items-start gap-3">
                                        <Shield className="text-violet-400 mt-0.5 flex-shrink-0" size={20} />
                                        <div className="text-sm text-zinc-300">
                                            <p className="font-medium text-white mb-1">Safe & Secure</p>
                                            <p className="text-zinc-400">
                                                🔒 You don't need to sign or approve any transaction.
                                                This login only verifies your wallet to securely generate receipts and manage usage.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="space-y-3">
                                    <button
                                        onClick={handleLogin}
                                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-4 font-semibold text-white transition-all hover:bg-violet-500 hover:shadow-lg hover:shadow-violet-600/20 active:scale-95"
                                    >
                                        <Lock size={20} />
                                        Connect Wallet
                                    </button>
                                    <button
                                        onClick={() => setShowLoginModal(false)}
                                        className="w-full rounded-xl bg-white/5 border border-white/10 px-6 py-3 font-medium text-zinc-300 transition-all hover:bg-white/10"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Input Card */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="w-full max-w-2xl mx-auto"
            >
                <form onSubmit={generateBill} className="group relative flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 shadow-2xl shadow-violet-900/10 backdrop-blur-xl transition-all focus-within:ring-2 focus-within:ring-violet-500/20 focus-within:border-violet-500/50">

                    {/* Chain Selector */}
                    <div className="pl-4 pr-2 border-r border-white/10 hidden md:block">
                        <label htmlFor="chain-select-desktop" className="sr-only">Select Chain</label>
                        <select
                            id="chain-select-desktop"
                            value={chainId}
                            onChange={(e) => handleChainChange(Number(e.target.value))}
                            className="bg-transparent text-white outline-none border-none font-medium cursor-pointer appearance-none text-sm uppercase tracking-wide [&>option]:bg-zinc-900"
                        >
                            <option value={8453}>Base</option>
                            <option value={1}>Ethereum</option>
                            <option value={137}>Polygon</option>
                            <option value={42161}>Arbitrum</option>
                            <option value={10}>Optimism</option>
                            <option value={56}>BSC</option>
                            <option value={43114}>Avax</option>
                            <option value={11155111}>Sepolia</option>
                        </select>
                    </div>

                    <div className="pl-2 text-zinc-500">
                        <Search size={20} />
                    </div>
                    <label htmlFor="tx-hash-input" className="sr-only">Transaction Hash</label>
                    <input
                        id="tx-hash-input"
                        type="text"
                        placeholder="Enter Transaction Hash for Verification (0x...)"
                        className="flex-1 bg-transparent px-2 py-4 text-base md:text-lg outline-none placeholder:text-zinc-600 text-white w-full min-w-0"
                        value={txHash}
                        onChange={(e) => setTxHash(e.target.value)}
                        disabled={loading}
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        aria-label={loading ? 'Processing transaction' : 'Generate Bill'}
                        className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white transition-all active:scale-95 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-600/20 whitespace-nowrap"
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : <ArrowRight size={20} />}
                        <span className="hidden md:inline">{loading ? 'Processing' : 'Generate'}</span>
                    </button>
                </form>

                {/* Mobile Chain Selector Fallback */}
                <div className="mt-4 md:hidden flex justify-center">
                    <label htmlFor="chain-select-mobile" className="sr-only">Select Chain</label>
                    <select
                        id="chain-select-mobile"
                        value={chainId}
                        onChange={(e) => handleChainChange(Number(e.target.value))}
                        className="bg-white/5 text-white outline-none border border-white/10 rounded-lg px-4 py-2 font-medium cursor-pointer text-sm uppercase tracking-wide [&>option]:bg-zinc-900"
                    >
                        <option value={8453}>Base</option>
                        <option value={1}>Ethereum</option>
                        <option value={137}>Polygon</option>
                        <option value={42161}>Arbitrum</option>
                        <option value={10}>Optimism</option>
                        <option value={56}>BSC</option>
                        <option value={43114}>Avax</option>
                        <option value={11155111}>Sepolia</option>
                    </select>
                </div>

                <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm text-zinc-400">
                    <span className="cursor-pointer hover:text-violet-400 transition-colors" onClick={() => setTxHash('0x76001a88ee97e50fccfe43730b3f3aec7eea5598a5d16446aa4163435c1cef4f')}>Try: 0x7600...1cef4f</span>
                    <span className="hidden md:inline">•</span>
                    <span className="flex items-center gap-1"><Shield size={12} /> Privacy First Architecture</span>
                </div>
            </motion.div>

            {billData && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-24 w-full max-w-6xl mx-auto"
                >
                    <div className="flex flex-col lg:flex-row gap-12 items-start">
                        {/* Left: Summary Card */}
                        <div className="flex-1 w-full bg-[#0F0F11] rounded-3xl shadow-2xl border border-white/10 p-8 text-left relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 rounded-full blur-[80px] -mr-16 -mt-16 pointer-events-none group-hover:bg-violet-600/20 transition-colors duration-500"></div>

                            <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 uppercase mb-6 tracking-wide border border-emerald-500/20">
                                <CheckCircle size={12} />
                                Status: {billData.STATUS}
                            </div>
                            <h3 className="text-3xl font-bold text-white mb-8 relative z-10">Receipt Ready</h3>

                            <div className="space-y-6 relative z-10">
                                <div className="flex justify-between items-center py-4 border-b border-white/5 hover:bg-white/5 px-2 rounded-lg transition-colors">
                                    <span className="text-zinc-400 font-medium">Type</span>
                                    <span className="text-zinc-200 font-mono font-bold bg-white/5 px-2 py-1 rounded border border-white/10">{billData.TYPE}</span>
                                </div>
                                <div className="flex justify-between items-center py-4 border-b border-white/5 hover:bg-white/5 px-2 rounded-lg transition-colors">
                                    <span className="text-zinc-400 font-medium">Network Fee</span>
                                    <span className="text-zinc-200 font-mono font-bold">${billData.TOTAL_FEE_USD}</span>
                                </div>
                                <div className="flex justify-between items-center py-4 border-b border-white/5 hover:bg-white/5 px-2 rounded-lg transition-colors">
                                    <span className="text-zinc-400 font-medium">Date</span>
                                    <span className="text-zinc-200 font-medium text-right">{billData.TIMESTAMP}</span>
                                </div>
                                <div className="flex justify-between items-center py-4 hover:bg-white/5 px-2 rounded-lg transition-colors">
                                    <span className="text-zinc-400 font-medium">Chain</span>
                                    <span className="flex items-center gap-2 font-bold text-zinc-200">
                                        <div className="w-2 h-2 rounded-full bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]"></div>
                                        {billData.CHAIN_NAME}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-white/5 relative z-10">
                                <a
                                    href={pdfUrl}
                                    target="_blank"
                                    // download={`receipt-${billData.BILL_ID}.pdf`} // Removed download attr
                                    className="w-full flex justify-center items-center gap-2 rounded-xl bg-violet-600 px-6 py-4 font-bold text-white transition-all hover:bg-violet-500 hover:shadow-lg hover:shadow-violet-600/20 active:translate-y-0.5"
                                >
                                    <FileText size={20} />
                                    Print / Save as PDF
                                </a>
                            </div>
                        </div>

                        {/* Right: PDF Preview */}
                        <div className="w-full lg:w-1/2 aspect-[210/297] bg-[#1a1a1a] rounded-3xl shadow-2xl border border-white/10 relative overflow-hidden group">
                            <div className="absolute inset-0 flex items-center justify-center text-zinc-600 bg-[#121212]">
                                <div className="text-center">
                                    <Loader2 size={48} className="mx-auto mb-4 animate-spin opacity-50" />
                                    <span className="font-medium text-sm">Loading Preview...</span>
                                </div>
                            </div>
                            <iframe src={`${pdfUrl}?mode=preview`} className="relative z-10 w-full h-full" />
                        </div>
                    </div>
                </motion.div>
            )}

            <div className="mt-24 mb-10">
                <AdBanner />
            </div>
        </>
    );
}
