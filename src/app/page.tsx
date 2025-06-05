
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, CalendarClock, BellRing, Info, Briefcase, GraduationCap, ShieldCheck, FileText, BookOpen } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function DashboardPage() {
  const alerts = [
    { id: 1, title: "Pre-Flight Briefing: Flight BA245", content: "Briefing scheduled for 12:00 UTC in Crew Room C.", level: "critical", time: "Upcoming", icon: Briefcase },
    { id: 2, title: "Reminder: SEP Refresher Due", content: "Your Safety & Emergency Procedures refresher must be completed by Aug 15th.", level: "warning", time: "2w remaining", icon: GraduationCap },
    { id: 3, title: "New Company Bulletin Issued", content: "Updated Unaccompanied Minors Policy (Doc ID: BUL-2024-08). Please review.", level: "info", time: "1d ago", icon: Info },
  ];

  const updates = [
    { id: 1, title: "New In-flight Service Standards", content: "Updated service flow for long-haul flights effective August 1st. See DOC-SVC-0724.", date: "July 28, 2024" },
    { id: 2, title: "Uniform Grooming Standards Reminder", content: "Please ensure adherence to the latest grooming guidelines (Doc ID: UGS-2024-01).", date: "July 25, 2024" },
    { id: 3, title: "Welcome New Cabin Crew Class!", content: "Let's extend a warm welcome to our 12 new cabin crew members graduating today.", date: "July 22, 2024" },
  ];

  const safetyTips = [
    { id: 1, tip: "Always perform thorough pre-flight safety checks on all emergency equipment in your assigned zone." },
    { id: 2, tip: "In an emergency, remain calm, follow your training, and communicate clearly with passengers and fellow crew." },
    { id: 3, tip: "Maintain situational awareness at all times, especially during critical phases of flight like boarding, takeoff, and landing." },
  ];

  return (
    <div className="grid gap-6 md:gap-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Welcome to AirCrew Hub</CardTitle>
          <CardDescription>Your central command for flight operations, documents, and training.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Quickly access your schedule, important updates, and manage your professional development all in one place.
          </p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        <Card className="lg:col-span-1 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium font-headline">Upcoming Duty</CardTitle>
            <CalendarClock className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">FLT101 - JFK</div>
            <p className="text-xs text-muted-foreground">Report: 13:00 | July 30, 2024</p>
            <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
              <Link href="/schedule">
                View Full Roster <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium font-headline">Real-Time Alerts</CardTitle>
            <BellRing className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.slice(0,2).map((alert) => {
                const Icon = alert.icon;
                return (
                <div key={alert.id} className={`flex items-start space-x-3 p-3 rounded-md border ${alert.level === 'critical' ? 'border-destructive/50 bg-destructive/10' : alert.level === 'warning' ? 'border-yellow-500/50 bg-yellow-500/10' : 'border-blue-500/50 bg-blue-500/10'}`}>
                  <Icon className={`h-5 w-5 mt-1 ${alert.level === 'critical' ? 'text-destructive' : alert.level === 'warning' ? 'text-yellow-600' : 'text-primary'}`} />
                  <div>
                    <p className={`font-semibold ${alert.level === 'critical' ? 'text-destructive' : ''}`}>{alert.title}</p>
                    <p className="text-sm text-muted-foreground">{alert.content}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">{alert.time}</p>
                  </div>
                </div>
              )})}
            </div>
             <Button variant="outline" size="sm" className="mt-4 w-full">
              View All Alerts <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
      
      <Card className="shadow-md hover:shadow-lg transition-shadow">
        <CardHeader>
            <CardTitle className="font-headline flex items-center"><ShieldCheck className="mr-2 h-6 w-6 text-green-600"/>Safety Tips</CardTitle>
            <CardDescription>Stay sharp with these key safety reminders.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
            {safetyTips.slice(0,2).map((tip) => (
                <div key={tip.id} className="flex items-start gap-3 p-3 border-l-4 border-green-500 bg-green-500/10 rounded-r-md">
                    <ShieldCheck className="h-5 w-5 text-green-600 mt-0.5 shrink-0"/>
                    <p className="text-sm text-green-700">{tip.tip}</p>
                </div>
            ))}
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
             <Button variant="link" className="p-0 h-auto">Read more updates</Button>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
                <CardTitle className="font-headline">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Button variant="default" className="w-full" asChild>
                  <Link href="/purser-reports"><FileText className="mr-2 h-4 w-4"/>Submit Report</Link>
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/schedule"><CalendarClock className="mr-2 h-4 w-4"/>View Roster</Link>
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/documents"><BookOpen className="mr-2 h-4 w-4"/>Flight Docs</Link>
                </Button>
                 <Button variant="outline" className="w-full" asChild>
                  <Link href="/requests"><ArrowRight className="mr-2 h-4 w-4"/>Make Request</Link>
                </Button>
            </CardContent>
        </Card>
      </div>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline">Featured Training</CardTitle>
          <CardDescription>Enhance your skills with our latest courses. Mandatory items are highlighted.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div className="flex items-center gap-4 p-4 border rounded-lg bg-card">
            <Image src="https://placehold.co/100x100.png" alt="Course thumbnail" width={80} height={80} className="rounded-md" data-ai-hint="emergency slide" />
            <div>
              <h3 className="font-semibold">SEP - Evacuation Drills (Recurrent)</h3>
              <p className="text-sm text-muted-foreground">Annual recurrent training for emergency evacuation.</p>
              <Button size="sm" className="mt-2" asChild><Link href="/training">Go to Training</Link></Button>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 border rounded-lg bg-card">
            <Image src="https://placehold.co/100x100.png" alt="Course thumbnail" width={80} height={80} className="rounded-md" data-ai-hint="first aid" />
            <div>
              <h3 className="font-semibold">Advanced First Aid Techniques</h3>
              <p className="text-sm text-muted-foreground">Handling common in-flight medical situations.</p>
              <Button size="sm" className="mt-2" asChild><Link href="/training">Go to Training</Link></Button>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
