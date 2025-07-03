
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardCheck, Loader2, AlertTriangle, RefreshCw, Eye } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { type StoredPurserReport } from "@/schemas/purser-report-schema";
import { Separator } from "@/components/ui/separator";

// Helper component for displaying a report section only if it has content
const ReportSection = ({ label, content }: { label: string; content?: string | null }) => {
  if (!content || content.trim() === "") {
    return null;
  }
  return (
    <div>
      <Label className="font-semibold text-base">{label}</Label>
      <div className="text-sm whitespace-pre-wrap p-3 mt-1 bg-muted/50 rounded-md border text-foreground/80">
        {content}
      </div>
    </div>
  );
};


export default function AdminPurserReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [reports, setReports] = React.useState<StoredPurserReport[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [selectedReport, setSelectedReport] = React.useState<StoredPurserReport | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = React.useState(false);

  const fetchReports = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const q = query(collection(db, "purserReports"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedReports = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as StoredPurserReport));
      setReports(fetchedReports);
    } catch (err) {
      console.error("Error fetching purser reports:", err);
      setError("Failed to load purser reports. Please try again.");
      toast({ title: "Loading Error", description: "Could not fetch purser reports.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'admin') {
        router.push('/'); 
      } else {
        fetchReports();
      }
    }
  }, [user, authLoading, router, fetchReports]);

  React.useEffect(() => {
    const reportIdFromQuery = searchParams.get("reportId");
  
    if (reportIdFromQuery && !isLoading && reports.length > 0) {
      const foundReport = reports.find(r => r.id === reportIdFromQuery);
      if (foundReport) {
        setSelectedReport(foundReport);
        setIsViewDialogOpen(true);
      } else {
        toast({
          title: "Report Not Found",
          description: `Could not find a purser report with ID: ${reportIdFromQuery}`,
          variant: "warning",
        });
      }
      // Clean up URL after processing
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('reportId');
      router.replace(newUrl.toString(), { scroll: false });
    }
  }, [searchParams, reports, isLoading, router, toast]);


  const handleOpenViewDialog = (report: StoredPurserReport) => {
    setSelectedReport(report);
    setIsViewDialogOpen(true);
  };

  if (authLoading || (isLoading && reports.length === 0 && !user)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading reports...</p>
      </div>
    );
  }
  
  if (!user || user.role !== 'admin') {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <CardTitle className="text-xl mb-2">Access Denied</CardTitle>
        <p className="text-muted-foreground">You do not have permission to view this page.</p>
        <Button onClick={() => router.push('/')} className="mt-4">Go to Dashboard</Button>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row justify-between items-start">
          <div>
            <CardTitle className="text-2xl font-headline flex items-center">
              <ClipboardCheck className="mr-3 h-7 w-7 text-primary" />
              Submitted Purser Reports
            </CardTitle>
            <CardDescription>Review all Purser Reports submitted by crew.</CardDescription>
          </div>
          <Button variant="outline" onClick={fetchReports} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="p-4 mb-4 text-sm text-destructive-foreground bg-destructive rounded-md flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> {error}
            </div>
          )}
           {isLoading && reports.length === 0 && (
             <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Loading reports...</p>
            </div>
          )}
          {!isLoading && reports.length === 0 && !error && (
            <p className="text-muted-foreground text-center py-8">No purser reports found at this time.</p>
          )}
          {reports.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Flight No.</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Submitted By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>
                        {report.createdAt ? format(report.createdAt.toDate(), "PPp") : 'N/A'}
                      </TableCell>
                      <TableCell className="font-medium">{report.flightNumber}</TableCell>
                      <TableCell>{report.flightDate && !isNaN(new Date(report.flightDate).getTime()) ? format(new Date(report.flightDate), "PPP") : 'N/A'}</TableCell>
                      <TableCell>{report.departureAirport} - {report.arrivalAirport}</TableCell>
                      <TableCell>{report.userEmail}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenViewDialog(report)}>
                          <Eye className="mr-1 h-4 w-4" /> View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedReport && (
        <Dialog open={isViewDialogOpen} onOpenChange={(open) => { setIsViewDialogOpen(open); if (!open) setSelectedReport(null); }}>
          <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>
                Purser Report: {selectedReport.flightNumber} ({selectedReport.departureAirport} - {selectedReport.arrivalAirport})
              </DialogTitle>
              <DialogDescription>
                Submitted by: {selectedReport.userEmail} on {format(selectedReport.createdAt.toDate(), "PPpp")}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-grow pr-6">
                <div className="py-4 space-y-4">
                    <Card>
                        <CardHeader className="pb-3"><CardTitle className="text-lg">Flight & Passenger Details</CardTitle></CardHeader>
                        <CardContent className="text-sm space-y-3">
                            <p><strong>Aircraft:</strong> {selectedReport.aircraftTypeRegistration}</p>
                            <p><strong>Total Passengers:</strong> {selectedReport.passengerLoad?.total ?? 'N/A'} (Adults: {selectedReport.passengerLoad?.adults ?? 'N/A'}, Infants: {selectedReport.passengerLoad?.infants ?? 'N/A'})</p>
                            <div>
                                <Label className="font-medium">Crew Members:</Label>
                                <p className="text-muted-foreground whitespace-pre-wrap text-xs p-2 bg-muted rounded-md mt-1">{selectedReport.crewMembers}</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                         <CardHeader className="pb-3"><CardTitle className="text-lg">General Flight Summary</CardTitle></CardHeader>
                         <CardContent>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedReport.generalFlightSummary}</p>
                         </CardContent>
                    </Card>
                    
                    <Separator />
                    
                     <div className="space-y-4">
                        <h3 className="text-xl font-semibold">Detailed Observations</h3>
                        
                        <ReportSection label="Safety Incidents" content={selectedReport.safetyIncidents} />
                        <ReportSection label="Security Incidents" content={selectedReport.securityIncidents} />
                        <ReportSection label="Medical Incidents" content={selectedReport.medicalIncidents} />
                        <ReportSection label="Passenger Feedback" content={selectedReport.passengerFeedback} />
                        <ReportSection label="Catering Notes" content={selectedReport.cateringNotes} />
                        <ReportSection label="Maintenance Issues" content={selectedReport.maintenanceIssues} />
                        <ReportSection label="Crew Performance Notes" content={selectedReport.crewPerformanceNotes} />
                        <ReportSection label="Other Observations" content={selectedReport.otherObservations} />
                    </div>
                </div>
            </ScrollArea>
            <DialogFooter className="mt-auto pt-4 border-t">
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
