"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { FileText, Loader2, AlertTriangle, Plane, CheckCircle, Clock } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { AnimatedCard } from "@/components/motion/animated-card";
import Link from "next/link";
import { getAirportByCode } from "@/services/airport-service";

interface FlightForReporting {
  id: string;
  flightNumber: string;
  departureAirport: string;
  departureAirportIATA?: string;
  arrivalAirport: string;
  arrivalAirportIATA?: string;
  scheduledDepartureDateTimeUTC: string;
  purserReportSubmitted?: boolean;
}

export default function SelectFlightForPurserReportPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [eligibleFlights, setEligibleFlights] = React.useState<FlightForReporting[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchEligibleFlights = React.useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch recent flights assigned to the user
      const sevenDaysAgo = startOfDay(subDays(new Date(), 7));
      const activitiesQuery = query(
        collection(db, "userActivities"),
        where("userId", "==", user.uid),
        where("activityType", "==", "flight"),
        where("date", ">=", Timestamp.fromDate(sevenDaysAgo)),
        orderBy("date", "desc")
      );
      const activitiesSnapshot = await getDocs(activitiesQuery);
      const flightIds = activitiesSnapshot.docs.map(doc => doc.data().flightId).filter(Boolean);

      if (flightIds.length === 0) {
        setEligibleFlights([]);
        setIsLoading(false);
        return;
      }
      
      // 2. Fetch details for these flights
      const flightsQuery = query(collection(db, "flights"), where("__name__", "in", flightIds));
      const flightsSnapshot = await getDocs(flightsQuery);
      
      const flightsDataPromises = flightsSnapshot.docs.map(async (doc) => {
        const flightData = { id: doc.id, ...doc.data() } as FlightForReporting;
         const depAirportInfo = await getAirportByCode(flightData.departureAirport);
         if (depAirportInfo && depAirportInfo.iata) {
             flightData.departureAirportIATA = depAirportInfo.iata;
         }
         const arrAirportInfo = await getAirportByCode(flightData.arrivalAirport);
         if (arrAirportInfo && arrAirportInfo.iata) {
             flightData.arrivalAirportIATA = arrAirportInfo.iata;
         }
        return flightData;
      });
      const flightsData = await Promise.all(flightsDataPromises);

      // Sort by departure date descending
      flightsData.sort((a, b) => new Date(b.scheduledDepartureDateTimeUTC).getTime() - new Date(a.scheduledDepartureDateTimeUTC).getTime());
      
      setEligibleFlights(flightsData);

    } catch (err) {
      console.error("Error fetching eligible flights:", err);
      setError("Failed to load your recent flights. Please try again.");
      toast({ title: "Loading Error", description: "Could not fetch eligible flights.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  React.useEffect(() => {
    if (!authLoading) {
      if (user) {
        fetchEligibleFlights();
      } else {
        router.push('/login');
      }
    }
  }, [user, authLoading, router, fetchEligibleFlights]);

  if (authLoading || (isLoading && !user)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading flights...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center gap-3">
          <FileText className="h-7 w-7 text-primary" />
          <div>
            <CardTitle className="text-2xl font-headline">Submit Purser Report</CardTitle>
            <CardDescription>Select a recent flight to submit your report. Reports can be submitted for flights from the last 7 days.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="p-4 mb-4 text-sm text-destructive-foreground bg-destructive rounded-md flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> {error}
            </div>
          )}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">Loading recent flights...</p>
            </div>
          ) : eligibleFlights.length === 0 ? (
            <div className="text-center py-8">
              <Plane className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="font-semibold">No recent flights eligible for reporting.</p>
              <p className="text-sm text-muted-foreground">You have no flights in the last 7 days, or all reports have been submitted.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {eligibleFlights.map((flight) => (
                <AnimatedCard key={flight.id} delay={0.1}>
                  <Card className="shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex-grow">
                        <div className="flex items-center gap-2">
                           <p className="font-bold text-lg text-primary">{flight.flightNumber}</p>
                           <p className="text-sm font-medium">{flight.departureAirportIATA || flight.departureAirport} &rarr; {flight.arrivalAirportIATA || flight.arrivalAirport}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(flight.scheduledDepartureDateTimeUTC), "PPPp 'UTC'")}
                        </p>
                      </div>
                      <div className="w-full sm:w-auto flex-shrink-0">
                      {flight.purserReportSubmitted ? (
                        <div className="flex items-center justify-end text-sm font-medium text-success-foreground">
                          <CheckCircle className="mr-2 h-4 w-4" /> Report Submitted
                        </div>
                      ) : new Date(flight.scheduledDepartureDateTimeUTC) > new Date() ? (
                        <div className="flex items-center justify-end text-sm font-medium text-muted-foreground">
                          <Clock className="mr-2 h-4 w-4" /> Flight in Future
                        </div>
                      ) : (
                        <Button asChild>
                          <Link href={`/purser-reports/submit/${flight.id}`}>
                            Submit Report
                          </Link>
                        </Button>
                      )}
                      </div>
                    </CardContent>
                  </Card>
                </AnimatedCard>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}