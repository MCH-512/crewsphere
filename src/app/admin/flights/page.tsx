
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth, type User } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp, doc, writeBatch, serverTimestamp, getDoc, deleteDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Plane, Loader2, AlertTriangle, RefreshCw, Edit, PlusCircle, Trash2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, startOfDay } from "date-fns";
import { flightFormSchema, type FlightFormValues, type StoredFlight } from "@/schemas/flight-schema";
import { logAuditEvent } from "@/lib/audit-logger";
import { getAirportByCode, searchAirports, type Airport } from "@/services/airport-service";
import { getUsersByRole } from "@/services/user-service";
import { CustomAutocompleteAirport } from "@/components/ui/custom-autocomplete-airport";
import { CustomMultiSelectAutocomplete } from "@/components/ui/custom-multi-select-autocomplete";
import { useDebounce } from "use-debounce";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface FlightForDisplay extends StoredFlight {
    departureAirportName?: string;
    arrivalAirportName?: string;
    purserName?: string;
    crewCount: number;
}

export default function AdminFlightsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [flights, setFlights] = React.useState<FlightForDisplay[]>([]);
    const [pursers, setPursers] = React.useState<User[]>([]);
    const [pilots, setPilots] = React.useState<User[]>([]);
    const [cabinCrew, setCabinCrew] = React.useState<User[]>([]);
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

    const form = useForm<FlightFormValues>({
        resolver: zodResolver(flightFormSchema),
        defaultValues: {
            flightNumber: "", departureAirport: "", arrivalAirport: "",
            scheduledDepartureDateTimeUTC: "", scheduledArrivalDateTimeUTC: "",
            aircraftType: "", purserId: "", pilotIds: [], cabinCrewIds: []
        },
    });

    const fetchPageData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const flightsQuery = query(collection(db, "flights"), orderBy("scheduledDepartureDateTimeUTC", "desc"));
            const usersSnapshot = await getDocs(collection(db, "users"));
            const allUsers = usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
            const userMap = new Map(allUsers.map(u => [u.uid, u]));

            setPursers(allUsers.filter(u => u.role === 'purser'));
            setPilots(allUsers.filter(u => u.role === 'pilote'));
            setCabinCrew(allUsers.filter(u => u.role === 'cabin crew'));

            const flightsSnapshot = await getDocs(flightsQuery);
            const fetchedFlights = await Promise.all(
                flightsSnapshot.docs.map(async (d) => {
                    const data = { id: d.id, ...d.data() } as StoredFlight;
                    const [depAirport, arrAirport] = await Promise.all([
                        getAirportByCode(data.departureAirport),
                        getAirportByCode(data.arrivalAirport),
                    ]);
                    const crewCount = 1 + (data.pilotIds?.length || 0) + (data.cabinCrewIds?.length || 0);
                    return {
                        ...data,
                        departureAirportName: `${depAirport?.name} (${depAirport?.iata})` || data.departureAirport,
                        arrivalAirportName: `${arrAirport?.name} (${arrAirport?.iata})` || data.arrivalAirport,
                        purserName: userMap.get(data.purserId)?.displayName || 'N/A',
                        crewCount,
                    } as FlightForDisplay;
                })
            );
            setFlights(fetchedFlights);
        } catch (err) {
            toast({ title: "Loading Error", description: "Could not fetch flights and crew data.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        if (!authLoading) {
            if (!user || user.role !== 'admin') router.push('/');
            else fetchPageData();
        }
    }, [user, authLoading, router, fetchPageData]);

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

    const handleOpenDialog = (flightToEdit?: StoredFlight) => {
        if (flightToEdit) {
            setIsEditMode(true);
            setCurrentFlight(flightToEdit);
            form.reset({
                flightNumber: flightToEdit.flightNumber,
                departureAirport: flightToEdit.departureAirport,
                arrivalAirport: flightToEdit.arrivalAirport,
                scheduledDepartureDateTimeUTC: flightToEdit.scheduledDepartureDateTimeUTC,
                scheduledArrivalDateTimeUTC: flightToEdit.scheduledArrivalDateTimeUTC,
                aircraftType: flightToEdit.aircraftType,
                purserId: flightToEdit.purserId,
                pilotIds: flightToEdit.pilotIds || [],
                cabinCrewIds: flightToEdit.cabinCrewIds || [],
            });
        } else {
            setIsEditMode(false);
            setCurrentFlight(null);
            form.reset({
                flightNumber: "", departureAirport: "", arrivalAirport: "",
                scheduledDepartureDateTimeUTC: "", scheduledArrivalDateTimeUTC: "",
                aircraftType: "", purserId: "", pilotIds: [], cabinCrewIds: []
            });
        }
        setDepSearch("");
        setArrSearch("");
        setIsManageDialogOpen(true);
    };

    const handleFormSubmit = async (data: FlightFormValues) => {
        if (!user) return;
        setIsSubmitting(true);
        try {
            const batch = writeBatch(db);
            const allAssignedCrewIds = [data.purserId, ...(data.pilotIds || []), ...(data.cabinCrewIds || [])].filter(Boolean);
            const activityIds: Record<string, string> = {};

            // In edit mode, first delete all old activities
            if (isEditMode && currentFlight && currentFlight.activityIds) {
                for (const activityId of Object.values(currentFlight.activityIds)) {
                    batch.delete(doc(db, "userActivities", activityId));
                }
            }

            // Create new activities for all assigned crew
            for (const crewId of allAssignedCrewIds) {
                const activityRef = doc(collection(db, "userActivities"));
                batch.set(activityRef, {
                    userId: crewId,
                    activityType: 'flight' as const,
                    date: Timestamp.fromDate(startOfDay(new Date(data.scheduledDepartureDateTimeUTC))),
                    flightNumber: data.flightNumber,
                    departureAirport: data.departureAirport,
                    arrivalAirport: data.arrivalAirport,
                    comments: `Flight ${data.flightNumber} from ${data.departureAirport} to ${data.arrivalAirport}`,
                });
                activityIds[crewId] = activityRef.id;
            }
            
            const flightData = {
                ...data,
                activityIds,
                updatedAt: serverTimestamp(),
            };

            if (isEditMode && currentFlight) {
                const flightRef = doc(db, "flights", currentFlight.id);
                batch.update(flightRef, flightData);
                await logAuditEvent({ userId: user.uid, userEmail: user.email, actionType: "UPDATE_FLIGHT", entityId: currentFlight.id, details: { flightNumber: data.flightNumber } });
            } else {
                const flightRef = doc(collection(db, "flights"));
                batch.set(flightRef, { 
                    ...flightData, 
                    createdAt: serverTimestamp(), 
                    purserReportSubmitted: false,
                });
                await logAuditEvent({ userId: user.uid, userEmail: user.email, actionType: "CREATE_FLIGHT", entityId: flightRef.id, details: { flightNumber: data.flightNumber } });
            }

            await batch.commit();
            toast({ title: isEditMode ? "Flight Updated" : "Flight Created", description: `Flight ${data.flightNumber} has been saved and crew schedules updated.` });
            fetchPageData();
            setIsManageDialogOpen(false);
        } catch (error) {
            console.error("Error submitting flight:", error);
            toast({ title: "Submission Failed", description: "Could not save flight details.", variant: "destructive" });
        } finally {
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
            await logAuditEvent({ userId: user.uid, userEmail: user.email, actionType: "DELETE_FLIGHT", entityId: flightToDelete.id, details: { flightNumber: flightToDelete.flightNumber } });
            toast({ title: "Flight Deleted", description: `Flight "${flightToDelete.flightNumber}" and associated schedule entries have been removed.` });
            fetchPageData();
        } catch (error) {
            console.error("Error deleting flight:", error);
            toast({ title: "Deletion Failed", variant: "destructive" });
        }
    };

    if (authLoading || isLoading) return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    if (!user || user.role !== 'admin') return <div className="flex flex-col items-center justify-center min-h-screen text-center p-4"><AlertTriangle className="h-16 w-16 text-destructive mb-4" /><CardTitle className="text-2xl mb-2">Access Denied</CardTitle><p className="text-muted-foreground">You do not have permission to view this page.</p><Button onClick={() => router.push('/')} className="mt-6">Go to Dashboard</Button></div>;

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader className="flex flex-row justify-between items-start">
                    <div>
                        <CardTitle className="text-2xl font-headline flex items-center"><Plane className="mr-3 h-7 w-7 text-primary" />Flight Management</CardTitle>
                        <CardDescription>Schedule new flights and assign crew members.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={fetchPageData} disabled={isLoading}><RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />Refresh</Button>
                        <Button onClick={() => handleOpenDialog()}><PlusCircle className="mr-2 h-4 w-4"/>Create Flight</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead><TableHead>Flight No.</TableHead>
                                    <TableHead>Route</TableHead><TableHead>Purser</TableHead>
                                    <TableHead>Aircraft</TableHead><TableHead>Crew</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {flights.map((f) => (
                                    <TableRow key={f.id}>
                                        <TableCell className="font-medium text-xs">{format(new Date(f.scheduledDepartureDateTimeUTC), "PP")}</TableCell>
                                        <TableCell>{f.flightNumber}</TableCell>
                                        <TableCell className="text-xs">{f.departureAirportName} → {f.arrivalAirportName}</TableCell>
                                        <TableCell className="text-xs">{f.purserName}</TableCell>
                                        <TableCell className="text-xs">{f.aircraftType}</TableCell>
                                        <TableCell className="text-xs flex items-center gap-1"><Users className="h-3 w-3"/>{f.crewCount}</TableCell>
                                        <TableCell className="text-right space-x-1">
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(f)}><Edit className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(f)}><Trash2 className="h-4 w-4" /></Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                     {flights.length === 0 && <p className="text-center text-muted-foreground py-8">No flights found.</p>}
                </CardContent>
            </Card>

            <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{isEditMode ? "Edit Flight" : "Create New Flight"}</DialogTitle>
                        <DialogDescription>{isEditMode ? "Update the flight details below." : "Fill in the form to schedule a new flight."}</DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleFormSubmit)}>
                        <ScrollArea className="h-[70vh] p-4">
                            <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="flightNumber" render={({ field }) => (<FormItem><FormLabel>Flight Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="aircraftType" render={({ field }) => (<FormItem><FormLabel>Aircraft Type</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
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
                            <h3 className="text-lg font-medium">Crew Assignment</h3>
                             <FormField control={form.control} name="purserId" render={({ field }) => (<FormItem><FormLabel>Assign Purser</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a purser" /></SelectTrigger></FormControl><SelectContent>{pursers.map(p => <SelectItem key={p.uid} value={p.uid}>{p.displayName} ({p.email})</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                             <FormField control={form.control} name="pilotIds" render={({ field }) => (<FormItem><FormLabel>Assign Pilots</FormLabel><CustomMultiSelectAutocomplete placeholder="Select pilots..." options={pilots.map(p => ({value: p.uid, label: `${p.displayName} (${p.email})`}))} selected={field.value || []} onChange={field.onChange} /><FormMessage /></FormItem>)} />
                             <FormField control={form.control} name="cabinCrewIds" render={({ field }) => (<FormItem><FormLabel>Assign Cabin Crew</FormLabel><CustomMultiSelectAutocomplete placeholder="Select cabin crew..." options={cabinCrew.map(c => ({value: c.uid, label: `${c.displayName} (${c.email})`}))} selected={field.value || []} onChange={field.onChange} /><FormMessage /></FormItem>)} />
                            </div>
                        </ScrollArea>
                            <DialogFooter className="mt-4 pt-4 border-t">
                                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                                <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{isEditMode ? "Save Changes" : "Create Flight"}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
