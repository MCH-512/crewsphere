
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Loader2, AlertTriangle, CheckCircle, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { AnimatedCard } from "@/components/motion/animated-card";
import { logAuditEvent } from "@/lib/audit-logger";

const systemSettingsSchema = z.object({
  appName: z.string().min(3, "App name must be at least 3 characters.").max(50, "App name cannot exceed 50 characters.").default("Crew World"),
  maintenanceMode: z.boolean().default(false),
  supportEmail: z.string().email("Invalid email address.").min(5, "Support email is required."),
});

type SystemSettingsFormValues = z.infer<typeof systemSettingsSchema>;

const SETTINGS_DOC_ID = "appSettings";
const SETTINGS_COLLECTION = "systemConfiguration";

export default function SystemSettingsPage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<SystemSettingsFormValues>({
    resolver: zodResolver(systemSettingsSchema),
    defaultValues: {
      appName: "Crew World",
      maintenanceMode: false,
      supportEmail: "",
    },
  });

  React.useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      toast({ title: "Access Denied", description: "You need admin privileges to access this page.", variant: "destructive"});
      return;
    }

    if (user && user.role === 'admin') {
        const fetchSettings = async () => {
            setIsLoadingData(true);
            try {
                const settingsDocRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
                const docSnap = await getDoc(settingsDocRef);
                if (docSnap.exists()) {
                    const data = docSnap.data() as SystemSettingsFormValues;
                    form.reset({
                        appName: data.appName || "Crew World",
                        maintenanceMode: data.maintenanceMode || false,
                        supportEmail: data.supportEmail || "",
                    });
                }
            } catch (error) {
                console.error("Error fetching system settings:", error);
                toast({ title: "Loading Error", description: "Could not load system settings.", variant: "destructive" });
            } finally {
                setIsLoadingData(false);
            }
        };
        fetchSettings();
    }
  }, [user, authLoading, form, toast]);

  async function onSubmit(data: SystemSettingsFormValues) {
    if (!user || user.role !== 'admin') {
      toast({ title: "Unauthorized", description: "You do not have permission to save settings.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const settingsDocRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
      await setDoc(settingsDocRef, { ...data, lastUpdatedBy: user.uid, updatedAt: serverTimestamp() }, { merge: true });
      await logAuditEvent({ userId: user.uid, userEmail: user.email || "N/A", actionType: "UPDATE_SYSTEM_SETTINGS", entityType: "SYSTEM_CONFIGURATION", entityId: SETTINGS_DOC_ID, details: data });
      toast({ title: "Settings Saved", description: "System settings have been updated successfully.", action: <CheckCircle className="text-green-500" /> });
    } catch (error) {
      console.error("Error saving system settings:", error);
      toast({ title: "Save Failed", description: "Could not save system settings. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authLoading || isLoadingData) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
         <p className="ml-3 text-muted-foreground">Loading system settings...</p>
      </div>
    );
  }
  
  if (!user || user.role !== 'admin') {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <CardTitle className="text-xl mb-2">Access Denied</CardTitle>
        <p className="text-muted-foreground">You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AnimatedCard>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center">
              <Settings className="mr-3 h-7 w-7 text-primary" />
              System Configuration
            </CardTitle>
            <CardDescription>
                Manage application-wide settings. Changes here may affect all users.
            </CardDescription>
          </CardHeader>
        </Card>
      </AnimatedCard>

      <AnimatedCard delay={0.1}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Application Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField control={form.control} name="appName" render={({ field }) => (
                  <FormItem><FormLabel>Application Name</FormLabel><FormControl><Input placeholder="e.g., Crew World" {...field} disabled={isSubmitting} /></FormControl><FormDescription>The name displayed throughout the application (e.g., in titles).</FormDescription><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="maintenanceMode" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                    <div className="space-y-0.5"><FormLabel className="text-base">Maintenance Mode</FormLabel><FormDescription>Enable to temporarily restrict user access for maintenance.</FormDescription></div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting} /></FormControl>
                  </FormItem>
                )}/>
                <FormField control={form.control} name="supportEmail" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Support Email Address</FormLabel>
                    <FormControl><Input type="email" placeholder="support@express-airline.com" {...field} disabled={isSubmitting} /></FormControl><FormDescription>The primary email address for user support inquiries.</FormDescription><FormMessage />
                  </FormItem>
                )}/>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting || !form.formState.isDirty}>
                {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving Settings...</>) : (<><Save className="mr-2 h-4 w-4" />Save System Settings</>)}
              </Button>
            </div>
            {!form.formState.isDirty && !isSubmitting && (<p className="text-sm text-muted-foreground text-right">No changes to save.</p>)}
          </form>
        </Form>
      </AnimatedCard>
    </div>
  );
}
