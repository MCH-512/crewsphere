
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"; 
import { Button } from "@/components/ui/button";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch"; 
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Power, PowerOff } from "lucide-react"; 
import { Separator } from "@/components/ui/separator";
import type { User, SpecificRole, ManageUserFormValues } from "@/schemas/user-schema";
import { manageUserFormSchema, availableRoles } from "@/schemas/user-schema";
import { manageUser } from "@/services/user-service";
import { CustomAutocompleteAirport } from "@/components/custom/custom-autocomplete-airport";
import { Airport, searchAirports } from "@/services/airport-service";
import { useDebounce } from "@/hooks/use-debounce";

const NO_ROLE_SENTINEL = "_NONE_"; 

interface UserFormProps {
    isCreateMode: boolean;
    currentUser: User | null;
    onFormSubmitSuccess: () => void;
}

export function UserForm({ isCreateMode, currentUser, onFormSubmitSuccess }: UserFormProps) {
  const { user: adminUser } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [airportSearch, setAirportSearch] = React.useState(currentUser?.baseAirport || "");
  const [debouncedAirportSearch] = useDebounce(airportSearch, 300);
  const [airportResults, setAirportResults] = React.useState<Airport[]>([]);
  const [isSearchingAirports, setIsSearchingAirports] = React.useState(false);

  const form = useForm<ManageUserFormValues>({
    resolver: zodResolver(manageUserFormSchema),
    defaultValues: isCreateMode ? {
        email: "", password: "", confirmPassword: "", displayName: "", fullName: "",
        employeeId: "", joiningDate: new Date().toISOString().split('T')[0], 
        role: "", accountStatus: true, baseAirport: "",
    } : {
        email: currentUser?.email || "",
        displayName: currentUser?.displayName || "",
        fullName: currentUser?.fullName || "",
        employeeId: currentUser?.employeeId || "",
        joiningDate: currentUser?.joiningDate ? new Date(currentUser.joiningDate).toISOString().split('T')[0] : "",
        role: currentUser?.role || "",
        accountStatus: currentUser?.accountStatus === 'active',
        baseAirport: currentUser?.baseAirport || "",
        password: "", confirmPassword: "",
    },
    mode: "onChange"
  });
  
  React.useEffect(() => {
    if (!debouncedAirportSearch) { setAirportResults([]); return; }
    setIsSearchingAirports(true);
    searchAirports(debouncedAirportSearch).then(res => setAirportResults(res)).finally(() => setIsSearchingAirports(false));
  }, [debouncedAirportSearch]);

  const handleFormSubmit = async (data: ManageUserFormValues) => {
    if (!adminUser) {
        toast({ title: "Unauthorized", description: "You do not have permission to perform this action.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);
    try {
        await manageUser({ isCreate: isCreateMode, data, userId: currentUser?.uid, adminUser });
        toast({ title: isCreateMode ? "User Created" : "User Updated", description: `User ${data.email} has been saved.` });
        onFormSubmitSuccess();
    } catch (error: unknown) {
        const err = error as Error;
        console.error("Error managing user:", err);
        toast({ title: "Operation Failed", description: err.message, variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <>
        <DialogHeader>
            <DialogTitle>{isCreateMode ? "Create New User" : `Edit User: ${currentUser?.displayName || currentUser?.email}`}</DialogTitle>
            <DialogDescription>{isCreateMode ? "Fill in the details for the new user." : "Modify the user's information below."}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)}>
              <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                 {isCreateMode && (
                  <div className="space-y-4">
                      <h4 className="text-base font-semibold text-muted-foreground">Account Credentials</h4>
                      <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="user@example.com" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                      <FormField control={form.control} name="password" render={({ field }) => (<FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" placeholder="Min. 6 characters" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                      <FormField control={form.control} name="confirmPassword" render={({ field }) => (<FormItem><FormLabel>Confirm Password</FormLabel><FormControl><Input type="password" placeholder="Re-enter password" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                      <Separator/>
                  </div>
                 )}
                  <h4 className="text-base font-semibold text-muted-foreground">Personal & Professional Info</h4>
                  <div className="space-y-4">
                     {!isCreateMode && <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" value={form.getValues("email")} disabled /></FormControl></FormItem>}
                     <FormField control={form.control} name="fullName" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="e.g., Johnathan Doe" {...field} /></FormControl><FormDescription>The user's full legal name.</FormDescription><FormMessage /></FormItem>)}/>
                     <FormField control={form.control} name="displayName" render={({ field }) => (<FormItem><FormLabel>Display Name</FormLabel><FormControl><Input placeholder="e.g., John D." {...field} /></FormControl><FormDescription>This name will be shown publicly and in greetings.</FormDescription><FormMessage /></FormItem>)}/>
                     <FormField control={form.control} name="employeeId" render={({ field }) => (<FormItem><FormLabel>Employee ID</FormLabel><FormControl><Input placeholder="e.g., EMP12345" {...field} /></FormControl><FormDescription>Unique company identifier for the employee.</FormDescription><FormMessage /></FormItem>)}/>
                     <FormField control={form.control} name="joiningDate" render={({ field }) => (<FormItem><FormLabel>Joining Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormDescription>Optional. When the user joined the company.</FormDescription><FormMessage /></FormItem>)}/>
                     <Controller control={form.control} name="baseAirport" render={({ field }) => (<FormItem><FormLabel>Base Airport (ICAO)</FormLabel><CustomAutocompleteAirport value={field.value} onSelect={(airport: Airport | null) => field.onChange(airport?.icao || "")} airports={airportResults} isLoading={isSearchingAirports} onInputChange={setAirportSearch} currentSearchTerm={airportSearch} placeholder="Search base airport..." /><FormDescription>The user's primary base of operations.</FormDescription><FormMessage /></FormItem>)} />
                  </div>

                  <Separator />
                  <h4 className="text-base font-semibold text-muted-foreground">System Role & Status</h4>
                  <div className="space-y-4">
                      <FormField control={form.control} name="role" render={({ field }) => (
                          <FormItem>
                          <FormLabel>Role</FormLabel>
                          <Select onValueChange={(value) => field.onChange(value === NO_ROLE_SENTINEL ? "" : value)} value={field.value || NO_ROLE_SENTINEL} >
                              <FormControl><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl>
                              <SelectContent>
                              {availableRoles.map(roleValue => (<SelectItem key={roleValue} value={roleValue} className="capitalize">{roleValue}</SelectItem>))}
                              <SelectItem value={NO_ROLE_SENTINEL}><em>(Remove Role / Default)</em></SelectItem>
                              </SelectContent>
                          </Select>
                          <FormDescription>Assign a system role or leave as default for standard user permissions.</FormDescription>
                          <FormMessage />
                          </FormItem>
                      )} />
                      <FormField control={form.control} name="accountStatus" render={({ field }) => (
                          <FormItem className="flex flex-col rounded-lg border p-3 shadow-sm">
                          <FormLabel>Account Status</FormLabel>
                          <div className="flex items-center space-x-2">
                              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Account status toggle"/></FormControl>
                              {field.value ? <Power className="h-5 w-5 text-success" /> : <PowerOff className="h-5 w-5 text-destructive" />}
                              <span className={field.value ? "font-medium text-success" : "font-medium text-destructive"}>{field.value ? "Active" : "Inactive"}</span>
                          </div>
                          <FormDescription>Controls if the user account is active or inactive in the application.</FormDescription>
                          <FormMessage />
                          </FormItem>
                      )} />
                  </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isCreateMode ? "Create User" : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
        </Form>
    </>
  );
}
