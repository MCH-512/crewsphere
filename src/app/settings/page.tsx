import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { User, Bell, Shield, Palette } from "lucide-react";

export default function SettingsPage() {
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
              <Input id="fullName" defaultValue="Alex Crewman" />
            </div>
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" defaultValue="alex.crewman@example.com" />
            </div>
          </div>
          <div>
            <Label htmlFor="employeeId">Employee ID</Label>
            <Input id="employeeId" defaultValue="AC789012" disabled />
          </div>
          <Button>Update Profile</Button>
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
            <Switch id="emailNotifications" defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <Label htmlFor="pushNotifications" className="flex flex-col space-y-1">
              <span>Push Notifications</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Get real-time alerts on your mobile device (if app installed).
              </span>
            </Label>
            <Switch id="pushNotifications" defaultChecked />
          </div>
           <Separator />
          <div className="flex items-center justify-between">
            <Label htmlFor="scheduleChangeAlerts" className="flex flex-col space-y-1">
              <span>Schedule Change Alerts</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Notify me immediately of any changes to my flight or duty schedule.
              </span>
            </Label>
            <Switch id="scheduleChangeAlerts" defaultChecked />
          </div>
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
                Toggle between light and dark themes. (Handled globally for now)
              </span>
            </Label>
            <Switch id="darkMode" disabled />
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline">Change Password</Button>
          <div className="flex items-center justify-between">
            <Label htmlFor="twoFactorAuth" className="flex flex-col space-y-1">
              <span>Two-Factor Authentication (2FA)</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Enhance your account security with an extra layer of verification.
              </span>
            </Label>
            <Switch id="twoFactorAuth" />
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
