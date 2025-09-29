"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import { FileSignature, Loader2, AlertTriangle, ArrowLeft, Shield, UserCheck, Wrench, MessageSquare, CheckCircle, Sparkles, Users, PersonStanding } from "lucide-react";
import { format, parseISO } from "date-fns";
import { StoredPurserReport } from "@/schemas/purser-report-schema";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { logAuditEvent } from "@/lib/audit-logger";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { VariantProps } from "class-variance-authority";
import { Edit, Save } from "lucide-react";

type ReportStatus = "submitted" | "under-review" | "closed";

const statusConfig: Record&lt;ReportStatus, { label: string; color: "secondary" | "outline" | "success" }&gt; = {
    submitted: { label: "Submitted", color: "secondary" },
    "under-review": { label: "Under Review", color: "outline" },
    closed: { label: "Closed", color: "success" },
};

const SectionDisplay = ({ label, value, icon: Icon }: { label: string; value?: string | string[] | null | boolean; icon: React.ElementType }) =&gt; {
    if (value === undefined || value === null || (Array.isArray(value) &amp;&amp; value.length === 0)) return null;

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
        &lt;div className="space-y-1"&gt;
            &lt;h4 className="font-semibold text-base flex items-center gap-2"&gt;&lt;Icon className="h-4 w-4 text-primary"/&gt;{label}&lt;/h4&gt;
            &lt;p className="text-sm text-muted-foreground whitespace-pre-wrap p-3 rounded-md bg-muted/50 border"&gt;{displayValue}&lt;/p&gt;
        &lt;/div&gt;
    );
};

