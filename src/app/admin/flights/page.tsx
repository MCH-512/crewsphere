
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth, type User } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp, doc, writeBatch, serverTimestamp, getDoc, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Plane, Loader2, AlertTriangle, RefreshCw, Edit, PlusCircle, Trash2, Users, ArrowRightLeft, Handshake, FileSignature, Calendar as CalendarIcon, List, Filter, Repeat, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, startOfDay, parseISO, addHours, isSameDay, startOfMonth, endOfMonth, addDays, addWeeks, differenceInMinutes, addMinutes } from "date-fns";
import { flightFormSchema, type FlightFormValues, type StoredFlight, aircraftTypes } from "@/schemas/flight-schema";
import { logAuditEvent } from "@/lib/audit-logger";
import { getAirportByCode, searchAirports, type Airport } from "@/services/airport-service";
import { CustomAutocompleteAirport } from "@/components/custom/custom-autocomplete-airport";
import { CustomMultiSelectAutocomplete } from "@/components/custom/custom-multi-select-autocomplete";
import { useDebounce } from "@/hooks/use-debounce";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { checkCrewAvailability, type Conflict } from "@/services/user-activity-service";
import { Alert, AlertDescription as ShadAlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { StoredFlightSwap } from "@/schemas/flight-swap-schema";
import { approveFlightSwap, rejectFlightSwap } from "@/services/admin-flight-swap-service";
import { Textarea } from "@/components/ui/textarea";
import { SortableHeader } from "@/components/custom/custom-sortable-header";
import { Label } from "@/components/ui/label";
import type { DayContentProps } from "react-day-picker";

interface FlightForDisplay extends StoredFlight {
    departureAirportName?: string;
    arrivalAirportName?: string;
    purserName?: string;
    crewCount: number;
    pendingSwap?: StoredFlightSwap;
}

type SortableColumn = 'scheduledDepartureDateTimeUTC' | 'flightNumber' | 'departureAirportName' | 'purserName' | 'aircraftType' | 'crewCount';
type SortDirection = 'asc' | 'desc';
type ViewMode = "calendar" | "list";

const SwapApprovalDialog = ({ swap, onClose, onAction }: { swap: StoredFlightSwap, onClose: () => void, onAction: () => void }) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [rejectionNotes, setRejectionNotes] = React.useState("");
    const [isRejecting, setIsRejecting] = React.useState(false);

    const handleApprove = async () => {
        if (!user) return;
        setIsSubmitting(true);
        try {
            await approveFlightSwap(swap.id, user.uid, user.email || "N/A");
            toast({ title: "Swap Approved", description: "The flight schedules have been updated." });
            onAction();
            onClose();
        } catch (error: any) {
            toast({ title: "Approval Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleReject = async () => {
        if (!user || !rejectionNotes) {
            toast({ title: "Rejection requires notes.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            await rejectFlightSwap(swap.id, user.uid, user.email || "N/A", rejectionNotes);
            toast({ title: "Swap Rejected" });
            onAction();
            onClose();
        } catch (error: any) {
            toast({ title: "Rejection Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
            setIsRejecting(false);
        }
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Approve Flight Swap Request</DialogTitle>
                    <DialogDescription>Review the details below and approve or reject the swap.</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 py-4 text-sm">
                    <Card><CardHeader><CardTitle className="text-base">Original Flight (Initiator)</CardTitle><CardDescription>{swap.initiatingUserEmail}</CardDescription></CardHeader>
                        <CardContent><p><strong>Flight:</strong> {swap.flightInfo.flightNumber}</p><p><strong>Route:</strong> {swap.flightInfo.departureAirport} to {swap.flightInfo.arrivalAirport}</p><p><strong>Date:</strong> {format(parseISO(swap.flightInfo.scheduledDepartureDateTimeUTC), "PPP")}</p></CardContent>
                    </Card>
                    <Card><CardHeader><CardTitle className="text-base">Proposed Swap (Requester)</CardTitle><CardDescription>{swap.requestingUserEmail}</CardDescription></CardHeader>
                        <CardContent><p><strong>Flight:</strong> {swap.requestingFlightInfo?.flightNumber}</p><p><strong>Route:</strong> {swap.requestingFlightInfo?.departureAirport} to {swap.requestingFlightInfo?.arrivalAirport}</p><p><strong>Date:</strong> {format(parseISO(swap.requestingFlightInfo?.scheduledDepartureDateTimeUTC || "1970-01-01"), "PPP")}</p></CardContent>
                    </Card>
                </div>
                 {isRejecting ? (
                    <div className="space-y-2">
                        <Label htmlFor="rejection-notes">Reason for Rejection</Label>
                        <Textarea id="rejection-notes" value={rejectionNotes} onChange={(e) => setRejectionNotes(e.target.value)} placeholder="Provide a brief reason for rejection..." />
                    </div>
                ) : null}
                <DialogFooter>
                    {isRejecting ? (
                        <>
                            <Button variant="ghost" onClick={() => setIsRejecting(false)}>Cancel</Button>
                            <Button variant="destructive" onClick={handleReject} disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Confirm Rejection
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" onClick={onClose}>Close</Button>
                            <Button variant="destructive" onClick={() => setIsRejecting(true)}>Reject</Button>
                            <Button onClick={handleApprove} disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Approve Swap
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


export default function AdminFlightsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [flights, setFlights] = React.useState<FlightForDisplay[]>([]);
    const [allUsers, setAllUsers] = React.useState<User[]>([]);
    
    const [userMap, setUserMap] = React.useState<Map<string, User>>(new Map());
    const [pursers, setPursers] = React.useState<User[]>([]);
    const [pilots, setPilots] = React.useState<User[]>([]);
    const [cabinCrew, setCabinCrew] = React.useState<User[]>([]);
    const [instructors, setInstructors] = React.useState<User[]>([]);
    const [trainees, setTrainees] = React.useState<User[]>([]);
    
    const [isLoading, setIsLoading] = React.useState(true);
    const [isManageDialogOpen, setIsManageDialogOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isEditMode, setIsEditMode] = React.useState(false);
    const [currentFlight, setCurrentFlight] = React.useState<StoredFlight | null>(null);

    const [depSearch, setDepSearch] = React.useState("");
    const [arrSearch, setArrSearch] = React.useState("");
    const [debouncedDepSearch] = useDebounce(depSearch, 300);
    const [debouncedArrSearch] = useDebounce(arrSearch, 300);
    const [depResults, setDepResults] = React.useState<Airport[]>([]);
    const [arrResults, setArrResults] = React.useState<Airport[]>([]);
    const [isSearchingAirports, setIsSearchingAirports] = React.useState(false);
    
    const [crewWarnings, setCrewWarnings] = React.useState<Record<string, Conflict>>({});
    const [isCheckingAvailability, setIsCheckingAvailability] = React.useState(false);

    const [sortColumn, setSortColumn] = React.useState<SortableColumn>('scheduledDepartureDateTimeUTC');
    const [sortDirection, setSortDirection] = React.useState<SortDirection>('desc');
    const [viewMode, setViewMode] = React.useState<ViewMode>("calendar");
    const [calendarMonth, setCalendarMonth] = React.useState(new Date());
    const [selectedDay, setSelectedDay] = React.useState<Date | undefined>(new Date());

    const [swapToApprove, setSwapToApprove] = React.useState<StoredFlightSwap | null>(null);
    const [showPendingSwapsOnly, setShowPendingSwapsOnly] = React.useState(false);


    const form = useForm<FlightFormValues>({
        resolver: zodResolver(flightFormSchema),
        defaultValues: {
            flightNumber: "", departureAirport: "", arrivalAirport: "",
            scheduledDepartureDateTimeUTC: "", scheduledArrivalDateTimeUTC: "",
            aircraftType: undefined, purserId: "", pilotIds: [], cabinCrewIds: [],
            instructorIds: [], traineeIds: [],
            includeReturnFlight: false,
            returnFlightNumber: "", returnDepartureAirport: "", returnArrivalAirport: "",
            returnScheduledDepartureDateTimeUTC: "", returnScheduledArrivalDateTimeUTC: "",
            returnAircraftType: undefined, returnPurserId: "", returnPilotIds: [], returnCabinCrewIds: [],
            returnInstructorIds: [], returnTraineeIds: [],
            enableRecurrence: false,
            recurrenceType: "Daily",
            recurrenceCount: 1,
        },
    });

    const watchedFields = form.watch();

    const fetchPageData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const usersSnapshot = await getDocs(collection(db, "users"));
            const allUsersData = usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
            const userMapData = new Map(allUsersData.map(u => [u.uid, u]));

            setAllUsers(allUsersData);
            setUserMap(userMapData);
            setPilots(allUsersData.filter(u => u.role === 'pilote'));
            setPursers(allUsersData.filter(u => ['purser', 'admin', 'instructor'].includes(u.role || '') && u.role !== 'pilote'));
            setCabinCrew(allUsersData.filter(u => u.role === 'cabin crew'));
            setInstructors(allUsersData.filter(u => u.role === 'instructor'));
            setTrainees(allUsersData.filter(u => u.role === 'stagiaire'));

            const start = startOfMonth(calendarMonth);
            const end = endOfMonth(calendarMonth);
            
            const flightsQuery = query(collection(db, "flights"), where("scheduledDepartureDateTimeUTC", ">=", start.toISOString()), where("scheduledDepartureDateTimeUTC", "<=", end.toISOString()));
            const swapsQuery = query(collection(db, "flightSwaps"), where("status", "==", "pending_approval"));
            
            const [flightsSnapshot, swapsSnapshot] = await Promise.all([getDocs(flightsQuery), getDocs(swapsQuery)]);

            const pendingSwaps = swapsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredFlightSwap));
            const swapsByFlightId = new Map(pendingSwaps.map(s => [s.initiatingFlightId, s]));

            const fetchedFlights = await Promise.all(
                flightsSnapshot.docs.map(async (d) => {
                    const data = { id: d.id, ...d.data() } as StoredFlight;
                    const [depAirport, arrAirport] = await Promise.all([
                        getAirportByCode(data.departureAirport),
                        getAirportByCode(data.arrivalAirport),
                    ]);
                    const crewCount = 1 + (data.pilotIds?.length || 0) + (data.cabinCrewIds?.length || 0) + (data.instructorIds?.length || 0) + (data.traineeIds?.length || 0);
                    return {
                        ...data,
                        departureAirportName: `${depAirport?.name} (${depAirport?.iata})` || data.departureAirport,
                        arrivalAirportName: `${arrAirport?.name} (${arrAirport?.iata})` || data.arrivalAirport,
                        purserName: userMapData.get(data.purserId)?.displayName || 'N/A',
                        crewCount,
                        pendingSwap: swapsByFlightId.get(d.id),
                    } as FlightForDisplay;
                })
            );
            setFlights(fetchedFlights.sort((a,b) => new Date(b.scheduledDepartureDateTimeUTC).getTime() - new Date(a.scheduledDepartureDateTimeUTC).getTime()));
        } catch (err) {
            toast({ title: "Loading Error", description: "Could not fetch flights and crew data.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast, calendarMonth]);
    
    React.useEffect(() => {
        if (!authLoading && user?.role === 'admin') {
            fetchPageData();
        } else if (!authLoading) {
            router.push('/');
        }
    }, [user, authLoading, router, fetchPageData]);

    React.useEffect(() => {
        if(watchedFields.includeReturnFlight) {
            form.setValue('returnDepartureAirport', watchedFields.arrivalAirport);
            form.setValue('returnArrivalAirport', watchedFields.departureAirport);
            form.setValue('returnFlightNumber', watchedFields.flightNumber);
            form.setValue('returnAircraftType', watchedFields.aircraftType);
            form.setValue('returnPurserId', watchedFields.purserId);
            form.setValue('returnPilotIds', watchedFields.pilotIds);
            form.setValue('returnCabinCrewIds', watchedFields.cabinCrewIds);
            form.setValue('returnInstructorIds', watchedFields.instructorIds);
            form.setValue('returnTraineeIds', watchedFields.traineeIds);

            if (watchedFields.scheduledArrivalDateTimeUTC) {
                try {
                    const arrivalDate = parseISO(watchedFields.scheduledArrivalDateTimeUTC);
                    const defaultReturnDeparture = addHours(arrivalDate, 2);
                    form.setValue('returnScheduledDepartureDateTimeUTC', format(defaultReturnDeparture, "yyyy-MM-dd'T'HH:mm"));
                } catch(e) {/* ignore invalid date format during input */}
            }
        }
    }, [
        watchedFields.includeReturnFlight, watchedFields.arrivalAirport, watchedFields.departureAirport,
        watchedFields.flightNumber, watchedFields.aircraftType, watchedFields.purserId,
        watchedFields.pilotIds, watchedFields.cabinCrewIds, watchedFields.instructorIds, watchedFields.traineeIds,
        watchedFields.scheduledArrivalDateTimeUTC, form
    ]);

    const sortedAndFilteredFlights = React.useMemo(() => {
        let displayFlights = [...flights];

        if (showPendingSwapsOnly) {
            displayFlights = displayFlights.filter(f => f.pendingSwap);
        }

        return displayFlights.sort((a, b) => {
            const valA = a[sortColumn];
            const valB = b[sortColumn];
            let comparison = 0;

            if (sortColumn === 'scheduledDepartureDateTimeUTC') {
                 comparison = new Date(valA as string).getTime() - new Date(valB as string).getTime();
            } else if (sortColumn === 'crewCount') {
                comparison = (valA as number) - (valB as number);
            } else {
                comparison = String(valA).localeCompare(String(valB));
            }

            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [flights, sortColumn, sortDirection, showPendingSwapsOnly]);

    const handleSort = (column: SortableColumn) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection(column === 'scheduledDepartureDateTimeUTC' ? 'desc' : 'asc');
        }
    };

    React.useEffect(() => {
        if (!debouncedDepSearch) { setDepResults([]); return; }
        setIsSearchingAirports(true);
        searchAirports(debouncedDepSearch).then(res => setDepResults(res)).finally(() => setIsSearchingAirports(false));
    }, [debouncedDepSearch]);

    React.useEffect(() => {
        if (!debouncedArrSearch) { setArrResults([]); return; }
        setIsSearchingAirports(true);
        searchAirports(debouncedArrSearch).then(res => setArrResults(res)).finally(() => setIsSearchingAirports(false));
    }, [debouncedArrSearch]);

    const debouncedDep = useDebounce(form.watch("scheduledDepartureDateTimeUTC"), 500);
    const debouncedArr = useDebounce(form.watch("scheduledArrivalDateTimeUTC"), 500);

    React.useEffect(() => {
        const watchedPurser = form.watch("purserId");
        const watchedPilots = form.watch("pilotIds");
        const watchedCabinCrew = form.watch("cabinCrewIds");
        const watchedInstructors = form.watch("instructorIds");
        const watchedTrainees = form.watch("traineeIds");

        const allAssignedCrewIds = [...new Set([watchedPurser, ...(watchedPilots || []), ...(watchedCabinCrew || []), ...(watchedInstructors || []), ...(watchedTrainees || [])].filter(Boolean))];
        
        if (allAssignedCrewIds.length === 0 || !debouncedDep || !debouncedArr) {
          setCrewWarnings({});
          return;
        }

        const check = async () => {
          setIsCheckingAvailability(true);
          try {
            const startDate = startOfDay(new Date(debouncedDep));
            const endDate = startOfDay(new Date(debouncedArr));
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return;

            const warnings = await checkCrewAvailability(allAssignedCrewIds, startDate, endDate, isEditMode ? currentFlight?.id : undefined);
            setCrewWarnings(warnings);
          } catch (e) {
            console.error("Failed to check crew availability", e);
            toast({ title: "Error", description: "Could not check crew availability.", variant: "destructive" });
          } finally {
            setIsCheckingAvailability(false);
          }
        };

        check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        form.watch("purserId"), form.watch("pilotIds"), form.watch("cabinCrewIds"), form.watch("instructorIds"), form.watch("traineeIds"),
        debouncedDep, debouncedArr, toast, currentFlight, isEditMode
    ]);


    const handleOpenDialog = (flightToEdit?: StoredFlight) => {
        if (flightToEdit) {
            setIsEditMode(true);
            setCurrentFlight(flightToEdit);
            form.reset({
                flightNumber: flightToEdit.flightNumber,
                departureAirport: flightToEdit.departureAirport,
                arrivalAirport: flightToEdit.arrivalAirport,
                scheduledDepartureDateTimeUTC: flightToEdit.scheduledDepartureDateTimeUTC.substring(0, 16),
                scheduledArrivalDateTimeUTC: flightToEdit.scheduledArrivalDateTimeUTC.substring(0, 16),
                aircraftType: flightToEdit.aircraftType as any,
                purserId: flightToEdit.purserId,
                pilotIds: flightToEdit.pilotIds || [],
                cabinCrewIds: flightToEdit.cabinCrewIds || [],
                instructorIds: flightToEdit.instructorIds || [],
                traineeIds: flightToEdit.traineeIds || [],
                includeReturnFlight: false,
                enableRecurrence: false, // recurrence disabled for editing
            });
        } else {
            setIsEditMode(false);
            setCurrentFlight(null);
            form.reset({
                flightNumber: "", departureAirport: "", arrivalAirport: "",
                scheduledDepartureDateTimeUTC: "", scheduledArrivalDateTimeUTC: "",
                aircraftType: undefined, purserId: "", pilotIds: [], cabinCrewIds: [],
                instructorIds: [], traineeIds: [],
                includeReturnFlight: false,
                returnFlightNumber: "", returnDepartureAirport: "", returnArrivalAirport: "",
                returnScheduledDepartureDateTimeUTC: "", returnScheduledArrivalDateTimeUTC: "",
                returnAircraftType: undefined, returnPurserId: "", returnPilotIds: [], returnCabinCrewIds: [],
                returnInstructorIds: [], returnTraineeIds: [],
                enableRecurrence: false,
                recurrenceType: "Daily",
                recurrenceCount: 1,
            });
        }
        setDepSearch("");
        setArrSearch("");
        setCrewWarnings({});
        setIsManageDialogOpen(true);
    };

    const handleCreateReturnFlight = (flight: FlightForDisplay) => {
        setIsEditMode(false);
        setCurrentFlight(null);
        form.reset({
            flightNumber: flight.flightNumber,
            departureAirport: flight.arrivalAirport, // Swapped
            arrivalAirport: flight.departureAirport, // Swapped
            scheduledDepartureDateTimeUTC: "",
            scheduledArrivalDateTimeUTC: "",
            aircraftType: flight.aircraftType as any,
            purserId: flight.purserId,
            pilotIds: flight.pilotIds || [],
            cabinCrewIds: flight.cabinCrewIds || [],
            instructorIds: flight.instructorIds || [],
            traineeIds: flight.traineeIds || [],
            includeReturnFlight: false,
            enableRecurrence: false, // recurrence disabled
        });
        setDepSearch(flight.arrivalAirportName || flight.arrivalAirport);
        setArrSearch(flight.departureAirportName || flight.departureAirport);
        setCrewWarnings({});
        setIsManageDialogOpen(true);
    };


    const handleFormSubmit = async (data: FlightFormValues) => {
        if (!user) return;
        
        if (Object.keys(crewWarnings).length > 0) {
            if (!window.confirm("There are scheduling conflicts for some crew members. Are you sure you want to proceed?")) {
                return;
            }
        }

        setIsSubmitting(true);
        let wasSuccessful = false;
        
        try {
            const batch = writeBatch(db);

            if (isEditMode && currentFlight) {
                // UPDATE logic for a single flight
                const outboundCrewIds = [...new Set([data.purserId, ...(data.pilotIds || []), ...(data.cabinCrewIds || []), ...(data.instructorIds || []), ...(data.traineeIds || [])].filter(Boolean))];
                const flightRef = doc(db, "flights", currentFlight.id);
                if (currentFlight.activityIds) {
                    for (const activityId of Object.values(currentFlight.activityIds)) { batch.delete(doc(db, "userActivities", activityId)); }
                }
                
                const activityIds: Record<string, string> = {};
                for (const crewId of outboundCrewIds) {
                    const activityRef = doc(collection(db, "userActivities"));
                    batch.set(activityRef, { userId: crewId, activityType: 'flight' as const, flightId: currentFlight.id, date: Timestamp.fromDate(startOfDay(new Date(data.scheduledDepartureDateTimeUTC))), flightNumber: data.flightNumber, departureAirport: data.departureAirport, arrivalAirport: data.arrivalAirport, comments: `Flight ${data.flightNumber} from ${data.departureAirport} to ${data.arrivalAirport}` });
                    activityIds[crewId] = activityRef.id;
                }
                
                batch.update(flightRef, { ...data, allCrewIds: outboundCrewIds, activityIds, updatedAt: serverTimestamp() });
                await logAuditEvent({ userId: user.uid, userEmail: user.email, actionType: "UPDATE_FLIGHT", entityType: "FLIGHT", entityId: currentFlight.id, details: { flightNumber: data.flightNumber } });
                toast({ title: "Flight Updated", description: `Flight ${data.flightNumber} has been updated.` });
            
            } else {
                // CREATE logic for one or more flights
                const initialDepartureDate = parseISO(data.scheduledDepartureDateTimeUTC);
                const initialArrivalDate = parseISO(data.scheduledArrivalDateTimeUTC);
                const flightDurationMinutes = differenceInMinutes(initialArrivalDate, initialDepartureDate);
                const recurrenceCount = data.enableRecurrence ? data.recurrenceCount || 1 : 1;

                for (let i = 0; i < recurrenceCount; i++) {
                    const dateOffsetFn = data.recurrenceType === 'Daily' ? (d: Date) => addDays(d, i) : (d: Date) => addWeeks(d, i);
                    
                    const currentDepartureDate = dateOffsetFn(initialDepartureDate);
                    const currentArrivalDate = addMinutes(currentDepartureDate, flightDurationMinutes);
                    const currentData = {
                        ...data,
                        scheduledDepartureDateTimeUTC: currentDepartureDate.toISOString(),
                        scheduledArrivalDateTimeUTC: currentArrivalDate.toISOString(),
                    };

                    const outboundCrewIds = [...new Set([currentData.purserId, ...(currentData.pilotIds || []), ...(currentData.cabinCrewIds || []), ...(currentData.instructorIds || []), ...(currentData.traineeIds || [])].filter(Boolean))];
                    const outboundFlightRef = doc(collection(db, "flights"));
                    const outboundActivityIds: Record<string, string> = {};
                    for (const crewId of outboundCrewIds) {
                        const activityRef = doc(collection(db, "userActivities"));
                        batch.set(activityRef, { userId: crewId, activityType: 'flight' as const, flightId: outboundFlightRef.id, date: Timestamp.fromDate(startOfDay(currentDepartureDate)), flightNumber: currentData.flightNumber, departureAirport: currentData.departureAirport, arrivalAirport: currentData.arrivalAirport, comments: `Flight ${currentData.flightNumber} from ${currentData.departureAirport} to ${currentData.arrivalAirport}` });
                        outboundActivityIds[crewId] = activityRef.id;
                    }
                    batch.set(outboundFlightRef, { ...currentData, allCrewIds: outboundCrewIds, activityIds: outboundActivityIds, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), purserReportSubmitted: false });
                }
                
                await logAuditEvent({ userId: user.uid, userEmail: user.email, actionType: "CREATE_RECURRING_FLIGHTS", entityType: "FLIGHT", details: { flightNumber: data.flightNumber, count: recurrenceCount, type: data.recurrenceType } });
                
                toast({ title: "Flights Created", description: `${recurrenceCount} flight(s) for ${data.flightNumber} have been scheduled.` });
            }
            
            await batch.commit();
            wasSuccessful = true;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
            toast({ title: "Operation Failed", description: errorMessage, variant: "destructive" });
        } finally {
            if (wasSuccessful) {
                fetchPageData();
                setIsManageDialogOpen(false);
            }
            setIsSubmitting(false);
        }
    };
    
    const handleDelete = async (flightToDelete: StoredFlight) => {
        if (!user || !window.confirm(`Are you sure you want to delete flight ${flightToDelete.flightNumber}? This will also remove it from all assigned crew schedules.`)) return;
        
        try {
            const batch = writeBatch(db);
            const flightRef = doc(db, "flights", flightToDelete.id);
            batch.delete(flightRef);

            if (flightToDelete.activityIds) {
                for (const activityId of Object.values(flightToDelete.activityIds)) {
                    batch.delete(doc(db, "userActivities", activityId));
                }
            }
            
            await batch.commit();
            await logAuditEvent({ userId: user.uid, userEmail: user.email, actionType: "DELETE_FLIGHT", entityType: "FLIGHT", entityId: flightToDelete.id, details: { flightNumber: flightToDelete.flightNumber } });
            toast({ title: "Flight Deleted", description: `Flight "${flightToDelete.flightNumber}" and associated schedule entries have been removed.` });
            fetchPageData();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
            toast({ title: "Deletion Failed", description: errorMessage, variant: "destructive" });
        }
    };

    if (authLoading || isLoading) return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    if (!user || user.role !== 'admin') return <div className="flex flex-col items-center justify-center min-h-screen text-center p-4"><AlertTriangle className="h-16 w-16 text-destructive mb-4" /><CardTitle className="text-2xl mb-2">Access Denied</CardTitle><p className="text-muted-foreground">You do not have permission to view this page.</p><Button onClick={() => router.push('/')} className="mt-6">Go to Dashboard</Button></div>;

    const selectedDayFlights = flights.filter(f => selectedDay && isSameDay(parseISO(f.scheduledDepartureDateTimeUTC), selectedDay));
    const dayHasFlights = (date: Date) => flights.some(f => isSameDay(parseISO(f.scheduledDepartureDateTimeUTC), date));

    const CalendarDay = (props: DayContentProps) => {
        const hasFlights = dayHasFlights(props.date);
        return (
            <div className="relative flex h-full w-full items-center justify-center">
                <p>{format(props.date, 'd')}</p>
                {hasFlights &&
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5">
                        <div className={cn("h-1.5 w-1.5 rounded-full", "bg-primary")} />
                    </div>
                }
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader className="flex flex-row justify-between items-start">
                    <div>
                        <CardTitle className="text-2xl font-headline flex items-center"><Plane className="mr-3 h-7 w-7 text-primary" />Flight Management</CardTitle>
                        <CardDescription>Schedule new flights and assign crew members.</CardDescription>
                    </div>
                     <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setViewMode('calendar')} className={cn(viewMode === 'calendar' && 'bg-accent text-accent-foreground')}><CalendarIcon className="mr-2 h-4 w-4"/>Calendar</Button>
                        <Button variant="outline" size="sm" onClick={() => setViewMode('list')} className={cn(viewMode === 'list' && 'bg-accent text-accent-foreground')}><List className="mr-2 h-4 w-4"/>List</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-center gap-4">
                        <Button variant="outline" onClick={fetchPageData} disabled={isLoading}><RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />Refresh</Button>
                        <Button onClick={() => handleOpenDialog()}><PlusCircle className="mr-2 h-4 w-4"/>Create Flight</Button>
                        <div className="flex items-center space-x-2 ml-auto">
                            <Label htmlFor="pending-swaps-filter" className="flex items-center gap-1 text-sm"><Filter className="h-4 w-4"/>Pending Swaps Only</Label>
                            <Switch id="pending-swaps-filter" checked={showPendingSwapsOnly} onCheckedChange={setShowPendingSwapsOnly} />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {viewMode === 'list' ? (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <SortableHeader column="scheduledDepartureDateTimeUTC" label="Date" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/>
                                <SortableHeader column="flightNumber" label="Flight No." sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/>
                                <SortableHeader column="departureAirportName" label="Route" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/>
                                <SortableHeader column="purserName" label="Purser" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedAndFilteredFlights.map((f) => (
                                <TableRow key={f.id}>
                                    <TableCell className="font-medium text-xs">{format(new Date(f.scheduledDepartureDateTimeUTC), "PP")}</TableCell>
                                    <TableCell>{f.flightNumber}</TableCell>
                                    <TableCell className="text-xs">{f.departureAirportName} → {f.arrivalAirportName}</TableCell>
                                    <TableCell className="text-xs">
                                            <Link href={`/admin/users/${f.purserId}`} className="hover:underline text-primary">
                                            {f.purserName}
                                        </Link>
                                    </TableCell>
                                     <TableCell className="space-x-2">
                                        {!f.purserReportSubmitted && (<Button variant="outline" size="icon" className="h-7 w-7 border-amber-500/50 text-amber-600" title="Purser Report Pending"><FileSignature className="h-4 w-4" /></Button>)}
                                        {f.pendingSwap && (<Button variant="outline" size="icon" className="h-7 w-7 border-blue-500/50 text-blue-600 animate-pulse" title="Swap Request Pending" onClick={() => setSwapToApprove(f.pendingSwap!)}><Handshake className="h-4 w-4" /></Button>)}
                                    </TableCell>
                                    <TableCell className="text-right space-x-1">
                                        <Button variant="ghost" size="icon" onClick={() => handleCreateReturnFlight(f)} title="Create Return Flight"><ArrowRightLeft className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(f)} title="Edit Flight"><Edit className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(f)} title="Delete Flight"><Trash2 className="h-4 w-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {sortedAndFilteredFlights.length === 0 && <p className="text-center text-muted-foreground py-8">No flights found matching criteria.</p>}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <Calendar
                            mode="single"
                            selected={selectedDay}
                            onSelect={setSelectedDay}
                            month={calendarMonth}
                            onMonthChange={setCalendarMonth}
                            className="w-full p-2"
                            components={{ Day: CalendarDay }}
                        />
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Flights on {selectedDay ? format(selectedDay, 'PPP') : '...'}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {selectedDayFlights.length > 0 ? (
                                <ScrollArea className="h-72">
                                    <div className="space-y-4 pr-4">
                                    {selectedDayFlights.map(f => (
                                        <div key={f.id} className="p-3 border rounded-md">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-semibold">{f.flightNumber}</p>
                                                    <p className="text-xs text-muted-foreground">{f.departureAirportName} → {f.arrivalAirportName}</p>
                                                </div>
                                                <div className="flex gap-1">
                                                     <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenDialog(f)} title="Edit Flight"><Edit className="h-4 w-4" /></Button>
                                                     <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(f)} title="Delete Flight"><Trash2 className="h-4 w-4" /></Button>
                                                </div>
                                            </div>
                                            <p className="text-xs mt-2">Purser: <Link href={`/admin/users/${f.purserId}`} className="hover:underline text-primary">{f.purserName}</Link></p>
                                        </div>
                                    ))}
                                    </div>
                                </ScrollArea>
                            ) : (
                                <p className="text-center text-muted-foreground py-8">No flights scheduled for this day.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {swapToApprove && (
                <SwapApprovalDialog swap={swapToApprove} onClose={() => setSwapToApprove(null)} onAction={fetchPageData} />
            )}

            <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>{isEditMode ? "Edit Flight" : "Create New Flight"}</DialogTitle>
                        <DialogDescription>{isEditMode ? "Update the flight details below." : "Fill in the form to schedule a new flight."}</DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleFormSubmit)}>
                        <ScrollArea className="h-[70vh] p-4">
                            <div className="space-y-6">
                            
                            <h3 className="text-lg font-semibold text-primary flex items-center gap-2"><Plane />Outbound Flight</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="flightNumber" render={({ field }) => (<FormItem><FormLabel>Flight Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="aircraftType" render={({ field }) => ( <FormItem><FormLabel>Aircraft Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select an aircraft" /></SelectTrigger></FormControl><SelectContent>{aircraftTypes.map(type => ( <SelectItem key={type} value={type}>{type}</SelectItem> ))}</SelectContent></Select><FormMessage /></FormItem> )}/>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               <Controller control={form.control} name="departureAirport" render={({ field }) => (<FormItem><FormLabel>Departure</FormLabel><CustomAutocompleteAirport value={field.value} onSelect={(airport) => field.onChange(airport?.icao || "")} airports={depResults} isLoading={isSearchingAirports} onInputChange={setDepSearch} currentSearchTerm={depSearch} placeholder="Search departure..." /><FormMessage /></FormItem>)} />
                               <Controller control={form.control} name="arrivalAirport" render={({ field }) => (<FormItem><FormLabel>Arrival</FormLabel><CustomAutocompleteAirport value={field.value} onSelect={(airport) => field.onChange(airport?.icao || "")} airports={arrResults} isLoading={isSearchingAirports} onInputChange={setArrSearch} currentSearchTerm={arrSearch} placeholder="Search arrival..." /><FormMessage /></FormItem>)} />
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="scheduledDepartureDateTimeUTC" render={({ field }) => (<FormItem><FormLabel>Departure Time (UTC)</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="scheduledArrivalDateTimeUTC" render={({ field }) => (<FormItem><FormLabel>Arrival Time (UTC)</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                            
                            <Separator/>
                            <h3 className="text-lg font-medium flex items-center gap-2"><Users />Crew Assignment</h3>
                             <FormField control={form.control} name="purserId" render={({ field }) => (<FormItem><FormLabel>Assign Purser</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a purser" /></SelectTrigger></FormControl><SelectContent>{pursers.map(p => <SelectItem key={p.uid} value={p.uid}>{p.displayName} ({p.email})</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                             <FormField control={form.control} name="pilotIds" render={({ field }) => (<FormItem><FormLabel>Assign Pilots</FormLabel><CustomMultiSelectAutocomplete placeholder="Select pilots..." options={pilots.map(p => ({value: p.uid, label: `${p.displayName} (${p.email})`}))} selected={field.value || []} onChange={field.onChange} /><FormMessage /></FormItem>)} />
                             <FormField control={form.control} name="cabinCrewIds" render={({ field }) => (<FormItem><FormLabel>Assign Cabin Crew</FormLabel><CustomMultiSelectAutocomplete placeholder="Select cabin crew..." options={cabinCrew.map(c => ({value: c.uid, label: `${c.displayName} (${c.email})`}))} selected={field.value || []} onChange={field.onChange} /><FormMessage /></FormItem>)} />
                             <FormField control={form.control} name="instructorIds" render={({ field }) => (<FormItem><FormLabel>Assign Instructors</FormLabel><CustomMultiSelectAutocomplete placeholder="Select instructors..." options={instructors.map(i => ({value: i.uid, label: `${i.displayName} (${i.email})`}))} selected={field.value || []} onChange={field.onChange} /><FormMessage /></FormItem>)} />
                             <FormField control={form.control} name="traineeIds" render={({ field }) => (<FormItem><FormLabel>Assign Stagiaires</FormLabel><CustomMultiSelectAutocomplete placeholder="Select stagiaires..." options={trainees.map(t => ({value: t.uid, label: `${t.displayName} (${t.email})`}))} selected={field.value || []} onChange={field.onChange} /><FormMessage /></FormItem>)} />
                            
                             <Separator/>
                             <h3 className="text-lg font-medium">Crew Availability</h3>
                                {isCheckingAvailability ? (
                                    <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Checking schedules...</div>
                                ) : Object.keys(crewWarnings).length > 0 ? (
                                    <div className="space-y-2">
                                        {Object.entries(crewWarnings).map(([userId, conflict]) => (
                                            <Alert key={userId} variant="warning">
                                                <AlertTriangle className="h-4 w-4" />
                                                <AlertTitle>{userMap.get(userId)?.displayName || 'User'} has a conflict</AlertTitle>
                                                <ShadAlertDescription>{conflict.details}</ShadAlertDescription>
                                            </Alert>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No conflicts detected for the selected crew and dates.</p>
                                )}
                            
                            {!isEditMode && (
                                <>
                                <Separator/>
                                <FormField control={form.control} name="includeReturnFlight" render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-base">Include Return Flight</FormLabel>
                                            <FormDescription>Automatically create a return flight for this rotation.</FormDescription>
                                        </div>
                                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                    </FormItem>
                                )} />

                                {watchedFields.includeReturnFlight && (
                                    <div className="space-y-6 p-4 border-l-4 border-primary/50 bg-muted/30 rounded-r-md">
                                        <h3 className="text-lg font-semibold text-primary flex items-center gap-2"><Plane className="h-5 w-5 -scale-x-100" />Return Flight</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormField control={form.control} name="returnFlightNumber" render={({ field }) => (<FormItem><FormLabel>Flight Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                            <FormField control={form.control} name="returnAircraftType" render={({ field }) => ( <FormItem><FormLabel>Aircraft Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select an aircraft" /></SelectTrigger></FormControl><SelectContent>{aircraftTypes.map(type => ( <SelectItem key={type} value={type}>{type}</SelectItem> ))}</SelectContent></Select><FormMessage /></FormItem> )}/>
                                        </div>
                                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormField control={form.control} name="returnDepartureAirport" render={({ field }) => (<FormItem><FormLabel>Departure</FormLabel><FormControl><Input {...field} disabled /></FormControl><FormMessage /></FormItem>)} />
                                            <FormField control={form.control} name="returnArrivalAirport" render={({ field }) => (<FormItem><FormLabel>Arrival</FormLabel><FormControl><Input {...field} disabled /></FormControl><FormMessage /></FormItem>)} />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormField control={form.control} name="returnScheduledDepartureDateTimeUTC" render={({ field }) => (<FormItem><FormLabel>Departure Time (UTC)</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                            <FormField control={form.control} name="returnScheduledArrivalDateTimeUTC" render={({ field }) => (<FormItem><FormLabel>Arrival Time (UTC)</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        </div>
                                        <h4 className="text-md font-semibold pt-4">Return Crew Assignment</h4>
                                        <FormField control={form.control} name="returnPurserId" render={({ field }) => (<FormItem><FormLabel>Assign Purser</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a purser" /></SelectTrigger></FormControl><SelectContent>{pursers.map(p => <SelectItem key={p.uid} value={p.uid}>{p.displayName} ({p.email})</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="returnPilotIds" render={({ field }) => (<FormItem><FormLabel>Assign Pilots</FormLabel><CustomMultiSelectAutocomplete placeholder="Select pilots..." options={pilots.map(p => ({value: p.uid, label: `${p.displayName} (${p.email})`}))} selected={field.value || []} onChange={field.onChange} /><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="returnCabinCrewIds" render={({ field }) => (<FormItem><FormLabel>Assign Cabin Crew</FormLabel><CustomMultiSelectAutocomplete placeholder="Select cabin crew..." options={cabinCrew.map(c => ({value: c.uid, label: `${c.displayName} (${c.email})`}))} selected={field.value || []} onChange={field.onChange} /><FormMessage /></FormItem>)} />
                                    </div>
                                )}

                                <Separator/>
                                <FormField control={form.control} name="enableRecurrence" render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-base">Enable Recurrence</FormLabel>
                                            <FormDescription>Create this flight on a recurring schedule.</FormDescription>
                                        </div>
                                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                    </FormItem>
                                )} />
                                {watchedFields.enableRecurrence && (
                                    <div className="space-y-6 p-4 border-l-4 border-primary/50 bg-muted/30 rounded-r-md">
                                        <h3 className="text-lg font-semibold text-primary flex items-center gap-2"><Repeat/>Recurrence Details</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                             <FormField control={form.control} name="recurrenceType" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Frequency</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="Daily">Daily</SelectItem>
                                                            <SelectItem value="Weekly">Weekly</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                             <FormField control={form.control} name="recurrenceCount" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Number of Occurrences</FormLabel>
                                                    <FormControl><Input type="number" min="1" max="52" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        </div>
                                        <Alert variant="info">
                                            <Info className="h-4 w-4" />
                                            <AlertTitle>Heads Up!</AlertTitle>
                                            <ShadAlertDescription>
                                                This will create {watchedFields.recurrenceCount || 1} separate flight(s) with the same crew. Return flights and availability conflicts are not checked for recurring flights.
                                            </ShadAlertDescription>
                                        </Alert>
                                    </div>
                                )}
                                </>
                            )}

                            </div>
                        </ScrollArea>
                            <DialogFooter className="mt-4 pt-4 border-t">
                                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                                <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{isEditMode ? "Save Changes" : "Create Flight(s)"}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
