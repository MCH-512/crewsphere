
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
import { Loader2, AlertTriangle, CheckCircle, PlusCircle, School } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { logAuditEvent } from "@/lib/audit-logger";
import { trainingSessionFormSchema, type TrainingSessionFormValues } from "@/schemas/training-session-schema";
import { Textarea } from "@/components/ui/textarea";

const defaultValues: Partial<TrainingSessionFormValues> = {
  title: "",
  location: "",
  venue: "",
  instructor: "",
  sessionDateTimeUTC: "",
  durationHours: 1,
  notes: "",
};

export default function CreateTrainingSessionPage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<TrainingSessionFormValues>({
    resolver: zodResolver(trainingSessionFormSchema),
    defaultValues,
    mode: "onChange",
  });

  React.useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/');
      toast({ title: "Access Denied", description: "You need admin privileges to access this page.", variant: "destructive"});
    }
  }, [user, authLoading, router, toast]);

  async function onSubmit(data: TrainingSessionFormValues) {
    if (!user || user.role !== 'admin') {
      toast({ title: "Unauthorized", description: "You do not have permission to create sessions.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    
    try {
      const sessionData = {
        ...data,
        sessionDateTimeUTC: new Date(data.sessionDateTimeUTC).toISOString(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user.uid,
      };

      const docRef = await addDoc(collection(db, "trainingSessions"), sessionData);
      
      await logAuditEvent({
        userId: user.uid,
        userEmail: user.email || "N/A",
        actionType: "CREATE_TRAINING_SESSION",
        entityType: "TRAINING_SESSION",
        entityId: docRef.id,
        details: { title: data.title, location: data.location },
      });

      toast({
        title: "Session Created Successfully",
        description: `The training session "${data.title}" has been scheduled.`,
        action: <CheckCircle className="text-green-500" />,
      });
      form.reset();
      router.push('/admin/training-sessions'); 
    } catch (error) {
        console.error("Error creating training session:", error);
        toast({ title: "Creation Failed", description: "Could not create the session. Please try again.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  }

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
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
            <School className="mr-3 h-7 w-7 text-primary" />
            Create New Training Session
          </CardTitle>
          <CardDescription>
            Schedule a new in-person training session. All times must be entered in UTC.
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
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating Session...</>
                ) : (
                  <><PlusCircle className="mr-2 h-4 w-4" />Create Session</>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
