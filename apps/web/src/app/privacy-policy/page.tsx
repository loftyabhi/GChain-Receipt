import { Metadata } from 'next';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { constructCanonical, generateBreadcrumbSchema } from '@/lib/seo';

export const metadata: Metadata = {
    title: 'Privacy Policy',
    description: 'TxProof is committed to deterministic, privacy-first blockchain intelligence. We do not collect PII or private keys.',
    alternates: {
        canonical: constructCanonical('/privacy-policy'),
    },
};

const breadcrumbs = [
    { name: 'Home', item: '/' },
    { name: 'Privacy Policy', item: '/privacy-policy' },
];

export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-[#0a0a0a] text-zinc-300 font-sans selection:bg-violet-500/30 overflow-x-hidden">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(generateBreadcrumbSchema(breadcrumbs)) }}
            />
            <Navbar />

            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/5 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/5 blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto pt-32 pb-20 px-6">
                <header className="mb-12 border-b border-white/10 pb-8 text-center md:text-left">
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Privacy Policy</h1>
                    <p className="text-lg text-zinc-400">
                        Last Updated: February 04, 2026
                    </p>
                </header>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-white">1. Data Collection & Usage</h2>
                    <p>
                        TxProof is designed with a "Privacy-First" approach, but we collect specific technical data necessary for service integrity and security:
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li><strong>Email Addresses:</strong> Collected only if you choose to verify your account. Used strictly for account recovery, security alerts, and system notifications. We enforce email uniqueness to prevent platform abuse.</li>
                        <li><strong>IP Addresses:</strong> Logged temporarily in our security and usage ledgers (`usage_events` and `audit_logs`) to monitor for DDoS attacks, manage API quota limits, and prevent fraudulent activity.</li>
                        <li><strong>Wallet Addresses:</strong> Used as your primary identifier for transaction proof generation and contribution tracking.</li>
                    </ul>
                    <p className="text-sm text-zinc-400">
                        We <strong>do not</strong> collect or store your private keys, seed phrases, or physical identity details.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-white">2. Analytics & Cookies</h2>
                    <p>
                        We use minimal tracking to ensure platform stability and performance.
                    </p>
                    <div className="bg-white/5 p-6 rounded-xl border border-white/10 space-y-4">
                        <div>
                            <h3 className="text-white font-medium mb-2">Essential Cookies (Functional):</h3>
                            <ul className="list-disc pl-5 space-y-2 text-sm text-zinc-400">
                                <li><code>admin_token</code>: A secure, HttpOnly cookie used to maintain session state for authorized administrators.</li>
                                <li><code>csrf_token</code>: Used to prevent Cross-Site Request Forgery attacks during sensitive operations.</li>
                                <li><code>cookie_consent</code>: Stored in LocalStorage to remember your tracking preferences.</li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="text-white font-medium mb-2">Analytics (GA4):</h3>
                            <ul className="list-disc pl-5 space-y-2 text-sm text-zinc-400">
                                <li><strong>Anonymization:</strong> IP Anonymization is enabled; IPs are truncated before storage by Google.</li>
                                <li><strong>Purpose:</strong> Used to understand general platform usage patterns. No data is shared for advertising or benchmarking.</li>
                            </ul>
                        </div>
                    </div>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-white">3. Data Retention & Security</h2>
                    <p>
                        Data is stored in secure, encrypted databases provided by our infrastructure partners (Supabase/PostgreSQL).
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li><strong>Usage Logs:</strong> Retained for 30-90 days for SLA monitoring and security auditing.</li>
                        <li><strong>Verification Tokens:</strong> Automatically expire after their set duration (e.g., 15-60 minutes) and are deleted upon use.</li>
                        <li><strong>Account Data:</strong> Persists as long as your account remains active. Verified emails can be removed by unlinking your account.</li>
                    </ul>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-white">4. Your Rights</h2>
                    <p>
                        Under GDPR/CCPA, you have the right to access, rectify, or delete your data.
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li><strong>Opt-Out:</strong> You can reset your analytics preference by clearing your browser's local storage.</li>
                        <li><strong>Deletion:</strong> You may request account deletion, which will purge your email, API keys, and personalized usage history from our active databases.</li>
                    </ul>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-white">5. Contact</h2>
                    <p>
                        For technical inquiries or data requests, please contact us via our official GitHub or support channels.
                    </p>
                </section>
            </div>
        </div>
    );
}
