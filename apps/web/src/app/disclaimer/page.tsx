import { Metadata } from 'next';
import DisclaimerClient from './DisclaimerClient';

export const metadata: Metadata = {
    title: 'Disclaimer | Chain Receipt',
    description: 'Usage disclaimers: Chain Receipt provides information, not advice. Non-custodial, experimental technology.',
};

export default function DisclaimerPage() {
    return <DisclaimerClient />;
}
