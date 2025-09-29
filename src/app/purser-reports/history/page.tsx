"use server";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { List, ArrowRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { StoredPurserReport } from "@/schemas/purser-report-schema";
import Link from "next/link";
import { AnimatedCard } from "@/components/motion/animated-card";
import { redirect } from "next/navigation";
import { getMyReports } from "@/services/report-service";
import { getCurrentUser } from "@/lib/session";
import { z } from 'zod';

const EmptySchema = z.object({});

const getStatusBadgeVariant = (status: StoredPurserReport['status']) =&gt; {
    switch (status) {
        case "submitted": return "secondary";
        case "under-review": return "outline";
        case "closed": return "success";
        default: return "secondary";
    }
};

export default async function PurserReportsHistoryPage() {
    EmptySchema.parse({});
    const user = await getCurrentUser();
    if (!user) {
        redirect('/login');
    }
    const reports = await getMyReports();

    return (
        &lt;div className="space-y-6"&gt;
            &lt;AnimatedCard&gt;
                &lt;Card className="shadow-lg"&gt;
                    &lt;CardHeader&gt;
                        &lt;CardTitle className="text-2xl font-headline flex items-center"&gt;
                            &lt;List className="mr-3 h-7 w-7 text-primary" /&gt;
                            My Submitted Reports
                        &lt;/CardTitle&gt;
                        &lt;CardDescription&gt;Here is a history of all the flight reports you have submitted.&lt;/CardDescription&gt;
                    &lt;/CardHeader&gt;
                &lt;/Card&gt;
            &lt;/AnimatedCard&gt;

            {reports.length === 0 ? (
                &lt;AnimatedCard delay={0.1}&gt;
                    &lt;Card className="text-center py-12"&gt;
                        &lt;CardContent&gt;
                            &lt;p className="text-muted-foreground mb-4"&gt;You have not submitted any reports yet.&lt;/p&gt;
                            &lt;Button asChild&gt;
                                &lt;Link href="/purser-reports"&gt;View Pending Reports&lt;/Link&gt;
                            &lt;/Button&gt;
                        &lt;/CardContent&gt;
                    &lt;/Card&gt;
                &lt;/AnimatedCard&gt;
            ) : (
                &lt;div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"&gt;
                    {reports.map((report, index) =&gt; (
                        &lt;AnimatedCard key={report.id} delay={0.1 + index * 0.05}&gt;
                            &lt;Card className="shadow-sm h-full flex flex-col"&gt;
                                &lt;CardHeader&gt;
                                    &lt;div className="flex justify-between items-start"&gt;
                                        &lt;CardTitle className="text-lg"&gt;Flight {report.flightNumber}&lt;/CardTitle&gt;
                                        &lt;Badge variant={getStatusBadgeVariant(report.status)} className="capitalize"&gt;{report.status.replace('-', ' ')}&lt;/Badge&gt;
                                    &lt;/div&gt;
                                    &lt;CardDescription&gt;
                                        {report.departureAirport} → {report.arrivalAirport} on {format(parseISO(report.flightDate), "PP")}
                                    &lt;/CardDescription&gt;
                                &lt;/CardHeader&gt;
                                &lt;CardContent className="flex-grow"&gt;
                                    &lt;p className="text-sm text-muted-foreground line-clamp-3"&gt;{report.aiSummary || 'No summary available.'}&lt;/p&gt;
                                &lt;/CardContent&gt;
                                &lt;CardFooter className="flex-col items-start gap-2"&gt;
                                     &lt;p className="text-xs text-muted-foreground"&gt;Submitted: {format(report.createdAt.toDate(), "PPp")}&lt;/p&gt;
                                     &lt;Button asChild variant="outline" className="w-full"&gt;
                                        &lt;Link href={`/purser-reports/history/${report.id}`}&gt;
                                            View Details &amp; Response
                                            &lt;ArrowRight className="ml-auto h-4 w-4" /&gt;
                                        &lt;/Link&gt;
                                    &lt;/Button&gt;
                                &lt;/CardFooter&gt;
                            &lt;/Card&gt;
                        &lt;/AnimatedCard&gt;
                    ))}&lt;/div&gt;
            )}
        &lt;/div&gt;
    );
}
