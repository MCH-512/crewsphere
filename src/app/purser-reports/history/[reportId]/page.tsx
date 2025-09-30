import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { ArrowLeft, Shield, AlertCircle, UserCheck, Wrench, MessageSquare, CheckCircle, Users, PersonStanding, Plane, AlertTriangle, FileSignature } from "lucide-react";
import { format, parseISO } from "date-fns";
import { StoredPurserReport } from "@/schemas/purser-report-schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { VariantProps } from "class-variance-authority";
import { alertVariants } from "@/components/ui/alert";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from 'zod';

// Zod schema for functions that take no arguments
const EmptySchema = z.object({});


type ReportStatus = "submitted" | "under-review" | "closed";

const getStatusBadgeVariant = (status: ReportStatus) => {
    switch (status) {
        case "submitted": return "secondary";
        case "under-review": return "outline";
        case "closed": return "success";
        default: return "secondary";
    }
};

const getAdminResponseAlertVariant = (status: ReportStatus): VariantProps<typeof alertVariants>["variant"] => {
    switch (status) {
      case "closed": return "success";
      case "approved": return "success";
      case "rejected": return "destructive";
      default: return "info";
    }
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

async function getReportData(reportId: string) {
    const authUser = await getCurrentUser();
    if (!authUser) {
      redirect('/login');
    }

    const reportDocRef = doc(db, "purserReports", reportId);
    const docSnap = await getDoc(reportDocRef);

    if (!docSnap.exists()) {
       notFound();
    }

    const report = { id: docSnap.id, ...docSnap.data() } as StoredPurserReport;
    
    // Security check
    if (report.userId !== authUser.uid && authUser.role !== 'admin') {
      redirect('/purser-reports/history');
    }
    
    return report;
}


export default async function PurserReportHistoryDetailPage({ params }: { params: { reportId: string } }) {
    EmptySchema.parse({});
    const report = await getReportData(params.reportId);

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <Button variant="outline" asChild>
                <Link href="/purser-reports/history"><ArrowLeft className="mr-2 h-4 w-4"/>Back to History</Link>
            </Button>
            
            <Card className="shadow-lg">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-2xl font-headline flex items-center">Report for Flight {report.flightNumber}</CardTitle>
                            <CardDescription>
                                {report.departureAirport} → {report.arrivalAirport} on {format(parseISO(report.flightDate), "PPP")}
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
        </div>
    );
}
