const withBundleAnalyzer = process.env.ANALYZE === 'true'
    ? require('@next/bundle-analyzer')({ enabled: true })
    : (config) => config;

const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '*.a-ads.com',
            },
            {
                protocol: 'https',
                hostname: '*.ad-maven.com', // Potential other provider
            },
        ],
    },
    env: {
        ADMIN_ADDRESS: process.env.ADMIN_ADDRESS,
    },
    async headers() {
        return [
            {
                // [Enterprise] Secure Defaults
                source: '/(.*)',
                headers: [
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'X-Frame-Options', value: 'SAMEORIGIN' }, // Relaxed from DENY to allow safe framing
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                ],
            },
            {
                // [Enterprise] Aggressive Caching for Static Assets (Images, fonts, vectors)
                source: '/:all*(svg|jpg|png|woff2)',
                headers: [
                    { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
                ],
            },
            {
                // [Enterprise] No Caching for dynamic user/auth routes or bare pages to prevent stale data
                source: '/((?!_next/static|_next/image|favicon.ico).*)',
                missing: [
                    { type: 'header', key: 'next-router-prefetch' },
                    { type: 'header', key: 'purpose', value: 'prefetch' },
                ],
                headers: [
                    { key: 'Cache-Control', value: 'private, no-cache, no-store, max-age=0, must-revalidate' },
                ],
            }
        ];
    },
};

export default withBundleAnalyzer(nextConfig);
