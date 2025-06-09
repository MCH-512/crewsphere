
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { badgeVariants } from "@/components/ui/badge"; // Ensure badgeVariants is imported
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp, doc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Users, Loader2, AlertTriangle, RefreshCw, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils"; // Ensure cn is imported

interface UserDocument {
  uid: string; 
  email?: string; 
  role?: 'admin' | 'purser' | 'crew' | string; 
  displayName?: string; 
  lastLogin?: Timestamp; 
  createdAt?: Timestamp; 
}

const availableRoles: UserDocument['role'][] = ['admin', 'purser', 'crew'];

export default function AdminUsersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [usersList, setUsersList] = React.useState<UserDocument[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [selectedUserForEdit, setSelectedUserForEdit] = React.useState<UserDocument | null>(null);
  const [isEditRoleDialogOpen, setIsEditRoleDialogOpen] = React.useState(false);
  const [newRole, setNewRole] = React.useState<UserDocument['role'] | "">("");
  const [isUpdatingRole, setIsUpdatingRole] = React.useState(false);

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

  const handleOpenEditRoleDialog = (userToEdit: UserDocument) => {
    setSelectedUserForEdit(userToEdit);
    setNewRole(userToEdit.role || ""); // Pre-fill with current role
    setIsEditRoleDialogOpen(true);
  };

  const handleRoleUpdate = async () => {
    if (!selectedUserForEdit || !newRole || newRole === selectedUserForEdit.role) {
      toast({ title: "No Change", description: "Role is the same or not selected.", variant: "default" });
      setIsEditRoleDialogOpen(false);
      return;
    }
    setIsUpdatingRole(true);
    try {
      const userDocRef = doc(db, "users", selectedUserForEdit.uid);
      await updateDoc(userDocRef, { role: newRole });
      toast({ title: "Role Updated", description: `${selectedUserForEdit.email}'s role changed to ${newRole}.` });
      fetchUsers(); // Re-fetch to update the table
      setIsEditRoleDialogOpen(false);
    } catch (err) {
      console.error("Error updating role:", err);
      toast({ title: "Update Failed", description: "Could not update user role.", variant: "destructive" });
    } finally {
      setIsUpdatingRole(false);
    }
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
        <CardHeader className="flex flex-row justify-between items-start">
          <div>
            <CardTitle className="text-2xl font-headline flex items-center">
              <Users className="mr-3 h-7 w-7 text-primary" />
              User Management
            </CardTitle>
            <CardDescription>View all registered users and manage their roles.</CardDescription>
          </div>
          <Button variant="outline" onClick={fetchUsers} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Users
          </Button>
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
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEditRoleDialog(u)}>
                          <Edit className="mr-1 h-4 w-4" /> Edit Role
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

      {selectedUserForEdit && (
        <Dialog open={isEditRoleDialogOpen} onOpenChange={setIsEditRoleDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Role for {selectedUserForEdit.email}</DialogTitle>
              <DialogDescription>
                Current role: <span className={cn(badgeVariants({ variant: getRoleBadgeVariant(selectedUserForEdit.role) }), "capitalize")}>{selectedUserForEdit.role || 'Not Assigned'}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="role-select">New Role</Label>
                <Select 
                  value={newRole || ""}
                  onValueChange={(value) => setNewRole(value as UserDocument['role'])}
                >
                  <SelectTrigger id="role-select">
                    <SelectValue placeholder="Select new role" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map(role => (
                       <SelectItem key={role} value={role!} className="capitalize">{role}</SelectItem>
                    ))}
                    <SelectItem value=""><em>(Remove Role / Default)</em></SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleRoleUpdate} disabled={isUpdatingRole || !newRole || newRole === selectedUserForEdit.role}>
                {isUpdatingRole && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Role
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
