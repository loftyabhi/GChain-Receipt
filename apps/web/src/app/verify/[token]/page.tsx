'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function VerifyPathRedirect() {
    const params = useParams();
    const router = useRouter();
    const token = params.token;

    useEffect(() => {
        if (token) {
            router.replace(`/verify?token=${token}`);
        } else {
            router.replace('/verify');
        }
    }, [token, router]);

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
    );
}