export default function PurserReportDetailPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();
    const reportId = params.reportId as string;

    const [report, setReport] = React.useState&lt;StoredPurserReport | null&gt;(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState&lt;string | null&gt;(null);
    const [isEditingNotes, setIsEditingNotes] = React.useState(false);
    const [adminNotes, setAdminNotes] = React.useState("");
    const [isSaving, setIsSaving] = React.useState(false);

    const fetchReport = React.useCallback(async () =&gt; {
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
        } catch (err) {
            const e = err as Error;
            console.error("Error fetching report:", e);
            setError(e.message || "Failed to load the report.");
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [reportId, toast]);

    React.useEffect(() =&gt; {
        if (!authLoading) {
            if (!user || user.role !== 'admin') {
                router.push('/');
            } else {
                fetchReport();
            }
        }
    }, [user, authLoading, router, fetchReport]);

    const handleUpdateStatus = async (newStatus: ReportStatus) =&gt; {
        if (!report || !user) return;
        setIsSaving(true);
        try {
            const reportRef = doc(db, "purserReports", report.id);
            await updateDoc(reportRef, { status: newStatus });
            setReport(prev =&gt; prev ? { ...prev, status: newStatus } : null);
            await logAuditEvent({ userId: user.uid, userEmail: user.email!, actionType: "UPDATE_REPORT_STATUS", entityType: "PURSER_REPORT", entityId: report.id, details: { oldStatus: report.status, newStatus } });
            toast({ title: "Status Updated", description: `Report status changed to "${statusConfig[newStatus].label}".` });
        } catch (error: unknown) {
            toast({ title: "Update Failed", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleSaveNotes = async () =&gt; {
        if (!report || !user) return;
        setIsSaving(true);
        try {
            const reportRef = doc(db, "purserReports", report.id);
            await updateDoc(reportRef, { adminNotes });
            setReport(prev =&gt; prev ? { ...prev, adminNotes } : null);
            await logAuditEvent({ userId: user.uid, userEmail: user.email!, actionType: "UPDATE_REPORT_NOTES", entityType: "PURSER_REPORT", entityId: report.id });
            toast({ title: "Notes Saved", description: "Administrator notes have been successfully saved." });
            setIsEditingNotes(false);
        } catch (error: unknown) {
            toast({ title: "Save Failed", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading || authLoading) {
        return &lt;div className="flex items-center justify-center min-h-[calc(100vh-200px)]"&gt;&lt;Loader2 className="h-12 w-12 animate-spin text-primary" /&gt;&lt;/div&gt;;
    }
    
     if (!user || user.role !== 'admin') {
        return &lt;div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center"&gt;&lt;AlertTriangle className="h-12 w-12 text-destructive mb-4" /&gt;&lt;CardTitle className="text-xl mb-2"&gt;Access Denied&lt;/CardTitle&gt;&lt;p className="text-muted-foreground"&gt;You do not have permission to view this page.&lt;/p&gt;&lt;Button onClick={() =&gt; router.push('/')} className="mt-4"&gt;Go to Dashboard&lt;/Button&gt;&lt;/div&gt;;
    }

    if (error) {
        return &lt;div className="text-center py-10"&gt;&lt;AlertTriangle className="mx-auto h-12 w-12 text-destructive" /&gt;&lt;p className="mt-4 text-lg"&gt;{error}&lt;/p&gt;&lt;Button onClick={() =&gt; router.back()} className="mt-4"&gt;Go Back&lt;/Button&gt;&lt;/div&gt;;
    }

    if (!report) {
        return &lt;div className="text-center py-10"&gt;&lt;p&gt;No report data to display.&lt;/p&gt;&lt;/div&gt;;
    }

  return (
    &lt;div className="space-y-6 max-w-4xl mx-auto"&gt;
        &lt;div className="flex justify-between items-center"&gt;
             &lt;Button variant="outline" onClick={() =&gt; router.push('/admin/purser-reports')}&gt;&lt;ArrowLeft className="mr-2 h-4 w-4"/&gt;Back to All Reports&lt;/Button&gt;
             &lt;div className="flex items-center gap-2"&gt;
                &lt;span className="text-sm text-muted-foreground"&gt;Status:&lt;/span&gt;
                {(Object.keys(statusConfig) as ReportStatus[]).map(status =&gt; (
                    &lt;Button key={status} variant={report.status === status ? statusConfig[status].color : "ghost"} size="sm" onClick={() =&gt; handleUpdateStatus(status)} disabled={isSaving || report.status === status}&gt;
                        {report.status === status &amp;&amp; &lt;CheckCircle className="mr-2 h-4 w-4" /&gt;}
                        {statusConfig[status].label}
                    &lt;/Button&gt;
                ))}&lt;/div&gt;
        &lt;/div&gt;

        &lt;Card className="shadow-lg"&gt;
            &lt;CardHeader&gt;
                &lt;div className="flex justify-between items-start"&gt;
                    &lt;div&gt;
                        &lt;CardTitle className="text-2xl font-headline flex items-center"&gt;&lt;FileSignature className="mr-3 h-7 w-7 text-primary" /&gt;Purser Report: {report.flightNumber}&lt;/CardTitle&gt;
                        &lt;CardDescription&gt;
                            {report.departureAirport} to {report.arrivalAirport} on {format(parseISO(report.flightDate), "PPP")}
                        &lt;/CardDescription&gt;
                    &lt;/div&gt;
                    &lt;div className="text-right text-sm"&gt;
                        &lt;p className="font-semibold"&gt;{report.userEmail}&lt;/p&gt;
                        &lt;p className="text-muted-foreground"&gt;Submitted: {format(report.createdAt.toDate(), "PPpp")}&lt;/p&gt;
                    &lt;/div&gt;
                &lt;/div&gt;
            &lt;/CardHeader&gt;
        &lt;/Card&gt;
        
        &lt;Card&gt;
            &lt;CardHeader&gt;&lt;CardTitle className="text-lg"&gt;Detailed Report&lt;/CardTitle&gt;&lt;/CardHeader&gt;
            &lt;CardContent className="space-y-4"&gt;
                &lt;SectionDisplay label="Crew Coordination: Positive Points" value={report.positivePoints} icon={Users} /&gt;
                &lt;SectionDisplay label="Crew Coordination: Improvement Points" value={report.improvementPoints} icon={Users} /&gt;
                &lt;SectionDisplay label="Action Required from Management" value={report.actionRequired} icon={UserCheck} /&gt;
                
                &lt;SectionDisplay label="Passengers &amp; Cabin: Specific Passenger Types" value={report.passengersToReport} icon={PersonStanding} /&gt;
                &lt;SectionDisplay label="Passengers &amp; Cabin: Technical Issues" value={report.technicalIssues} icon={Wrench} /&gt;

                &lt;SectionDisplay label="Safety &amp; Service: Safety Checks Performed" value={report.safetyChecks} icon={Shield} /&gt;
                &lt;SectionDisplay label="Safety &amp; Service: Safety Anomalies" value={report.safetyAnomalies} icon={AlertTriangle} /&gt;
                &lt;SectionDisplay label="Safety &amp; Service: Passenger Feedback" value={report.servicePassengerFeedback} icon={MessageSquare} /&gt;

                &lt;SectionDisplay label="Incidents: Type" value={report.incidentTypes} icon={AlertTriangle} /&gt;
                &lt;SectionDisplay label="Incidents: Details" value={report.incidentDetails} icon={FileSignature} /&gt;
            &lt;/CardContent&gt;
        &lt;/Card&gt;

        &lt;Card&gt;
             &lt;CardHeader className="flex flex-row justify-between items-center"&gt;
                &lt;CardTitle className="text-lg"&gt;Administrator Notes&lt;/CardTitle&gt;
            &lt;/CardHeader&gt;
            &lt;CardContent&gt;
                &lt;p className="text-sm whitespace-pre-wrap text-muted-foreground"&gt;
                    {report.adminNotes || "No administrator notes have been added yet."}
                &lt;/p&gt;
            &lt;/CardContent&gt;
        &lt;/Card&gt;

    &lt;/div&gt;
  )
}
