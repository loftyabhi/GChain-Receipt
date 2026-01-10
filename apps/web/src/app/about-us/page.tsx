import { Metadata } from 'next';
import AboutUsClient from './AboutUsClient';

import { constructCanonical, generateBreadcrumbSchema } from '@/lib/seo';

export const metadata: Metadata = {
    title: 'About Us',
    description: 'Our mission is to standardize Web3 compliance. Learn about the team building the documentation layer for the decentralized economy.',
    alternates: {
        canonical: constructCanonical('/about-us'),
    },
};

const breadcrumbs = [
    { name: 'Home', item: '/' },
    { name: 'About Us', item: '/about-us' },
];

export default function AboutUsPage() {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(generateBreadcrumbSchema(breadcrumbs)) }}
            />
            <AboutUsClient />
        </>
    );
}
