"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth, type User } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, doc, writeBatch, serverTimestamp, deleteDoc, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Loader2, AlertTriangle, RefreshCw, Edit, PlusCircle, Trash2, Users, BookCopy, ArrowLeft, ArrowRight, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, startOfDay, parseISO } from "date-fns";
import { trainingSessionFormSchema, type TrainingSessionFormValues, type StoredTrainingSession } from "@/schemas/training-session-schema";
import { logAuditEvent } from "@/lib/audit-logger";
import { CustomMultiSelectAutocomplete } from "@/components/custom/custom-multi-select-autocomplete";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/hooks/use-debounce";
import { checkCrewAvailability, type Conflict } from "@/services/user-activity-service";
import { Alert, AlertDescription as ShadAlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { SortableHeader } from "@/components/custom/custom-sortable-header";
import { Progress } from "@/components/ui/progress";
import { AnimatedCard } from "@/components/motion/animated-card";
import { cn } from "@/lib/utils";
import { getTrainingSessionsPageData } from "@/services/training-service";

type SortableColumn = 'title' | 'location' | 'sessionDateTimeUTC' | 'attendeeCount';
type SortDirection = 'asc' | 'desc';

interface SessionForDisplay extends StoredTrainingSession {
    attendeeCount: number;
}

const wizardSteps = [
    { id: 1, title: 'Session Details', fields: ['title', 'description', 'location', 'sessionDateTimeUTC'], icon: BookCopy },
    { id: 2, title: 'Assign Attendees', fields: ['purserIds', 'pilotIds', 'cabinCrewIds', 'instructorIds', 'traineeIds'], icon: Users },
];

interface TrainingSessionsClientProps {
    initialSessions: SessionForDisplay[];
    initialUsers: User[];
    initialUserMap: Map<string, User>;
    initialPursers: User[];
    initialPilots: User[];
    initialCabinCrew: User[];
    initialInstructors: User[];
    initialTrainees: User[];
}


export function TrainingSessionsClient({ 
    initialSessions, initialUsers, initialUserMap, initialPursers, 
    initialPilots, initialCabinCrew, initialInstructors, initialTrainees
 }: TrainingSessionsClientProps) {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [sessions, setSessions] = React.useState<SessionForDisplay[]>(initialSessions);
    
    const [allUsers, setAllUsers] = React.useState<User[]>(initialUsers);
    const [userMap, setUserMap] = React.useState<Map<string, User>>(initialUserMap);
    const [pursers, setPursers] = React.useState<User[]>(initialPursers);
    const [pilots, setPilots] = React.useState<User[]>(initialPilots);
    const [cabinCrew, setCabinCrew] = React.useState<User[]>(initialCabinCrew);
    const [instructors, setInstructors] = React.useState<User[]>(initialInstructors);
    const [trainees, setTrainees] = React.useState<User[]>(initialTrainees);
    
    const [isLoading, setIsLoading] = React.useState(false); // Only for client-side fetches
    
    const [isManageDialogOpen, setIsManageDialogOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isEditMode, setIsEditMode] = React.useState(false);
    const [currentSession, setCurrentSession] = React.useState<StoredTrainingSession | null>(null);
    const [currentStep, setCurrentStep] = React.useState(0);

    const [sortColumn, setSortColumn] = React.useState<SortableColumn>('sessionDateTimeUTC');
    const [sortDirection, setSortDirection] = React.useState<SortDirection>('desc');

    const [crewWarnings, setCrewWarnings] = React.useState<Record<string, Conflict>>({});
    const [isCheckingAvailability, setIsCheckingAvailability] = React.useState(false);

    const form = useForm<TrainingSessionFormValues>({
        resolver: zodResolver(trainingSessionFormSchema),
        defaultValues: { title: "", description: "", location: "", sessionDateTimeUTC: "", purserIds: [], pilotIds: [], cabinCrewIds: [], instructorIds: [], traineeIds: [] },
        mode: "onChange"
    });
    
    const watchedAttendees = form.watch(["purserIds", "pilotIds", "cabinCrewIds", "instructorIds", "traineeIds"]);
    const debouncedSessionDate = useDebounce(form.watch("sessionDateTimeUTC"), 500);

    const refreshPageData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getTrainingSessionsPageData();
            setSessions(data.initialSessions);
            setAllUsers(data.initialUsers);
            setUserMap(data.initialUserMap);
            setPursers(data.initialPursers);
            setPilots(data.initialPilots);
            setCabinCrew(data.initialCabinCrew);
            setInstructors(data.initialInstructors);
            setTrainees(data.initialTrainees);
            toast({ title: "Refreshed", description: "Data has been updated." });
        } catch (err) {
            console.error("Failed to refresh sessions or users:", err);
            toast({ title: "Loading Error", description: "Could not refresh data.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);
    
    const sortedSessions = React.useMemo(() => {
        return [...sessions].sort((a, b) => {
            const valA = a[sortColumn];
            const valB = b[sortColumn];
            let comparison = 0;

            if (valA instanceof Timestamp && valB instanceof Timestamp) {
                comparison = valA.toMillis() - valB.toMillis();
            } else if (sortColumn === 'attendeeCount') {
                comparison = (valA as number) - (valB as number);
            } else {
                comparison = String(valA).localeCompare(String(valB));
            }

            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [sessions, sortColumn, sortDirection]);

    const handleSort = (column: SortableColumn) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection(column === 'sessionDateTimeUTC' ? 'desc' : 'asc');
        }
    };

    React.useEffect(() => {
        if (!authLoading) {
            if (!user || user.role !== 'admin') router.push('/');
        }
    }, [user, authLoading, router]);
    
     React.useEffect(() => {
        const allAttendees = watchedAttendees.flat().filter(Boolean) as string[];

        if (allAttendees.length === 0 || !debouncedSessionDate) {
            setCrewWarnings({});
            return;
        }

        const check = async () => {
            setIsCheckingAvailability(true);
            try {
                const sessionDate = startOfDay(new Date(debouncedSessionDate));
                if (isNaN(sessionDate.getTime())) return;

                const warnings = await checkCrewAvailability(allAttendees, sessionDate, sessionDate, isEditMode ? currentSession?.id : undefined);
                setCrewWarnings(warnings);
            } catch (e) {
                console.error("Failed to check crew availability for training session", e);
                toast({ title: "Error", description: "Could not check crew availability.", variant: "destructive" });
            } finally {
                setIsCheckingAvailability(false);
            }
        };

        check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(watchedAttendees), debouncedSessionDate, toast, currentSession, isEditMode]);


    const handleOpenDialog = async (sessionToEdit?: StoredTrainingSession) => {
        setCurrentStep(0);
        if (sessionToEdit) {
            setIsEditMode(true);
            setCurrentSession(sessionToEdit);

            const attendeesData = (sessionToEdit.attendeeIds || []).map(id => userMap.get(id)).filter((user): user is User => !!user);
            
            const sessionDate = sessionToEdit.sessionDateTimeUTC instanceof Timestamp 
                ? sessionToEdit.sessionDateTimeUTC.toDate()
                : new Date(sessionToEdit.sessionDateTimeUTC as any);

            const formattedDate = sessionDate.toISOString().substring(0, 16);

            form.reset({
                title: sessionToEdit.title,
                description: sessionToEdit.description,
                location: sessionToEdit.location,
                sessionDateTimeUTC: formattedDate,
                purserIds: attendeesData.filter(u => ['purser', 'admin', 'instructor'].includes(u.role || '')).map(u => u.uid),
                pilotIds: attendeesData.filter(u => u.role === 'pilote').map(u => u.uid),
                cabinCrewIds: attendeesData.filter(u => u.role === 'cabin crew').map(u => u.uid),
                instructorIds: attendeesData.filter(u => u.role === 'instructor').map(u => u.uid),
                traineeIds: attendeesData.filter(u => u.role === 'stagiaire').map(u => u.uid),
            });
        } else {
            setIsEditMode(false);
            setCurrentSession(null);
            form.reset({ title: "", description: "", location: "", sessionDateTimeUTC: "", purserIds: [], pilotIds: [], cabinCrewIds: [], instructorIds: [], traineeIds: [] });
        }
        setCrewWarnings({});
        setIsManageDialogOpen(true);
    };

    const handleFormSubmit = async (data: TrainingSessionFormValues) => {
        if (!user) return;

         if (Object.keys(crewWarnings).length > 0) {
            if (!window.confirm("There are scheduling conflicts for some attendees. Are you sure you want to proceed?")) {
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const batch = writeBatch(db);
            const sessionRef = isEditMode && currentSession ? doc(db, "trainingSessions", currentSession.id) : doc(collection(db, "trainingSessions"));
            
             const attendeeIds = [...new Set([
                ...(data.purserIds || []), ...(data.pilotIds || []), ...(data.cabinCrewIds || []),
                ...(data.instructorIds || []), ...(data.traineeIds || [])
            ])];

            const activityIds: Record<string, string> = {};
            if (isEditMode && currentSession?.activityIds) {
                Object.values(currentSession.activityIds).forEach(activityId => {
                    batch.delete(doc(db, "userActivities", activityId));
                });
            }

            for (const attendeeId of attendeeIds) {
                const activityRef = doc(collection(db, "userActivities"));
                batch.set(activityRef, {
                    userId: attendeeId,
                    activityType: 'training' as const,
                    flightId: null,
                    trainingSessionId: sessionRef.id,
                    date: Timestamp.fromDate(startOfDay(new Date(data.sessionDateTimeUTC))),
                    comments: `Training: ${data.title}`,
                });
                activityIds[attendeeId] = activityRef.id;
            }

            const sessionData = { 
                title: data.title,
                description: data.description,
                location: data.location,
                sessionDateTimeUTC: Timestamp.fromDate(new Date(data.sessionDateTimeUTC)),
                attendeeIds,
                activityIds,
                createdBy: user.uid, 
                updatedAt: serverTimestamp() 
            };

            if (isEditMode && currentSession) {
                batch.update(sessionRef, sessionData);
                await logAuditEvent({ userId: user.uid, userEmail: user.email!, actionType: "UPDATE_TRAINING_SESSION", entityType: "TRAINING_SESSION", entityId: currentSession.id, details: { title: data.title } });
            } else {
                batch.set(sessionRef, { ...sessionData, createdAt: serverTimestamp() });
                await logAuditEvent({ userId: user.uid, userEmail: user.email!, actionType: "CREATE_TRAINING_SESSION", entityType: "TRAINING_SESSION", entityId: sessionRef.id, details: { title: data.title } });
            }
            
            await batch.commit();
            toast({ title: isEditMode ? "Session Updated" : "Session Created", description: `Session "${data.title}" and user schedules have been updated.` });
            refreshPageData();
            setIsManageDialogOpen(false);
        } catch (error) {
            console.error("Error submitting session:", error);
            toast({ title: "Submission Failed", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDelete = async (sessionToDelete: StoredTrainingSession) => {
        if (!user || !window.confirm(`Are you sure you want to delete the session "${sessionToDelete.title}"? This will also remove it from assigned user schedules.`)) return;
        try {
            const batch = writeBatch(db);
            batch.delete(doc(db, "trainingSessions", sessionToDelete.id));
            if (sessionToDelete.activityIds) {
                Object.values(sessionToDelete.activityIds).forEach(activityId => {
                    batch.delete(doc(db, "userActivities", activityId));
                });
            }
            await batch.commit();
            await logAuditEvent({ userId: user.uid, userEmail: user.email!, actionType: "DELETE_TRAINING_SESSION", entityType: "TRAINING_SESSION", entityId: sessionToDelete.id, details: { title: sessionToDelete.title } });
            toast({ title: "Session Deleted", description: `"${sessionToDelete.title}" has been removed.` });
            refreshPageData();
        } catch (error) {
            toast({ title: "Deletion Failed", variant: "destructive" });
        }
    };

    const triggerValidation = async (fields: (keyof TrainingSessionFormValues)[]) => {
        return await form.trigger(fields);
    };

    const nextStep = async () => {
        const fieldsToValidate = wizardSteps[currentStep].fields as (keyof TrainingSessionFormValues)[];
        const isValid = await triggerValidation(fieldsToValidate);
        if (isValid) {
            if (currentStep < wizardSteps.length - 1) {
                setCurrentStep(prev => prev + 1);
            }
        } else {
            toast({ title: "Incomplete Section", description: "Please fill all required fields before continuing.", variant: "destructive" });
        }
    };

    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const progressPercentage = ((currentStep + 1) / wizardSteps.length) * 100;

    if (authLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;

    const formatDateSafe = (date: Timestamp | string) => {
        if (!date) return 'N/A';
        try {
            const dateObj = date instanceof Timestamp ? date.toDate() : parseISO(date);
            return format(dateObj, "PPpp");
        } catch (e) {
            console.warn("Could not format date:", date);
            return "Invalid Date";
        }
    };

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader className="flex flex-row justify-between items-start">
                    <div>
                        <CardTitle className="text-2xl font-headline flex items-center"><ClipboardCheck className="mr-3 h-7 w-7 text-primary" />Training Session Management</CardTitle>
                        <CardDescription>Plan and manage in-person training sessions for all crew members.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={refreshPageData} disabled={isLoading}><RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />Refresh</Button>
                        <Button onClick={() => handleOpenDialog()}><PlusCircle className="mr-2 h-4 w-4" />Create Session</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader><TableRow>
                                <SortableHeader column="title" label="Title" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                                <SortableHeader column="location" label="Location" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                                <SortableHeader column="sessionDateTimeUTC" label="Date & Time (UTC)" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                                <SortableHeader column="attendeeCount" label="Attendees" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                                {sortedSessions.map(s => (
                                    <TableRow key={s.id}>
                                        <TableCell className="font-medium">{s.title}</TableCell>
                                        <TableCell>{s.location}</TableCell>
                                        <TableCell>{formatDateSafe(s.sessionDateTimeUTC)}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                                                <Users className="h-3 w-3"/>
                                                {(s.attendeeIds || []).length}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right space-x-1">
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(s)}><Edit className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(s)}><Trash2 className="h-4 w-4" /></Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    {sessions.length === 0 && <p className="text-center text-muted-foreground p-8">No training sessions found.</p>}
                </CardContent>
            </Card>

            <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{isEditMode ? "Edit Session" : "Create New Session"}</DialogTitle>
                        <DialogDescription>{isEditMode ? "Update session details." : "Fill in the form to create a new in-person training session."}</DialogDescription>
                         <Progress value={progressPercentage} className="mt-4"/>
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>Step {currentStep + 1} of {wizardSteps.length}: <strong>{wizardSteps[currentStep].title}</strong></span>
                            <span>{Math.round(progressPercentage)}% Complete</span>
                        </div>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleFormSubmit)}>
                            <ScrollArea className="h-[60vh] p-4">

                                {/* Step 1: Session Details */}
                                <AnimatedCard delay={0.1} className={cn(currentStep !== 0 && "hidden")}>
                                    <div className="space-y-6">
                                        <h3 className="text-lg font-semibold flex items-center gap-2"><BookCopy/>Session Details</h3>
                                        <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Session Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} className="min-h-[100px]" /></FormControl><FormMessage /></FormItem>)} />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormField control={form.control} name="location" render={({ field }) => (<FormItem><FormLabel>Location</FormLabel><FormControl><Input {...field} placeholder="e.g., Training Center - Room A" /></FormControl><FormMessage /></FormItem>)} />
                                            <FormField control={form.control} name="sessionDateTimeUTC" render={({ field }) => (<FormItem><FormLabel>Date & Time (UTC)</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        </div>
                                    </div>
                                </AnimatedCard>
                                
                                {/* Step 2: Assign Attendees */}
                                <AnimatedCard delay={0.1} className={cn(currentStep !== 1 && "hidden")}>
                                     <div className="space-y-4">
                                        <h3 className="text-lg font-medium flex items-center gap-2"><Users/>Assign Attendees</h3>
                                         <FormField control={form.control} name="purserIds" render={({ field }) => (<FormItem><FormLabel>Assign Pursers</FormLabel><CustomMultiSelectAutocomplete placeholder="Select pursers..." options={pursers.map(p => ({value: p.uid, label: `${p.displayName} (${p.email})`}))} selected={field.value || []} onChange={field.onChange} /><FormMessage /></FormItem>)} />
                                         <FormField control={form.control} name="pilotIds" render={({ field }) => (<FormItem><FormLabel>Assign Pilots</FormLabel><CustomMultiSelectAutocomplete placeholder="Select pilots..." options={pilots.map(p => ({value: p.uid, label: `${p.displayName} (${p.email})`}))} selected={field.value || []} onChange={field.onChange} /><FormMessage /></FormItem>)} />
                                         <FormField control={form.control} name="cabinCrewIds" render={({ field }) => (<FormItem><FormLabel>Assign Cabin Crew</FormLabel><CustomMultiSelectAutocomplete placeholder="Select cabin crew..." options={cabinCrew.map(c => ({value: c.uid, label: `${c.displayName} (${c.email})`}))} selected={field.value || []} onChange={field.onChange} /><FormMessage /></FormItem>)} />
                                         <FormField control={form.control} name="instructorIds" render={({ field }) => (<FormItem><FormLabel>Assign Instructors</FormLabel><CustomMultiSelectAutocomplete placeholder="Select instructors..." options={instructors.map(i => ({value: i.uid, label: `${i.displayName} (${i.email})`}))} selected={field.value || []} onChange={field.onChange} /><FormMessage /></FormItem>)} />
                                         <FormField control={form.control} name="traineeIds" render={({ field }) => (<FormItem><FormLabel>Assign Stagiaires</FormLabel><CustomMultiSelectAutocomplete placeholder="Select stagiaires..." options={trainees.map(t => ({value: t.uid, label: `${t.displayName} (${t.email})`}))} selected={field.value || []} onChange={field.onChange} /><FormMessage /></FormItem>)} />

                                        <Separator />
                                         <h3 className="text-lg font-medium">Attendee Availability</h3>
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
                                                <p className="text-sm text-muted-foreground">No conflicts detected for the selected attendees and date.</p>
                                            )}
                                    </div>
                                </AnimatedCard>
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
                                        {isEditMode ? "Save Changes" : "Create Session"}
                                    </Button>
                                )}
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
