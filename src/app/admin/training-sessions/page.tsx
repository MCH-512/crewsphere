
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth, type User } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp, doc, writeBatch, serverTimestamp, deleteDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Loader2, AlertTriangle, RefreshCw, Edit, PlusCircle, Trash2, Users, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, startOfDay, parseISO } from "date-fns";
import { trainingSessionFormSchema, type TrainingSessionFormValues, type StoredTrainingSession } from "@/schemas/training-session-schema";
import { logAuditEvent } from "@/lib/audit-logger";
import { CustomMultiSelectAutocomplete } from "@/components/ui/custom-multi-select-autocomplete";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/hooks/use-debounce";
import { checkCrewAvailability, type Conflict } from "@/services/user-activity-service";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";


type SortableColumn = 'title' | 'location' | 'sessionDateTimeUTC' | 'attendeeCount';
type SortDirection = 'asc' | 'desc';

interface SessionForDisplay extends StoredTrainingSession {
    attendeeCount: number;
}

export default function AdminTrainingSessionsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [sessions, setSessions] = React.useState<SessionForDisplay[]>([]);
    
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
    const [currentSession, setCurrentSession] = React.useState<StoredTrainingSession | null>(null);

    const [sortColumn, setSortColumn] = React.useState<SortableColumn>('sessionDateTimeUTC');
    const [sortDirection, setSortDirection] = React.useState<SortDirection>('desc');

    const [crewWarnings, setCrewWarnings] = React.useState<Record<string, Conflict>>({});
    const [isCheckingAvailability, setIsCheckingAvailability] = React.useState(false);

    const form = useForm<TrainingSessionFormValues>({
        resolver: zodResolver(trainingSessionFormSchema),
        defaultValues: { title: "", description: "", location: "", sessionDateTimeUTC: "", purserIds: [], pilotIds: [], cabinCrewIds: [], instructorIds: [], traineeIds: [] },
    });
    
    const watchedPursers = form.watch("purserIds");
    const watchedPilots = form.watch("pilotIds");
    const watchedCabinCrew = form.watch("cabinCrewIds");
    const watchedInstructors = form.watch("instructorIds");
    const watchedTrainees = form.watch("traineeIds");
    const debouncedSessionDate = useDebounce(form.watch("sessionDateTimeUTC"), 500);

    const fetchPageData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const sessionsQuery = query(collection(db, "trainingSessions"), orderBy("sessionDateTimeUTC", "desc"));
            const usersQuery = query(collection(db, "users"), orderBy("email", "asc"));

            const [sessionsSnapshot, usersSnapshot] = await Promise.all([getDocs(sessionsQuery), getDocs(usersQuery)]);
            
            setSessions(sessionsSnapshot.docs.map(doc => {
                const data = doc.data() as StoredTrainingSession;
                return { 
                    id: doc.id,
                    ...data,
                    attendeeCount: data.attendeeIds.length,
                }
            }));

            const allUsersData = usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
            const userMapData = new Map(allUsersData.map(u => [u.uid, u]));
            setAllUsers(allUsersData);
            setUserMap(userMapData);
            setPilots(allUsersData.filter(u => u.role === 'pilote'));
            setPursers(allUsersData.filter(u => ['purser', 'admin', 'instructor'].includes(u.role || '') && u.role !== 'pilote'));
            setCabinCrew(allUsersData.filter(u => u.role === 'cabin crew'));
            setInstructors(allUsersData.filter(u => u.role === 'instructor'));
            setTrainees(allUsersData.filter(u => u.role === 'stagiaire'));

        } catch (err) {
            toast({ title: "Loading Error", description: "Could not fetch sessions and users.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);
    
    const sortedSessions = React.useMemo(() => {
        return [...sessions].sort((a, b) => {
            const valA = a[sortColumn];
            const valB = b[sortColumn];
            let comparison = 0;

            if (sortColumn === 'sessionDateTimeUTC') {
                comparison = new Date(valA as string).getTime() - new Date(valB as string).getTime();
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
    
    const SortableHeader = ({ column, label }: { column: SortableColumn; label: string }) => (
        <TableHead onClick={() => handleSort(column)} className="cursor-pointer hover:bg-muted/50">
            <div className="flex items-center gap-2">
                {label}
                {sortColumn === column ? (
                    sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                ) : (
                    <ArrowUpDown className="h-4 w-4 opacity-50" />
                )}
            </div>
        </TableHead>
    );

    React.useEffect(() => {
        if (!authLoading) {
            if (!user || user.role !== 'admin') router.push('/');
            else fetchPageData();
        }
    }, [user, authLoading, router, fetchPageData]);
    
     React.useEffect(() => {
        const allAttendees = [
            ...(watchedPursers || []), ...(watchedPilots || []), ...(watchedCabinCrew || []),
            ...(watchedInstructors || []), ...(watchedTrainees || [])
        ].filter(Boolean);

        if (allAttendees.length === 0 || !debouncedSessionDate) {
            setCrewWarnings({});
            return;
        }

        const check = async () => {
            setIsCheckingAvailability(true);
            try {
                const sessionDate = startOfDay(new Date(debouncedSessionDate));
                if (isNaN(sessionDate.getTime())) return;

                const warnings = await checkCrewAvailability(allAttendees, sessionDate, sessionDate);
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
    }, [JSON.stringify(watchedPursers), JSON.stringify(watchedPilots), JSON.stringify(watchedCabinCrew), JSON.stringify(watchedInstructors), JSON.stringify(watchedTrainees), debouncedSessionDate, toast]);


    const handleOpenDialog = async (sessionToEdit?: StoredTrainingSession) => {
        if (sessionToEdit) {
            setIsEditMode(true);
            setCurrentSession(sessionToEdit);

            // Pre-populate role-based arrays for editing
            const attendeesData = await Promise.all(
                sessionToEdit.attendeeIds.map(id => userMap.get(id))
            ).then(users => users.filter(Boolean) as User[]);

            form.reset({
                title: sessionToEdit.title,
                description: sessionToEdit.description,
                location: sessionToEdit.location,
                sessionDateTimeUTC: sessionToEdit.sessionDateTimeUTC,
                purserIds: attendeesData.filter(u => ['purser', 'admin'].includes(u.role || '')).map(u => u.uid),
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
                sessionDateTimeUTC: data.sessionDateTimeUTC,
                attendeeIds,
                activityIds,
                createdBy: user.uid, 
                updatedAt: serverTimestamp() 
            };

            if (isEditMode && currentSession) {
                batch.update(sessionRef, sessionData);
                await logAuditEvent({ userId: user.uid, userEmail: user.email, actionType: "UPDATE_TRAINING_SESSION", entityType: "TRAINING_SESSION", entityId: currentSession.id, details: { title: data.title } });
            } else {
                batch.set(sessionRef, { ...sessionData, createdAt: serverTimestamp() });
                await logAuditEvent({ userId: user.uid, userEmail: user.email, actionType: "CREATE_TRAINING_SESSION", entityType: "TRAINING_SESSION", entityId: sessionRef.id, details: { title: data.title } });
            }
            
            await batch.commit();
            toast({ title: isEditMode ? "Session Updated" : "Session Created", description: `Session "${data.title}" and user schedules have been updated.` });
            fetchPageData();
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
            await logAuditEvent({ userId: user.uid, userEmail: user.email, actionType: "DELETE_TRAINING_SESSION", entityType: "TRAINING_SESSION", entityId: sessionToDelete.id, details: { title: sessionToDelete.title } });
            toast({ title: "Session Deleted", description: `"${sessionToDelete.title}" has been removed.` });
            fetchPageData();
        } catch (error) {
            toast({ title: "Deletion Failed", variant: "destructive" });
        }
    };

    if (authLoading || isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader className="flex flex-row justify-between items-start">
                    <div>
                        <CardTitle className="text-2xl font-headline flex items-center"><ClipboardCheck className="mr-3 h-7 w-7 text-primary" />Training Session Management</CardTitle>
                        <CardDescription>Plan and manage in-person training sessions for all crew members.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={fetchPageData} disabled={isLoading}><RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />Refresh</Button>
                        <Button onClick={() => handleOpenDialog()}><PlusCircle className="mr-2 h-4 w-4" />Create Session</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader><TableRow>
                                <SortableHeader column="title" label="Title" />
                                <SortableHeader column="location" label="Location" />
                                <SortableHeader column="sessionDateTimeUTC" label="Date & Time (UTC)" />
                                <SortableHeader column="attendeeCount" label="Attendees" />
                                <TableHead>Actions</TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                                {sortedSessions.map(s => (
                                    <TableRow key={s.id}>
                                        <TableCell className="font-medium">{s.title}</TableCell>
                                        <TableCell>{s.location}</TableCell>
                                        <TableCell>{format(new Date(s.sessionDateTimeUTC), "PPpp")}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                                                <Users className="h-3 w-3"/>
                                                {s.attendeeIds.length}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="space-x-1">
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
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleFormSubmit)}>
                            <ScrollArea className="h-[70vh] p-4">
                                <div className="space-y-6">
                                    <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Session Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} className="min-h-[100px]" /></FormControl><FormMessage /></FormItem>)} />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField control={form.control} name="location" render={({ field }) => (<FormItem><FormLabel>Location</FormLabel><FormControl><Input {...field} placeholder="e.g., Training Center - Room A" /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="sessionDateTimeUTC" render={({ field }) => (<FormItem><FormLabel>Date & Time (UTC)</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    </div>
                                    <Separator />
                                    <h3 className="text-lg font-medium">Assign Attendees</h3>
                                     <FormField control={form.control} name="purserIds" render={({ field }) => (<FormItem><FormLabel>Assign Pursers</FormLabel><CustomMultiSelectAutocomplete placeholder="Select pursers..." options={pursers.map(p => ({value: p.uid, label: `${p.displayName} (${p.email})`}))} selected={field.value || []} onChange={field.onChange} /><FormMessage /></FormItem>)} />
                                     <FormField control={form.control} name="pilotIds" render={({ field }) => (<FormItem><FormLabel>Assign Pilots</FormLabel><CustomMultiSelectAutocomplete placeholder="Select pilots..." options={pilots.map(p => ({value: p.uid, label: `${p.displayName} (${p.email})`}))} selected={field.value || []} onChange={field.onChange} /><FormMessage /></FormItem>)} />
                                     <FormField control={form.control} name="cabinCrewIds" render={({ field }) => (<FormItem><FormLabel>Assign Cabin Crew</FormLabel><CustomMultiSelectAutocomplete placeholder="Select cabin crew..." options={cabinCrew.map(c => ({value: c.uid, label: `${c.displayName} (${c.email})`}))} selected={field.value || []} onChange={field.onChange} /><FormMessage /></FormItem>)} />
                                     <FormField control={form.control} name="instructorIds" render={({ field }) => (<FormItem><FormLabel>Assign Instructors</FormLabel><CustomMultiSelectAutocomplete placeholder="Select instructors..." options={instructors.map(i => ({value: i.uid, label: `${i.displayName} (${i.email})`}))} selected={field.value || []} onChange={field.onChange} /><FormMessage /></FormItem>)} />
                                     <FormField control={form.control} name="traineeIds" render={({ field }) => (<FormItem><FormLabel>Assign Trainees</FormLabel><CustomMultiSelectAutocomplete placeholder="Select trainees..." options={trainees.map(t => ({value: t.uid, label: `${t.displayName} (${t.email})`}))} selected={field.value || []} onChange={field.onChange} /><FormMessage /></FormItem>)} />

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
                                                        <AlertDescription>{conflict.details}</AlertDescription>
                                                    </Alert>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">No conflicts detected for the selected attendees and date.</p>
                                        )}
                                </div>
                            </ScrollArea>
                            <DialogFooter className="mt-4 pt-4 border-t">
                                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                                <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{isEditMode ? "Save Changes" : "Create Session"}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
