
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function DeprecatedFlightSwapsPage() {
    const router = useRouter();

    React.useEffect(() => {
        router.replace("/admin/flights");
    }, [router]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <h1 className="text-xl font-semibold">Redirecting...</h1>
            <p className="text-muted-foreground">
                Flight Swap Management has been moved. Redirecting you to the new Flight Management hub.
            </p>
        </div>
    );
}
