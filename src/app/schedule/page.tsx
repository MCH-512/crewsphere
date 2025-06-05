"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlaneTakeoff, Briefcase, Users, MapPin } from "lucide-react";

interface ScheduleEvent {
  date: Date;
  type: "flight" | "ground" | "training" | "off";
  title: string;
  details: string;
  location?: string;
  time?: string;
}

const mockEvents: ScheduleEvent[] = [
  { date: new Date(2024, 6, 30), type: "flight", title: "FLT101: LHR - JFK", details: "Boeing 787, Crew A", location: "LHR Terminal 5", time: "14:30 - 22:00 UTC" },
  { date: new Date(2024, 7, 1), type: "ground", title: "Safety Briefing", details: "Mandatory for all crew", location: "Training Center, Room 3", time: "09:00 - 11:00 Local" },
  { date: new Date(2024, 7, 1), type: "off", title: "Day Off", details: "Rest day" },
  { date: new Date(2024, 7, 3), type: "training", title: "Recurrent Training", details: "Module 2: Emergency Procedures", location: "Online", time: "10:00 - 14:00 Local" },
  { date: new Date(2024, 7, 5), type: "flight", title: "FLT205: JFK - LAX", details: "Airbus A350, Crew B", location: "JFK Terminal 4", time: "08:00 - 16:00 EST" },
];


export default function SchedulePage() {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date());
  const [month, setMonth] = React.useState<Date>(new Date());

  const eventsForSelectedDate = selectedDate
    ? mockEvents.filter(event => event.date.toDateString() === selectedDate.toDateString())
    : [];
  
  const eventModifiers = {
    flight: mockEvents.filter(e => e.type === 'flight').map(e => e.date),
    ground: mockEvents.filter(e => e.type === 'ground').map(e => e.date),
    training: mockEvents.filter(e => e.type === 'training').map(e => e.date),
    off: mockEvents.filter(e => e.type === 'off').map(e => e.date),
  };

  const eventModifierStyles = {
    flight: { backgroundColor: 'hsl(var(--primary)/0.2)', color: 'hsl(var(--primary-foreground))', borderRadius: '0.25rem', border: '1px solid hsl(var(--primary))' },
    ground: { backgroundColor: 'hsl(var(--accent)/0.2)', color: 'hsl(var(--accent-foreground))',  borderRadius: '0.25rem', border: '1px solid hsl(var(--accent))' },
    training: { backgroundColor: 'hsl(var(--secondary)/0.5)', color: 'hsl(var(--secondary-foreground))', borderRadius: '0.25rem', border: '1px solid hsl(var(--secondary-foreground))'},
    off: { textDecoration: 'line-through', color: 'hsl(var(--muted-foreground))' }
  };


  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
      <Card className="lg:col-span-2 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">My Schedule</CardTitle>
          <CardDescription>View your flight assignments, ground duties, training sessions, and days off.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            month={month}
            onMonthChange={setMonth}
            className="rounded-md border p-4"
            modifiers={eventModifiers}
            modifiersStyles={eventModifierStyles}
            footer={
              <div className="flex justify-around mt-4 pt-2 border-t">
                <div className="flex items-center gap-2 text-xs"><div className="w-3 h-3 rounded-sm" style={eventModifierStyles.flight} /> Flight Duty</div>
                <div className="flex items-center gap-2 text-xs"><div className="w-3 h-3 rounded-sm" style={eventModifierStyles.ground} /> Ground Duty</div>
                <div className="flex items-center gap-2 text-xs"><div className="w-3 h-3 rounded-sm" style={eventModifierStyles.training} /> Training</div>
                 <div className="flex items-center gap-2 text-xs"><div className="w-3 h-3 rounded-sm border"/> Day Off</div>
              </div>
            }
          />
        </CardContent>
      </Card>

      <Card className="lg:col-span-1 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-headline">
            Events for {selectedDate ? selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : "selected date"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {eventsForSelectedDate.length > 0 ? (
            <ul className="space-y-4">
              {eventsForSelectedDate.map((event, index) => (
                <li key={index} className="p-4 rounded-md border bg-card hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-1">
                    {event.type === "flight" && <PlaneTakeoff className="h-5 w-5 text-primary" />}
                    {event.type === "ground" && <Briefcase className="h-5 w-5 text-accent" />}
                    {event.type === "training" && <Users className="h-5 w-5 text-secondary-foreground" />}
                    {event.type === "off" && <Users className="h-5 w-5 text-muted-foreground" />}
                    <h3 className="font-semibold">{event.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{event.details}</p>
                  {event.time && <p className="text-xs text-muted-foreground mt-1">Time: {event.time}</p>}
                  {event.location && 
                    <div className="flex items-center text-xs text-muted-foreground mt-1">
                      <MapPin className="h-3 w-3 mr-1" /> {event.location}
                    </div>
                  }
                  {event.type === "flight" && <Badge variant="default" className="mt-2 bg-primary/80">Flight</Badge>}
                  {event.type === "ground" && <Badge variant="secondary" className="mt-2 bg-accent/80">Ground Duty</Badge>}
                  {event.type === "training" && <Badge variant="outline" className="mt-2">Training</Badge>}
                   {event.type === "off" && <Badge variant="outline" className="mt-2">Off</Badge>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No events scheduled for this date.</p>
          )}
          <Button variant="outline" className="w-full mt-6">Request Schedule Change</Button>
        </CardContent>
      </Card>
    </div>
  );
}
