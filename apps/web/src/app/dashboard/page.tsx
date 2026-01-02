'use client';

import { useState, useEffect } from 'react';
import { AdminLogin } from '../../components/AdminLogin';
import { Navbar } from '@/components/Navbar';
import axios from 'axios';
import { Trash2, Plus, LayoutDashboard, Megaphone, Zap, Shield, Search, ChevronRight, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function DashboardPage() {
    const [token, setToken] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'plans' | 'ads'>('plans');

    // Data State
    const [plans, setPlans] = useState<any[]>([]);
    const [ads, setAds] = useState<any[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);

    // Form State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState<any>({});

    useEffect(() => {
        const storedToken = localStorage.getItem('admin_token');
        if (storedToken) setToken(storedToken);
    }, []);

    useEffect(() => {
        if (token) {
            fetchData();
        }
    }, [token, activeTab]);

    const fetchData = async () => {
        setIsLoadingData(true);
        try {
            const endpoint = activeTab === 'plans' ? 'http://localhost:3001/api/v1/admin/plans' : 'http://localhost:3001/api/v1/admin/ads';
            const res = await axios.get(endpoint, { headers: { Authorization: `Bearer ${token}` } });
            if (activeTab === 'plans') setPlans(res.data);
            else setAds(res.data);
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
        // Replacement for native confirm()
        toast("Delete this item?", {
            action: {
                label: 'Confirm Delete',
                onClick: async () => {
                    try {
                        await axios.delete(`http://localhost:3001/api/v1/admin/${activeTab}/${id}`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        toast.success(`${activeTab === 'plans' ? 'Plan' : 'Ad'} deleted successfully`);
                        fetchData();
                    } catch (err) {
                        toast.error("Delete failed");
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
            // Basic ID generation due to lack of backend ID gen for this demo
            const payload = { ...formData, id: formData.id || Date.now().toString() };

            await axios.post(`http://localhost:3001/api/v1/admin/${activeTab}`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsFormOpen(false);
            setFormData({});
            fetchData();
            toast.success("Saved successfully!", { id: toastId });
        } catch (err) {
            toast.error("Save failed. Check console.", { id: toastId });
        }
    };

    if (!token) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center font-sans">
                {/* A bit of polish for the login wrapper too, though AdminLogin is a separate component */}
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
                        <p className="text-zinc-400">Configure enterprise billing tiers and ad placement.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <a
                            href="/dashboard/admin"
                            className="group flex items-center gap-2 bg-white/5 border border-white/10 hover:border-violet-500/30 text-zinc-300 hover:text-white px-5 py-2.5 rounded-xl transition-all hover:bg-white/10"
                        >
                            <Shield size={18} />
                            <span className="font-medium">Vault Admin</span>
                            <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
                        </a>
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

                {/* Controls */}
                <div className="flex sm:items-center justify-between flex-col sm:flex-row gap-4 mb-8">
                    {/* Data Tabs */}
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 w-fit backdrop-blur-md">
                        <button
                            onClick={() => setActiveTab('plans')}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'plans'
                                ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25'
                                : 'text-zinc-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <Zap size={16} />
                            Plans
                        </button>
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
                    </div>

                    <button
                        onClick={() => { setFormData({}); setIsFormOpen(true); }}
                        className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-6 py-3 rounded-xl shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 transition-all font-bold active:scale-95"
                    >
                        <Plus size={18} />
                        Add {activeTab === 'plans' ? 'Plan' : 'Ad'}
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
                            {(activeTab === 'plans' ? plans : ads).map((item) => (
                                <motion.div
                                    layout
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    key={item.id}
                                    className="group bg-white/5 border border-white/10 hover:border-violet-500/30 p-8 rounded-3xl transition-all hover:bg-white/10 relative overflow-hidden backdrop-blur-sm"
                                >
                                    {/* Card Decor */}
                                    <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none">
                                        {activeTab === 'plans' ? <Zap size={100} /> : <Megaphone size={100} />}
                                    </div>

                                    <div className="flex justify-between items-start mb-6 relative z-10">
                                        <div className={`p-3 rounded-xl ${activeTab === 'plans' ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                            {activeTab === 'plans' ? <Zap size={24} /> : <Megaphone size={24} />}
                                        </div>
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>

                                    <div className="relative z-10">
                                        <h3 className="text-xl font-bold text-white mb-4 line-clamp-1">{item.title || item.id}</h3>

                                        {activeTab === 'plans' ? (
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between text-sm py-2 border-b border-white/5">
                                                    <span className="text-zinc-400">Price</span>
                                                    <span className="font-mono font-bold text-violet-300">{item.priceWei} WEI</span>
                                                </div>
                                                <div className="flex items-center justify-between text-sm py-2">
                                                    <span className="text-zinc-400">Validity</span>
                                                    <span className="font-mono font-bold text-zinc-300">{(item.validitySeconds / 86400).toFixed(1)} Days</span>
                                                </div>
                                            </div>
                                        ) : (
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
                                        )}
                                    </div>
                                </motion.div>
                            ))}

                            {(activeTab === 'plans' ? plans : ads).length === 0 && (
                                <div className="col-span-full flex flex-col items-center justify-center py-24 text-zinc-500 bg-white/5 rounded-3xl border border-dashed border-white/10">
                                    <div className="bg-white/5 p-4 rounded-full mb-4">
                                        <Search size={32} className="opacity-50" />
                                    </div>
                                    <p className="font-medium">No active billing plans configured.</p>
                                    <p className="text-sm opacity-60 mt-1">Create a new tier to get started.</p>
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
                                    {formData.id ? 'Edit' : 'New'} {activeTab === 'plans' ? 'Plan' : 'Ad'}
                                </h2>

                                <form onSubmit={handleSave} className="space-y-6">
                                    {activeTab === 'plans' ? (
                                        <>
                                            <div>
                                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 pl-1">Plan ID</label>
                                                <input
                                                    value={formData.id || ''}
                                                    onChange={e => setFormData({ ...formData, id: e.target.value })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-all placeholder:text-zinc-700 font-mono text-sm"
                                                    placeholder="e.g. basic_plan"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 pl-1">Title</label>
                                                <input
                                                    value={formData.title || ''}
                                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-all"
                                                    placeholder="Display Name"
                                                    required
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 pl-1">Price (Wei)</label>
                                                    <input
                                                        type="number"
                                                        value={formData.priceWei || ''}
                                                        onChange={e => setFormData({ ...formData, priceWei: e.target.value })}
                                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white focus:border-violet-500 outline-none transition-all"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 pl-1">Validity (Sec)</label>
                                                    <input
                                                        type="number"
                                                        value={formData.validitySeconds || ''}
                                                        onChange={e => setFormData({ ...formData, validitySeconds: Number(e.target.value) })}
                                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white focus:border-violet-500 outline-none transition-all"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/5">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.hasAds || false}
                                                    onChange={e => setFormData({ ...formData, hasAds: e.target.checked })}
                                                    className="w-5 h-5 accent-violet-500 rounded"
                                                />
                                                <span className="text-sm text-zinc-300">Show Ads with this Plan?</span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div>
                                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 pl-1">Ad ID</label>
                                                <input
                                                    value={formData.id || ''}
                                                    onChange={e => setFormData({ ...formData, id: e.target.value })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white focus:border-violet-500 outline-none transition-all font-mono text-sm"
                                                    placeholder="unique_ad_id"
                                                    required
                                                />
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
                                        </>
                                    )}

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
            </main>
        </div>
    );
}
