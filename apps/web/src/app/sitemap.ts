import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = 'https://chainreceipt.vercel.app'; // Replace with actual domain

    // core pages
    const routes = [
        '',
        '/how-to-read-blockchain-transaction',
        '/transaction-intelligence',
        '/features',
        '/about-us',
        '/contact-us',
        '/support',
        '/privacy-policy',
        '/terms-of-service',
        '/disclaimer',
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: route === '' ? 1 : 0.8,
    }));

    return routes;
}
