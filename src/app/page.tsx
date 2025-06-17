
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert as ShadAlert, AlertDescription as ShadAlertDescription, AlertTitle as ShadAlertTitle } from "@/components/ui/alert";
import { ArrowRight, CalendarClock, BellRing, Info, Briefcase, GraduationCap, ShieldCheck, FileText, BookOpen, PlaneTakeoff, AlertTriangle, CheckCircle, Sparkles, Loader2, LucideIcon, BookCopy, ClockIcon, ListChecks } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { generateDailyBriefing, type DailyBriefingOutput, type DailyBriefingInput } from "@/ai/flows/daily-briefing-flow";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, limit, getDocs, Timestamp, or, doc, getDoc, DocumentData } from "firebase/firestore";
import { formatDistanceToNowStrict, format, parseISO, addHours, subHours, startOfDay } from "date-fns";
import ReactMarkdown from "react-markdown";
import { AnimatedCard } from "@/components/motion/animated-card";
import { Skeleton } from "@/components/ui/skeleton"; 

interface Alert {
  id: string;
  title: string;
  content: string;
  level: "critical" | "warning" | "info";
  createdAt: Timestamp;
  userId?: string;
  iconName?: string;
}

interface FeaturedCourse {
  id: string;
  title: string;
  description: string;
  imageHint: string;
  mandatory: boolean;
  category: string;
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
  departureAirport: string;
  arrivalAirport: string;
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
    // flightDetails are populated client-side if activityType is 'flight'
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


export default function DashboardPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [dailyBriefing, setDailyBriefing] = React.useState<DailyBriefingOutput | null>(null);
  const [isBriefingLoading, setIsBriefingLoading] = React.useState(true);
  const [briefingError, setBriefingError] = React.useState<string | null>(null);
  const [userNameForGreeting, setUserNameForGreeting] = React.useState<string>("User");

  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  const [alertsLoading, setAlertsLoading] = React.useState(true);
  const [alertsError, setAlertsError] = React.useState<string | null>(null);

