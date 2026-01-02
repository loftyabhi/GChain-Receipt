'use client';

import { Navbar } from '@/components/Navbar';
import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useBalance, useReadContracts } from 'wagmi';
import { formatEther, parseEther, erc20Abi, formatUnits } from 'viem';
import { Shield, AlertTriangle, Lock, Unlock, ArrowDownCircle, Settings, Coins, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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

export default function AdminDashboard() {
    const { address, isConnected } = useAccount();
    const [isAdmin, setIsAdmin] = useState(false);

    // Form States
    const [withdrawAddress, setWithdrawAddress] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [isERC20Withdraw, setIsERC20Withdraw] = useState(false);
    const [withdrawTokenAddress, setWithdrawTokenAddress] = useState('');

    const [newMinContribution, setNewMinContribution] = useState('');
    const [tokenAddress, setTokenAddress] = useState('');
    const [tokenStatus, setTokenStatus] = useState(true);

    const [hasHydrated, setHasHydrated] = useState(false);

    useEffect(() => {
        setHasHydrated(true);
        if (address && ADMIN_ADDRESS && address.toLowerCase() === ADMIN_ADDRESS.toLowerCase()) {
            setIsAdmin(true);
        } else {
            setIsAdmin(false);
        }
    }, [address]);

    // Read Contract State
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

    // Read Vault Balance (Native)
    const { data: balanceData, refetch: refetchBalance } = useBalance({
        address: VAULT_ADDRESS,
    });

    // Check specific token balance for Allowlist/Withdraw
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
            }
        ] : [],
    });

    const tokenBalance = tokenData?.[0]?.result;
    const tokenDecimals = tokenData?.[1]?.result;
    const tokenSymbol = tokenData?.[2]?.result;


    // Write Contract
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

    const handleSetToken = () => {
        if (!tokenAddress) return;
        wrapTx(writeContractAsync({
            address: VAULT_ADDRESS,
            abi: VAULT_ABI,
            functionName: 'setTokenStatus',
            args: [tokenAddress as `0x${string}`, tokenStatus],
        }), 'Updating Token Status');
    };

    if (!hasHydrated) return null;

    if (!isConnected || !isAdmin) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center font-sans">
                <div className="text-center p-8 bg-white/5 rounded-3xl border border-red-500/20 backdrop-blur-xl max-w-md mx-6">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                        <AlertTriangle className="text-red-500" size={32} />
                    </div>
                    <h1 className="text-2xl font-bold mb-3">Restricted Area</h1>
                    <p className="text-zinc-400">Administrator Credentials Required.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-purple-500/30 overflow-x-hidden">
            <Navbar />

            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] right-1/2 translate-x-1/2 w-[60%] h-[40%] rounded-full bg-violet-600/5 blur-[120px]" />
            </div>

            <main className="relative z-10 pt-32 pb-20 px-6 max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-10">
                    <div>
                        <h1 className="text-4xl font-bold flex items-center gap-3 mb-2">
                            Dashboard
                        </h1>
                        <p className="text-zinc-400">Manage Vault settings and funds.</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="px-4 py-1.5 bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-full text-xs font-mono font-medium">
                            {VAULT_ADDRESS ? `Vault: ${VAULT_ADDRESS.slice(0, 6)}...${VAULT_ADDRESS.slice(-4)}` : 'Vault Not Configured'}
                        </div>
                    </div>
                </div>

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

            </main>
        </div>
    );
}
