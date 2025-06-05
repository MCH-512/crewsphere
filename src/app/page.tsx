
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CalendarClock, BellRing, Info, Briefcase, GraduationCap, ShieldCheck, FileText, BookOpen, PlaneTakeoff, AlertTriangle, CheckCircle, Sparkles, Loader2, LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { generateDailyBriefing, type DailyBriefingOutput } from "@/ai/flows/daily-briefing-flow";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from "firebase/firestore";
import { formatDistanceToNowStrict } from "date-fns";

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
        return;
      }
      
      setIsBriefingLoading(true);
      setBriefingError(null);
      try {
        const nameForBriefing = user.displayName || user.email || "Crew Member";
        const briefingData = await generateDailyBriefing({ userName: nameForBriefing });
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
          .reduce((acc, current) => { // Remove duplicates by ID, preferring user-specific if ID is same
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
      setFeaturedTrainingsLoading(true);
      setFeaturedTrainingsError(null);
      try {
        // Try to get 2 mandatory courses first
        let q = query(
          collection(db, "courses"), 
          where("mandatory", "==", true), 
          orderBy("title"), // Or a 'priority' or 'createdAt' field if you add one
          limit(2)
        );
        let querySnapshot = await getDocs(q);
        let fetchedCourses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeaturedCourse));

        // If fewer than 2 mandatory courses, fetch any other courses to make up the difference
        if (fetchedCourses.length < 2) {
          const existingIds = fetchedCourses.map(c => c.id);
          const needed = 2 - fetchedCourses.length;
          
          q = query(
            collection(db, "courses"), 
            orderBy("title"), // Or a different order
            limit(needed + existingIds.length) // Fetch enough to potentially get new ones
          );
          querySnapshot = await getDocs(q);
          const additionalCourses = querySnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as FeaturedCourse))
            .filter(course => !existingIds.includes(course.id)) // Don't include already fetched mandatory ones
            .slice(0, needed);
          fetchedCourses = [...fetchedCourses, ...additionalCourses];
        }
        
        setFeaturedTrainings(fetchedCourses.slice(0, 2)); // Ensure max 2
      } catch (err) {
        console.error("Error fetching featured trainings:", err);
        setFeaturedTrainingsError("Failed to load featured trainings.");
        toast({ title: "Training Error", description: "Could not load featured trainings.", variant: "destructive" });
      } finally {
        setFeaturedTrainingsLoading(false);
      }
    }
    if (user) { // Only fetch if user is logged in, or adjust if trainings are public
        fetchFeaturedTrainings();
    } else {
        setFeaturedTrainingsLoading(false);
        setFeaturedTrainings([]); // No trainings if not logged in
    }
  }, [user, toast]);


  const upcomingDuty = {
    flightNumber: "BA245",
    route: "LHR - JFK",
    aircraft: "Boeing 787-9 (G-ZBKC)",
    reportingTime: "10:00 UTC",
    reportingDate: "July 31, 2024",
    reportingLocation: "Crew Report Centre, T5",
    etd: "12:30 UTC",
    eta: "15:00 EST (19:00 UTC)",
    gate: "C55 (LHR)",
  };

  const updates = [
    { id: 1, title: "New In-flight Service Standards: Long Haul", content: "Updated service flow for long-haul flights effective August 1st. See DOC-SVC-LH-0724.", date: "July 28, 2024" },
    { id: 2, title: "Security Awareness Bulletin", content: "Reminder: Report any suspicious activity immediately. See SEC-BUL-0724-02.", date: "July 26, 2024" },
    { id: 3, title: "Welcome New Cabin Crew Class!", content: "Let's extend a warm welcome to our 15 new cabin crew members graduating today from Batch 24-C.", date: "July 22, 2024" },
  ];

  const safetyTips = [
    { id: 1, tip: "Always perform thorough pre-flight safety checks on all emergency equipment in your assigned zone. Verify seals and accessibility." },
    { id: 2, tip: "In an emergency, remain calm, follow your training, and communicate clearly and assertively with passengers and fellow crew." },
    { id: 3, tip: "Maintain situational awareness at all times, especially during critical phases like boarding, takeoff, sterile flight deck, and landing." },
  ];

  const getAlertStyling = (level: Alert["level"]) => {
    switch (level) {
      case 'critical':
        return {
          border: 'border-destructive/50 bg-destructive/10',
          iconColor: 'text-destructive',
          titleColor: 'text-destructive',
        };
      case 'warning':
        return {
          border: 'border-yellow-500/50 bg-yellow-500/10',
          iconColor: 'text-yellow-600',
          titleColor: 'text-yellow-700',
        };
      case 'info':
      default:
        return {
          border: 'border-blue-500/50 bg-blue-500/10',
          iconColor: 'text-primary',
          titleColor: 'text-primary',
        };
    }
  };

  const getIconForAlert = (alert: Alert): LucideIcon => {
    if (alert.iconName) {
        if (alert.iconName.toLowerCase() === "briefcase") return Briefcase;
        if (alert.iconName.toLowerCase() === "graduationcap") return GraduationCap;
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

      <Card className="shadow-md hover:shadow-lg transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-medium font-headline flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Your AI Daily Briefing
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isBriefingLoading && (
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Generating your briefing...</span>
            </div>
          )}
          {briefingError && (
             <div className="flex items-center space-x-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span>{briefingError}</span>
            </div>
          )}
          {dailyBriefing && !isBriefingLoading && !briefingError && (
            <div
              className="prose prose-sm max-w-none dark:prose-invert text-foreground"
              dangerouslySetInnerHTML={{ __html: dailyBriefing.briefingMarkdown.replace(/\n/g, '<br />') }}
            />
          )}
          {!user && !isBriefingLoading && (
             <div className="flex items-center space-x-2 text-muted-foreground">
              <Info className="h-5 w-5" />
              <span>Log in to receive your personalized daily briefing.</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-6 md:gap-8">
        <Card className="md:col-span-2 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium font-headline">Upcoming Duty</CardTitle>
            <PlaneTakeoff className="h-6 w-6 text-primary" />
          </CardHeader>
          <CardContent className="space-y-3">
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
          </CardContent>
        </Card>

        <Card className="md:col-span-1 shadow-md hover:shadow-lg transition-shadow">
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
                  <Link href="/documents"><BookOpen className="mr-2 h-4 w-4"/>Access Flight Docs</Link>
                </Button>
                 <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href="/requests"><ArrowRight className="mr-2 h-4 w-4"/>Make a Request</Link>
                </Button>
            </CardContent>
        </Card>
      </div>
      
      <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium font-headline">Real-Time Alerts</CardTitle>
            <BellRing className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {alertsLoading && (
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading alerts...</span>
              </div>
            )}
            {alertsError && (
              <div className="flex items-center space-x-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <span>{alertsError}</span>
              </div>
            )}
            {!alertsLoading && !alertsError && alerts.length === 0 && (
              <p className="text-sm text-muted-foreground">No new alerts at this time.</p>
            )}
            {!alertsLoading && !alertsError && alerts.length > 0 && (
              <div className="space-y-3">
                {alerts.map((alert) => {
                  const IconComponent = getIconForAlert(alert);
                  const styles = getAlertStyling(alert.level);
                  const timeAgo = formatDistanceToNowStrict(alert.createdAt.toDate(), { addSuffix: true });
                  
                  return (
                  <div key={alert.id} className={`flex items-start space-x-3 p-3 rounded-md border ${styles.border}`}>
                    <IconComponent className={`h-5 w-5 mt-1 shrink-0 ${styles.iconColor}`} />
                    <div>
                      <p className={`font-semibold ${styles.titleColor}`}>{alert.title}</p>
                      <p className="text-sm text-muted-foreground">{alert.content}</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">{timeAgo}</p>
                    </div>
                  </div>
                )})}
              </div>
            )}
             <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
                <Link href="#">View All Alerts <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>
      
      <Card className="shadow-md hover:shadow-lg transition-shadow">
        <CardHeader>
            <CardTitle className="font-headline flex items-center"><ShieldCheck className="mr-2 h-6 w-6 text-green-600"/>Safety & Best Practice Tips</CardTitle>
            <CardDescription>Key reminders for maintaining safety and excellence.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
            {safetyTips.slice(0,2).map((tip) => (
                <div key={tip.id} className="flex items-start gap-3 p-3 border-l-4 border-green-500 bg-green-500/10 rounded-r-md">
                    <ShieldCheck className="h-5 w-5 text-green-600 mt-0.5 shrink-0"/>
                    <p className="text-sm text-green-700 dark:text-green-300">{tip.tip}</p>
                </div>
            ))}
             <Button variant="link" className="p-0 h-auto text-sm" asChild>
              <Link href="/documents?category=safety">More Safety Information</Link>
            </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
         <Card className="md:col-span-2 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="font-headline">Key Updates & Announcements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {updates.map((update) => (
              <div key={update.id} className="pb-3 border-b last:border-b-0">
                <h3 className="font-semibold">{update.title}</h3>
                <p className="text-sm text-muted-foreground">{update.content}</p>
                <p className="text-xs text-muted-foreground/80 mt-1">{update.date}</p>
              </div>
            ))}
             <Button variant="link" className="p-0 h-auto text-sm" asChild>
                <Link href="#">Read more updates</Link>
             </Button>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow md:col-span-1">
            <CardHeader>
                <CardTitle className="font-headline">Featured Training</CardTitle>
                <CardDescription>Mandatory & recommended courses.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {featuredTrainingsLoading && (
                <div className="flex items-center space-x-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Loading featured trainings...</span>
                </div>
              )}
              {featuredTrainingsError && (
                <div className="flex items-center space-x-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  <span>{featuredTrainingsError}</span>
                </div>
              )}
              {!featuredTrainingsLoading && !featuredTrainingsError && featuredTrainings.length === 0 && user && (
                <p className="text-sm text-muted-foreground">No featured trainings available at this time.</p>
              )}
               {!featuredTrainingsLoading && !featuredTrainingsError && !user && (
                <p className="text-sm text-muted-foreground">Log in to see featured trainings.</p>
              )}
              {!featuredTrainingsLoading && !featuredTrainingsError && featuredTrainings.map((course) => (
                <div key={course.id} className="flex items-center gap-4 p-3 border rounded-lg bg-card">
                  <Image 
                    src={`https://placehold.co/100x100.png`} 
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
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