  const [featuredTrainings, setFeaturedTrainings] = React.useState<FeaturedCourse[]>([]);
  const [featuredTrainingsLoading, setFeaturedTrainingsLoading] = React.useState(true);
  const [featuredTrainingsError, setFeaturedTrainingsError] = React.useState<string | null>(null);

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
    async function fetchBriefing() {
      if (!user) {
        setIsBriefingLoading(false);
        setBriefingError("Please log in to view your briefing.");
        return;
      }
      setIsBriefingLoading(true);
      setBriefingError(null);
      try {
        const nameForBriefing = user.displayName || user.email || "Crew Member";
        const authRole = user.role;
        let schemaCompliantRole: DailyBriefingInput['userRole'];

        if (authRole) {
            switch (authRole) {
            case "admin": schemaCompliantRole = "Admin"; break;
            case "purser": schemaCompliantRole = "Purser"; break;
            case "cabin crew": schemaCompliantRole = "Cabin Crew"; break;
            case "instructor": schemaCompliantRole = "Instructor"; break;
            case "pilote": schemaCompliantRole = "Pilot"; break; 
            case "other": schemaCompliantRole = "Other"; break;
            default:
                const validRoles: Array<DailyBriefingInput['userRole']> = ["Admin", "Purser", "Cabin Crew", "Instructor", "Pilot", "Other"];
                if (validRoles.includes(authRole as DailyBriefingInput['userRole'])) {
                    schemaCompliantRole = authRole as DailyBriefingInput['userRole'];
                } else {
                    console.warn(`Unrecognized role "${authRole}" for briefing. Defaulting to "Other".`);
                    schemaCompliantRole = "Other";
                }
            }
        } else {
            schemaCompliantRole = "Other"; 
        }
        
        const briefingInput: DailyBriefingInput = { userName: nameForBriefing };
        if (schemaCompliantRole) {
            briefingInput.userRole = schemaCompliantRole;
        }

        const briefingData = await generateDailyBriefing(briefingInput);
        setDailyBriefing(briefingData);
      } catch (error) {
        console.error("Failed to load daily briefing:", error);
        setBriefingError("Could not load your daily AI briefing. Please try again later.");
        toast({
          title: "AI Briefing Error",
          description: "Could not load your daily AI briefing at this time.",
          variant: "destructive",
        });
      } finally {
        setIsBriefingLoading(false);
      }
    }
    fetchBriefing();
  }, [toast, user]);

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
    async function fetchFeaturedTrainings() {
      if (!user) {
        setFeaturedTrainingsLoading(false);
        setFeaturedTrainings([]); 
        setFeaturedTrainingsError("Please log in to view featured trainings.");
        return;
      }
      setFeaturedTrainingsLoading(true);
      setFeaturedTrainingsError(null);
      
      const finalFeaturedCourses: FeaturedCourse[] = [];

      try {
        
        const mandatoryQuery = query(
          collection(db, "courses"),
          where("mandatory", "==", true),
          orderBy("title"), 
          limit(5) 
        );
        const mandatorySnapshot = await getDocs(mandatoryQuery);
        const potentialMandatoryCourses = mandatorySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeaturedCourse));

        for (const course of potentialMandatoryCourses) {
          if (finalFeaturedCourses.length >= 2) break; 
          const progressDocId = `${user.uid}_${course.id}`;
          const progressSnap = await getDoc(doc(db, "userTrainingProgress", progressDocId));
          if (progressSnap.exists() && progressSnap.data().quizStatus === 'Passed') {
            continue; 
          }
          finalFeaturedCourses.push(course);
        }

        
        if (finalFeaturedCourses.length < 2) {
          const existingIds = finalFeaturedCourses.map(c => c.id); 
          const generalQuery = query(
            collection(db, "courses"),
            orderBy("category"), 
            orderBy("title"),
            limit(10) 
          );
          const generalSnapshot = await getDocs(generalQuery);
          const potentialGeneralCourses = generalSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as FeaturedCourse));

          for (const course of potentialGeneralCourses) {
            if (finalFeaturedCourses.length >= 2) break;
            if (existingIds.includes(course.id)) continue; 

            const progressDocId = `${user.uid}_${course.id}`;
            const progressSnap = await getDoc(doc(db, "userTrainingProgress", progressDocId));
            if (progressSnap.exists() && progressSnap.data().quizStatus === 'Passed') {
              continue; 
            }
            
            finalFeaturedCourses.push(course);
          }
        }
        
        setFeaturedTrainings(finalFeaturedCourses.slice(0, 2)); 
      } catch (err) {
        console.error("Error fetching featured trainings:", err);
        setFeaturedTrainingsError("Failed to load featured trainings.");
        toast({ title: "Training Error", description: "Could not load featured trainings.", variant: "destructive" });
      } finally {
        setFeaturedTrainingsLoading(false);
      }
    }
    fetchFeaturedTrainings();
  }, [user, toast]);

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
          orderBy("date", "asc") 
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

            setUpcomingDuty({
              flightNumber: nextFlightDetails.flightNumber,
              route: `${nextFlightDetails.departureAirport} - ${nextFlightDetails.arrivalAirport}`,
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
        if (lowerIconName === "briefcase") return Briefcase;
        if (lowerIconName === "graduationcap") return GraduationCap;
    }
    switch (alert.level) {
        case "critical": return AlertTriangle;
        case "warning": return AlertTriangle; 
        case "info":
        default: return Info;
    }
  };


  return (
    <div className="grid gap-6 md:gap-8">
      <AnimatedCard>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-headline">Welcome Back, {userNameForGreeting}!</CardTitle>
            <CardDescription>Your central command for flight operations, documents, and training.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Stay updated with your schedule, important alerts, and manage your professional development.
            </p>
          </CardContent>
        </Card>
      </AnimatedCard>

      <AnimatedCard delay={0.1}>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium font-headline flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Your AI Daily Briefing
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isBriefingLoading ? (
              <div className="space-y-2 py-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-full mt-2" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : briefingError ? (
               <ShadAlert variant="destructive">
                  <AlertTriangle className="h-5 w-5" />
                  <ShadAlertTitle>Briefing Error</ShadAlertTitle>
                  <ShadAlertDescription>{briefingError}</ShadAlertDescription>
                </ShadAlert>
            ) : dailyBriefing ? (
              <div
                className="prose prose-sm max-w-none dark:prose-invert text-foreground"
              >
                <ReactMarkdown>{dailyBriefing.briefingMarkdown}</ReactMarkdown>
              </div>
            ) : (
               <div className="flex items-center space-x-2 text-muted-foreground">
                <Info className="h-5 w-5" />
                <span>Log in to receive your personalized daily briefing.</span>
              </div>
            )}
          </CardContent>
        </Card>
      </AnimatedCard>

      <div className="grid md:grid-cols-3 gap-6 md:gap-8">
        <AnimatedCard delay={0.2} className="md:col-span-2">
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

        <AnimatedCard delay={0.25} className="md:col-span-1">
          <Card className="h-full shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                  <CardTitle className="font-headline text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3">
                  <Button variant="default" className="w-full justify-start" asChild>
                    <Link href="/purser-reports"><FileText className="mr-2 h-4 w-4"/>Submit Flight Report</Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/schedule"><CalendarClock className="mr-2 h-4 w-4"/>View Full Roster</Link>
                  </Button>
                   <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/requests"><ArrowRight className="mr-2 h-4 w-4"/>Make a Request</Link>
                  </Button>
                   <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/documents"><BookOpen className="mr-2 h-4 w-4"/>Access Documents</Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/training"><ListChecks className="mr-2 h-4 w-4"/>My Trainings</Link>
                  </Button>
              </CardContent>
          </Card>
        </AnimatedCard>
      </div>
      
      <AnimatedCard delay={0.3}>
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
                  <CheckCircle className="h-10 w-10 mx-auto text-success-foreground mb-2" />
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
      
      <AnimatedCard delay={0.35}>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
              <CardTitle className="font-headline flex items-center"><ShieldCheck className="mr-2 h-6 w-6 text-success-foreground"/>Safety &amp; Best Practice Tips</CardTitle>
              <CardDescription>Key reminders for maintaining safety and excellence.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
              {safetyTips.slice(0,2).map((tip) => (
                  <div key={tip.id} className="flex items-start gap-3 p-3 border-l-4 border-success bg-success/10 rounded-r-md">
                      <ShieldCheck className="h-5 w-5 text-success-foreground mt-0.5 shrink-0"/>
                      <p className="text-sm text-success-foreground/90">{tip.tip}</p>
                  </div>
              ))}
               <Button variant="link" className="p-0 h-auto text-sm" asChild>
                <Link href={`/documents?category=${encodeURIComponent("🚨 SEP (Safety & Emergency Procedures)")}`}>More Safety Information</Link>
              </Button>
          </CardContent>
        </Card>
      </AnimatedCard>

      <div className="grid gap-6 md:grid-cols-3">
         <AnimatedCard delay={0.4} className="md:col-span-2">
           <Card className="h-full shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="font-headline flex items-center"><BookCopy className="mr-2 h-5 w-5 text-primary"/>Key Updates &amp; Announcements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentDocumentsLoading ? (
                 <div className="space-y-3 py-2">
                    {[1,2,3].map(i => (
                      <div key={i} className="pb-3 border-b last:border-b-0">
                        <Skeleton className="h-5 w-3/4 mb-1" />
                        <Skeleton className="h-3 w-1/4 mb-2" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6 mt-1" />
                        <Skeleton className="h-3 w-1/3 mt-2" />
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
                <div key={doc.id} className="pb-3 border-b last:border-b-0">
                  <h3 className="font-semibold">{doc.title}</h3>
                  <Badge variant="outline" className="text-xs mb-1">{doc.category}</Badge>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {doc.content || doc.description || (doc.documentContentType === 'file' && doc.fileName ? `File: ${doc.fileName}` : doc.documentContentType === 'file' ? 'Attached File' : 'No preview available.')}
                  </p>
                  <p className="text-xs text-muted-foreground/80 mt-1">
                    Updated: {format(doc.lastUpdated.toDate(), "PP")}
                  </p>
                </div>
              ))}
               <Button variant="link" className="p-0 h-auto text-sm mt-2" asChild>
                  <Link href="/documents">View All Documents</Link>
               </Button>
            </CardContent>
          </Card>
        </AnimatedCard>

        <AnimatedCard delay={0.45} className="md:col-span-1">
          <Card className="h-full shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                  <CardTitle className="font-headline">Featured Training</CardTitle>
                  <CardDescription>Mandatory &amp; recommended courses.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {user && user.role === 'admin' ? (
                  <div className="text-sm text-muted-foreground">
                    <p>As an administrator, you manage training content rather than undertake it here.</p>
                    <Button asChild variant="link" className="p-0 h-auto mt-2">
                      <Link href="/admin/courses">Go to Course Management <ArrowRight className="ml-1 h-4 w-4" /></Link>
                    </Button>
                  </div>
                ) : (
                  <>
                    {featuredTrainingsLoading ? (
                      <div className="space-y-4">
                        {[1,2].map(i => (
                          <div key={i} className="flex items-center gap-4 p-3 border rounded-lg">
                            <Skeleton className="h-16 w-16 rounded-md" />
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-3 w-1/2" />
                                <Skeleton className="h-3 w-1/4 mb-1" />
                                <Skeleton className="h-7 w-24" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : featuredTrainingsError ? (
                      <ShadAlert variant="destructive">
                        <AlertTriangle className="h-5 w-5" />
                        <ShadAlertTitle>Training Error</ShadAlertTitle>
                        <ShadAlertDescription>{featuredTrainingsError}</ShadAlertDescription>
                      </ShadAlert>
                    ) : featuredTrainings.length === 0 && user ? (
                      <p className="text-sm text-muted-foreground py-4">No featured trainings for you at this time. All caught up or check the full library!</p>
                    ) : !user ? (
                      <p className="text-sm text-muted-foreground py-4">Log in to see featured trainings.</p>
                    ) : featuredTrainings.map((course) => (
                      <div key={course.id} className="flex items-center gap-4 p-3 border rounded-lg bg-card">
                        <Image 
                          src={`https://placehold.co/60x60.png`} 
                          alt={course.title} 
                          width={60} 
                          height={60} 
                          className="rounded-md" 
                          data-ai-hint={course.imageHint || "training material"} 
                        />
                        <div>
                          <h3 className="font-semibold text-sm">{course.title}</h3>
                          <p className="text-xs text-muted-foreground truncate w-40" title={course.description}>{course.description}</p>
                          {course.mandatory ? (
                              <Badge variant="destructive" className="mt-1 text-xs">Mandatory</Badge>
                          ) : (
                              <Badge variant="outline" className="mt-1 text-xs">Recommended</Badge>
                          )}
                          <br/>
                          <Button size="sm" className="mt-2 text-xs" asChild><Link href="/training">Go to Training</Link></Button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </CardContent>
          </Card>
        </AnimatedCard>
      </div>
    </div>
  );
}
