
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Users, Loader2, AlertTriangle, RefreshCw, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UserDocument {
  uid: string; // Document ID from Firestore, which is the user's UID
  email?: string; // Email, might be stored in the document
  role?: 'admin' | 'purser' | 'crew' | string; // Role
  displayName?: string; // Display name
  lastLogin?: Timestamp; // Last login timestamp
  createdAt?: Timestamp; // Account creation timestamp from Firestore doc
}

export default function AdminUsersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [usersList, setUsersList] = React.useState<UserDocument[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchUsers = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Assuming 'users' collection where document ID is UID
      const q = query(collection(db, "users"), orderBy("email", "asc")); // Order by email if available
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

  // Placeholder for future edit role functionality
  const handleEditRole = (userToEdit: UserDocument) => {
    toast({
      title: "Edit Role (Coming Soon)",
      description: `Functionality to edit role for ${userToEdit.email || userToEdit.uid} will be implemented later.`,
    });
  };

  const getRoleBadgeVariant = (role?: string) => {
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
            <CardDescription>View all registered users and their roles.</CardDescription>
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
                        <Badge variant={getRoleBadgeVariant(u.role)} className="capitalize">
                          {u.role || 'Not Assigned'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{u.uid}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEditRole(u)}>
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
    </div>
  );
}
