"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import { FileSignature, Loader2, AlertTriangle, ArrowLeft, Shield, HeartPulse, Utensils, AlertCircle, UserCheck, Wrench, MessageSquare, PlusCircle, CheckCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { StoredPurserReport, optionalReportSections } from "@/schemas/purser-report-schema";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type ReportStatus = "submitted" | "under-review" | "closed";

export default function PurserReportHistoryDetailPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();
    const reportId = params.reportId as string;

    const [report, setReport] = React.useState<StoredPurserReport | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const fetchReport = React.useCallback(async () => {
        if (!reportId || !user) return;
        setIsLoading(true);
        setError(null);
        try {
            const reportDocRef = doc(db, "purserReports", reportId);
            const docSnap = await getDoc(reportDocRef);

            if (docSnap.exists()) {
                const data = { id: docSnap.id, ...docSnap.data() } as StoredPurserReport;
                if (data.userId !== user.uid) {
                    throw new Error("You do not have permission to view this report.");
                }
                setReport(data);
            } else {
                setError("Report not found.");
            }
        } catch (err: any) {
            console.error("Error fetching report:", err);
            setError(err.message || "Failed to load the report.");
            toast({ title: "Loading Error", description: err.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [reportId, user, toast]);

    React.useEffect(() => {
        if (!authLoading && user) {
            fetchReport();
        } else if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router, fetchReport]);

    const getStatusBadgeVariant = (status: ReportStatus) => {
        switch (status) {
            case "submitted": return "secondary";
            case "under-review": return "outline";
            case "closed": return "success";
            default: return "secondary";
        }
    };
    
    const getAdminResponseAlertVariant = (status: ReportStatus) => {
        switch (status) {
          case "closed": return "success";
          default: return "default";
        }
    };

    if (isLoading || authLoading) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }
    
     if (!user) {
        return null;
    }

    if (error) {
        return <div className="text-center py-10"><AlertTriangle className="mx-auto h-12 w-12 text-destructive" /><p className="mt-4 text-lg">{error}</p><Button onClick={() => router.back()} className="mt-4">Go Back</Button></div>;
    }

    if (!report) {
        return <div className="text-center py-10"><p>No report data to display.</p></div>;
    }

    const SectionDisplay = ({ name }: { name: keyof StoredPurserReport}) => {
        const config = optionalReportSections.find(s => s.name === name);
        const value = report[name];
        if (!config || !value) return null;
        const Icon = config.icon;
        return (
             <div className="space-y-1">
                <h4 className="font-semibold text-base flex items-center gap-2"><Icon className="h-4 w-4 text-primary"/>{config.label}</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap p-3 rounded-md bg-muted/50 border">{value as string}</p>
            </div>
        )
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <Button variant="outline" onClick={() => router.push('/purser-reports/history')}><ArrowLeft className="mr-2 h-4 w-4"/>Back to History</Button>
            
            <Card className="shadow-lg">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-2xl font-headline flex items-center"><FileSignature className="mr-3 h-7 w-7 text-primary" />Report for Flight {report.flightNumber}</CardTitle>
                            <CardDescription>
                                {report.departureAirport} to {report.arrivalAirport} on {format(parseISO(report.flightDate), "PPP")}
                            </CardDescription>
                        </div>
                        <div className="text-right text-sm">
                           <Badge variant={getStatusBadgeVariant(report.status)} className="capitalize">{report.status.replace('-', ' ')}</Badge>
                           <p className="text-muted-foreground mt-1">Submitted: {format(report.createdAt.toDate(), "PPp")}</p>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {report.adminNotes && (
                <Alert variant={getAdminResponseAlertVariant(report.status)}>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Administrator Response</AlertTitle>
                    <AlertDescription className="whitespace-pre-wrap">{report.adminNotes}</AlertDescription>
                </Alert>
            )}
            
            <Card>
                <CardHeader><CardTitle className="text-lg">General Flight Summary</CardTitle></CardHeader>
                <CardContent>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">{report.generalFlightSummary}</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="text-lg">Detailed Observations</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    {optionalReportSections.map(section => <SectionDisplay key={section.name} name={section.name}/>)}
                    {optionalReportSections.every(s => !report[s.name]) && <p className="text-muted-foreground text-sm">No optional sections were filled out for this report.</p>}
                </CardContent>
            </Card>
        </div>
    );
}
