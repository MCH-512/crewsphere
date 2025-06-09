
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlaneTakeoff, Briefcase, Users, MapPin, Loader2, AlertTriangle, PlusCircle, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, where, doc, getDoc, Timestamp, orderBy } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Flight {
  id: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  scheduledDepartureDateTimeUTC: string; // Stored as ISO string
  scheduledArrivalDateTimeUTC: string; // Stored as ISO string
  aircraftType: string;
  status: "Scheduled" | "On Time" | "Delayed" | "Cancelled";
}

interface UserFlightAssignment {
  id: string; // Document ID from userFlightAssignments
  userId: string;
  flightId: string;
  assignedAt: Timestamp;
  flightDetails?: Flight; // Populated after fetching
}

export default function SchedulePage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date());
  const [month, setMonth] = React.useState<Date>(new Date());

  const [assignedFlightsData, setAssignedFlightsData] = React.useState<UserFlightAssignment[]>([]);
  const [availableFlightsData, setAvailableFlightsData] = React.useState<Flight[]>([]);
  
  const [isLoadingAssigned, setIsLoadingAssigned] = React.useState(true);
  const [isLoadingAvailable, setIsLoadingAvailable] = React.useState(true);
  const [assigningFlightId, setAssigningFlightId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const fetchAssignedFlights = React.useCallback(async () => {
    if (!user) {
      setAssignedFlightsData([]);
      setIsLoadingAssigned(false);
      return;
    }
    setIsLoadingAssigned(true);
    try {
      const assignmentsQuery = query(collection(db, "userFlightAssignments"), where("userId", "==", user.uid));
      const assignmentsSnapshot = await getDocs(assignmentsQuery);
      const populatedAssignments: UserFlightAssignment[] = [];

      for (const assignmentDoc of assignmentsSnapshot.docs) {
        const assignmentData = assignmentDoc.data();
        const flightDocRef = doc(db, "flights", assignmentData.flightId);
        const flightDocSnap = await getDoc(flightDocRef);
        if (flightDocSnap.exists()) {
          populatedAssignments.push({
            id: assignmentDoc.id,
            userId: assignmentData.userId,
            flightId: assignmentData.flightId,
            assignedAt: assignmentData.assignedAt,
            flightDetails: { id: flightDocSnap.id, ...flightDocSnap.data() } as Flight,
          });
        }
      }
      setAssignedFlightsData(populatedAssignments.sort((a, b) => 
        new Date(a.flightDetails!.scheduledDepartureDateTimeUTC).getTime() - new Date(b.flightDetails!.scheduledDepartureDateTimeUTC).getTime()
      ));
    } catch (err) {
      console.error("Error fetching assigned flights:", err);
      setError("Failed to load your assigned flights.");
      toast({ title: "Error", description: "Could not load assigned flights.", variant: "destructive" });
    } finally {
      setIsLoadingAssigned(false);
    }
  }, [user, toast]);

  const fetchAvailableFlights = React.useCallback(async () => {
    if (!user) {
      setAvailableFlightsData([]);
      setIsLoadingAvailable(false);
      return;
    }
    setIsLoadingAvailable(true);
    try {
      const allFlightsQuery = query(collection(db, "flights"), orderBy("scheduledDepartureDateTimeUTC", "asc"));
      const allFlightsSnapshot = await getDocs(allFlightsQuery);
      const allFlights = allFlightsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Flight));
      
      const assignedFlightIds = assignedFlightsData.map(a => a.flightId);
      const filteredAvailable = allFlights.filter(f => !assignedFlightIds.includes(f.id) && new Date(f.scheduledDepartureDateTimeUTC) > new Date());
      setAvailableFlightsData(filteredAvailable);

    } catch (err) {
      console.error("Error fetching available flights:", err);
      setError("Failed to load available flights.");
      toast({ title: "Error", description: "Could not load available flights.", variant: "destructive" });
    } finally {
      setIsLoadingAvailable(false);
    }
  }, [user, toast, assignedFlightsData]); // Re-fetch available flights if assigned flights change


  React.useEffect(() => {
    if (user) {
      fetchAssignedFlights();
    }
  }, [user, fetchAssignedFlights]);

  React.useEffect(() => {
    if (user && !isLoadingAssigned) { // Fetch available only after assigned are loaded to ensure correct filtering
      fetchAvailableFlights();
    }
  }, [user, isLoadingAssigned, fetchAvailableFlights]);


  const handleAssignFlight = async (flightId: string) => {
    if (!user) {
      toast({ title: "Not Logged In", description: "You must be logged in to assign flights.", variant: "destructive"});
      return;
    }
    setAssigningFlightId(flightId);
    try {
      await addDoc(collection(db, "userFlightAssignments"), {
        userId: user.uid,
        flightId: flightId,
        assignedAt: Timestamp.now(),
      });
      toast({ title: "Flight Assigned!", description: "The flight has been added to your schedule.", action: <CheckCircle className="text-green-500"/> });
      await fetchAssignedFlights(); // Refresh assigned flights
      // fetchAvailableFlights will be re-triggered by useEffect due to assignedFlightsData dependency change
    } catch (err) {
      console.error("Error assigning flight:", err);
      toast({ title: "Assignment Failed", description: "Could not assign flight. Please try again.", variant: "destructive"});
    } finally {
      setAssigningFlightId(null);
    }
  };
  
  const eventsForSelectedDate = selectedDate
    ? assignedFlightsData.filter(assignment => 
        assignment.flightDetails && 
        new Date(assignment.flightDetails.scheduledDepartureDateTimeUTC).toDateString() === selectedDate.toDateString()
      )
    : [];
  
  const eventModifiers = {
    assigned: assignedFlightsData
        .map(a => a.flightDetails ? new Date(a.flightDetails.scheduledDepartureDateTimeUTC) : null)
        .filter(date => date !== null) as Date[],
  };

  const eventModifierStyles = {
    assigned: { backgroundColor: 'hsl(var(--primary)/0.8)', color: 'hsl(var(--primary-foreground))', borderRadius: '0.25rem', border: '1px solid hsl(var(--primary))' },
  };

  const formatDateTime = (isoString: string, includeDate = true) => {
    try {
      const date = new Date(isoString);
      if (includeDate) {
        return format(date, "MMM d, yyyy HH:mm 'UTC'");
      }
      return format(date, "HH:mm 'UTC'");
    } catch (e) {
      return "Invalid Date";
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <Card className="shadow-lg text-center p-8">
        <CardTitle className="text-xl font-headline mb-2">Access Denied</CardTitle>
        <CardDescription className="mb-4">Please log in to view and manage your schedule.</CardDescription>
        <Button onClick={() => window.location.href = "/login"}>Go to Login</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">My Schedule</CardTitle>
          <CardDescription>View your assigned flights and add available flights to your schedule.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col lg:flex-row gap-6">
          <div className="flex-grow flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              month={month}
              onMonthChange={setMonth}
              className="rounded-md border p-4 w-full max-w-md lg:max-w-none"
              modifiers={eventModifiers}
              modifiersStyles={eventModifierStyles}
              footer={
                <div className="flex justify-start mt-4 pt-2 border-t">
                  <div className="flex items-center gap-2 text-xs"><div className="w-3 h-3 rounded-sm" style={eventModifierStyles.assigned} /> Assigned Flight</div>
                </div>
              }
            />
          </div>
          <div className="lg:w-1/3 space-y-4">
            <Card className="bg-background/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-headline">
                  Flights for {selectedDate ? format(selectedDate, "MMM d, yyyy") : "selected date"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingAssigned ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 
                  eventsForSelectedDate.length > 0 ? (
                  <ul className="space-y-3">
                    {eventsForSelectedDate.map((assignment) => assignment.flightDetails && (
                      <li key={assignment.id} className="p-3 rounded-md border bg-card hover:shadow-sm transition-shadow">
                        <div className="flex items-center gap-2 mb-1">
                          <PlaneTakeoff className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold text-sm">{assignment.flightDetails.flightNumber}: {assignment.flightDetails.departureAirport} - {assignment.flightDetails.arrivalAirport}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground">Aircraft: {assignment.flightDetails.aircraftType}</p>
                        <p className="text-xs text-muted-foreground">Dep: {formatDateTime(assignment.flightDetails.scheduledDepartureDateTimeUTC, false)}, Arr: {formatDateTime(assignment.flightDetails.scheduledArrivalDateTimeUTC, false)}</p>
                        <Badge variant="default" className="mt-1 text-xs">{assignment.flightDetails.status}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No flights assigned for this date.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-headline">Available Flights</CardTitle>
          <CardDescription>Browse flights you can add to your schedule. Flights in the past are hidden.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p className="text-destructive text-sm mb-4">{error}</p>}
          {isLoadingAvailable ? (
            <div className="flex justify-center py-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : availableFlightsData.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableFlightsData.map((flight) => (
                <Card key={flight.id} className="bg-card p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <PlaneTakeoff className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">{flight.flightNumber}: {flight.departureAirport} - {flight.arrivalAirport}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">Aircraft: {flight.aircraftType}</p>
                    <p className="text-xs text-muted-foreground">Departure: {formatDateTime(flight.scheduledDepartureDateTimeUTC)}</p>
                    <p className="text-xs text-muted-foreground">Arrival: {formatDateTime(flight.scheduledArrivalDateTimeUTC)}</p>
                    <Badge variant={flight.status === "Scheduled" ? "secondary" : "outline"} className="mt-1 text-xs">{flight.status}</Badge>
                  </div>
                  <Button 
                    size="sm" 
                    className="w-full mt-3" 
                    onClick={() => handleAssignFlight(flight.id)}
                    disabled={assigningFlightId === flight.id}
                  >
                    {assigningFlightId === flight.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <PlusCircle className="mr-2 h-4 w-4" />
                    )}
                    Add to my planning
                  </Button>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">No available flights at the moment, or you are assigned to all upcoming flights.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

    