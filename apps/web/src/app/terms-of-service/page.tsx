import { Metadata } from 'next';
import TermsOfServiceClient from './TermsOfServiceClient';

export const metadata: Metadata = {
    title: 'Terms of Service | Chain Receipt',
    description: 'Terms and conditions for using the Chain Receipt platform. By using our service, you agree to these legal terms.',
};

export default function TermsOfServicePage() {
    return <TermsOfServiceClient />;
}
