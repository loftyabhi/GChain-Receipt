import { Metadata } from 'next';
import BillPrintClient from './BillPrintClient';

type Props = {
    params: Promise<{ billId: string }>
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { billId } = await params;

    // Set the title for the print dialog
    // The browser uses the document title as the default filename
    return {
        title: `Chain Receipt - ${billId}`,
    };
}

export default function BillPrintPage() {
    return <BillPrintClient />;
}