
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert as ShadAlert, AlertDescription as ShadAlertDescription, AlertTitle as ShadAlertTitle } from "@/components/ui/alert";
import { ArrowRight, CalendarClock, BellRing, Info, Briefcase, GraduationCap, ShieldCheck, FileText, BookOpen, PlaneTakeoff, AlertTriangle, CheckCircle, Sparkles, Loader2, LucideIcon, BookCopy, ClockIcon, SendHorizonal, FileSignature, ChevronRight, Bell } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, limit, getDocs, Timestamp, doc, getDoc, DocumentData } from "firebase/firestore";
import { formatDistanceToNowStrict, format, parseISO, addHours, subHours, startOfDay } from "date-fns";
import { AnimatedCard } from "@/components/motion/animated-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { getAirportByCode } from "@/services/airport-service";


interface Alert {
  id: string;
  title: string;
  content: string;
  level: "critical" | "warning" | "info";
  createdAt: Timestamp;
  userId?: string;
  iconName?: string;
}

interface RecentDocument {
  id: string;
  title: string;
  category: string;
  content?: string;
  description?: string;
  lastUpdated: Timestamp;
  documentContentType?: 'file' | 'markdown' | 'fileWithMarkdown';
  downloadURL?: string;
  fileName?: string;
}

interface Flight {
  id: string;
  flightNumber: string;
  departureAirport: string; // Original ICAO code
  departureAirportIATA?: string; // For display
  arrivalAirport: string;   // Original ICAO code
  arrivalAirportIATA?: string;   // For display
  scheduledDepartureDateTimeUTC: string; // ISO string
  scheduledArrivalDateTimeUTC: string; // ISO string
  aircraftType: string;
  status: "Scheduled" | "On Time" | "Delayed" | "Cancelled";
}

interface UserActivity extends DocumentData {
    id: string;
    userId: string;
    activityType: "flight" | "off" | "standby" | "leave" | "sick" | "training" | "other";
    date: Timestamp; // The day of the activity
    flightId?: string | null;
}

interface UpcomingDutyData {
  flightNumber: string;
  route: string;
  aircraft: string;
  reportingTime: string;
  reportingDate: string;
  reportingLocation: string;
  etd: string;
  eta: string;
  gate: string;
}

interface MyLearningCourse {
  id: string;
  title: string;
  category: string;
  mandatory: boolean;
  imageHint: string;
}


