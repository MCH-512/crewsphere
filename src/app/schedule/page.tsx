
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PlaneTakeoff, Briefcase, Users, MapPin, Loader2, AlertTriangle, PlusCircle, CheckCircle, CalendarPlus, ListTodo, Bed, Shield, BookOpen, CircleHelp } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, where, doc, getDoc, Timestamp, orderBy, serverTimestamp, deleteDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { format, startOfDay, endOfDay, parseISO, setHours, setMinutes, setSeconds, setMilliseconds } from "date-fns";

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

interface UserOtherActivity {
  id: string;
  userId: string;
  activityType: "off" | "standby" | "leave" | "sick" | "training" | "other";
  date: Timestamp; // The day of the activity, stored at midnight UTC
  startTime?: Timestamp | null; // Optional specific start time
  endTime?: Timestamp | null; // Optional specific end time
  comments?: string;
  createdAt: Timestamp;
}

type CombinedEvent = 
  | { type: 'flight'; data: Flight; assignmentId: string; }
  | { type: 'otherActivity'; data: UserOtherActivity; };


const activityFormSchema = z.object({
  activityType: z.enum(["off", "standby", "leave", "sick", "training", "other"], {
    required_error: "Please select an activity type.",
  }),
  startTime: z.string().optional(), // HH:mm format
  endTime: z.string().optional(), // HH:mm format
  comments: z.string().max(500, "Comments must be 500 characters or less.").optional(),
});
type ActivityFormValues = z.infer<typeof activityFormSchema>;


