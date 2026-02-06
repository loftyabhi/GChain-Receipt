"use client";

import React, { useEffect, useState } from 'react';
import { useConsoleAuth } from '@/hooks/useConsoleAuth';
import { ConsoleLogin } from '@/components/console/ConsoleLogin';
import { KeyManager } from '@/components/console/KeyManager';
import { OverviewStats } from '@/components/console/OverviewStats';
import { DashboardLoader } from '@/components/console/DashboardLoader';
import { WebhookManager } from '@/components/console/WebhookManager';
import { UsageAnalytics } from '@/components/console/UsageAnalytics';
import { useAccount, useDisconnect } from 'wagmi';

import { toast } from 'sonner';
import { ProfileModal } from '@/components/console/ProfileModal';

export function DevelopersClient() {
    const { isAuthenticated, isLoading: isAuthLoading, token, logout } = useConsoleAuth();
    const { isConnected } = useAccount();
    const { disconnectAsync } = useDisconnect();

    const [activeTab, setActiveTab] = useState<'overview' | 'keys' | 'webhooks' | 'usage'>('overview');

    // Data State
    const [keys, setKeys] = useState<any[]>([]);
    const [usage, setUsage] = useState<any>({ logs_count: 0 });
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [showNewKey, setShowNewKey] = useState<string | null>(null);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    const [isSystemOperational, setIsSystemOperational] = useState(true);

    // ... (fetchData)
    const fetchData = React.useCallback(async () => {
        if (!token) return;
        setIsLoadingData(true);
        try {
            // Parallel Fetch
            const [keysRes, usageRes, meRes] = await Promise.all([
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/user/keys`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/user/usage`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/user/me`, { headers: { Authorization: `Bearer ${token}` } })
            ]);

            if (keysRes.ok) setKeys(await keysRes.json());
            if (usageRes.ok) setUsage(await usageRes.json());
            if (meRes.ok) setUserProfile(await meRes.json());

            setIsSystemOperational(keysRes.ok && usageRes.ok && meRes.ok);

        } catch (e) {
            console.error(e);
            toast.error('Failed to load dashboard data');
            setIsSystemOperational(false); // Assume outage if fetch fails
        } finally {
            setIsLoadingData(false);
        }
    }, [token]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchData();
        }
    }, [isAuthenticated, fetchData]);

    // Handle Create Key
    const handleCreateKey = async (name: string) => {
        if (!token) return;
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/user/keys`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to create key');
            }

            const newKeyData = await res.json();
            // Backend returns { apiKey: "..." }
            setShowNewKey(newKeyData.apiKey);
            toast.success('API Key created successfully');
            await fetchData();
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    // Handle Revoke
    const handleRevokeKey = async (id: string) => {
        if (!confirm('Are you sure you want to revoke this key? This cannot be undone.')) return;
        if (!token) return;

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/user/keys/${id}/revoke`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                toast.success('API Key revoked');
                await fetchData();
            } else {
                throw new Error('Revocation failed');
            }
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    // --- Aggregation Logic ---
    const activeKeys = keys.filter(k => k.is_active);

    // 1. Calculate Total Usage and Limit
    const totalUsage = activeKeys.reduce((acc, k) => acc + (k.usage_month || 0), 0);
    const totalLimit = activeKeys.reduce((acc, k) => acc + (k.quota_limit || k.plan?.monthly_quota || 0), 0);

    // 2. Determine Highest Plan
    const PLAN_PRIORITY: Record<string, number> = { 'Free': 0, 'Start-up': 5, 'Pro': 10, 'Enterprise': 20 };
    const highestPlanKey = activeKeys.sort((a, b) => {
        const pA = PLAN_PRIORITY[a.plan?.name || 'Free'] || 0;
        const pB = PLAN_PRIORITY[b.plan?.name || 'Free'] || 0;
        return pB - pA; // Descending
    })[0];

    const displayPlanName = activeKeys.length === 0 ? 'No Active Plan' : (highestPlanKey?.plan?.name || 'Free');

    // Fallback?
    // If no keys, limit is 0? Or user default? 
    // API returns effective quota in /me, but we calculate here from keys.
    // Let's stick to keys aggregation as requested "all active api keys total allowed".
    const displayLimit = activeKeys.length === 0 ? 0 : totalLimit;

    if (isAuthLoading) {
        return (
            <div className="min-h-screen bg-black text-white p-8">
                <div className="max-w-6xl mx-auto mt-20">
                    <DashboardLoader />
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <ConsoleLogin />;
    }

    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-6">
                    <div>
                        <h1 className="text-3xl font-bold">Developer Console</h1>
                        <p className="text-gray-400">Manage your seamless integration with TxProof Protocol</p>
                    </div>
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <button
                            onClick={() => setIsProfileOpen(true)}
                            className="flex-1 md:flex-none flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm transition-colors group"
                        >
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-xs font-bold uppercase">
                                {userProfile?.name?.charAt(0) || 'U'}
                            </div>
                            <span className="text-gray-200 group-hover:text-white">
                                {userProfile?.name || 'Profile'}
                            </span>
                        </button>
                        <button
                            onClick={async () => {
                                try {
                                    await disconnectAsync();
                                } catch (e) {
                                    console.error('Failed to disconnect wallet', e);
                                }
                                logout();
                            }}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-gray-300 transition-colors"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex overflow-x-auto gap-2 border-b border-white/10">
                    {(['overview', 'keys', 'webhooks', 'usage'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap capitalize ${activeTab === tab
                                ? 'border-blue-500 text-blue-400'
                                : 'border-transparent text-gray-400 hover:text-white hover:border-white/20'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="min-h-[400px]">
                    {activeTab === 'overview' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            <OverviewStats
                                usageData={{ logs_count: totalUsage }}
                                totalQuota={displayLimit}
                                billingTier={displayPlanName}
                                isSystemOperational={isSystemOperational}
                            />
                            {/* Documentation / Help */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/20">
                                    <h3 className="font-semibold text-blue-200 mb-2">Documentation</h3>
                                    <p className="text-sm text-gray-400 mb-4">Learn how to integrate the Receipt API into your dApp. Includes examples for React, Node, and Python.</p>
                                    <a href="/docs" className="text-sm text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1">
                                        Read Docs &rarr;
                                    </a>
                                </div>
                                <div className="p-6 rounded-2xl bg-gradient-to-br from-orange-900/20 to-red-900/20 border border-orange-500/20">
                                    <h3 className="font-semibold text-orange-200 mb-2">Need Enterprise Limits?</h3>
                                    <p className="text-sm text-gray-400 mb-4">Get custom rate limits, white-label PDF branding, and dedicated support.</p>
                                    <a href="/contact-us" className="text-sm text-orange-400 hover:text-orange-300 font-medium">
                                        Contact Sales
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'keys' && (
                        <div className="animate-in fade-in duration-300">
                            <KeyManager
                                keys={keys}
                                onCreate={handleCreateKey}
                                onRevoke={handleRevokeKey}
                                isLoading={isLoadingData}
                            />
                        </div>
                    )}

                    {activeTab === 'webhooks' && (
                        <div className="animate-in fade-in duration-300">
                            <WebhookManager token={token || ''} />
                        </div>
                    )}

                    {activeTab === 'usage' && (
                        <div className="animate-in fade-in duration-300">
                            <UsageAnalytics token={token || ''} />
                        </div>
                    )}
                </div>

                {/* New Key Modal (Simple Overlay) */}
                {showNewKey && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <div className="bg-[#111] border border-green-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl">
                            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mb-4 mx-auto text-green-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            </div>
                            <h2 className="text-xl font-bold text-center mb-2">API Key Created</h2>
                            <p className="text-gray-400 text-center text-sm mb-6">
                                Save this key now. It will never be shown again.
                            </p>

                            <div className="bg-black border border-white/10 rounded-lg p-4 mb-6 relative group">
                                <code className="break-all text-green-400 font-mono text-sm">{showNewKey}</code>
                                <button
                                    onClick={() => navigator.clipboard.writeText(showNewKey)}
                                    className="absolute right-2 top-2 p-2 bg-white/10 rounded hover:bg-white/20 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    Copy
                                </button>
                            </div>

                            <button
                                onClick={() => setShowNewKey(null)}
                                className="w-full py-3 bg-white text-black font-medium rounded-lg hover:bg-gray-200"
                            >
                                I have saved it
                            </button>
                        </div>
                    </div>
                )}

                <ProfileModal
                    isOpen={isProfileOpen}
                    onClose={() => setIsProfileOpen(false)}
                    token={token || ''}
                    initialData={userProfile}
                    onUpdate={fetchData}
                />
            </div>
        </div>
    );
}
