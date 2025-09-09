"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth, type User } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import { FileSignature, Loader2, AlertTriangle, ArrowLeft, Shield, Utensils, UserCheck, Wrench, MessageSquare, PlusCircle, CheckCircle, Sparkles, Users, UserX, Plane, Waypoints, PersonStanding, Briefcase, HeartPulse, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { StoredPurserReport } from "@/schemas/purser-report-schema";
import { StoredFlight } from "@/schemas/flight-schema";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { logAuditEvent } from "@/lib/audit-logger";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Edit, Save } from "lucide-react";

type ReportStatus = "submitted" | "under-review" | "closed";

const statusConfig: Record<ReportStatus, { label: string; color: "secondary" | "outline" | "success" }> = {
    submitted: { label: "Submitted", color: "secondary" },
    "under-review": { label: "Under Review", color: "outline" },
    closed: { label: "Closed", color: "success" },
};

const SectionDisplay = ({ label, value, icon: Icon }: { label: string; value?: string | string[] | null | boolean; icon: React.ElementType }) => {
    if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) return null;

    let displayValue: string;
    if (typeof value === 'boolean') {
        displayValue = value ? 'Yes' : 'No';
    } else if (Array.isArray(value)) {
        displayValue = value.join(', ');
    } else {
        displayValue = value;
    }
    
    if (displayValue.trim() === '') return null;

    return (
        <div className="space-y-1">
            <h4 className="font-semibold text-base flex items-center gap-2"><Icon className="h-4 w-4 text-primary"/>{label}</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap p-3 rounded-md bg-muted/50 border">{displayValue}</p>
        </div>
    );
};