export default function SchedulePage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date());
  const [month, setMonth] = React.useState<Date>(new Date());

  const [assignedFlightsData, setAssignedFlightsData] = React.useState<UserFlightAssignment[]>([]);
  const [availableFlightsData, setAvailableFlightsData] = React.useState<Flight[]>([]);
  
  const [userOtherActivities, setUserOtherActivities] = React.useState<UserOtherActivity[]>([]);
  const [isLoadingOtherActivities, setIsLoadingOtherActivities] = React.useState(true);

  const [isLoadingAssigned, setIsLoadingAssigned] = React.useState(true);
  const [isLoadingAvailable, setIsLoadingAvailable] = React.useState(true);
  const [assigningFlightId, setAssigningFlightId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [isAddActivityDialogOpen, setIsAddActivityDialogOpen] = React.useState(false);
  const [isSavingActivity, setIsSavingActivity] = React.useState(false);

  const activityForm = useForm<ActivityFormValues>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: {
      activityType: "off",
      startTime: "",
      endTime: "",
      comments: "",
    },
  });

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
    } finally {
      setIsLoadingAssigned(false);
    }
  }, [user]);

  const fetchUserOtherActivities = React.useCallback(async () => {
    if (!user) {
      setUserOtherActivities([]);
      setIsLoadingOtherActivities(false);
      return;
    }
    setIsLoadingOtherActivities(true);
    try {
      const currentMonthStart = startOfDay(new Date(month.getFullYear(), month.getMonth(), 1));
      const nextMonthStart = startOfDay(new Date(month.getFullYear(), month.getMonth() + 1, 1));

      const activitiesQuery = query(
        collection(db, "userActivities"),
        where("userId", "==", user.uid),
        where("date", ">=", Timestamp.fromDate(currentMonthStart)),
        where("date", "<", Timestamp.fromDate(nextMonthStart))
      );
      const activitiesSnapshot = await getDocs(activitiesQuery);
      const fetchedActivities = activitiesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as UserOtherActivity));
      setUserOtherActivities(fetchedActivities);
    } catch (err) {
      console.error("Error fetching other user activities:", err);
      setError((prevError) => prevError ? `${prevError}\nFailed to load other activities.` : "Failed to load other activities.");
    } finally {
      setIsLoadingOtherActivities(false);
    }
  }, [user, month]);

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
      setError((prevError) => prevError ? `${prevError}\nFailed to load available flights.` : "Failed to load available flights.");
    } finally {
      setIsLoadingAvailable(false);
    }
  }, [user, assignedFlightsData]);

  React.useEffect(() => {
    if (user) {
      fetchAssignedFlights();
      fetchUserOtherActivities(); // Fetch other activities as well
    }
  }, [user, fetchAssignedFlights, fetchUserOtherActivities, month]);

  React.useEffect(() => {
    if (user) {
      fetchAvailableFlights();
    }
  }, [user, assignedFlightsData, fetchAvailableFlights]);

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
        assignedAt: serverTimestamp(),
      });
      toast({ title: "Flight Assigned!", description: "The flight has been added to your schedule.", action: <CheckCircle className="text-green-500"/> });
      await fetchAssignedFlights();
    } catch (err) {
      console.error("Error assigning flight:", err); 
      toast({ title: "Assignment Failed", description: "Could not assign flight. Please try again.", variant: "destructive"});
    } finally {
      setAssigningFlightId(null);
    }
  };

  const handleSaveOtherActivity = async (data: ActivityFormValues) => {
    if (!user || !selectedDate) {
        toast({ title: "Error", description: "User or selected date is missing.", variant: "destructive" });
        return;
    }
    setIsSavingActivity(true);
    try {
        const activityDate = startOfDay(selectedDate); // Store date at midnight UTC

        let startTimeUTC: Timestamp | null = null;
        let endTimeUTC: Timestamp | null = null;

        if (data.startTime) {
            const [hours, minutes] = data.startTime.split(':').map(Number);
            startTimeUTC = Timestamp.fromDate(setMinutes(setHours(activityDate, hours), minutes));
        }
        if (data.endTime) {
            const [hours, minutes] = data.endTime.split(':').map(Number);
            endTimeUTC = Timestamp.fromDate(setMinutes(setHours(activityDate, hours), minutes));
        }

        await addDoc(collection(db, "userActivities"), {
            userId: user.uid,
            activityType: data.activityType,
            date: Timestamp.fromDate(activityDate),
            startTime: startTimeUTC,
            endTime: endTimeUTC,
            comments: data.comments || "",
            createdAt: serverTimestamp(),
        });
        toast({ title: "Activity Added", description: `${data.activityType} for ${format(selectedDate, "PPP")} has been added.`});
        fetchUserOtherActivities(); // Refresh other activities
        setIsAddActivityDialogOpen(false);
        activityForm.reset();
    } catch (err) {
        console.error("Error saving other activity:", err);
        toast({ title: "Save Failed", description: "Could not save the activity.", variant: "destructive" });
    } finally {
        setIsSavingActivity(false);
    }
  };
  
  const getEventsForDate = (date: Date | undefined): CombinedEvent[] => {
    if (!date) return [];
    const events: CombinedEvent[] = [];

    assignedFlightsData.forEach(assignment => {
      if (assignment.flightDetails && new Date(assignment.flightDetails.scheduledDepartureDateTimeUTC).toDateString() === date.toDateString()) {
        events.push({ type: 'flight', data: assignment.flightDetails, assignmentId: assignment.id });
      }
    });

    userOtherActivities.forEach(activity => {
      if (activity.date.toDate().toDateString() === date.toDateString()) {
        events.push({ type: 'otherActivity', data: activity });
      }
    });
    
    // Sort events: flights first, then other activities by start time if available
    return events.sort((a, b) => {
        if (a.type === 'flight' && b.type !== 'flight') return -1;
        if (a.type !== 'flight' && b.type === 'flight') return 1;
        if (a.type === 'flight' && b.type === 'flight') {
            return new Date(a.data.scheduledDepartureDateTimeUTC).getTime() - new Date(b.data.scheduledDepartureDateTimeUTC).getTime();
        }
        if (a.type === 'otherActivity' && b.type === 'otherActivity') {
            const aStart = a.data.startTime?.toDate().getTime() || a.data.date.toDate().getTime();
            const bStart = b.data.startTime?.toDate().getTime() || b.data.date.toDate().getTime();
            return aStart - bStart;
        }
        return 0;
    });
  };
  
  const eventsForSelectedDate = getEventsForDate(selectedDate);
  
  const eventModifiers = {
    assigned: assignedFlightsData
        .map(a => a.flightDetails ? new Date(a.flightDetails.scheduledDepartureDateTimeUTC) : null)
        .filter(date => date !== null) as Date[],
    otherActivity: userOtherActivities
        .map(act => act.date.toDate())
        .filter(date => date !== null) as Date[],
  };

  const eventModifierStyles = {
    assigned: { backgroundColor: 'hsl(var(--primary)/0.8)', color: 'hsl(var(--primary-foreground))', borderRadius: '0.25rem', border: '1px solid hsl(var(--primary))' },
    otherActivity: { backgroundColor: 'hsl(var(--accent)/0.7)', color: 'hsl(var(--accent-foreground))', borderRadius: '0.25rem', border: '1px solid hsl(var(--accent))' },
  };

  const formatDateTime = (isoString: string | Timestamp, includeDate = true, type: 'flight' | 'other' = 'flight') => {
    try {
      let date: Date;
      if (typeof isoString === 'string') {
        date = parseISO(isoString);
      } else if (isoString instanceof Timestamp) {
        date = isoString.toDate();
      } else {
        return "Invalid Date Input";
      }

      if (includeDate) {
        return format(date, "MMM d, yyyy HH:mm 'UTC'");
      }
      return format(date, "HH:mm 'UTC'");
    } catch (e) {
      return "Invalid Date";
    }
  };
  
  const getActivityIcon = (activityType: UserOtherActivity["activityType"]) => {
    switch (activityType) {
      case "off": return <Bed className="h-5 w-5 text-green-500" />;
      case "standby": return <Shield className="h-5 w-5 text-orange-500" />;
      case "leave": return <Briefcase className="h-5 w-5 text-blue-500" />;
      case "sick": return <AlertTriangle className="h-5 w-5 text-red-500" />; // Or a medical icon
      case "training": return <BookOpen className="h-5 w-5 text-purple-500" />;
      case "other":
      default: return <CircleHelp className="h-5 w-5 text-gray-500" />;
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
          <CardDescription>View your assigned flights & activities, and add new entries to your schedule.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col lg:flex-row gap-6">
          <div className="flex-grow flex flex-col items-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              month={month}
              onMonthChange={(newMonth) => {
                setMonth(newMonth);
                // Fetch activities for the new month when it changes
                fetchUserOtherActivities(); 
              }}
              className="rounded-md border p-4 w-full max-w-md lg:max-w-none"
              modifiers={eventModifiers}
              modifiersStyles={eventModifierStyles}
              footer={
                <div className="flex justify-start items-center gap-4 mt-4 pt-2 border-t">
                  <div className="flex items-center gap-2 text-xs"><div className="w-3 h-3 rounded-sm" style={eventModifierStyles.assigned} /> Flight</div>
                  <div className="flex items-center gap-2 text-xs"><div className="w-3 h-3 rounded-sm" style={eventModifierStyles.otherActivity} /> Other Activity</div>
                </div>
              }
            />
             <Button 
                onClick={() => {
                    if (selectedDate) {
                        activityForm.reset({ activityType: "off", startTime: "", endTime: "", comments: "" });
                        setIsAddActivityDialogOpen(true);
                    } else {
                        toast({ title: "No Date Selected", description: "Please select a date on the calendar first.", variant: "default" });
                    }
                }} 
                variant="outline" 
                className="mt-4 w-full max-w-md"
                disabled={!selectedDate}
            >
                <CalendarPlus className="mr-2 h-4 w-4" /> Add Activity for Selected Date
            </Button>
          </div>
          <div className="lg:w-1/3 space-y-4">
            <Card className="bg-background/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-headline">
                  Events for {selectedDate ? format(selectedDate, "MMM d, yyyy") : "selected date"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(isLoadingAssigned || isLoadingOtherActivities) ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 
                  eventsForSelectedDate.length > 0 ? (
                  <ul className="space-y-3">
                    {eventsForSelectedDate.map((event, index) => (
                      <li key={`${event.type}-${event.type === 'flight' ? event.data.id : event.data.id}-${index}`} className="p-3 rounded-md border bg-card hover:shadow-sm transition-shadow">
                        {event.type === 'flight' ? (
                          <>
                            <div className="flex items-center gap-2 mb-1">
                              <PlaneTakeoff className="h-5 w-5 text-primary" />
                              <h3 className="font-semibold text-sm">{event.data.flightNumber}: {event.data.departureAirport} - {event.data.arrivalAirport}</h3>
                            </div>
                            <p className="text-xs text-muted-foreground">Aircraft: {event.data.aircraftType}</p>
                            <p className="text-xs text-muted-foreground">Dep: {formatDateTime(event.data.scheduledDepartureDateTimeUTC, false)}, Arr: {formatDateTime(event.data.scheduledArrivalDateTimeUTC, false)}</p>
                            <Badge variant="default" className="mt-1 text-xs">{event.data.status}</Badge>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 mb-1">
                                {getActivityIcon(event.data.activityType)}
                                <h3 className="font-semibold text-sm capitalize">{event.data.activityType}</h3>
                            </div>
                            {event.data.startTime && <p className="text-xs text-muted-foreground">Start: {formatDateTime(event.data.startTime, false, 'other')}</p>}
                            {event.data.endTime && <p className="text-xs text-muted-foreground">End: {formatDateTime(event.data.endTime, false, 'other')}</p>}
                            {event.data.comments && <p className="text-xs text-muted-foreground mt-1">Note: {event.data.comments}</p>}
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No activities or flights for this date.</p>
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
          {error && <p className="text-destructive text-sm mb-4">{error.split('\n').map((line, i) => <span key={i}>{line}<br/></span>)}</p>}
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

      <Dialog open={isAddActivityDialogOpen} onOpenChange={setIsAddActivityDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Activity for {selectedDate ? format(selectedDate, "PPP") : ""}</DialogTitle>
            <DialogDescription>
              Select the type of activity and fill in the details.
            </DialogDescription>
          </DialogHeader>
          <Form {...activityForm}>
            <form onSubmit={activityForm.handleSubmit(handleSaveOtherActivity)} className="space-y-4 py-4">
              <FormField
                control={activityForm.control}
                name="activityType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Activity Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an activity type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="off">Day Off</SelectItem>
                        <SelectItem value="standby">Standby</SelectItem>
                        <SelectItem value="leave">Leave / Vacation</SelectItem>
                        <SelectItem value="sick">Sick Leave</SelectItem>
                        <SelectItem value="training">Training</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={activityForm.control}
                    name="startTime"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Start Time (UTC)</FormLabel>
                        <FormControl>
                        <Input type="time" {...field} />
                        </FormControl>
                        <FormDescription>Optional</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={activityForm.control}
                    name="endTime"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>End Time (UTC)</FormLabel>
                        <FormControl>
                        <Input type="time" {...field} />
                        </FormControl>
                        <FormDescription>Optional</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              </div>
              <FormField
                control={activityForm.control}
                name="comments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comments</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Optional notes or details..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isSavingActivity}>
                  {isSavingActivity && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Activity
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
