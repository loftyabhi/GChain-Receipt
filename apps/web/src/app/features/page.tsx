import { Metadata } from 'next';
import FeaturesClient from './FeaturesClient';

import { constructCanonical, generateBreadcrumbSchema, generateFAQSchema } from '@/lib/seo';

export const metadata: Metadata = {
    title: 'Features',
    description: 'Explore enterprise-grade features: Zero-Knowledge Privacy, Developer APIs, and Multi-Chain Support.',
    alternates: {
        canonical: constructCanonical('/features'),
    },
};

const breadcrumbs = [
    { name: 'Home', item: '/' },
    { name: 'Features', item: '/features' },
];

const faqs = [
    { question: 'Is TxProof free to use?', answer: 'Base features including single transaction analysis and standard PDF downloads are free. Advanced features and API access may require a subscription.' },
    { question: 'Which blockchains are supported?', answer: 'We currently support major EVM-compatible chains including Ethereum, Base, Polygon, Arbitrum, Optimism, and Binance Smart Chain.' },
    { question: 'Is my data stored?', answer: 'No. TxProof operates on a privacy-first, client-side model. We analyze on-chain data on-demand and do not store your transaction history.' },
    { question: 'Can I use the API for my application?', answer: 'Yes. Our Developer API allows you to integrate receipt generation directly into your dApp or wallet. Contact us for access keys.' },
];

export default function FeaturesPage() {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(generateBreadcrumbSchema(breadcrumbs)) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(generateFAQSchema(faqs)) }}
            />
            <FeaturesClient />
        </>
    );
}
