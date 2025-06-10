
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquareWarning, Loader2, AlertTriangle, CheckCircle, Edit3 as EditIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";

const alertFormSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters.").max(100),
  content: z.string().min(10, "Content must be at least 10 characters.").max(500),
  level: z.enum(["info", "warning", "critical"], { required_error: "Please select an alert level." }),
  userId: z.string().max(50).optional().describe("Firebase UID of a specific user, or leave blank for global."),
  iconName: z.string().max(50).optional().describe("Lucide icon name (e.g., BellRing, PlaneTakeoff)."),
});

type AlertFormValues = z.infer<typeof alertFormSchema>;

interface AlertDocumentForEdit {
  id: string;
  title: string;
  content: string;
  level: "info" | "warning" | "critical";
  userId?: string | null;
  iconName?: string | null;
  createdAt: Timestamp;
  createdBy: string;
}


export default function EditAlertPage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const alertId = params.alertId as string;

  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<AlertFormValues>({
    resolver: zodResolver(alertFormSchema),
    defaultValues: {
      title: "",
      content: "",
      level: "info",
      userId: "",
      iconName: "",
    },
  });

  React.useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/');
      toast({ title: "Access Denied", description: "You need admin privileges to access this page.", variant: "destructive"});
      return;
    }

    if (alertId && user && user.role === 'admin') {
      const fetchAlertData = async () => {
        setIsLoadingData(true);
        try {
          const alertDocRef = doc(db, "alerts", alertId);
          const alertSnap = await getDoc(alertDocRef);

          if (!alertSnap.exists()) {
            toast({ title: "Not Found", description: "Alert data could not be found.", variant: "destructive" });
            router.push("/admin/alerts");
            return;
          }
          const alertData = alertSnap.data() as Omit<AlertDocumentForEdit, 'id'>;
          form.reset({
            title: alertData.title,
            content: alertData.content,
            level: alertData.level,
            userId: alertData.userId || "",
            iconName: alertData.iconName || "",
          });
        } catch (error) {
          console.error("Error loading alert data:", error);
          toast({ title: "Loading Error", description: "Failed to load alert data for editing.", variant: "destructive" });
          router.push("/admin/alerts");
        } finally {
          setIsLoadingData(false);
        }
      };
      fetchAlertData();
    }
  }, [alertId, user, authLoading, router, toast, form]);

  async function onSubmit(data: AlertFormValues) {
    if (!user || user.role !== 'admin' || !alertId) {
      toast({ title: "Unauthorized or Missing ID", description: "Cannot update alert.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const alertDocRef = doc(db, "alerts", alertId);
      await updateDoc(alertDocRef, {
        title: data.title,
        content: data.content,
        level: data.level,
        userId: data.userId || null,
        iconName: data.iconName || null,
        updatedAt: serverTimestamp(), // Add an updatedAt field if you want to track updates
      });

      toast({
        title: "Alert Updated Successfully",
        description: `The alert "${data.title}" has been updated.`,
        action: <CheckCircle className="text-green-500" />,
      });
      router.push('/admin/alerts');
    } catch (error) {
      console.error("Error updating alert in Firestore:", error);
      toast({ title: "Update Failed", description: "Could not update the alert. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authLoading || isLoadingData) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
         <p className="ml-3 text-muted-foreground">Loading alert data...</p>
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
            <EditIcon className="mr-3 h-7 w-7 text-primary" />
            Edit Alert
          </CardTitle>
          <CardDescription>
            Modify the details of the existing alert.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alert Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., System Maintenance Scheduled" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alert Content</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Detailed message for the alert..."
                        className="min-h-[120px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Alert Level</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select alert severity" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="info">Info (Blue)</SelectItem>
                          <SelectItem value="warning">Warning (Yellow)</SelectItem>
                          <SelectItem value="critical">Critical (Red)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="iconName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Icon Name (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., BellRing, PlaneTakeoff" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormDescription>Lucide icon name. Defaults by level if blank.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target User ID (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter specific Firebase User ID" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormDescription>Leave blank to send this alert to all users (global alert).</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
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
