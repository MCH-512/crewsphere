
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"; 
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; 
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription as DialogPrimitiveDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"; // Renamed to avoid conflict
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { db, auth as firebaseAuth } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp, doc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Users, Loader2, AlertTriangle, RefreshCw, Edit, PlusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { badgeVariants, type VariantProps } from "@/components/ui/badge";

type SpecificRole = 'admin' | 'purser' | 'crew';

interface UserDocument {
  uid: string;
  email?: string;
  role?: SpecificRole;
  displayName?: string;
  lastLogin?: Timestamp;
  createdAt?: Timestamp;
}

const availableRoles: SpecificRole[] = ['admin', 'purser', 'crew'];
const NO_ROLE_SENTINEL = "_NONE_"; // Sentinel value for "no role" or default

const manageUserFormSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }).optional(),
  password: z.string().min(6, "Password must be at least 6 characters.").optional(),
  confirmPassword: z.string().optional(), // Optional, validation handled by refine
  displayName: z.string().min(2, "Display name must be at least 2 characters.").max(50),
  role: z.string().optional(), 
})
.refine((data) => {
  // If password is provided, confirmPassword is required and must match
  if (data.password) {
    if (!data.confirmPassword) return false; // Confirm password is required if password is set
    return data.password === data.confirmPassword;
  }
  return true; // No password provided, so no need to check confirmPassword
}, {
  message: "Passwords don't match or confirmation is missing.",
  path: ["confirmPassword"],
})
.refine((data) => {
    // If creating (signified by presence of password), email is required
    if (data.password && (!data.email || data.email.trim() === "")) {
        return false;
    }
    return true;
}, {
    message: "Email is required when setting a password for a new user.",
    path: ["email"]
});

type ManageUserFormValues = z.infer<typeof manageUserFormSchema>;

