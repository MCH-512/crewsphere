
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription as UiFormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { User, Bell, Shield, Palette, Loader2, Info, CalendarDays, KeyRound } from "lucide-react"; 
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { updateProfile as updateAuthProfile, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth"; 
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { format } from "date-fns";
import Image from "next/image"; 

// Schema for Change Password Form
const changePasswordFormSchema = z.object({
  currentPassword: z.string().min(1, { message: "Current password is required." }),
  newPassword: z.string().min(6, { message: "New password must be at least 6 characters." }),
  confirmPassword: z.string().min(6, { message: "Confirm password must be at least 6 characters." }),
})
.refine((data) => data.newPassword === data.confirmPassword, {
  message: "New passwords don't match.",
  path: ["confirmPassword"],
});
type ChangePasswordFormValues = z.infer<typeof changePasswordFormSchema>;


export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [displayName, setDisplayName] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = React.useState(true);
  const [scheduleChangeAlertsEnabled, setScheduleChangeAlertsEnabled] = React.useState(true);

  const [isUpdatingProfile, setIsUpdatingProfile] = React.useState(false);
  const [isChangePasswordDialogOpen, setIsChangePasswordDialogOpen] = React.useState(false);
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);

  const changePasswordForm = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  React.useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "");
      setFullName(user.fullName || "");
      
      // Fetch notification preferences from Firestore
      const fetchUserPreferences = async () => {
        const userDocRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const userData = docSnap.data();
          setEmailNotificationsEnabled(userData.prefsEmailNotifications === undefined ? true : userData.prefsEmailNotifications);
          setScheduleChangeAlertsEnabled(userData.prefsScheduleChangeAlerts === undefined ? true : userData.prefsScheduleChangeAlerts);
        }
      };
      fetchUserPreferences();
    }
  }, [user]);

  const handleProfileUpdate = async () => {
    if (!user || !auth.currentUser) {
      toast({ title: "Error", description: "You must be logged in to update your profile.", variant: "destructive" });
      return;
    }
    if (displayName.trim().length < 2) {
      toast({ title: "Validation Error", description: "Display name must be at least 2 characters.", variant: "destructive" });
      return;
    }
    if (fullName.trim().length < 2) {
      toast({ title: "Validation Error", description: "Full name must be at least 2 characters.", variant: "destructive" });
      return;
    }

    setIsUpdatingProfile(true);
    try {
      const updatesForFirestore: { 
        displayName: string; 
        fullName: string; 
        prefsEmailNotifications: boolean;
        prefsScheduleChangeAlerts: boolean;
        [key: string]: any 
      } = {
        displayName: displayName.trim(),
        fullName: fullName.trim(),
        prefsEmailNotifications: emailNotificationsEnabled,
        prefsScheduleChangeAlerts: scheduleChangeAlertsEnabled,
      };

      if (displayName.trim() !== auth.currentUser.displayName) {
        await updateAuthProfile(auth.currentUser, { displayName: displayName.trim() });
      }

      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, updatesForFirestore);

      toast({ title: "Profile & Preferences Updated", description: "Your information has been successfully updated." });
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast({ title: "Update Failed", description: error.message || "Could not update your profile.", variant: "destructive" });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePasswordSubmit = async (data: ChangePasswordFormValues) => {
    if (!user || !user.email || !auth.currentUser) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }
    setIsChangingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, data.currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, data.newPassword);
      toast({ title: "Password Changed", description: "Your password has been successfully updated." });
      setIsChangePasswordDialogOpen(false);
      changePasswordForm.reset();
    } catch (error: any) {
      console.error("Error changing password:", error);
      let errorMessage = "Could not change password. Please try again.";
      if (error.code === 'auth/wrong-password') {
        errorMessage = "Incorrect current password.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "The new password is too weak.";
      }
      toast({ title: "Password Change Failed", description: errorMessage, variant: "destructive" });
    } finally {
      setIsChangingPassword(false);
    }
  };
  
  const formatDateDisplay = (dateString?: string | null) => {
    if (!dateString) return "N/A"; 
    try {
      const dateObj = new Date(dateString);
      if (isNaN(dateObj.getTime())) return "Invalid Date";
      return format(dateObj, "PPP"); 
    } catch (e) {
      return dateString; 
    }
  };


  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <p>Please log in to view settings.</p>;
  }

  const isProfileChanged = displayName !== (user.displayName || "") || 
                           fullName !== (user.fullName || "") ||
                           emailNotificationsEnabled !== (user.prefsEmailNotifications === undefined ? true : user.prefsEmailNotifications) ||
                           scheduleChangeAlertsEnabled !== (user.prefsScheduleChangeAlerts === undefined ? true : user.prefsScheduleChangeAlerts);


  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Settings</CardTitle>
          <CardDescription>Manage your account preferences and application settings.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="w-5 h-5 text-primary" /> Profile Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 mb-6">
            <Image 
              src={user?.photoURL || "https://placehold.co/100x100.png"} 
              alt="User Avatar" 
              width={80} 
              height={80} 
              className="rounded-full" 
              data-ai-hint="user avatar"
            />
            <Button variant="outline" disabled>Change Avatar (coming soon)</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="displayName">Display Name</Label>
              <Input 
                id="displayName" 
                value={displayName} 
                onChange={(e) => setDisplayName(e.target.value)} 
                disabled={isUpdatingProfile}
              />
               <p className="text-xs text-muted-foreground mt-1">This name is shown publicly (e.g., in greetings).</p>
            </div>
            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <Input 
                id="fullName" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)} 
                disabled={isUpdatingProfile}
              />
              <p className="text-xs text-muted-foreground mt-1">Your full legal name.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" value={user.email || ""} disabled />
              <p className="text-xs text-muted-foreground mt-1">Email address cannot be changed here.</p>
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Input id="role" value={user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Not Assigned"} disabled className="capitalize"/>
              <p className="text-xs text-muted-foreground mt-1">Your assigned system role.</p>
            </div>
          </div>
           <Separator />
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <Label htmlFor="employeeId" className="flex items-center gap-1"><Info className="w-3.5 h-3.5 text-muted-foreground"/> Employee ID</Label>
                <Input id="employeeId" value={user.employeeId || "N/A"} disabled />
                <p className="text-xs text-muted-foreground mt-1">Your unique company identifier.</p>
            </div>
            <div>
                <Label htmlFor="joiningDate" className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5 text-muted-foreground"/> Joining Date</Label>
                <Input id="joiningDate" value={formatDateDisplay(user.joiningDate)} disabled />
                <p className="text-xs text-muted-foreground mt-1">The date you joined the company.</p>
            </div>
           </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5 text-primary" /> Notification Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="emailNotifications" className="flex flex-col space-y-1">
              <span>Email Notifications</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Receive important updates and alerts via email.
              </span>
            </Label>
            <Switch 
              id="emailNotifications" 
              checked={emailNotificationsEnabled} 
              onCheckedChange={setEmailNotificationsEnabled}
              disabled={isUpdatingProfile} 
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <Label htmlFor="scheduleChangeAlerts" className="flex flex-col space-y-1">
              <span>Schedule Change Alerts</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Notify me immediately of any changes to my flight or duty schedule.
              </span>
            </Label>
            <Switch 
              id="scheduleChangeAlerts" 
              checked={scheduleChangeAlertsEnabled} 
              onCheckedChange={setScheduleChangeAlertsEnabled}
              disabled={isUpdatingProfile} 
            />
          </div>
          <p className="text-xs text-muted-foreground">Push notifications for mobile are managed in the app settings (if applicable).</p>
        </CardContent>
      </Card>

       <Button onClick={handleProfileUpdate} disabled={isUpdatingProfile || !isProfileChanged} className="w-full md:w-auto">
            {isUpdatingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Profile & Preferences
        </Button>


      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Palette className="w-5 h-5 text-primary" /> Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
             <Label htmlFor="darkMode" className="flex flex-col space-y-1">
              <span>Dark Mode</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Toggle between light and dark themes. (Theme toggle is in the header)
              </span>
            </Label>
            <Switch id="darkMode" checked={typeof window !== "undefined" && document.documentElement.classList.contains('dark')} disabled />
          </div>
           <p className="text-xs text-muted-foreground">Theme is toggled globally via the header icon.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Dialog open={isChangePasswordDialogOpen} onOpenChange={setIsChangePasswordDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><KeyRound className="mr-2 h-4 w-4"/>Change Password</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Change Your Password</DialogTitle>
                <DialogDescription>
                  Enter your current password and a new password.
                </DialogDescription>
              </DialogHeader>
              <Form {...changePasswordForm}>
                <form onSubmit={changePasswordForm.handleSubmit(handleChangePasswordSubmit)} className="space-y-4 py-4">
                  <FormField
                    control={changePasswordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={changePasswordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <UiFormDescription>Minimum 6 characters.</UiFormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={changePasswordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter className="pt-4">
                     <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                    <Button type="submit" disabled={isChangingPassword}>
                      {isChangingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Update Password
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          
          <div className="flex items-center justify-between mt-4">
            <Label htmlFor="twoFactorAuth" className="flex flex-col space-y-1">
              <span>Two-Factor Authentication (2FA)</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Enhance your account security with an extra layer of verification.
              </span>
            </Label>
            <Switch id="twoFactorAuth" disabled />
          </div>
          <p className="text-xs text-muted-foreground">2FA is currently a placeholder and not functional.</p>
        </CardContent>
      </Card>

    </div>
  );
}
