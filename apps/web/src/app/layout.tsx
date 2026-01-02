import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Footer } from '@/components/Footer';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Chain Receipt | Professional Blockchain Intelligence',
  description: 'Enterprise-grade blockchain documentation. Generate audit-ready receipts for transactions on Base, Ethereum, and more. Zero data retention.',
  keywords: ['blockchain receipt', 'crypto tax tool', 'on-chain invoice', 'web3 accounting', 'base chain receipt'],
  openGraph: {
    title: 'Chain Receipt | Professional Blockchain Intelligence',
    description: 'Transform on-chain data into audit-grade documentation.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
