import { Metadata } from 'next';
import SupportClient from './SupportClient';

export const metadata: Metadata = {
    title: 'Support the Ecosystem | Chain Receipt',
    description: 'Contribute to the public infrastructure of Chain Receipt. Community-powered, open-source aligned, and transparent.',
};

export default function SupportPage() {
    return <SupportClient />;
}
