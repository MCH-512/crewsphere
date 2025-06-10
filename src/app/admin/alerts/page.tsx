
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp, doc, deleteDoc } from "firebase/firestore";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";
import { MessageSquareWarning, Loader2, AlertTriangle, RefreshCw, Edit, Trash2, PlusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import Link from "next/link";

interface AlertDocument {
  id: string;
  title: string;
  content: string;
  level: "info" | "warning" | "critical";
  userId?: string | null;
  iconName?: string | null;
  createdAt: Timestamp;
  createdBy: string;
}

export default function AdminAlertsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [alerts, setAlerts] = React.useState<AlertDocument[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  // const [alertToDelete, setAlertToDelete] = React.useState<AlertDocument | null>(null); // Keep for AlertDialog state management

  const fetchAlerts = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const q = query(collection(db, "alerts"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedAlerts = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as AlertDocument));
      setAlerts(fetchedAlerts);
    } catch (err) {
      console.error("Error fetching alerts:", err);
      setError("Failed to load alerts. Please try again.");
      toast({ title: "Loading Error", description: "Could not fetch alerts.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'admin') {
        router.push('/'); 
      } else {
        fetchAlerts();
      }
    }
  }, [user, authLoading, router, fetchAlerts]);

  const handleDeleteAlert = async (alertToDelete: AlertDocument) => {
    if (!alertToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "alerts", alertToDelete.id));
      toast({ title: "Alert Deleted", description: `Alert "${alertToDelete.title}" has been successfully deleted.` });
      fetchAlerts(); 
    } catch (error) {
      console.error("Error deleting alert:", error);
      toast({ title: "Deletion Failed", description: "Could not delete the alert. Please try again.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const getLevelBadgeVariant = (level: AlertDocument["level"]): "destructive" | "default" | "secondary" | "outline" => {
    switch (level) {
      case "critical": return "destructive";
      case "warning": return "default";
      case "info": return "secondary";
      default: return "outline";
    }
  };

  if (authLoading || (isLoading && alerts.length === 0 && !user)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading alerts...</p>
      </div>
    );
  }
  
  if (!user || user.role !== 'admin') {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <CardTitle className="text-xl mb-2">Access Denied</CardTitle>
        <p className="text-muted-foreground">You do not have permission to view this page.</p>
        <Button onClick={() => router.push('/')} className="mt-4">Go to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row justify-between items-start">
          <div>
            <CardTitle className="text-2xl font-headline flex items-center">
              <MessageSquareWarning className="mr-3 h-7 w-7 text-primary" />
              All Broadcast Alerts
            </CardTitle>
            <CardDescription>View all alerts that have been sent to users.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchAlerts} disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Alerts
            </Button>
            <Button asChild>
              <Link href="/admin/alerts/create">
                <PlusCircle className="mr-2 h-4 w-4" /> Create New Alert
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="p-4 mb-4 text-sm text-destructive-foreground bg-destructive rounded-md flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> {error}
            </div>
          )}
          {isLoading && alerts.length === 0 && (
             <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Loading alert list...</p>
            </div>
          )}
          {!isLoading && alerts.length === 0 && !error && (
            <p className="text-muted-foreground text-center py-8">No alerts found. Click the "Create New Alert" button to add one.</p>
          )}
          {alerts.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Icon</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map((alert) => (
                    <TableRow key={alert.id}>
                      <TableCell className="font-medium max-w-xs truncate" title={alert.title}>{alert.title}</TableCell>
                      <TableCell>
                        <Badge 
                            variant={getLevelBadgeVariant(alert.level)}
                        >
                          {alert.level.charAt(0).toUpperCase() + alert.level.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>{alert.userId ? `User: ${alert.userId.substring(0,10)}...` : "Global"}</TableCell>
                      <TableCell>{alert.iconName || 'N/A'}</TableCell>
                      <TableCell>{format(alert.createdAt.toDate(), "PPp")}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/admin/alerts/edit/${alert.id}`} aria-label={`Edit alert: ${alert.title}`}>
                            <Edit className="mr-1 h-4 w-4" /> Edit
                          </Link>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                           <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive/80" aria-label={`Delete alert: ${alert.title}`}>
                            <Trash2 className="mr-1 h-4 w-4" /> Delete
                          </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete the alert: "{alert.title}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteAlert(alert)} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
           <CardDescription className="mt-4 text-xs">
            Content of alerts is not shown in this table for brevity. Full content is visible to users on their dashboards.
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}
