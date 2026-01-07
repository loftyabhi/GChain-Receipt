import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    const baseUrl = 'https://chainreceipt.vercel.app'; // Replace with actual domain

    return {
        rules: {
            userAgent: '*',
            allow: ['/', '/tx/'],
            disallow: ['/api/', '/print/', '/_next/'],
        },
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
