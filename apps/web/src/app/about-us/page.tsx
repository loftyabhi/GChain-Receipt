import { Metadata } from 'next';
import AboutUsClient from './AboutUsClient';

export const metadata: Metadata = {
    title: 'About Us | Chain Receipt',
    description: 'Our mission is to standardize Web3 compliance. Learn about the team building the documentation layer for the decentralized economy.',
};

export default function AboutUsPage() {
    return <AboutUsClient />;
}
