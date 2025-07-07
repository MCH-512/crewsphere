"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import { FileSignature, Loader2, AlertTriangle, ArrowLeft, Shield, HeartPulse, Utensils, AlertCircle, UserCheck, Wrench, MessageSquare, PlusCircle, CheckCircle, Edit, Save, Sparkles, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import { StoredPurserReport, optionalReportSections } from "@/schemas/purser-report-schema";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { logAuditEvent } from "@/lib/audit-logger";
import { summarizeReport, type SummarizeReportOutput } from "@/ai/flows/summarize-report-flow";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type ReportStatus = "submitted" | "under-review" | "closed";

const statusConfig: Record<ReportStatus, { label: string; color: "secondary" | "outline" | "success" }> = {
    submitted: { label: "Submitted", color: "secondary" },
    "under-review": { label: "Under Review", color: "outline" },
    closed: { label: "Closed", color: "success" },
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
    
    const [aiSummary, setAiSummary] = React.useState<SummarizeReportOutput | null>(null);
    const [isGeneratingSummary, setIsGeneratingSummary] = React.useState(false);
    const [summaryError, setSummaryError] = React.useState<string | null>(null);


    const fetchReport = React.useCallback(async () => {
        if (!reportId) return;
        setIsLoading(true);
        setError(null);
        try {
            const reportDocRef = doc(db, "purserReports", reportId);
            const docSnap = await getDoc(reportDocRef);
            if (docSnap.exists()) {
                const data = { id: docSnap.id, ...docSnap.data() } as StoredPurserReport;
                setReport(data);
                setAdminNotes(data.adminNotes || "");
            } else {
                setError("Report not found.");
                toast({ title: "Error", description: "The requested purser report could not be found.", variant: "destructive" });
            }
        } catch (err) {
            console.error("Error fetching report:", err);
            setError("Failed to load the report.");
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

    const handleGenerateSummary = async () => {
        if (!report || !user) return;
        setIsGeneratingSummary(true);
        setSummaryError(null);
        setAiSummary(null);

        try {
            const reportContent = [
                `Flight Summary: ${report.generalFlightSummary}`,
                report.crewNotes && `Crew Notes: ${report.crewNotes}`,
                report.briefingDetails && `Briefing Details: ${report.briefingDetails}`,
                report.crewTaskDistribution && `Crew Task Distribution: ${report.crewTaskDistribution}`,
                report.cateringDetails && `Catering & Service Details: ${report.cateringDetails}`,
                report.safetyIncidents && `Safety Incidents: ${report.safetyIncidents}`,
                report.securityIncidents && `Security Incidents: ${report.securityIncidents}`,
                report.medicalIncidents && `Medical Incidents: ${report.medicalIncidents}`,
                report.passengerFeedback && `Passenger Feedback: ${report.passengerFeedback}`,
                report.maintenanceIssues && `Maintenance Issues: ${report.maintenanceIssues}`,
                report.crewPerformanceNotes && `Crew Performance Notes: ${report.crewPerformanceNotes}`,
                report.otherObservations && `Other Observations: ${report.otherObservations}`,
            ].filter(Boolean).join("\n\n");

            if (reportContent.trim() === "") {
                setSummaryError("Report content is empty, cannot generate summary.");
                return;
            }

            const summary = await summarizeReport({ reportContent });
            setAiSummary(summary);
            
            await logAuditEvent({ userId: user.uid, userEmail: user.email, actionType: "GENERATE_AI_SUMMARY", entityType: "PURSER_REPORT", entityId: report.id });

            toast({ title: "AI Summary Generated", description: "The report summary has been successfully generated." });
        } catch (error: any) {
            console.error("Error generating AI summary:", error);
            setSummaryError(error.message || "An unexpected error occurred while generating the summary.");
            toast({ title: "Summary Generation Failed", variant: "destructive", description: "Could not generate AI summary." });
        } finally {
            setIsGeneratingSummary(false);
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

    const SectionDisplay = ({ name }: { name: keyof StoredPurserReport}) => {
        const config = optionalReportSections.find(s => s.name === name);
        const value = report[name as keyof typeof report];
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
                    <CardDescription>A quick overview generated by AI.</CardDescription>
                </div>
                <Button onClick={handleGenerateSummary} disabled={isGeneratingSummary}>
                    {isGeneratingSummary ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Generating...</>
                    ) : (
                        <><Sparkles className="mr-2 h-4 w-4"/>Generate Summary</>
                    )}
                </Button>
            </CardHeader>
            <CardContent>
                {isGeneratingSummary && (
                    <div className="flex items-center justify-center py-6 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin mr-3"/>
                        <p>The AI is analyzing the report. This may take a moment...</p>
                    </div>
                )}
                {summaryError && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{summaryError}</AlertDescription>
                    </Alert>
                )}
                {aiSummary && (
                    <div className="space-y-4">
                        <div>
                            <h4 className="font-semibold text-base mb-1">Executive Summary</h4>
                            <p className="text-sm text-muted-foreground">{aiSummary.summary}</p>
                        </div>
                        {aiSummary.keyPoints.length > 0 && (
                            <div>
                                <h4 className="font-semibold text-base mb-2">Key Points</h4>
                                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                                    {aiSummary.keyPoints.map((point, index) => <li key={index}>{point}</li>)}
                                </ul>
                            </div>
                        )}
                        {aiSummary.potentialRisks.length > 0 && (
                            <Alert variant="warning">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Potential Risks Identified</AlertTitle>
                                <AlertDescription>
                                    <ul className="list-disc list-inside">
                                        {aiSummary.potentialRisks.map((risk, index) => <li key={index}>{risk}</li>)}
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        )}
                        {aiSummary.keyPoints.length === 0 && aiSummary.potentialRisks.length === 0 && (
                            <p className="text-sm text-muted-foreground">The AI did not identify any specific key points or risks from this report.</p>
                        )}
                    </div>
                )}
                {!isGeneratingSummary && !summaryError && !aiSummary && (
                    <p className="text-sm text-muted-foreground text-center py-4">Click "Generate Summary" to get an AI-powered analysis of this report.</p>
                )}
            </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
                <CardHeader><CardTitle className="text-lg">Flight Details</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                    <p><strong>Aircraft:</strong> {report.aircraftTypeRegistration}</p>
                    <p><strong>Total Passengers:</strong> {report.passengerLoad.total}</p>
                    <p><strong>Adults:</strong> {report.passengerLoad.adults}</p>
                    <p><strong>Infants:</strong> {report.passengerLoad.infants}</p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Users />Crew on Duty</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                   {report.crewRoster?.map(member => (
                    <div key={member.uid} className="flex justify-between">
                        <span>{member.name}</span>
                        <Badge variant="secondary" className="capitalize">{member.role}</Badge>
                    </div>
                   ))}
                   {report.crewNotes && <p className="text-xs text-muted-foreground pt-2 border-t mt-2"><strong>Notes:</strong> {report.crewNotes}</p>}
                </CardContent>
            </Card>
        </div>

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
                {optionalReportSections.every(s => !report[s.name as keyof typeof report]) && <p className="text-muted-foreground text-sm">No optional sections were filled out for this report.</p>}
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
