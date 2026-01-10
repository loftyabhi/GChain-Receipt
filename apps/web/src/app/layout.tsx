import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Footer } from '@/components/Footer';
import { GoogleAnalytics } from '@/components/analytics/GoogleAnalytics';
import { ConsentBanner } from '@/components/analytics/ConsentBanner';
import { ShareAttribution } from '@/components/analytics/ShareAttribution';
import { generateOrganizationSchema, generateWebSiteSchema, constructCanonical } from '@/lib/seo';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://chainreceipt.vercel.app'),
  verification: {
    google: 'qqKLsD62JCrHlaIcPeLmWB3jUJIZ1GiMY5-N1bN-cOM',
  },
  title: {
    default: 'Chain Receipt | Professional Blockchain Intelligence',
    template: '%s | Chain Receipt',
  },
  description: 'Enterprise-grade blockchain documentation. Generate audit-ready receipts for transactions on Base, Ethereum, and more. Zero data retention.',
  keywords: ['blockchain receipt', 'crypto tax tool', 'on-chain invoice', 'web3 accounting', 'base chain receipt', 'transaction semantics', 'audit transparency'],
  openGraph: {
    title: 'Chain Receipt | Professional Blockchain Intelligence',
    description: 'Transform on-chain data into audit-grade documentation.',
    type: 'website',
    siteName: 'Chain Receipt',
    images: [
      {
        url: '/og/chain-receipt.png',
        width: 1200,
        height: 630,
        alt: 'Chain Receipt - Professional Blockchain Intelligence',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Chain Receipt | Professional Blockchain Intelligence',
    description: 'Transform on-chain data into audit-grade documentation.',
    images: ['/og/chain-receipt.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png' },
    ],
  },
  alternates: {
    canonical: constructCanonical('/'),
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-[#0a0a0a] min-h-screen text-white antialiased selection:bg-violet-500/30 font-sans">
        <Providers>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(generateOrganizationSchema()) }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(generateWebSiteSchema()) }}
          />
          <GoogleAnalytics />
          <ConsentBanner />
          <Suspense fallback={null}>
            <ShareAttribution />
          </Suspense>
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
