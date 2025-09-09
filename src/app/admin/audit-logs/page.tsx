"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Activity, Loader2, AlertTriangle, RefreshCw, Search } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface AuditLogDisplayEntry {
  id: string;
  timestamp: Timestamp;
  userId: string;
  userEmail?: string;
  actionType: string;
  entityType?: string;
  entityId?: string;
  details?: string | object;
}

export default function AuditLogsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [logs, setLogs] = React.useState<AuditLogDisplayEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");

  const fetchLogs = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const q = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedLogs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as AuditLogDisplayEntry));
      setLogs(fetchedLogs);
    } catch (err) {
      console.error("Error fetching audit logs:", err);
      setError("Failed to load audit logs. Please try again.");
      toast({ title: "Loading Error", description: "Could not fetch audit logs.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'admin') {
        router.push('/'); 
      } else {
        fetchLogs();
      }
    }
  }, [user, authLoading, router, fetchLogs]);

  const filteredLogs = React.useMemo(() => {
    if (!searchTerm) return logs;
    const lowercasedTerm = searchTerm.toLowerCase();
    return logs.filter(log => {
      const detailsString = typeof log.details === 'object' ? JSON.stringify(log.details) : log.details;
      return (
        (log.userEmail || '').toLowerCase().includes(lowercasedTerm) ||
        log.actionType.toLowerCase().includes(lowercasedTerm) ||
        (log.entityType || '').toLowerCase().includes(lowercasedTerm) ||
        (log.entityId || '').toLowerCase().includes(lowercasedTerm) ||
        (detailsString || '').toLowerCase().includes(lowercasedTerm)
      );
    });
  }, [logs, searchTerm]);

  const formatDetails = (details: string | object | undefined): string => {
    if (typeof details === 'string') return details;
    if (typeof details === 'object' && details !== null) return JSON.stringify(details, null, 2);
    return 'N/A';
  };

  if (authLoading || (isLoading && logs.length === 0 && !user)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading audit logs...</p>
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
              <Activity className="mr-3 h-7 w-7 text-primary" />
              Audit Logs
            </CardTitle>
            <CardDescription>Track important system activities and changes.</CardDescription>
          </div>
          <Button variant="outline" onClick={fetchLogs} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Logs
          </Button>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search logs by user, action, ID..."
                className="pl-8 w-full md:max-w-md"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          {error && (
            <div className="p-4 mb-4 text-sm text-destructive-foreground bg-destructive rounded-md flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> {error}
            </div>
          )}
          {isLoading && logs.length === 0 && (
             <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Loading log entries...</p>
            </div>
          )}
          {!isLoading && filteredLogs.length === 0 && !error && (
            <p className="text-muted-foreground text-center py-8">
              {searchTerm ? `No logs found matching "${searchTerm}".` : "No audit log entries found."}
            </p>
          )}
          {filteredLogs.length > 0 && (
            <ScrollArea className="h-[600px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action Type</TableHead>
                    <TableHead>Entity Type</TableHead>
                    <TableHead>Entity ID</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs">
                        {log.timestamp ? format(log.timestamp.toDate(), "PPpp") : 'N/A'}
                      </TableCell>
                      <TableCell className="text-xs">{log.userEmail || log.userId}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs whitespace-nowrap">{log.actionType}</Badge>
                      </TableCell>
                      <TableCell>{log.entityType || 'N/A'}</TableCell>
                      <TableCell className="text-xs truncate max-w-[100px]" title={log.entityId}>{log.entityId || 'N/A'}</TableCell>
                      <TableCell className="text-xs">
                        <pre className="whitespace-pre-wrap max-w-xs truncate rounded-md bg-muted/50 p-2 font-mono text-xs" title={formatDetails(log.details)}>
                          {formatDetails(log.details)}
                        </pre>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
