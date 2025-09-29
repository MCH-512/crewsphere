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
import { Users, Loader2, AlertTriangle, Edit, PlusCircle, Eye, Filter, Search } from "lucide-react"; 
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
  const [usersList, setUsersList] = React.useState&lt;User[]&gt;(initialUsers);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState&lt;string | null&gt;(null);

  const [isManageUserDialogOpen, setIsManageUserDialogOpen] = React.useState(false);
  const [isCreateMode, setIsCreateMode] = React.useState(false);
    const [currentUserToManage, setCurrentUserToManage] = React.useState&lt;User | null&gt;(null);
  
  const [searchTerm, setSearchTerm] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState&lt;SpecificRole | "all"&gt;("all");
  const [statusFilter, setStatusFilter] = React.useState&lt;AccountStatus | "all"&gt;("all");

  const [sortColumn, setSortColumn] = React.useState&lt;SortableColumn&gt;("fullName");
  const [sortDirection, setSortDirection] = React.useState&lt;SortDirection&gt;("asc");
  
  React.useEffect(() =&gt; {
    if (!user) return;

    setIsLoading(true);
    const q = query(collection(db, "users"), orderBy("email", "asc"));

    const unsubscribe = onSnapshot(q, 
      (snapshot) =&gt; {
        const fetchedUsers = snapshot.docs.map(doc =&gt; ({ uid: doc.id, ...doc.data() } as User));
        setUsersList(fetchedUsers);
        setError(null);
        setIsLoading(false);
      },
      (err) =&gt; {
        console.error("Error fetching users in real-time:", err);
        setError("Could not fetch real-time user updates.");
        toast({ title: "Real-time Error", description: "Could not fetch user updates.", variant: "destructive" });
        setIsLoading(false);
      }
    );

    // Cleanup subscription on component unmount
    return () =&gt; unsubscribe();
  }, [user, toast]);
  
  React.useEffect(() =&gt; {
    if (!authLoading &amp;&amp; !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  const filteredAndSortedUsers = React.useMemo(() =&gt; {
    const filtered = usersList
      .filter(u =&gt; {
        if (roleFilter !== "all" &amp;&amp; u.role !== roleFilter) return false;
        if (statusFilter !== "all" &amp;&amp; u.accountStatus !== statusFilter) return false;
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

    return filtered.sort((a, b) =&gt; {
        const valA = a[sortColumn];
        const valB = b[sortColumn];
        let comparison = 0;
        
        comparison = String(valA || '').localeCompare(String(valB || ''));
        
        return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [usersList, searchTerm, roleFilter, statusFilter, sortColumn, sortDirection]);

  const handleSort = (column: SortableColumn) =&gt; {
    if (sortColumn === column) {
      setSortDirection(prev =&gt; prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleOpenCreateUserDialog = () =&gt; {
    setIsCreateMode(true);
    setCurrentUserToManage(null);
    setIsManageUserDialogOpen(true);
  };

  const handleOpenEditUserDialog = (userToEdit: User) =&gt; {
    setIsCreateMode(false);
    setCurrentUserToManage(userToEdit);
    setIsManageUserDialogOpen(true);
  };
  
  const onFormSubmitSuccess = () =&gt; {
      // The real-time listener will automatically update the state, no need for manual refresh.
      setIsManageUserDialogOpen(false);
  }

  if (authLoading || isLoading) {
    return (
      &lt;div className="flex items-center justify-center min-h-[calc(100vh-200px)]"&gt;
        &lt;Loader2 className="h-12 w-12 animate-spin text-primary" /&gt;
        &lt;p className="ml-4 text-lg text-muted-foreground"&gt;Loading users...&lt;/p&gt;
      &lt;/div&gt;
    );
  }

  if (!user || user.role !== 'admin') {
     return (
      &lt;div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center"&gt;
        &lt;AlertTriangle className="h-12 w-12 text-destructive mb-4" /&gt;
        &lt;CardTitle className="text-xl mb-2"&gt;Access Denied&lt;/CardTitle&gt;
        &lt;p className="text-muted-foreground"&gt;You do not have permission to view this page.&lt;/p&gt;
        &lt;Button onClick={() =&gt; router.push('/')} className="mt-4"&gt;Go to Dashboard&lt;/Button&gt;
      &lt;/div&gt;
    );
  }

  return (
    &lt;div className="space-y-6"&gt;
      &lt;Card className="shadow-lg"&gt;
        &lt;CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"&gt;
          &lt;div&gt;
            &lt;CardTitle className="text-2xl font-headline flex items-center"&gt;
              &lt;Users className="mr-3 h-7 w-7 text-primary" /&gt;
              User Management
            &lt;/CardTitle&gt;
            &lt;CardDescription&gt;View, create, and manage user accounts, their roles, and status.&lt;/CardDescription&gt;
          &lt;/div&gt;
          &lt;div className="flex gap-2 w-full sm:w-auto"&gt;
            &lt;Button onClick={handleOpenCreateUserDialog} className="flex-1 sm:flex-auto"&gt;
              &lt;PlusCircle className="mr-2 h-4 w-4" /&gt; Create User
            &lt;/Button&gt;
          &lt;/div&gt;
        &lt;/CardHeader&gt;
        &lt;CardContent&gt;
          {error &amp;&amp; (
            &lt;div className="p-4 mb-4 text-sm text-destructive-foreground bg-destructive rounded-md flex items-center gap-2"&gt;
              &lt;AlertTriangle className="h-5 w-5" /&gt; {error}
            &lt;/div&gt;
          )}

          &lt;div className="flex flex-col md:flex-row gap-4 mb-6"&gt;
            &lt;div className="relative flex-grow"&gt;
                &lt;Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /&gt;
                &lt;Input
                    type="search"
                    placeholder="Search by email, name, ID..."
                    className="pl-8 w-full"
                    value={searchTerm}
                    onChange={(e) =&gt; setSearchTerm(e.target.value)}
                /&gt;
            &lt;/div&gt;
            &lt;Select value={roleFilter} onValueChange={(value) =&gt; setRoleFilter(value === NO_ROLE_SENTINEL ? "all" : value as SpecificRole | 'all')}&gt;
                &lt;SelectTrigger className="w-full md:w-[180px]"&gt;
                    &lt;Filter className="h-4 w-4 mr-2" /&gt;
                    &lt;SelectValue placeholder="Filter by role" /&gt;
                &lt;/SelectTrigger&gt;
                &lt;SelectContent&gt;
                    &lt;SelectItem value="all"&gt;All Roles&lt;/SelectItem&gt;
                    {availableRoles.map(role =&gt; &lt;SelectItem key={role} value={role} className="capitalize"&gt;{role}&lt;/SelectItem&gt;)}
                    &lt;SelectItem value={NO_ROLE_SENTINEL}&gt;Not Assigned&lt;/SelectItem&gt;
                &lt;/SelectContent&gt;
            &lt;/Select&gt;
            &lt;Select value={statusFilter} onValueChange={(value) =&gt; setStatusFilter(value as AccountStatus | 'all')}&gt;
                &lt;SelectTrigger className="w-full md:w-[180px]"&gt;
                     &lt;Filter className="h-4 w-4 mr-2" /&gt;
                    &lt;SelectValue placeholder="Filter by status" /&gt;
                &lt;/SelectTrigger&gt;
                &lt;SelectContent&gt;
                    &lt;SelectItem value="all"&gt;All Statuses&lt;/SelectItem&gt;
                    &lt;SelectItem value="active"&gt;Active&lt;/SelectItem&gt;
                    &lt;SelectItem value="inactive"&gt;Inactive&lt;/SelectItem&gt;
                &lt;/SelectContent&gt;
            &lt;/Select&gt;
          &lt;/div&gt;

          {filteredAndSortedUsers.length &gt; 0 ? (
            &lt;div className="rounded-md border"&gt;
              &lt;Table&gt;
                &lt;TableHeader&gt;
                  &lt;TableRow&gt;
                    &lt;SortableHeader column="fullName" label="Full Name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /&gt;
                    &lt;TableHead&gt;Email&lt;/TableHead&gt;
                    &lt;SortableHeader column="role" label="Role" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /&gt;
                    &lt;SortableHeader column="accountStatus" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /&gt;
                    &lt;SortableHeader column="employeeId" label="Employee ID" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /&gt;
                    &lt;TableHead className="text-right"&gt;Actions&lt;/TableHead&gt;
                  &lt;/TableRow&gt;
                &lt;/TableHeader&gt;
                &lt;TableBody&gt;
                  {filteredAndSortedUsers.map((u) =&gt; (
                    &lt;TableRow key={u.uid}&gt;
                      &lt;TableCell className="font-medium"&gt;{u.fullName || 'N/A'}&lt;/TableCell&gt;
                      &lt;TableCell&gt;{u.email || 'N/A'}&lt;/TableCell&gt;
                      &lt;TableCell&gt;
                        &lt;Badge variant={getRoleBadgeVariant(u.role)} className="capitalize"&gt;
                          {u.role || 'Not Assigned'}
                        &lt;/Badge&gt;
                      &lt;/TableCell&gt;
                      &lt;TableCell&gt;
                        &lt;Badge variant={getStatusBadgeVariant(u.accountStatus)} className="capitalize"&gt;
                          {u.accountStatus || 'Unknown'}
                        &lt;/Badge&gt;
                      &lt;/TableCell&gt;
                      &lt;TableCell&gt;{u.employeeId || 'N/A'}&lt;/TableCell&gt;
                      &lt;TableCell className="text-right space-x-1"&gt;
                        &lt;Button variant="ghost" size="icon" title="View User Details" asChild&gt;
                          &lt;Link href={`/admin/users/${u.uid}`}&gt;&lt;Eye className="h-4 w-4"/&gt;&lt;/Link&gt;
                        &lt;/Button&gt;
                        &lt;Button variant="ghost" size="icon" title="Edit User" onClick={() =&gt; handleOpenEditUserDialog(u)}&gt;
                          &lt;Edit className="h-4 w-4" /&gt;
                        &lt;/Button&gt;
                      &lt;/TableCell&gt;
                    &lt;/TableRow&gt;
                  ))}&lt;/TableBody&gt;
              &lt;/Table&gt;
            &lt;/div&gt;
          ) : (
             &lt;p className="text-muted-foreground text-center py-8"&gt;No users found matching your criteria.&lt;/p&gt;
          )}

        &lt;/CardContent&gt;
      &lt;/Card&gt;

      &lt;Dialog open={isManageUserDialogOpen} onOpenChange={setIsManageUserDialogOpen}&gt;
        &lt;DialogContent className="sm:max-w-lg"&gt;
          &lt;UserForm 
            isCreateMode={isCreateMode} 
            currentUser={currentUserToManage}
            onFormSubmitSuccess={onFormSubmitSuccess} 
          /&gt;
        &lt;/DialogContent&gt;
      &lt;/Dialog&gt;
    &lt;/div&gt;
  );
}
