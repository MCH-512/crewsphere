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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Loader2, AlertTriangle, CheckCircle, Save, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { AnimatedCard } from "@/components/motion/animated-card";
import { logAuditEvent } from "@/lib/audit-logger";
import { seedInitialCourses } from "@/lib/seed";

const systemSettingsSchema = z.object({
  appName: z.string().min(3, "App name must be at least 3 characters.").max(50, "App name cannot exceed 50 characters.").default("CrewSphere"),
  maintenanceMode: z.boolean().default(false),
  supportEmail: z.string().email("Invalid email address.").min(5, "Support email is required."),
});

type SystemSettingsFormValues = z.infer&lt;typeof systemSettingsSchema&gt;;

const SETTINGS_DOC_ID = "appSettings";
const SETTINGS_COLLECTION = "systemConfiguration";

export default function SystemSettingsPage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSeeding, setIsSeeding] = React.useState(false);

  const form = useForm&lt;SystemSettingsFormValues&gt;({
    resolver: zodResolver(systemSettingsSchema),
    defaultValues: {
      appName: "CrewSphere",
      maintenanceMode: false,
      supportEmail: "",
    },
  });

  React.useEffect(() =&gt; {
    if (!authLoading &amp;&amp; (!user || user.role !== 'admin')) {
      toast({ title: "Access Denied", description: "You need admin privileges to access this page.", variant: "destructive"});
      return;
    }

    if (user &amp;&amp; user.role === 'admin') {
        const fetchSettings = async () =&gt; {
            setIsLoadingData(true);
            try {
                const settingsDocRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
                const docSnap = await getDoc(settingsDocRef);
                if (docSnap.exists()) {
                    const data = docSnap.data() as SystemSettingsFormValues;
                    form.reset({
                        appName: data.appName || "CrewSphere",
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
      toast({ title: "Settings Saved", description: "System settings have been updated successfully.", action: &lt;CheckCircle className="text-green-500" /&gt; });
    } catch (error) {
      console.error("Error saving system settings:", error);
      toast({ title: "Save Failed", description: "Could not save system settings. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  const handleSeedData = async () =&gt; {
    if (!window.confirm("Are you sure you want to seed the initial course data? This will only run if the course doesn't already exist.")) {
        return;
    }
    setIsSeeding(true);
    try {
        const result = await seedInitialCourses();
        if (result.success) {
            toast({
                title: "Seeding Successful",
                description: result.message,
            });
        } else {
            toast({
                title: "Seeding Skipped or Failed",
                description: result.message,
                variant: "default",
            });
        }
    } catch (error) {
        console.error("Error seeding data:", error);
        toast({
            title: "Seeding Error",
            description: "An unexpected error occurred while seeding data.",
            variant: "destructive",
        });
    } finally {
        setIsSeeding(false);
    }
  };

  if (authLoading || isLoadingData) {
    return (
      &lt;div className="flex items-center justify-center min-h-[calc(100vh-200px)]"&gt;
        &lt;Loader2 className="h-12 w-12 animate-spin text-primary" /&gt;
         &lt;p className="ml-3 text-muted-foreground"&gt;Loading system settings...&lt;/p&gt;
      &lt;/div&gt;
    );
  }
  
  if (!user || user.role !== 'admin') {
     return (
      &lt;div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center"&gt;
        &lt;AlertTriangle className="h-12 w-12 text-destructive mb-4" /&gt;
        &lt;CardTitle className="text-xl mb-2"&gt;Access Denied&lt;/CardTitle&gt;
        &lt;p className="text-muted-foreground"&gt;You do not have permission to view this page.&lt;/p&gt;
      &lt;/div&gt;
    );
  }

  return (
    &lt;div className="space-y-6"&gt;
      &lt;AnimatedCard&gt;
        &lt;Card className="shadow-lg"&gt;
          &lt;CardHeader&gt;
            &lt;CardTitle className="text-2xl font-headline flex items-center"&gt;
              &lt;Settings className="mr-3 h-7 w-7 text-primary" /&gt;
              System Configuration
            &lt;/CardTitle&gt;
            &lt;CardDescription&gt;
                Manage application-wide settings. Changes here may affect all users.
            &lt;/CardDescription&gt;
          &lt;/CardHeader&gt;
        &lt;/Card&gt;
      &lt;/AnimatedCard&gt;

      &lt;AnimatedCard delay={0.1}&gt;
        &lt;Form {...form}&gt;
          &lt;form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8"&gt;
            &lt;Card&gt;
              &lt;CardHeader&gt;
                &lt;CardTitle&gt;Application Settings&lt;/CardTitle&gt;
              &lt;/CardHeader&gt;
              &lt;CardContent className="space-y-6"&gt;
                &lt;FormField control={form.control} name="appName" render={({ field }) =&gt; (
                  &lt;FormItem&gt;&lt;FormLabel&gt;Application Name&lt;/FormLabel&gt;&lt;FormControl&gt;&lt;Input placeholder="e.g., CrewSphere" {...field} disabled={isSubmitting} /&gt;&lt;/FormControl&gt;&lt;FormDescription&gt;The name displayed throughout the application (e.g., in titles).&lt;/FormDescription&gt;&lt;FormMessage /&gt;&lt;/FormItem&gt;
                )}/&gt;
                &lt;FormField control={form.control} name="maintenanceMode" render={({ field }) =&gt; (
                  &lt;FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm"&gt;
                    &lt;div className="space-y-0.5"&gt;&lt;FormLabel className="text-base"&gt;Maintenance Mode&lt;/FormLabel&gt;&lt;FormDescription&gt;Enable to temporarily restrict user access for maintenance.&lt;/FormDescription&gt;&lt;/div&gt;
                    &lt;FormControl&gt;&lt;Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting} /&gt;&lt;/FormControl&gt;
                  &lt;/FormItem&gt;
                )}/&gt;
                &lt;FormField control={form.control} name="supportEmail" render={({ field }) =&gt; (
                  &lt;FormItem&gt;
                    &lt;FormLabel&gt;Support Email Address&lt;/FormLabel&gt;
                    &lt;FormControl&gt;&lt;Input type="email" placeholder="support@express-airline.com" {...field} disabled={isSubmitting} /&gt;&lt;/FormControl&gt;&lt;FormDescription&gt;The primary email address for user support inquiries.&lt;/FormDescription&gt;&lt;FormMessage /&gt;
                  &lt;/FormItem&gt;
                )}/&gt;
              &lt;/CardContent&gt;
            &lt;/Card&gt;

            &lt;div className="flex justify-end"&gt;
              &lt;Button type="submit" disabled={isSubmitting || !form.formState.isDirty}&gt;
                {isSubmitting ? (&lt;&gt;&lt;Loader2 className="mr-2 h-4 w-4 animate-spin" /&gt;Saving Settings...&lt;/&gt;) : (&lt;&gt;&lt;Save className="mr-2 h-4 w-4" /&gt;Save System Settings&lt;/&gt;)}
              &lt;/Button&gt;
            &lt;/div&gt;
            {!form.formState.isDirty &amp;&amp; !isSubmitting &amp;&amp; (&lt;p className="text-sm text-muted-foreground text-right"&gt;No changes to save.&lt;/p&gt;)}
          &lt;/form&gt;
        &lt;/Form&gt;
      &lt;/AnimatedCard&gt;

      &lt;AnimatedCard delay={0.2}&gt;
        &lt;Card&gt;
            &lt;CardHeader&gt;
                &lt;CardTitle className="flex items-center gap-2"&gt;&lt;Database className="w-5 h-5 text-primary" /&gt; Data Management&lt;/CardTitle&gt;
                &lt;CardDescription&gt;
                    Use these actions to set up initial data for the application. These actions are generally safe to run multiple times.
                &lt;/CardDescription&gt;
            &lt;/CardHeader&gt;
            &lt;CardContent&gt;
                &lt;div className="flex items-center justify-between rounded-lg border p-4 shadow-sm"&gt;
                    &lt;div className="space-y-0.5"&gt;
                        &lt;p className="text-sm font-medium leading-none"&gt;Seed Initial Course&lt;/p&gt;
                        &lt;p className="text-sm text-muted-foreground"&gt;
                            Creates the &amp;quot;Operational Manual&amp;quot; course if it does not already exist.
                        &lt;/p&gt;
                    &lt;/div&gt;
                    &lt;Button onClick={handleSeedData} disabled={isSeeding}&gt;
                        {isSeeding ? &lt;Loader2 className="mr-2 h-4 w-4 animate-spin"/&gt; : null}
                        Seed Data
                    &lt;/Button&gt;
                &lt;/div&gt;
            &lt;/CardContent&gt;
        &lt;/Card&gt;
      &lt;/AnimatedCard&gt;
    &lt;/div&gt;
  );
}
