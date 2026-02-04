'use client';

import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useState, useEffect } from 'react';

const ADMIN_ADDRESS = process.env.NEXT_PUBLIC_ADMIN_ADDRESS || process.env.ADMIN_ADDRESS;

const GithubIcon = ({ className }: { className?: string }) => (
    <svg
        viewBox="0 0 24 24"
        width="24"
        height="24"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
        <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
);

const TwitterIcon = ({ className }: { className?: string }) => (
    <svg
        viewBox="0 0 24 24"
        width="24"
        height="24"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
    </svg>
);

const TelegramIcon = ({ className }: { className?: string }) => (
    <svg
        viewBox="0 0 24 24"
        width="24"
        height="24"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="m22 2-7 20-4-9-9-4Z" />
        <path d="M22 2 11 13" />
    </svg>
);

export function Footer() {
    const { address } = useAccount();
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        if (address && ADMIN_ADDRESS && address.toLowerCase() === ADMIN_ADDRESS.toLowerCase()) {
            setIsAdmin(true);
        } else {
            setIsAdmin(false);
        }
    }, [address]);

    return (
        <footer className="border-t border-white/10 bg-[#0B0F19] w-full">
            <div className="mx-auto max-w-7xl px-6 py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
                    <div className="space-y-4">
                        <Link href="/" className="flex items-center gap-2 group mb-2">

                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white text-2xl shadow-lg shadow-violet-500/20 transition-transform group-hover:scale-110">
                                ⚡
                            </div>
                            <span className="text-xl font-bold tracking-tight text-white">TxProof</span>
                        </Link>
                        <p className="text-sm text-gray-400 leading-relaxed">
                            Professional Blockchain Intelligence. Audit-grade documentation for the decentralized economy.
                        </p>
                    </div>

                    <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-6">Product</h4>
                        <ul className="space-y-3">
                            <li>
                                <Link href="/transaction-intelligence" className="text-sm text-gray-400 hover:text-violet-400 transition-colors">
                                    Transaction Intelligence
                                </Link>
                            </li>
                            <li>
                                <Link href="/learn" className="text-sm text-gray-400 hover:text-violet-400 transition-colors">
                                    Knowledge Base
                                </Link>
                            </li>
                            <li>
                                <Link href="/developers" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-violet-400 transition-colors">
                                    Developer Portal
                                </Link>
                            </li>
                            <li>
                                <a href="https://docs.txproof.xyz" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-violet-400 transition-colors">
                                    Documentation
                                </a>
                            </li>
                            <li>
                                <Link href="/features" className="text-sm text-gray-400 hover:text-violet-400 transition-colors">
                                    Features
                                </Link>
                            </li>
                            <li>
                                <Link href="/how-to-read-blockchain-transaction" className="text-sm text-gray-400 hover:text-violet-400 transition-colors">
                                    How to Read Transactions
                                </Link>
                            </li>
                            <li>
                                <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-300">
                                    {isAdmin && (
                                        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-violet-400 transition-colors">Dashboard</Link>
                                    )}
                                </div>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-6">Legal</h4>
                        <ul className="space-y-3">
                            <li>
                                <Link href="/privacy-policy" className="text-sm text-gray-400 hover:text-violet-400 transition-colors">
                                    Privacy Policy
                                </Link>
                            </li>
                            <li>
                                <Link href="/terms-of-service" className="text-sm text-gray-400 hover:text-violet-400 transition-colors">
                                    Terms of Service
                                </Link>
                            </li>
                            <li>
                                <Link href="/cookie-policy" className="text-sm text-gray-400 hover:text-violet-400 transition-colors">
                                    Cookie Policy
                                </Link>
                            </li>
                            <li>
                                <Link href="/disclaimer" className="text-sm text-gray-400 hover:text-violet-400 transition-colors">
                                    Disclaimer
                                </Link>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-6">Support</h4>
                        <ul className="space-y-3">
                            <li>
                                <Link href="/support" className="text-sm text-gray-400 hover:text-violet-400 transition-colors">
                                    Show Your Support
                                </Link>
                            </li>
                            <li>
                                <Link href="/contact-us" className="text-sm text-gray-400 hover:text-violet-400 transition-colors">
                                    Contact Us
                                </Link>
                            </li>
                            <li>
                                <Link href="/about-us" className="text-sm text-gray-400 hover:text-violet-400 transition-colors">
                                    About Us
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-gray-500">
                        &copy; {new Date().getFullYear()} TxProof. All rights reserved.
                    </p>
                    <div className="flex items-center gap-6">
                        <Link href="https://github.com/loftyabhi" aria-label="Visit GitHub Profile" className="text-gray-400 hover:text-violet-400 transition-colors transform hover:scale-110">
                            <GithubIcon className="w-5 h-5" />
                        </Link>
                        <Link href="https://twitter.com/loftyabhi" aria-label="Visit Twitter Profile" className="text-gray-400 hover:text-violet-400 transition-colors transform hover:scale-110">
                            <TwitterIcon className="w-5 h-5" />
                        </Link>
                        <Link href="https://t.me/loftyabhi" aria-label="Join Telegram Channel" className="text-gray-400 hover:text-violet-400 transition-colors transform hover:scale-110">
                            <TelegramIcon className="w-5 h-5" />
                        </Link>
                    </div>
                </div>
            </div>
        </footer >
    );
}
