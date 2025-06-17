
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp, doc, deleteDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Plane, Loader2, AlertTriangle, RefreshCw, Edit, Trash2, PlusCircle, CheckCircle, XCircle, FileText } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Flight {
  id: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  scheduledDepartureDateTimeUTC: string; // Stored as ISO string
  scheduledArrivalDateTimeUTC: string; // Stored as ISO string
  aircraftType: string;
  status: "Scheduled" | "On Time" | "Delayed" | "Cancelled";
  purserReportSubmitted?: boolean; // New field
  purserReportId?: string | null; // New field
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export default function AdminFlightsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [flights, setFlights] = React.useState<Flight[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [flightToDelete, setFlightToDelete] = React.useState<Flight | null>(null);

  const fetchFlights = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const q = query(collection(db, "flights"), orderBy("scheduledDepartureDateTimeUTC", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedFlights = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Flight));
      setFlights(fetchedFlights);
    } catch (err) {
      console.error("Error fetching flights:", err);
      setError("Failed to load flights. Please try again.");
      toast({ title: "Loading Error", description: "Could not fetch flights.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'admin') {
        router.push('/'); 
      } else {
        fetchFlights();
      }
    }
  }, [user, authLoading, router, fetchFlights]);

  const handleDeleteFlight = async () => {
    if (!flightToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "flights", flightToDelete.id));
      toast({ title: "Flight Deleted", description: `Flight ${flightToDelete.flightNumber} has been deleted.` });
      fetchFlights(); // Refresh the list
      setFlightToDelete(null); // Close dialog
    } catch (error) {
      console.error("Error deleting flight:", error);
      toast({ title: "Deletion Failed", description: "Could not delete the flight.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadgeVariant = (status: Flight["status"]): "secondary" | "default" | "outline" | "destructive" => {
    switch (status) {
      case "Scheduled": return "secondary";
      case "On Time": return "default"; 
      case "Delayed": return "outline"; 
      case "Cancelled": return "destructive";
      default: return "secondary";
    }
  };

  const formatDateTime = (isoString: string) => {
    try {
      return format(new Date(isoString), "MMM d, yyyy HH:mm 'UTC'");
    } catch (e) {
      return "Invalid Date";
    }
  };

  const handleViewReport = (reportId: string | null | undefined) => {
    if (reportId) {
      // For now, just toast. Later, this could navigate to a report view page.
      // router.push(`/admin/purser-reports/${reportId}`); // Example future navigation
      toast({ title: "View Report", description: `Report ID: ${reportId}. Viewing specific report details is not yet implemented on this button.` });
    } else {
      toast({ title: "No Report", description: "No report ID associated with this flight." });
    }
  };


  if (authLoading || (isLoading && flights.length === 0 && !user)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading flights...</p>
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
    <TooltipProvider>
      <div className="space-y-6">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row justify-between items-start">
            <div>
              <CardTitle className="text-2xl font-headline flex items-center">
                <Plane className="mr-3 h-7 w-7 text-primary" />
                Manage Flights
              </CardTitle>
              <CardDescription>View all scheduled and active flights in the system.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchFlights} disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh Flights
              </Button>
              <Button asChild>
                <Link href="/admin/flights/create">
                  <PlusCircle className="mr-2 h-4 w-4" /> Create New Flight
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="p-4 mb-4 text-sm text-destructive-foreground bg-destructive rounded-md flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> {error}
              </div>
            )}
            {isLoading && flights.length === 0 && (
               <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="ml-3 text-muted-foreground">Loading flight list...</p>
              </div>
            )}
            {!isLoading && flights.length === 0 && !error && (
              <p className="text-muted-foreground text-center py-8">No flights found. Click the "Create New Flight" button to add one.</p>
            )}
            {flights.length > 0 && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Flight No.</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Aircraft</TableHead>
                      <TableHead>Departure (UTC)</TableHead>
                      <TableHead>Arrival (UTC)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Purser Report</TableHead> 
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {flights.map((flight) => (
                      <TableRow key={flight.id}>
                        <TableCell className="font-medium">{flight.flightNumber}</TableCell>
                        <TableCell>{flight.departureAirport} - {flight.arrivalAirport}</TableCell>
                        <TableCell>{flight.aircraftType}</TableCell>
                        <TableCell>{formatDateTime(flight.scheduledDepartureDateTimeUTC)}</TableCell>
                        <TableCell>{formatDateTime(flight.scheduledArrivalDateTimeUTC)}</TableCell>
                        <TableCell>
                          <Badge 
                              variant={getStatusBadgeVariant(flight.status)}
                          >
                            {flight.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {flight.purserReportSubmitted ? (
                            <div className="flex items-center gap-1">
                              <Badge variant="success">
                                  <CheckCircle className="mr-1 h-3 w-3" /> Submitted
                              </Badge>
                              {flight.purserReportId && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleViewReport(flight.purserReportId)}>
                                        <FileText className="h-4 w-4 text-primary"/>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent><p>View Submitted Report</p></TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          ) : (
                            <Badge variant="secondary">
                              <XCircle className="mr-1 h-3 w-3" /> Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" asChild aria-label={`Edit flight: ${flight.flightNumber}`}>
                                <Link href={`/admin/flights/edit/${flight.id}`}>
                                  <Edit className="mr-1 h-4 w-4" /> Edit
                                </Link>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Edit details for flight {flight.flightNumber}</p></TooltipContent>
                          </Tooltip>
                          <AlertDialog>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertDialogTrigger asChild>
                                 <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive/80" onClick={() => setFlightToDelete(flight)} aria-label={`Delete flight: ${flight.flightNumber}`}>
                                  <Trash2 className="mr-1 h-4 w-4" /> Delete
                                </Button>
                                </AlertDialogTrigger>
                              </TooltipTrigger>
                              <TooltipContent><p>Delete flight {flight.flightNumber}</p></TooltipContent>
                            </Tooltip>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete flight {flightToDelete?.flightNumber} ({flightToDelete?.departureAirport} - {flightToDelete?.arrivalAirport})? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setFlightToDelete(null)} disabled={isDeleting}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteFlight} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
