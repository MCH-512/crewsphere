"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function DeprecatedCrewCommunityPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/');
    }, [router]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">This page is no longer available. Redirecting to the dashboard...</p>
        </div>
    );
}
