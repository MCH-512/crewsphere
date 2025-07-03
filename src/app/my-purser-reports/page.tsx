"use client";

// This page is deprecated and its content has been moved to /purser-reports.
// It is kept to avoid breaking potential old links but will redirect.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function DeprecatedMyPurserReportsPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/purser-reports');
    }, [router]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Redirecting to the new Purser Reports page...</p>
        </div>
    );
}
