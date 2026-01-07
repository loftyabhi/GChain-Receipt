import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Footer } from '@/components/Footer';
import { GoogleAnalytics } from '@/components/analytics/GoogleAnalytics';
import { ConsentBanner } from '@/components/analytics/ConsentBanner';

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
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Chain Receipt | Professional Blockchain Intelligence',
    description: 'Transform on-chain data into audit-grade documentation.',
  },
  alternates: {
    canonical: './',
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
          <GoogleAnalytics />
          <ConsentBanner />
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
