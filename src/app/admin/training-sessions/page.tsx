
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, doc, deleteDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { School, Loader2, AlertTriangle, RefreshCw, Edit, Trash2, PlusCircle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { logAuditEvent } from "@/lib/audit-logger";
import { StoredTrainingSession } from "@/schemas/training-session-schema";

export default function AdminTrainingSessionsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [sessions, setSessions] = React.useState<StoredTrainingSession[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [sessionToDelete, setSessionToDelete] = React.useState<StoredTrainingSession | null>(null);

  const fetchSessions = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const q = query(collection(db, "trainingSessions"), orderBy("sessionDateTimeUTC", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedSessions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as StoredTrainingSession));
      setSessions(fetchedSessions);
    } catch (err) {
      console.error("Error fetching sessions:", err);
      setError("Failed to load training sessions. Please try again.");
      toast({ title: "Loading Error", description: "Could not fetch sessions.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'admin') {
        router.push('/'); 
      } else {
        fetchSessions();
      }
    }
  }, [user, authLoading, router, fetchSessions]);

  const handleDeleteSession = async () => {
    if (!sessionToDelete || !user) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "trainingSessions", sessionToDelete.id));
      
      await logAuditEvent({
        userId: user.uid,
        userEmail: user.email || "N/A",
        actionType: "DELETE_TRAINING_SESSION",
        entityType: "TRAINING_SESSION",
        entityId: sessionToDelete.id,
        details: { title: sessionToDelete.title, instructor: sessionToDelete.instructor },
      });

      toast({ title: "Session Deleted", description: `Session "${sessionToDelete.title}" has been deleted.` });
      fetchSessions(); 
      setSessionToDelete(null); 
    } catch (error) {
      console.error("Error deleting session:", error);
      toast({ title: "Deletion Failed", description: "Could not delete the session. Please try again.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };
  
  const formatDateTime = (isoString: string) => {
    try {
      return format(new Date(isoString), "MMM d, yyyy HH:mm 'UTC'");
    } catch (e) {
      return "Invalid Date";
    }
  };

  if (authLoading || (isLoading && sessions.length === 0 && !user)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading sessions...</p>
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
    <TooltipProvider>
      <div className="space-y-6">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row justify-between items-start">
            <div>
              <CardTitle className="text-2xl font-headline flex items-center">
                <School className="mr-3 h-7 w-7 text-primary" />
                Manage Training Sessions
              </CardTitle>
              <CardDescription>View, create, and manage all in-person training sessions.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchSessions} disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh Sessions
              </Button>
              <Button asChild>
                <Link href="/admin/training-sessions/create">
                  <PlusCircle className="mr-2 h-4 w-4" /> Create New Session
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
            {isLoading && sessions.length === 0 && (
               <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="ml-3 text-muted-foreground">Loading session list...</p>
              </div>
            )}
            {!isLoading && sessions.length === 0 && !error && (
              <p className="text-muted-foreground text-center py-8">No training sessions found. Click the "Create New Session" button to add one.</p>
            )}
            {sessions.length > 0 && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Instructor</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Date & Time (UTC)</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell className="font-medium">{session.title}</TableCell>
                        <TableCell>{session.instructor}</TableCell>
                        <TableCell>{session.location} ({session.venue})</TableCell>
                        <TableCell>{formatDateTime(session.sessionDateTimeUTC)}</TableCell>
                        <TableCell>{session.durationHours}h</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" asChild aria-label={`Edit session: ${session.title}`}>
                                <Link href={`/admin/training-sessions/edit/${session.id}`}>
                                  <Edit className="mr-1 h-4 w-4" /> Edit
                                </Link>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Edit session: {session.title}</p></TooltipContent>
                          </Tooltip>
                          <AlertDialog>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertDialogTrigger asChild>
                                 <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive/80" onClick={() => setSessionToDelete(session)} aria-label={`Delete session: ${session.title}`}>
                                  <Trash2 className="mr-1 h-4 w-4" /> Delete
                                </Button>
                                </AlertDialogTrigger>
                              </TooltipTrigger>
                              <TooltipContent><p>Delete session: {session.title}</p></TooltipContent>
                            </Tooltip>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete the session "{sessionToDelete?.title}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setSessionToDelete(null)} disabled={isDeleting}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteSession} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
