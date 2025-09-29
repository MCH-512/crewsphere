
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle, List, ArrowRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { StoredPurserReport } from "@/schemas/purser-report-schema";
import Link from "next/link";
import { AnimatedCard } from "@/components/motion/animated-card";

export default function PurserReportsHistoryPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [reports, setReports] = React.useState<StoredPurserReport[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push('/login');
            return;
        }

        const fetchReports = async () => {
            setIsLoading(true);
            try {
                const q = query(
                    collection(db, "purserReports"),
                    where("userId", "==", user.uid),
                    orderBy("createdAt", "desc")
                );
                const querySnapshot = await getDocs(q);
                const fetchedReports = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredPurserReport));
                setReports(fetchedReports);
            } catch (err) {
                console.error("Error fetching reports:", err);
                toast({ title: "Loading Error", description: "Could not fetch your reports history.", variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };

        fetchReports();
    }, [user, authLoading, router, toast]);

    const getStatusBadgeVariant = (status: StoredPurserReport['status']) => {
        switch (status) {
            case "submitted": return "secondary";
            case "under-review": return "outline";
            case "closed": return "success";
            default: return "secondary";
        }
    };

    if (isLoading || authLoading) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }
    
     if (!user) {
        return <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center"><AlertTriangle className="h-12 w-12 text-destructive mb-4" /><CardTitle className="text-xl mb-2">Access Denied</CardTitle><p className="text-muted-foreground">You must be logged in to view this page.</p><Button onClick={() => router.push('/login')} className="mt-4">Login</Button></div>;
    }

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
                               