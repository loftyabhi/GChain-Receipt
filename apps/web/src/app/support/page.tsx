import { Metadata } from 'next';
import SupportClient from './SupportClient';

import { constructCanonical, generateBreadcrumbSchema } from '@/lib/seo';

export const metadata: Metadata = {
    title: 'Support the Ecosystem',
    description: 'Contribute to the public infrastructure of Chain Receipt. Community-powered, open-source aligned, and transparent.',
    alternates: {
        canonical: constructCanonical('/support'),
    },
};

const breadcrumbs = [
    { name: 'Home', item: '/' },
    { name: 'Support', item: '/support' },
];

export default function SupportPage() {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(generateBreadcrumbSchema(breadcrumbs)) }}
            />
            <SupportClient />
        </>
    );
}
