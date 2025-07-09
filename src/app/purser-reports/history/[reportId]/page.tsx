
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import { FileSignature, Loader2, AlertTriangle, ArrowLeft, Shield, Utensils, AlertCircle, UserCheck, Wrench, MessageSquare, PlusCircle, CheckCircle, Users, PersonStanding, Plane, Waypoints, HeartPulse } from "lucide-react";
import { format, parseISO } from "date-fns";
import { StoredPurserReport } from "@/schemas/purser-report-schema";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type ReportStatus = "submitted" | "under-review" | "closed";

const SectionDisplay = ({ label, value, icon: Icon }: { label: string; value?: string | string[] | null; icon: React.ElementType }) => {
    if (!value || (Array.isArray(value) && value.length === 0)) return null;

    const displayValue = Array.isArray(value) ? value.join(', ') : value;

    return (
        <div className="space-y-1">
            <h4 className="font-semibold text-base flex items-center gap-2"><Icon className="h-4 w-4 text-primary"/>{label}</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap p-3 rounded-md bg-muted/50 border">{displayValue}</p>
        </div>
    );
};

export default function PurserReportHistoryDetailPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();
    const reportId = params.reportId as string;

    const [report, setReport] = React.useState<StoredPurserReport | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!reportId || !user) return;
        setIsLoading(true);
        setError(null);
        const fetchReport = async () => {
            try {
                const reportDocRef = doc(db, "purserReports", reportId);
                const docSnap = await getDoc(reportDocRef);

                if (docSnap.exists()) {
                    const data = { id: docSnap.id, ...docSnap.data() } as StoredPurserReport;
                    if (data.userId !== user.uid && user.role !== 'admin') {
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
        };

        if (!authLoading) {
            fetchReport();
        }
    }, [reportId, user, authLoading, router, toast]);

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
                <CardHeader><CardTitle className="text-lg">Detailed Report</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <SectionDisplay label="Crew Performance & Coordination" value={[`Briefing: ${report.briefing?.join(', ') || 'N/A'}`, `Atmosphere: ${report.atmosphere?.join(', ') || 'N/A'}`, `Positive: ${report.positivePoints || 'N/A'}`, `Improvement: ${report.improvementPoints || 'N/A'}`, `Follow-up: ${report.followUpRecommended ? 'Yes' : 'No'}`].join('\n')} icon={Users} />
                    <SectionDisplay label="Passengers" value={[`Count: ${report.passengerCount}`, `Reported: ${report.passengersToReport?.join(', ') || 'None'}`, `Notes: ${report.passengerBehaviorNotes || 'N/A'}`, `Complaint: ${report.passengerComplaint ? 'Yes' : 'No'}`].join('\n')} icon={PersonStanding} />
                    <SectionDisplay label="Cabin Condition" value={[`Boarding: ${report.cabinConditionBoarding?.join(', ') || 'N/A'}`, `Arrival: ${report.cabinConditionArrival?.join(', ') || 'N/A'}`, `Issues: ${report.technicalIssues?.join(', ') || 'None'}`, `Actions: ${report.cabinActionsTaken || 'N/A'}`].join('\n')} icon={Wrench} />
                    <SectionDisplay label="Safety" value={[`Demo: ${report.safetyDemo?.join(', ') || 'N/A'}`, `Checks: ${report.safetyChecks?.join(', ') || 'N/A'}`, `Cross-check: ${report.crossCheck?.join(', ') || 'N/A'}`, `Anomalies: ${report.safetyAnomalies || 'N/A'}`].join('\n')} icon={Shield} />
                    <SectionDisplay label="In-Flight Service" value={[`Performance: ${report.servicePerformance?.join(', ') || 'N/A'}`, `Catering Shortage: ${report.cateringShortage ? 'Yes' : 'No'}`, `Feedback: ${report.servicePassengerFeedback || 'N/A'}`].join('\n')} icon={Utensils} />
                    <SectionDisplay label="Operational Events" value={[`Delay Causes: ${report.delayCauses?.join(', ') || 'None'}`, `Cockpit Comms: ${report.cockpitCommunication || 'N/A'}`, `Ground Handling: ${report.groundHandlingRemarks || 'N/A'}`].join('\n')} icon={Plane} />
                    <SectionDisplay label="Specific Incidents" value={[`Incident to Report: ${report.specificIncident ? 'Yes' : 'No'}`, `Type: ${report.incidentTypes?.join(', ') || 'None'}`, `Details: ${report.incidentDetails || 'N/A'}`].join('\n')} icon={AlertTriangle} />
                </CardContent>
            </Card>
        </div>
    );
}

    