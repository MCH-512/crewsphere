
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"; 
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; 
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch"; 
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { Users, Loader2, AlertTriangle, RefreshCw, Edit, PlusCircle, Power, PowerOff, Search, Eye, Filter } from "lucide-react"; 
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge"; 
import Link from 'next/link';
import { Separator } from "@/components/ui/separator";
import { SortableHeader } from "@/components/custom/custom-sortable-header";
import type { User, SpecificRole, AccountStatus, ManageUserFormValues } from "@/schemas/user-schema";
import { manageUserFormSchema, getRoleBadgeVariant, getStatusBadgeVariant, availableRoles } from "@/schemas/user-schema";
import { fetchUsers, manageUser } from "@/services/user-service";
import { CustomAutocompleteAirport } from "@/components/custom/custom-autocomplete-airport";
import { Airport, searchAirports } from "@/services/airport-service";
import { useDebounce } from "@/hooks/use-debounce";

const NO_ROLE_SENTINEL = "_NONE_"; 

type SortableColumn = "fullName" | "role" | "accountStatus" | "employeeId";
type SortDirection = "asc" | 'desc';

export function UsersClient({ initialUsers }: { initialUsers: User[] }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [usersList, setUsersList] = React.useState<User[]>(initialUsers);
  const [isLoading, setIsLoading] = React.useState(false); // Only for client-side re-fetches
  const [error, setError] = React.useState<string | null>(null);

  const [isManageUserDialogOpen, setIsManageUserDialogOpen] = React.useState(false);
  const [isCreateMode, setIsCreateMode] = React.useState(false);
  const [currentUserToManage, setCurrentUserToManage] = React.useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [searchTerm, setSearchTerm] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<SpecificRole | "all">("all");
  const [statusFilter, setStatusFilter] = React.useState<AccountStatus | "all">("all");

  const [sortColumn, setSortColumn] = React.useState<SortableColumn>("fullName");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("asc");
  
  const [airportSearch, setAirportSearch] = React.useState("");
  const [debouncedAirportSearch] = useDebounce(airportSearch, 300);
  const [airportResults, setAirportResults] = React.useState<Airport[]>([]);
  const [isSearchingAirports, setIsSearchingAirports] = React.useState(false);

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
        baseAirport: "",
    }
  });

  const loadUsers = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedUsers = await fetchUsers();
      setUsersList(fetchedUsers);
    } catch (err: any) {
      setError(err.message || "Failed to load users.");
      toast({ title: "Loading Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);
  
  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  React.useEffect(() => {
    if (!debouncedAirportSearch) { setAirportResults([]); return; }
    setIsSearchingAirports(true);
    searchAirports(debouncedAirportSearch).then(res => setAirportResults(res)).finally(() => setIsSearchingAirports(false));
  }, [debouncedAirportSearch]);


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
        baseAirport: "",
    });
    setIsManageUserDialogOpen(true);
  };

  const handleOpenEditUserDialog = (userToEdit: User) => {
    setIsCreateMode(false);
    setCurrentUserToManage(userToEdit);
    
    let formJoiningDate = "";
    if (userToEdit.joiningDate) {
        try {
            //Handles both Timestamps (from Firestore) and string dates
            const dateObj = typeof userToEdit.joiningDate === 'string' ? new Date(userToEdit.joiningDate) : (userToEdit.joiningDate as any).toDate();
            if (!isNaN(dateObj.getTime())) { 
                formJoiningDate = dateObj.toISOString().split('T')[0];
            }
        } catch (e) {
             console.error(`Error parsing joiningDate for user ${userToEdit.uid}:`, e);
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
        baseAirport: userToEdit.baseAirport || "",
        password: "", 
        confirmPassword: "",
    });
    setAirportSearch(userToEdit.baseAirport || "");
    setIsManageUserDialogOpen(true);
  };

    const handleFormSubmit = async (data: ManageUserFormValues) => {
        if (!user) {
            toast({ title: "Unauthorized", description: "You do not have permission to perform this action.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            if (isCreateMode) {
                await manageUser({ isCreate: true, data, adminUser: user });
                toast({ title: "User Created", description: `User ${data.email} has been created.` });

            } else if (currentUserToManage) {
                await manageUser({ isCreate: false, data, userId: currentUserToManage.uid, adminUser: user });
                toast({ title: "User Updated", description: `User ${data.email} has been updated.` });
            }
            loadUsers();
            setIsManageUserDialogOpen(false);
        } catch (error: any) {
            console.error("Error managing user:", error);
            toast({ title: "Operation Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
  
  if (authLoading || (isLoading && usersList.length === 0)) {
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
            <Button variant="outline" onClick={loadUsers} disabled={isLoading} className="flex-1 sm:flex-auto">
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
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
            <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as any)}>
                <SelectTrigger className="w-full md:w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {availableRoles.map(role => <SelectItem key={role} value={role} className="capitalize">{role}</SelectItem>)}
                </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
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
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)}>
              <DialogHeader>
                <DialogTitle>{isCreateMode ? "Create New User" : `Edit User: ${currentUserToManage?.displayName || currentUserToManage?.email}`}</DialogTitle>
                <DialogDescription>
                  {isCreateMode ? "Fill in the details for the new user." : "Modify the user's information below."}
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                 {isCreateMode && (
                  <div className="space-y-4">
                      <h4 className="text-base font-semibold text-muted-foreground">Account Credentials</h4>
                      <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="user@example.com" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                      <FormField control={form.control} name="password" render={({ field }) => (<FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" placeholder="Min. 6 characters" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                      <FormField control={form.control} name="confirmPassword" render={({ field }) => (<FormItem><FormLabel>Confirm Password</FormLabel><FormControl><Input type="password" placeholder="Re-enter password" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                      <Separator/>
                  </div>
                 )}
                  <h4 className="text-base font-semibold text-muted-foreground">Personal & Professional Info</h4>
                  <div className="space-y-4">
                     {!isCreateMode && <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" value={form.getValues("email")} disabled /></FormControl></FormItem>}
                     <FormField control={form.control} name="fullName" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="e.g., Johnathan Doe" {...field} /></FormControl><FormDescription>The user's full legal name.</FormDescription><FormMessage /></FormItem>)}/>
                     <FormField control={form.control} name="displayName" render={({ field }) => (<FormItem><FormLabel>Display Name</FormLabel><FormControl><Input placeholder="e.g., John D." {...field} /></FormControl><FormDescription>This name will be shown publicly and in greetings.</FormDescription><FormMessage /></FormItem>)}/>
                     <FormField control={form.control} name="employeeId" render={({ field }) => (<FormItem><FormLabel>Employee ID</FormLabel><FormControl><Input placeholder="e.g., EMP12345" {...field} /></FormControl><FormDescription>Unique company identifier for the employee.</FormDescription><FormMessage /></FormItem>)}/>
                     <FormField control={form.control} name="joiningDate" render={({ field }) => (<FormItem><FormLabel>Joining Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormDescription>Optional. When the user joined the company.</FormDescription><FormMessage /></FormItem>)}/>
                     <Controller control={form.control} name="baseAirport" render={({ field }) => (<FormItem><FormLabel>Base Airport (ICAO)</FormLabel><CustomAutocompleteAirport value={field.value} onSelect={(airport) => field.onChange(airport?.icao || "")} airports={airportResults} isLoading={isSearchingAirports} onInputChange={setAirportSearch} currentSearchTerm={airportSearch} placeholder="Search base airport..." /><FormDescription>The user's primary base of operations.</FormDescription><FormMessage /></FormItem>)} />
                  </div>

                  <Separator />
                  <h4 className="text-base font-semibold text-muted-foreground">System Role & Status</h4>
                  <div className="space-y-4">
                      <FormField control={form.control} name="role" render={({ field }) => (
                          <FormItem>
                          <FormLabel>Role</FormLabel>
                          <Select onValueChange={(value) => field.onChange(value === NO_ROLE_SENTINEL ? "" : value)} value={field.value || NO_ROLE_SENTINEL} >
                              <FormControl><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl>
                              <SelectContent>
                              {availableRoles.map(roleValue => (<SelectItem key={roleValue} value={roleValue} className="capitalize">{roleValue}</SelectItem>))}
                              <SelectItem value={NO_ROLE_SENTINEL}><em>(Remove Role / Default)</em></SelectItem>
                              </SelectContent>
                          </Select>
                          <FormDescription>Assign a system role or leave as default for standard user permissions.</FormDescription>
                          <FormMessage />
                          </FormItem>
                      )} />
                      <FormField control={form.control} name="accountStatus" render={({ field }) => (
                          <FormItem className="flex flex-col rounded-lg border p-3 shadow-sm">
                          <FormLabel>Account Status</FormLabel>
                          <div className="flex items-center space-x-2">
                              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Account status toggle"/></FormControl>
                              {field.value ? <Power className="h-5 w-5 text-success" /> : <PowerOff className="h-5 w-5 text-destructive" />}
                              <span className={field.value ? "font-medium text-success" : "font-medium text-destructive"}>{field.value ? "Active" : "Inactive"}</span>
                          </div>
                          <FormDescription>Controls if the user account is active or inactive in the application.</FormDescription>
                          <FormMessage />
                          </FormItem>
                      )} />
                  </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
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

    