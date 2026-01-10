import { MetadataRoute } from 'next';

const BASE_URL = 'https://chainreceipt.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
    const routes = [
        '',
        '/about-us',
        '/features',
        '/transaction-intelligence',
        '/how-to-read-blockchain-transaction',
        '/contact-us',
        '/privacy-policy',
        '/terms-of-service',
        '/disclaimer',
        '/support',
        '/learn',
    ].map((route) => ({
        url: `${BASE_URL}${route}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: route === '' ? 1 : 0.8,
    }));

    // Learn Topics (Static list based on inspection)
    const learnTopics = [
        'what-is-blockchain',
        'how-transactions-work',
        'ethereum-and-evm',
        'what-is-a-smart-contract',
        'defi-explained',
        'nfts-explained',
        'bridges-rollups-l2',
        'state-and-data-structures',
        'dao-and-governance',
        'mev-and-transaction-ordering',
        'onchain-vs-offchain',
        'consensus-mechanisms',
        'stablecoins-and-monetary-design',
        'blockspace-and-scalability-economics',
        'common-crypto-terms',
    ];

    const learnRoutes = learnTopics.map((slug) => ({
        url: `${BASE_URL}/learn/${slug}`,
        lastModified: new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.7,
    }));

    return [...routes, ...learnRoutes];
}
