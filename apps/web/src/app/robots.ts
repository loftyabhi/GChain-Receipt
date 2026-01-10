import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/print/'],
      },
    ],
    sitemap: 'https://chainreceipt.vercel.app/sitemap.xml',
  };
}
