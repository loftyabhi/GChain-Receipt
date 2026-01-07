'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { trackEvent } from '@/lib/analytics';

export function ShareAttribution() {
    const searchParams = useSearchParams();
    const fired = useRef(false);

    useEffect(() => {
        // 1. Check if already fired this session (Privacy/spam prevention)
        if (fired.current || sessionStorage.getItem('share_attribution_fired')) {
            return;
        }

        // 2. Check Consent (Strict Privacy)
        // We double-check here, but trackEvent also checks internally.
        const consent = localStorage.getItem('cookie_consent');
        if (consent !== 'granted') return;

        // 3. Detect Source
        let shareSource = '';
        let entryType = 'direct';

        // A. UTM Check (Explicit & Normalized)
        const utmSource = searchParams.get('utm_source')?.toLowerCase();
        const KNOWN_SOURCES = ['twitter', 'linkedin', 'facebook', 'whatsapp', 'telegram', 'discord'];

        if (utmSource && KNOWN_SOURCES.includes(utmSource)) {
            shareSource = utmSource;
            entryType = 'shared_link';
        }
        // B. Referrer Check (Implicit)
        else if (document.referrer) {
            const ref = document.referrer.toLowerCase();

            if (ref.includes('t.co')) shareSource = 'twitter';
            else if (ref.includes('linkedin.com')) shareSource = 'linkedin';
            else if (ref.includes('facebook.com')) shareSource = 'facebook';
            else if (ref.includes('whatsapp.com')) shareSource = 'whatsapp';
            else if (ref.includes('telegram.org') || ref.includes('t.me') || ref.includes('telegram.me')) shareSource = 'telegram';
            else if (ref.includes('discord.com')) shareSource = 'discord';
            else {
                // Generic logic: strip protocol and path, keep domain
                try {
                    const url = new URL(ref);
                    shareSource = url.hostname.replace('www.', '');
                    entryType = 'referral'; // Generic referral
                } catch (e) {
                    shareSource = 'unknown_referrer';
                }
            }

            if (shareSource) {
                // Override entry type if we matched a known social platform
                if (['twitter', 'linkedin', 'facebook', 'whatsapp', 'telegram', 'discord'].includes(shareSource)) {
                    entryType = 'shared_link';
                }
            }
        }

        // 4. Fire Event (if source detected)
        if (shareSource) {
            trackEvent('page_shared_visit', {
                share_source: shareSource,
                entry_type: entryType
            });

            // 5. Mark session
            fired.current = true;
            sessionStorage.setItem('share_attribution_fired', 'true');
        }

    }, [searchParams]);

    return null;
}
