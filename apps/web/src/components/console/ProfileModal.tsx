"use client";

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    token: string;
    initialData: any;
    onUpdate: () => void;
}

export function ProfileModal({ isOpen, onClose, token, initialData, onUpdate }: ProfileModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [socials, setSocials] = useState({
        twitter: '',
        github: '',
        discord: '',
        telegram: ''
    });

    useEffect(() => {
        if (initialData?.email) setEmail(initialData.email || '');
        if (initialData?.name) setName(initialData.name || '');

        if (initialData?.social_config) {
            setSocials({
                twitter: initialData.social_config.twitter || '',
                github: initialData.social_config.github || '',
                discord: initialData.social_config.discord || '',
                telegram: initialData.social_config.telegram || ''
            });
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleUpdate = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/user/me`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    email,
                    name,
                    social_config: socials
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                // 409 Conflict logic is handled by standard error display, 
                // but user requested explicit toast behavior.
                // Our unified catch block handles toast.error(err.message)
                throw new Error(errorData.error || 'Failed to update profile');
            }

            toast.success('Profile updated successfully');
            onUpdate();
        } catch (err: any) {
            toast.error(err.message || 'Failed to update profile');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-6 border-b border-white/5">
                    <h2 className="text-xl font-bold text-white">Profile Settings</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter your name"
                                disabled={initialData?.is_email_verified}
                                className={`w-full p-3 bg-white/5 rounded-lg border border-white/10 font-mono text-sm break-all transition-colors
                                    ${initialData?.is_email_verified
                                        ? 'text-gray-400 cursor-not-allowed opacity-70'
                                        : 'text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                                    }`}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Wallet Address</label>
                            <div className="p-3 bg-white/5 rounded-lg border border-white/10 font-mono text-sm text-gray-300 break-all">
                                {initialData?.wallet_address || 'Loading...'}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
                            <div className="flex gap-2 mb-2">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your email"
                                    disabled={initialData?.is_email_verified}
                                    className={`flex-1 p-3 bg-white/5 rounded-lg border border-white/10 text-sm placeholder-gray-500 transition-colors
                                        ${initialData?.is_email_verified
                                            ? 'text-gray-400 cursor-not-allowed opacity-70'
                                            : 'text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                                        }`}
                                />
                                {initialData?.email && (
                                    <div className={`px-3 py-1 flex items-center text-xs font-bold uppercase rounded border ${initialData.is_email_verified ? 'border-green-500/30 text-green-400 bg-green-500/10' : 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10'}`}>
                                        {initialData.is_email_verified ? 'Verified' : 'Pending'}
                                    </div>
                                )}
                            </div>

                            {/* Marketing Opt-In */}
                            <div className="flex items-center space-x-3 mt-4 p-3 bg-white/5 rounded-lg border border-white/10">
                                <input
                                    id="marketing-opt-in"
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900"
                                    defaultChecked={initialData?.allow_promotional_emails}
                                    onChange={async (e) => {
                                        const checked = e.target.checked;
                                        try {
                                            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/user/me`, {
                                                method: 'PUT',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                    'Authorization': `Bearer ${token}`
                                                },
                                                body: JSON.stringify({ allow_promotional_emails: checked })
                                            });

                                            if (!res.ok) throw new Error('Failed to update');
                                            toast.success(checked ? 'Subscribed to updates' : 'Unsubscribed from updates');
                                            onUpdate();
                                        } catch (err) {
                                            toast.error('Failed to update preference');
                                            e.target.checked = !checked; // Revert
                                        }
                                    }}
                                />
                                <label htmlFor="marketing-opt-in" className="text-sm text-gray-300 cursor-pointer select-none">
                                    Receive product updates and marketing emails
                                </label>
                            </div>
                        </div>

                        {/* Social Links Section */}
                        <div className="pt-4 border-t border-white/5 space-y-4">
                            <h3 className="text-sm font-medium text-gray-400">Social Connections</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Twitter (X)</label>
                                    <div className="flex bg-white/5 rounded border border-white/10 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-colors">
                                        <span className="p-2 text-gray-500 text-sm border-r border-white/10 select-none">x.com/</span>
                                        <input
                                            type="text"
                                            value={socials.twitter.replace('https://x.com/', '').replace('https://twitter.com/', '')}
                                            onChange={(e) => setSocials({ ...socials, twitter: e.target.value })}
                                            placeholder="username"
                                            className="w-full p-2 bg-transparent text-sm text-white focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">GitHub</label>
                                    <div className="flex bg-white/5 rounded border border-white/10 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-colors">
                                        <span className="p-2 text-gray-500 text-sm border-r border-white/10 select-none">github.com/</span>
                                        <input
                                            type="text"
                                            value={socials.github.replace('https://github.com/', '')}
                                            onChange={(e) => setSocials({ ...socials, github: e.target.value })}
                                            placeholder="username"
                                            className="w-full p-2 bg-transparent text-sm text-white focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Discord</label>
                                    <input
                                        type="text"
                                        value={socials.discord}
                                        onChange={(e) => setSocials({ ...socials, discord: e.target.value })}
                                        placeholder="username (or user#0000)"
                                        className="w-full p-2 bg-white/5 rounded border border-white/10 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Telegram</label>
                                    <div className="flex bg-white/5 rounded border border-white/10 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-colors">
                                        <span className="p-2 text-gray-500 text-sm border-r border-white/10 select-none">t.me/</span>
                                        <input
                                            type="text"
                                            value={socials.telegram.replace('https://t.me/', '')}
                                            onChange={(e) => setSocials({ ...socials, telegram: e.target.value })}
                                            placeholder="username"
                                            className="w-full p-2 bg-transparent text-sm text-white focus:outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/5 flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 bg-transparent border border-white/10 text-white font-medium rounded-lg hover:bg-white/5 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleUpdate}
                            disabled={isLoading}
                            className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
