"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription as UiFormDescription } from "@/components/ui/form"; 
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; 
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription as DialogPrimitiveDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch"; 
import { useAuth } from "@/contexts/auth-context";
import { db, auth } from "@/lib/firebase"; 
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, getDocs, query, orderBy, Timestamp, doc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Users, Loader2, AlertTriangle, RefreshCw, Edit, PlusCircle, Power, PowerOff, Search } from "lucide-react"; 
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Badge, badgeVariants } from "@/components/ui/badge"; 
import { format } from "date-fns"; 
import type { VariantProps as CvaVariantProps } from "class-variance-authority";
import { logAuditEvent } from "@/lib/audit-logger";

type BadgeCvaVariantProps = CvaVariantProps<typeof badgeVariants>;

type SpecificRole = 'admin' | 'purser' | 'cabin crew' | 'instructor' | 'pilote' | 'other';
type AccountStatus = 'active' | 'inactive';

interface UserDocument {
  uid: string;
  email?: string;
  role?: SpecificRole | null; 
  displayName?: string;
  fullName?: string;
  employeeId?: string;
  joiningDate?: string | null; 
  lastLogin?: Timestamp;
  createdAt?: Timestamp;
  accountStatus?: AccountStatus; 
}

const availableRoles: SpecificRole[] = ['admin', 'purser', 'cabin crew', 'instructor', 'pilote', 'other'];
const NO_ROLE_SENTINEL = "_NONE_"; 

const manageUserFormSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().optional(), 
  confirmPassword: z.string().optional(), 
  displayName: z.string().min(2, "Display name must be at least 2 characters.").max(50),
  fullName: z.string().min(2, "Full name must be at least 2 characters.").max(100),
  employeeId: z.string().max(50).optional(), 
  joiningDate: z.string().optional().refine(val => val === "" || !val || !isNaN(new Date(val).getTime()), { message: "Invalid date format. Please use YYYY-MM-DD or leave empty."}), 
  role: z.string().optional(), 
  accountStatus: z.boolean().default(true), 
})
.refine((data) => {
  if (data.password) {
    if (!data.confirmPassword) return false; 
    return data.password === data.confirmPassword;
  }
  return true; 
}, {
  message: "Passwords don't match or confirmation is missing.",
  path: ["confirmPassword"],
})
.superRefine((data, ctx) => {
    if (data.password) { 
        if (!data.email || data.email.trim() === "") {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Email is required for new users.", path: ["email"]});
        }
        if (!data.employeeId || data.employeeId.trim() === "") {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Employee ID is required for new users.", path: ["employeeId"]});
        }
        if (!data.fullName || data.fullName.trim() === "") {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Full name is required for new users.", path: ["fullName"]});
        }
         if (!data.displayName || data.displayName.trim() === "") {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Display name is required for new users.", path: ["displayName"]});
        }
    }
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

  const [searchTerm, setSearchTerm] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<SpecificRole | "all">("all");
  const [statusFilter, setStatusFilter] = React.useState<AccountStatus | "all">("all");

  const form = useForm<ManageUserFormValues>({
    resolver: zodResolver(manageUserFormSchema),
    defaultValues: {
        email: "",
        password: "",
        confirmPassword: "",
        displayName: "",
        fullName: "",
        employeeId: "",
        joiningDate: "",
        role: "", 
        accountStatus: true, 
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

  const filteredUsers = React.useMemo(() => {
    return usersList
      .filter(u => {
        if (roleFilter !== "all" && u.role !== roleFilter) {
          return false;
        }
        if (statusFilter !== "all" && u.accountStatus !== statusFilter) {
          return false;
        }
        if (searchTerm) {
          const lowercasedTerm = searchTerm.toLowerCase();
          return (
            (u.email || "").toLowerCase().includes(lowercasedTerm) ||
            (u.fullName || "").toLowerCase().includes(lowercasedTerm) ||
            (u.displayName || "").toLowerCase().includes(lowercasedTerm) ||
            (u.employeeId || "").toLowerCase().includes(lowercasedTerm)
          );
        }
        return true;
      });
  }, [usersList, searchTerm, roleFilter, statusFilter]);

  const handleOpenCreateUserDialog = () => {
    setIsCreateMode(true);
    setCurrentUserToManage(null);
    form.reset({ 
        email: "",
        password: "",
        confirmPassword: "",
        displayName: "",
        fullName: "",
        employeeId: "",
        joiningDate: new Date().toISOString().split('T')[0], 
        role: "",
        accountStatus: true, 
    });
    setIsManageUserDialogOpen(true);
  };

  const handleOpenEditUserDialog = (userToEdit: UserDocument) => {
    setIsCreateMode(false);
    setCurrentUserToManage(userToEdit);
    
    let formJoiningDate = "";
    if (userToEdit.joiningDate) {
        try {
            const dateObj = new Date(userToEdit.joiningDate);
            if (!isNaN(dateObj.getTime())) { 
                formJoiningDate = dateObj.toISOString().split('T')[0];
            } else {
                console.warn(`Invalid joiningDate '${userToEdit.joiningDate}' for user ${userToEdit.uid}. Resetting to empty.`);
            }
        } catch (e) {
            console.error(`Error parsing joiningDate '${userToEdit.joiningDate}' for user ${userToEdit.uid}:`, e);
        }
    }

    form.reset({ 
        email: userToEdit.email || "",
        displayName: userToEdit.displayName || "",
        fullName: userToEdit.fullName || "",
        employeeId: userToEdit.employeeId || "",
        joiningDate: formJoiningDate,
        role: userToEdit.role || "", 
        accountStatus: userToEdit.accountStatus === 'active' || userToEdit.accountStatus === undefined, 
        password: "", 
        confirmPassword: "",
    });
    setIsManageUserDialogOpen(true);
  };

    const handleFormSubmit = async (data: ManageUserFormValues) => {
        if (!user || !auth) {
            toast({ title: "Unauthorized", description: "You do not have permission to perform this action.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            if (isCreateMode) {
                if (!data.email || !data.password) {
                    throw new Error("Email and password are required to create a user.");
                }

                const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
                const newUid = userCredential.user.uid;

                const userDocRef = doc(db, "users", newUid);
                await setDoc(userDocRef, {
                    uid: newUid,
                    email: data.email,
                    displayName: data.displayName,
                    fullName: data.fullName,
                    employeeId: data.employeeId,
                    joiningDate: data.joiningDate || null,
                    role: data.role || 'other',
                    accountStatus: data.accountStatus ? 'active' : 'inactive',
                    createdAt: serverTimestamp(),
                    lastLogin: null,
                });

                await logAuditEvent({
                    userId: user.uid,
                    userEmail: user.email,
                    actionType: "CREATE_USER",
                    entityType: "USER",
                    entityId: newUid,
                    details: { email: data.email, role: data.role },
                });

                toast({ title: "User Created", description: `User ${data.email} has been created.` });

            } else if (currentUserToManage) {
                const userDocRef = doc(db, "users", currentUserToManage.uid);
                await updateDoc(userDocRef, {
                    displayName: data.displayName,
                    fullName: data.fullName,
                    employeeId: data.employeeId,
                    joiningDate: data.joiningDate || null,
                    role: data.role || 'other',
                    accountStatus: data.accountStatus ? 'active' : 'inactive',
                });
                
                await logAuditEvent({
                    userId: user.uid,
                    userEmail: user.email,
                    actionType: "UPDATE_USER",
                    entityType: "USER",
                    entityId: currentUserToManage.uid,
                    details: { email: data.email, role: data.role },
                });
                toast({ title: "User Updated", description: `User ${data.email} has been updated.` });
            }
            fetchUsers();
            setIsManageUserDialogOpen(false);
        } catch (error: any) {
            console.error("Error managing user:", error);
            const errorMessage = error.code === 'auth/email-already-in-use' 
                ? "This email address is already in use by another account."
                : error.message || "An unexpected error occurred.";
            toast({ title: "Operation Failed", description: errorMessage, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

  const getRoleBadgeVariant = (role?: SpecificRole | null): BadgeCvaVariantProps["variant"] => {
    switch (role) {
      case "admin": return "destructive";
      case "purser": return "default"; 
      case "cabin crew": return "secondary";
      case "instructor": return "default"; 
      case "pilote": return "default";    
      case "other": return "outline";
      default: return "outline";
    }
  };

  const getStatusBadgeVariant = (status?: AccountStatus | null): BadgeCvaVariantProps["variant"] => {
    switch (status) {
        case "active": return "success";
        case "inactive": return "destructive";
        default: return "outline";
    }
  };
  
  const formatDateDisplay = (dateString?: string | null) => {
    if (!dateString) return "N/A"; 
    try {
        const dateObj = new Date(dateString);
        if (isNaN(dateObj.getTime())) return "Invalid Date";
        return format(dateObj, "MMM d, yyyy"); 
    } catch (e) {
        return dateString; 
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
        <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <CardTitle className="text-2xl font-headline flex items-center">
              <Users className="mr-3 h-7 w-7 text-primary" />
              User Management
            </CardTitle>
            <CardDescription>View, create, and manage user accounts, their roles, and status.</CardDescription>
          </div>
          <div className="flex gap-2 w-full md:w-auto mt-4 md:mt-0">
            <Button variant="outline" onClick={fetchUsers} disabled={isLoading} className="flex-1 md:flex-initial">
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={handleOpenCreateUserDialog} className="flex-1 md:flex-initial">
              <PlusCircle className="mr-2 h-4 w-4" /> Create User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="p-4 mb-4 text-sm text-destructive-foreground bg-destructive rounded-md flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> {error}
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-grow">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Search by email, name, ID..."
                    className="pl-8 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as any)}>
                <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {availableRoles.map(role => <SelectItem key={role} value={role} className="capitalize">{role}</SelectItem>)}
                </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
                <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
            </Select>
          </div>

          {isLoading && usersList.length === 0 && (
             <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Loading user list...</p>
            </div>
          )}
          {!isLoading && filteredUsers.length === 0 && !error && (
            <p className="text-muted-foreground text-center py-8">No users found matching your criteria.</p>
          )}

          {filteredUsers.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Joining Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u.uid}>
                      <TableCell className="font-medium">{u.email || 'N/A'}</TableCell>
                      <TableCell>{u.fullName || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(u.role)} className="capitalize">
                          {u.role || 'Not Assigned'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(u.accountStatus)} className="capitalize">
                          {u.accountStatus || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>{u.employeeId || 'N/A'}</TableCell>
                      <TableCell>{formatDateDisplay(u.joiningDate)}</TableCell>
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
        <DialogContent className="sm:max-w-lg">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)}>
              <DialogHeader>
                <DialogTitle>{isCreateMode ? "Create New User" : `Edit User: ${currentUserToManage?.displayName || currentUserToManage?.email}`}</DialogTitle>
                <DialogPrimitiveDescription>
                  {isCreateMode ? "Fill in the details for the new user." : "Modify the user's information below."}
                </DialogPrimitiveDescription>
              </DialogHeader>
              <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email{isCreateMode ? "*" : ""}</FormLabel>
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
                          <FormLabel>Password*</FormLabel>
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
                          <FormLabel>Confirm Password*</FormLabel>
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
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name{isCreateMode ? "*" : ""}</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Johnathan Doe" {...field} />
                      </FormControl>
                       <UiFormDescription>The user's full legal name.</UiFormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name{isCreateMode ? "*" : ""}</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., John D." {...field} />
                      </FormControl>
                      <UiFormDescription>This name will be shown publicly and in greetings.</UiFormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employee ID{isCreateMode ? "*" : ""}</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., EMP12345" {...field} />
                      </FormControl>
                      <UiFormDescription>Unique company identifier for the employee.</UiFormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="joiningDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Joining Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <UiFormDescription>Optional. When the user joined the company.</UiFormDescription>
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
                            value={field.value || NO_ROLE_SENTINEL} 
                        >
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {availableRoles.map(roleValue => (
                                <SelectItem key={roleValue} value={roleValue} className="capitalize">{roleValue}</SelectItem>
                            ))}
                            <SelectItem value={NO_ROLE_SENTINEL}><em>(Remove Role / Default)</em></SelectItem>
                            </SelectContent>
                        </Select>
                        <UiFormDescription>Assign a system role or leave as default for standard user permissions.</UiFormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                 />
                <FormField
                  control={form.control}
                  name="accountStatus"
                  render={({ field }) => (
                    <FormItem className="flex flex-col rounded-lg border p-3 shadow-sm">
                      <FormLabel>Account Status</FormLabel>
                      <div className="flex items-center space-x-2">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            aria-label="Account status toggle"
                          />
                        </FormControl>
                        {field.value ? <Power className="h-5 w-5 text-success" /> : <PowerOff className="h-5 w-5 text-destructive" />}
                        <span className={cn("font-medium", field.value ? "text-success" : "text-destructive")}>
                          {field.value ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <UiFormDescription>Controls if the user account is active or inactive in the application.</UiFormDescription>
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
