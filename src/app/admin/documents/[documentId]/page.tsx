
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth, type User } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs, updateDoc, arrayUnion, query, where } from "firebase/firestore";
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

        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const docRef = doc(db, "documents", documentId);
                const docSnap = await getDoc(docRef);
                if (!docSnap.exists()) throw new Error("Document not found.");
                const docData = { id: docSnap.id, ...docSnap.data() } as StoredDocument;
                setDocument(docData);

                const usersSnapshot = await getDocs(collection(db, "users"));
                const allUsers = usersSnapshot.docs.map(d => ({ uid: d.id, ...d.data() } as User));
                
                const usersWithReadStatus = allUsers.map(u => ({
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
    
    const filteredUsers = React.useMemo(() => {
        if (!searchTerm) return usersWithStatus;
        const lowerCaseTerm = searchTerm.toLowerCase();
        return usersWithStatus.filter(u => 
            (u.displayName || '').toLowerCase().includes(lowerCaseTerm) ||
            (u.email || '').toLowerCase().includes(lowerCaseTerm)
        );
    }, [usersWithStatus, searchTerm]);


    if (isLoading || authLoading) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }
    
    if (error) {
        return <div className="text-center py-10"><AlertTriangle className="mx-auto h-12 w-12 text-destructive" /><p className="mt-4 text-lg">{error}</p><Button onClick={() => router.push('/admin/documents')} className="mt-4">Back to Documents</Button></div>;
    }

    if (!document) return null;

    const totalReadCount = usersWithStatus.filter(u => u.hasRead).length;

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <Button variant="outline" onClick={() => router.push('/admin/documents')}><ArrowLeft className="mr-2 h-4 w-4"/>Back to Document Management</Button>
            
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="text-2xl font-headline flex items-center"><FileText className="mr-3 h-7 w-7 text-primary" />{document.title}</CardTitle>
                    <CardDescription>
                        Version {document.version} | Category: {document.category} | Last Updated: {format(document.lastUpdated.toDate(), "PPp")}
                    </CardDescription>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Read Acknowledgement Status</CardTitle>
                    <CardDescription>
                        Tracking which users have acknowledged reading this document. 
                        <Badge variant="secondary" className="ml-2">{totalReadCount} / {usersWithStatus.length} users have acknowledged.</Badge>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="relative mb-4 max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search by user name or email..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.map(user => (
                                    <TableRow key={user.uid}>
                                        <TableCell className="font-medium">{user.displayName}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>
                                            {user.hasRead ? (
                                                <Badge variant="success" className="flex items-center gap-1 w-fit"><CheckCircle className="h-3 w-3"/> Acknowledged</Badge>
                                            ) : (
                                                <Badge variant="destructive" className="flex items-center gap-1 w-fit"><XCircle className="h-3 w-3"/> Not Acknowledged</Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
