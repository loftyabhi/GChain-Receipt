import { Metadata } from 'next';
import ContactUsClient from './ContactUsClient';

export const metadata: Metadata = {
    title: 'Contact Us | Chain Receipt',
    description: 'Get in touch for compliance inquiries, technical support, or partnership opportunities.',
};

export default function ContactUsPage() {
    return <ContactUsClient />;
}
