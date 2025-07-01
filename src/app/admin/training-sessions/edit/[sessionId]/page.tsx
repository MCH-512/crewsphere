
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertTriangle, CheckCircle, Save, Edit3, School } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import { format } from "date-fns";
import { logAuditEvent } from "@/lib/audit-logger";
import { trainingSessionFormSchema, type TrainingSessionFormValues, type StoredTrainingSession } from "@/schemas/training-session-schema";
import { Textarea } from "@/components/ui/textarea";

export default function EditTrainingSessionPage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<TrainingSessionFormValues>({
    resolver: zodResolver(trainingSessionFormSchema),
  });
  
  const toDatetimeLocalInputString = (isoString: string): string => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      // Format to "yyyy-MM-ddTHH:mm"
      return format(date, "yyyy-MM-dd'T'HH:mm");
    } catch (e) {
      console.warn("Error formatting date for input:", e);
      return "";
    }
  };


  React.useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/');
      toast({ title: "Access Denied", description: "You need admin privileges to access this page.", variant: "destructive"});
      return;
    }

    if (sessionId && user && user.role === 'admin') {
      const fetchSessionData = async () => {
        setIsLoadingData(true);
        try {
          const sessionDocRef = doc(db, "trainingSessions", sessionId);
          const sessionSnap = await getDoc(sessionDocRef);

          if (!sessionSnap.exists()) {
            toast({ title: "Not Found", description: "Session data could not be found.", variant: "destructive" });
            router.push("/admin/training-sessions");
            return;
          }
          const sessionData = sessionSnap.data() as StoredTrainingSession;
          form.reset({
            title: sessionData.title,
            location: sessionData.location,
            venue: sessionData.venue,
            instructor: sessionData.instructor,
            sessionDateTimeUTC: toDatetimeLocalInputString(sessionData.sessionDateTimeUTC),
            durationHours: sessionData.durationHours,
            notes: sessionData.notes || "",
          });
        } catch (error) {
          console.error("Error loading session data:", error);
          toast({ title: "Loading Error", description: "Failed to load session data for editing.", variant: "destructive" });
          router.push("/admin/training-sessions");
        } finally {
          setIsLoadingData(false);
        }
      };
      fetchSessionData();
    }
  }, [sessionId, user, authLoading, router, toast, form]);

  async function onSubmit(data: TrainingSessionFormValues) {
    if (!user || user.role !== 'admin' || !sessionId) {
      toast({ title: "Unauthorized or Missing ID", description: "Cannot update session.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const sessionDocRef = doc(db, "trainingSessions", sessionId);
      const updatePayload = {
        ...data,
        sessionDateTimeUTC: new Date(data.sessionDateTimeUTC).toISOString(),
        updatedAt: serverTimestamp(),
      };
      await updateDoc(sessionDocRef, updatePayload);

      await logAuditEvent({
        userId: user.uid,
        userEmail: user.email || "N/A",
        actionType: "UPDATE_TRAINING_SESSION",
        entityType: "TRAINING_SESSION",
        entityId: sessionId,
        details: { title: data.title, instructor: data.instructor },
      });

      toast({
        title: "Session Updated Successfully",
        description: `The session "${data.title}" has been updated.`,
        action: <CheckCircle className="text-green-500" />,
      });
      router.push('/admin/training-sessions');
    } catch (error) {
      console.error("Error updating session in Firestore:", error);
      toast({ title: "Update Failed", description: "Could not update the session. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authLoading || isLoadingData) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
         <p className="ml-3 text-muted-foreground">Loading session data...</p>
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
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Edit3 className="mr-3 h-7 w-7 text-primary" />
            Edit Training Session
          </CardTitle>
          <CardDescription>
            Modify the details of this training session. All times are in UTC.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Session Title</FormLabel><FormControl><Input placeholder="e.g., CRM Recurrent Training" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="instructor" render={({ field }) => (<FormItem><FormLabel>Instructor</FormLabel><FormControl><Input placeholder="e.g., Jane Doe" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="durationHours" render={({ field }) => (<FormItem><FormLabel>Duration (Hours)</FormLabel><FormControl><Input type="number" step="0.5" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="location" render={({ field }) => (<FormItem><FormLabel>Location</FormLabel><FormControl><Input placeholder="e.g., Training Center Tunis" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="venue" render={({ field }) => (<FormItem><FormLabel>Venue / Room</FormLabel><FormControl><Input placeholder="e.g., Room 301, Simulator B" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="sessionDateTimeUTC" render={({ field }) => (<FormItem><FormLabel>Session Date & Time (UTC)</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormDescription>Date and Time in UTC</FormDescription><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Textarea placeholder="Add any additional details, prerequisites, or notes for attendees..." {...field} /></FormControl><FormMessage /></FormItem>)} />
              
              <Button type="submit" disabled={isSubmitting || !form.formState.isValid} className="w-full sm:w-auto">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
