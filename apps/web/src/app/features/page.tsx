import { Metadata } from 'next';
import FeaturesClient from './FeaturesClient';

export const metadata: Metadata = {
    title: 'Features | Chain Receipt',
    description: 'Explore enterprise-grade features: Zero-Knowledge Privacy, Developer APIs, and Multi-Chain Support.',
};

export default function FeaturesPage() {
    return <FeaturesClient />;
}
