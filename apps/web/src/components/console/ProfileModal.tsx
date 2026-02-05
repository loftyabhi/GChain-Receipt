"use client";

import React, { useState } from 'react';
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

    if (!isOpen) return null;

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
                            <label className="block text-sm font-medium text-gray-400 mb-1">User ID</label>
                            <div className="p-3 bg-white/5 rounded-lg border border-white/10 font-mono text-sm text-gray-300 break-all">
                                {initialData?.id || 'Loading...'}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Wallet Address</label>
                            <div className="p-3 bg-white/5 rounded-lg border border-white/10 font-mono text-sm text-gray-300 break-all">
                                {initialData?.wallet_address || 'Loading...'}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
                            <div className="flex gap-2">
                                <div className="flex-1 p-3 bg-white/5 rounded-lg border border-white/10 text-sm text-gray-300">
                                    {initialData?.email || 'Not connected'}
                                </div>
                                {initialData?.email && (
                                    <div className={`px-3 py-1 flex items-center text-xs font-bold uppercase rounded border ${initialData.is_email_verified ? 'border-green-500/30 text-green-400 bg-green-500/10' : 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10'}`}>
                                        {initialData.is_email_verified ? 'Verified' : 'Pending'}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/5">
                        <button
                            onClick={onClose}
                            className="w-full py-3 bg-white text-black font-medium rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
