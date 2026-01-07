'use client';

import Link from 'next/link';
import { AlertCircle, FileX, WifiOff, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

type ErrorType = 'unsupported' | 'invalid_hash' | 'network' | 'rate_limit';

interface ErrorAction {
    label: string;
    href?: string;
}

interface ErrorConfigItem {
    title: string;
    message: string;
    icon: any;
    color: string;
    bg: string;
    border: string;
    primaryAction: ErrorAction | null;
    secondaryAction: ErrorAction | null;
}

interface TransactionErrorProps {
    type: ErrorType;
    details?: string;
    onRetry?: () => void;
}

const errorConfig: Record<ErrorType, ErrorConfigItem> = {
    unsupported: {
        title: 'Transaction Unsupported',
        message: 'This transaction type is not yet supported by our classification engine. The transaction is valid, but we cannot currently generate a semantic receipt.',
        icon: FileX,
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/20',
        primaryAction: { label: 'View Raw Transaction', href: '#' }, // Dynamic link handling needed in parent
        secondaryAction: { label: 'Try Another Transaction', href: '/' }
    },
    invalid_hash: {
        title: 'Invalid Transaction Hash',
        message: 'The provided transaction hash is not valid for the selected network. Please check the hash and try again.',
        icon: XCircle,
        color: 'text-red-400',
        bg: 'bg-red-500/10',
        border: 'border-red-500/20',
        primaryAction: null,
        secondaryAction: { label: 'Return Home', href: '/' }
    },
    network: {
        title: 'Network Unavailable',
        message: 'The blockchain network is temporarily unavailable. This is a connectivity issue, not a problem with the transaction itself.',
        icon: WifiOff,
        color: 'text-red-400',
        bg: 'bg-red-500/10',
        border: 'border-red-500/20',
        primaryAction: { label: 'Retry Connection' },
        secondaryAction: { label: 'Switch Network', href: '/' }
    },
    rate_limit: {
        title: 'Request Limit Reached',
        message: 'You have reached the temporary request limit. Request limits are enforced to ensure platform stability. No identity tracking occurs.',
        icon: AlertCircle,
        color: 'text-blue-400',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/20',
        primaryAction: { label: 'Retry Later' },
        secondaryAction: { label: 'Return Home', href: '/' }
    }
};

export function TransactionError({ type, details, onRetry }: TransactionErrorProps) {
    const config = errorConfig[type];
    const Icon = config.icon;

    // Handle button clicks
    const handlePrimaryClick = () => {
        if (config.primaryAction?.label.includes('Retry') && onRetry) {
            onRetry();
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-xl mx-auto p-8 rounded-3xl bg-[#0F0F11] border border-white/10 text-center shadow-2xl"
        >
            <div className={`w-16 h-16 rounded-2xl ${config.bg} ${config.border} border flex items-center justify-center mx-auto mb-6`}>
                <Icon className={`w-8 h-8 ${config.color}`} />
            </div>

            <h2 className="text-2xl font-bold text-white mb-4">{config.title}</h2>
            <p className="text-zinc-400 mb-8 leading-relaxed">
                {config.message}
                {details && <span className="block mt-2 text-sm text-zinc-500">{details}</span>}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {config.primaryAction && (
                    config.primaryAction.href ? (
                        <Link
                            href={config.primaryAction.href}
                            className="px-6 py-2.5 rounded-xl bg-white text-black font-semibold hover:bg-zinc-200 transition-colors text-sm"
                        >
                            {config.primaryAction.label}
                        </Link>
                    ) : (
                        <button
                            onClick={handlePrimaryClick}
                            className="px-6 py-2.5 rounded-xl bg-white text-black font-semibold hover:bg-zinc-200 transition-colors text-sm"
                        >
                            {config.primaryAction.label}
                        </button>
                    )
                )}

                {config.secondaryAction && (
                    <Link
                        href={config.secondaryAction.href || '#'}
                        className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold hover:bg-white/10 transition-colors text-sm"
                    >
                        {config.secondaryAction.label}
                    </Link>
                )}
            </div>
        </motion.div>
    );
}
