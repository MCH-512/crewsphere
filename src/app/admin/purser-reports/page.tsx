
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
import type { PurserReportInput, PurserReportOutput } from "@/ai/flows/purser-report-flow";
import ReactMarkdown from 'react-markdown';

interface StoredPurserReport {
  id: string;
  reportInput: PurserReportInput;
  reportOutput: PurserReportOutput;
  userId: string;
  userEmail: string;
  createdAt: Timestamp;
  status: string; // e.g. "submitted", "reviewed", "archived"
}

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
      // Clear the query parameter to prevent re-triggering and clean URL
      router.replace('/admin/purser-reports', { scroll: false });
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
                      <TableCell className="font-medium">{report.reportInput.flightNumber}</TableCell>
                      <TableCell>{format(new Date(report.reportInput.flightDate), "PPP")}</TableCell>
                      <TableCell>{report.reportInput.departureAirport} - {report.reportInput.arrivalAirport}</TableCell>
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
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[90vh] grid grid-rows-[auto_minmax(0,1fr)_auto] p-0">
            <DialogHeader className="p-6 pb-0">
              <DialogTitle>
                Purser Report: {selectedReport.reportInput.flightNumber} ({selectedReport.reportInput.departureAirport} - {selectedReport.reportInput.arrivalAirport})
              </DialogTitle>
              <DialogDescription>
                Submitted by: {selectedReport.userEmail} on {format(selectedReport.createdAt.toDate(), "PPpp")}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="min-h-0">
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-2">Key Highlights (AI Generated):</h3>
                  {selectedReport.reportOutput.keyHighlights && selectedReport.reportOutput.keyHighlights.length > 0 ? (
                    <ul className="list-disc pl-5 space-y-1 text-sm bg-secondary/30 p-3 rounded-md">
                      {selectedReport.reportOutput.keyHighlights.map((highlight, index) => (
                        <li key={index}>{highlight}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No key highlights identified by AI.</p>
                  )}
                </div>
                
                <div>
                  <h3 className="font-semibold text-lg mb-2">Full AI Generated Report:</h3>
                  <div className="prose prose-sm max-w-none dark:prose-invert text-foreground p-4 border rounded-md bg-background">
                    <ReactMarkdown>{selectedReport.reportOutput.formattedReport}</ReactMarkdown>
                  </div>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">User Submitted Input Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                       <p><strong>Flight Number:</strong> {selectedReport.reportInput.flightNumber}</p>
                       <p><strong>Date:</strong> {format(new Date(selectedReport.reportInput.flightDate), "PPP")}</p>
                       <p><strong>Route:</strong> {selectedReport.reportInput.departureAirport} - {selectedReport.reportInput.arrivalAirport}</p>
                       <p><strong>Aircraft:</strong> {selectedReport.reportInput.aircraftTypeRegistration}</p>
                       <p><strong>Passenger Load:</strong> Total: {selectedReport.reportInput.passengerLoad.total}, Adults: {selectedReport.reportInput.passengerLoad.adults}, Infants: {selectedReport.reportInput.passengerLoad.infants}</p>
                    </div>
                    <div>
                      <p><strong>Crew Members:</strong></p>
                      <pre className="text-xs bg-muted p-2 rounded-md whitespace-pre-wrap">{selectedReport.reportInput.crewMembers}</pre>
                    </div>
                    <div className="border-t pt-2 mt-2">
                       <Label className="font-medium">General Flight Summary:</Label>
                       <p className="text-muted-foreground whitespace-pre-wrap">{selectedReport.reportInput.generalFlightSummary}</p>
                    </div>
                   
                    {selectedReport.reportInput.safetyIncidents && <div className="border-t pt-2 mt-2"><Label className="font-medium">Safety Incidents:</Label><p className="text-muted-foreground whitespace-pre-wrap">{selectedReport.reportInput.safetyIncidents}</p></div>}
                    {selectedReport.reportInput.securityIncidents && <div className="border-t pt-2 mt-2"><Label className="font-medium">Security Incidents:</Label><p className="text-muted-foreground whitespace-pre-wrap">{selectedReport.reportInput.securityIncidents}</p></div>}
                    {selectedReport.reportInput.medicalIncidents && <div className="border-t pt-2 mt-2"><Label className="font-medium">Medical Incidents:</Label><p className="text-muted-foreground whitespace-pre-wrap">{selectedReport.reportInput.medicalIncidents}</p></div>}
                    {selectedReport.reportInput.passengerFeedback && <div className="border-t pt-2 mt-2"><Label className="font-medium">Passenger Feedback:</Label><p className="text-muted-foreground whitespace-pre-wrap">{selectedReport.reportInput.passengerFeedback}</p></div>}
                    {selectedReport.reportInput.cateringNotes && <div className="border-t pt-2 mt-2"><Label className="font-medium">Catering Notes:</Label><p className="text-muted-foreground whitespace-pre-wrap">{selectedReport.reportInput.cateringNotes}</p></div>}
                    {selectedReport.reportInput.maintenanceIssues && <div className="border-t pt-2 mt-2"><Label className="font-medium">Maintenance Issues:</Label><p className="text-muted-foreground whitespace-pre-wrap">{selectedReport.reportInput.maintenanceIssues}</p></div>}
                    {selectedReport.reportInput.otherObservations && <div className="border-t pt-2 mt-2"><Label className="font-medium">Other Observations:</Label><p className="text-muted-foreground whitespace-pre-wrap">{selectedReport.reportInput.otherObservations}</p></div>}
                    {selectedReport.reportInput.crewPerformanceNotes && <div className="border-t pt-2 mt-2"><Label className="font-medium">Crew Performance Notes:</Label><p className="text-muted-foreground whitespace-pre-wrap">{selectedReport.reportInput.crewPerformanceNotes}</p></div>}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
            <DialogFooter className="p-6 pt-0">
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
