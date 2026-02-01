'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useBalance, useReadContracts, useSwitchChain, useChainId } from 'wagmi';
import { AdminLogin } from '../../components/AdminLogin';
import { Navbar } from '@/components/Navbar';
import axios from 'axios';
import { Trash2, Plus, Megaphone, Shield, Search, X, Loader2, Lock, Unlock, ArrowDownCircle, Settings, Coins, AlertTriangle, Key, BarChart3, Activity, FileText, Globe, Ban, AlertCircle, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { formatEther, parseEther, erc20Abi, formatUnits } from 'viem';
import { base } from 'wagmi/chains';

// Minimal ABI for SupportVault (unchanged)
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
    const [activeTab, setActiveTab] = useState<'ads' | 'vault' | 'contributions' | 'api'>('ads');
    // Sub-tab for API Platform
    const [apiTab, setApiTab] = useState<'keys' | 'analytics' | 'sla' | 'audit'>('keys');
    const [isAdmin, setIsAdmin] = useState(false);

    // Data States
    const [ads, setAds] = useState<any[]>([]);
    const [apiKeys, setApiKeys] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [apiStats, setApiStats] = useState<any>(null);
    const [isLoadingData, setIsLoadingData] = useState(false);

    // Form States
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState<any>({});

    // API Key Form
    const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
    const [keyFormData, setKeyFormData] = useState({ ownerId: '', planName: 'Free' });
    const [createdKey, setCreatedKey] = useState<string | null>(null); // Show once

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

        if (address && ADMIN_ADDRESS && address.toLowerCase() === ADMIN_ADDRESS.toLowerCase()) {
            setIsAdmin(true);
        } else {
            setIsAdmin(false);
            // Default to 'api' (Developer Portal) if not admin
            setActiveTab('api');
        }
    }, [address]);

    useEffect(() => {
        if (!isConnected) {
            setToken(null);
            setIsAdmin(false);
        }
    }, [isConnected, address]);

    // Data Fetching Routing
    useEffect(() => {
        if (!isConnected || !token) return;

        if (activeTab === 'ads') fetchData();
        if (activeTab === 'api') {
            if (apiTab === 'keys') fetchApiKeys();
            if (apiTab === 'audit') fetchAuditLogs();
            if (apiTab === 'analytics' || apiTab === 'sla') fetchApiStats();
        }
    }, [token, isConnected, activeTab, apiTab]);

    // --- API Platform Fetchers ---
    // --- API Platform Fetchers ---
    const fetchApiKeys = async () => {
        setIsLoadingData(true);
        try {
            const endpoint = `/api/admin/keys`;
            const res = await axios.get(endpoint, { headers: { Authorization: `Bearer ${token}` } });
            setApiKeys(res.data);
        } catch (err) { handleError(err); }
        finally { setIsLoadingData(false); }
    };

    const fetchAuditLogs = async () => {
        setIsLoadingData(true);
        try {
            const endpoint = `/api/admin/audit`;
            const res = await axios.get(endpoint, { headers: { Authorization: `Bearer ${token}` } });
            setAuditLogs(res.data);
        } catch (err) { handleError(err); }
        finally { setIsLoadingData(false); }
    };

    const fetchApiStats = async () => {
        setIsLoadingData(true);
        try {
            const endpoint = `/api/admin/usage`;
            const res = await axios.get(endpoint, { headers: { Authorization: `Bearer ${token}` } });
            setApiStats(res.data);
        } catch (err) { handleError(err); }
        finally { setIsLoadingData(false); }
    };

    const handleCreateKey = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await axios.post(
                `/api/admin/keys`,
                keyFormData,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setCreatedKey(res.data.key);
            fetchApiKeys();
            toast.success("API Key Generated");
        } catch (err) { handleError(err); }
    };

    const handleUpdateKey = async (id: string, updates: any) => {
        try {
            await axios.put(
                `/api/admin/keys/${id}`,
                updates,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success("Key updated");
            fetchApiKeys();
        } catch (err) { handleError(err); }
    };

    // --- Original Ads Fetcher ---
    const fetchData = async () => {
        setIsLoadingData(true);
        try {
            const endpoint = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/ads`;
            const res = await axios.get(endpoint, { headers: { Authorization: `Bearer ${token}` } });
            setAds(res.data);
        } catch (err) { handleError(err); }
        finally { setIsLoadingData(false); }
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
                    } catch (err) { handleError(err); }
                }
            },
            cancel: { label: 'Cancel', onClick: () => { } }
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
            toast.error("Save failed", { id: toastId });
            handleError(err);
        }
    };

    const handleError = (err: any) => {
        console.error(err);
        if (err.response?.status === 401) {
            setToken(null);
            localStorage.removeItem('admin_token');
            toast.error("Session expired");
        } else {
            toast.error("Operation failed");
        }
    };

    // --- Vault Logic ---
    const { data: isPaused } = useReadContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'paused' });
    const { data: owner } = useReadContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'owner' });
    const { data: minContribution } = useReadContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'minContributionNative' });
    const { data: balanceData, refetch: refetchBalance } = useBalance({ address: VAULT_ADDRESS });

    // Token Data
    const { data: tokenData } = useReadContracts({
        contracts: (tokenAddress && tokenAddress.startsWith('0x') && tokenAddress.length === 42) ? [
            { address: tokenAddress as `0x${string}`, abi: erc20Abi, functionName: 'balanceOf', args: [VAULT_ADDRESS] },
            { address: tokenAddress as `0x${string}`, abi: erc20Abi, functionName: 'decimals' },
            { address: tokenAddress as `0x${string}`, abi: erc20Abi, functionName: 'symbol' },
            { address: tokenAddress as `0x${string}`, abi: erc20Abi, functionName: 'name' }
        ] : [],
    });

    const tokenBalance = tokenData?.[0]?.result;
    const tokenDecimals = tokenData?.[1]?.result;
    const tokenSymbol = tokenData?.[2]?.result;
    const tokenName = tokenData?.[3]?.result;

    const { writeContractAsync } = useWriteContract();

    const wrapTx = async (promise: Promise<`0x${string}`>, title: string) => {
        const toastId = toast.loading("Waiting for confirmation...", { description: title });
        try {
            const hash = await promise;
            toast.success("Transaction submitted!", { id: toastId, description: `Tx Hash: ${hash.slice(0, 10)}...` });
            return hash;
        } catch (err: any) {
            console.error(err);
            toast.error("Transaction Failed", { id: toastId, description: err.message?.slice(0, 100) || "Unknown error" });
            throw err;
        }
    };

    const handlePauseToggle = () => {
        wrapTx(writeContractAsync({
            address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: isPaused ? 'unpause' : 'pause',
        }), isPaused ? 'Unpausing Vault' : 'Pausing Vault');
    };

    const handleWithdraw = async () => {
        if (!withdrawAddress || !withdrawAmount) return;
        const promise = isERC20Withdraw && withdrawTokenAddress
            ? writeContractAsync({
                address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'withdrawERC20',
                args: [withdrawTokenAddress as `0x${string}`, withdrawAddress as `0x${string}`, parseEther(withdrawAmount)],
            })
            : writeContractAsync({
                address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'withdrawNative',
                args: [withdrawAddress as `0x${string}`, parseEther(withdrawAmount)],
            });
        await wrapTx(promise, 'Withdrawing Funds');
        refetchBalance();
    };

    const handleSetMin = () => {
        if (!newMinContribution) return;
        wrapTx(writeContractAsync({
            address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'setMinContributionNative',
            args: [parseEther(newMinContribution)],
        }), 'Updating Min Contribution');
    };

    const handleSetToken = async () => {
        if (!tokenAddress) return;
        try {
            await wrapTx(writeContractAsync({
                address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'setTokenStatus',
                args: [tokenAddress as `0x${string}`, tokenStatus],
            }), 'Updating Token Status');

            const toastId = toast.loading("Syncing with database...");
            try {
                const payload = {
                    address: tokenAddress,
                    symbol: tokenSymbol || 'UNK',
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
                toast.error("On-chain success, but DB sync failed.", { id: toastId });
            }
        } catch (err) { }
    };

    // Prevent hydration mismatch
    if (!hasHydrated) return null;

    // Login Screen
    if (!token || !isConnected) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center font-sans">
                <div className="max-w-md w-full mx-4">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-xl">
                        <AdminLogin onLogin={setToken} />
                    </motion.div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-purple-500/30 overflow-x-hidden">
            <Navbar />
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/5 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/5 blur-[120px]" />
            </div>

            <main className="relative z-10 pt-32 pb-20 px-6 max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div>
                        <h1 className="text-4xl font-bold flex items-center gap-3 mb-2">
                            {isAdmin ? 'Admin Dashboard' : 'Developer Portal'}
                        </h1>
                        <p className="text-zinc-400">
                            {isAdmin ? 'Manage platform, vault, and users' : 'Manage your API keys and integration'}
                        </p>
                    </div>
                </div>

                {/* Main Navigation */}
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 w-fit backdrop-blur-md mb-8 overflow-x-auto">
                    {isAdmin && (
                        <>
                            <button onClick={() => setActiveTab('ads')} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'ads' ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
                                <Megaphone size={16} /> Ads
                            </button>
                            <button onClick={() => setActiveTab('vault')} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'vault' ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
                                <Shield size={16} /> Vault
                            </button>
                        </>
                    )}
                    <button onClick={() => setActiveTab('api')} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'api' ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
                        <Key size={16} /> API Platform
                    </button>
                </div>

                {/* --- ADS TAB --- */}
                {activeTab === 'ads' && (
                    <>
                        <div className="flex sm:items-center justify-end flex-col sm:flex-row gap-4 mb-8">
                            <button onClick={() => { setFormData({}); setIsFormOpen(true); }} className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-6 py-3 rounded-xl shadow-lg shadow-violet-500/20 active:scale-95 transition-all font-bold">
                                <Plus size={18} /> Add Ad
                            </button>
                        </div>

                        <div className="min-h-[300px]">
                            {isLoadingData ? (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <Loader2 className="animate-spin text-zinc-500 mb-4" size={32} />
                                    <p className="text-zinc-500">Loading data...</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {ads.map((item) => (
                                        <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={item.id} className="group bg-white/5 border border-white/10 hover:border-violet-500/30 p-8 rounded-3xl transition-all relative overflow-hidden backdrop-blur-sm">
                                            <div className="flex justify-between items-start mb-6 relative z-10">
                                                <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400"><Megaphone size={24} /></div>
                                                <button onClick={() => handleDelete(item.id)} className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg"><Trash2 size={18} /></button>
                                            </div>
                                            <div className="relative z-10">
                                                <h3 className="text-xl font-bold text-white mb-4 line-clamp-1">{item.name || `Ad #${item.id}`}</h3>
                                                <div className="flex items-center gap-2 mb-4">
                                                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase ${item.isActive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>{item.isActive ? 'ACTIVE' : 'INACTIVE'}</span>
                                                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase bg-blue-500/10 text-blue-400">{item.placement || 'both'}</span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                    {ads.length === 0 && (
                                        <div className="col-span-full flex flex-col items-center justify-center py-24 text-zinc-500 bg-white/5 rounded-3xl border border-dashed border-white/10">
                                            <p className="font-medium">No ads configured.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <AnimatePresence>
                            {isFormOpen && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#0a0a0a] border border-white/10 p-8 rounded-3xl w-full max-w-lg shadow-2xl relative">
                                        <button onClick={() => setIsFormOpen(false)} className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-white"><X size={20} /></button>
                                        <h2 className="text-2xl font-bold text-white mb-8">{formData.id ? 'Edit' : 'New'} Ad</h2>
                                        <form onSubmit={handleSave} className="space-y-6">
                                            <div>
                                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Name</label>
                                                <input value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white focus:border-violet-500 outline-none" required />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">HTML Content</label>
                                                <textarea value={formData.contentHtml || ''} onChange={e => setFormData({ ...formData, contentHtml: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white focus:border-violet-500 outline-none h-32 font-mono text-sm" required />
                                            </div>
                                            <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/5">
                                                <input type="checkbox" checked={formData.isActive || false} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} className="w-5 h-5 accent-violet-500 rounded" />
                                                <span className="text-sm text-zinc-300">Ad Active?</span>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Placement</label>
                                                <select value={formData.placement || 'both'} onChange={e => setFormData({ ...formData, placement: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white focus:border-violet-500 outline-none [&>option]:bg-zinc-900">
                                                    <option value="both">Both (Web & PDF)</option>
                                                    <option value="web">Web Only</option>
                                                    <option value="pdf">PDF Only</option>
                                                </select>
                                            </div>
                                            <button type="submit" className="w-full rounded-xl bg-violet-600 py-3.5 text-sm font-bold text-white hover:bg-violet-500 shadow-lg shadow-violet-500/20">Save Changes</button>
                                        </form>
                                    </motion.div>
                                </div>
                            )}
                        </AnimatePresence>
                    </>
                )}

                {/* --- VAULT TAB --- */}
                {activeTab === 'vault' && (
                    <>
                        {!isAdmin ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="text-center p-8 bg-white/5 rounded-3xl border border-red-500/20 max-w-md">
                                    <AlertTriangle className="text-red-500 mx-auto mb-4" size={32} />
                                    <h2 className="text-2xl font-bold mb-3">Restricted Area</h2>
                                    <p className="text-zinc-400">Administrator Credentials Required.</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="w-full bg-gradient-to-br from-violet-900/20 to-zinc-900 border border-violet-500/20 rounded-3xl p-10 mb-10 relative overflow-hidden backdrop-blur-xl">
                                    <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none text-white"><Coins size={180} /></div>
                                    <div className="relative z-10">
                                        <h2 className="text-sm font-medium text-violet-300 mb-3 tracking-wide uppercase">Total Vault Balance</h2>
                                        <div className="flex items-baseline gap-3 mb-2">
                                            <span className="text-6xl font-bold text-white tracking-tight">{balanceData ? Number(formatEther(balanceData.value)).toFixed(4) : '0.0000'}</span>
                                            <span className="text-2xl font-medium text-zinc-500">{balanceData?.symbol || 'ETH'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="bg-white/5 rounded-3xl border border-white/10 p-8 backdrop-blur-md">
                                        <div className="flex items-center gap-3 mb-8"><Shield className="text-blue-400" size={24} /> <h2 className="text-xl font-bold">Contract Status</h2></div>
                                        <div className="flex items-center justify-between mb-6 p-4 bg-black/20 rounded-2xl border border-white/5">
                                            <span className="text-zinc-400 text-sm font-medium">Current State</span>
                                            <div className={`flex items-center gap-2 font-bold px-3 py-1 rounded-lg ${isPaused ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                                                {isPaused ? 'PAUSED' : 'ACTIVE'}
                                            </div>
                                        </div>
                                        <button onClick={handlePauseToggle} className={`w-full py-4 rounded-xl font-bold transition-all ${isPaused ? 'bg-green-600' : 'bg-red-600'}`}>{isPaused ? 'Unpause' : 'Pause Emergency Stop'}</button>
                                    </div>

                                    <div className="bg-white/5 rounded-3xl border border-white/10 p-8 backdrop-blur-md">
                                        <div className="flex items-center gap-3 mb-8"><ArrowDownCircle className="text-orange-400" size={24} /> <h2 className="text-xl font-bold">Withdraw Funds</h2></div>
                                        <div className="space-y-6">
                                            <input type="text" placeholder="Recipient 0x..." value={withdrawAddress} onChange={(e) => setWithdrawAddress(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none" />
                                            <input type="number" placeholder="Amount" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none" />
                                            <div className="flex items-center gap-3"><input type="checkbox" checked={isERC20Withdraw} onChange={(e) => setIsERC20Withdraw(e.target.checked)} className="accent-violet-500" /> <span className="text-sm">Withdraw ERC20?</span></div>
                                            {isERC20Withdraw && <input type="text" placeholder="Token Address 0x..." value={withdrawTokenAddress} onChange={(e) => setWithdrawTokenAddress(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white outline-none" />}
                                            <button onClick={handleWithdraw} disabled={!withdrawAddress || !withdrawAmount} className="w-full py-4 rounded-xl bg-white text-black font-bold hover:bg-zinc-200 disabled:opacity-50">Withdraw</button>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                                    <div className="bg-white/5 rounded-3xl border border-white/10 p-8">
                                        <h2 className="text-xl font-bold mb-4">Configuration</h2>
                                        <div className="mb-4">Current Min: {minContribution ? formatEther(minContribution) : '...'} ETH</div>
                                        <input type="number" placeholder="New Min ETH" value={newMinContribution} onChange={(e) => setNewMinContribution(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 mb-4 text-white" />
                                        <button onClick={handleSetMin} className="w-full bg-violet-600 py-3 rounded-xl font-bold">Update Minimum</button>
                                    </div>

                                    <div className="bg-white/5 rounded-3xl border border-white/10 p-8">
                                        <h2 className="text-xl font-bold mb-4">ERC20 Allowlist</h2>
                                        <input type="text" placeholder="Token Address 0x..." value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 mb-4 text-white" />
                                        <div className="flex items-center gap-2 mb-4">
                                            <input type="checkbox" checked={tokenStatus} onChange={(e) => setTokenStatus(e.target.checked)} className="accent-pink-500" /> <span>Allowed?</span>
                                        </div>
                                        <button onClick={handleSetToken} className="w-full bg-pink-600 py-3 rounded-xl font-bold">Update Token Status</button>
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                )}

                {/* --- API API PLATFORM SECTION --- */}
                {activeTab === 'api' && (
                    <div className="space-y-6">
                        {/* Sub Navigation */}
                        {isAdmin && (
                            <div className="flex gap-6 border-b border-white/10 pb-4 mb-6">
                                <button onClick={() => setApiTab('keys')} className={`text-sm font-bold pb-4 -mb-4 border-b-2 transition-colors ${apiTab === 'keys' ? 'border-violet-500 text-white' : 'border-transparent text-zinc-500 hover:text-white'}`}>API Keys</button>
                                <button onClick={() => setApiTab('analytics')} className={`text-sm font-bold pb-4 -mb-4 border-b-2 transition-colors ${apiTab === 'analytics' ? 'border-violet-500 text-white' : 'border-transparent text-zinc-500 hover:text-white'}`}>Analytics</button>
                                <button onClick={() => setApiTab('sla')} className={`text-sm font-bold pb-4 -mb-4 border-b-2 transition-colors ${apiTab === 'sla' ? 'border-violet-500 text-white' : 'border-transparent text-zinc-500 hover:text-white'}`}>SLA & Performance</button>
                                <button onClick={() => setApiTab('audit')} className={`text-sm font-bold pb-4 -mb-4 border-b-2 transition-colors ${apiTab === 'audit' ? 'border-violet-500 text-white' : 'border-transparent text-zinc-500 hover:text-white'}`}>Audit Logs</button>
                            </div>
                        )}

                        {/* --- KEYS TAB --- */}
                        {apiTab === 'keys' && (
                            <>
                                {isAdmin && (
                                    <div className="flex justify-end mb-6">
                                        <button onClick={() => { setCreatedKey(null); setIsKeyModalOpen(true); }} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-violet-500/20 active:scale-95 transition-all">
                                            <Plus size={18} /> Issue New Key
                                        </button>
                                    </div>
                                )}

                                <div className="grid gap-4">
                                    {isLoadingData ? <Loader2 className="animate-spin text-zinc-500 mx-auto" /> : apiKeys.map((key) => (
                                        <div key={key.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                            <div>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="font-mono text-lg text-white font-bold tracking-tight">{key.prefix}•••••••••••••</div>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${key.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                                        {key.is_active ? 'Active' : 'Revoked'}
                                                    </span>
                                                    {key.abuse_flag && (
                                                        <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-600/20 text-red-500 border border-red-500/20">
                                                            <Ban size={10} /> BANNED
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-sm text-zinc-400 flex items-center gap-4">
                                                    <span className="flex items-center gap-1"><Globe size={12} /> {key.environment}</span>
                                                    <span className="flex items-center gap-1 bg-white/5 px-2 rounded text-xs text-zinc-300">{key.plan?.name || 'Free'} Plan</span>
                                                    <span className="text-zinc-500 text-xs">ID: {key.id}</span>
                                                </div>
                                            </div>
                                            {isAdmin && (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleUpdateKey(key.id, { abuseFlag: !key.abuse_flag })}
                                                        className={`p-2 rounded-lg border transition-colors ${key.abuse_flag ? 'border-red-500 text-red-400 hover:bg-red-500/10' : 'border-white/10 text-zinc-400 hover:text-white hover:bg-white/5'}`}
                                                        title="Toggle Abuse Flag"
                                                    >
                                                        <AlertCircle size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleUpdateKey(key.id, { isActive: !key.is_active })}
                                                        className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors border border-white/10"
                                                        title={key.is_active ? "Revoke Key" : "Activate Key"}
                                                    >
                                                        {key.is_active ? <Lock size={18} /> : <Unlock size={18} />}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {!isLoadingData && apiKeys.length === 0 && (
                                        <div className="text-center py-12 text-zinc-500">No API keys found.</div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* --- ANALYTICS TAB --- */}
                        {apiTab === 'analytics' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                                    <div className="text-zinc-400 text-sm font-bold mb-1">Requests (24h)</div>
                                    <div className="text-3xl font-bold text-white">{apiStats?.metrics?.requestsToday || 0}</div>
                                </div>
                                <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                                    <div className="text-zinc-400 text-sm font-bold mb-1">Active Keys</div>
                                    <div className="text-3xl font-bold text-emerald-400">{apiStats?.metrics?.activeKeys || 0}</div>
                                </div>
                                <div className="bg-white/5 border border-white/10 p-6 rounded-2xl col-span-full md:col-span-2">
                                    <h3 className="text-lg font-bold mb-4">Top Consumers (Month)</h3>
                                    <div className="space-y-3">
                                        {apiStats?.topKeys?.map((k: any, i: number) => (
                                            <div key={i} className="flex justify-between items-center bg-black/20 p-3 rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-mono text-xs bg-white/10 px-1.5 py-0.5 rounded">{k.api_keys?.prefix}...</span>
                                                    <span className="text-sm text-zinc-300">{k.api_keys?.owner_id}</span>
                                                </div>
                                                <div className="font-bold text-violet-400">{k.request_count.toLocaleString()} reqs</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --- SLA TAB --- */}
                        {apiTab === 'sla' && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white/5 border border-white/10 p-8 rounded-3xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-6 opacity-5"><Activity size={100} /></div>
                                    <h3 className="text-zinc-400 font-bold mb-2">P50 Latency</h3>
                                    <div className="text-4xl font-bold text-white">{apiStats?.sla?.p50_latency || 0}ms</div>
                                </div>
                                <div className="bg-white/5 border border-white/10 p-8 rounded-3xl relative overflow-hidden">
                                    <h3 className="text-zinc-400 font-bold mb-2">P95 Latency</h3>
                                    <div className="text-4xl font-bold text-yellow-400">{apiStats?.sla?.p95_latency || 0}ms</div>
                                </div>
                                <div className="bg-white/5 border border-white/10 p-8 rounded-3xl relative overflow-hidden">
                                    <h3 className="text-zinc-400 font-bold mb-2">Failure Rate</h3>
                                    <div className="text-4xl font-bold text-red-400">{apiStats?.sla?.failure_count || 0}</div>
                                    <p className="text-xs text-zinc-500 mt-2">Jobs failed in last 24h</p>
                                </div>
                            </div>
                        )}

                        {/* --- AUDIT TAB --- */}
                        {apiTab === 'audit' && (
                            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-white/5 text-zinc-400 text-xs uppercase tracking-wider">
                                        <tr>
                                            <th className="p-4">Time</th>
                                            <th className="p-4">Action</th>
                                            <th className="p-4">Target</th>
                                            <th className="p-4">Metadata</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-sm">
                                        {auditLogs.map((log) => (
                                            <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                                <td className="p-4 font-mono text-zinc-500">{new Date(log.created_at).toLocaleString()}</td>
                                                <td className="p-4 font-bold text-violet-300">{log.action}</td>
                                                <td className="p-4 font-mono text-xs">{log.target_id}</td>
                                                <td className="p-4 text-zinc-400 truncate max-w-xs">{JSON.stringify(log.metadata)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* --- END API SECTION --- */}

            </main>

            {/* API Key Modal */}
            <AnimatePresence>
                {isKeyModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#0a0a0a] border border-white/10 p-8 rounded-3xl w-full max-w-lg shadow-2xl relative">
                            <button onClick={() => setIsKeyModalOpen(false)} className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-white"><X size={20} /></button>

                            {!createdKey ? (
                                <>
                                    <h2 className="text-2xl font-bold mb-6">Issue API Key</h2>
                                    <form onSubmit={handleCreateKey} className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Owner ID (Wallet/Email)</label>
                                            <input value={keyFormData.ownerId} onChange={e => setKeyFormData({ ...keyFormData, ownerId: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none" placeholder="0x..." required />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Plan</label>
                                            <select value={keyFormData.planName} onChange={e => setKeyFormData({ ...keyFormData, planName: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none [&>option]:bg-zinc-900">
                                                <option value="Free">Free</option>
                                                <option value="Pro">Pro</option>
                                                <option value="Enterprise">Enterprise</option>
                                            </select>
                                        </div>
                                        <button type="submit" className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 rounded-xl mt-4">Generate Key</button>
                                    </form>
                                </>
                            ) : (
                                <div className="text-center">
                                    <div className="mb-4 bg-green-500/10 text-green-400 p-3 rounded-xl inline-flex items-center gap-2"><Check size={20} /> Key Generated Successfully</div>
                                    <p className="text-zinc-400 mb-4 text-sm">Copy this key now. You won't be able to see it again.</p>
                                    <div className="bg-black border border-white/10 p-4 rounded-xl font-mono text-lg break-all mb-6 relative group">
                                        {createdKey}
                                        <button onClick={() => navigator.clipboard.writeText(createdKey)} className="absolute top-2 right-2 p-2 bg-white/10 rounded hover:bg-white/20"><Copy size={14} /></button>
                                    </div>
                                    <button onClick={() => setIsKeyModalOpen(false)} className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl">Close</button>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

        </div>
    );
}