
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { FileSignature, Loader2, AlertTriangle, RefreshCw, Eye, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { VariantProps } from "class-variance-authority"; 
import { StoredPurserReport } from "@/schemas/purser-report-schema";
import Link from "next/link";
import { SortableHeader } from "@/components/custom/custom-sortable-header";
import { fetchPurserReports } from "@/services/report-service";

type SortableColumn = "createdAt" | "status" | "flightNumber" | "flightDate";
type SortDirection = "asc" | "desc";
type ReportStatus = StoredPurserReport['status'];

const reportStatuses: ReportStatus[] = ["submitted", "under-review", "closed"];
const statusOrder: Record<ReportStatus, number> = { "submitted": 0, "under-review": 1, "closed": 2 };

export function PurserReportsClient({ initialReports }: { initialReports: StoredPurserReport[] }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [allReports, setAllReports] = React.useState<StoredPurserReport[]>(initialReports); 
  const [filteredAndSortedReports, setFilteredAndSortedReports] = React.useState<StoredPurserReport[]>(initialReports); 
  const [isLoading, setIsLoading] = React.useState(false); // For client-side refresh only
  const [error, setError] = React.useState<string | null>(null);
  
  const [statusFilter, setStatusFilter] = React.useState<ReportStatus | "all">("all");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [sortColumn, setSortColumn] = React.useState<SortableColumn>("createdAt");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc");

  const refreshReports = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedReports = await fetchPurserReports();
      setAllReports(fetchedReports); 
      toast({ title: "Reports Refreshed", description: "The list has been updated."});
    } catch (err) {
      console.error("Error refreshing reports:", err);
      setError("Failed to load purser reports. Please try again.");
      toast({ title: "Loading Error", description: "Could not refresh reports.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/');
    }
  }, [user, authLoading, router]);
  
  React.useEffect(() => {
    let processedReports = [...allReports];

    if (statusFilter !== "all") {
      processedReports = processedReports.filter(report => report.status === statusFilter);
    }

    if (searchTerm !== "") {
      const lowercasedFilter = searchTerm.toLowerCase();
      processedReports = processedReports.filter(report =>
        report.flightNumber.toLowerCase().includes(lowercasedFilter) ||
        report.userEmail.toLowerCase().includes(lowercasedFilter) ||
        report.departureAirport.toLowerCase().includes(lowercasedFilter) ||
        report.arrivalAirport.toLowerCase().includes(lowercasedFilter)
      );
    }

    processedReports.sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case "createdAt": comparison = a.createdAt.toMillis() - b.createdAt.toMillis(); break;
        case "flightDate": comparison = new Date(a.flightDate).getTime() - new Date(b.flightDate).getTime(); break;
        case "status": comparison = statusOrder[a.status] - statusOrder[b.status]; break;
        case "flightNumber": comparison = a.flightNumber.localeCompare(b.flightNumber); break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
    
    setFilteredAndSortedReports(processedReports);
  }, [allReports, statusFilter, searchTerm, sortColumn, sortDirection]);

  const getStatusBadgeVariant = (status: ReportStatus): VariantProps<typeof badgeVariants>["variant"] => {
    switch (status) {
      case "submitted": return "secondary";
      case "closed": return "success"; 
      case "under-review": return "outline";
      default: return "secondary";
    }
  };
  
  const handleSort = (column: SortableColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection(column === "createdAt" || column === "flightDate" ? "desc" : "asc"); 
    }
  };

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
   if (!user || user.role !== 'admin') {
    return <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center"><AlertTriangle className="h-12 w-12 text-destructive mb-4" /><CardTitle className="text-xl mb-2">Access Denied</CardTitle><p className="text-muted-foreground">You do not have permission to view this page.</p><Button onClick={() => router.push('/')} className="mt-4">Go to Dashboard</Button></div>;
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start gap-3">
          <div>
            <CardTitle className="text-2xl font-headline flex items-center">
              <FileSignature className="mr-3 h-7 w-7 text-primary" />
              Manage Purser Reports
            </CardTitle>
            <CardDescription>Review, prioritize, and respond to all reports submitted by pursers.</CardDescription>
          </div>
          <Button variant="outline" onClick={refreshReports} disabled={isLoading} className="w-full sm:w-auto">
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-grow md:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="Search by flight, email, airport..." className="pl-8 w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ReportStatus | "all")}>
                <SelectTrigger className="w-full md:w-[180px]"><Filter className="mr-2 h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Filter by status" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {reportStatuses.map(status => (<SelectItem key={status} value={status} className="capitalize">{status.replace('-', ' ')}</SelectItem>))}
                </SelectContent>
            </Select>
          </div>

          {error && <div className="p-4 mb-4 text-sm text-destructive-foreground bg-destructive rounded-md flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> {error}</div>}
          
          {isLoading && allReports.length === 0 && <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-3 text-muted-foreground">Loading reports...</p></div>}
          
          {!isLoading && filteredAndSortedReports.length === 0 && !error && <p className="text-muted-foreground text-center py-8">No reports found{statusFilter !== "all" ? ` with status: ${statusFilter}` : ""}{searchTerm ? ` matching "${searchTerm}"` : ""}.</p>}

          {filteredAndSortedReports.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader<SortableColumn> column="flightDate" label="Flight Date" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableHeader<SortableColumn> column="flightNumber" label="Flight #" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                    <TableHead>Route</TableHead>
                    <TableHead>Submitted By</TableHead>
                    <SortableHeader<SortableColumn> column="createdAt" label="Submitted At" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableHeader<SortableColumn> column="status" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedReports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="text-xs">{format(new Date(report.flightDate), "PP")}</TableCell>
                      <TableCell className="font-medium text-xs">{report.flightNumber}</TableCell>
                      <TableCell className="text-xs">{report.departureAirport} → {report.arrivalAirport}</TableCell>
                      <TableCell className="text-xs">
                         <Link href={`/admin/users/${report.userId}`} className="hover:underline text-primary">
                            {report.userEmail}
                          </Link>
                      </TableCell>
                      <TableCell className="text-xs">{format(report.createdAt.toDate(), "PPp")}</TableCell>
                      <TableCell><Badge variant={getStatusBadgeVariant(report.status)} className="capitalize">{report.status.replace('-', ' ')}</Badge></TableCell>
                      <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => router.push(`/admin/purser-reports/${report.id}`)}><Eye className="mr-1 h-4 w-4" /> View Details</Button></TableCell>
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
