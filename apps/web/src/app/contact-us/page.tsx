import { Metadata } from 'next';
import ContactUsClient from './ContactUsClient';

import { constructCanonical, generateBreadcrumbSchema } from '@/lib/seo';

export const metadata: Metadata = {
    title: 'Contact Us',
    description: 'Get in touch for compliance inquiries, technical support, or partnership opportunities.',
    alternates: {
        canonical: constructCanonical('/contact-us'),
    },
};

const breadcrumbs = [
    { name: 'Home', item: '/' },
    { name: 'Contact Us', item: '/contact-us' },
];

export default function ContactUsPage() {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(generateBreadcrumbSchema(breadcrumbs)) }}
            />
            <ContactUsClient />
        </>
    );
}
