
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, type DayContentProps } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogPrimitiveDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle as AlertDialogPrimitiveTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; 
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PlaneTakeoff, Briefcase, Users, MapPin, Loader2, AlertTriangle, PlusCircle, CheckCircle, CalendarPlus, ListTodo, Bed, Shield, BookOpen, CircleHelp, Trash2, Edit3, Filter, Ban, School } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, where, doc, getDoc, Timestamp, orderBy, serverTimestamp, deleteDoc, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { format, startOfDay, endOfDay, parseISO, setHours, setMinutes, setSeconds, setMilliseconds, isSameMonth, addMonths, endOfMonth } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getAirportByCode } from "@/services/airport-service";
import type { StoredTrainingSession } from "@/schemas/training-session-schema";

interface Flight {
  id: string;
  flightNumber: string;
  departureAirport: string; 
  departureAirportIATA?: string; 
  arrivalAirport: string;
  arrivalAirportIATA?: string;
  scheduledDepartureDateTimeUTC: string;
  scheduledArrivalDateTimeUTC: string;
  aircraftType: string;
  status: "Scheduled" | "On Time" | "Delayed" | "Cancelled";
}

interface UserActivity {
  id: string;
  userId: string;
  activityType: "flight" | "off" | "standby" | "leave" | "sick" | "training" | "other";
  date: Timestamp;
  flightId?: string | null;
  flightDetails?: Flight;
  trainingSessionId?: string | null;
  sessionDetails?: StoredTrainingSession;
  startTime?: Timestamp | null;
  endTime?: Timestamp | null;
  comments?: string;
  createdAt: Timestamp;
}

type CombinedEvent = UserActivity;

const activityTypesForFilter = ["all", "flight", "off", "standby", "leave", "sick", "training", "other"] as const;
type ActivityTypeFilter = typeof activityTypesForFilter[number];


const activityFormSchema = z.object({
  activityType: z.enum(["flight", "off", "standby", "leave", "sick", "training", "other"], {
    required_error: "Please select an activity type.",
  }),
  flightId: z.string().optional(),
  trainingSessionId: z.string().optional(),
  startTime: z.string().optional(), // HH:mm format
  endTime: z.string().optional(), // HH:mm format
  comments: z.string().max(500, "Comments must be 500 characters or less.").optional(),
}).superRefine((data, ctx) => {
  if (data.activityType === "flight") {
    if (!data.flightId || data.flightId.trim() === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Flight selection is required.", path: ["flightId"] });
    }
  }
  if (data.activityType === "training") {
    if (!data.trainingSessionId || data.trainingSessionId.trim() === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Training session selection is required.", path: ["trainingSessionId"] });
    }
  }
  if (data.startTime && !data.endTime) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "End time is required if start time is provided.", path: ["endTime"] });
  }
  if (!data.startTime && data.endTime) {
     ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Start time is required if end time is provided.", path: ["startTime"] });
  }
  if (data.startTime && data.endTime && data.startTime >= data.endTime) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "End time must be after start time.", path: ["endTime"] });
  }
});
type ActivityFormValues = z.infer<typeof activityFormSchema>;


