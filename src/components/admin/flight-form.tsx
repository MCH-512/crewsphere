
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { type User } from "@/schemas/user-schema";
import { db } from "@/lib/firebase";
import { collection, doc, writeBatch, serverTimestamp, Timestamp } from "firebase/firestore";
import { Loader2, ArrowLeft, ArrowRight, Plane, Users, Send, Repeat, Info, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { startOfDay, parseISO, differenceInMinutes, addMinutes, addDays, addWeeks } from "date-fns";
import { flightFormSchema, type FlightFormValues, type StoredFlight, aircraftTypes } from "@/schemas/flight-schema";
import { logAuditEvent } from "@/lib/audit-logger";
import { CustomAutocompleteAirport } from "@/components/custom/custom-autocomplete-airport";
import { CustomMultiSelectAutocomplete } from "@/components/custom/custom-multi-select-autocomplete";
import { useDebounce } from "@/hooks/use-debounce";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { checkCrewAvailability, type Conflict } from "@/services/user-activity-service";
import { Alert, AlertDescription as ShadAlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { AnimatedCard } from "@/components/motion/animated-card";
import { cn } from "@/lib/utils";
import { Airport, searchAirports } from "@/services/airport-service";

interface FlightFormProps {
    isEditMode: boolean;
    currentFlight: StoredFlight | null;
    onFormSubmitSuccess: () => void;
    allUsers: User[];
    userMap: Map<string, User>;
    pursers: User[];
    pilots: User[];
    cabinCrew: User[];
    instructors: User[];
    trainees: User[];
}

const wizardSteps = [
    { id: 1, title: 'Flight Details', fields: ['flightNumber', 'aircraftType', 'departureAirport', 'arrivalAirport', 'scheduledDepartureDateTimeUTC', 'scheduledArrivalDateTimeUTC', 'enableRecurrence', 'recurrenceType', 'recurrenceCount'], icon: Plane },
    { id: 2, title: 'Crew Assignment', fields: ['purserId', 'pilotIds', 'cabinCrewIds', 'instructorIds', 'traineeIds'], icon: Users },
];

export function FlightForm({ isEditMode, currentFlight, onFormSubmitSuccess, allUsers, userMap, pursers, pilots, cabinCrew, instructors, trainees }: FlightFormProps) {
    const { user } = useAuth();
    const { toast } = useToast();

    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [currentStep, setCurrentStep] = React.useState(0);
    
    const [depSearch, setDepSearch] = React.useState("");
    const [arrSearch, setArrSearch] = React.useState("");
    const [debouncedDepSearch] = useDebounce(depSearch, 300);
    const [debouncedArrSearch] = useDebounce(arrSearch, 300);
    const [depResults, setDepResults] = React.useState<Airport[]>([]);
    const [arrResults, setArrResults] = React.useState<Airport[]>([]);
    const [isSearchingAirports, setIsSearchingAirports] = React.useState(false);
    
    const [crewWarnings, setCrewWarnings] = React.useState<Record<string, Conflict>>({});
    const [isCheckingAvailability, setIsCheckingAvailability] = React.useState(false);

    const form = useForm<FlightFormValues>({
        resolver: zodResolver(flightFormSchema),
        defaultValues: {
            flightNumber: "", departureAirport: "", arrivalAirport: "",
            scheduledDepartureDateTimeUTC: "", scheduledArrivalDateTimeUTC: "",
            aircraftType: undefined, purserId: "", pilotIds: [], cabinCrewIds: [],
            instructorIds: [], traineeIds: [],
            enableRecurrence: false, recurrenceType: "Daily", recurrenceCount: 1,
        },
        mode: "onChange",
    });

    const watchedFields = form.watch();
    const debouncedDep = useDebounce(form.watch("scheduledDepartureDateTimeUTC"), 500);
    const debouncedArr = useDebounce(form.watch("scheduledArrivalDateTimeUTC"), 500);

    React.useEffect(() => {
        if (isEditMode && currentFlight) {
            form.reset({
                flightNumber: currentFlight.flightNumber,
                departureAirport: currentFlight.departureAirport,
                arrivalAirport: currentFlight.arrivalAirport,
                scheduledDepartureDateTimeUTC: currentFlight.scheduledDepartureDateTimeUTC.substring(0, 16),
                scheduledArrivalDateTimeUTC: currentFlight.scheduledArrivalDateTimeUTC.substring(0, 16),
                aircraftType: currentFlight.aircraftType as any,
                purserId: currentFlight.purserId,
                pilotIds: currentFlight.pilotIds || [],
                cabinCrewIds: currentFlight.cabinCrewIds || [],
                instructorIds: currentFlight.instructorIds || [],
                traineeIds: currentFlight.traineeIds || [],
                enableRecurrence: false,
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditMode, currentFlight]);

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

    React.useEffect(() => {
        const allAssignedCrewIds = [...new Set([watchedFields.purserId, ...(watchedFields.pilotIds || []), ...(watchedFields.cabinCrewIds || []), ...(watchedFields.instructorIds || []), ...(watchedFields.traineeIds || [])].filter(Boolean))];
        
        if (allAssignedCrewIds.length === 0 || !debouncedDep || !debouncedArr) {
          setCrewWarnings({}); return;
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
          } finally { setIsCheckingAvailability(false); }
        };
        check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [watchedFields.purserId, JSON.stringify(watchedFields.pilotIds), JSON.stringify(watchedFields.cabinCrewIds), JSON.stringify(watchedFields.instructorIds), JSON.stringify(watchedFields.traineeIds), debouncedDep, debouncedArr, isEditMode, currentFlight]);


    const handleFormSubmit = async (data: FlightFormValues) => {
        if (!user) return;
        
        if (Object.keys(crewWarnings).length > 0 && !window.confirm("There are scheduling conflicts. Proceed anyway?")) {
            return;
        }

        setIsSubmitting(true);
        try {
            const batch = writeBatch(db);
            const flightRef = isEditMode && currentFlight ? doc(db, "flights", currentFlight.id) : doc(collection(db, "flights"));

            if (isEditMode && currentFlight) {
                 if (currentFlight.activityIds) {
                    for (const activityId of Object.values(currentFlight.activityIds)) { batch.delete(doc(db, "userActivities", activityId)); }
                }
                const crewIds = [...new Set([data.purserId, ...(data.pilotIds || []), ...(data.cabinCrewIds || []), ...(data.instructorIds || []), ...(data.traineeIds || [])].filter(Boolean))];
                const activityIds: Record<string, string> = {};
                for (const crewId of crewIds) {
                    const activityRef = doc(collection(db, "userActivities"));
                    batch.set(activityRef, { userId: crewId, activityType: 'flight' as const, flightId: currentFlight.id, date: Timestamp.fromDate(startOfDay(new Date(data.scheduledDepartureDateTimeUTC))), flightNumber: data.flightNumber, departureAirport: data.departureAirport, arrivalAirport: data.arrivalAirport, comments: `Flight ${data.flightNumber}` });
                    activityIds[crewId] = activityRef.id;
                }
                batch.update(flightRef, { ...data, allCrewIds: crewIds, activityIds, updatedAt: serverTimestamp() });
                await logAuditEvent({ userId: user.uid, userEmail: user.email!, actionType: "UPDATE_FLIGHT", entityType: "FLIGHT", entityId: currentFlight.id, details: { flightNumber: data.flightNumber } });
            } else {
                const initialDepartureDate = parseISO(data.scheduledDepartureDateTimeUTC);
                const initialArrivalDate = parseISO(data.scheduledArrivalDateTimeUTC);
                const flightDurationMinutes = differenceInMinutes(initialArrivalDate, initialDepartureDate);
                const recurrenceCount = data.enableRecurrence ? data.recurrenceCount || 1 : 1;

                for (let i = 0; i < recurrenceCount; i++) {
                    const dateOffsetFn = data.recurrenceType === 'Weekly' ? (d: Date) => addWeeks(d, i) : (d: Date) => addDays(d, i);
                    const currentDepartureDate = dateOffsetFn(initialDepartureDate);
                    const currentArrivalDate = addMinutes(currentDepartureDate, flightDurationMinutes);
                    
                    const newFlightRef = doc(collection(db, "flights"));
                    const crewIds = [...new Set([data.purserId, ...(data.pilotIds || []), ...(data.cabinCrewIds || []), ...(data.instructorIds || []), ...(data.traineeIds || [])].filter(Boolean))];
                    const activityIds: Record<string, string> = {};
                    for (const crewId of crewIds) {
                        const activityRef = doc(collection(db, "userActivities"));
                        batch.set(activityRef, { userId: crewId, activityType: 'flight' as const, flightId: newFlightRef.id, date: Timestamp.fromDate(startOfDay(currentDepartureDate)), flightNumber: data.flightNumber, departureAirport: data.departureAirport, arrivalAirport: data.arrivalAirport, comments: `Flight ${data.flightNumber}` });
                        activityIds[crewId] = activityRef.id;
                    }
                    batch.set(newFlightRef, { ...data, scheduledDepartureDateTimeUTC: currentDepartureDate.toISOString(), scheduledArrivalDateTimeUTC: currentArrivalDate.toISOString(), allCrewIds: crewIds, activityIds, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), purserReportSubmitted: false });
                }
                await logAuditEvent({ userId: user.uid, userEmail: user.email!, actionType: "CREATE_RECURRING_FLIGHTS", entityType: "FLIGHT", details: { flightNumber: data.flightNumber, count: recurrenceCount, type: data.recurrenceType } });
            }
            await batch.commit();
            toast({ title: isEditMode ? "Flight Updated" : "Flight(s) Created", description: `Schedules have been updated.` });
            onFormSubmitSuccess();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
            toast({ title: "Operation Failed", description: errorMessage, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const triggerValidation = async (fields: (keyof FlightFormValues)[]) => await form.trigger(fields);
    const nextStep = async () => {
        const fieldsToValidate = wizardSteps[currentStep].fields as (keyof FlightFormValues)[];
        if (await triggerValidation(fieldsToValidate)) setCurrentStep(prev => prev + 1);
        else toast({ title: "Incomplete Section", description: "Please fill all required fields.", variant: "destructive" });
    };
    const prevStep = () => setCurrentStep(prev => prev - 1);
    const progressPercentage = ((currentStep + 1) / wizardSteps.length) * 100;
    
    return (
        <>
            <DialogHeader>
                <DialogTitle>{isEditMode ? "Edit Flight" : "Create New Flight"}</DialogTitle>
                <DialogDescription>{isEditMode ? "Update flight details." : "Schedule a new flight."}</DialogDescription>
                <Progress value={progressPercentage} className="mt-4"/>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Step {currentStep + 1} of {wizardSteps.length}: <strong>{wizardSteps[currentStep].title}</strong></span>
                    <span>{Math.round(progressPercentage)}% Complete</span>
                </div>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleFormSubmit)}>
                <ScrollArea className="h-[70vh] p-4">
                    <div className="space-y-6">
                        <AnimatedCard delay={0.1} className={cn(currentStep !== 0 && "hidden")}>
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-primary flex items-center gap-2 mb-4"><Plane />Flight Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField control={form.control} name="flightNumber" render={({ field }) => (<FormItem><FormLabel>Flight Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="aircraftType" render={({ field }) => ( <FormItem><FormLabel>Aircraft Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select an aircraft" /></SelectTrigger></FormControl><SelectContent>{aircraftTypes.map(type => ( <SelectItem key={type} value={type}>{type}</SelectItem> ))}</SelectContent></Select><FormMessage /></FormItem> )}/>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <Controller control={form.control} name="departureAirport" render={({ field }) => (<FormItem><FormLabel>Departure</FormLabel><CustomAutocompleteAirport value={field.value} onSelect={(airport) => field.onChange(airport?.icao || "")} airports={depResults} isLoading={isSearchingAirports} onInputChange={setDepSearch} currentSearchTerm={depSearch} placeholder="Search departure..." /><FormMessage /></FormItem>)} />
                                <Controller control={form.control} name="arrivalAirport" render={({ field }) => (<FormItem><FormLabel>Arrival</FormLabel><CustomAutocompleteAirport value={field.value} onSelect={(airport) => field.onChange(airport?.icao || "")} airports={arrResults} isLoading={isSearchingAirports} onInputChange={setArrSearch} currentSearchTerm={arrSearch} placeholder="Search arrival..." /><FormMessage /></FormItem>)} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                    <FormField control={form.control} name="scheduledDepartureDateTimeUTC" render={({ field }) => (<FormItem><FormLabel>Departure Time (UTC)</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="scheduledArrivalDateTimeUTC" render={({ field }) => (<FormItem><FormLabel>Arrival Time (UTC)</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                </div>
                                {!isEditMode && (
                                    <>
                                    <Separator className="my-6"/>
                                    <FormField control={form.control} name="enableRecurrence" render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-base">Enable Recurrence</FormLabel><FormDescription>Create this flight on a recurring schedule.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                                    )}/>
                                    {watchedFields.enableRecurrence && (
                                        <div className="space-y-6 p-4 border-l-4 border-primary/50 bg-muted/30 rounded-r-md">
                                            <h3 className="text-lg font-semibold text-primary flex items-center gap-2"><Repeat/>Recurrence Details</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <FormField control={form.control} name="recurrenceType" render={({ field }) => (<FormItem><FormLabel>Frequency</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="Daily">Daily</SelectItem><SelectItem value="Weekly">Weekly</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                                <FormField control={form.control} name="recurrenceCount" render={({ field }) => (<FormItem><FormLabel>Number of Occurrences</FormLabel><FormControl><Input type="number" min="1" max="52" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))} /></FormControl><FormMessage /></FormItem>)} />
                                            </div>
                                            <Alert variant="info"><Info className="h-4 w-4" /><AlertTitle>Heads Up!</AlertTitle><ShadAlertDescription>This will create {watchedFields.recurrenceCount || 1} separate flight(s) with the same crew.</ShadAlertDescription></Alert>
                                        </div>
                                    )}
                                    </>
                                )}
                            </div>
                        </AnimatedCard>
                        <AnimatedCard delay={0.1} className={cn(currentStep !== 1 && "hidden")}>
                             <div className="space-y-4">
                                <h3 className="text-lg font-medium flex items-center gap-2 mb-4"><Users />Crew Assignment</h3>
                                <FormField control={form.control} name="purserId" render={({ field }) => (<FormItem><FormLabel>Assign Purser</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a purser" /></SelectTrigger></FormControl><SelectContent>{pursers.map(p => <SelectItem key={p.uid} value={p.uid}>{p.displayName} ({p.email})</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="pilotIds" render={({ field }) => (<FormItem><FormLabel>Assign Pilots</FormLabel><CustomMultiSelectAutocomplete placeholder="Select pilots..." options={pilots.map(p => ({value: p.uid, label: `${p.displayName} (${p.email})`}))} selected={field.value || []} onChange={field.onChange} /><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="cabinCrewIds" render={({ field }) => (<FormItem><FormLabel>Assign Cabin Crew</FormLabel><CustomMultiSelectAutocomplete placeholder="Select cabin crew..." options={cabinCrew.map(c => ({value: c.uid, label: `${c.displayName} (${c.email})`}))} selected={field.value || []} onChange={field.onChange} /><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="instructorIds" render={({ field }) => (<FormItem><FormLabel>Assign Instructors</FormLabel><CustomMultiSelectAutocomplete placeholder="Select instructors..." options={instructors.map(i => ({value: i.uid, label: `${i.displayName} (${i.email})`}))} selected={field.value || []} onChange={field.onChange} /><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="traineeIds" render={({ field }) => (<FormItem><FormLabel>Assign Trainees</FormLabel><CustomMultiSelectAutocomplete placeholder="Select trainees..." options={trainees.map(t => ({value: t.uid, label: `${t.displayName} (${t.email})`}))} selected={field.value || []} onChange={field.onChange} /><FormMessage /></FormItem>)} />
                                <Separator className="my-6"/>
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
                            </div>
                        </AnimatedCard>
                    </div>
                </ScrollArea>
                <DialogFooter className="mt-4 pt-4 border-t flex justify-between w-full">
                        <Button type="button" variant="outline" onClick={prevStep} disabled={currentStep === 0}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Previous
                        </Button>
                        {currentStep < wizardSteps.length - 1 ? (
                            <Button type="button" onClick={nextStep}>
                                Next <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        ) : (
                            <Button type="submit" disabled={isSubmitting || !form.formState.isValid}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                                {isEditMode ? "Save Changes" : "Create Flight(s)"}
                            </Button>
                        )}
                    </DialogFooter>
                </form>
            </Form>
        </>
    );
}

    