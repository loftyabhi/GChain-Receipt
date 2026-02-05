'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useBalance, useReadContracts, useSwitchChain, useChainId } from 'wagmi';
import { AdminLogin } from '../../components/AdminLogin';
import { Navbar } from '@/components/Navbar';
import EmailOpsPage from './email/page';
import axios from 'axios';
import { Trash2, Plus, Megaphone, Shield, Search, X, Loader2, Lock, Unlock, ArrowDownCircle, Settings, Coins, AlertTriangle, Key, BarChart3, Activity, FileText, Globe, Ban, AlertCircle, Copy, Check, ChevronRight, Mail, RefreshCw, ScrollText, ShieldCheck } from 'lucide-react';
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
    const [isAdmin, setIsAdmin] = useState(false);

    const [isLoadingAuth, setIsLoadingAuth] = useState(true);
    const [csrfToken, setCsrfToken] = useState('');
    const [hasHydrated, setHasHydrated] = useState(false);
    const [activeTab, setActiveTab] = useState<'ads' | 'vault' | 'contributions' | 'api' | 'users' | 'email' | 'verify'>('ads');
    const [apiTab, setApiTab] = useState<'keys' | 'analytics' | 'sla' | 'audit'>('keys');

    // Data States
    const [ads, setAds] = useState<any[]>([]);
    const [apiKeys, setApiKeys] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [apiStats, setApiStats] = useState<any>(null);
    const [contributions, setContributions] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [detailItem, setDetailItem] = useState<{ type: 'audit' | 'contribution' | 'apikey' | 'user' | 'logs', data: any } | null>(null);

    // Form States
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState<any>({});

    // API Key Form
    const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
    const [keyFormData, setKeyFormData] = useState({ ownerId: '', planName: 'Free' });
    const [createdKey, setCreatedKey] = useState<string | null>(null); // Show once

    // Verification Modal State
    const [verifModalOpen, setVerifModalOpen] = useState(false);
    const [verifTargetUser, setVerifTargetUser] = useState<any>(null);
    const [verifExpiry, setVerifExpiry] = useState<number>(15); // Minutes

    // Vault Form States
    const [withdrawAddress, setWithdrawAddress] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [isERC20Withdraw, setIsERC20Withdraw] = useState(false);
    const [withdrawTokenAddress, setWithdrawTokenAddress] = useState('');
    const [newMinContribution, setNewMinContribution] = useState('');
    const [tokenAddress, setTokenAddress] = useState('');
    const [tokenStatus, setTokenStatus] = useState(true);

    // Verification Tool State
    const [verifyBillId, setVerifyBillId] = useState('');
    const [verifyResult, setVerifyResult] = useState<any>(null);

    const handleVerifyReceipt = async (e: React.FormEvent) => {
        e.preventDefault();
        const toastId = toast.loading("Verifying integrity...");
        try {
            // Note: Verification route is PUBLIC usually, but we are in admin context. 
            // Assuming it is mounted at /api/v1/verify
            const res = await axios.post('/api/v1/verify/receipt', { billId: verifyBillId });
            setVerifyResult(res.data);
            toast.success("Verification complete", { id: toastId });
        } catch (err) {
            handleError(err);
            toast.dismiss(toastId);
        }
    };

    // Helper for error handling (hoisted)
    const handleError = (err: any) => {
        console.error(err);
        if (err.response?.status === 401) {
            // Only show "Session expired" if user was previously authenticated
            if (isAdmin) {
                toast.error("Session expired");
            }
            setIsAdmin(false);
        } else {
            toast.error("Operation failed");
        }
    };

    useEffect(() => {
        setHasHydrated(true);
        if (isConnected && address) {
            checkAuth();
        } else {
            // No wallet connected? Not an admin session.
            setIsAdmin(false);
            setIsLoadingAuth(false);
        }
    }, [isConnected, address]);

    // Initial hydration loading state
    useEffect(() => {
        if (hasHydrated && !isConnected) {
            setIsLoadingAuth(false);
        }
    }, [hasHydrated, isConnected]);

    const checkAuth = async () => {
        try {
            // Check session via proxy
            const res = await axios.get('/api/v1/admin/me');

            // SECURITY: The cookie might be valid for SOME admin wallet, 
            // but we MUST ensure it belongs to the CURRENTLY CONNECTED wallet.
            const sessionAddress = res.data.user?.address?.toLowerCase();
            const connectedAddress = address?.toLowerCase();

            if (!isConnected || !connectedAddress || sessionAddress !== connectedAddress) {
                // Address mismatch or wallet not connected -> Not an active admin session for THIS user
                setIsAdmin(false);
                return;
            }

            if (res.data.csrfToken) {
                setCsrfToken(res.data.csrfToken);
            }
            setIsAdmin(true);
        } catch (e) {
            setIsAdmin(false);
        } finally {
            setIsLoadingAuth(false);
        }
    };

    // Auto-Logout effect: If wallet disconnects while in dashboard, trigger cleanup
    useEffect(() => {
        if (hasHydrated && !isLoadingAuth && isAdmin && !isConnected) {
            handleLogout();
        }
    }, [isConnected, isAdmin, hasHydrated, isLoadingAuth]);

    const handleLogout = async () => {
        try {
            await axios.post('/api/v1/auth/logout');
        } catch (e) {
            console.error('Logout failed', e);
        } finally {
            window.location.href = '/';
        }
    };

    // Data Fetching Routing
    useEffect(() => {
        if (!isAdmin) return;

        if (activeTab === 'ads') fetchData();
        if (activeTab === 'contributions') fetchContributions();
        if (activeTab === 'users') fetchUsers();
        if (activeTab === 'api') {
            if (apiTab === 'keys') fetchApiKeys();
            if (apiTab === 'audit') fetchAuditLogs();
            if (apiTab === 'analytics' || apiTab === 'sla') fetchApiStats();
        }
    }, [isAdmin, activeTab, apiTab]);

    // --- API Platform Fetchers ---
    // --- API Platform Fetchers ---
    const fetchApiKeys = async () => {
        setIsLoadingData(true);
        try {
            const endpoint = `/api/v1/admin/keys`;
            const res = await axios.get(endpoint, { withCredentials: true });
            setApiKeys(res.data);
        } catch (err) { handleError(err); }
        finally { setIsLoadingData(false); }
    };

    const fetchAuditLogs = async () => {
        setIsLoadingData(true);
        try {
            const endpoint = `/api/v1/admin/audit`;
            const res = await axios.get(endpoint, { withCredentials: true });
            setAuditLogs(res.data);
        } catch (err) { handleError(err); }
        finally { setIsLoadingData(false); }
    };

    const fetchApiStats = async () => {
        setIsLoadingData(true);
        try {
            const endpoint = `/api/v1/admin/usage`;
            const res = await axios.get(endpoint, { withCredentials: true });
            setApiStats(res.data);
        } catch (err) { handleError(err); }
        finally { setIsLoadingData(false); }
    };

    const fetchUsers = async () => {
        setIsLoadingData(true);
        try {
            const endpoint = `/api/v1/admin/users`;
            const res = await axios.get(endpoint, { withCredentials: true });
            setUsers(res.data);
        } catch (err) { handleError(err); }
        finally { setIsLoadingData(false); }
    };

    const [syncTxHashInput, setSyncTxHashInput] = useState('');

    const [contribTab, setContribTab] = useState<'history' | 'pending'>('history');

    const fetchContributions = async () => {
        setIsLoadingData(true);
        try {
            const endpoint = contribTab === 'pending'
                ? '/api/v1/admin/contributions?status=pending'
                : '/api/v1/admin/contributions';

            const res = await axios.get(endpoint, { withCredentials: true });
            setContributions(res.data);
        } catch (err) { handleError(err); }
        finally { setIsLoadingData(false); }
    };

    // Refetch when sub-tab changes
    useEffect(() => {
        if (activeTab === 'contributions') {
            fetchContributions();
        }
    }, [contribTab]);

    // Invalidation State
    const [invModalOpen, setInvModalOpen] = useState(false);
    const [invReason, setInvReason] = useState('');
    const [invTargetId, setInvTargetId] = useState<string | null>(null);

    const handleSyncContribution = async () => {
        if (!syncTxHashInput) return;

        const toastId = toast.loading("Syncing transaction...");
        try {
            // UPDATED ENDPOINT
            const res = await axios.post('/api/v1/admin/contributions/sync', { txHash: syncTxHashInput }, { headers: { 'X-CSRF-Token': csrfToken } });

            if (res.data.status === 'confirmed') {
                toast.success("Transaction Synced!", { id: toastId });
                setSyncTxHashInput(''); // Clear input on success
                if (contribTab === 'history') fetchContributions();
            } else if (res.data.status === 'pending') {
                toast.info("Transaction Queued (Pending Confirmation)", { id: toastId });
                setSyncTxHashInput('');
                setContribTab('pending'); // Switch to pending view
            } else {
                toast.error(`Sync Failed: ${res.data.message}`, { id: toastId });
            }
        } catch (err) {
            handleError(err);
            toast.dismiss(toastId);
        }
    };

    const handleInvalidateClick = (id: string) => {
        setInvTargetId(id);
        setInvReason('');
        setInvModalOpen(true);
    };

    const confirmInvalidate = async () => {
        if (!invTargetId || !invReason) return;
        const toastId = toast.loading("Invalidating record...");
        try {
            await axios.post(`/api/v1/admin/contributions/${invTargetId}/invalidate`,
                { reason: invReason },
                { headers: { 'X-CSRF-Token': csrfToken } }
            );
            toast.success("Record invalidated", { id: toastId });
            setInvModalOpen(false);
            fetchContributions();
        } catch (err) {
            handleError(err);
            toast.dismiss(toastId);
        }
    };

    const handleOpenVerification = (user: any) => {
        setVerifTargetUser(user);
        setVerifExpiry(15); // Reset to default
        setVerifModalOpen(true);
    };

    const handleSendVerification = async () => {
        if (!verifTargetUser) return;
        const toastId = toast.loading("Sending email...");
        try {
            await axios.post(`/api/v1/admin/users/${verifTargetUser.id}/send-verification`, {
                expiryMinutes: Number(verifExpiry)
            }, { headers: { 'X-CSRF-Token': csrfToken } });

            toast.success("Verification email sent!", { id: toastId });
            setVerifModalOpen(false);
            fetchUsers(); // Refresh status
        } catch (err) {
            handleError(err);
            toast.dismiss(toastId);
        }
    };

    // --- Quota Management ---
    const [quotaModalOpen, setQuotaModalOpen] = useState(false);
    const [quotaUser, setQuotaUser] = useState<any>(null);
    const [quotaMonthly, setQuotaMonthly] = useState<number>(0);
    const [quotaOverride, setQuotaOverride] = useState<string>('');
    const [banReason, setBanReason] = useState('');

    const handleOpenQuota = (u: any) => {
        setQuotaUser(u);
        setQuotaMonthly(u.monthly_quota ?? 1000);
        setQuotaOverride(u.quota_override === null ? '' : u.quota_override.toString());
        setQuotaModalOpen(true);
    };

    const handleSaveQuota = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!quotaUser) return;
        const toastId = toast.loading("Updating quota...");
        try {
            const overrideVal = quotaOverride === '' ? null : Number(quotaOverride);
            await axios.put(`/api/v1/admin/users/${quotaUser.id}/quota`, {
                monthly_quota: Number(quotaMonthly),
                quota_override: overrideVal
            }, { headers: { 'X-CSRF-Token': csrfToken } });

            toast.success("Quota updated", { id: toastId });
            setQuotaModalOpen(false);
            fetchUsers();
        } catch (err) {
            handleError(err);
            toast.dismiss(toastId);
        }
    };

    const handleSuspendUser = async () => {
        if (!quotaUser) return;
        if (!confirm("Are you sure? This will block the user immediately.")) return;
        const toastId = toast.loading("Suspending user...");
        try {
            await axios.post(`/api/v1/admin/users/${quotaUser.id}/suspend`, {}, { headers: { 'X-CSRF-Token': csrfToken } });
            toast.success("User suspended (Quota = 0)", { id: toastId });
            setQuotaModalOpen(false);
            fetchUsers();
        } catch (err) { handleError(err); toast.dismiss(toastId); }
    };

    const handleRestoreQuota = async () => {
        if (!quotaUser) return;
        const toastId = toast.loading("Restoring defaults...");
        try {
            await axios.post(`/api/v1/admin/users/${quotaUser.id}/restore-quota`, {}, { headers: { 'X-CSRF-Token': csrfToken } });
            toast.success("Quota restored", { id: toastId });
            setQuotaModalOpen(false);
            fetchUsers();
        } catch (err) { handleError(err); toast.dismiss(toastId); }
    };

    const handleBanUser = async () => {
        if (!quotaUser || !banReason) return;
        if (!confirm("Confirm BAN? This user will be blocked immediately.")) return;
        const toastId = toast.loading("Banning user...");
        try {
            await axios.post(`/api/v1/admin/users/${quotaUser.id}/ban`, { reason: banReason }, { headers: { 'X-CSRF-Token': csrfToken } });
            toast.success("User BANNED", { id: toastId });
            setQuotaModalOpen(false);
            setBanReason('');
            fetchUsers();
        } catch (err) { handleError(err); toast.dismiss(toastId); }
    };

    const handleUnbanUser = async () => {
        if (!quotaUser) return;
        if (!confirm("Confirm UNBAN? Access will be restored.")) return;
        const toastId = toast.loading("Unbanning user...");
        try {
            await axios.post(`/api/v1/admin/users/${quotaUser.id}/unban`, {}, { headers: { 'X-CSRF-Token': csrfToken } });
            toast.success("User Active", { id: toastId });
            setQuotaModalOpen(false);
            fetchUsers();
        } catch (err) { handleError(err); toast.dismiss(toastId); }
    };

    // ... (Created Key handlers unchanged)

    const handleCreateKey = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await axios.post('/api/v1/admin/keys', keyFormData, { headers: { 'X-CSRF-Token': csrfToken } });
            setCreatedKey(res.data.key);
            fetchApiKeys();
            toast.success("API Key Generated");
        } catch (err) { handleError(err); }
    };

    const handleUpdateKey = async (id: string, updates: any) => {
        try {
            await axios.put(`/api/v1/admin/keys/${id}`, updates, { headers: { 'X-CSRF-Token': csrfToken } });
            toast.success("Key updated");
            fetchApiKeys();
        } catch (err) { handleError(err); }
    };

    const handleViewLogs = async (userId: string, userName: string) => {
        const toastId = toast.loading(`Fetching logs for ${userName}...`);
        try {
            const res = await axios.get(`/api/v1/admin/users/${userId}/logs`, { withCredentials: true });
            setDetailItem({
                type: 'logs',
                data: {
                    userName,
                    userId,
                    logs: res.data
                }
            });
            toast.dismiss(toastId);
        } catch (err) {
            handleError(err);
            toast.dismiss(toastId);
        }
    };

    // --- Original Ads Fetcher ---
    const fetchData = async () => {
        setIsLoadingData(true);
        try {
            const endpoint = `/api/v1/admin/ads`;
            const res = await axios.get(endpoint);
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
                        await axios.delete(`/api/v1/admin/ads/${id}`, { headers: { 'X-CSRF-Token': csrfToken } });
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
            await axios.post(`/api/v1/admin/ads`, payload, { headers: { 'X-CSRF-Token': csrfToken } });
            setIsFormOpen(false);
            setFormData({});
            fetchData();
            toast.success("Saved successfully!", { id: toastId });
        } catch (err) {
            toast.error("Save failed", { id: toastId });
            handleError(err);
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
        if (Number(withdrawAmount) < 0) {
            toast.error("Amount cannot be negative");
            return;
        }
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
        if (Number(newMinContribution) < 0) {
            toast.error("Amount cannot be negative");
            return;
        }
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
                await axios.post(`/api/v1/tokens`, payload, { headers: { 'X-CSRF-Token': csrfToken } });
                toast.success("Database synced successfully", { id: toastId });
            } catch (apiErr) {
                toast.error("On-chain success, but DB sync failed.", { id: toastId });
            }
        } catch (err) { }
    };

    // Prevent hydration mismatch
    if (!hasHydrated) return null;

    // Login Screen
    if (!isAdmin) {
        if (isLoadingAuth) {
            return (
                <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center font-sans">
                    <Loader2 className="animate-spin text-white" size={32} />
                </div>
            );
        }
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center font-sans">
                <div className="max-w-md w-full mx-4">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-xl">
                        <AdminLogin onLogin={() => { checkAuth(); }} />
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
                            <button onClick={() => setActiveTab('contributions')} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'contributions' ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
                                <Globe size={16} /> Contributions
                            </button>
                            <button onClick={() => setActiveTab('users')} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'users' ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
                                <Settings size={16} /> Users
                            </button>
                            <button onClick={() => setActiveTab('email')} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'email' ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
                                <Mail size={16} /> Mail Center
                            </button>
                            <button onClick={() => setActiveTab('verify')} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'verify' ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
                                <ShieldCheck size={16} /> Verify
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
                            {verifModalOpen && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#0a0a0a] border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl relative">
                                        <button onClick={() => setVerifModalOpen(false)} className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-white"><X size={20} /></button>
                                        <h2 className="text-2xl font-bold text-white mb-2">Verify Email</h2>
                                        <p className="text-zinc-400 text-sm mb-6">Send a verification link to <span className="text-white font-mono">{verifTargetUser?.email}</span>.</p>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Expiry Time</label>
                                                <select
                                                    value={verifExpiry}
                                                    onChange={(e) => setVerifExpiry(Number(e.target.value))}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white focus:border-violet-500 outline-none [&>option]:bg-zinc-900"
                                                >
                                                    <option value={15}>15 Minutes</option>
                                                    <option value={60}>1 Hour</option>
                                                    <option value={1440}>24 Hours</option>
                                                    <option value={10080}>7 Days</option>
                                                </select>
                                            </div>

                                            <div className="pt-2">
                                                <button onClick={handleSendVerification} className="w-full bg-violet-600 hover:bg-violet-500 text-white rounded-xl py-3 font-bold shadow-lg shadow-violet-500/20 transition-all">
                                                    Send Verification Link
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                </div>
                            )}
                        </AnimatePresence>
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
                                            <input type="number" placeholder="Amount" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none" min="0" />
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
                                        <input type="number" placeholder="New Min ETH" value={newMinContribution} onChange={(e) => setNewMinContribution(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 mb-4 text-white" min="0" />
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

                {/* --- EMAIL TAB --- */}
                {activeTab === 'email' && (
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-2 backdrop-blur-sm">
                        <EmailOpsPage />
                    </div>
                )}

                {/* --- CONTRIBUTIONS TAB --- */}
                {activeTab === 'contributions' && (
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-4">Manual Management</h2>
                                <div className="flex items-center gap-1 border-b border-white/10 w-fit">
                                    <button
                                        onClick={() => setContribTab('history')}
                                        className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${contribTab === 'history' ? 'border-violet-500 text-white' : 'border-transparent text-zinc-400 hover:text-white'}`}
                                    >
                                        History
                                    </button>
                                    <button
                                        onClick={() => setContribTab('pending')}
                                        className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${contribTab === 'pending' ? 'border-violet-500 text-white' : 'border-transparent text-zinc-400 hover:text-white'}`}
                                    >
                                        Pending
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                                <input
                                    type="text"
                                    placeholder="Paste Tx Hash (0x...)"
                                    value={syncTxHashInput}
                                    onChange={(e) => setSyncTxHashInput(e.target.value)}
                                    className="bg-transparent text-sm text-white px-3 py-2 outline-none w-64 placeholder:text-zinc-600 font-mono"
                                />
                                <button
                                    onClick={handleSyncContribution}
                                    disabled={!syncTxHashInput}
                                    className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:hover:bg-violet-600 text-white px-4 py-2 rounded-lg font-bold transition-all text-xs uppercase tracking-wide"
                                >
                                    <ArrowDownCircle size={14} /> Sync
                                </button>
                            </div>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md">
                            <table className="w-full text-left">
                                <thead className="bg-zinc-900/50 text-zinc-500 text-[10px] uppercase font-bold tracking-widest">
                                    <tr>
                                        <th className="p-5">Time/Added</th>
                                        <th className="p-5">Tx Hash</th>
                                        {contribTab === 'history' && <th className="p-5">Donor</th>}
                                        {contribTab === 'history' && <th className="p-5">Amount</th>}
                                        <th className="p-5">Status</th>
                                        <th className="p-5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-sm">
                                    {isLoadingData ? (
                                        <tr><td colSpan={6} className="p-10 text-center"><Loader2 className="animate-spin inline mr-2" /> Loading...</td></tr>
                                    ) : contributions.map((c) => (
                                        <tr key={c.id || c.tx_hash} onClick={() => setDetailItem({ type: 'contribution', data: c })} className="hover:bg-white/[0.02] transition-colors group cursor-pointer">
                                            <td className="p-5 text-zinc-400 font-medium">
                                                {new Date(c.block_timestamp || c.created_at).toLocaleDateString()}
                                                <div className="text-[10px] text-zinc-600">{new Date(c.block_timestamp || c.created_at).toLocaleTimeString()}</div>
                                            </td>
                                            <td className="p-5">
                                                <a href={`https://basescan.org/tx/${c.tx_hash}`} target="_blank" className="text-violet-400 hover:text-violet-300 flex items-center gap-1 font-mono">
                                                    {c.tx_hash.slice(0, 10)}... <Globe size={12} />
                                                </a>
                                            </td>
                                            {contribTab === 'history' && (
                                                <>
                                                    <td className="p-5">
                                                        <div className="font-mono text-zinc-300">{c.donor_address?.slice(0, 6)}...{c.donor_address?.slice(-4)}</div>
                                                        {c.is_anonymous && <span className="text-[10px] text-zinc-500 bg-white/5 px-1.5 rounded">Anonymous</span>}
                                                    </td>
                                                    <td className="p-5 font-bold text-white">{c.amount_wei ? Number(formatEther(BigInt(c.amount_wei))).toFixed(6) : '-'} ETH</td>
                                                </>
                                            )}
                                            <td className="p-5">
                                                {contribTab === 'history' ? (
                                                    c.is_valid === false ? (
                                                        <span className="text-xs bg-red-500/10 text-red-500 px-2 py-0.5 rounded border border-red-500/20 font-bold uppercase">Invalidated</span>
                                                    ) : (
                                                        <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded border border-green-500/20 font-bold uppercase">Confirmed</span>
                                                    )
                                                ) : c.status === 'failed' ? (
                                                    <span className="text-xs bg-red-500/10 text-red-500 px-2 py-0.5 rounded border border-red-500/20 font-bold uppercase" title={c.last_error}>Failed</span>
                                                ) : (
                                                    <span className="text-xs bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded border border-yellow-500/20 font-bold uppercase">Pending</span>
                                                )}
                                            </td>
                                            <td className="p-5 text-right">
                                                {contribTab === 'history' && c.is_valid !== false && (
                                                    <button onClick={() => handleInvalidateClick(c.id)} className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all" title="Invalidate Record">
                                                        <Ban size={16} />
                                                    </button>
                                                )}
                                                {c.status === 'failed' && (
                                                    <div className="text-[10px] text-red-400 max-w-[100px] truncate">{c.last_error || 'Unknown Error'}</div>
                                                )}
                                                <ChevronRight size={16} className="inline ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500" />
                                            </td>
                                        </tr>
                                    ))}
                                    {contributions.length === 0 && !isLoadingData && (
                                        <tr><td colSpan={6} className="p-10 text-center text-zinc-500">No records found for this view.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* --- USERS TAB --- */}
                {activeTab === 'users' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-white">Console Users</h2>
                            <button onClick={fetchUsers} className="p-2 text-zinc-400 hover:text-white transition-colors bg-white/5 rounded-lg border border-white/10">
                                <Activity size={18} />
                            </button>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md">
                            <table className="w-full text-left">
                                <thead className="bg-zinc-900/50 text-zinc-500 text-[10px] uppercase font-bold tracking-widest">
                                    <tr>
                                        <th className="p-5">User / Wallet</th>
                                        <th className="p-5">Email Status</th>
                                        <th className="p-5">Socials</th>
                                        <th className="p-5">Joined</th>
                                        <th className="p-5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-sm">
                                    {isLoadingData ? (
                                        <tr><td colSpan={5} className="p-10 text-center"><Loader2 className="animate-spin inline mr-2" /> Loading...</td></tr>
                                    ) : users.map((u) => (
                                        <tr key={u.id} onClick={() => setDetailItem({ type: 'user', data: u })} className="hover:bg-white/[0.02] transition-colors group cursor-pointer">
                                            <td className="p-5">
                                                <div className="font-bold text-white">{u.name || 'Anonymous User'}</div>
                                                <div className="font-mono text-xs text-zinc-500">{u.wallet_address?.slice(0, 8)}...{u.wallet_address?.slice(-6)}</div>
                                            </td>
                                            <td className="p-5">
                                                {u.email ? (
                                                    <div className="flex flex-col gap-1">
                                                        <div className="text-zinc-300">{u.email}</div>
                                                        <span className={`w-fit px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${u.is_email_verified ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                                                            {u.is_email_verified ? 'Verified' : 'Pending'}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-zinc-600 text-xs italic">No email</span>
                                                )}
                                            </td>
                                            <td className="p-5">
                                                <div className="flex gap-2">
                                                    {Object.keys(u.social_config || {}).map(s => (
                                                        <span key={s} className="bg-white/5 px-2 py-0.5 rounded text-[10px] text-zinc-400 capitalize">{s}</span>
                                                    ))}
                                                    {Object.keys(u.social_config || {}).length === 0 && <span className="text-zinc-600">-</span>}
                                                </div>
                                            </td>
                                            <td className="p-5 text-zinc-400">
                                                {new Date(u.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="p-5 text-right">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleOpenVerification(u); }}
                                                    className="p-2 text-zinc-500 hover:text-white bg-white/5 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-all mr-2"
                                                    title="Send Verification Email"
                                                >
                                                    <Mail size={16} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleOpenQuota(u); }}
                                                    className="p-2 text-zinc-500 hover:text-white bg-white/5 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-all mr-2"
                                                    title="Manage Quota"
                                                >
                                                    <Settings size={16} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setDetailItem({ type: 'user', data: u }); }}
                                                    className="p-2 text-zinc-500 hover:text-white bg-white/5 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-all"
                                                    title="View Details"
                                                >
                                                    <ArrowDownCircle size={16} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleViewLogs(u.id, u.name || u.email || 'User'); }}
                                                    className="p-2 text-zinc-500 hover:text-white bg-white/5 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-all ml-2"
                                                    title="View Activity Logs"
                                                >
                                                    <ScrollText size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {users.length === 0 && !isLoadingData && (
                                        <tr><td colSpan={5} className="p-10 text-center text-zinc-500">No users found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
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
                                        <div key={key.id} onClick={() => setDetailItem({ type: 'apikey', data: key })} className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer hover:bg-white/10 transition-colors group relative">
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
                                                    <span className="text-zinc-500 text-xs">ID: {key.id.slice(0, 8)}...</span>
                                                </div>
                                                <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity md:hidden">
                                                    <ChevronRight size={20} className="text-zinc-500" />
                                                </div>
                                            </div>
                                            {isAdmin && (
                                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
                                            <tr key={log.id} onClick={() => setDetailItem({ type: 'audit', data: log })} className="hover:bg-white/5 transition-colors cursor-pointer group">
                                                <td className="p-4 font-mono text-zinc-500">{new Date(log.created_at).toLocaleString()}</td>
                                                <td className="p-4 font-bold text-violet-300">{log.action}</td>
                                                <td className="p-4 font-mono text-xs">{log.target_id}</td>
                                                <td className="p-4 text-zinc-400 truncate max-w-xs group-hover:text-white">
                                                    <div className="flex items-center justify-between">
                                                        <span className="truncate">{JSON.stringify(log.metadata)}</span>
                                                        <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* --- VERIFY TAB --- */}
                {activeTab === 'verify' && (
                    <div className="max-w-xl mx-auto">
                        <div className="text-center mb-8">
                            <ShieldCheck size={48} className="mx-auto text-violet-500 mb-4" />
                            <h2 className="text-2xl font-bold text-white mb-2">Cryptographic Verification</h2>
                            <p className="text-zinc-400">Manually verify the integrity of any receipt generated by the system.</p>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-8 backdrop-blur-sm">
                            <form onSubmit={handleVerifyReceipt} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Bill ID (UUID)</label>
                                    <input
                                        type="text"
                                        value={verifyBillId}
                                        onChange={e => setVerifyBillId(e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white font-mono placeholder:text-zinc-600 focus:border-violet-500 outline-none transition-colors"
                                        placeholder="e.g. 550e8400-e29b..."
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-violet-500/20 transition-all active:scale-95"
                                >
                                    Verify Integrity
                                </button>
                            </form>
                        </div>

                        {verifyResult && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`rounded-3xl border p-8 ${verifyResult.valid ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                                <div className="flex items-center gap-4 mb-6">
                                    <div className={`p-3 rounded-full ${verifyResult.valid ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-500'}`}>
                                        {verifyResult.valid ? <Check size={24} /> : <AlertTriangle size={24} />}
                                    </div>
                                    <div>
                                        <h3 className={`text-xl font-bold ${verifyResult.valid ? 'text-green-400' : 'text-red-500'}`}>
                                            {verifyResult.valid ? 'Signature Valid' : 'Integrity Check Failed'}
                                        </h3>
                                        <p className="text-zinc-400 text-sm">Processed at {new Date(verifyResult.verified_at).toLocaleTimeString()}</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-zinc-500 uppercase mb-1">Algorithm</label>
                                        <div className="font-mono text-sm text-zinc-300 bg-black/20 px-3 py-2 rounded-lg border border-white/5">{verifyResult.algorithm}</div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-zinc-500 uppercase mb-1">Stored Hash (Database)</label>
                                        <div className="font-mono text-xs text-zinc-400 break-all bg-black/20 px-3 py-2 rounded-lg border border-white/5">{verifyResult.storedHash}</div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-zinc-500 uppercase mb-1">Computed Hash (Live Re-hash)</label>
                                        <div className={`font-mono text-xs break-all px-3 py-2 rounded-lg border ${verifyResult.valid ? 'text-green-400 border-green-500/20 bg-green-500/5' : 'text-red-400 border-red-500/20 bg-red-500/5'}`}>
                                            {verifyResult.computedHash}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>
                )}

            </main>

            {/* Quota Management Modal */}
            <AnimatePresence>
                {quotaModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#0a0a0a] border border-white/10 p-8 rounded-3xl w-full max-w-lg shadow-2xl relative">
                            <button onClick={() => setQuotaModalOpen(false)} className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-white"><X size={20} /></button>
                            <h2 className="text-2xl font-bold mb-6">Manage User</h2>

                            {/* Account Status Badge */}
                            <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10">
                                <div className="text-xs font-bold text-zinc-500 uppercase mb-1">Status</div>
                                <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${quotaUser?.account_status === 'banned' ? 'bg-red-500' : 'bg-green-500'}`} />
                                    <span className="text-lg font-mono">{quotaUser?.account_status?.toUpperCase() || 'ACTIVE'}</span>
                                    {quotaUser?.account_status === 'banned' && (
                                        <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded ml-2">
                                            {quotaUser?.ban_reason}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <form onSubmit={handleSaveQuota} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Monthly Quota</label>
                                    <input type="number" value={quotaMonthly} onChange={e => setQuotaMonthly(Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none" placeholder="1000" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Override (Optional)</label>
                                    <input type="number" value={quotaOverride} onChange={e => setQuotaOverride(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none" placeholder="No Override" />
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <button type="submit" className="flex-1 bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 rounded-xl">Save Quota</button>
                                    <button type="button" onClick={handleRestoreQuota} className="px-4 bg-white/5 hover:bg-white/10 text-zinc-400 font-bold py-3 rounded-xl" title="Restore Default">
                                        <RefreshCw size={18} />
                                    </button>
                                </div>
                            </form>

                            {/* Danger Zone */}
                            <div className="mt-8 pt-6 border-t border-white/10">
                                <h3 className="text-red-500 font-bold text-sm uppercase mb-4 flex items-center gap-2"><Ban size={16} /> Danger Zone</h3>

                                {quotaUser?.account_status === 'banned' ? (
                                    <button
                                        type="button"
                                        onClick={handleUnbanUser}
                                        className="w-full bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/50 font-bold py-3 rounded-xl transition-all"
                                    >
                                        Unban Account
                                    </button>
                                ) : (
                                    <div className="space-y-3">
                                        <input
                                            value={banReason}
                                            onChange={e => setBanReason(e.target.value)}
                                            placeholder="Reason for ban..."
                                            className="w-full bg-red-500/5 border border-red-500/20 rounded-xl p-3 text-red-200 placeholder:text-red-500/40 focus:border-red-500 outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleBanUser}
                                            className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-bold py-3 rounded-xl transition-all"
                                        >
                                            Ban Account
                                        </button>
                                        <div className="text-center">
                                            <button onClick={handleSuspendUser} className="text-xs text-zinc-500 hover:text-zinc-300 underline">Just suspend quota (soft block)</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

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

                {/* Invalidation Modal */}
                {invModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#0a0a0a] border border-red-500/20 p-8 rounded-3xl w-full max-w-md shadow-2xl relative">
                            <button onClick={() => setInvModalOpen(false)} className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-white"><X size={20} /></button>
                            <h2 className="text-2xl font-bold mb-4 text-red-500 flex items-center gap-2"><Ban size={24} /> Invalidate Record</h2>
                            <p className="text-zinc-400 mb-6 text-sm">This will mark the contribution as invalid but keep it in the secure ledger. Please provide a reason.</p>

                            <textarea
                                value={invReason}
                                onChange={(e) => setInvReason(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white resize-none h-32 mb-6 focus:border-red-500 outline-none"
                                placeholder="Reason for invalidation..."
                            />

                            <div className="flex gap-3">
                                <button onClick={() => setInvModalOpen(false)} className="flex-1 py-3 font-bold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl">Cancel</button>
                                <button onClick={confirmInvalidate} disabled={!invReason} className="flex-1 py-3 font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl disabled:opacity-50">Confirm</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Verification Modal */}
            <AnimatePresence>
                {verifModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#0a0a0a] border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl relative">
                            <button onClick={() => setVerifModalOpen(false)} className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-white"><X size={20} /></button>
                            <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2"><Mail size={24} className="text-violet-500" /> Send Verification</h2>

                            <div className="mb-6 bg-white/5 p-4 rounded-xl border border-white/10">
                                <div className="text-xs font-bold text-zinc-500 uppercase">User</div>
                                <div className="font-bold text-white">{verifTargetUser?.name || verifTargetUser?.email || 'Unknown User'}</div>
                                <div className="text-sm text-zinc-400">{verifTargetUser?.email}</div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Token Expiry (Minutes)</label>
                                    <input
                                        type="number"
                                        value={verifExpiry}
                                        onChange={e => setVerifExpiry(Number(e.target.value))}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white focus:border-violet-500 outline-none"
                                        min="1"
                                        max="1440"
                                        required
                                    />
                                    <p className="text-xs text-zinc-500 mt-2">Default is 15 minutes. Max is 24 hours.</p>
                                </div>

                                <button
                                    onClick={handleSendVerification}
                                    className="w-full rounded-xl bg-violet-600 py-3.5 text-sm font-bold text-white hover:bg-violet-500 shadow-lg shadow-violet-500/20 active:scale-95 transition-all"
                                >
                                    Send Email
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Quota Management Modal */}
            <AnimatePresence>
                {quotaModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-[#0a0a0a] border border-white/10 p-8 rounded-3xl w-full max-w-lg shadow-2xl relative max-h-[85vh] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-white/5 [&::-webkit-scrollbar-thumb]:bg-white/20 hover:[&::-webkit-scrollbar-thumb]:bg-white/30"
                        >
                            <button onClick={() => setQuotaModalOpen(false)} className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-white"><X size={20} /></button>
                            <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2"><Settings size={24} className="text-violet-500" /> Manage Quota</h2>

                            <div className="mb-6 bg-white/5 p-4 rounded-xl border border-white/10">
                                <div className="text-xs font-bold text-zinc-500 uppercase">User</div>
                                <div className="font-bold text-white text-lg">{quotaUser?.name || quotaUser?.email || 'Unknown User'}</div>
                                <div className="font-mono text-xs text-zinc-400">{quotaUser?.id}</div>
                            </div>

                            <form onSubmit={handleSaveQuota} className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Monthly Request Limit</label>
                                    <input type="number" value={quotaMonthly} onChange={e => setQuotaMonthly(Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white focus:border-violet-500 outline-none" min="0" required />
                                    <p className="text-xs text-zinc-500 mt-2">Standard monthly allocation.</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Quota Override (Optional)</label>
                                    <input type="number" value={quotaOverride} onChange={e => setQuotaOverride(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white focus:border-violet-500 outline-none" placeholder="Default (Inherit)" min="0" />
                                    <p className="text-xs text-zinc-500 mt-2">Set to 0 to suspend. Leave empty/null to use monthly limit.</p>
                                </div>

                                <div className="flex gap-3 pt-4 border-t border-white/10">
                                    <button type="button" onClick={handleSuspendUser} className="flex-1 py-3 px-4 rounded-xl bg-red-500/10 text-red-500 font-bold hover:bg-red-500/20 border border-red-500/20 transition-all text-sm">Suspend User</button>
                                    <button type="button" onClick={handleRestoreQuota} className="flex-1 py-3 px-4 rounded-xl bg-white/5 text-zinc-400 font-bold hover:text-white hover:bg-white/10 transition-all text-sm">Restore Default</button>
                                </div>

                                <button type="submit" className="w-full rounded-xl bg-violet-600 py-3.5 text-sm font-bold text-white hover:bg-violet-500 shadow-lg shadow-violet-500/20">Save Configuration</button>
                            </form>

                            {/* Danger Zone */}
                            <div className="mt-8 pt-6 border-t border-white/10">
                                <h3 className="text-red-500 font-bold text-sm uppercase mb-4 flex items-center gap-2"><Ban size={16} /> Danger Zone</h3>

                                {quotaUser?.account_status === 'banned' ? (
                                    <button
                                        type="button"
                                        onClick={handleUnbanUser}
                                        className="w-full bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/50 font-bold py-3 rounded-xl transition-all"
                                    >
                                        Unban Account
                                    </button>
                                ) : (
                                    <div className="space-y-3">
                                        <input
                                            value={banReason}
                                            onChange={e => setBanReason(e.target.value)}
                                            placeholder="Reason for ban..."
                                            className="w-full bg-red-500/5 border border-red-500/20 rounded-xl p-3 text-red-200 placeholder:text-red-500/40 focus:border-red-500 outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleBanUser}
                                            className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-bold py-3 rounded-xl transition-all"
                                        >
                                            Ban Account
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Generic Detail Slider */}
            <AnimatePresence>
                {detailItem && (
                    <>
                        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setDetailItem(null)} />
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-[#0a0a0a] border-l border-white/10 shadow-2xl flex flex-col"
                        >
                            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    {detailItem.type === 'audit' && <><FileText size={20} /> Audit Log Details</>}
                                    {detailItem.type === 'contribution' && <><Coins size={20} /> Contribution Details</>}
                                    {detailItem.type === 'apikey' && <><Key size={20} /> API Key Details</>}
                                    {detailItem.type === 'logs' && <><ScrollText size={20} /> User Activity Logs</>}
                                </h2>
                                <button onClick={() => setDetailItem(null)} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><X size={20} /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* LOGS VIEW */}
                                {detailItem.type === 'logs' && (
                                    <>
                                        <div className="mb-6 bg-white/5 p-4 rounded-xl border border-white/10">
                                            <div className="text-xs font-bold text-zinc-500 uppercase">User</div>
                                            <div className="font-bold text-white text-lg">{detailItem.data.userName}</div>
                                            <div className="font-mono text-xs text-zinc-400">{detailItem.data.userId}</div>
                                        </div>
                                        <div className="space-y-4">
                                            {detailItem.data.logs?.length === 0 ? (
                                                <div className="text-center text-zinc-500 py-8">No activity logs found.</div>
                                            ) : (
                                                detailItem.data.logs.map((log: any) => (
                                                    <div key={log.id} className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-start justify-between gap-4">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${log.status_code >= 400 ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-400'}`}>
                                                                    {log.method} {log.status_code}
                                                                </span>
                                                                <span className="text-xs text-zinc-400 font-mono">{new Date(log.created_at).toLocaleString()}</span>
                                                            </div>
                                                            <div className="text-sm font-mono text-zinc-300 break-all">{log.endpoint}</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-xs font-bold text-zinc-500">{log.duration_ms}ms</div>
                                                            <div className="text-[10px] text-zinc-600 font-mono">{log.ip_address}</div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </>
                                )}

                                {/* AUDIT LOG VIEW */}
                                {detailItem.type === 'audit' && (
                                    <>
                                        <div>
                                            <label className="text-xs font-bold text-zinc-500 uppercase">Timestamp</label>
                                            <div className="text-white font-mono">{new Date(detailItem.data.created_at).toLocaleString()}</div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-zinc-500 uppercase">Action</label>
                                            <div className="text-violet-400 font-bold text-lg">{detailItem.data.action}</div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-zinc-500 uppercase">Actor ID</label>
                                            <div className="text-zinc-300 font-mono text-sm break-all">{detailItem.data.actor_id}</div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-zinc-500 uppercase">Target ID</label>
                                            <div className="text-zinc-300 font-mono text-sm break-all">{detailItem.data.target_id}</div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Full Metadata</label>
                                            <pre className="bg-black border border-white/10 p-4 rounded-xl overflow-x-auto text-xs font-mono text-green-400 leading-relaxed whitespace-pre-wrap break-words">
                                                {JSON.stringify(detailItem.data.metadata, null, 2)}
                                            </pre>
                                        </div>
                                    </>
                                )}

                                {/* CONTRIBUTION VIEW */}
                                {detailItem.type === 'contribution' && (
                                    <>
                                        <div>
                                            <label className="text-xs font-bold text-zinc-500 uppercase">Status</label>
                                            <div className="mt-1">
                                                {detailItem.data.is_valid === false ? (
                                                    <span className="text-sm bg-red-500/10 text-red-500 px-3 py-1 rounded font-bold uppercase border border-red-500/20">Invalidated</span>
                                                ) : detailItem.data.status === 'failed' ? (
                                                    <span className="text-sm bg-red-500/10 text-red-500 px-3 py-1 rounded font-bold uppercase border border-red-500/20">Failed</span>
                                                ) : detailItem.data.status === 'confirmed' || detailItem.data.is_valid ? (
                                                    <span className="text-sm bg-green-500/10 text-green-400 px-3 py-1 rounded font-bold uppercase border border-green-500/20">Confirmed</span>
                                                ) : (
                                                    <span className="text-sm bg-yellow-500/10 text-yellow-400 px-3 py-1 rounded font-bold uppercase border border-yellow-500/20">Pending</span>
                                                )}
                                            </div>
                                        </div>

                                        {detailItem.data.status === 'failed' && (
                                            <div>
                                                <label className="text-xs font-bold text-red-500 uppercase">Failure Reason</label>
                                                <div className="text-red-400 font-mono text-sm border border-red-500/20 bg-red-500/5 p-3 rounded-lg mt-1">{detailItem.data.last_error || "Unknown Error"}</div>
                                            </div>
                                        )}

                                        {detailItem.data.is_valid === false && (
                                            <div>
                                                <label className="text-xs font-bold text-red-500 uppercase">Invalidation Reason</label>
                                                <div className="text-red-400 font-mono text-sm border border-red-500/20 bg-red-500/5 p-3 rounded-lg mt-1">
                                                    {detailItem.data.invalid_reason || "No reason provided"}
                                                    <div className="text-[10px] text-red-300/50 mt-1">Invalidated at: {new Date(detailItem.data.invalidated_at).toLocaleString()}</div>
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <label className="text-xs font-bold text-zinc-500 uppercase">Transaction Hash</label>
                                            <div className="flex items-center gap-2 mt-1">
                                                <code className="bg-black/30 px-2 py-1 rounded text-sm font-mono text-zinc-300 break-all">{detailItem.data.tx_hash}</code>
                                                <a href={`https://basescan.org/tx/${detailItem.data.tx_hash}`} target="_blank" className="p-1 hover:bg-white/10 rounded"><Globe size={14} className="text-violet-400" /></a>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-zinc-500 uppercase">Donor Address</label>
                                            <div className="flex items-center gap-2 mt-1">
                                                <code className="bg-black/30 px-2 py-1 rounded text-sm font-mono text-zinc-300 break-all">{detailItem.data.donor_address || detailItem.data.wallet_address || 'N/A'}</code>
                                            </div>
                                            {detailItem.data.is_anonymous && (
                                                <span className="inline-block mt-2 text-[10px] text-zinc-500 bg-white/5 px-2 py-0.5 rounded border border-white/5">Marked Anonymous</span>
                                            )}
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-zinc-500 uppercase">Amount</label>
                                            <div className="text-white text-xl font-bold font-mono mt-1">
                                                {detailItem.data.amount_wei ? Number(formatEther(BigInt(detailItem.data.amount_wei))).toFixed(6) : (detailItem.data.total_amount_wei ? Number(formatEther(BigInt(detailItem.data.total_amount_wei))).toFixed(6) : '0')} ETH
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Raw Data</label>
                                            <pre className="bg-black border border-white/10 p-4 rounded-xl overflow-x-auto text-xs font-mono text-zinc-400 leading-relaxed whitespace-pre-wrap break-words">
                                                {JSON.stringify(detailItem.data, null, 2)}
                                            </pre>
                                        </div>
                                    </>
                                )}

                                {/* API KEY VIEW */}
                                {detailItem.type === 'apikey' && (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <label className="text-xs font-bold text-zinc-500 uppercase">Status</label>
                                                <div className="mt-1">
                                                    <span className={`px-3 py-1 rounded text-sm font-bold uppercase tracking-wider ${detailItem.data.is_active ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                                        {detailItem.data.is_active ? 'Active' : 'Revoked'}
                                                    </span>
                                                </div>
                                            </div>
                                            {detailItem.data.abuse_flag && (
                                                <div className="text-right">
                                                    <label className="text-xs font-bold text-red-500 uppercase">Flag</label>
                                                    <div className="mt-1">
                                                        <span className="flex items-center gap-1 px-3 py-1 rounded text-sm font-bold uppercase tracking-wider bg-red-600/20 text-red-500 border border-red-500/20">
                                                            <Ban size={14} /> BANNED
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-zinc-500 uppercase">Key Prefix</label>
                                            <div className="text-white font-mono text-xl tracking-widest mt-1">{detailItem.data.prefix}•••••••••••••</div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-zinc-500 uppercase">Owner ID</label>
                                            <div className="bg-black/30 p-3 rounded-lg border border-white/5 font-mono text-zinc-300 break-all">{detailItem.data.owner_id || detailItem.data.user_id}</div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-zinc-500 uppercase">Key ID (Internal)</label>
                                            <div className="font-mono text-xs text-zinc-500 break-all">{detailItem.data.id}</div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-zinc-500 uppercase">Plan</label>
                                                <div className="text-white font-bold">{detailItem.data.plan?.name || 'Free'}</div>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-zinc-500 uppercase">Environment</label>
                                                <div className="text-white flex items-center gap-2"><Globe size={14} /> {detailItem.data.environment}</div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-zinc-500 uppercase">Created At</label>
                                            <div className="text-zinc-400">{new Date(detailItem.data.created_at).toLocaleString()}</div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Raw Data</label>
                                            <pre className="bg-black border border-white/10 p-4 rounded-xl overflow-x-auto text-xs font-mono text-zinc-400 leading-relaxed whitespace-pre-wrap break-words">
                                                {JSON.stringify(detailItem.data, null, 2)}
                                            </pre>
                                        </div>
                                    </>
                                )}

                                {/* USER VIEW */}
                                {detailItem.type === 'user' && (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <label className="text-xs font-bold text-zinc-500 uppercase">Verification Status</label>
                                                <div className="mt-1">
                                                    <span className={`px-3 py-1 rounded text-sm font-bold uppercase tracking-wider ${detailItem.data.is_email_verified ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>
                                                        {detailItem.data.is_email_verified ? 'Verified' : 'Pending Verification'}
                                                    </span>
                                                </div>
                                            </div>
                                            {!detailItem.data.is_email_verified && (
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            const res = await axios.post(`/api/v1/admin/users/${detailItem.data.id}/verify`, {}, { headers: { 'X-CSRF-Token': csrfToken } });
                                                            toast.success("User verified manually");
                                                            setDetailItem({ ...detailItem, data: res.data.user });
                                                            fetchUsers();
                                                        } catch (err) { handleError(err); }
                                                    }}
                                                    className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2"
                                                >
                                                    <Check size={14} /> Verify Manually
                                                </button>
                                            )}
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-zinc-500 uppercase">Wallet Address</label>
                                            <div className="bg-black/30 p-3 rounded-lg border border-white/5 font-mono text-zinc-300 break-all">{detailItem.data.wallet_address}</div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-zinc-500 uppercase">Name</label>
                                                <div className="text-white font-bold">{detailItem.data.name || 'Not set'}</div>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-zinc-500 uppercase">Email</label>
                                                <div className="text-white font-bold">{detailItem.data.email || 'Not set'}</div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Social Links</label>
                                            <div className="space-y-2">
                                                {Object.entries(detailItem.data.social_config || {}).map(([platform, link]: [string, any]) => (
                                                    <div key={platform} className="flex items-center justify-between bg-white/5 p-3 rounded-lg">
                                                        <span className="text-zinc-400 capitalize">{platform}</span>
                                                        <a href={link} target="_blank" className="text-blue-400 text-sm hover:underline">{link}</a>
                                                    </div>
                                                ))}
                                                {Object.keys(detailItem.data.social_config || {}).length === 0 && <div className="text-zinc-600 text-sm italic">No social links configured.</div>}
                                            </div>
                                        </div>

                                        <UserLogsView userId={detailItem.data.id} />

                                        <div>
                                            <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Raw Data</label>
                                            <pre className="bg-black border border-white/10 p-4 rounded-xl overflow-x-auto text-xs font-mono text-zinc-400 leading-relaxed whitespace-pre-wrap break-words">
                                                {JSON.stringify(detailItem.data, null, 2)}
                                            </pre>
                                        </div>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

        </div>
    );
}

// User Activity Logs Sub-Component
function UserLogsView({ userId }: { userId: string }) {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await axios.get(`/api/v1/admin/users/${userId}/logs`);
                setLogs(res.data);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetchLogs();
    }, [userId]);

    return (
        <div>
            <label className="text-xs font-bold text-zinc-500 uppercase mb-3 block">Activity History (API Usage)</label>
            <div className="bg-black/20 rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full text-left text-xs">
                    <thead className="bg-white/5 text-zinc-500 font-bold">
                        <tr>
                            <th className="p-3">Time</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">Endpoint</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {loading ? (
                            <tr><td colSpan={3} className="p-4 text-center"><Loader2 className="animate-spin inline-block" size={14} /></td></tr>
                        ) : logs.map((l, i) => (
                            <tr key={i} className="text-zinc-400">
                                <td className="p-3 font-mono">{new Date(l.created_at).toLocaleTimeString()}</td>
                                <td className="p-3">
                                    <span className={l.status_code < 400 ? 'text-green-500' : 'text-red-500'}>{l.status_code}</span>
                                </td>
                                <td className="p-3 truncate max-w-[150px]">{l.endpoint || '/check'}</td>
                            </tr>
                        ))}
                        {logs.length === 0 && !loading && <tr><td colSpan={3} className="p-4 text-center text-zinc-600 italic">No recent activity.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

