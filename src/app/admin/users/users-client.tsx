
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; 
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { Users, Loader2, AlertTriangle, RefreshCw, Edit, PlusCircle, Eye, Filter, Search } from "lucide-react"; 
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge"; 
import Link from 'next/link';
import { SortableHeader } from "@/components/custom/custom-sortable-header";
import type { User, SpecificRole, AccountStatus } from "@/schemas/user-schema";
import { getRoleBadgeVariant, getStatusBadgeVariant, availableRoles } from "@/schemas/user-schema";
import { UserForm } from "@/components/admin/user-form";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

const NO_ROLE_SENTINEL = "_NONE_"; 

type SortableColumn = "fullName" | "role" | "accountStatus" | "employeeId";
type SortDirection = "asc" | 'desc';

export function UsersClient({ initialUsers }: { initialUsers: User[] }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [usersList, setUsersList] = React.useState<User[]>(initialUsers);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [isManageUserDialogOpen, setIsManageUserDialogOpen] = React.useState(false);
  const [isCreateMode, setIsCreateMode] = React.useState(false);
  const [currentUserToManage, setCurrentUserToManage] = React.useState<User | null>(null);
  
  const [searchTerm, setSearchTerm] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<SpecificRole | "all">("all");
  const [statusFilter, setStatusFilter] = React.useState<AccountStatus | "all">("all");

  const [sortColumn, setSortColumn] = React.useState<SortableColumn>("fullName");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("asc");
  
  const loadUsers = React.useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const q = query(collection(db, "users"), orderBy("email", "asc"));
    const unsubscribe = onSnapshot(q,
        (snapshot) => {
            const fetchedUsers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
            setUsersList(fetchedUsers);
            setIsLoading(false);
            setError(null);
        },
        (err) => {
            console.error("Error fetching users in real-time:", err);
            setError("Could not fetch real-time user updates.");
            toast({ title: "Real-time Error", description: "Could not fetch user updates.", variant: "destructive" });
            setIsLoading(false);
        }
    );
    return () => unsubscribe();
  }, [user, toast]);

  React.useEffect(() => {
    loadUsers();
  }, [loadUsers]);
  
  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  const filteredAndSortedUsers = React.useMemo(() => {
    let filtered = usersList
      .filter(u => {
        if (roleFilter !== "all" && u.role !== roleFilter) return false;
        if (statusFilter !== "all" && u.accountStatus !== statusFilter) return false;
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

    return filtered.sort((a, b) => {
        const valA = a[sortColumn];
        const valB = b[sortColumn];
        let comparison = 0;
        
        comparison = String(valA || '').localeCompare(String(valB || ''));
        
        return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [usersList, searchTerm, roleFilter, statusFilter, sortColumn, sortDirection]);

  const handleSort = (column: SortableColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleOpenCreateUserDialog = () => {
    setIsCreateMode(true);
    setCurrentUserToManage(null);
    setIsManageUserDialogOpen(true);
  };

  const handleOpenEditUserDialog = (userToEdit: User) => {
    setIsCreateMode(false);
    setCurrentUserToManage(userToEdit);
    setIsManageUserDialogOpen(true);
  };
  
  const onFormSubmitSuccess = () => {
      // The real-time listener will automatically update the state, no need for manual refresh.
      setIsManageUserDialogOpen(false);
  }

  if (authLoading || isLoading) {
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
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-2xl font-headline flex items-center">
              <Users className="mr-3 h-7 w-7 text-primary" />
              User Management
            </CardTitle>
            <CardDescription>View, create, and manage user accounts, their roles, and status.</CardDescription>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button onClick={handleOpenCreateUserDialog} className="flex-1 sm:flex-auto">
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
            <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as SpecificRole | 'all')}>
                <SelectTrigger className="w-full md:w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {availableRoles.map(role => <SelectItem key={role} value={role} className="capitalize">{role}</SelectItem>)}
                </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as AccountStatus | 'all')}>
                <SelectTrigger className="w-full md:w-[180px]">
                     <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
            </Select>
          </div>

          {filteredAndSortedUsers.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader column="fullName" label="Full Name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                    <TableHead>Email</TableHead>
                    <SortableHeader column="role" label="Role" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableHeader column="accountStatus" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableHeader column="employeeId" label="Employee ID" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedUsers.map((u) => (
                    <TableRow key={u.uid}>
                      <TableCell className="font-medium">{u.fullName || 'N/A'}</TableCell>
                      <TableCell>{u.email || 'N/A'}</TableCell>
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
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" title="View User Details" asChild>
                          <Link href={`/admin/users/${u.uid}`}><Eye className="h-4 w-4"/></Link>
                        </Button>
                        <Button variant="ghost" size="icon" title="Edit User" onClick={() => handleOpenEditUserDialog(u)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
             <p className="text-muted-foreground text-center py-8">No users found matching your criteria.</p>
          )}

        </CardContent>
      </Card>

      <Dialog open={isManageUserDialogOpen} onOpenChange={setIsManageUserDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <UserForm 
            isCreateMode={isCreateMode} 
            currentUser={currentUserToManage}
            onFormSubmitSuccess={onFormSubmitSuccess} 
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
