
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ServerCog, Users, Settings, Activity, Files, UploadCloud, Eye, GraduationCap, BookOpen, BarChart3, ClipboardList, BellRing, Plane, PlusCircle } from "lucide-react";

export default function AdminConsolePage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-start gap-4">
          <ServerCog className="h-8 w-8 text-primary mt-1" />
          <div>
            <CardTitle className="text-2xl font-headline">Admin Console</CardTitle>
            <CardDescription>
              Manage application settings, users, documents, training, courses, requests, flights, and system health.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Welcome to the Admin Console. Administrative features and tools will be available here.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <Users className="h-6 w-6 text-primary" />
                <CardTitle className="text-lg">User Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">View and manage user accounts, roles, and permissions.</p>
                <Button variant="outline" size="sm">Manage Users</Button>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <Files className="h-6 w-6 text-primary" />
                <CardTitle className="text-lg">Document Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Upload, categorize, and manage all shared documents and manuals.</p>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm"><UploadCloud className="mr-2 h-4 w-4" />Upload New</Button>
                    <Button variant="ghost" size="sm"><Eye className="mr-2 h-4 w-4" />View All</Button>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <BookOpen className="h-6 w-6 text-primary" />
                <CardTitle className="text-lg">Courses Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Create, update, and organize training courses, modules, and learning materials.</p>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm"><PlusCircle className="mr-2 h-4 w-4" />Create New Course</Button>
                    <Button variant="ghost" size="sm"><Eye className="mr-2 h-4 w-4" />View All Courses</Button>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <GraduationCap className="h-6 w-6 text-primary" />
                <CardTitle className="text-lg">Training Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Assign training to users, track completion, and manage certifications.</p>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm">Assign Training</Button>
                    <Button variant="ghost" size="sm"><BarChart3 className="mr-2 h-4 w-4" />View Progress</Button>
                </div>
              </CardContent>
            </Card>
             <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <ClipboardList className="h-6 w-6 text-primary" />
                <CardTitle className="text-lg">User Request Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Review, manage, and respond to user-submitted requests (e.g., leave, schedule changes).
                </p>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm"><Eye className="mr-2 h-4 w-4" />View All Requests</Button>
                    <Button variant="default" size="sm"><BellRing className="mr-2 h-4 w-4" />Pending (3)</Button>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <Plane className="h-6 w-6 text-primary" />
                <CardTitle className="text-lg">Flight Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Manage flight schedules: flight numbers, dates, departure/arrival airports, ETD/ETA.
                </p>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm">View Schedule</Button>
                    <Button variant="default" size="sm">Add New Flight</Button>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <Settings className="h-6 w-6 text-primary" />
                <CardTitle className="text-lg">System Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Configure application-wide settings and integrations.</p>
                <Button variant="outline" size="sm">Configure Settings</Button>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <Activity className="h-6 w-6 text-primary" />
                <CardTitle className="text-lg">Audit Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Review system activity, changes, and important events.</p>
                 <Button variant="outline" size="sm">View Logs</Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
