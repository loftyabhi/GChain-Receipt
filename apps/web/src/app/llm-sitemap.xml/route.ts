
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
    const baseUrl = 'https://chainreceipt.vercel.app';

    // High-value, content-rich pages for LLMs
    const pages = [
        '',
        '/features',
        '/transaction-intelligence',
        '/learn',
        '/learn/what-is-blockchain',
        '/learn/consensus-mechanisms',
        '/learn/state-and-data-structures',
        '/learn/bridges-rollups-l2',
        '/learn/account-abstraction',
        '/learn/smart-contract-security',
        '/how-to-read-blockchain-transaction',
        '/about-us',
        '/contact-us',
        '/privacy-policy',
        '/terms-of-service',
        '/disclaimer',
        '/support'
    ];

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${pages
            .map((route) => {
                return `
  <url>
    <loc>${baseUrl}${route}</loc>
    <priority>${route === '' ? 1.0 : 0.8}</priority>
    <changefreq>weekly</changefreq>
  </url>`;
            })
            // Remove extra whitespace/newlines from template literal map
            .join('')}
</urlset>`;

    return new NextResponse(sitemap, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'X-Robots-Tag': 'noindex, follow',
        },
    });
}
