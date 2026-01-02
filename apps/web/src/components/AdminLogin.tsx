'use client';

import { useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import axios from 'axios';
import { motion } from 'framer-motion';
import { ShieldCheck, Ban, AlertCircle, Loader2, ChevronRight } from 'lucide-react';

interface AdminLoginProps {
    onLogin: (token: string) => void;
}

export function AdminLogin({ onLogin }: AdminLoginProps) {
    const { address, isConnected } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async () => {
        if (!address) return;
        setIsLoading(true);
        setError('');

        try {
            // 1. Get Nonce (Simulated for this MVP, normally fetch from backend)
            const nonce = `Sign this message to login to Chain Receipt Manager.\nNonce: ${Date.now()}`;

            // 2. Sign Message
            const signature = await signMessageAsync({ message: nonce });

            // 3. Verify on Backend
            const res = await axios.post('http://localhost:3001/api/v1/auth/login', {
                address,
                signature,
                nonce
            });

            // 4. Save Token
            localStorage.setItem('admin_token', res.data.token);
            onLogin(res.data.token);

        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.error || 'Login failed. Are you the admin?');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="mb-4 text-4xl">🔐</div>
                <h2 className="mb-2 text-2xl font-bold text-white">Admin Access</h2>
                <p className="text-gray-400">Please connect your wallet to continue.</p>
            </div>
        );
    }

    const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS;
    const isAuthorized = address && ADMIN_ADDRESS && address.toLowerCase() === ADMIN_ADDRESS.toLowerCase();

    return (
        <div className="flex min-h-[50vh] w-full items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-black/40 p-8 backdrop-blur-2xl shadow-2xl shadow-violet-500/10"
            >
                {/* Decor elements */}
                <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-violet-500/20 blur-3xl" />
                <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />

                <div className="relative z-10 flex flex-col items-center text-center">
                    <motion.div
                        initial={{ y: -10 }}
                        animate={{ y: 0 }}
                        className={`mb-6 flex h-20 w-20 items-center justify-center rounded-2xl ${isAuthorized ? 'bg-gradient-to-br from-violet-500/20 to-indigo-500/20 text-violet-400 ring-1 ring-violet-500/30' : 'bg-red-500/10 text-red-400 ring-1 ring-red-500/30'}`}
                    >
                        {isAuthorized ? (
                            <ShieldCheck className="h-10 w-10 drop-shadow-[0_0_10px_rgba(167,139,250,0.5)]" />
                        ) : (
                            <Ban className="h-10 w-10" />
                        )}
                    </motion.div>

                    <h2 className="mb-2 text-3xl font-bold text-white tracking-tight">
                        Admin Dashboard
                    </h2>

                    <div className="mb-8 flex items-center justify-center gap-2 rounded-full border border-white/5 bg-white/5 px-4 py-1.5 backdrop-blur-md">
                        <div className={`h-2 w-2 rounded-full ${isAuthorized ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                        <p className="font-mono text-xs text-slate-300">
                            {address?.slice(0, 6)}...{address?.slice(-4)}
                        </p>
                    </div>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mb-6 w-full rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200"
                        >
                            <div className="flex items-center gap-2">
                                <AlertCircle size={16} />
                                <span>{error}</span>
                            </div>
                        </motion.div>
                    )}

                    {isAuthorized ? (
                        <button
                            onClick={handleLogin}
                            disabled={isLoading}
                            className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 p-[1px] shadow-lg shadow-violet-500/25 transition-all hover:shadow-violet-500/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none"
                        >
                            <div className="relative flex items-center justify-center gap-2 rounded-[11px] bg-[#0B0F19]/40 px-6 py-3.5 transition-all group-hover:bg-transparent">
                                {isLoading ? (
                                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                                ) : (
                                    <>
                                        <span className="font-bold text-white">Secure Sign In</span>
                                        <ChevronRight className="h-4 w-4 text-white/70 transition-transform group-hover:translate-x-1" />
                                    </>
                                )}
                            </div>
                        </button>
                    ) : (
                        <div className="w-full rounded-xl border border-red-500/20 bg-red-950/20 p-6 backdrop-blur-md">
                            <h3 className="mb-2 font-bold text-red-400">Access Restricted</h3>
                            <p className="mb-4 text-sm text-red-200/70">
                                This wallet is not authorized to access the admin verification panel.
                            </p>
                            <div className="text-[10px] text-red-200/30 font-mono break-all uppercase tracking-wider">
                                Required: {ADMIN_ADDRESS || 'ERR_NO_CONFIG'}
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
