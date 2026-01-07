import Link from 'next/link';
import { Navbar } from '@/components/Navbar';

export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-[#0a0a0a] text-zinc-300 font-sans selection:bg-violet-500/30 overflow-x-hidden">
            <Navbar />

            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/5 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/5 blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto pt-32 pb-20 px-6 space-y-8">
                <header className="mb-12 border-b border-white/10 pb-8">
                    <h1 className="text-4xl font-bold text-white mb-4">Privacy Policy</h1>
                    <p className="text-lg text-zinc-400">
                        Effective Date: January 07, 2026<br />
                        Chain Receipt is committed to deterministic, privacy-first blockchain intelligence.
                    </p>
                </header>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-white">1. Core Principle: No PII</h2>
                    <p>
                        Chain Receipt is designed as a "Privacy-First" platform. We specifically <strong>do not</strong> collect, store, or process:
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>Personal Identification Information (Names, Emails, IP Addresses connected to identity).</li>
                        <li>Wallet Private Keys or Seed Phrases.</li>
                        <li>Transaction history linked to user identity.</li>
                    </ul>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-white">2. Analytics & Cookies</h2>
                    <p>
                        We use <strong>Google Analytics 4 (GA4)</strong> in a strict, anonymized mode to understand platform performance.
                    </p>
                    <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                        <h3 className="text-white font-medium mb-2">Our Analytics Configuration:</h3>
                        <ul className="list-disc pl-5 space-y-2 text-sm">
                            <li><strong>IP Anonymization:</strong> Enabled (IPs are truncated before storage).</li>
                            <li><strong>Data Sharing:</strong> Disabled (No data shared with Google for benchmarking or ads).</li>
                            <li><strong>Advertising Features:</strong> Disabled (No remarketing or demographics).</li>
                            <li><strong>Consent Mode v2:</strong> Tracking is blocked by default until you click "Accept".</li>
                        </ul>
                    </div>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-white">3. Your Rights (GDPR/EEA)</h2>
                    <p>
                        Under GDPR and EEA regulations, you have the right to control your data. Since we do not store personal data, standard "Data Deletion Requests" are often not applicable, but you retain full control over client-side tracking.
                    </p>
                    <h3 className="text-lg font-medium text-white mt-4">Opt-Out / Consent Withdrawal</h3>
                    <p>
                        You can withdraw your consent for analytics at any time by clearing your browser's local storage (removing the <code>cookie_consent</code> key) or by using the button below to reset your choice.
                    </p>
                    <div className="mt-4">
                        {/* Note: In a real app, this button would trigger the ConsentBanner to reappear */}
                        <p className="text-sm italic text-zinc-500">
                            To reset consent, clear your browsing data for this site. The banner will reappear on your next visit.
                        </p>
                    </div>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-white">4. Contact</h2>
                    <p>
                        For questions regarding this privacy policy or the deterministic nature of our reporting, please contact us via our official support channels.
                    </p>
                </section>
            </div>
        </div>
    );
}
