'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAccount } from 'wagmi';
import { toast } from 'sonner';
import { Loader2, Plus, Trash, Edit, Check, X, Layout, Monitor, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Ad {
    id: string;
    contentHtml: string;
    isActive: boolean;
    clickUrl?: string;
    placement: 'web' | 'pdf' | 'both';
}

export default function Dashboard() {
    const [ads, setAds] = useState<Ad[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [token, setToken] = useState<string | null>(null);

    // Edit/Create State
    const [isEditing, setIsEditing] = useState(false);
    const [currentAd, setCurrentAd] = useState<Partial<Ad>>({ placement: 'both', isActive: true });

    const { address, isConnected } = useAccount();
    const router = useRouter();

    useEffect(() => {
        // Check auth (simplified for restoration)
        const storedToken = localStorage.getItem('auth_token'); // Assuming this storage key
        if (storedToken) {
            setToken(storedToken);
            setIsAdmin(true); // Ideally verify with backend
        } else {
            // Just for safety, if no token, maybe redirect or show login? 
            // For now, let's assume if they are here they might have access or the API will fail.
        }
    }, []);

    useEffect(() => {
        if (token) fetchAds();
    }, [token]);

    const fetchAds = async () => {
        setIsLoading(true);
        try {
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/ads`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAds(res.data);
        } catch (err) {
            console.error(err);
            toast.error('Failed to fetch ads');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!currentAd.contentHtml) return toast.error('HTML Content is required');

        try {
            await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/ads`, currentAd, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Ad saved successfully');
            setCurrentAd({ placement: 'both', isActive: true });
            setIsEditing(false);
            fetchAds();
        } catch (err) {
            toast.error('Failed to save ad');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure?')) return;
        try {
            await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/ads/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Ad deleted');
            fetchAds();
        } catch (err) {
            toast.error('Failed to delete ad');
        }
    };

    if (!isAdmin && !isLoading) {
        // Fallback Login UI if needed, or simple access denied
        return <div className="min-h-screen flex items-center justify-center text-white">Access Denied. Please Login.</div>;
    }

    return (
        <div className="min-h-screen bg-neutral-900 text-white p-8 pt-24">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
                        Ad Manager
                    </h1>
                    <button
                        onClick={() => { setIsEditing(true); setCurrentAd({ placement: 'both', isActive: true }); }}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
                    >
                        <Plus size={18} />
                        New Ad
                    </button>
                </div>

                {isEditing && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
                        <div className="bg-neutral-800 p-8 rounded-xl w-full max-w-2xl border border-neutral-700 shadow-2xl">
                            <h2 className="text-2xl font-bold mb-6">
                                {currentAd.id ? 'Edit Ad' : 'Create Ad'}
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-neutral-400 mb-1">HTML Content</label>
                                    <textarea
                                        value={currentAd.contentHtml || ''}
                                        onChange={e => setCurrentAd({ ...currentAd, contentHtml: e.target.value })}
                                        className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-sm font-mono h-32 focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="<div>Your Ad Here</div>"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-neutral-400 mb-1">Click URL (Optional)</label>
                                    <input
                                        type="text"
                                        value={currentAd.clickUrl || ''}
                                        onChange={e => setCurrentAd({ ...currentAd, clickUrl: e.target.value })}
                                        className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 outline-none"
                                        placeholder="https://example.com"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-neutral-400 mb-1">Placement</label>
                                        <select
                                            value={currentAd.placement}
                                            onChange={e => setCurrentAd({ ...currentAd, placement: e.target.value as any })}
                                            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 outline-none"
                                        >
                                            <option value="both">Both</option>
                                            <option value="web">Web Only</option>
                                            <option value="pdf">PDF Only</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center pt-6">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={currentAd.isActive}
                                                onChange={e => setCurrentAd({ ...currentAd, isActive: e.target.checked })}
                                                className="w-5 h-5 accent-blue-500"
                                            />
                                            <span>Active</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-8">
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="px-4 py-2 hover:bg-neutral-700 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isLoading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={40} /></div>
                ) : ads.length === 0 ? (
                    <div className="text-center py-20 text-neutral-500 border border-dashed border-neutral-800 rounded-xl">
                        No active ads found. Create one!
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {ads.map(ad => (
                            <div key={ad.id} className="bg-neutral-800/50 border border-neutral-700/50 p-6 rounded-xl flex items-center justify-between group hover:border-blue-500/30 transition-all">
                                <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-lg ${ad.isActive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                        {ad.placement === 'pdf' ? <FileText size={24} /> : ad.placement === 'web' ? <Monitor size={24} /> : <Layout size={24} />}
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-lg flex items-center gap-2">
                                            Ad #{ad.id}
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${ad.isActive ? 'bg-green-500/20 text-green-400' : 'bg-neutral-700 text-neutral-400'}`}>
                                                {ad.isActive ? 'Active' : 'Draft'}
                                            </span>
                                        </h3>
                                        <div className="text-neutral-400 text-sm mt-1 max-w-xl truncate font-mono">
                                            {ad.contentHtml}
                                        </div>
                                        <div className="text-xs text-neutral-500 mt-2 flex gap-4">
                                            <span>Placement: <strong className="text-neutral-300 capitalize">{ad.placement}</strong></span>
                                            {ad.clickUrl && <span>URL: <a href={ad.clickUrl} target="_blank" className="text-blue-400 hover:underline">{ad.clickUrl}</a></span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => { setCurrentAd(ad); setIsEditing(true); }}
                                        className="p-2 hover:bg-neutral-700 rounded-lg text-neutral-300 hover:text-white"
                                        title="Edit"
                                    >
                                        <Edit size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(ad.id)}
                                        className="p-2 hover:bg-red-500/10 rounded-lg text-neutral-500 hover:text-red-400"
                                        title="Delete"
                                    >
                                        <Trash size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
