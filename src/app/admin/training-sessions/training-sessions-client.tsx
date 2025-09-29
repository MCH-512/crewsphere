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
import { collection, doc, writeBatch, serverTimestamp, Timestamp } from "firebase/firestore";
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
    initialUserMap: Map&lt;string, User&gt;;
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
    const [sessions, setSessions] = React.useState&lt;SessionForDisplay[]&gt;(initialSessions);
    
    const [userMap, setUserMap] = React.useState&lt;Map&lt;string, User&gt;&gt;(initialUserMap);
    const [pursers, setPursers] = React.useState&lt;User[]&gt;(initialPursers);
    const [pilots, setPilots] = React.useState&lt;User[]&gt;(initialPilots);
    const [cabinCrew, setCabinCrew] = React.useState&lt;User[]&gt;(initialCabinCrew);
    const [instructors, setInstructors] = React.useState&lt;User[]&gt;(initialInstructors);
    const [trainees, setTrainees] = React.useState&lt;User[]&gt;(initialTrainees);
    
    const [isLoading, setIsLoading] = React.useState(false); // Only for client-side fetches
    
    const [isManageDialogOpen, setIsManageDialogOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isEditMode, setIsEditMode] = React.useState(false);
    const [currentSession, setCurrentSession] = React.useState&lt;StoredTrainingSession | null&gt;(null);
    const [currentStep, setCurrentStep] = React.useState(0);

    const [sortColumn, setSortColumn] = React.useState&lt;SortableColumn&gt;('sessionDateTimeUTC');
    const [sortDirection, setSortDirection] = React.useState&lt;SortDirection&gt;('desc');

    const [crewWarnings, setCrewWarnings] = React.useState&lt;Record&lt;string, Conflict&gt;&gt;({});
    const [isCheckingAvailability, setIsCheckingAvailability] = React.useState(false);

    const form = useForm&lt;TrainingSessionFormValues&gt;({
        resolver: zodResolver(trainingSessionFormSchema),
        defaultValues: { title: "", description: "", location: "", sessionDateTimeUTC: "", purserIds: [], pilotIds: [], cabinCrewIds: [], instructorIds: [], traineeIds: [] },
        mode: "onChange"
    });
    
    const watchedAttendees = form.watch(["purserIds", "pilotIds", "cabinCrewIds", "instructorIds", "traineeIds"]);
    const debouncedSessionDate = useDebounce(form.watch("sessionDateTimeUTC"), 500);

    const refreshPageData = React.useCallback(async () =&gt; {
        setIsLoading(true);
        try {
            const data = await getTrainingSessionsPageData();
            setSessions(data.initialSessions);
            setUserMap(data.initialUserMap);
            setPursers(data.initialPursers);
            setPilots(data.initialPilots);
            setCabinCrew(data.initialCabinCrew);
            setInstructors(data.initialInstructors);
            setTrainees(data.initialTrainees);
            toast({ title: "Refreshed", description: "Data has been updated." });
        } catch (err: unknown) {
            console.error("Failed to refresh sessions or users:", err);
            toast({ title: "Loading Error", description: "Could not refresh data.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);
    
    const sortedSessions = React.useMemo(() =&gt; {
        return [...sessions].sort((a, b) =&gt; {
            const valA = a[sortColumn];
            const valB = b[sortColumn];
            let comparison = 0;

            if (valA instanceof Timestamp &amp;&amp; valB instanceof Timestamp) {
                comparison = valA.toMillis() - valB.toMillis();
            } else if (sortColumn === 'attendeeCount') {
                comparison = (valA as number) - (valB as number);
            } else {
                comparison = String(valA).localeCompare(String(valB));
            }

            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [sessions, sortColumn, sortDirection]);

    const handleSort = (column: SortableColumn) =&gt; {
        if (sortColumn === column) {
            setSortDirection(prev =&gt; prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection(column === 'sessionDateTimeUTC' ? 'desc' : 'asc');
        }
    };

    React.useEffect(() =&gt; {
        if (!authLoading &amp;&amp; !user) router.push('/');
    }, [user, authLoading, router]);
    
     React.useEffect(() =&gt; {
        const allAttendees = watchedAttendees.flat().filter(Boolean) as string[];

        if (allAttendees.length === 0 || !debouncedSessionDate) {
            setCrewWarnings({});
            return;
        }

        const check = async () =&gt; {
            setIsCheckingAvailability(true);
            try {
                const sessionDate = startOfDay(new Date(debouncedSessionDate));
                if (isNaN(sessionDate.getTime())) return;

                const warnings = await checkCrewAvailability(allAttendees, sessionDate, sessionDate, isEditMode ? currentSession?.id : undefined);
                setCrewWarnings(warnings);
            } catch (error: unknown) {
                console.error("Failed to check crew availability for training session", error);
                toast({ title: "Error", description: "Could not check crew availability.", variant: "destructive" });
            } finally {
                setIsCheckingAvailability(false);
            }
        };

        check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(watchedAttendees), debouncedSessionDate, toast, currentSession, isEditMode]);


    const handleOpenDialog = async (sessionToEdit?: StoredTrainingSession) =&gt; {
        setCurrentStep(0);
        if (sessionToEdit) {
            setIsEditMode(true);
            setCurrentSession(sessionToEdit);

            const attendeesData = (sessionToEdit.attendeeIds || []).map(id =&gt; userMap.get(id)).filter((user): user is User =&gt; !!user);
            
            const sessionDate = sessionToEdit.sessionDateTimeUTC instanceof Timestamp 
                ? sessionToEdit.sessionDateTimeUTC.toDate()
                : new Date(sessionToEdit.sessionDateTimeUTC);

            const formattedDate = sessionDate.toISOString().substring(0, 16);

            form.reset({
                title: sessionToEdit.title,
                description: sessionToEdit.description,
                location: sessionToEdit.location,
                sessionDateTimeUTC: formattedDate,
                purserIds: attendeesData.filter(u =&gt; ['purser', 'admin', 'instructor'].includes(u.role || '')).map(u =&gt; u.uid),
                pilotIds: attendeesData.filter(u =&gt; u.role === 'pilote').map(u =&gt; u.uid),
                cabinCrewIds: attendeesData.filter(u =&gt; u.role === 'cabin crew').map(u =&gt; u.uid),
                instructorIds: attendeesData.filter(u =&gt; u.role === 'instructor').map(u =&gt; u.uid),
                traineeIds: attendeesData.filter(u =&gt; u.role === 'stagiaire').map(u =&gt; u.uid),
            });
        } else {
            setIsEditMode(false);
            setCurrentSession(null);
            form.reset({ title: "", description: "", location: "", sessionDateTimeUTC: "", purserIds: [], pilotIds: [], cabinCrewIds: [], instructorIds: [], traineeIds: [] });
        }
        setCrewWarnings({});
        setIsManageDialogOpen(true);
    };

    const handleFormSubmit = async (data: TrainingSessionFormValues) =&gt; {
        if (!user) return;

         if (Object.keys(crewWarnings).length &gt; 0) {
            if (!window.confirm("There are scheduling conflicts for some attendees. Are you sure you want to proceed?")) {
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const batch = writeBatch(db);
            const sessionRef = isEditMode &amp;&amp; currentSession ? doc(db, "trainingSessions", currentSession.id) : doc(collection(db, "trainingSessions"));
            
             const attendeeIds = [...new Set([
                ...(data.purserIds || []), ...(data.pilotIds || []), ...(data.cabinCrewIds || []),
                ...(data.instructorIds || []), ...(data.traineeIds || [])
            ])];

            const activityIds: Record&lt;string, string&gt; = {};
            if (isEditMode &amp;&amp; currentSession?.activityIds) {
                Object.values(currentSession.activityIds).forEach(activityId =&gt; {
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

            if (isEditMode &amp;&amp; currentSession) {
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
        } catch (error: unknown) {
            console.error("Error submitting session:", error);
            toast({ title: "Submission Failed", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDelete = async (sessionToDelete: StoredTrainingSession) =&gt; {
        if (!user || !window.confirm(`Are you sure you want to delete the session "${sessionToDelete.title}"? This will also remove it from assigned user schedules.`)) return;
        try {
            const batch = writeBatch(db);
            batch.delete(doc(db, "trainingSessions", sessionToDelete.id));
            if (sessionToDelete.activityIds) {
                Object.values(sessionToDelete.activityIds).forEach(activityId =&gt; {
                    batch.delete(doc(db, "userActivities", activityId));
                });
            }
            await batch.commit();
            await logAuditEvent({ userId: user.uid, userEmail: user.email!, actionType: "DELETE_TRAINING_SESSION", entityType: "TRAINING_SESSION", entityId: sessionToDelete.id, details: { title: sessionToDelete.title } });
            toast({ title: "Session Deleted", description: `"${sessionToDelete.title}" has been removed.` });
            refreshPageData();
        } catch (error: unknown) {
            toast({ title: "Deletion Failed", variant: "destructive" });
        }
    };

    const triggerValidation = async (fields: (keyof TrainingSessionFormValues)[]) =&gt; {
        return await form.trigger(fields);
    };

    const nextStep = async () =&gt; {
        const fieldsToValidate = wizardSteps[currentStep].fields as (keyof TrainingSessionFormValues)[];
        const isValid = await triggerValidation(fieldsToValidate);
        if (isValid) {
            if (currentStep &lt; wizardSteps.length - 1) {
                setCurrentStep(prev =&gt; prev + 1);
            }
        } else {
            toast({ title: "Incomplete Section", description: "Please fill all required fields before continuing.", variant: "destructive" });
        }
    };

    const prevStep = () =&gt; {
        if (currentStep &gt; 0) {
            setCurrentStep(prev =&gt; prev - 1);
        }
    };

    const progressPercentage = (((currentStep + 1) / wizardSteps.length) * 100);

    if (authLoading) return &lt;div className="flex items-center justify-center min-h-screen"&gt;&lt;Loader2 className="h-12 w-12 animate-spin text-primary" /&gt;&lt;/div&gt;;

    const formatDateSafe = (date: Timestamp | string) =&gt; {
        if (!date) return 'N/A';
        try {
            const dateObj = date instanceof Timestamp ? date.toDate() : parseISO(date);
            return format(dateObj, "PPpp");
        } catch (e: unknown) {
            console.warn("Could not format date:", date);
            return "Invalid Date";
        }
    };

    return (
        &lt;div className="space-y-6"&gt;
            &lt;Card className="shadow-lg"&gt;
                &lt;CardHeader className="flex flex-row justify-between items-start"&gt;
                    &lt;div&gt;
                        &lt;CardTitle className="text-2xl font-headline flex items-center"&gt;&lt;ClipboardCheck className="mr-3 h-7 w-7 text-primary" /&gt;Training Session Management&lt;/CardTitle&gt;
                        &lt;CardDescription&gt;Plan and manage in-person training sessions for all crew members.&lt;/CardDescription&gt;
                    &lt;/div&gt;
                    &lt;div className="flex gap-2"&gt;
                        &lt;Button variant="outline" onClick={refreshPageData} disabled={isLoading}&gt;&lt;RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /&gt;Refresh&lt;/Button&gt;
                        &lt;Button onClick={() =&gt; handleOpenDialog()}&gt;&lt;PlusCircle className="mr-2 h-4 w-4" /&gt;Create Session&lt;/Button&gt;
                    &lt;/div&gt;
                &lt;/CardHeader&gt;
                &lt;CardContent&gt;
                    &lt;div className="rounded-md border"&gt;
                        &lt;Table&gt;
                            &lt;TableHeader&gt;&lt;TableRow&gt;
                                &lt;SortableHeader column="title" label="Title" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /&gt;
                                &lt;SortableHeader column="location" label="Location" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /&gt;
                                &lt;SortableHeader column="sessionDateTimeUTC" label="Date &amp; Time (UTC)" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /&gt;
                                &lt;SortableHeader column="attendeeCount" label="Attendees" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /&gt;
                                &lt;TableHead className="text-right"&gt;Actions&lt;/TableHead&gt;
                            &lt;/TableRow&gt;&lt;/TableHeader&gt;
                            &lt;TableBody&gt;
                                {sortedSessions.map(s =&gt; (
                                    &lt;TableRow key={s.id}&gt;
                                        &lt;TableCell className="font-medium"&gt;{s.title}&lt;/TableCell&gt;
                                        &lt;TableCell&gt;{s.location}&lt;/TableCell&gt;
                                        &lt;TableCell&gt;{formatDateSafe(s.sessionDateTimeUTC)}&lt;/TableCell&gt;
                                        &lt;TableCell&gt;
                                            &lt;Badge variant="secondary" className="flex items-center gap-1 w-fit"&gt;
                                                &lt;Users className="h-3 w-3"/&gt;
                                                {(s.attendeeIds || []).length}
                                            &lt;/Badge&gt;
                                        &lt;/TableCell&gt;
                                        &lt;TableCell className="text-right space-x-1"&gt;
                                            &lt;Button variant="ghost" size="icon" onClick={() =&gt; handleOpenDialog(s)}&gt;&lt;Edit className="h-4 w-4" /&gt;&lt;/Button&gt;
                                            &lt;Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() =&gt; handleDelete(s)}&gt;&lt;Trash2 className="h-4 w-4" /&gt;&lt;/Button&gt;
                                        &lt;/TableCell&gt;
                                    &lt;/TableRow&gt;
                                ))}&lt;/TableBody&gt;
                            &lt;/Table&gt;
                        &lt;/div&gt;
                    {sessions.length === 0 &amp;&amp; &lt;p className="text-center text-muted-foreground p-8"&gt;No training sessions found.&lt;/p&gt;}
                &lt;/CardContent&gt;
            &lt;/Card&gt;

            &lt;Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}&gt;
                &lt;DialogContent className="max-w-2xl"&gt;
                    &lt;DialogHeader&gt;
                        &lt;DialogTitle&gt;{isEditMode ? "Edit Session" : "Create New Session"}&lt;/DialogTitle&gt;
                        &lt;DialogDescription&gt;{isEditMode ? "Update session details." : "Fill in the form to create a new in-person training session."}&lt;/DialogDescription&gt;
                         &lt;Progress value={progressPercentage} className="mt-4"/&gt;
                        &lt;div className="flex justify-between text-xs text-muted-foreground mt-1"&gt;
                            &lt;span&gt;Step {currentStep + 1} of {wizardSteps.length}: &lt;strong&gt;{wizardSteps[currentStep].title}&lt;/strong&gt;&lt;/span&gt;
                            &lt;span&gt;{Math.round(progressPercentage)}% Complete&lt;/span&gt;
                        &lt;/div&gt;
                    &lt;/DialogHeader&gt;
                    &lt;Form {...form}&gt;
                        &lt;form onSubmit={form.handleSubmit(handleFormSubmit)}&gt;
                            &lt;ScrollArea className="h-[60vh] p-4"&gt;

                                {/* Step 1: Session Details */}
                                &lt;AnimatedCard delay={0.1} className={cn(currentStep !== 0 && "hidden")}&gt;
                                    &lt;div className="space-y-6"&gt;
                                        &lt;h3 className="text-lg font-semibold flex items-center gap-2"&gt;&lt;BookCopy/&gt;Session Details&lt;/h3&gt;
                                        &lt;FormField control={form.control} name="title" render={({ field }) =&gt; (&lt;FormItem&gt;&lt;FormLabel&gt;Session Title&lt;/FormLabel&gt;&lt;FormControl&gt;&lt;Input {...field} /&gt;&lt;/FormControl&gt;&lt;FormMessage /&gt;&lt;/FormItem&gt;)} /&gt;
                                        &lt;FormField control={form.control} name="description" render={({ field }) =&gt; (&lt;FormItem&gt;&lt;FormLabel&gt;Description&lt;/FormLabel&gt;&lt;FormControl&gt;&lt;Textarea {...field} className="min-h-[100px]" /&gt;&lt;/FormControl&gt;&lt;FormMessage /&gt;&lt;/FormItem&gt;)} /&gt;
                                        &lt;div className="grid grid-cols-1 md:grid-cols-2 gap-4"&gt;
                                            &lt;FormField control={form.control} name="location" render={({ field }) =&gt; (&lt;FormItem&gt;&lt;FormLabel&gt;Location&lt;/FormLabel&gt;&lt;FormControl&gt;&lt;Input {...field} placeholder="e.g., Training Center - Room A" /&gt;&lt;/FormControl&gt;&lt;FormMessage /&gt;&lt;/FormItem&gt;)} /&gt;
                                            &lt;FormField control={form.control} name="sessionDateTimeUTC" render={({ field }) =&gt; (&lt;FormItem&gt;&lt;FormLabel&gt;Date &amp; Time (UTC)&lt;/FormLabel&gt;&lt;FormControl&gt;&lt;Input type="datetime-local" {...field} /&gt;&lt;/FormControl&gt;&lt;FormMessage /&gt;&lt;/FormItem&gt;)} /&gt;
                                        &lt;/div&gt;
                                    &lt;/div&gt;
                                &lt;/AnimatedCard&gt;
                                
                                {/* Step 2: Assign Attendees */}
                                &lt;AnimatedCard delay={0.1} className={cn(currentStep !== 1 && "hidden")}&gt;
                                     &lt;div className="space-y-4"&gt;
                                        &lt;h3 className="text-lg font-medium flex items-center gap-2"&gt;&lt;Users/&gt;Assign Attendees&lt;/h3&gt;
                                         &lt;FormField control={form.control} name="purserIds" render={({ field }) =&gt; (&lt;FormItem&gt;&lt;FormLabel&gt;Assign Pursers&lt;/FormLabel&gt;&lt;CustomMultiSelectAutocomplete placeholder="Select pursers..." options={pursers.map(p =&gt; ({value: p.uid, label: `${p.displayName} (${p.email})`}))} selected={field.value || []} onChange={field.onChange} /&gt;&lt;FormMessage /&gt;&lt;/FormItem&gt;)} /&gt;
                                         &lt;FormField control={form.control} name="pilotIds" render={({ field }) =&gt; (&lt;FormItem&gt;&lt;FormLabel&gt;Assign Pilots&lt;/FormLabel&gt;&lt;CustomMultiSelectAutocomplete placeholder="Select pilots..." options={pilots.map(p =&gt; ({value: p.uid, label: `${p.displayName} (${p.email})`}))} selected={field.value || []} onChange={field.onChange} /&gt;&lt;FormMessage /&gt;&lt;/FormItem&gt;)} /&gt;
                                         &lt;FormField control={form.control} name="cabinCrewIds" render={({ field }) =&gt; (&lt;FormItem&gt;&lt;FormLabel&gt;Assign Cabin Crew&lt;/FormLabel&gt;&lt;CustomMultiSelectAutocomplete placeholder="Select cabin crew..." options={cabinCrew.map(c =&gt; ({value: c.uid, label: `${c.displayName} (${c.email})`}))} selected={field.value || []} onChange={field.onChange} /&gt;&lt;FormMessage /&gt;&lt;/FormItem&gt;)} /&gt;
                                         &lt;FormField control={form.control} name="instructorIds" render={({ field }) =&gt; (&lt;FormItem&gt;&lt;FormLabel&gt;Assign Instructors&lt;/FormLabel&gt;&lt;CustomMultiSelectAutocomplete placeholder="Select instructors..." options={instructors.map(i =&gt; ({value: i.uid, label: `${i.displayName} (${i.email})`}))} selected={field.value || []} onChange={field.onChange} /&gt;&lt;FormMessage /&gt;&lt;/FormItem&gt;)} /&gt;
                                         &lt;FormField control={form.control} name="traineeIds" render={({ field }) =&gt; (&lt;FormItem&gt;&lt;FormLabel&gt;Assign Stagiaires&lt;/FormLabel&gt;&lt;CustomMultiSelectAutocomplete placeholder="Select stagiaires..." options={trainees.map(t =&gt; ({value: t.uid, label: `${t.displayName} (${t.email})`}))} selected={field.value || []} onChange={field.onChange} /&gt;&lt;FormMessage /&gt;&lt;/FormItem&gt;)} /&gt;

                                        &lt;Separator /&gt;
                                         &lt;h3 className="text-lg font-medium"&gt;Attendee Availability&lt;/h3&gt;
                                            {isCheckingAvailability ? (
                                                &lt;div className="flex items-center text-sm text-muted-foreground"&gt;&lt;Loader2 className="mr-2 h-4 w-4 animate-spin"/&gt;Checking schedules...&lt;/div&gt;
                                            ) : Object.keys(crewWarnings).length &gt; 0 ? (
                                                &lt;div className="space-y-2"&gt;
                                                    {Object.entries(crewWarnings).map(([userId, conflict]) =&gt; (
                                                        &lt;Alert key={userId} variant="warning"&gt;
                                                            &lt;AlertTriangle className="h-4 w-4" /&gt;
                                                            &lt;AlertTitle&gt;{userMap.get(userId)?.displayName || 'User'} has a conflict&lt;/AlertTitle&gt;
                                                            &lt;ShadAlertDescription&gt;{conflict.details}&lt;/ShadAlertDescription&gt;
                                                        &lt;/Alert&gt;
                                                    ))}&lt;/div&gt;
                                            ) : (
                                                &lt;p className="text-sm text-muted-foreground"&gt;No conflicts detected for the selected attendees and date.&lt;/p&gt;
                                            )}
                                    &lt;/div&gt;
                                &lt;/AnimatedCard&gt;
                            &lt;/ScrollArea&gt;
                             &lt;DialogFooter className="mt-4 pt-4 border-t flex justify-between w-full"&gt;
                                &lt;Button type="button" variant="outline" onClick={prevStep} disabled={currentStep === 0}&gt;
                                    &lt;ArrowLeft className="mr-2 h-4 w-4" /&gt; Previous
                                &lt;/Button&gt;
                                
                                {currentStep &lt; wizardSteps.length - 1 ? (
                                    &lt;Button type="button" onClick={nextStep}&gt;
                                        Next &lt;ArrowRight className="ml-2 h-4 w-4" /&gt;
                                    &lt;/Button&gt;
                                ) : (
                                    &lt;Button type="submit" disabled={isSubmitting || !form.formState.isValid}&gt;
                                        {isSubmitting ? &lt;Loader2 className="mr-2 h-4 w-4 animate-spin"/&gt; : &lt;Send className="mr-2 h-4 w-4"/&gt;}
                                        {isEditMode ? "Save Changes" : "Create Session"}
                                    &lt;/Button&gt;
                                )}&lt;/DialogFooter&gt;
                        &lt;/form&gt;
                    &lt;/Form&gt;
                &lt;/DialogContent&gt;
            &lt;/Dialog&gt;
        &lt;/div&gt;
    );
}
