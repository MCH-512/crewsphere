"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Library, Loader2, Download, Search, Filter, FileText, LayoutGrid, List, CheckCircle, RefreshCw } from "lucide-react";
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

export default function DocumentLibraryPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [allDocuments, setAllDocuments] = React.useState&lt;StoredDocument[]&gt;([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isAcknowledging, setIsAcknowledging] = React.useState&lt;string | null&gt;(null);
    const [searchTerm, setSearchTerm] = React.useState("");
    const [categoryFilter, setCategoryFilter] = React.useState("all");
    const [viewMode, setViewMode&gt;('grid');
    const [sortOption, setSortOption&gt;('lastUpdated_desc');

    const fetchDocuments = React.useCallback(async () =&gt; {
        setIsLoading(true);
        try {
            const fetchedDocs = await getDocuments();
            setAllDocuments(fetchedDocs);
        } catch (error: unknown) {
            toast({ title: "Error", description: "Could not fetch documents. You may not have the required permissions.", variant: "destructive"});
        } finally {
            setIsLoading(false);
        }
    }, [toast]);
    
    const refreshDocuments = React.useCallback(async () =&gt; {
       await fetchDocuments();
       toast({ title: "Documents Refreshed", description: "The library has been updated with the latest documents." });
    }, [fetchDocuments, toast]);

    React.useEffect(() =&gt; {
        if (!authLoading &amp;&amp; !user) {
            router.push('/login');
            return;
        }
        if (!authLoading &amp;&amp; user) {
            fetchDocuments();
        }
    }, [user, authLoading, router, fetchDocuments]);

    const filteredDocuments = React.useMemo(() =&gt; {
        let docs = [...allDocuments];
        
        // Filtering
        if (categoryFilter !== "all") {
            docs = docs.filter(d =&gt; d.category === categoryFilter);
        }
        if (searchTerm) {
            docs = docs.filter(d =&gt;
                d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                d.description.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Sorting
        docs.sort((a, b) =&gt; {
            const [key, direction] = sortOption.split('_') as [keyof StoredDocument, 'asc' | 'desc'];
            const valA = a[key];
            const valB = b[key];
            let comparison = 0;

            if (valA instanceof Timestamp &amp;&amp; valB instanceof Timestamp) {
                comparison = valA.toMillis() - valB.toMillis();
            } else {
                comparison = String(valA).localeCompare(String(valB));
            }
            
            return direction === 'asc' ? comparison : -comparison;
        });

        return docs;
    }, [searchTerm, categoryFilter, allDocuments, sortOption]);
    
    const handleAcknowledge = async (docId: string) =&gt; {
        if (!user) return;
        setIsAcknowledging(docId);
        try {
            const docRef = doc(db, "documents", docId);
            await updateDoc(docRef, { readBy: arrayUnion(user.uid) });
            await logAuditEvent({ userId: user.uid, userEmail: user.email!, actionType: 'ACKNOWLEDGE_DOCUMENT', entityType: 'DOCUMENT', entityId: docId });
            toast({ title: "Document Acknowledged", description: "Your read confirmation has been recorded." });
            
            // Optimistic update of local state
            setAllDocuments(prevDocs =&gt; 
                prevDocs.map(d =&gt; 
                    d.id === docId ? { ...d, readBy: [...(d.readBy || []), user.uid] } : d
                )
            );

        } catch (error: unknown) {
            toast({ title: "Error", description: "Could not record acknowledgement.", variant: "destructive" });
        } finally {
            setIsAcknowledging(null);
        }
    };

    if (authLoading || isLoading) {
        return &lt;div className="flex items-center justify-center min-h-[calc(100vh-200px)]"&gt;&lt;Loader2 className="h-12 w-12 animate-spin text-primary" /&gt;&lt;/div&gt;;
    }

    if (!user) {
      return null;
    }

    return (
        &lt;div className="space-y-6"&gt;
            &lt;AnimatedCard&gt;
                &lt;Card className="shadow-lg"&gt;
                    &lt;CardHeader&gt;
                        &lt;CardTitle className="text-2xl font-headline flex items-center"&gt;
                            &lt;Library className="mr-3 h-7 w-7 text-primary" /&gt;
                            Document Library
                        &lt;/CardTitle&gt;
                        &lt;CardDescription&gt;
                            Find all official manuals, procedures, and company documents here.
                        &lt;/CardDescription&gt;
                    &lt;/CardHeader&gt;
                    &lt;CardContent&gt;
                        &lt;div className="flex flex-col md:flex-row gap-4"&gt;
                            &lt;div className="relative flex-grow"&gt;
                                &lt;Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /&gt;
                                &lt;Input
                                    type="search"
                                    placeholder="Search by title or description..."
                                    className="pl-8 w-full"
                                    value={searchTerm}
                                    onChange={(e) =&gt; setSearchTerm(e.target.value)}
                                /&gt;
                            &lt;/div&gt;
                            &lt;div className="flex gap-4"&gt;
                               &lt;Select value={categoryFilter} onValueChange={setCategoryFilter}&gt;
                                    &lt;SelectTrigger className="flex-1"&gt;
                                        &lt;Filter className="mr-2 h-4 w-4 text-muted-foreground" /&gt;
                                        &lt;SelectValue placeholder="Filter by category" /&gt;
                                    &lt;/SelectTrigger&gt;
                                    &lt;SelectContent&gt;
                                        &lt;SelectItem value="all"&gt;All Categories&lt;/SelectItem&gt;
                                        {documentCategories.map(cat =&gt; (
                                            &lt;SelectItem key={cat} value={cat}&gt;{cat}&lt;/SelectItem&gt;
                                        ))}&lt;/SelectContent&gt;
                                &lt;/Select&gt;
                                &lt;Select value={sortOption} onValueChange={(value) =&gt; setSortOption(value as SortOption)}&gt;
                                    &lt;SelectTrigger className="flex-1"&gt;
                                        &lt;SelectValue placeholder="Sort by" /&gt;
                                    &lt;/SelectTrigger&gt;
                                    &lt;SelectContent&gt;
                                        &lt;SelectItem value="lastUpdated_desc"&gt;Last Updated&lt;/SelectItem&gt;
                                        &lt;SelectItem value="title_asc"&gt;Title (A-Z)&lt;/SelectItem&gt;
                                        &lt;SelectItem value="title_desc"&gt;Title (Z-A)&lt;/SelectItem&gt;
                                        &lt;SelectItem value="category_asc"&gt;Category&lt;/SelectItem&gt;
                                    &lt;/SelectContent&gt;
                                &lt;/Select&gt;
                            &lt;/div&gt;
                            &lt;div className="flex items-center justify-end gap-2"&gt;
                                &lt;Button variant={viewMode === 'grid' ? 'default' : 'outline'} size="icon" onClick={() =&gt; setViewMode('grid')}&gt;&lt;LayoutGrid className="h-4 w-4" /&gt;&lt;/Button&gt;
                                &lt;Button variant={viewMode === 'list' ? 'default' : 'outline'} size="icon" onClick={() =&gt; setViewMode('list')}&gt;&lt;List className="h-4 w-4" /&gt;&lt;/Button&gt;
                                &lt;Button variant="outline" size="icon" onClick={refreshDocuments} disabled={isLoading}&gt;&lt;RefreshCw className={cn("h-4 w-4", isLoading &amp;&amp; "animate-spin")} /&gt;&lt;/Button&gt;
                            &lt;/div&gt;
                        &lt;/div&gt;
                    &lt;/CardContent&gt;
                &lt;/Card&gt;
            &lt;/AnimatedCard&gt;
            
            {filteredDocuments.length &gt; 0 ? (
                viewMode === 'grid' ? (
                &lt;div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"&gt;
                    {filteredDocuments.map((docItem, index) =&gt; {
                        const hasRead = docItem.readBy?.includes(user.uid);
                        return (
                            &lt;AnimatedCard key={docItem.id} delay={0.1 + index * 0.05}&gt;
                                &lt;Card className="shadow-sm h-full flex flex-col hover:shadow-md transition-shadow"&gt;
                                    &lt;CardHeader&gt;
                                        &lt;CardTitle className="text-lg flex items-start gap-3"&gt;
                                            &lt;FileText className="h-5 w-5 mt-1 text-primary"/&gt;
                                            {docItem.title}
                                        &lt;/CardTitle&gt;
                                        &lt;CardDescription&gt;Version {docItem.version}&lt;/CardDescription&gt;
                                    &lt;/CardHeader&gt;
                                    &lt;CardContent className="flex-grow"&gt;
                                        &lt;p className="text-sm text-muted-foreground line-clamp-3"&gt;
                                            {docItem.description}
                                        &lt;/p&gt;
                                    &lt;/CardContent&gt;
                                    &lt;CardContent className="flex justify-between items-center text-xs text-muted-foreground"&gt;
                                        &lt;span&gt;{docItem.category}&lt;/span&gt;
                                        &lt;span&gt;Updated: {format(docItem.lastUpdated.toDate(), "PP")}&lt;/span&gt;
                                    &lt;/CardContent&gt;
                                    &lt;CardFooter className="flex flex-col items-stretch gap-2"&gt;
                                        &lt;Button asChild className="w-full" variant="outline"&gt;
                                            &lt;Link href={docItem.fileURL} target="_blank" rel="noopener noreferrer"&gt;
                                                &lt;Download className="mr-2 h-4 w-4"/&gt;
                                                Download
                                            &lt;/Link&gt;
                                        &lt;/Button&gt;
                                        {hasRead ? (
                                            &lt;Button className="w-full" variant="success" disabled&gt;
                                                &lt;CheckCircle className="mr-2 h-4 w-4"/&gt; Acknowledged
                                            &lt;/Button&gt;
                                        ) : (
                                            &lt;Button className="w-full" onClick={() =&gt; handleAcknowledge(docItem.id)} disabled={isAcknowledging === docItem.id}&gt;
                                                {isAcknowledging === docItem.id &amp;&amp; &lt;Loader2 className="mr-2 h-4 w-4 animate-spin"/&gt;}
                                                Acknowledge Reading
                                            &lt;/Button&gt;
                                        )}
                                    &lt;/CardFooter&gt;
                                &lt;/Card&gt;
                            &lt;/AnimatedCard&gt;
                        )
                    })}
                &lt;/div&gt;
                ) : (
                &lt;AnimatedCard delay={0.1}&gt;
                    &lt;Card&gt;
                        &lt;CardContent className="p-0"&gt;
                             &lt;Table&gt;
                                &lt;TableHeader&gt;
                                    &lt;TableRow&gt;
                                        &lt;TableHead&gt;Title&lt;/TableHead&gt;
                                        &lt;TableHead&gt;Category&lt;/TableHead&gt;
                                        &lt;TableHead&gt;Version&lt;/TableHead&gt;
                                        &lt;TableHead&gt;Last Updated&lt;/TableHead&gt;
                                        &lt;TableHead className="text-right"&gt;Actions&lt;/TableHead&gt;
                                    &lt;/TableRow&gt;
                                &lt;/TableHeader&gt;
                                &lt;TableBody&gt;
                                    {filteredDocuments.map(docItem =&gt; {
                                        const hasRead = docItem.readBy?.includes(user.uid);
                                        return (
                                            &lt;TableRow key={docItem.id}&gt;
                                                &lt;TableCell className="font-medium"&gt;{docItem.title}&lt;/TableCell&gt;
                                                &lt;TableCell&gt;{docItem.category}&lt;/TableCell&gt;
                                                &lt;TableCell&gt;{docItem.version}&lt;/TableCell&gt;
                                                &lt;TableCell&gt;{format(docItem.lastUpdated.toDate(), "PPp")}&lt;/TableCell&gt;
                                                &lt;TableCell className="text-right space-x-2"&gt;
                                                    {hasRead ? (
                                                        &lt;Button variant="success" size="sm" disabled&gt;
                                                            &lt;CheckCircle className="mr-2 h-4 w-4"/&gt; Acknowledged
                                                        &lt;/Button&gt;
                                                    ) : (
                                                        &lt;Button variant="default" size="sm" onClick={() =&gt; handleAcknowledge(docItem.id)} disabled={isAcknowledging === docItem.id}&gt;
                                                            {isAcknowledging === docItem.id &amp;&amp; &lt;Loader2 className="mr-2 h-4 w-4 animate-spin"/&gt;}
                                                            Acknowledge
                                                        &lt;/Button&gt;
                                                    )}
                                                     &lt;Button variant="ghost" size="icon" asChild&gt;
                                                        &lt;a href={docItem.fileURL} target="_blank" rel="noopener noreferrer"&gt;
                                                            &lt;Download className="h-4 w-4"/&gt;
                                                        &lt;/a&gt;
                                                    &lt;/Button&gt;
                                                &lt;/TableCell&gt;
                                            &lt;/TableRow&gt;
                                        );
                                    })}
                                &lt;/TableBody&gt;
                            &lt;/Table&gt;
                        &lt;/CardContent&gt;
                    &lt;/Card&gt;
                &lt;/AnimatedCard&gt;
                )
            ) : (
                &lt;AnimatedCard delay={0.1}&gt;
                    &lt;Card className="text-center py-12"&gt;
                        &lt;CardContent&gt;
                            &lt;p className="text-muted-foreground"&gt;
                                No documents found matching your criteria.
                            &lt;/p&gt;
                        &lt;/CardContent&gt;
                    &lt;/Card&gt;
                &lt;/AnimatedCard&gt;
            )}
        &lt;/div&gt;
    );
}