export default function DashboardPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [userNameForGreeting, setUserNameForGreeting] = React.useState<string>("User");

  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  const [alertsLoading, setAlertsLoading] = React.useState(true);
  const [alertsError, setAlertsError] = React.useState<string | null>(null);

  const [myLearningCourses, setMyLearningCourses] = React.useState<MyLearningCourse[]>([]);
  const [myLearningLoading, setMyLearningLoading] = React.useState(true);
  const [myLearningError, setMyLearningError] = React.useState<string | null>(null);

  const [recentDocuments, setRecentDocuments] = React.useState<RecentDocument[]>([]);
  const [recentDocumentsLoading, setRecentDocumentsLoading] = React.useState(true);
  const [recentDocumentsError, setRecentDocumentsError] = React.useState<string | null>(null);

  const [upcomingDuty, setUpcomingDuty] = React.useState<UpcomingDutyData | null>(null);
  const [isUpcomingDutyLoading, setIsUpcomingDutyLoading] = React.useState(true);
  const [upcomingDutyError, setUpcomingDutyError] = React.useState<string | null>(null);


  React.useEffect(() => {
    if (user) {
      const name = user.displayName || (user.email ? user.email.split('@')[0] : "Crew Member");
      setUserNameForGreeting(name.charAt(0).toUpperCase() + name.slice(1));
    }
  }, [user]);


  React.useEffect(() => {
    async function fetchAlerts() {
      if (!user) {
        setAlertsLoading(false);
        setAlertsError("Please log in to view alerts.");
        return;
      }
      setAlertsLoading(true);
      setAlertsError(null);
      try {
        const userAlertsQuery = query(
          collection(db, "alerts"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(3)
        );
        const globalAlertsQuery = query(
          collection(db, "alerts"),
          where("userId", "==", null),
          orderBy("createdAt", "desc"),
          limit(3)
        );
        
        const [userAlertsSnapshot, globalAlertsSnapshot] = await Promise.all([
            getDocs(userAlertsQuery),
            getDocs(globalAlertsQuery)
        ]);

        const fetchedUserAlerts = userAlertsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Alert));
        const fetchedGlobalAlerts = globalAlertsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Alert));
        
        const combinedAlerts = [...fetchedUserAlerts, ...fetchedGlobalAlerts]
          .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
          .reduce((acc, current) => {
            if (!acc.find(item => item.id === current.id)) {
              acc.push(current);
            }
            return acc;
          }, [] as Alert[])
          .slice(0, 3);

        setAlerts(combinedAlerts);
      } catch (err) {
        console.error("Error fetching alerts:", err);
        setAlertsError("Failed to load real-time alerts.");
        toast({ title: "Alerts Error", description: "Could not load alerts.", variant: "destructive" });
      } finally {
        setAlertsLoading(false);
      }
    }
    fetchAlerts();
  }, [user, toast]);
  
  React.useEffect(() => {
    async function fetchMyLearning() {
        if (!user) {
            setMyLearningLoading(false);
            return;
        }
        setMyLearningLoading(true);
        setMyLearningError(null);

        try {
            // Fetch user's non-passed progress records first
            const progressQuery = query(
                collection(db, "userTrainingProgress"),
                where("userId", "==", user.uid)
            );
            const progressSnapshot = await getDocs(progressQuery);
            const userProgressMap = new Map();
            progressSnapshot.forEach(doc => {
                const data = doc.data();
                userProgressMap.set(data.courseId, data.quizStatus);
            });

            // Fetch all published, mandatory courses
            const mandatoryQuery = query(
                collection(db, "courses"),
                where("mandatory", "==", true),
                where("published", "==", true)
            );
            const mandatorySnapshot = await getDocs(mandatoryQuery);
            const mandatoryCourses = mandatorySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MyLearningCourse));

            // Filter for mandatory courses not yet passed
            let requiredCourses = mandatoryCourses.filter(course => userProgressMap.get(course.id) !== 'Passed');

            // If not enough mandatory, look for in-progress courses
            if (requiredCourses.length < 2) {
                const inProgressIds = [];
                for (const [courseId, status] of userProgressMap.entries()) {
                    if (status === 'InProgress' || status === 'Attempted' || status === 'Failed') {
                        inProgressIds.push(courseId);
                    }
                }
                
                if (inProgressIds.length > 0) {
                    const coursesToFetch = inProgressIds.filter(id => !requiredCourses.some(rc => rc.id === id));
                    if (coursesToFetch.length > 0) {
                        const inProgressQuery = query(
                            collection(db, "courses"),
                            where("__name__", "in", coursesToFetch.slice(0, 10)), // Limit to 10 to be safe
                            where("published", "==", true)
                        );
                        const inProgressSnapshot = await getDocs(inProgressQuery);
                        const inProgressCourses = inProgressSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MyLearningCourse));
                        requiredCourses = [...requiredCourses, ...inProgressCourses];
                    }
                }
            }
            
            // Deduplicate and set final list
            const finalCourses = requiredCourses.reduce((acc, current) => {
                if (!acc.find(item => item.id === current.id)) {
                    acc.push(current);
                }
                return acc;
            }, [] as MyLearningCourse[]);
            
            setMyLearningCourses(finalCourses.slice(0, 2));

        } catch (err) {
            console.error("Error fetching my learning courses:", err);
            setMyLearningError("Failed to load your learning tasks.");
        } finally {
            setMyLearningLoading(false);
        }
    }
    fetchMyLearning();
  }, [user]);

  React.useEffect(() => {
    async function fetchRecentDocuments() {
      if (!user) {
        setRecentDocumentsLoading(false);
        setRecentDocumentsError("Please log in to view recent documents.");
        return;
      }
      setRecentDocumentsLoading(true);
      setRecentDocumentsError(null);
      try {
        const docsQuery = query(collection(db, "documents"), orderBy("lastUpdated", "desc"), limit(3));
        const docsSnapshot = await getDocs(docsQuery);
        const fetchedDocs = docsSnapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
        } as RecentDocument));
        setRecentDocuments(fetchedDocs);
      } catch (err) {
        console.error("Error fetching recent documents:", err);
        setRecentDocumentsError("Failed to load recent documents.");
        toast({ title: "Documents Error", description: "Could not load recent documents.", variant: "destructive" });
      } finally {
        setRecentDocumentsLoading(false);
      }
    }
    fetchRecentDocuments();
  }, [user, toast]);

  React.useEffect(() => {
    async function fetchUpcomingDuty() {
      if (!user) {
        setIsUpcomingDutyLoading(false);
        setUpcomingDuty(null);
        setUpcomingDutyError("Please log in to view upcoming duty.");
        return;
      }
      setIsUpcomingDutyLoading(true);
      setUpcomingDutyError(null);
      setUpcomingDuty(null);

      try {
        const today = startOfDay(new Date());
        const activitiesQuery = query(
          collection(db, "userActivities"),
          where("userId", "==", user.uid),
          where("activityType", "==", "flight"),
          where("date", ">=", Timestamp.fromDate(today)), 
          orderBy("date", "asc"),
          limit(10) // Performance: Limit to check only the next 10 assigned flight days
        );

        const activitiesSnapshot = await getDocs(activitiesQuery);
        if (activitiesSnapshot.empty) {
          setIsUpcomingDutyLoading(false);
          return;
        }

        let nextFlightActivity: UserActivity | null = null;
        let nextFlightDetails: Flight | null = null;

        for (const activityDoc of activitiesSnapshot.docs) {
          const activityData = activityDoc.data() as UserActivity;
          if (activityData.flightId) {
            const flightDocRef = doc(db, "flights", activityData.flightId);
            const flightDocSnap = await getDoc(flightDocRef);
            if (flightDocSnap.exists()) {
              const flightData = { id: flightDocSnap.id, ...flightDocSnap.data() } as Flight;
              
              if (new Date(flightData.scheduledDepartureDateTimeUTC) > new Date()) {
                if (!nextFlightDetails || new Date(flightData.scheduledDepartureDateTimeUTC) < new Date(nextFlightDetails.scheduledDepartureDateTimeUTC)) {
                  nextFlightActivity = activityData;
                  nextFlightDetails = flightData;
                }
              }
            }
          }
        }
        
        if (nextFlightDetails) {
            const departureDateTime = parseISO(nextFlightDetails.scheduledDepartureDateTimeUTC);
            const reportingDateTime = subHours(departureDateTime, 2); 

            // Fetch airport IATA codes
            const depAirportInfo = await getAirportByCode(nextFlightDetails.departureAirport);
            const arrAirportInfo = await getAirportByCode(nextFlightDetails.arrivalAirport);
            const depDisplay = depAirportInfo?.iata || nextFlightDetails.departureAirport;
            const arrDisplay = arrAirportInfo?.iata || nextFlightDetails.arrivalAirport;

            setUpcomingDuty({
              flightNumber: nextFlightDetails.flightNumber,
              route: `${depDisplay} - ${arrDisplay}`,
              aircraft: nextFlightDetails.aircraftType,
              reportingTime: format(reportingDateTime, "HH:mm 'UTC'"),
              reportingDate: format(reportingDateTime, "MMM d, yyyy"),
              reportingLocation: "Crew Report Centre", 
              etd: format(departureDateTime, "HH:mm 'UTC'"),
              eta: format(parseISO(nextFlightDetails.scheduledArrivalDateTimeUTC), "HH:mm 'UTC'"), 
              gate: "TBA", 
            });
        }
      } catch (err) {
        console.error("Error fetching upcoming duty:", err);
        setUpcomingDutyError("Failed to load your upcoming duty information.");
      } finally {
        setIsUpcomingDutyLoading(false);
      }
    }
    fetchUpcomingDuty();
  }, [user]);

  const safetyTips = [
    { id: 1, tip: "Always perform thorough pre-flight safety checks on all emergency equipment in your assigned zone. Verify seals and accessibility." },
    { id: 2, tip: "In an emergency, remain calm, follow your training, and communicate clearly and assertively with passengers and fellow crew." },
    { id: 3, tip: "Maintain situational awareness at all times, especially during critical phases like boarding, takeoff, sterile flight deck, and landing." },
  ];

  const getAlertVariant = (level: Alert["level"]): "default" | "destructive" | "success" | "warning" | null | undefined => {
    switch (level) {
      case 'critical':
        return 'destructive';
      case 'warning':
        return 'warning';
      case 'info':
      default:
        return 'default';
    }
  };

  const getIconForAlert = (alert: Alert): LucideIcon => {
    if (alert.iconName) {
        const lowerIconName = alert.iconName.toLowerCase();
        if (lowerIconName.includes("briefcase")) return Briefcase;
        if (lowerIconName.includes("graduation")) return GraduationCap;
        if (lowerIconName.includes("bell")) return Bell;
        if (lowerIconName.includes("plane")) return PlaneTakeoff;
    }
    switch (alert.level) {
        case "critical": return AlertTriangle;
        case "warning": return AlertTriangle; 
        case "info":
        default: return Info;
    }
  };


  return (
    <div className="space-y-6">
      <AnimatedCard>
        <Card className="shadow-lg bg-card border-none">
          <CardHeader>
            <CardTitle className="text-3xl font-headline">Welcome Back, {userNameForGreeting}!</CardTitle>
            <CardDescription>This is your central command for flight operations, documents, and training.</CardDescription>
          </CardHeader>
        </Card>
      </AnimatedCard>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <AnimatedCard delay={0.1} className="lg:col-span-2">
          <Card className="h-full shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium font-headline">Upcoming Duty</CardTitle>
              <PlaneTakeoff className="h-6 w-6 text-primary" />
            </CardHeader>
            <CardContent className="space-y-3">
              {isUpcomingDutyLoading ? (
                <div className="space-y-3 py-2">
                  <Skeleton className="h-8 w-3/4" /> 
                  <Skeleton className="h-4 w-1/2" /> 
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
                    <Skeleton className="h-4 w-full" /> 
                    <Skeleton className="h-4 w-full" /> 
                    <Skeleton className="h-4 w-full" /> 
                    <Skeleton className="h-4 w-full" /> 
                  </div>
                  <Skeleton className="h-9 w-full mt-3" /> 
                </div>
              ) : upcomingDutyError ? (
                <ShadAlert variant="destructive">
                  <AlertTriangle className="h-5 w-5" />
                  <ShadAlertTitle>Upcoming Duty Error</ShadAlertTitle>
                  <ShadAlertDescription>{upcomingDutyError}</ShadAlertDescription>
                </ShadAlert>
              ) : upcomingDuty ? (
                <>
                  <div>
                    <p className="text-2xl font-bold text-primary">{upcomingDuty.flightNumber} ({upcomingDuty.route})</p>
                    <p className="text-sm text-muted-foreground">{upcomingDuty.aircraft}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div><span className="font-semibold">Report:</span> {upcomingDuty.reportingTime}, {upcomingDuty.reportingDate}</div>
                    <div><span className="font-semibold">Location:</span> {upcomingDuty.reportingLocation}</div>
                    <div><span className="font-semibold">ETD:</span> {upcomingDuty.etd} (Gate: {upcomingDuty.gate})</div>
                    <div><span className="font-semibold">ETA:</span> {upcomingDuty.eta}</div>
                  </div>
                   <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
                    <Link href="/schedule">
                        View Full Roster & Details <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                    </Button>
                </>
              ) : (
                <div className="text-center py-4">
                  <ClockIcon className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No upcoming flights or duties found in your schedule.</p>
                  <Button variant="link" size="sm" className="mt-2" asChild>
                    <Link href="/schedule">
                      Check Full Schedule <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </AnimatedCard>

        <AnimatedCard delay={0.15} className="lg:col-span-1">
          <Card className="h-full shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                  <CardTitle className="font-headline text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3">
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/purser-reports"><FileSignature className="mr-2 h-4 w-4"/>Submit Flight Report</Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/schedule"><CalendarClock className="mr-2 h-4 w-4"/>View Full Roster</Link>
                  </Button>
                   <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/requests"><SendHorizonal className="mr-2 h-4 w-4"/>Make a Request</Link>
                  </Button>
                   <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/documents"><BookOpen className="mr-2 h-4 w-4"/>Access Documents</Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/training"><GraduationCap className="mr-2 h-4 w-4"/>My Trainings</Link>
                  </Button>
              </CardContent>
          </Card>
        </AnimatedCard>
        
        <AnimatedCard delay={0.2} className="lg:col-span-3">
            <Card className="shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium font-headline">Real-Time Alerts</CardTitle>
                <BellRing className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                {alertsLoading ? (
                    <div className="space-y-3 py-2">
                        <div className="flex items-start space-x-3"><Skeleton className="h-5 w-5 rounded-full mt-1" /><div className="space-y-1 flex-1"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-8 w-full" /></div></div>
                        <div className="flex items-start space-x-3"><Skeleton className="h-5 w-5 rounded-full mt-1" /><div className="space-y-1 flex-1"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-8 w-full" /></div></div>
                    </div>
                ) : alertsError ? (
                    <ShadAlert variant="destructive" className="mb-4">
                        <AlertTriangle className="h-5 w-5" />
                        <ShadAlertTitle>Alerts Error</ShadAlertTitle>
                        <ShadAlertDescription>{alertsError}</ShadAlertDescription>
                    </ShadAlert>
                ) : alerts.length === 0 ? (
                    <div className="text-center py-6">
                    <CheckCircle className="h-10 w-10 mx-auto text-success mb-2" />
                    <p className="text-base text-muted-foreground">All clear! No new critical alerts.</p>
                    <p className="text-sm text-muted-foreground mt-1">You're up-to-date.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                    {alerts.map((alert) => {
                        const IconComponent = getIconForAlert(alert);
                        const timeAgo = formatDistanceToNowStrict(alert.createdAt.toDate(), { addSuffix: true });
                        
                        return (
                        <ShadAlert key={alert.id} variant={getAlertVariant(alert.level)} className="shadow-sm">
                        <IconComponent className="h-5 w-5" />
                        <div className="flex justify-between items-center mb-1">
                            <ShadAlertTitle>{alert.title}</ShadAlertTitle>
                            <p className="text-xs text-muted-foreground/70">{timeAgo}</p>
                        </div>
                        <ShadAlertDescription>{alert.content}</ShadAlertDescription>
                        </ShadAlert>
                    )})}
                    </div>
                )}
                <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
                    <Link href="/my-alerts">View All Alerts <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                </CardContent>
            </Card>
        </AnimatedCard>

        <AnimatedCard delay={0.25} className="lg:col-span-2">
            <Card className="h-full shadow-md hover:shadow-lg transition-shadow">
                <CardHeader>
                    <CardTitle className="font-headline flex items-center"><GraduationCap className="mr-2 h-5 w-5 text-primary"/>My Learning</CardTitle>
                    <CardDescription>Your prioritized training requirements and courses.</CardDescription>
                </CardHeader>
                <CardContent>
                    {myLearningLoading ? (
                        <div className="space-y-4">
                            {[1, 2].map(i => <div key={i} className="flex items-center gap-4"><Skeleton className="h-12 w-12 rounded-lg"/><div className="space-y-2 flex-1"><Skeleton className="h-4 w-3/4"/><Skeleton className="h-3 w-1/2"/></div><Skeleton className="h-8 w-24"/></div>)}
                        </div>
                    ) : myLearningError ? (
                        <ShadAlert variant="destructive"><AlertTriangle className="h-5 w-5" /><ShadAlertTitle>Learning Error</ShadAlertTitle><ShadAlertDescription>{myLearningError}</ShadAlertDescription></ShadAlert>
                    ) : myLearningCourses.length === 0 ? (
                        <div className="text-center py-4">
                          <CheckCircle className="h-10 w-10 mx-auto text-success mb-2" />
                          <p className="text-sm text-muted-foreground">You are up-to-date with all required and in-progress training!</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {myLearningCourses.map(course => (
                                <div key={course.id} className="flex items-center gap-4 p-2 rounded-lg border">
                                    <Image src={`https://placehold.co/80x80.png`} alt={course.title} width={48} height={48} className="rounded-md" data-ai-hint={course.imageHint || "training manual"} />
                                    <div className="flex-grow">
                                        <h3 className="font-semibold text-sm">{course.title}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className="text-xs">{course.category}</Badge>
                                            {course.mandatory && <Badge variant="destructive" className="text-xs">Mandatory</Badge>}
                                        </div>
                                    </div>
                                    <Button size="sm" asChild>
                                        <Link href="/training">Continue <ChevronRight className="ml-1 h-4 w-4"/></Link>
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                     <Button variant="link" className="p-0 h-auto text-sm mt-3" asChild>
                        <Link href="/training">Go to Training Hub <ArrowRight className="ml-1 h-3 w-3" /></Link>
                    </Button>
                </CardContent>
            </Card>
        </AnimatedCard>

         <AnimatedCard delay={0.30} className="lg:col-span-1">
           <Card className="h-full shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="font-headline flex items-center"><BookCopy className="mr-2 h-5 w-5 text-primary"/>Recent Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentDocumentsLoading ? (
                 <div className="space-y-3 py-2">
                    {[1,2,3].map(i => (
                      <div key={i} className="pb-3 border-b last:border-b-0 space-y-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                    ))}
                 </div>
              ) : recentDocumentsError ? (
                <ShadAlert variant="destructive">
                  <AlertTriangle className="h-5 w-5" />
                  <ShadAlertTitle>Updates Error</ShadAlertTitle>
                  <ShadAlertDescription>{recentDocumentsError}</ShadAlertDescription>
                </ShadAlert>
              ) : recentDocuments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No recent documents or announcements.</p>
              ) : recentDocuments.map((doc) => (
                <div key={doc.id} className="pb-2 border-b last:border-b-0">
                  <h3 className="font-semibold text-sm truncate" title={doc.title}>{doc.title}</h3>
                  <div className="flex justify-between items-center">
                    <Badge variant="secondary" className="text-xs">{doc.category}</Badge>
                     <p className="text-xs text-muted-foreground/80">
                        {format(doc.lastUpdated.toDate(), "PP")}
                    </p>
                  </div>
                </div>
              ))}
               <Button variant="link" className="p-0 h-auto text-sm mt-2" asChild>
                  <Link href="/documents">View All Documents</Link>
               </Button>
            </CardContent>
          </Card>
        </AnimatedCard>

        <AnimatedCard delay={0.35} className="lg:col-span-3">
          <Card className="h-full shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="font-headline flex items-center">
                <ShieldCheck className="mr-2 h-6 w-6 text-success" />
                Safety & Best Practice
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {safetyTips.map((tip) => (
                <div
                  key={tip.id}
                  className="flex items-start gap-3 p-3 border-l-4 border-success bg-success/10 rounded-r-md"
                >
                  <ShieldCheck className="h-5 w-5 text-success mt-0.5 shrink-0" />
                  <p className="text-sm text-success/90">{tip.tip}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </AnimatedCard>
      </div>
    </div>
  );
}
