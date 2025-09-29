"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { FileCheck2, Loader2, AlertTriangle, RefreshCw, Eye, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { StoredUserDocument, UserDocumentStatus } from "@/schemas/user-document-schema";
import { logAuditEvent } from "@/lib/audit-logger";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDocumentsForValidation } from "@/services/document-service";

interface DocumentValidationsClientProps {
    initialDocuments: StoredUserDocument[];
}

export function DocumentValidationsClient({ initialDocuments }: DocumentValidationsClientProps) {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [documents, setDocuments] = React.useState<StoredUserDocument[]>(initialDocuments);
    const [isLoading, setIsLoading] = React.useState(false); // For manual refresh
    const [isUpdating, setIsUpdating] = React.useState<string | null>(null);

    const fetchDocuments = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const freshDocs = await getDocumentsForValidation();
            setDocuments(freshDocs);
            toast({ title: "Documents Refreshed", description: "The list of documents has been updated." });
        } catch (err: unknown) {
            toast({ title: "Loading Error", description: "Could not refresh user documents.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        if (!authLoading && (!user || user.role !== 'admin')) {
            router.push('/');
        }
    }, [user, authLoading, router]);

    const handleApprove = async (docToApprove: StoredUserDocument) => {
        if (!user) return;
        setIsUpdating(docToApprove.id);
        try {
            const docRef = doc(db, "userDocuments", docToApprove.id);
            await updateDoc(docRef, { status: 'approved' });
            await logAuditEvent({ userId: user.uid, userEmail: user.email!, actionType: "APPROVE_USER_DOCUMENT", entityType: "USER_DOCUMENT", entityId: docToApprove.id });
            toast({ title: "Document Approved", description: `${docToApprove.documentName} for ${docToApprove.userEmail} has been marked as approved.` });
            fetchDocuments();
        } catch (error: unknown) {
            toast({ title: "Approval Failed", variant: "destructive" });
        } finally {
            setIsUpdating(null);
        }
    };

    const filterDocsByStatus = (status: UserDocumentStatus) => documents.filter(d => d.status === status);

    const DocumentTable = ({ docs }: { docs: StoredUserDocument[] }) => (
        <div className="rounded-md border">
            <Table>
                <TableHeader><TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>Expires On</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                    {docs.map(d => (
                        <TableRow key={d.id}>
                            <TableCell className="text-xs font-medium"><Link href={`/admin/users/${d.userId}`} className="hover:underline">{d.userEmail}</Link></TableCell>
                            <TableCell className="text-xs">{d.documentName}</TableCell>
                            <TableCell className="text-xs font-mono">{format(d.expiryDate.toDate(), "PP")}</TableCell>
                            <TableCell className="text-xs">{format(d.lastUpdatedAt.toDate(), "PPp")}</TableCell>
                            <TableCell className="space-x-1 text-right">
                                {d.fileURL && (
                                    <Button variant="ghost" size="icon" asChild>
                                        <a href={d.fileURL} target="_blank" rel="noopener noreferrer" title="View Document"><Eye className="h-4 w-4"/></a>
                                    </Button>
                                )}
                                {d.status === 'pending-validation' && (
                                    <Button size="sm" onClick={() => handleApprove(d)} disabled={isUpdating === d.id}>
                                        {isUpdating === d.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4"/>}
                                        Approve
                                    </Button>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}</TableBody>
            </Table>
        </div>
    );

    if (authLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    
     if (!user || user.role !== 'admin') {
        return <div className="flex flex-col items-center justify-center min-h-screen text-center p-4"><AlertTriangle className="h-16 w-16 text-destructive mb-4" /><CardTitle className="text-2xl mb-2">Access Denied</CardTitle><p className="text-muted-foreground">You do not have permission to view this page.</p><Button onClick={() => router.push('/')} className="mt-6">Go to Dashboard</Button></div>;
    }


    const pendingDocs = filterDocsByStatus('pending-validation');
    const approvedDocs = filterDocsByStatus('approved');

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader className="flex flex-row justify-between items-start">
                    <div>
                        <CardTitle className="text-2xl font-headline flex items-center"><FileCheck2 className="mr-3 h-7 w-7 text-primary" />Document Validation</CardTitle>
                        <CardDescription>Review and approve documents updated or submitted by users.</CardDescription>
                    </div>
                    <Button variant="outline" onClick={fetchDocuments} disabled={isLoading}><RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />Refresh</Button>
                </CardHeader>
            </Card>

            <Tabs defaultValue="pending">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="pending">
                        Pending Validation
                        <Badge variant={pendingDocs.length > 0 ? "destructive" : "secondary"} className="ml-2">{pendingDocs.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="approved">Approved</TabsTrigger>
                </TabsList>
                <TabsContent value="pending">
                    <Card><CardContent className="pt-6">
                        {pendingDocs.length > 0 ? (
                            <DocumentTable docs={pendingDocs} />
                        ) : (
                            <p className="text-center text-muted-foreground py-8">No documents are currently awaiting validation.</p>
                        )}
                    </CardContent></Card>
                </TabsContent>
                <TabsContent value="approved">
                    <Card><CardContent className="pt-6">
                         {approvedDocs.length > 0 ? (
                            <DocumentTable docs={approvedDocs} />
                        ) : (
                            <p className="text-center text-muted-foreground py-8">No documents have been approved yet.</p>
                        )}
                    </CardContent></Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
