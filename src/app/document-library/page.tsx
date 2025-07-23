
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Library, Loader2, AlertTriangle, Download, Search, Filter, FileText, LayoutGrid, List, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { StoredDocument, documentCategories } from "@/schemas/document-schema";
import { AnimatedCard } from "@/components/motion/animated-card";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { logAuditEvent } from "@/lib/audit-logger";

type SortOption = 'lastUpdated_desc' | 'title_asc' | 'title_desc' | 'category_asc';

async function getDocuments() {
    const q = query(collection(db, "documents"), orderBy("lastUpdated", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredDocument));
}

export default async function DocumentLibraryServerPage() {
    const initialDocuments = await getDocuments();
    return <DocumentLibraryClient initialDocuments={initialDocuments} />;
}

function DocumentLibraryClient({ initialDocuments }: { initialDocuments: StoredDocument[] }) {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [allDocuments, setAllDocuments] = React.useState<StoredDocument[]>(initialDocuments);
    const [filteredDocuments, setFilteredDocuments] = React.useState<StoredDocument[]>(initialDocuments);
    const [isAcknowledging, setIsAcknowledging] = React.useState<string | null>(null);
    const [searchTerm, setSearchTerm] = React.useState("");
    const [categoryFilter, setCategoryFilter] = React.useState("all");
    const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
    const [sortOption, setSortOption] = React.useState<SortOption>('lastUpdated_desc');

    const fetchDocuments = React.useCallback(async () => {
        const fetchedDocs = await getDocuments();
        setAllDocuments(fetchedDocs);
    }, []);

    React.useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    React.useEffect(() => {
        let docs = [...allDocuments];
        
        // Filtering
        if (categoryFilter !== "all") {
            docs = docs.filter(d => d.category === categoryFilter);
        }
        if (searchTerm) {
            docs = docs.filter(d =>
                d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                d.description.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Sorting
        docs.sort((a, b) => {
            const [key, direction] = sortOption.split('_') as [keyof StoredDocument, 'asc' | 'desc'];
            const valA = a[key];
            const valB = b[key];
            let comparison = 0;

            if (valA instanceof Timestamp && valB instanceof Timestamp) {
                comparison = valA.toMillis() - valB.toMillis();
            } else {
                comparison = String(valA).localeCompare(String(valB));
            }
            
            return direction === 'asc' ? comparison : -comparison;
        });

        setFilteredDocuments(docs);
    }, [searchTerm, categoryFilter, allDocuments, sortOption]);
    
    const handleAcknowledge = async (docId: string) => {
        if (!user) return;
        setIsAcknowledging(docId);
        try {
            const docRef = doc(db, "documents", docId);
            await updateDoc(docRef, { readBy: arrayUnion(user.uid) });
            await logAuditEvent({ userId: user.uid, userEmail: user.email!, actionType: 'ACKNOWLEDGE_DOCUMENT', entityType: 'DOCUMENT', entityId: docId });
            toast({ title: "Document Acknowledged", description: "Your read confirmation has been recorded." });
            fetchDocuments();
        } catch (error) {
            toast({ title: "Error", description: "Could not record acknowledgement.", variant: "destructive" });
        } finally {
            setIsAcknowledging(null);
        }
    };

    if (authLoading) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    if (!user) {
      return null;
    }

    return (
        <div className="space-y-6">
            <AnimatedCard>
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-2xl font-headline flex items-center">
                            <Library className="mr-3 h-7 w-7 text-primary" />
                            Document Library
                        </CardTitle>
                        <CardDescription>
                            Find all official manuals, procedures, and company documents here.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="relative flex-grow">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Search by title or description..."
                                    className="pl-8 w-full"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-4">
                               <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                    <SelectTrigger className="flex-1">
                                        <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                                        <SelectValue placeholder="Filter by category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Categories</SelectItem>
                                        {documentCategories.map(cat => (
                                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
                                    <SelectTrigger className="flex-1">
                                        <SelectValue placeholder="Sort by" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="lastUpdated_desc">Last Updated</SelectItem>
                                        <SelectItem value="title_asc">Title (A-Z)</SelectItem>
                                        <SelectItem value="title_desc">Title (Z-A)</SelectItem>
                                        <SelectItem value="category_asc">Category</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center justify-end gap-2">
                                <Button variant={viewMode === 'grid' ? 'default' : 'outline'} size="icon" onClick={() => setViewMode('grid')}><LayoutGrid className="h-4 w-4" /></Button>
                                <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="icon" onClick={() => setViewMode('list')}><List className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </AnimatedCard>
            
            {filteredDocuments.length > 0 ? (
                viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredDocuments.map((docItem, index) => {
                        const hasRead = docItem.readBy?.includes(user.uid);
                        return (
                            <AnimatedCard key={docItem.id} delay={0.1 + index * 0.05}>
                                <Card className="shadow-sm h-full flex flex-col hover:shadow-md transition-shadow">
                                    <CardHeader>
                                        <CardTitle className="text-lg flex items-start gap-3">
                                            <FileText className="h-5 w-5 mt-1 text-primary"/>
                                            {docItem.title}
                                        </CardTitle>
                                        <CardDescription>Version {docItem.version}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex-grow">
                                        <p className="text-sm text-muted-foreground line-clamp-3">
                                            {docItem.description}
                                        </p>
                                    </CardContent>
                                    <CardContent className="flex justify-between items-center text-xs text-muted-foreground">
                                        <span>{docItem.category}</span>
                                        <span>Updated: {format(docItem.lastUpdated.toDate(), "PP")}</span>
                                    </CardContent>
                                    <CardFooter className="flex flex-col items-stretch gap-2">
                                        <Button asChild className="w-full" variant="outline">
                                            <Link href={docItem.fileURL} target="_blank" rel="noopener noreferrer">
                                                <Download className="mr-2 h-4 w-4"/>
                                                Download
                                            </Link>
                                        </Button>
                                        {hasRead ? (
                                            <Button className="w-full" variant="success" disabled>
                                                <CheckCircle className="mr-2 h-4 w-4"/> Acknowledged
                                            </Button>
                                        ) : (
                                            <Button className="w-full" onClick={() => handleAcknowledge(docItem.id)} disabled={isAcknowledging === docItem.id}>
                                                {isAcknowledging === docItem.id && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                                Acknowledge Reading
                                            </Button>
                                        )}
                                    </CardFooter>
                                </Card>
                            </AnimatedCard>
                        )
                    })}
                </div>
                ) : (
                <AnimatedCard delay={0.1}>
                    <Card>
                        <CardContent className="p-0">
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Title</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Version</TableHead>
                                        <TableHead>Last Updated</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredDocuments.map(docItem => {
                                        const hasRead = docItem.readBy?.includes(user.uid);
                                        return (
                                            <TableRow key={docItem.id}>
                                                <TableCell className="font-medium">{docItem.title}</TableCell>
                                                <TableCell>{docItem.category}</TableCell>
                                                <TableCell>{docItem.version}</TableCell>
                                                <TableCell>{format(docItem.lastUpdated.toDate(), "PPp")}</TableCell>
                                                <TableCell className="text-right space-x-2">
                                                    {hasRead ? (
                                                        <Button variant="success" size="sm" disabled>
                                                            <CheckCircle className="mr-2 h-4 w-4"/> Acknowledged
                                                        </Button>
                                                    ) : (
                                                        <Button variant="default" size="sm" onClick={() => handleAcknowledge(docItem.id)} disabled={isAcknowledging === docItem.id}>
                                                            {isAcknowledging === docItem.id && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                                            Acknowledge
                                                        </Button>
                                                    )}
                                                     <Button variant="ghost" size="icon" asChild>
                                                        <a href={docItem.fileURL} target="_blank" rel="noopener noreferrer">
                                                            <Download className="h-4 w-4"/>
                                                        </a>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </AnimatedCard>
                )
            ) : (
                <AnimatedCard delay={0.1}>
                    <Card className="text-center py-12">
                        <CardContent>
                            <p className="text-muted-foreground">
                                No documents found matching your criteria.
                            </p>
                        </CardContent>
                    </Card>
                </AnimatedCard>
            )}
        </div>
    );
}
