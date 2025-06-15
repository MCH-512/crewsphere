
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { User, Bell, Shield, Palette, Loader2, Info, CalendarDays } from "lucide-react"; // Changed InfoSquare to Info
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { updateProfile as updateAuthProfile } from "firebase/auth"; // Renamed to avoid conflict
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { format } from "date-fns";
import Image from "next/image"; // Added Image import

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [displayName, setDisplayName] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  // employeeId and joiningDate are displayed from context, not directly editable by user here.
  // If they were to be editable, they'd need their own state and handling.

  const [isUpdatingProfile, setIsUpdatingProfile] = React.useState(false);

  React.useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "");
      setFullName(user.fullName || "");
      // employeeId and joiningDate will be read directly from user object for display
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
      const updatesForFirestore: { displayName: string; fullName: string; [key: string]: any } = {
        displayName: displayName.trim(),
        fullName: fullName.trim(),
      };

      // Update Firebase Auth display name if it changed
      if (displayName.trim() !== auth.currentUser.displayName) {
        await updateAuthProfile(auth.currentUser, { displayName: displayName.trim() });
      }

      // Update Firestore document
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, updatesForFirestore);

      toast({ title: "Profile Updated", description: "Your profile information has been successfully updated." });
      // AuthContext should pick up displayName change from Firebase Auth.
      // For fullName, AuthContext might need a refresh or a manual update if not re-fetching on every auth change.
      // However, our AuthProvider now fetches full Firestore doc, so it should update on next state change.
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast({ title: "Update Failed", description: error.message || "Could not update your profile.", variant: "destructive" });
    } finally {
      setIsUpdatingProfile(false);
    }
  };
  
  const formatDateDisplay = (dateString?: string | null) => {
    if (!dateString) return "N/A";
    try {
      // Assuming dateString is YYYY-MM-DD or a full ISO string
      const dateObj = new Date(dateString);
      // Check if date is valid. getTime() returns NaN for invalid dates.
      if (isNaN(dateObj.getTime())) return "Invalid Date";
      return format(dateObj, "PPP"); // e.g., Jul 28, 2024
    } catch (e) {
      return dateString; // Fallback to original string if formatting fails
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

  const isProfileChanged = displayName !== (user.displayName || "") || fullName !== (user.fullName || "");

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Settings</CardTitle>
          <CardDescription>Manage your account preferences and application settings.</CardDescription>
        </CardHeader>
      </Card>

      {/* Profile Settings */}
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

          <Button onClick={handleProfileUpdate} disabled={isUpdatingProfile || !isProfileChanged}>
            {isUpdatingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Profile
          </Button>
        </CardContent>
      </Card>

      {/* Notification Settings */}
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
            <Switch id="emailNotifications" defaultChecked disabled />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <Label htmlFor="pushNotifications" className="flex flex-col space-y-1">
              <span>Push Notifications</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Get real-time alerts on your mobile device (if app installed).
              </span>
            </Label>
            <Switch id="pushNotifications" defaultChecked disabled />
          </div>
           <Separator />
          <div className="flex items-center justify-between">
            <Label htmlFor="scheduleChangeAlerts" className="flex flex-col space-y-1">
              <span>Schedule Change Alerts</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Notify me immediately of any changes to my flight or duty schedule.
              </span>
            </Label>
            <Switch id="scheduleChangeAlerts" defaultChecked disabled />
          </div>
          <p className="text-xs text-muted-foreground">Notification settings are currently placeholders and not functional.</p>
        </CardContent>
      </Card>

      {/* Appearance Settings */}
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

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" disabled>Change Password</Button>
          <div className="flex items-center justify-between">
            <Label htmlFor="twoFactorAuth" className="flex flex-col space-y-1">
              <span>Two-Factor Authentication (2FA)</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Enhance your account security with an extra layer of verification.
              </span>
            </Label>
            <Switch id="twoFactorAuth" disabled />
          </div>
          <p className="text-xs text-muted-foreground">Security settings are currently placeholders and not functional.</p>
        </CardContent>
      </Card>

    </div>
  );
}

