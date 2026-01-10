import { Metadata } from 'next';
import DisclaimerClient from './DisclaimerClient';

import { constructCanonical, generateBreadcrumbSchema } from '@/lib/seo';

export const metadata: Metadata = {
    title: 'Disclaimer',
    description: 'Usage disclaimers: Chain Receipt provides information, not advice. Non-custodial, experimental technology.',
    alternates: {
        canonical: constructCanonical('/disclaimer'),
    },
};

const breadcrumbs = [
    { name: 'Home', item: '/' },
    { name: 'Disclaimer', item: '/disclaimer' },
];

export default function DisclaimerPage() {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(generateBreadcrumbSchema(breadcrumbs)) }}
            />
            <DisclaimerClient />
        </>
    );
}
