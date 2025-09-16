"use server";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { List, ArrowRight, FileSignature } from "lucide-react";
import { format, parseISO } from "date-fns";
import { StoredPurserReport } from "@/schemas/purser-report-schema";
import Link from "next/link";
import { AnimatedCard } from "@/components/motion/animated-card";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

async function getMyReports() {
    const user = await getCurrentUser();
    if (!user) {
        redirect('/login');
    }

    const q = query(
        collection(db, "purserReports"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    const reports = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredPurserReport));
    
    // Convert Timestamps to strings for serialization to client components if needed,
    // but here we render directly on the server.
    return reports;
}

const getStatusBadgeVariant = (status: StoredPurserReport['status']) => {
    switch (status) {
        case "submitted": return "secondary";
        case "under-review": return "outline";
        case "closed": return "success";
        default: return "secondary";
    }
};

export default async function PurserReportsHistoryPage() {
    const reports = await getMyReports();

    return (
        <div className="space-y-6">
            <AnimatedCard>
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-2xl font-headline flex items-center">
                            <List className="mr-3 h-7 w-7 text-primary" />
                            My Submitted Reports
                        </CardTitle>
                        <CardDescription>Here is a history of all the flight reports you have submitted.</CardDescription>
                    </CardHeader>
                </Card>
            </AnimatedCard>

            {reports.length === 0 ? (
                <AnimatedCard delay={0.1}>
                    <Card className="text-center py-12">
                        <CardContent>
                            <p className="text-muted-foreground mb-4">You have not submitted any reports yet.</p>
                            <Button asChild>
                                <Link href="/purser-reports">View Pending Reports</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </AnimatedCard>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {reports.map((report, index) => (
                        <AnimatedCard key={report.id} delay={0.1 + index * 0.05}>
                            <Card className="shadow-sm h-full flex flex-col">
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-lg">Flight {report.flightNumber}</CardTitle>
                                        <Badge variant={getStatusBadgeVariant(report.status)} className="capitalize">{report.status.replace('-', ' ')}</Badge>
                                    </div>
                                    <CardDescription>
                                        {report.departureAirport} → {report.arrivalAirport} on {format(parseISO(report.flightDate), "PP")}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <p className="text-sm text-muted-foreground line-clamp-3">{report.aiSummary || 'No summary available.'}</p>
                                </CardContent>
                                <CardFooter className="flex-col items-start gap-2">
                                     <p className="text-xs text-muted-foreground">Submitted: {format(report.createdAt.toDate(), "PPp")}</p>
                                     <Button asChild variant="outline" className="w-full">
                                        <Link href={`/purser-reports/history/${report.id}`}>
                                            View Details & Response
                                            <ArrowRight className="ml-auto h-4 w-4" />
                                        </Link>
                                    </Button>
                                </CardFooter>
                            </Card>
                        </AnimatedCard>
                    ))}
                </div>
            )}
        </div>
    );
}