export default function SchedulePage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date());
  const [month, setMonth] = React.useState<Date>(new Date());
  
  const [userActivities, setUserActivities] = React.useState<UserActivity[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = React.useState(true);
  
  const [availableFlightsData, setAvailableFlightsData] = React.useState<Flight[]>([]);
  const [isLoadingAvailableFlights, setIsLoadingAvailableFlights] = React.useState(true);
  const [availableSessionsData, setAvailableSessionsData] = React.useState<StoredTrainingSession[]>([]);
  const [isLoadingAvailableSessions, setIsLoadingAvailableSessions] = React.useState(true);
  
  const [error, setError] = React.useState<string | null>(null);

  const [isActivityFormOpen, setIsActivityFormOpen] = React.useState(false);
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [editingActivity, setEditingActivity] = React.useState<UserActivity | null>(null);
  const [isSavingActivity, setIsSavingActivity] = React.useState(false);

  const [activityToDelete, setActivityToDelete] = React.useState<UserActivity | null>(null);
  const [isDeletingActivity, setIsDeletingActivity] = React.useState(false);

  const [activityTypeFilter, setActivityTypeFilter] = React.useState<ActivityTypeFilter>("all");
  const [dailyActivityTypesMap, setDailyActivityTypesMap] = React.useState<Map<string, Set<string>>>(new Map());


  const activityForm = useForm<ActivityFormValues>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: {
      activityType: "off",
      flightId: "",
      trainingSessionId: "",
      startTime: "",
      endTime: "",
      comments: "",
    },
  });
  const watchedActivityType = activityForm.watch("activityType");

  const formatTimestampToHHMM = (timestamp: Timestamp | null | undefined): string => {
    if (!timestamp) return "";
    try { return format(timestamp.toDate(), "HH:mm"); } catch { return ""; }
  };
  
  const combineDateAndTime = (activityBaseDate: Date, timeString: string | undefined): Timestamp | null => {
    if (!timeString) return null;
    try {
      const [hours, minutes] = timeString.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes)) return null;
      const localDate = new Date(activityBaseDate.getFullYear(), activityBaseDate.getMonth(), activityBaseDate.getDate());
      localDate.setHours(hours, minutes, 0, 0);
      return Timestamp.fromDate(localDate);
    } catch {
      return null;
    }
  };

  const fetchUserActivities = React.useCallback(async () => {
    if (!user) { setUserActivities([]); setIsLoadingActivities(false); return; }
    setIsLoadingActivities(true); setError(null);
    try {
      const currentMonthStart = startOfDay(new Date(month.getFullYear(), month.getMonth(), 1));
      const nextMonthStart = startOfDay(new Date(month.getFullYear(), month.getMonth() + 1, 1));
      const activitiesQuery = query(collection(db, "userActivities"), where("userId", "==", user.uid), where("date", ">=", Timestamp.fromDate(currentMonthStart)), where("date", "<", Timestamp.fromDate(nextMonthStart)), orderBy("date", "asc"));
      const activitiesSnapshot = await getDocs(activitiesQuery);
      const populatedActivities: UserActivity[] = [];

      for (const activityDoc of activitiesSnapshot.docs) {
        const activityData = activityDoc.data() as Omit<UserActivity, 'id' | 'flightDetails' | 'sessionDetails'>;
        let flightDetails: Flight | undefined = undefined;
        let sessionDetails: StoredTrainingSession | undefined = undefined;
        
        if (activityData.activityType === 'flight' && activityData.flightId) {
          const flightDocRef = doc(db, "flights", activityData.flightId);
          const flightDocSnap = await getDoc(flightDocRef);
          if (flightDocSnap.exists()) {
            flightDetails = { id: flightDocSnap.id, ...flightDocSnap.data() } as Flight;
            const depAirportInfo = await getAirportByCode(flightDetails.departureAirport);
            flightDetails.departureAirportIATA = depAirportInfo?.iata;
            const arrAirportInfo = await getAirportByCode(flightDetails.arrivalAirport);
            flightDetails.arrivalAirportIATA = arrAirportInfo?.iata;
          }
        } else if (activityData.activityType === 'training' && activityData.trainingSessionId) {
            const sessionDocRef = doc(db, "trainingSessions", activityData.trainingSessionId);
            const sessionDocSnap = await getDoc(sessionDocRef);
            if (sessionDocSnap.exists()) {
                sessionDetails = { id: sessionDocSnap.id, ...sessionDocSnap.data() } as StoredTrainingSession;
            }
        }

        populatedActivities.push({ id: activityDoc.id, ...activityData, flightDetails, sessionDetails } as UserActivity);
      }
      setUserActivities(populatedActivities);
    } catch (err) { console.error("Error fetching user activities:", err); setError("Failed to load your activities. Please try again.");
    } finally { setIsLoadingActivities(false); }
  }, [user, month]);
  
  const fetchAvailableFlights = React.useCallback(async () => {
    if (!user) { setAvailableFlightsData([]); setIsLoadingAvailableFlights(false); return; }
    setIsLoadingAvailableFlights(true);
    try {
        const rangeStart = startOfDay(new Date(month.getFullYear(), month.getMonth(), 1));
        const rangeEnd = endOfMonth(addMonths(rangeStart, 1));
        const flightsQuery = query(collection(db, "flights"), where("scheduledDepartureDateTimeUTC", ">=", rangeStart.toISOString()), where("scheduledDepartureDateTimeUTC", "<=", rangeEnd.toISOString()), orderBy("scheduledDepartureDateTimeUTC", "asc"));
        const flightsSnapshot = await getDocs(flightsQuery);
        const allFlightsPromises = flightsSnapshot.docs.map(async d => {
            const flightData = { id: d.id, ...d.data() } as Flight;
            const depAirportInfo = await getAirportByCode(flightData.departureAirport);
            flightData.departureAirportIATA = depAirportInfo?.iata;
            const arrAirportInfo = await getAirportByCode(flightData.arrivalAirport);
            flightData.arrivalAirportIATA = arrAirportInfo?.iata;
            return flightData;
        });
        const allFlightsInRange = await Promise.all(allFlightsPromises);
        const assignedFlightIdsInActivities = userActivities.filter(act => act.activityType === 'flight' && act.flightId).map(act => act.flightId);
        const filteredAvailable = allFlightsInRange.filter(f => !assignedFlightIdsInActivities.includes(f.id));
        setAvailableFlightsData(filteredAvailable);
    } catch (err) { console.error("Error fetching available flights:", err); setError((prevError) => prevError ? `${prevError}\nFailed to load available flights.` : "Failed to load available flights.");
    } finally { setIsLoadingAvailableFlights(false); }
  }, [user, month, userActivities]);
  
  const fetchAvailableTrainingSessions = React.useCallback(async () => {
    if (!user) { setAvailableSessionsData([]); setIsLoadingAvailableSessions(false); return; }
    setIsLoadingAvailableSessions(true);
    try {
        const rangeStart = startOfDay(new Date(month.getFullYear(), month.getMonth(), 1));
        const rangeEnd = endOfMonth(addMonths(rangeStart, 1));
        const sessionsQuery = query(collection(db, "trainingSessions"), where("sessionDateTimeUTC", ">=", rangeStart.toISOString()), where("sessionDateTimeUTC", "<=", rangeEnd.toISOString()), orderBy("sessionDateTimeUTC", "asc"));
        const sessionsSnapshot = await getDocs(sessionsQuery);
        const allSessionsInRange = sessionsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as StoredTrainingSession));
        const assignedSessionIdsInActivities = userActivities.filter(act => act.activityType === 'training' && act.trainingSessionId).map(act => act.trainingSessionId);
        const filteredAvailable = allSessionsInRange.filter(s => !assignedSessionIdsInActivities.includes(s.id));
        setAvailableSessionsData(filteredAvailable);
    } catch (err) { console.error("Error fetching available sessions:", err); setError((prevError) => prevError ? `${prevError}\nFailed to load available sessions.` : "Failed to load available sessions.");
    } finally { setIsLoadingAvailableSessions(false); }
  }, [user, month, userActivities]);


  React.useEffect(() => { if (user) { fetchUserActivities(); } }, [user, month, fetchUserActivities]);
  React.useEffect(() => { if (user) { fetchAvailableFlights(); fetchAvailableTrainingSessions(); } }, [user, userActivities, fetchAvailableFlights, fetchAvailableTrainingSessions]); 

  React.useEffect(() => {
    const newMap = new Map<string, Set<string>>();
    userActivities.forEach(activity => {
      const dateKey = format(activity.date.toDate(), "yyyy-MM-dd");
      if (!newMap.has(dateKey)) newMap.set(dateKey, new Set<string>());
      const typesOnDate = newMap.get(dateKey)!; 
      if (activity.activityType === 'flight') typesOnDate.add(activity.flightDetails ? 'flight' : 'flight-deleted');
      else typesOnDate.add('otherType');
    });
    setDailyActivityTypesMap(newMap);
  }, [userActivities]);

  const filterAndGetEntitiesForDialog = React.useMemo(() => {
    if (!selectedDate) return { flights: [], sessions: [] };
    const startOfSelectedDayUTC = Date.UTC(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0, 0);
    const endOfSelectedDayUTC = startOfSelectedDayUTC + 24 * 60 * 60 * 1000 - 1;

    const flights = availableFlightsData.filter(flight => {
        const flightTime = parseISO(flight.scheduledDepartureDateTimeUTC).getTime();
        return flightTime >= startOfSelectedDayUTC && flightTime <= endOfSelectedDayUTC;
    });
    const sessions = availableSessionsData.filter(session => {
        const sessionTime = parseISO(session.sessionDateTimeUTC).getTime();
        return sessionTime >= startOfSelectedDayUTC && sessionTime <= endOfSelectedDayUTC;
    });

    return { flights, sessions };
  }, [availableFlightsData, availableSessionsData, selectedDate]);


  const handleOpenAddActivityDialog = () => {
    if (selectedDate) {
      setIsEditMode(false); setEditingActivity(null);
      activityForm.reset({ activityType: "off", flightId: "", trainingSessionId: "", startTime: "", endTime: "", comments: "" });
      setIsActivityFormOpen(true);
    } else { toast({ title: "No Date Selected", description: "Please select a date on the calendar first.", variant: "default" }); }
  };

  const handleOpenEditActivityDialog = (activity: UserActivity) => {
    setIsEditMode(true); setEditingActivity(activity);
    activityForm.reset({
      activityType: activity.activityType, flightId: activity.flightId || "", trainingSessionId: activity.trainingSessionId || "",
      startTime: formatTimestampToHHMM(activity.startTime), endTime: formatTimestampToHHMM(activity.endTime), comments: activity.comments || "",
    });
    setIsActivityFormOpen(true);
  };

  const handleSaveActivity = async (data: ActivityFormValues) => {
    if (!user) { toast({ title: "Error", description: "User not logged in.", variant: "destructive" }); return; }
    if (!isEditMode && !selectedDate) { toast({ title: "Error", description: "No date selected for new activity.", variant: "destructive" }); return; }
    if (isEditMode && !editingActivity) { toast({ title: "Error", description: "No activity selected for editing.", variant: "destructive" }); return; }

    setIsSavingActivity(true);
    try {
      const activityBaseDate = isEditMode && editingActivity ? editingActivity.date.toDate() : startOfDay(selectedDate!);
      let startTimeUTC: Timestamp | null = null;
      let endTimeUTC: Timestamp | null = null;

      if (data.activityType !== "flight" && data.activityType !== "training") { 
        startTimeUTC = combineDateAndTime(activityBaseDate, data.startTime);
        endTimeUTC = combineDateAndTime(activityBaseDate, data.endTime);
      }

      if (isEditMode && editingActivity) {
        const updatePayload: Partial<Omit<UserActivity, 'id' | 'createdAt' | 'userId' | 'flightDetails' | 'sessionDetails'>> = {
          activityType: data.activityType, comments: data.comments || "",
          flightId: editingActivity.activityType === 'flight' ? editingActivity.flightId : null, 
          trainingSessionId: editingActivity.activityType === 'training' ? editingActivity.trainingSessionId : null,
          startTime: startTimeUTC, endTime: endTimeUTC,
        };
        await updateDoc(doc(db, "userActivities", editingActivity.id), updatePayload);
        toast({ title: "Activity Updated", description: `Activity on ${format(activityBaseDate, "PPP")} has been updated.`});
      } else {
        const activityToSave: Omit<UserActivity, 'id' | 'createdAt' | 'flightDetails' | 'sessionDetails'> = {
          userId: user.uid, activityType: data.activityType, date: Timestamp.fromDate(activityBaseDate), 
          comments: data.comments || "",
          flightId: data.activityType === "flight" ? (data.flightId || null) : null,
          trainingSessionId: data.activityType === "training" ? (data.trainingSessionId || null) : null,
          startTime: startTimeUTC, endTime: endTimeUTC,
          // @ts-ignore
          createdAt: serverTimestamp(),
        };
        await addDoc(collection(db, "userActivities"), activityToSave);
        toast({ title: "Activity Added", description: `${data.activityType} for ${format(activityBaseDate, "PPP")} has been added.`});
      }
      
      fetchUserActivities(); setIsActivityFormOpen(false); activityForm.reset(); setEditingActivity(null); setIsEditMode(false);
    } catch (err) { console.error("Error saving activity:", err); toast({ title: "Save Failed", description: `Could not ${isEditMode ? 'update' : 'save'} the activity. Please try again.`, variant: "destructive" });
    } finally { setIsSavingActivity(false); }
  };

  const confirmDeleteActivity = async () => {
    if (!activityToDelete) return; setIsDeletingActivity(true);
    try { await deleteDoc(doc(db, "userActivities", activityToDelete.id)); toast({ title: "Activity Deleted", description: `The activity on ${format(activityToDelete.date.toDate(), "PPP")} has been deleted.` }); fetchUserActivities(); setActivityToDelete(null);
    } catch (err) { console.error("Error deleting activity:", err); toast({ title: "Deletion Failed", description: "Could not delete the activity.", variant: "destructive" });
    } finally { setIsDeletingActivity(false); }
  };
  
  const getEventsForDate = (date: Date | undefined, filter: ActivityTypeFilter): CombinedEvent[] => {
    if (!date) return [];
    return userActivities.filter(activity => {
        const activityDateMatches = activity.date.toDate().toDateString() === date.toDateString();
        if (!activityDateMatches) return false;
        if (filter === "all") return true;
        return activity.activityType === filter;
      }).sort((a, b) => {
        const aTime = a.activityType === 'flight' ? (a.flightDetails ? new Date(a.flightDetails.scheduledDepartureDateTimeUTC).getTime() : 0) : (a.startTime?.toDate().getTime() || a.date.toDate().getTime());
        const bTime = b.activityType === 'flight' ? (b.flightDetails ? new Date(b.flightDetails.scheduledDepartureDateTimeUTC).getTime() : 0) : (b.startTime?.toDate().getTime() || b.date.toDate().getTime());
        return aTime - bTime;
      });
  };
  
  const eventsForSelectedDate = getEventsForDate(selectedDate, activityTypeFilter);
  
  const CustomDayInnerContent: React.FC<DayContentProps> = (props) => {
    const dateKey = format(props.date, "yyyy-MM-dd");
    const activityTypesOnDate = dailyActivityTypesMap.get(dateKey);
    const dayNumber = props.date.getDate();
  
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center">
        <span>{dayNumber}</span>
        {(activityTypesOnDate && isSameMonth(props.date, props.displayMonth)) && (
          <div className="absolute bottom-0.5 flex space-x-0.5">
            {activityTypesOnDate.has('flight') && (<div className="w-1.5 h-1.5 bg-primary rounded-full" />)}
            {activityTypesOnDate.has('flight-deleted') && (<div className="w-1.5 h-1.5 bg-destructive rounded-full" />)}
            {activityTypesOnDate.has('otherType') && (<div className="w-1.5 h-1.5 bg-accent rounded-full" />)}
          </div>
        )}
      </div>
    );
  };

  const formatEventTime = (event: UserActivity) => {
    if (event.activityType === 'flight' && event.flightDetails) {
      const depTime = format(parseISO(event.flightDetails.scheduledDepartureDateTimeUTC), "HH:mm");
      const arrTime = format(parseISO(event.flightDetails.scheduledArrivalDateTimeUTC), "HH:mm");
      return `${depTime} - ${arrTime} UTC`;
    }
    if (event.activityType === 'training' && event.sessionDetails) {
        const startTime = format(parseISO(event.sessionDetails.sessionDateTimeUTC), "HH:mm");
        const endTime = format(addMonths(parseISO(event.sessionDetails.sessionDateTimeUTC), event.sessionDetails.durationHours), "HH:mm");
        return `${startTime} - ${endTime} UTC`;
    }
    if (event.activityType === 'flight' && !event.flightDetails) return "Details N/A";
    if (event.activityType === 'training' && !event.sessionDetails) return "Details N/A";
    if (event.startTime && event.endTime) {
      const sTime = format(event.startTime.toDate(), "HH:mm");
      const eTime = format(event.endTime.toDate(), "HH:mm");
      return `${sTime} - ${eTime} Local`;
    }
    if (event.startTime) return `Starts ${format(event.startTime.toDate(), "HH:mm")} Local`;
    return "All day";
  };
  
  const getActivityIcon = (activityType: UserActivity["activityType"], detailsExist?: boolean) => {
    if ((activityType === 'flight' || activityType === 'training') && !detailsExist) {
      return <Ban className="h-5 w-5 text-destructive" />;
    }
    switch (activityType) {
      case "flight": return <PlaneTakeoff className="h-5 w-5 text-primary" />;
      case "training": return <School className="h-5 w-5 text-indigo-500" />;
      case "off": return <Bed className="h-5 w-5 text-green-500" />;
      case "standby": return <Shield className="h-5 w-5 text-orange-500" />; 
      case "leave": return <Briefcase className="h-5 w-5 text-blue-500" />; 
      case "sick": return <AlertTriangle className="h-5 w-5 text-destructive" />;
      case "other": default: return <CircleHelp className="h-5 w-5 text-muted-foreground" />;
    }
  };


  if (authLoading) return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (!user) return <Card className="shadow-lg text-center p-8"><CardTitle className="text-xl font-headline mb-2">Access Denied</CardTitle><CardDescription className="mb-4">Please log in to view and manage your schedule.</CardDescription><Button onClick={() => window.location.href = "/login"}>Go to Login</Button></Card>;

  return (
    <div className="space-y-6 md:space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">My Schedule</CardTitle>
          <CardDescription>View your assigned flights & activities, and add or manage entries in your schedule.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col">
            <Calendar
              mode="single" selected={selectedDate} onSelect={setSelectedDate} month={month} onMonthChange={setMonth}
              className="rounded-md border p-4 w-full" components={{ DayContent: CustomDayInnerContent }}
              footer={
                <div className="flex flex-wrap justify-start items-center gap-x-4 gap-y-1 mt-4 pt-2 border-t text-xs">
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-primary rounded-full" /> Flight / Training</div>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-destructive rounded-full" /> Deleted/Cancelled Event</div>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-accent rounded-full" /> Other Activity</div>
                </div>
              }
            />
             <Button onClick={handleOpenAddActivityDialog} variant="outline" className="mt-4 w-full" disabled={!selectedDate}><CalendarPlus className="mr-2 h-4 w-4" /> Add Activity for Selected Date</Button>
          </div>
          <div className="lg:col-span-1 space-y-4">
            <Card className="bg-background/70 h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-headline">Events for {selectedDate ? format(selectedDate, "PPP") : "selected date"}</CardTitle>
                 <div className="mt-2">
                  <Select value={activityTypeFilter} onValueChange={(value) => setActivityTypeFilter(value as ActivityTypeFilter)}>
                    <SelectTrigger className="w-full text-xs h-8"><Filter className="mr-1.5 h-3.5 w-3.5 text-muted-foreground"/><SelectValue placeholder="Filter by type" /></SelectTrigger>
                    <SelectContent>{activityTypesForFilter.map(type => (<SelectItem key={type} value={type} className="capitalize text-xs">{type === "all" ? "All Types" : type}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingActivities ? (<div className="flex flex-col items-center justify-center h-40 text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin text-primary mb-2" /><p>Loading activities...</p></div>)
                 : error ? (<Alert variant="destructive" className="my-4"><AlertTriangle className="h-5 w-5" /><AlertTitle>Failed to Load Activities</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>)
                 : eventsForSelectedDate.length > 0 ? (
                  <ScrollArea className="h-[300px] pr-3">
                    <ul className="space-y-3">
                      {eventsForSelectedDate.map((event) => (
                        <li key={event.id} className="p-3 rounded-md border bg-card hover:shadow-sm transition-shadow">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                                {getActivityIcon(event.activityType, !!event.flightDetails || !!event.sessionDetails)}
                                <div>
                                    <h3 className="font-semibold text-sm capitalize">{event.activityType === 'flight' ? (event.flightDetails ? event.flightDetails.flightNumber : "Flight (Deleted)") : event.activityType === 'training' ? (event.sessionDetails ? event.sessionDetails.title : "Training (Deleted)") : event.activityType}</h3>
                                    {(event.activityType === 'flight' && event.flightDetails) && <p className="text-xs text-muted-foreground">{event.flightDetails.departureAirportIATA || event.flightDetails.departureAirport} &rarr; {event.flightDetails.arrivalAirportIATA || event.flightDetails.arrivalAirport}</p>}
                                    {(event.activityType === 'training' && event.sessionDetails) && <p className="text-xs text-muted-foreground">{event.sessionDetails.location}</p>}
                                </div>
                            </div>
                            <div className="flex items-center flex-shrink-0">
                                {event.activityType !== 'flight' || !event.flightDetails ? (<Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary/80" onClick={() => handleOpenEditActivityDialog(event)}><Edit3 className="h-4 w-4" /></Button>) : null}
                                <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive/80" onClick={() => setActivityToDelete(event)}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger></AlertDialog>
                            </div>
                          </div>
                          <div className="pl-7 mt-1 space-y-1">
                              <p className="text-xs text-muted-foreground">{formatEventTime(event)}</p>
                              {event.activityType === 'flight' && event.flightDetails && <Badge variant="default" className="text-xs">{event.flightDetails.status}</Badge>}
                              {event.activityType === 'training' && event.sessionDetails && <Badge variant="default" className="text-xs">{event.sessionDetails.instructor}</Badge>}
                              {(event.activityType === 'flight' || event.activityType === 'training') && !(event.flightDetails || event.sessionDetails) && <Badge variant="destructive" className="text-xs">Event Deleted</Badge>}
                              {event.comments && <p className="text-xs text-muted-foreground mt-1">Note: {event.comments}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                ) : (<p className="text-sm text-muted-foreground py-4 text-center">{activityTypeFilter === "all" ? "No activities or flights for this date." : `No activities of type '${activityTypeFilter}' for this date.`}</p>)}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isActivityFormOpen} onOpenChange={(open) => { setIsActivityFormOpen(open); if (!open) { setEditingActivity(null); setIsEditMode(false); activityForm.reset(); }}}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{isEditMode ? "Edit Activity" : `Add Activity for ${selectedDate ? format(selectedDate, "PPP") : ""}`}</DialogTitle><DialogDescription>{isEditMode ? "Modify the details of your activity." : "Select the type of activity and fill in the details."}</DialogDescription></DialogHeader>
          <Form {...activityForm}>
            <form onSubmit={activityForm.handleSubmit(handleSaveActivity)} className="space-y-4 py-4">
              <FormField control={activityForm.control} name="activityType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Activity Type</FormLabel>
                    <Select onValueChange={(value) => { field.onChange(value); activityForm.setValue('flightId', ''); activityForm.setValue('trainingSessionId', ''); if (value === 'flight' || value === 'training') { activityForm.setValue('startTime', ''); activityForm.setValue('endTime', ''); } }} value={field.value} disabled={(isEditMode && !!editingActivity?.flightId) || (isEditMode && !!editingActivity?.trainingSessionId)} >
                      <FormControl><SelectTrigger><SelectValue placeholder="Select an activity type" /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="flight">Flight Duty</SelectItem><SelectItem value="training">Training Session</SelectItem><SelectItem value="off">Day Off</SelectItem><SelectItem value="standby">Standby</SelectItem><SelectItem value="leave">Leave / Vacation</SelectItem><SelectItem value="sick">Sick Leave</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
                    </Select><FormMessage />
                  </FormItem>
              )}/>
              
              {watchedActivityType === "flight" && (<FormField control={activityForm.control} name="flightId" render={({ field }) => (
                <FormItem><FormLabel>Select Available Flight</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""} disabled={isLoadingAvailableFlights || !selectedDate || isEditMode}>
                    <FormControl><SelectTrigger><SelectValue placeholder={isLoadingAvailableFlights ? "Loading..." : "Choose a flight..."} /></SelectTrigger></FormControl>
                    <SelectContent>{filterAndGetEntitiesForDialog.flights.map(flight => (<SelectItem key={flight.id} value={flight.id}>{flight.flightNumber} ({flight.departureAirportIATA}-{flight.arrivalAirportIATA}) - Dep: {format(parseISO(flight.scheduledDepartureDateTimeUTC), "HH:mm")} UTC</SelectItem>))}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )}/>)}
              
              {watchedActivityType === "training" && (<FormField control={activityForm.control} name="trainingSessionId" render={({ field }) => (
                <FormItem><FormLabel>Select Training Session</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""} disabled={isLoadingAvailableSessions || !selectedDate || isEditMode}>
                    <FormControl><SelectTrigger><SelectValue placeholder={isLoadingAvailableSessions ? "Loading..." : "Choose a session..."} /></SelectTrigger></FormControl>
                    <SelectContent>{filterAndGetEntitiesForDialog.sessions.map(session => (<SelectItem key={session.id} value={session.id}>{session.title} @ {format(parseISO(session.sessionDateTimeUTC), "HH:mm")} UTC</SelectItem>))}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )}/>)}

              {(watchedActivityType !== "flight" && watchedActivityType !== "training") && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={activityForm.control} name="startTime" render={({ field }) => (<FormItem><FormLabel>Start Time (Local)</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormDescription>Optional</FormDescription><FormMessage /></FormItem>)}/>
                  <FormField control={activityForm.control} name="endTime" render={({ field }) => (<FormItem><FormLabel>End Time (Local)</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormDescription>Optional</FormDescription><FormMessage /></FormItem>)}/>
                </div>
              )}
              <FormField control={activityForm.control} name="comments" render={({ field }) => (<FormItem><FormLabel>Comments</FormLabel><FormControl><Textarea placeholder="Optional notes or details..." {...field} /></FormControl><FormMessage /></FormItem>)}/>
              <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={isSavingActivity}>{isSavingActivity && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isEditMode ? "Update Activity" : "Save Activity"}</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {activityToDelete && (<AlertDialog open={!!activityToDelete} onOpenChange={(open) => !open && setActivityToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogPrimitiveTitle>Confirm Deletion</AlertDialogPrimitiveTitle><AlertDialogPrimitiveDescription>Are you sure you want to delete this activity: <span className="font-semibold capitalize">{activityToDelete.activityType}</span> on <span className="font-semibold">{format(activityToDelete.date.toDate(), "PPP")}</span>? This action cannot be undone.</AlertDialogPrimitiveDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setActivityToDelete(null)} disabled={isDeletingActivity}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteActivity} disabled={isDeletingActivity} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{isDeletingActivity && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>)}
    </div>
  );
}
