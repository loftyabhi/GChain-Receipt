import { Metadata } from 'next';
import PricingClient from './PricingClient';

export const metadata: Metadata = {
    title: 'Community Plans | Chain Receipt',
    description: 'Free utility supported by ethical advertising and community grants. No hidden fees.',
};

export default function PricingPage() {
    return <PricingClient />;
}
