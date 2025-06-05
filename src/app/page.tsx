import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, CalendarClock, BellRing, Annoyed, AlertTriangle, Info } from "lucide-react";
import Image from "next/image";

export default function DashboardPage() {
  const alerts = [
    { id: 1, title: "Gate Change: Flight BA245", content: "Flight BA245 to London now departs from Gate C12 instead of A5.", level: "warning", time: "10m ago", icon: AlertTriangle },
    { id: 2, title: "System Maintenance", content: "Brief system outage scheduled for 02:00 UTC tonight. Document access may be limited.", level: "info", time: "1h ago", icon: Info },
    { id: 3, title: "Mandatory Safety Briefing", content: "All cabin crew attend briefing on new safety procedures. See schedule.", level: "critical", time: "3h ago", icon: Annoyed },
  ];

  const updates = [
    { id: 1, title: "New Catering Options", content: "Updated menu for transatlantic flights effective August 1st.", date: "July 28, 2024" },
    { id: 2, title: "Uniform Policy Update", content: "Minor adjustments to uniform guidelines. See Document ID: UPL-2024-03.", date: "July 25, 2024" },
    { id: 3, title: "Welcome New Hires!", content: "Let's welcome our 5 new cabin crew members joining this week.", date: "July 22, 2024" },
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
            <CardTitle className="text-lg font-medium font-headline">Upcoming Schedule</CardTitle>
            <CalendarClock className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">FLT101 - JFK</div>
            <p className="text-xs text-muted-foreground">Departure: 14:30 | July 30, 2024</p>
            <Button variant="outline" size="sm" className="mt-4 w-full">
              View Full Schedule <ArrowRight className="ml-2 h-4 w-4" />
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
            <CardContent className="grid grid-cols-2 gap-4">
                <Button variant="default" className="w-full">Report Incident</Button>
                <Button variant="outline" className="w-full">Request Leave</Button>
                <Button variant="outline" className="w-full">View Payslip</Button>
                <Button variant="outline" className="w-full">Access Helpdesk</Button>
            </CardContent>
        </Card>
      </div>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline">Featured Training</CardTitle>
          <CardDescription>Enhance your skills with our latest courses.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div className="flex items-center gap-4 p-4 border rounded-lg bg-card">
            <Image src="https://placehold.co/100x100.png" alt="Course thumbnail" width={80} height={80} className="rounded-md" data-ai-hint="safety procedure" />
            <div>
              <h3 className="font-semibold">Advanced Safety Procedures</h3>
              <p className="text-sm text-muted-foreground">Master the latest emergency protocols.</p>
              <Button size="sm" className="mt-2">Enroll Now</Button>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 border rounded-lg bg-card">
            <Image src="https://placehold.co/100x100.png" alt="Course thumbnail" width={80} height={80} className="rounded-md" data-ai-hint="customer service" />
            <div>
              <h3 className="font-semibold">Exceptional Customer Service</h3>
              <p className="text-sm text-muted-foreground">Techniques for superior passenger experience.</p>
              <Button size="sm" className="mt-2">Enroll Now</Button>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
