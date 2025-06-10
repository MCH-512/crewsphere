
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
import { collection, getDocs, query, orderBy, Timestamp, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { FileText, Loader2, AlertTriangle, RefreshCw, Eye, Inbox } from "lucide-react";
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

export default function MyPurserReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [reports, setReports] = React.useState<StoredPurserReport[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [selectedReport, setSelectedReport] = React.useState<StoredPurserReport | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = React.useState(false);

  const fetchReports = React.useCallback(async () => {
    if (!user) {
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, "purserReports"), 
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const fetchedReports = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as StoredPurserReport));
      setReports(fetchedReports);
    } catch (err) {
      console.error("Error fetching user's purser reports:", err);
      setError("Failed to load your purser reports. Please try again.");
      toast({ title: "Loading Error", description: "Could not fetch your purser reports.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  React.useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login'); 
      } else {
        fetchReports();
      }
    }
  }, [user, authLoading, router, fetchReports]);

  const handleOpenViewDialog = (report: StoredPurserReport) => {
    setSelectedReport(report);
    setIsViewDialogOpen(true);
  };

  if (authLoading || (isLoading && !user)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading your reports...</p>
      </div>
    );
  }
  
  if (!user && !authLoading) {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <CardTitle className="text-xl mb-2">Access Denied</CardTitle>
        <p className="text-muted-foreground">Please log in to view your submitted reports.</p>
        <Button onClick={() => router.push('/login')} className="mt-4">Go to Login</Button>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row justify-between items-start">
          <div>
            <CardTitle className="text-2xl font-headline flex items-center">
              <Inbox className="mr-3 h-7 w-7 text-primary" />
              My Submitted Purser Reports
            </CardTitle>
            <CardDescription>View all Purser Reports you have submitted.</CardDescription>
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
                <p className="ml-3 text-muted-foreground">Loading your reports...</p>
            </div>
          )}
          {!isLoading && reports.length === 0 && !error && (
            <p className="text-muted-foreground text-center py-8">You have not submitted any purser reports yet.</p>
          )}
          {reports.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Submitted At</TableHead>
                    <TableHead>Flight No.</TableHead>
                    <TableHead>Flight Date</TableHead>
                    <TableHead>Route</TableHead>
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
          <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>
                Purser Report: {selectedReport.reportInput.flightNumber} ({selectedReport.reportInput.departureAirport} - {selectedReport.reportInput.arrivalAirport})
              </DialogTitle>
              <DialogDescription>
                Submitted by you on {format(selectedReport.createdAt.toDate(), "PPpp")}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-grow pr-6">
              <div className="py-4 space-y-6">
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

                <div>
                  <h3 className="font-semibold text-lg mb-2">Your Submitted Input Details:</h3>
                  <Card className="bg-background/50">
                    <CardContent className="pt-4 space-y-3 text-sm">
                       <p><strong>Flight Number:</strong> {selectedReport.reportInput.flightNumber}</p>
                       <p><strong>Date:</strong> {format(new Date(selectedReport.reportInput.flightDate), "PPP")}</p>
                       <p><strong>Route:</strong> {selectedReport.reportInput.departureAirport} - {selectedReport.reportInput.arrivalAirport}</p>
                       <p><strong>Aircraft:</strong> {selectedReport.reportInput.aircraftTypeRegistration}</p>
                       <p><strong>Passenger Load:</strong> Total: {selectedReport.reportInput.passengerLoad.total}, Adults: {selectedReport.reportInput.passengerLoad.adults}, Children: {selectedReport.reportInput.passengerLoad.children}, Infants: {selectedReport.reportInput.passengerLoad.infants}</p>
                       <div>
                         <p><strong>Crew Members:</strong></p>
                         <pre className="text-xs bg-muted p-2 rounded-md whitespace-pre-wrap">{selectedReport.reportInput.crewMembers}</pre>
                       </div>
                       <div className="border-t pt-2 mt-2">
                           <Label className="font-medium">General Flight Summary:</Label>
                           <p className="text-muted-foreground whitespace-pre-wrap">{selectedReport.reportInput.generalFlightSummary}</p>
                       </div>
                      
                       {Object.entries(selectedReport.reportInput).map(([key, value]) => {
                         if (typeof value === 'string' && value.trim() !== "" && !['flightNumber', 'flightDate', 'departureAirport', 'arrivalAirport', 'aircraftTypeRegistration', 'crewMembers', 'generalFlightSummary'].includes(key) && value !== undefined && value !== null) {
                           const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                           return (
                             <div key={key} className="border-t pt-2 mt-2">
                               <Label className="font-medium">{label}:</Label>
                               <p className="text-muted-foreground whitespace-pre-wrap">{value}</p>
                             </div>
                           );
                         }
                         return null;
                       })}
                    </CardContent>
                  </Card>
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
