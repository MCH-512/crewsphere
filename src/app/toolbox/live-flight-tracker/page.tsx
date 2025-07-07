"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Map as MapIcon, Loader2 } from "lucide-react";
import dynamic from 'next/dynamic';

const DynamicMap = dynamic(() => import('@/components/features/live-map'), {
    ssr: false,
});

export default function LiveFlightTrackerPage() {
    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="text-2xl font-headline flex items-center">
                        <MapIcon className="mr-3 h-7 w-7 text-primary" />
                        Live Flight Tracker
                    </CardTitle>
                    <CardDescription>
                        A real-time view of air traffic from the OpenSky Network. Data is refreshed automatically.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[600px] w-full">
                       <DynamicMap />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
