
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert as ShadAlert, AlertDescription as ShadAlertDescription, AlertTitle as ShadAlertTitle } from "@/components/ui/alert";
import { ArrowRight, CalendarClock, BellRing, Info, Briefcase, GraduationCap, ShieldCheck, FileText, BookOpen, PlaneTakeoff, AlertTriangle, CheckCircle, Sparkles, Loader2, LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { generateDailyBriefing, type DailyBriefingOutput } from "@/ai/flows/daily-briefing-flow";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, limit, getDocs, Timestamp, or, doc, getDoc } from "firebase/firestore";
import { formatDistanceToNowStrict } from "date-fns";
import ReactMarkdown from "react-markdown";
import { AnimatedCard } from "@/components/motion/animated-card";

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

  const getAlertVariant = (level: Alert["level"]): "default" | "destructive" => {
    switch (level) {
      case 'critical':
        return 'destructive';
      case 'warning':
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
              >
                <ReactMarkdown>{dailyBriefing.briefingMarkdown}</ReactMarkdown>
              </div>
            )}
            {!user && !isBriefingLoading && (
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
                    <Link href="/documents"><BookOpen className="mr-2 h-4 w-4"/>Access Flight Docs</Link>
                  </Button>
                   <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/requests"><ArrowRight className="mr-2 h-4 w-4"/>Make a Request</Link>
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
              {alertsLoading && (
                <div className="flex items-center space-x-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Loading alerts...</span>
                </div>
              )}
              {alertsError && (
                <ShadAlert variant="destructive" className="mb-4">
                    <AlertTriangle className="h-5 w-5" />
                    <ShadAlertTitle>Error</ShadAlertTitle>
                    <ShadAlertDescription>{alertsError}</ShadAlertDescription>
                </ShadAlert>
              )}
              {!alertsLoading && !alertsError && alerts.length === 0 && (
                <p className="text-sm text-muted-foreground">No new alerts at this time.</p>
              )}
              {!alertsLoading && !alertsError && alerts.length > 0 && (
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
      </AnimatedCard>

      <div className="grid gap-6 md:grid-cols-3">
         <AnimatedCard delay={0.4} className="md:col-span-2">
           <Card className="h-full shadow-md hover:shadow-lg transition-shadow">
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
        </AnimatedCard>

        <AnimatedCard delay={0.45} className="md:col-span-1">
          <Card className="h-full shadow-md hover:shadow-lg transition-shadow">
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
                  <p className="text-sm text-muted-foreground">No featured trainings available for you at this time.</p>
                )}
                 {!featuredTrainingsLoading && !featuredTrainingsError && !user && (
                  <p className="text-sm text-muted-foreground">Log in to see featured trainings.</p>
                )}
                {!featuredTrainingsLoading && !featuredTrainingsError && featuredTrainings.map((course) => (
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
              </CardContent>
          </Card>
        </AnimatedCard>
      </div>
    </div>
  );
}
