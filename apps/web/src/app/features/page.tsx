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
    { question: 'What is Zero-Knowledge Privacy?', answer: 'It allows you to verify the validity of a transaction without revealing the sensitive inputs, ensuring confidentiality for enterprise operations.' },
    { question: 'Do you offer Developer APIs?', answer: 'Yes, we provide REST and GraphQL APIs for seamless integration with your existing financial stack.' },
    { question: 'Which chains satisfy the Multi-Chain Support?', answer: 'We currently support Ethereum, Polygon, Arbitrum, Optimism, and are continuously adding more EVM-compatible networks.' },
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
