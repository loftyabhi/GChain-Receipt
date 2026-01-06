'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useBalance, useReadContracts, useSwitchChain, useChainId } from 'wagmi';
import { AdminLogin } from '../../components/AdminLogin';
import { Navbar } from '@/components/Navbar';
import axios from 'axios';
import { Trash2, Plus, Megaphone, Shield, Search, X, Loader2, Lock, Unlock, ArrowDownCircle, Settings, Coins, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { formatEther, parseEther, erc20Abi, formatUnits } from 'viem';
import { base } from 'wagmi/chains';

// Minimal ABI for SupportVault
const VAULT_ABI = [
    { inputs: [], name: 'paused', outputs: [{ internalType: 'bool', name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'owner', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'pause', outputs: [], stateMutability: 'nonpayable', type: 'function' },
    { inputs: [], name: 'unpause', outputs: [], stateMutability: 'nonpayable', type: 'function' },
    { inputs: [{ internalType: 'address payable', name: 'to', type: 'address' }, { internalType: 'uint256', name: 'amount', type: 'uint256' }], name: 'withdrawNative', outputs: [], stateMutability: 'nonpayable', type: 'function' },
    { inputs: [{ internalType: 'address', name: 'token', type: 'address' }, { internalType: 'address', name: 'to', type: 'address' }, { internalType: 'uint256', name: 'amount', type: 'uint256' }], name: 'withdrawERC20', outputs: [], stateMutability: 'nonpayable', type: 'function' },
    { inputs: [], name: 'minContributionNative', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [{ internalType: 'uint256', name: '_min', type: 'uint256' }], name: 'setMinContributionNative', outputs: [], stateMutability: 'nonpayable', type: 'function' },
    { inputs: [{ internalType: 'address', name: 'token', type: 'address' }], name: 'isTokenAllowed', outputs: [{ internalType: 'bool', name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
    { inputs: [{ internalType: 'address', name: 'token', type: 'address' }, { internalType: 'bool', name: 'status', type: 'bool' }], name: 'setTokenStatus', outputs: [], stateMutability: 'nonpayable', type: 'function' }
] as const;

const VAULT_ADDRESS = process.env.NEXT_PUBLIC_SUPPORT_VAULT_ADDRESS as `0x${string}`;
const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS;
const TARGET_CHAIN_ID = base.id;

export default function DashboardPage() {
    const { isConnected, address } = useAccount();
    const { switchChainAsync } = useSwitchChain();
    const chainId = useChainId();
    const [token, setToken] = useState<string | null>(null);
    const [hasHydrated, setHasHydrated] = useState(false);
    const [activeTab, setActiveTab] = useState<'ads' | 'vault' | 'contributions'>('ads');
    const [isAdmin, setIsAdmin] = useState(false);

    // Ads Data State
    const [ads, setAds] = useState<any[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);

    // Ads Form State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState<any>({});

    // Vault Form States
    const [withdrawAddress, setWithdrawAddress] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [isERC20Withdraw, setIsERC20Withdraw] = useState(false);
    const [withdrawTokenAddress, setWithdrawTokenAddress] = useState('');
    const [newMinContribution, setNewMinContribution] = useState('');
    const [tokenAddress, setTokenAddress] = useState('');
    const [tokenStatus, setTokenStatus] = useState(true);

    useEffect(() => {
        setHasHydrated(true);
        const storedToken = localStorage.getItem('admin_token');
        if (storedToken) setToken(storedToken);

        // Check if user is admin (required for both ads and vault access)
        if (address && ADMIN_ADDRESS && address.toLowerCase() === ADMIN_ADDRESS.toLowerCase()) {
            setIsAdmin(true);
        } else {
            setIsAdmin(false);
        }
    }, [address]);

    useEffect(() => {
        if (!isConnected) {
            setToken(null);
        }
    }, [isConnected, address]);

    // Auto-switch to Base Mainnet
    useEffect(() => {
        if (isConnected && chainId && chainId !== TARGET_CHAIN_ID) {
            const switchNetwork = async () => {
                try {
                    await switchChainAsync({ chainId: TARGET_CHAIN_ID });
                    toast.success("Switched to Base Mainnet");
                } catch (error: any) {
                    if (!error.message?.includes("User rejected")) {
                        console.error("Network switch failed:", error);
                        toast.warning("Please switch to Base Mainnet for full functionality");
                    }
                }
            };
            switchNetwork();
        }
    }, [isConnected, chainId, switchChainAsync]);

    useEffect(() => {
        if (token && isConnected && activeTab === 'ads') {
            fetchData();
        }
    }, [token, isConnected, activeTab]);

    // Vault Contract Reads
    const { data: isPaused, refetch: refetchPaused } = useReadContract({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'paused',
    });

    const { data: owner } = useReadContract({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'owner',
    });

    const { data: minContribution, refetch: refetchMin } = useReadContract({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'minContributionNative',
    });

    const { data: balanceData, refetch: refetchBalance } = useBalance({
        address: VAULT_ADDRESS,
    });

    const { data: tokenData } = useReadContracts({
        contracts: (tokenAddress && tokenAddress.startsWith('0x') && tokenAddress.length === 42) ? [
            {
                address: tokenAddress as `0x${string}`,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [VAULT_ADDRESS],
            },
            {
                address: tokenAddress as `0x${string}`,
                abi: erc20Abi,
                functionName: 'decimals',
            },
            {
                address: tokenAddress as `0x${string}`,
                abi: erc20Abi,
                functionName: 'symbol',
            },
            {
                address: tokenAddress as `0x${string}`,
                abi: erc20Abi,
                functionName: 'name',
            }
        ] : [],
    });

    const tokenBalance = tokenData?.[0]?.result;
    const tokenDecimals = tokenData?.[1]?.result;
    const tokenSymbol = tokenData?.[2]?.result;
    const tokenName = tokenData?.[3]?.result;

    // Vault Contract Writes
    const { writeContractAsync } = useWriteContract();

    const wrapTx = async (promise: Promise<`0x${string}`>, title: string) => {
        const toastId = toast.loading("Waiting for confirmation...", { description: title });
        try {
            const hash = await promise;
            toast.success("Transaction submitted!", {
                id: toastId,
                description: `Tx Hash: ${hash.slice(0, 10)}...`
            });
            return hash;
        } catch (err: any) {
            console.error(err);
            toast.error("Transaction Failed", {
                id: toastId,
                description: err.message?.slice(0, 100) || "Unknown error"
            });
            throw err;
        }
    };

    const handlePauseToggle = () => {
        wrapTx(writeContractAsync({
            address: VAULT_ADDRESS,
            abi: VAULT_ABI,
            functionName: isPaused ? 'unpause' : 'pause',
        }), isPaused ? 'Unpausing Vault' : 'Pausing Vault');
    };

    const handleWithdraw = async () => {
        if (!withdrawAddress || !withdrawAmount) return;

        const promise = isERC20Withdraw && withdrawTokenAddress
            ? writeContractAsync({
                address: VAULT_ADDRESS,
                abi: VAULT_ABI,
                functionName: 'withdrawERC20',
                args: [withdrawTokenAddress as `0x${string}`, withdrawAddress as `0x${string}`, parseEther(withdrawAmount)],
            })
            : writeContractAsync({
                address: VAULT_ADDRESS,
                abi: VAULT_ABI,
                functionName: 'withdrawNative',
                args: [withdrawAddress as `0x${string}`, parseEther(withdrawAmount)],
            });

        await wrapTx(promise, 'Withdrawing Funds');
        refetchBalance();
    };

    const handleSetMin = () => {
        if (!newMinContribution) return;
        wrapTx(writeContractAsync({
            address: VAULT_ADDRESS,
            abi: VAULT_ABI,
            functionName: 'setMinContributionNative',
            args: [parseEther(newMinContribution)],
        }), 'Updating Min Contribution');
    };

    const handleSetToken = async () => {
        if (!tokenAddress) return;

        try {
            // 1. Update On-Chain
            await wrapTx(writeContractAsync({
                address: VAULT_ADDRESS,
                abi: VAULT_ABI,
                functionName: 'setTokenStatus',
                args: [tokenAddress as `0x${string}`, tokenStatus],
            }), 'Updating Token Status');

            // 2. Sync with Database
            const toastId = toast.loading("Syncing with database...");
            try {
                // If banning (tokenStatus === false), we update is_active to false.
                // If allowing, we insert/update with details.
                const payload = {
                    address: tokenAddress,
                    symbol: tokenSymbol || 'UNK', // Fallback if fetch failed
                    name: tokenName || 'Unknown Token',
                    decimals: Number(tokenDecimals || 18),
                    is_native: false,
                    is_active: tokenStatus
                };

                await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/tokens`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                toast.success("Database synced successfully", { id: toastId });
            } catch (apiErr) {
                console.error("Database sync failed", apiErr);
                toast.error("On-chain success, but DB sync failed.", { id: toastId });
            }

        } catch (err) {
            // Error handling already in wrapTx for contract, but we catch here if needed
        }
    };

    // Ads Management Functions
    const fetchData = async () => {
        setIsLoadingData(true);
        try {
            const endpoint = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/ads`;
            const res = await axios.get(endpoint, { headers: { Authorization: `Bearer ${token}` } });
            setAds(res.data);
        } catch (err) {
            console.error(err);
            if ((err as any).response?.status === 401) {
                setToken(null);
                localStorage.removeItem('admin_token');
                toast.error("Session expired. Please login again.");
            } else {
                toast.error("Failed to load data");
            }
        } finally {
            setIsLoadingData(false);
        }
    };

    const handleDelete = async (id: string) => {
        toast("Delete this item?", {
            action: {
                label: 'Confirm Delete',
                onClick: async () => {
                    try {
                        await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/ads/${id}`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        toast.success('Ad deleted successfully');
                        fetchData();
                    } catch (err) {
                        console.error(err);
                        if ((err as any).response?.status === 401) {
                            setToken(null);
                            localStorage.removeItem('admin_token');
                            toast.error("Session expired. Please login again.");
                        } else {
                            toast.error("Delete failed");
                        }
                    }
                }
            },
            cancel: {
                label: 'Cancel',
                onClick: () => { }
            }
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const toastId = toast.loading("Saving changes...");
        try {
            const payload = { ...formData, id: formData.id || Date.now().toString() };

            await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/ads`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsFormOpen(false);
            setFormData({});
            fetchData();
            toast.success("Saved successfully!", { id: toastId });
        } catch (err) {
            console.error(err);
            if ((err as any).response?.status === 401) {
                setToken(null);
                localStorage.removeItem('admin_token');
                toast.error("Session expired. Please login again.", { id: toastId });
            } else {
                toast.error("Save failed. Check console.", { id: toastId });
            }
        }
    };

    // Prevent hydration mismatch
    if (!hasHydrated) return null;

    if (!token || !isConnected || !isAdmin) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center font-sans">
                <div className="max-w-md w-full mx-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-xl"
                    >
                        <AdminLogin onLogin={setToken} />
                    </motion.div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-purple-500/30 overflow-x-hidden">
            <Navbar />

            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/5 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/5 blur-[120px]" />
            </div>

            <main className="relative z-10 pt-32 pb-20 px-6 max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div>
                        <h1 className="text-4xl font-bold flex items-center gap-3 mb-2">
                            Dashboard
                        </h1>
                        <p className="text-zinc-400">
                            {activeTab === 'ads' ? 'Configure ad placement' : 'Manage Vault settings and funds'}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <button
                            onClick={() => {
                                setToken(null);
                                localStorage.removeItem('admin_token');
                                toast.info("Logged out successfully");
                            }}
                            className="px-5 py-2.5 text-sm font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                </div>

                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 w-fit backdrop-blur-md mb-8">
                    <button
                        onClick={() => setActiveTab('ads')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'ads'
                            ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25'
                            : 'text-zinc-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <Megaphone size={16} />
                        Ads
                    </button>
                    <button
                        onClick={() => setActiveTab('vault')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'vault'
                            ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25'
                            : 'text-zinc-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <Shield size={16} />
                        Vault
                    </button>
                    <button
                        onClick={() => setActiveTab('contributions')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'contributions'
                            ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25'
                            : 'text-zinc-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <Search size={16} />
                        Contributions
                    </button>
                </div>

                {/* Ads Tab Content */}
                {activeTab === 'ads' && (
                    <>
                        {/* Controls */}
                        <div className="flex sm:items-center justify-end flex-col sm:flex-row gap-4 mb-8">
                            <button
                                onClick={() => { setFormData({}); setIsFormOpen(true); }}
                                className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-6 py-3 rounded-xl shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 transition-all font-bold active:scale-95"
                            >
                                <Plus size={18} />
                                Add Ad
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="min-h-[300px]">
                            {isLoadingData ? (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <Loader2 className="animate-spin text-zinc-500 mb-4" size={32} />
                                    <p className="text-zinc-500">Loading data...</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {ads.map((item) => (
                                        <motion.div
                                            layout
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            key={item.id}
                                            className="group bg-white/5 border border-white/10 hover:border-violet-500/30 p-8 rounded-3xl transition-all hover:bg-white/10 relative overflow-hidden backdrop-blur-sm"
                                        >
                                            <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none">
                                                <Megaphone size={100} />
                                            </div>

                                            <div className="flex justify-between items-start mb-6 relative z-10">
                                                <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
                                                    <Megaphone size={24} />
                                                </div>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>

                                            <div className="relative z-10">
                                                <h3 className="text-xl font-bold text-white mb-4 line-clamp-1">{item.name || `Ad #${item.id}`}</h3>

                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase ${item.isActive ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                                            {item.isActive ? 'ACTIVE' : 'INACTIVE'}
                                                        </span>
                                                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20`}>
                                                            {item.placement || 'both'}
                                                        </span>
                                                    </div>

                                                    {item.contentHtml && (
                                                        <div className="mt-4 p-4 bg-black/40 rounded-xl border border-white/5 text-xs text-zinc-500 font-mono truncate">
                                                            {item.contentHtml}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}

                                    {ads.length === 0 && (
                                        <div className="col-span-full flex flex-col items-center justify-center py-24 text-zinc-500 bg-white/5 rounded-3xl border border-dashed border-white/10">
                                            <div className="bg-white/5 p-4 rounded-full mb-4">
                                                <Search size={32} className="opacity-50" />
                                            </div>
                                            <p className="font-medium">No ads configured.</p>
                                            <p className="text-sm opacity-60 mt-1">Create a new ad to get started.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Form Modal */}
                        <AnimatePresence>
                            {isFormOpen && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                        className="bg-[#0a0a0a] border border-white/10 p-8 rounded-3xl w-full max-w-lg shadow-2xl shadow-violet-500/10 relative"
                                    >
                                        <button
                                            onClick={() => setIsFormOpen(false)}
                                            className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                                        >
                                            <X size={20} />
                                        </button>

                                        <h2 className="text-2xl font-bold text-white mb-8">
                                            {formData.id ? 'Edit' : 'New'} Ad
                                        </h2>

                                        <form onSubmit={handleSave} className="space-y-6">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 pl-1">Ad ID (Optional)</label>
                                                    <input
                                                        value={formData.id || ''}
                                                        onChange={e => setFormData({ ...formData, id: e.target.value })}
                                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white focus:border-violet-500 outline-none transition-all font-mono text-sm"
                                                        placeholder="Auto-assigned"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 pl-1">Name</label>
                                                    <input
                                                        value={formData.name || ''}
                                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white focus:border-violet-500 outline-none transition-all text-sm"
                                                        placeholder="Home Banner"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 pl-1">HTML Content</label>
                                                <textarea
                                                    value={formData.contentHtml || ''}
                                                    onChange={e => setFormData({ ...formData, contentHtml: e.target.value })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white focus:border-violet-500 outline-none transition-all h-32 font-mono text-sm"
                                                    placeholder="<div>Ad Content...</div>"
                                                    required
                                                />
                                            </div>
                                            <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/5">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.isActive || false}
                                                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                                    className="w-5 h-5 accent-violet-500 rounded"
                                                />
                                                <span className="text-sm text-zinc-300">Ad Active?</span>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 pl-1">Placement</label>
                                                <select
                                                    value={formData.placement || 'both'}
                                                    onChange={e => setFormData({ ...formData, placement: e.target.value })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white focus:border-violet-500 outline-none transition-all [&>option]:bg-zinc-900"
                                                >
                                                    <option value="both">Both (Web & PDF)</option>
                                                    <option value="web">Web Only</option>
                                                    <option value="pdf">PDF Only</option>
                                                </select>
                                            </div>

                                            <div className="flex gap-4 pt-4">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsFormOpen(false)}
                                                    className="flex-1 rounded-xl bg-white/5 py-3.5 text-sm font-bold text-white hover:bg-white/10 border border-white/10 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="submit"
                                                    className="flex-1 rounded-xl bg-violet-600 py-3.5 text-sm font-bold text-white hover:bg-violet-500 shadow-lg shadow-violet-500/20 transition-all active:scale-95"
                                                >
                                                    Save Changes
                                                </button>
                                            </div>
                                        </form>
                                    </motion.div>
                                </div>
                            )}
                        </AnimatePresence>
                    </>
                )}

                {/* Vault Tab Content */}
                {activeTab === 'vault' && (
                    <>
                        {!isAdmin ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="text-center p-8 bg-white/5 rounded-3xl border border-red-500/20 backdrop-blur-xl max-w-md">
                                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                                        <AlertTriangle className="text-red-500" size={32} />
                                    </div>
                                    <h2 className="text-2xl font-bold mb-3">Restricted Area</h2>
                                    <p className="text-zinc-400">Administrator Credentials Required.</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Balance Card */}
                                <div className="w-full bg-gradient-to-br from-violet-900/20 to-zinc-900 border border-violet-500/20 rounded-3xl p-10 mb-10 relative overflow-hidden backdrop-blur-xl">
                                    <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none text-white">
                                        <Coins size={180} />
                                    </div>
                                    <div className="relative z-10">
                                        <h2 className="text-sm font-medium text-violet-300 mb-3 tracking-wide uppercase">Total Vault Balance</h2>
                                        <div className="flex items-baseline gap-3 mb-2">
                                            <span className="text-6xl font-bold text-white tracking-tight">
                                                {balanceData ? Number(formatEther(balanceData.value)).toFixed(4) : '0.0000'}
                                            </span>
                                            <span className="text-2xl font-medium text-zinc-500">
                                                {balanceData?.symbol || 'ETH'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-zinc-400">
                                            Funds available for withdrawal or distribution.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Status Card */}
                                    <div className="bg-white/5 rounded-3xl border border-white/10 p-8 backdrop-blur-md">
                                        <div className="flex items-center gap-3 mb-8">
                                            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
                                                <Shield size={24} />
                                            </div>
                                            <h2 className="text-xl font-bold">Contract Status</h2>
                                        </div>

                                        <div className="flex items-center justify-between mb-6 p-4 bg-black/20 rounded-2xl border border-white/5">
                                            <span className="text-zinc-400 text-sm font-medium">Current State</span>
                                            <div className={`flex items-center gap-2 font-bold px-3 py-1 rounded-lg ${isPaused ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                                                {isPaused ? <Lock size={14} /> : <Unlock size={14} />}
                                                <span className="text-sm">{isPaused ? 'PAUSED' : 'ACTIVE'}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between mb-8 p-4 bg-black/20 rounded-2xl border border-white/5">
                                            <span className="text-zinc-400 text-sm font-medium">On-Chain Owner</span>
                                            <span className="font-mono text-xs text-zinc-300 bg-white/5 px-2 py-1 rounded">
                                                {owner ? `${owner.slice(0, 6)}...${owner.slice(-4)}` : 'Loading...'}
                                            </span>
                                        </div>

                                        <button
                                            onClick={handlePauseToggle}
                                            className={`w-full py-4 rounded-xl font-bold transition-all shadow-lg active:scale-95 ${isPaused
                                                ? 'bg-green-600 hover:bg-green-500 text-white shadow-green-600/20'
                                                : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20'
                                                }`}
                                        >
                                            {isPaused ? 'Resume Contributions (Unpause)' : 'Emergency Stop (Pause)'}
                                        </button>
                                    </div>

                                    {/* Withdraw Card */}
                                    <div className="bg-white/5 rounded-3xl border border-white/10 p-8 backdrop-blur-md">
                                        <div className="flex items-center gap-3 mb-8">
                                            <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-400">
                                                <ArrowDownCircle size={24} />
                                            </div>
                                            <h2 className="text-xl font-bold">Withdraw Funds</h2>
                                        </div>

                                        <div className="space-y-6">
                                            <div>
                                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 pl-1">Recipient Address</label>
                                                <input
                                                    type="text"
                                                    placeholder="0x..."
                                                    value={withdrawAddress}
                                                    onChange={(e) => setWithdrawAddress(e.target.value)}
                                                    className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all font-mono text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 pl-1">Amount</label>
                                                <input
                                                    type="number"
                                                    placeholder="0.0"
                                                    value={withdrawAmount}
                                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                                    className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all font-mono text-sm"
                                                />
                                            </div>

                                            <div className="flex items-center gap-3 bg-black/20 p-3 rounded-xl border border-white/5">
                                                <input
                                                    type="checkbox"
                                                    checked={isERC20Withdraw}
                                                    onChange={(e) => setIsERC20Withdraw(e.target.checked)}
                                                    className="accent-violet-500 w-4 h-4 rounded"
                                                />
                                                <span className="text-sm text-zinc-400">Withdraw ERC20 Token (Standard is ETH)</span>
                                            </div>

                                            {isERC20Withdraw && (
                                                <div className="p-4 bg-orange-500/5 border border-orange-500/10 rounded-xl animate-in fade-in slide-in-from-top-2">
                                                    <label className="block text-xs font-bold text-orange-400/80 uppercase tracking-wider mb-2">Token Contract Address</label>
                                                    <input
                                                        type="text"
                                                        placeholder="0x..."
                                                        value={withdrawTokenAddress}
                                                        onChange={(e) => setWithdrawTokenAddress(e.target.value)}
                                                        className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-orange-500 transition-all font-mono text-sm"
                                                    />
                                                    <p className="text-[10px] text-orange-400/60 mt-2">* Assumes 18 decimals</p>
                                                </div>
                                            )}

                                            <div className="pt-2">
                                                <button
                                                    onClick={handleWithdraw}
                                                    disabled={!withdrawAddress || !withdrawAmount}
                                                    className="w-full py-4 rounded-xl bg-white text-black font-bold transition-all hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-white/5"
                                                >
                                                    Withdraw Funds
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                                    {/* Min Contribution Card */}
                                    <div className="bg-white/5 rounded-3xl border border-white/10 p-8 backdrop-blur-md">
                                        <div className="flex items-center gap-3 mb-8">
                                            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                                                <Settings size={24} />
                                            </div>
                                            <h2 className="text-xl font-bold">Configuration</h2>
                                        </div>

                                        <div className="mb-8 p-6 bg-black/20 rounded-2xl border border-white/5">
                                            <div className="text-sm font-medium text-zinc-500 mb-1">Current Min Contribution</div>
                                            <div className="font-mono text-2xl font-bold text-white tracking-tight">
                                                {minContribution ? formatEther(minContribution) : '...'} <span className="text-lg text-zinc-600">ETH</span>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <div>
                                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 pl-1">New Minimum (ETH)</label>
                                                <input
                                                    type="number"
                                                    placeholder="0.0001"
                                                    value={newMinContribution}
                                                    onChange={(e) => setNewMinContribution(e.target.value)}
                                                    className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all font-mono text-sm"
                                                />
                                            </div>
                                            <button
                                                onClick={handleSetMin}
                                                disabled={!newMinContribution}
                                                className="w-full py-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold transition-all disabled:opacity-50 shadow-lg shadow-violet-600/20"
                                            >
                                                Update Minimum
                                            </button>
                                        </div>
                                    </div>

                                    {/* Token Allowlist Card */}
                                    <div className="bg-white/5 rounded-3xl border border-white/10 p-8 backdrop-blur-md">
                                        <div className="flex items-center gap-3 mb-8">
                                            <div className="p-2.5 rounded-xl bg-pink-500/10 text-pink-400">
                                                <Coins size={24} />
                                            </div>
                                            <h2 className="text-xl font-bold">ERC20 Allowlist</h2>
                                        </div>

                                        <div className="space-y-6">
                                            <div>
                                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 pl-1">Token Address</label>
                                                <input
                                                    type="text"
                                                    placeholder="0x..."
                                                    value={tokenAddress}
                                                    onChange={(e) => setTokenAddress(e.target.value)}
                                                    className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all font-mono text-sm"
                                                />
                                                {tokenAddress && tokenBalance !== undefined && (
                                                    <div className="mt-3 p-3 bg-pink-500/5 text-xs font-mono text-pink-300 rounded-lg border border-pink-500/10">
                                                        Vault Balance: {Number(formatUnits(tokenBalance as bigint, (tokenDecimals as number) || 18)).toFixed(4)} {tokenSymbol as string || '???'}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-4 bg-black/20 p-1.5 rounded-xl border border-white/5">
                                                <label className={`flex-1 flex items-center justify-center gap-2 cursor-pointer py-3 rounded-lg transition-all ${tokenStatus ? 'bg-green-500/10 text-green-400 font-bold shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>
                                                    <input
                                                        type="radio"
                                                        checked={tokenStatus === true}
                                                        onChange={() => setTokenStatus(true)}
                                                        className="hidden"
                                                    />
                                                    <span>Allow</span>
                                                </label>
                                                <label className={`flex-1 flex items-center justify-center gap-2 cursor-pointer py-3 rounded-lg transition-all ${!tokenStatus ? 'bg-red-500/10 text-red-400 font-bold shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>
                                                    <input
                                                        type="radio"
                                                        checked={tokenStatus === false}
                                                        onChange={() => setTokenStatus(false)}
                                                        className="hidden"
                                                    />
                                                    <span>Ban</span>
                                                </label>
                                            </div>

                                            <button
                                                onClick={handleSetToken}
                                                disabled={!tokenAddress}
                                                className="w-full py-4 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold transition-all disabled:opacity-50 shadow-lg shadow-pink-600/20"
                                            >
                                                Update Token Status
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                )}
                {activeTab === 'contributions' && (
                    <ContributionsPanel token={token} apiUrl={process.env.NEXT_PUBLIC_API_URL} />
                )}
            </main>
        </div>
    );
}

function ContributionsPanel({ token, apiUrl }: { token: string | null, apiUrl?: string }) {
    const [txHash, setTxHash] = useState('');
    const [statusResult, setStatusResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const handleVerify = async () => {
        if (!txHash) return;
        setLoading(true);
        try {
            const res = await axios.post(`${apiUrl}/api/contributions/submit`, { txHash, isAnonymous: false });
            toast.success("Submitted", { description: res.data.message });
            handleCheckStatus();
        } catch (err: any) {
            console.error(err);
            toast.error("Submission failed", { description: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleCheckStatus = async () => {
        if (!txHash) return;
        setLoading(true);
        setStatusResult(null);
        try {
            const res = await axios.get(`${apiUrl}/api/contributions/status/${txHash}`);
            setStatusResult(res.data);
            toast.success("Status retrieved");
        } catch (err: any) {
            console.error(err);
            if (err.response?.status === 404) {
                setStatusResult({ found: false, message: "Not found in system." });
            } else {
                toast.error("Check failed");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white/5 rounded-3xl border border-white/10 p-8 backdrop-blur-md">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-400">
                        <Search size={24} />
                    </div>
                    <h2 className="text-xl font-bold">Inspect Transaction</h2>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 pl-1">Transaction Hash</label>
                        <input
                            type="text"
                            placeholder="0x..."
                            value={txHash}
                            onChange={(e) => setTxHash(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-orange-500 transition-all font-mono text-sm"
                        />
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={handleCheckStatus}
                            disabled={loading || !txHash}
                            className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Check Status'}
                        </button>
                        <button
                            onClick={handleVerify}
                            disabled={loading || !txHash}
                            className="flex-1 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold transition-all disabled:opacity-50 shadow-lg shadow-orange-600/20"
                        >
                            {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Force Verify / Retry'}
                        </button>
                    </div>
                </div>

                {statusResult && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6 p-6 bg-black/30 rounded-2xl border border-white/5 font-mono text-sm overflow-hidden"
                    >
                        {statusResult.found ? (
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-zinc-500">Status:</span>
                                    <span className={`font-bold uppercase ${statusResult.status === 'confirmed' ? 'text-green-400' :
                                        statusResult.status === 'failed' ? 'text-red-400' : 'text-yellow-400'
                                        }`}>{statusResult.status}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-500">Source:</span>
                                    <span className="text-white">{statusResult.source}</span>
                                </div>
                                {statusResult.details?.last_error && (
                                    <div className="pt-2 border-t border-white/10 mt-2 text-red-300">
                                        Error: {statusResult.details.last_error}
                                    </div>
                                )}
                                <div className="pt-2 border-t border-white/10 mt-2 text-xs text-zinc-600 break-all">
                                    Last Updated: {statusResult.details?.updated_at || statusResult.details?.created_at}
                                </div>
                            </div>
                        ) : (
                            <div className="text-zinc-500 italic">
                                {statusResult.message}
                            </div>
                        )}
                    </motion.div>
                )}
            </div>

            <div className="bg-white/5 rounded-3xl border border-white/10 p-8 backdrop-blur-md">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
                        <Shield size={24} />
                    </div>
                    <h2 className="text-xl font-bold">Operational Guide</h2>
                </div>
                <div className="space-y-4 text-sm text-zinc-400">
                    <p>
                        The system now uses a <span className="text-white font-bold">Push-Based</span> architecture.
                        Transactions are verified individually rather than scanned in blocks.
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>
                            <strong className="text-white">Pending:</strong> The system has seen the hash and is waiting for confirmations.
                        </li>
                        <li>
                            <strong className="text-white">Confirmed:</strong> The event was successfully decoded and stored.
                        </li>
                        <li>
                            <strong className="text-white">Failed:</strong> Verification failed (reverted, wrong contract, missing event).
                        </li>
                    </ul>
                    <p className="pt-4 border-t border-white/5 mt-4">
                        Use <strong>Force Verify</strong> if a user claims their contribution is missing.
                    </p>
                </div>
            </div>
        </div>
    );
}