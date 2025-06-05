
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { User, Bell, Shield, Palette, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { updateProfile } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [displayName, setDisplayName] = React.useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = React.useState(false);

  React.useEffect(() => {
    if (user?.displayName) {
      setDisplayName(user.displayName);
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

    setIsUpdatingProfile(true);
    try {
      // Update Firebase Auth display name
      await updateProfile(auth.currentUser, { displayName: displayName.trim() });

      // Update Firestore display name
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, { displayName: displayName.trim() });

      toast({ title: "Profile Updated", description: "Your display name has been successfully updated." });
      // The AuthContext will automatically pick up the change from onAuthStateChanged for the Firebase Auth object.
      // To immediately reflect in the UI if not relying solely on AuthContext's refresh cycle for 'user.displayName':
      // You might need to manually update the local user object in AuthContext or trigger a re-fetch.
      // For simplicity, we'll rely on AuthContext's existing behavior.
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast({ title: "Update Failed", description: error.message || "Could not update your profile.", variant: "destructive" });
    } finally {
      setIsUpdatingProfile(false);
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
    // This case should ideally be handled by AuthProvider redirecting to login
    return <p>Please log in to view settings.</p>;
  }

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <Input 
                id="fullName" 
                value={displayName} 
                onChange={(e) => setDisplayName(e.target.value)} 
                disabled={isUpdatingProfile}
              />
            </div>
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" value={user.email || ""} disabled />
              <p className="text-xs text-muted-foreground mt-1">Email address cannot be changed here.</p>
            </div>
          </div>
          <div>
            <Label htmlFor="employeeId">Employee ID</Label>
            <Input id="employeeId" value={user.uid.substring(0,10).toUpperCase()} disabled /> 
            <p className="text-xs text-muted-foreground mt-1">Your unique identifier (UID snippet shown).</p>
          </div>
          <Button onClick={handleProfileUpdate} disabled={isUpdatingProfile || displayName === (user.displayName || "")}>
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
