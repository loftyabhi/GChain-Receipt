import { Metadata } from 'next';
import PrivacyPolicyClient from './PrivacyPolicyClient';

export const metadata: Metadata = {
    title: 'Privacy Policy | Chain Receipt',
    description: 'We prioritize your privacy. No tracking, no data selling, and no access to private keys.',
};

export default function PrivacyPolicyPage() {
    return <PrivacyPolicyClient />;
}