export default function PurserReportDetailPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();
    const reportId = params.reportId as string;

    const [report, setReport] = React.useState<StoredPurserReport | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [isEditingNotes, setIsEditingNotes] = React.useState(false);
    const [adminNotes, setAdminNotes] = React.useState("");
    const [isSaving, setIsSaving] = React.useState(false);

    const fetchReport = React.useCallback(async () => {
        if (!reportId) return;
        setIsLoading(true);
        setError(null);
        try {
            const reportDocRef = doc(db, "purserReports", reportId);
            const reportSnap = await getDoc(reportDocRef);
            if (!reportSnap.exists()) {
                throw new Error("Report not found.");
            }
            const reportData = { id: reportSnap.id, ...reportSnap.data() } as StoredPurserReport;
            setReport(reportData);
            setAdminNotes(reportData.adminNotes || "");
        } catch (err: any) {
            console.error("Error fetching report:", err);
            setError(err.message || "Failed to load the report.");
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [reportId, toast]);

    React.useEffect(() => {
        if (!authLoading) {
            if (!user || user.role !== 'admin') {
                router.push('/');
            } else {
                fetchReport();
            }
        }
    }, [user, authLoading, router, fetchReport]);

    const handleUpdateStatus = async (newStatus: ReportStatus) => {
        if (!report || !user) return;
        setIsSaving(true);
        try {
            const reportRef = doc(db, "purserReports", report.id);
            await updateDoc(reportRef, { status: newStatus });
            setReport(prev => prev ? { ...prev, status: newStatus } : null);
            await logAuditEvent({ userId: user.uid, userEmail: user.email, actionType: "UPDATE_REPORT_STATUS", entityType: "PURSER_REPORT", entityId: report.id, details: { oldStatus: report.status, newStatus } });
            toast({ title: "Status Updated", description: `Report status changed to "${statusConfig[newStatus].label}".` });
        } catch (error) {
            toast({ title: "Update Failed", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleSaveNotes = async () => {
        if (!report || !user) return;
        setIsSaving(true);
        try {
            const reportRef = doc(db, "purserReports", report.id);
            await updateDoc(reportRef, { adminNotes });
            setReport(prev => prev ? { ...prev, adminNotes } : null);
            await logAuditEvent({ userId: user.uid, userEmail: user.email, actionType: "UPDATE_REPORT_NOTES", entityType: "PURSER_REPORT", entityId: report.id });
            toast({ title: "Notes Saved", description: "Administrator notes have been successfully saved." });
            setIsEditingNotes(false);
        } catch (error) {
            toast({ title: "Save Failed", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading || authLoading) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }
    
     if (!user || user.role !== 'admin') {
        return <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center"><AlertTriangle className="h-12 w-12 text-destructive mb-4" /><CardTitle className="text-xl mb-2">Access Denied</CardTitle><p className="text-muted-foreground">You do not have permission to view this page.</p><Button onClick={() => router.push('/')} className="mt-4">Go to Dashboard</Button></div>;
    }

    if (error) {
        return <div className="text-center py-10"><AlertTriangle className="mx-auto h-12 w-12 text-destructive" /><p className="mt-4 text-lg">{error}</p><Button onClick={() => router.back()} className="mt-4">Go Back</Button></div>;
    }

    if (!report) {
        return <div className="text-center py-10"><p>No report data to display.</p></div>;
    }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex justify-between items-center">
             <Button variant="outline" onClick={() => router.push('/admin/purser-reports')}><ArrowLeft className="mr-2 h-4 w-4"/>Back to All Reports</Button>
             <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                {(Object.keys(statusConfig) as ReportStatus[]).map(status => (
                    <Button key={status} variant={report.status === status ? statusConfig[status].color : "ghost"} size="sm" onClick={() => handleUpdateStatus(status)} disabled={isSaving || report.status === status}>
                        {report.status === status && <CheckCircle className="mr-2 h-4 w-4" />}
                        {statusConfig[status].label}
                    </Button>
                ))}
            </div>
        </div>

        <Card className="shadow-lg">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-2xl font-headline flex items-center"><FileSignature className="mr-3 h-7 w-7 text-primary" />Purser Report: {report.flightNumber}</CardTitle>
                        <CardDescription>
                            {report.departureAirport} to {report.arrivalAirport} on {format(parseISO(report.flightDate), "PPP")}
                        </CardDescription>
                    </div>
                    <div className="text-right text-sm">
                        <p className="font-semibold">{report.userEmail}</p>
                        <p className="text-muted-foreground">Submitted: {format(report.createdAt.toDate(), "PPpp")}</p>
                    </div>
                </div>
            </CardHeader>
        </Card>
        
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-lg flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />AI-Powered Summary</CardTitle>
                    <CardDescription>A quick overview generated by AI upon submission.</CardDescription>
                </div>
            </CardHeader>
            <CardContent>
                {report.aiSummary ? (
                    <div className="space-y-4">
                        <div>
                            <h4 className="font-semibold text-base mb-1">Executive Summary</h4>
                            <p className="text-sm text-muted-foreground">{report.aiSummary}</p>
                        </div>
                        {report.aiKeyPoints && report.aiKeyPoints.length > 0 && (
                            <div>
                                <h4 className="font-semibold text-base mb-2">Key Points</h4>
                                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                                    {report.aiKeyPoints.map((point, index) => <li key={index}>{point}</li>)}
                                </ul>
                            </div>
                        )}
                        {report.aiPotentialRisks && report.aiPotentialRisks.length > 0 && (
                            <Alert variant="warning">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Potential Risks Identified</AlertTitle>
                                <AlertDescription>
                                    <ul className="list-disc list-inside">
                                        {report.aiPotentialRisks.map((risk, index) => <li key={index}>{risk}</li>)}
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">AI summary was not generated for this report.</p>
                )}
            </CardContent>
        </Card>

        <Card>
            <CardHeader><CardTitle className="text-lg">Detailed Report</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <SectionDisplay label="Crew Coordination: Positive Points" value={report.positivePoints} icon={Users} />
                <SectionDisplay label="Crew Coordination: Improvement Points" value={report.improvementPoints} icon={Users} />
                <SectionDisplay label="Action Required from Management" value={report.actionRequired} icon={AlertCircle} />
                
                <SectionDisplay label="Passengers & Cabin: Specific Passenger Types" value={report.passengersToReport} icon={PersonStanding} />
                <SectionDisplay label="Passengers & Cabin: Technical Issues" value={report.technicalIssues} icon={Wrench} />

                <SectionDisplay label="Safety & Service: Safety Checks Performed" value={report.safetyChecks} icon={Shield} />
                <SectionDisplay label="Safety & Service: Safety Anomalies" value={report.safetyAnomalies} icon={AlertTriangle} />
                <SectionDisplay label="Safety & Service: Passenger Feedback" value={report.servicePassengerFeedback} icon={MessageSquare} />

                <SectionDisplay label="Incidents: Type" value={report.incidentTypes} icon={AlertTriangle} />
                <SectionDisplay label="Incidents: Details" value={report.incidentDetails} icon={FileSignature} />
            </CardContent>
        </Card>

        <Card>
             <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle className="text-lg">Administrator Notes</CardTitle>
                {!isEditingNotes && (<Button variant="outline" size="sm" onClick={() => setIsEditingNotes(true)}><Edit className="mr-2 h-4 w-4"/>Edit Notes</Button>)}
            </CardHeader>
            <CardContent>
                {isEditingNotes ? (
                    <div className="space-y-2">
                        <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} className="min-h-[120px]" placeholder="Add internal notes here. These are not visible to the user."/>
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => {setIsEditingNotes(false); setAdminNotes(report.adminNotes || ""); }}>Cancel</Button>
                            <Button onClick={handleSaveNotes} disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                <Save className="mr-2 h-4 w-4"/>Save Notes
                            </Button>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                        {adminNotes || "No administrator notes have been added yet."}
                    </p>
                )}
            </CardContent>
        </Card>

    </div>
  )
}
