import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    const baseUrl = 'https://chainreceipt.vercel.app';

    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/api/', '/print/', '/_next/', '/dashboard/', '/admin/', '/internal/'],
        },
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