export default function AdminUsersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [usersList, setUsersList] = React.useState<UserDocument[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [isManageUserDialogOpen, setIsManageUserDialogOpen] = React.useState(false);
  const [isCreateMode, setIsCreateMode] = React.useState(false);
  const [currentUserToManage, setCurrentUserToManage] = React.useState<UserDocument | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<ManageUserFormValues>({
    resolver: zodResolver(manageUserFormSchema),
    defaultValues: {
        email: "",
        password: "",
        confirmPassword: "",
        displayName: "",
        role: "", // Default to empty string, which will map to NO_ROLE_SENTINEL in Select
    }
  });

  const fetchUsers = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const q = query(collection(db, "users"), orderBy("email", "asc"));
      const querySnapshot = await getDocs(q);
      const fetchedUsers = querySnapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
      } as UserDocument));
      setUsersList(fetchedUsers);
    } catch (err) {
      console.error("Error fetching users:", err);
      setError("Failed to load users. Please try again.");
      toast({ title: "Loading Error", description: "Could not fetch users.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'admin') {
        router.push('/');
      } else {
        fetchUsers();
      }
    }
  }, [user, authLoading, router, fetchUsers]);

  const handleOpenCreateUserDialog = () => {
    setIsCreateMode(true);
    setCurrentUserToManage(null);
    form.reset({ 
        email: "",
        password: "",
        confirmPassword: "",
        displayName: "",
        role: "" 
    });
    setIsManageUserDialogOpen(true);
  };

  const handleOpenEditUserDialog = (userToEdit: UserDocument) => {
    setIsCreateMode(false);
    setCurrentUserToManage(userToEdit);
    form.reset({ 
        email: userToEdit.email || "",
        displayName: userToEdit.displayName || "",
        role: userToEdit.role || "",
        password: "", 
        confirmPassword: "",
    });
    setIsManageUserDialogOpen(true);
  };

  const handleFormSubmit = async (data: ManageUserFormValues) => {
    setIsSubmitting(true);
    if (isCreateMode) {
      if (!data.email || !data.password) {
        toast({ title: "Missing Fields", description: "Email and password are required for new users.", variant: "destructive"});
        setIsSubmitting(false);
        return;
      }
      try {
        const userCredential = await createUserWithEmailAndPassword(firebaseAuth, data.email, data.password);
        const newUser = userCredential.user;
        
        await updateProfile(newUser, { displayName: data.displayName });

        const userDocRef = doc(db, "users", newUser.uid);
        await setDoc(userDocRef, {
          uid: newUser.uid,
          email: data.email,
          displayName: data.displayName,
          role: data.role as SpecificRole || "", // Ensure role is SpecificRole or empty
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
        });

        toast({ title: "User Created", description: `User ${data.email} created successfully.` });
        fetchUsers();
        setIsManageUserDialogOpen(false);
      } catch (err: any) {
        console.error("Error creating user:", err);
        toast({ title: "Creation Failed", description: err.message || "Could not create user.", variant: "destructive" });
      }
    } else {
      // Edit User
      if (!currentUserToManage) return;
      try {
        const userDocRef = doc(db, "users", currentUserToManage.uid);
        const updates: Partial<UserDocument> = {
            displayName: data.displayName,
            role: data.role as SpecificRole || undefined 
        };
        
        await updateDoc(userDocRef, updates);
        toast({ title: "User Updated", description: `${currentUserToManage.email}'s information updated.` });
        fetchUsers();
        setIsManageUserDialogOpen(false);
      } catch (err: any) {
        console.error("Error updating user:", err);
        toast({ title: "Update Failed", description: err.message || "Could not update user.", variant: "destructive" });
      }
    }
    setIsSubmitting(false);
  };

  const getRoleBadgeVariant = (role?: string): VariantProps<typeof badgeVariants>["variant"] => {
    switch (role) {
      case "admin": return "destructive";
      case "purser": return "default";
      case "crew": return "secondary";
      default: return "outline";
    }
  };

  if (authLoading || (isLoading && usersList.length === 0 && !user)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading users...</p>
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
        <CardHeader className="flex flex-row justify-between items-center">
          <div>
            <CardTitle className="text-2xl font-headline flex items-center">
              <Users className="mr-3 h-7 w-7 text-primary" />
              User Management
            </CardTitle>
            <CardDescription>View, create, and manage user accounts and their roles.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchUsers} disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Users
            </Button>
            <Button onClick={handleOpenCreateUserDialog}>
              <PlusCircle className="mr-2 h-4 w-4" /> Create New User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="p-4 mb-4 text-sm text-destructive-foreground bg-destructive rounded-md flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> {error}
            </div>
          )}
          {isLoading && usersList.length === 0 && (
             <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Loading user list...</p>
            </div>
          )}
          {!isLoading && usersList.length === 0 && !error && (
            <p className="text-muted-foreground text-center py-8">No users found in the system.</p>
          )}
          {usersList.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Display Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>UID</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersList.map((u) => (
                    <TableRow key={u.uid}>
                      <TableCell className="font-medium">{u.email || 'N/A'}</TableCell>
                      <TableCell>{u.displayName || 'N/A'}</TableCell>
                      <TableCell>
                        <span className={cn(badgeVariants({ variant: getRoleBadgeVariant(u.role) }), "capitalize")}>
                          {u.role || 'Not Assigned'}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{u.uid}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEditUserDialog(u)}>
                          <Edit className="mr-1 h-4 w-4" /> Edit User
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isManageUserDialogOpen} onOpenChange={setIsManageUserDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)}>
              <DialogHeader>
                <DialogTitle>{isCreateMode ? "Create New User" : `Edit User: ${currentUserToManage?.email || currentUserToManage?.displayName}`}</DialogTitle>
                <DialogPrimitiveDescription>
                  {isCreateMode ? "Fill in the details for the new user." : "Modify the user's information below."}
                </DialogPrimitiveDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="user@example.com" {...field} disabled={!isCreateMode} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {isCreateMode && (
                  <>
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Min. 6 characters" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Re-enter password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select
                            onValueChange={(value) => field.onChange(value === NO_ROLE_SENTINEL ? "" : value)}
                            value={field.value === "" ? NO_ROLE_SENTINEL : (field.value || NO_ROLE_SENTINEL)}
                        >
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {availableRoles.map(role => (
                                <SelectItem key={role} value={role} className="capitalize">{role}</SelectItem>
                            ))}
                            <SelectItem value={NO_ROLE_SENTINEL}><em>(Remove Role / Default)</em></SelectItem>
                            </SelectContent>
                        </Select>
                        <FormDescription>Optional. Assign a role or leave as default (no specific role).</FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                 />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isCreateMode ? "Create User" : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
