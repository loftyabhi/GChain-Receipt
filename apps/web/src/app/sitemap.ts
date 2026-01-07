import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = 'https://chainreceipt.vercel.app';

    // core pages
    // Priority map
    const legalPages = ['/privacy-policy', '/terms-of-service', '/disclaimer'];

    const routes = [
        '',
        '/how-to-read-blockchain-transaction',
        '/transaction-intelligence',
        '/features',
        '/about-us',
        '/contact-us',
        '/support',
        ...legalPages,
    ].map((route) => {
        let priority = 0.8;
        if (route === '') priority = 1;
        else if (legalPages.includes(route)) priority = 0.6;

        return {
            url: `${baseUrl}${route}`,
            lastModified: new Date().toISOString(),
            changeFrequency: 'weekly' as const,
            priority,
        };
    });

    return routes;
}
