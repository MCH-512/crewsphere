
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription as UiFormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { User, Bell, Shield, Palette, Loader2, Info, CalendarDays, KeyRound, Camera } from "lucide-react"; 
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { updateProfile as updateAuthProfile, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth"; 
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { auth, db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { format } from "date-fns";
import Image from "next/image"; 
import { cn } from "@/lib/utils";

// Schema for the main profile & preferences form
const profileSettingsFormSchema = z.object({
  displayName: z.string().min(2, "Display name must be at least 2 characters.").max(50),
  fullName: z.string().min(2, "Full name must be at least 2 characters.").max(100),
  emailNotifications: z.boolean().default(true),
  scheduleChangeAlerts: z.boolean().default(true),
});
type ProfileSettingsFormValues = z.infer<typeof profileSettingsFormSchema>;


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
  
  const [isUpdatingProfile, setIsUpdatingProfile] = React.useState(false);
  const [isChangePasswordDialogOpen, setIsChangePasswordDialogOpen] = React.useState(false);
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);

  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const profileForm = useForm<ProfileSettingsFormValues>({
    resolver: zodResolver(profileSettingsFormSchema),
    defaultValues: {
      displayName: "",
      fullName: "",
      emailNotifications: true,
      scheduleChangeAlerts: true,
    }
  });
  
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
      // Fetch user preferences and reset the main form
      const fetchUserPreferences = async () => {
        const userDocRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userDocRef);
        const userData = docSnap.exists() ? docSnap.data() : {};
        
        profileForm.reset({
          displayName: user.displayName || "",
          fullName: userData.fullName || "",
          emailNotifications: userData.prefsEmailNotifications === undefined ? true : userData.prefsEmailNotifications,
          scheduleChangeAlerts: userData.prefsScheduleChangeAlerts === undefined ? true : userData.prefsScheduleChangeAlerts,
        });
      };
      fetchUserPreferences();
    }
  }, [user, profileForm]);

  const handleProfileUpdate = async (data: ProfileSettingsFormValues) => {
    if (!user || !auth.currentUser) {
      toast({ title: "Error", description: "You must be logged in to update your profile.", variant: "destructive" });
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
        displayName: data.displayName.trim(),
        fullName: data.fullName.trim(),
        prefsEmailNotifications: data.emailNotifications,
        prefsScheduleChangeAlerts: data.scheduleChangeAlerts,
      };

      if (data.displayName.trim() !== auth.currentUser.displayName) {
        await updateAuthProfile(auth.currentUser, { displayName: data.displayName.trim() });
      }

      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, updatesForFirestore);

      toast({ title: "Profile & Preferences Updated", description: "Your information has been successfully updated." });
      profileForm.reset(data); // Resets the form's "dirty" state
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast({ title: "Update Failed", description: error.message || "Could not update your profile.", variant: "destructive" });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        if (file.size > 2 * 1024 * 1024) { // 2MB limit
            toast({ title: "File Too Large", description: "Please select an image smaller than 2MB.", variant: "destructive" });
            return;
        }
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleAvatarUpload = async () => {
    if (!selectedFile || !user || !auth.currentUser || !storage) return;
    setIsUploading(true);
    const storageRef = ref(storage, `avatars/${user.uid}/profile`);
    try {
        await uploadBytes(storageRef, selectedFile);
        const photoURL = await getDownloadURL(storageRef);

        await updateAuthProfile(auth.currentUser, { photoURL });
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, { photoURL });
        
        toast({ title: "Avatar Updated", description: "Your new profile picture has been saved. The page will now refresh." });
        setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
        toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    } finally {
        setIsUploading(false);
        setSelectedFile(null);
        setPreviewUrl(null);
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

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Settings</CardTitle>
          <CardDescription>Manage your account preferences and application settings.</CardDescription>
        </CardHeader>
      </Card>
        
      <Form {...profileForm}>
        <form onSubmit={profileForm.handleSubmit(handleProfileUpdate)} className="space-y-8">
            <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><User /> Profile Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="relative">
                            <Image 
                                src={previewUrl || user?.photoURL || "https://placehold.co/100x100.png"} 
                                alt="User Avatar" 
                                width={80} 
                                height={80} 
                                className="rounded-full" 
                                data-ai-hint="user avatar"
                            />
                             <Button 
                                type="button"
                                variant="outline"
                                size="icon"
                                className="absolute bottom-0 right-0 h-8 w-8 rounded-full"
                                onClick={() => fileInputRef.current?.click()}
                                aria-label="Change avatar"
                                disabled={isUploading}
                            >
                                <Camera />
                            </Button>
                             <input 
                                type="file" 
                                id="avatar-upload"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept="image/png, image/jpeg"
                                className="hidden" 
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                             {selectedFile ? (
                                <>
                                    <p className="text-sm font-medium">New: <span className="text-muted-foreground truncate">{selectedFile.name}</span></p>
                                    <div className="flex gap-2">
                                        <Button type="button" onClick={handleAvatarUpload} disabled={isUploading}>
                                            {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Save Avatar
                                        </Button>
                                        <Button type="button" variant="ghost" onClick={() => {setSelectedFile(null); setPreviewUrl(null);}} disabled={isUploading}>
                                            Cancel
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground">Click the camera to change your avatar.</p>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={profileForm.control} name="displayName" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Display Name</FormLabel>
                                <FormControl><Input {...field} disabled={isUpdatingProfile} /></FormControl>
                                <UiFormDescription>Publicly visible name.</UiFormDescription>
                                <FormMessage />
                            </FormItem>
                        )}/>
                        <FormField control={profileForm.control} name="fullName" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Full Name</FormLabel>
                                <FormControl><Input {...field} disabled={isUpdatingProfile} /></FormControl>
                                <UiFormDescription>Your legal name.</UiFormDescription>
                                <FormMessage />
                            </FormItem>
                        )}/>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input value={user.email || ""} disabled /></FormControl><UiFormDescription>Email cannot be changed.</UiFormDescription></FormItem>
                        <FormItem><FormLabel>Role</FormLabel><FormControl><Input value={user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Not Assigned"} disabled className="capitalize"/></FormControl><UiFormDescription>Assigned system role.</UiFormDescription></FormItem>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormItem><FormLabel className="flex items-center gap-1"><Info className="w-3.5 h-3.5 text-muted-foreground"/> Employee ID</FormLabel><FormControl><Input value={user.employeeId || "N/A"} disabled /></FormControl></FormItem>
                        <FormItem><FormLabel className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5 text-muted-foreground"/> Joining Date</FormLabel><FormControl><Input value={formatDateDisplay(user.joiningDate)} disabled /></FormControl></FormItem>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bell /> Notification Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <FormField control={profileForm.control} name="emailNotifications" render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4 shadow-sm">
                            <div className="space-y-0.5"><FormLabel>Email Notifications</FormLabel><UiFormDescription>Receive important updates via email.</UiFormDescription></div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isUpdatingProfile} /></FormControl>
                        </FormItem>
                    )}/>
                    <FormField control={profileForm.control} name="scheduleChangeAlerts" render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4 shadow-sm">
                            <div className="space-y-0.5"><FormLabel>Schedule Change Alerts</FormLabel><UiFormDescription>Notify me of changes to my schedule.</UiFormDescription></div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isUpdatingProfile} /></FormControl>
                        </FormItem>
                    )}/>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button type="submit" disabled={isUpdatingProfile || !profileForm.formState.isDirty}>
                    {isUpdatingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
            </div>
        </form>
      </Form>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield /> Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Dialog open={isChangePasswordDialogOpen} onOpenChange={(open) => { setIsChangePasswordDialogOpen(open); if(!open) changePasswordForm.reset();}}>
            <DialogTrigger asChild>
              <Button variant="outline"><KeyRound className="mr-2 h-4 w-4" />Change Password</Button>
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
                  <FormField control={changePasswordForm.control} name="currentPassword" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl><Input type="password" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}/>
                  <FormField control={changePasswordForm.control} name="newPassword" render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl><Input type="password" {...field} /></FormControl>
                        <UiFormDescription>Minimum 6 characters.</UiFormDescription>
                        <FormMessage />
                      </FormItem>
                    )}/>
                  <FormField control={changePasswordForm.control} name="confirmPassword" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl><Input type="password" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}/>
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
        </CardContent>
      </Card>
    </div>
  );
}
