import { Metadata } from 'next';
import BillPrintClient from './BillPrintClient';

type Props = {
    params: { billId: string }
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { billId } = params;

    // Set the title for the print dialog
    // The browser uses the document title as the default filename
    return {
        title: `Chain Receipt - ${billId}`,
    };
}

export default function BillPrintPage() {
    return <BillPrintClient />;
}