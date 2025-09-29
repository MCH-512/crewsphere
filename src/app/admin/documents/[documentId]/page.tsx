"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { type User } from "@/schemas/user-schema";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import { Loader2, AlertTriangle, ArrowLeft, FileText, CheckCircle, XCircle, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { StoredDocument } from "@/schemas/document-schema";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface UserWithReadStatus extends User {
    hasRead: boolean;
}

export default function DocumentDetailPage() {
    const { user: adminUser, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();
    const documentId = params.documentId as string;

    const [document, setDocument] = React.useState<StoredDocument | null>(null);
    const [usersWithStatus, setUsersWithStatus] = React.useState<UserWithReadStatus[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [searchTerm, setSearchTerm] = React.useState("");

    React.useEffect(() => {
        if (!documentId || !adminUser || adminUser.role !== 'admin') {
            if (!authLoading) router.push('/admin/documents');
            return;
        }

        const fetchData = async () =&gt; {
            setIsLoading(true);
            setError(null);
            try {
                const docRef = doc(db, "documents", documentId);
                const docSnap = await getDoc(docRef);
                if (!docSnap.exists()) throw new Error("Document not found.");
                const docData = { id: docSnap.id, ...docSnap.data() } as StoredDocument;
                setDocument(docData);

                const usersSnapshot = await getDocs(collection(db, "users"));
                const allUsers = usersSnapshot.docs.map(d =&gt; ({ uid: d.id, ...d.data() } as User));
                
                const usersWithReadStatus = allUsers.map(u =&gt; ({
                    ...u,
                    hasRead: (docData.readBy || []).includes(u.uid)
                }));
                setUsersWithStatus(usersWithReadStatus);

            } catch (err) {
                const e = err as Error;
                setError(e.message);
                toast({ title: "Error", description: e.message, variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [documentId, adminUser, authLoading, router, toast]);
    
    const filteredUsers = React.useMemo(() =&gt; {
        if (!searchTerm) return usersWithStatus;
        const lowerCaseTerm = searchTerm.toLowerCase();
        return usersWithStatus.filter(u =&gt; 
            (u.displayName || '').toLowerCase().includes(lowerCaseTerm) ||
            (u.email || '').toLowerCase().includes(lowerCaseTerm)
        );
    }, [usersWithStatus, searchTerm]);


    if (isLoading || authLoading) {
        return &lt;div className="flex items-center justify-center min-h-[calc(100vh-200px)]"&gt;&lt;Loader2 className="h-12 w-12 animate-spin text-primary" /&gt;&lt;/div&gt;;
    }
    
    if (error) {
        return &lt;div className="text-center py-10"&gt;&lt;AlertTriangle className="mx-auto h-12 w-12 text-destructive" /&gt;&lt;p className="mt-4 text-lg"&gt;{error}&lt;/p&gt;&lt;Button onClick={() =&gt; router.push('/admin/documents')} className="mt-4"&gt;Back to Documents&lt;/Button&gt;&lt;/div&gt;;
    }

    if (!document) return null;

    const totalReadCount = usersWithStatus.filter(u =&gt; u.hasRead).length;

    return (
        &lt;div className="space-y-6 max-w-5xl mx-auto"&gt;
            &lt;Button variant="outline" onClick={() =&gt; router.push('/admin/documents')}&gt;&lt;ArrowLeft className="mr-2 h-4 w-4"/&gt;Back to Document Management&lt;/Button&gt;
            
            &lt;Card className="shadow-lg"&gt;
                &lt;CardHeader&gt;
                    &lt;CardTitle className="text-2xl font-headline flex items-center"&gt;&lt;FileText className="mr-3 h-7 w-7 text-primary" /&gt;{document.title}&lt;/CardTitle&gt;
                    &lt;CardDescription&gt;
                        Version {document.version} | Category: {document.category} | Last Updated: {format(document.lastUpdated.toDate(), "PPp")}
                    &lt;/CardDescription&gt;
                &lt;/CardHeader&gt;
            &lt;/Card&gt;

            &lt;Card&gt;
                &lt;CardHeader&gt;
                    &lt;CardTitle&gt;Read Acknowledgement Status&lt;/CardTitle&gt;
                    &lt;CardDescription&gt;
                        Tracking which users have acknowledged reading this document. 
                        &lt;Badge variant="secondary" className="ml-2"&gt;{totalReadCount} / {usersWithStatus.length} users have acknowledged.&lt;/Badge&gt;
                    &lt;/CardDescription&gt;
                &lt;/CardHeader&gt;
                &lt;CardContent&gt;
                    &lt;div className="relative mb-4 max-w-sm"&gt;
                        &lt;Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /&gt;
                        &lt;Input
                            type="search"
                            placeholder="Search by user name or email..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) =&gt; setSearchTerm(e.target.value)}
                        /&gt;
                    &lt;/div&gt;
                    &lt;div className="rounded-md border"&gt;
                        &lt;Table&gt;
                            &lt;TableHeader&gt;
                                &lt;TableRow&gt;
                                    &lt;TableHead&gt;User&lt;/TableHead&gt;
                                    &lt;TableHead&gt;Email&lt;/TableHead&gt;
                                    &lt;TableHead&gt;Status&lt;/TableHead&gt;
                                &lt;/TableRow&gt;
                            &lt;/TableHeader&gt;
                            &lt;TableBody&gt;
                                {filteredUsers.map(user =&gt; (
                                    &lt;TableRow key={user.uid}&gt;
                                        &lt;TableCell className="font-medium"&gt;{user.displayName}&lt;/TableCell&gt;
                                        &lt;TableCell&gt;{user.email}&lt;/TableCell&gt;
                                        &lt;TableCell&gt;
                                            {user.hasRead ? (
                                                &lt;Badge variant="success" className="flex items-center gap-1 w-fit"&gt;&lt;CheckCircle className="h-3 w-3"/&gt; Acknowledged&lt;/Badge&gt;
                                            ) : (
                                                &lt;Badge variant="destructive" className="flex items-center gap-1 w-fit"&gt;&lt;XCircle className="h-3 w-3"/&gt; Not Acknowledged&lt;/Badge&gt;
                                            )}
                                        &lt;/TableCell&gt;
                                    &lt;/TableRow&gt;
                                ))}
                            &lt;/TableBody&gt;
                        &lt;/Table&gt;
                    &lt;/div&gt;
                &lt;/CardContent&gt;
            &lt;/Card&gt;
        &lt;/div&gt;
    );
}
