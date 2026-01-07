'use client';

import Script from 'next/script';

const GA_MEASUREMENT_ID = 'G-YTN902WXJS';

export function GoogleAnalytics() {
    return (
        <>
            <Script
                strategy="afterInteractive"
                src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            />
            <Script
                id="google-analytics"
                strategy="afterInteractive"
                dangerouslySetInnerHTML={{
                    __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            
            // 1. Consent Mode v2 Defaults (MUST be called before config)
            gtag('consent', 'default', {
              'ad_storage': 'denied',
              'analytics_storage': 'denied',
              'ad_user_data': 'denied',
              'ad_personalization': 'denied',
              'wait_for_update': 500
            });

            gtag('js', new Date());

            // Sanitize URL (never send tx hashes)
            const cleanPath = window.location.pathname.replace(/0x[a-fA-F0-9]{10,}/g, '[REDACTED]');
            
            gtag('config', '${GA_MEASUREMENT_ID}', {
              page_path: cleanPath,
              page_location: window.location.origin + cleanPath,
              anonymize_ip: true,
              allow_ad_personalization_signals: false,
              send_page_view: false
            });
          `,
                }}
            />
        </>
    );
}
