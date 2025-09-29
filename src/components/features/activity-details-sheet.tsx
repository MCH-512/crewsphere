
"use client";

import * as React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, AlertTriangle, Plane, GraduationCap, Users } from "lucide-react";
import { format } from "date-fns";
import type { User } from "@/schemas/user-schema";
import type { StoredFlight } from "@/schemas/flight-schema";
import type { StoredTrainingSession } from "@/schemas/training-session-schema";
import type { Airport } from "@/services/airport-service";
import Link from "next/link";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";


// --- Data Structures ---
export interface FlightWithCrewDetails extends StoredFlight {
    departureAirportInfo?: Airport | null;
    arrivalAirportInfo?: Airport | null;
    crew: User[];
}
export interface TrainingWithAttendeesDetails extends StoredTrainingSession {
    attendees: User[];
}
export type SheetActivityDetails = { type: 'flight', data: FlightWithCrewDetails } | { type: 'training', data: TrainingWithAttendeesDetails };

// --- Sub-components ---
const FlightDetails = ({ data, authUser }: { data: FlightWithCrewDetails, authUser: User | null }) => (
    <div className="space-y-4">
        <Card><CardHeader className="pb-2"><CardDescription>Flight Info</CardDescription><CardTitle className="flex items-center gap-2"><Plane className="h-5 w-5"/> {data.flightNumber}</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1"><p><strong>Route:</strong> {data.departureAirportInfo?.iata || data.departureAirport} → {data.arrivalAirportInfo?.iata || data.arrivalAirport}</p><p><strong>Departure:</strong> {format(new Date(data.scheduledDepartureDateTimeUTC), "PPP HH:mm")} UTC</p><p><strong>Arrival:</strong> {format(new Date(data.scheduledArrivalDateTimeUTC), "PPP HH:mm")} UTC</p><p><strong>Aircraft:</strong> {data.aircraftType}</p></CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardDescription>Assigned Crew ({data.crew.length})</CardDescription></CardHeader>
            <CardContent>{['purser', 'pilote', 'cabin crew', 'instructor', 'stagiaire'].map(role => {
                const members = data.crew.filter(c => c.role === role);
                if (members.length === 0) return null;
                return (<div key={role}><h4 className="font-semibold capitalize mt-3 mb-2 text-primary">{role}</h4><div className="space-y-2">{members.map(member => (<div key={member.uid} className="flex items-center gap-2 text-sm">
                    <Avatar className="h-6 w-6"><AvatarImage src={member.photoURL ?? undefined} data-ai-hint="user portrait" /><AvatarFallback>{member.displayName?.substring(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                    {authUser?.role === 'admin' ? (
                        <Link href={`/admin/users/${member.uid}`} className="hover:underline text-primary">{member.displayName}</Link>
                    ) : (
                        <span>{member.displayName}</span>
                    )}
                </div>))}</div></div>);})}
            </CardContent>
        </Card>
    </div>
);

const TrainingDetails = ({ data, authUser }: { data: TrainingWithAttendeesDetails, authUser: User | null }) => {
    const sessionDate = typeof data.sessionDateTimeUTC === 'string'
        ? new Date(data.sessionDateTimeUTC)
        : data.sessionDateTimeUTC.toDate();
        
    return (
        <div className="space-y-4">
            <Card><CardHeader className="pb-2"><CardDescription>Training Session</CardDescription><CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5"/> {data.title}</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1"><p><strong>Location:</strong> {data.location}</p><p><strong>Time:</strong> {format(sessionDate, "PPP HH:mm")} UTC</p><p><strong>Description:</strong> {data.description}</p></CardContent>
            </Card>
            <Card><CardHeader className="pb-2"><CardDescription>Attendees ({data.attendees.length})</CardDescription></CardHeader>
                <CardContent><div className="space-y-2 max-h-60 overflow-y-auto">{data.attendees.map(member => (
                    <div key={member.uid} className="flex items-center gap-2 text-sm">
                      <Avatar className="h-6 w-6"><AvatarImage src={member.photoURL ?? undefined} data-ai-hint="user portrait" /><AvatarFallback>{member.displayName?.substring(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                       {authUser?.role === 'admin' ? (
                            <Link href={`/admin/users/${member.uid}`} className="hover:underline text-primary">{member.displayName} ({member.role})</Link>
                        ) : (
                            <span>{member.displayName} ({member.role})</span>
                        )}
                    </div>))}
                </div></CardContent>
            </Card>
        </div>
    );
};

export function ActivityDetailsSheet({ isOpen, onOpenChange, activity, isLoading, authUser, error }: { isOpen: boolean, onOpenChange: (open: boolean) => void, activity: SheetActivityDetails | null, isLoading: boolean, authUser: User | null, error: string | null }) {
    if (!isOpen) return null;

    return (
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md">
            <SheetHeader><SheetTitle>Activity Details</SheetTitle><SheetDescription>{isLoading ? "Loading details..." : "Information about the selected event."}</SheetDescription></SheetHeader>
            <div className="py-4">
                {isLoading ? (
                    <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : error ? (
                    <div className="text-center text-destructive py-10 flex flex-col items-center gap-2">
                        <AlertTriangle className="h-8 w-8"/>
                        <p className="font-semibold">Error Loading Details</p>
                        <p className="text-sm">{error}</p>
                    </div>
                ) : activity ? (
                    activity.type === 'flight' ? <FlightDetails data={activity.data} authUser={authUser} /> : <TrainingDetails data={activity.data} authUser={authUser} />
                ) : null}
            </div>
        </SheetContent>
      </Sheet>
    );
};
