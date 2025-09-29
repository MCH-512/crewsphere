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

    const fetchDocuments = React.useCallback(async () =&gt; {
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

    React.useEffect(() =&gt; {
        if (!authLoading && (!user || user.role !== 'admin')) {
            router.push('/');
        }
    }, [user, authLoading, router]);

    const handleApprove = async (docToApprove: StoredUserDocument) =&gt; {
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

    const filterDocsByStatus = (status: UserDocumentStatus) =&gt; documents.filter(d =&gt; d.status === status);

    const DocumentTable = ({ docs }: { docs: StoredUserDocument[] }) =&gt; (
        &lt;div className="rounded-md border"&gt;
            &lt;Table&gt;
                &lt;TableHeader&gt;&lt;TableRow&gt;
                    &lt;TableHead&gt;User&lt;/TableHead&gt;
                    &lt;TableHead&gt;Document&lt;/TableHead&gt;
                    &lt;TableHead&gt;Expires On&lt;/TableHead&gt;
                    &lt;TableHead&gt;Last Updated&lt;/TableHead&gt;
                    &lt;TableHead className="text-right"&gt;Actions&lt;/TableHead&gt;
                &lt;/TableRow&gt;&lt;/TableHeader&gt;
                &lt;TableBody&gt;
                    {docs.map(d =&gt; (
                        &lt;TableRow key={d.id}&gt;
                            &lt;TableCell className="text-xs font-medium"&gt;&lt;Link href={`/admin/users/${d.userId}`} className="hover:underline"&gt;{d.userEmail}&lt;/Link&gt;&lt;/TableCell&gt;
                            &lt;TableCell className="text-xs"&gt;{d.documentName}&lt;/TableCell&gt;
                            &lt;TableCell className="text-xs font-mono"&gt;{format(d.expiryDate.toDate(), "PP")}&lt;/TableCell&gt;
                            &lt;TableCell className="text-xs"&gt;{format(d.lastUpdatedAt.toDate(), "PPp")}&lt;/TableCell&gt;
                            &lt;TableCell className="space-x-1 text-right"&gt;
                                {d.fileURL &amp;&amp; (
                                    &lt;Button variant="ghost" size="icon" asChild&gt;
                                        &lt;a href={d.fileURL} target="_blank" rel="noopener noreferrer" title="View Document"&gt;&lt;Eye className="h-4 w-4"/&gt;&lt;/a&gt;
                                    &lt;/Button&gt;
                                )}
                                {d.status === 'pending-validation' &amp;&amp; (
                                    &lt;Button size="sm" onClick={() =&gt; handleApprove(d)} disabled={isUpdating === d.id}&gt;
                                        {isUpdating === d.id ? &lt;Loader2 className="mr-2 h-4 w-4 animate-spin"/&gt; : &lt;CheckCircle className="mr-2 h-4 w-4"/&gt;}
                                        Approve
                                    &lt;/Button&gt;
                                )}
                            &lt;/TableCell&gt;
                        &lt;/TableRow&gt;
                    ))}&lt;/TableBody&gt;
            &lt;/Table&gt;
        &lt;/div&gt;
    );

    if (authLoading) return &lt;div className="flex items-center justify-center min-h-screen"&gt;&lt;Loader2 className="h-12 w-12 animate-spin text-primary" /&gt;&lt;/div&gt;;
    
     if (!user || user.role !== 'admin') {
        return &lt;div className="flex flex-col items-center justify-center min-h-screen text-center p-4"&gt;&lt;AlertTriangle className="h-16 w-16 text-destructive mb-4" /&gt;&lt;CardTitle className="text-2xl mb-2"&gt;Access Denied&lt;/CardTitle&gt;&lt;p className="text-muted-foreground"&gt;You do not have permission to view this page.&lt;/p&gt;&lt;Button onClick={() =&gt; router.push('/')} className="mt-6"&gt;Go to Dashboard&lt;/Button&gt;&lt;/div&gt;;
    }


    const pendingDocs = filterDocsByStatus('pending-validation');
    const approvedDocs = filterDocsByStatus('approved');

    return (
        &lt;div className="space-y-6"&gt;
            &lt;Card className="shadow-lg"&gt;
                &lt;CardHeader className="flex flex-row justify-between items-start"&gt;
                    &lt;div&gt;
                        &lt;CardTitle className="text-2xl font-headline flex items-center"&gt;&lt;FileCheck2 className="mr-3 h-7 w-7 text-primary" /&gt;Document Validation&lt;/CardTitle&gt;
                        &lt;CardDescription&gt;Review and approve documents updated or submitted by users.&lt;/CardDescription&gt;
                    &lt;/div&gt;
                    &lt;Button variant="outline" onClick={fetchDocuments} disabled={isLoading}&gt;&lt;RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /&gt;Refresh&lt;/Button&gt;
                &lt;/CardHeader&gt;
            &lt;/Card&gt;

            &lt;Tabs defaultValue="pending"&gt;
                &lt;TabsList className="grid w-full grid-cols-2"&gt;
                    &lt;TabsTrigger value="pending"&gt;
                        Pending Validation
                        &lt;Badge variant={pendingDocs.length &gt; 0 ? "destructive" : "secondary"} className="ml-2"&gt;{pendingDocs.length}&lt;/Badge&gt;
                    &lt;/TabsTrigger&gt;
                    &lt;TabsTrigger value="approved"&gt;Approved&lt;/TabsTrigger&gt;
                &lt;/TabsList&gt;
                &lt;TabsContent value="pending"&gt;
                    &lt;Card&gt;&lt;CardContent className="pt-6"&gt;
                        {pendingDocs.length &gt; 0 ? (
                            &lt;DocumentTable docs={pendingDocs} /&gt;
                        ) : (
                            &lt;p className="text-center text-muted-foreground py-8"&gt;No documents are currently awaiting validation.&lt;/p&gt;
                        )}
                    &lt;/CardContent&gt;&lt;/Card&gt;
                &lt;/TabsContent&gt;
                &lt;TabsContent value="approved"&gt;
                    &lt;Card&gt;&lt;CardContent className="pt-6"&gt;
                         {approvedDocs.length &gt; 0 ? (
                            &lt;DocumentTable docs={approvedDocs} /&gt;
                        ) : (
                            &lt;p className="text-center text-muted-foreground py-8"&gt;No documents have been approved yet.&lt;/p&gt;
                        )}
                    &lt;/CardContent&gt;&lt;/Card&gt;
                &lt;/TabsContent&gt;
            &lt;/Tabs&gt;
        &lt;/div&gt;
    );
}
