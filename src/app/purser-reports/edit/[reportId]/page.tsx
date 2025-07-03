"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSignature, Loader2, Send, PlusCircle, Shield, HeartPulse, Utensils, AlertCircle, UserCheck, Wrench, MessageSquare, Trash2, Edit3, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import { purserReportFormSchema, type PurserReportFormValues, type StoredPurserReport } from "@/schemas/purser-report-schema";
import { format, parseISO } from "date-fns";
import { Separator } from "@/components/ui/separator";

const optionalSectionsConfig: { name: keyof PurserReportFormValues; label: string; placeholder: string; icon: React.ElementType }[] = [
    { name: 'safetyIncidents', label: 'Safety Incidents', placeholder: 'Describe any safety-related incidents or concerns...', icon: Shield },
    { name: 'securityIncidents', label: 'Security Incidents', placeholder: 'Describe any security-related incidents or concerns...', icon: AlertCircle },
    { name: 'medicalIncidents', label: 'Medical Incidents', placeholder: 'Describe any medical incidents, treatments administered, or requests for medical assistance...', icon: HeartPulse },
    { name: 'passengerFeedback', label: 'Significant Passenger Feedback', placeholder: 'Note any notable positive or negative feedback from passengers...', icon: MessageSquare },
    { name: 'cateringNotes', label: 'Catering Notes', placeholder: 'Note any issues with catering, stock levels, or special meal requests...', icon: Utensils },
    { name: 'maintenanceIssues', label: 'Maintenance or Equipment Issues', placeholder: 'Describe any technical issues or malfunctioning cabin equipment...', icon: Wrench },
    { name: 'crewPerformanceNotes', label: 'Crew Performance Notes', placeholder: 'Note any exceptional performance or areas for improvement within the crew...', icon: UserCheck },
    { name: 'otherObservations', label: 'Other Observations', placeholder: 'Any other notes or observations relevant to the flight...', icon: PlusCircle },
];
type OptionalSectionName = typeof optionalSectionsConfig[number]['name'];

export default function EditPurserReportPage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const reportId = params.reportId as string;

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [reportData, setReportData] = React.useState<StoredPurserReport | null>(null);
  const [visibleSections, setVisibleSections] = React.useState<Set<OptionalSectionName>>(new Set());

  const form = useForm<PurserReportFormValues>({
    resolver: zodResolver(purserReportFormSchema),
    mode: "onChange",
  });

  const toggleSection = (sectionName: OptionalSectionName) => {
    setVisibleSections(prev => {
        const newSet = new Set(prev);
        if (newSet.has(sectionName)) {
            newSet.delete(sectionName);
            form.setValue(sectionName, undefined);
        } else {
            newSet.add(sectionName);
        }
        return newSet;
    });
  };

  React.useEffect(() => {
    if (!reportId || authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    const fetchReportData = async () => {
      setIsLoading(true);
      const reportDocRef = doc(db, "purserReports", reportId);
      const reportSnap = await getDoc(reportDocRef);

      if (!reportSnap.exists() || reportSnap.data().userId !== user.uid) {
        toast({ title: "Report Not Found", description: "This report could not be found or you don't have permission to edit it.", variant: "destructive" });
        router.push("/purser-reports");
        return;
      }
      
      const data = reportSnap.data() as StoredPurserReport;
      setReportData(data);
      form.reset({
        ...data,
      });

      const initialVisibleSections = new Set<OptionalSectionName>();
      optionalSectionsConfig.forEach(section => {
        if (data[section.name]) {
            initialVisibleSections.add(section.name);
        }
      });
      setVisibleSections(initialVisibleSections);

      setIsLoading(false);
    };

    fetchReportData();
  }, [reportId, user, authLoading, router, toast, form]);

  async function onSubmit(data: PurserReportFormValues) {
    if (!user || !reportId) { toast({ title: "Error", description: "User not authenticated or report ID is missing.", variant: "destructive" }); return; }
    setIsSubmitting(true);
    
    try {
      const reportRef = doc(db, "purserReports", reportId);
      const updatePayload = {
        ...data,
        updatedAt: serverTimestamp(),
      };
      await updateDoc(reportRef, updatePayload);
      toast({ title: "Report Updated", description: "Your purser report has been successfully updated." });
      router.push("/purser-reports");
    } catch (error) {
      console.error("Error updating report:", error);
      toast({ title: "Update Failed", description: "Could not update your report.", variant: "destructive" });
    } finally { setIsSubmitting(false); }
  }
  
  if (isLoading || authLoading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-4 text-lg text-muted-foreground">Loading Report Data...</p></div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center"><Edit3 className="mr-3 h-7 w-7 text-primary" />Edit Purser Report for Flight {reportData?.flightNumber}</CardTitle>
            <CardDescription>{reportData?.departureAirport} to {reportData?.arrivalAirport} on {reportData ? format(parseISO(reportData.flightDate), "PPP") : '...'}</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Passenger & Crew Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="passengerLoad.total" render={({ field }) => (<FormItem><FormLabel>Total Passengers</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="passengerLoad.adults" render={({ field }) => (<FormItem><FormLabel>Adults</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="passengerLoad.infants" render={({ field }) => (<FormItem><FormLabel>Infants</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <FormField control={form.control} name="crewMembers" render={({ field }) => (<FormItem><FormLabel>Crew Members on Duty*</FormLabel><FormControl><Textarea placeholder="List all crew members, e.g., John Doe (Purser), Jane Smith (Cabin Crew)..." {...field} /></FormControl><FormDescription>Please list names and roles.</FormDescription><FormMessage /></FormItem>)} />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader><CardTitle className="text-lg">General Flight Summary</CardTitle></CardHeader>
          <CardContent>
            <FormField control={form.control} name="generalFlightSummary" render={({ field }) => (<FormItem><FormLabel>General Summary*</FormLabel><FormControl><Textarea placeholder="Describe the overall flight experience, punctuality, and any general observations..." className="min-h-[120px]" {...field} /></FormControl><FormMessage /></FormItem>)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Detailed Observations (Optional)</CardTitle>
            <CardDescription>Add or edit sections for any specific incidents or notes that occurred during the flight.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {optionalSectionsConfig.map(({ name, label, icon: Icon }) => (
                    <Button key={name} type="button" variant={visibleSections.has(name) ? "secondary" : "outline"} onClick={() => toggleSection(name)}>
                        <Icon className="mr-2 h-4 w-4"/> {label}
                    </Button>
                ))}
            </div>
            <Separator />
            <div className="space-y-6">
            {optionalSectionsConfig.map(({ name, label, placeholder, icon: Icon }) => (
              visibleSections.has(name) && (
                <div key={name} className="space-y-2 border-l-4 pl-4 py-2 border-primary/50 bg-muted/30 rounded-r-md">
                   <div className="flex justify-between items-center">
                    <FormLabel className="font-semibold flex items-center gap-2"><Icon className="h-4 w-4 text-primary"/>{label}</FormLabel>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => toggleSection(name)}><Trash2 className="h-4 w-4"/></Button>
                  </div>
                  <FormField
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea placeholder={placeholder} {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )
            ))}
            </div>
          </CardContent>
        </Card>
        
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting || !form.formState.isValid} size="lg">
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving Changes...</> : <><Save className="mr-2 h-4 w-4" /> Save Changes</>}
          </Button>
        </div>
      </form>
    </Form>
  );
}
