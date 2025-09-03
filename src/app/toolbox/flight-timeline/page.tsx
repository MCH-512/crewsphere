"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// This page is now deprecated in favor of the live map tracker.
// We will redirect users to the new page.

export default function DeprecatedFlightTimelinePage() {
    const router = useRouter();

    React.useEffect(() => {
        router.replace('/toolbox/live-flight-tracker');
    }, [router]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <h1 className="text-xl font-semibold">Redirecting...</h1>
            <p className="text-muted-foreground">
                This flight tracker has been upgraded to a live map view. Redirecting you now.
            </p>
        </div>
    );
}
