'use client';

import { useState, useEffect } from 'react';

export function ConsentBanner() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Check local storage for consent decision
        const consent = localStorage.getItem('cookie_consent');
        if (!consent) {
            // Show only if no decision made (default: no tracking)
            setIsVisible(true);
        } else if (consent === 'granted') {
            // Re-apply granted consent on subsequent page loads
            updateGtagConsent('granted');
        }
        // If denied, we do nothing (default was already 'denied' in layout)
    }, []);

    const updateGtagConsent = (status: 'granted' | 'denied') => {
        if (typeof window !== 'undefined' && (window as any).gtag) {
            (window as any).gtag('consent', 'update', {
                'analytics_storage': status,
                'ad_storage': status, // We don't use ads, but keeps signals consistent
                'ad_user_data': status,
                'ad_personalization': status
            });
        }
    };

    const handleAccept = () => {
        localStorage.setItem('cookie_consent', 'granted');
        updateGtagConsent('granted');
        setIsVisible(false);
    };

    const handleDecline = () => {
        localStorage.setItem('cookie_consent', 'denied');
        // No need to update gtag, defaults are already 'denied'
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[100] border-t border-white/10 bg-[#0F0F11]/95 px-6 py-4 backdrop-blur-md shadow-2xl">
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
                <div className="text-sm text-zinc-400">
                    <p className="font-medium text-white mb-1">Privacy-first analytics</p>
                    <p>
                        We use anonymous analytics to improve Chain Receipt. No wallets, no transactions, no personal data.
                    </p>
                </div>
                <div className="flex gap-3 shrink-0">
                    <button
                        onClick={handleDecline}
                        className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-white/10 transition-colors"
                    >
                        Continue without analytics
                    </button>
                    <button
                        onClick={handleAccept}
                        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 shadow-lg shadow-violet-600/20 transition-all"
                    >
                        Accept analytics
                    </button>
                </div>
            </div>
        </div>
    );
}
