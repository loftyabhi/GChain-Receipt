import { Metadata } from 'next';
import TermsOfServiceClient from './TermsOfServiceClient';

import { constructCanonical, generateBreadcrumbSchema } from '@/lib/seo';

export const metadata: Metadata = {
    title: 'Terms of Service',
    description: 'Terms and conditions for using the Chain Receipt platform. By using our service, you agree to these legal terms.',
    alternates: {
        canonical: constructCanonical('/terms-of-service'),
    },
};

const breadcrumbs = [
    { name: 'Home', item: '/' },
    { name: 'Terms of Service', item: '/terms-of-service' },
];

export default function TermsOfServicePage() {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(generateBreadcrumbSchema(breadcrumbs)) }}
            />
            <TermsOfServiceClient />
        </>
    );
}
