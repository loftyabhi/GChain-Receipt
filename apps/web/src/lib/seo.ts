import { Metadata } from 'next';

export const BRAND = "TxProof";
export const TAGLINE = "Professional Blockchain Intelligence";
export const DOMAIN = "https://txproof.xyz";

// --- Canonical URL Construction ---

export function constructCanonical(path: string = ''): string {
    const baseUrl = DOMAIN;
    const cleanPath = path.toLowerCase().replace(/\/$/, ''); // Remove trailing slash
    return `${baseUrl}${cleanPath.startsWith('/') ? '' : '/'}${cleanPath}`;
}

// --- Structured Data Generators (JSON-LD) ---

export type BreadcrumbItem = {
    name: string;
    item: string;
};

export function generateBreadcrumbSchema(items: BreadcrumbItem[]) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: constructCanonical(item.item),
        })),
    };
}

export function generateOrganizationSchema() {
    return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: BRAND,
        url: DOMAIN,
        logo: `${DOMAIN}/logo.png`, // Assuming logo exists, or standard OG image if not
        sameAs: [
            // Add social profiles here if available
            // 'https://twitter.com/loftyabhi',
        ],
        contactPoint: {
            '@type': 'ContactPoint',
            email: 'support@txproof.xyz', // Placeholder if not provided
            contactType: 'customer support',
        },
    };
}

export function generateWebSiteSchema() {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: BRAND,
        url: DOMAIN,
        potentialAction: {
            '@type': 'SearchAction',
            target: {
                '@type': 'EntryPoint',
                urlTemplate: `${DOMAIN}/search?q={search_term_string}`
            },
            'query-input': 'required name=search_term_string'
        }
    };
}

export function generateArticleSchema(
    title: string,
    description: string,
    publishedTime: string,
    modifiedTime: string,
    image: string,
    section: string
) {
    return {
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        headline: title,
        description: description,
        image: image.startsWith('http') ? image : `${DOMAIN}${image}`,
        datePublished: publishedTime,
        dateModified: modifiedTime,
        author: {
            '@type': 'Organization',
            name: BRAND,
        },
        publisher: {
            '@type': 'Organization',
            name: BRAND,
            logo: {
                '@type': 'ImageObject',
                url: `${DOMAIN}/logo.png`
            }
        },
        articleSection: section,
        mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': constructCanonical() // Defaults to home, but should optionally pass path if needed. 
            // Better to pass path or handle in component. 
            // For now, let's keep it simple.
        }
    };
}

export type FAQItem = {
    question: string;
    answer: string;
};

export function generateFAQSchema(faqs: FAQItem[]) {
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map(faq => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: faq.answer,
            },
        })),
    };
}
