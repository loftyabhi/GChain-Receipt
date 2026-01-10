
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
    const content = `Title: Chain Receipt - Professional Blockchain Intelligence

Description:
Chain Receipt (chainreceipt.vercel.app) is an enterprise-grade blockchain documentation tool that transforms on-chain transaction data into audit-ready receipts/invoices. 
It supports multiple EVM chains including Base, Ethereum, Optimism, Arbitrum, Polygon, BSC, and Avalanche.
The platform prioritizes privacy with a zero-retention architecture.

Main Sections:
- Home: https://chainreceipt.vercel.app/
- Features: https://chainreceipt.vercel.app/features
- Transaction Intelligence: https://chainreceipt.vercel.app/transaction-intelligence
- Knowledge Base: https://chainreceipt.vercel.app/learn
- How to Read Transactions: https://chainreceipt.vercel.app/how-to-read-blockchain-transaction

Privacy Policy: https://chainreceipt.vercel.app/privacy-policy
Terms of Service: https://chainreceipt.vercel.app/terms-of-service

Notes for Crawlers:
- Transaction detail pages (e.g., /tx/...) are dynamically generated and typically set to noindex to preserve user privacy and prevent index bloat.
- The /print/ path is strictly disallowed.
- Please respect the minimal crawl delay to ensure service stability.

Exclusions:
- /api/
- /print/
`;

    return new NextResponse(content, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'X-Robots-Tag': 'noindex, follow',
        },
    });
}
