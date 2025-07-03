
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Library, Loader2, AlertTriangle, Download, Search, Filter, FileText } from "lucide-react";
import { format } from "date-fns";
import { StoredDocument, documentCategories } from "@/schemas/document-schema";
import { AnimatedCard } from "@/components/motion/animated-card";
import Link from "next/link";

export default function DocumentLibraryPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [allDocuments, setAllDocuments] = React.useState<StoredDocument[]>([]);
    const [filteredDocuments, setFilteredDocuments] = React.useState<StoredDocument[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState("");
    const [categoryFilter, setCategoryFilter] = React.useState("all");

    React.useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
            return;
        }

        const fetchDocuments = async () => {
            setIsLoading(true);
            try {
                const q = query(collection(db, "documents"), orderBy("lastUpdated", "desc"));
                const querySnapshot = await getDocs(q);
                const fetchedDocs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredDocument));
                setAllDocuments(fetchedDocs);
                setFilteredDocuments(fetchedDocs);
            } catch (error) {
                console.error("Error fetching documents:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (user) fetchDocuments();
    }, [user, authLoading, router]);

    React.useEffect(() => {
        let docs = [...allDocuments];
        if (categoryFilter !== "all") {
            docs = docs.filter(d => d.category === categoryFilter);
        }
        if (searchTerm) {
            docs = docs.filter(d =>
                d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                d.description.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        setFilteredDocuments(docs);
    }, [searchTerm, categoryFilter, allDocuments]);
    
    if (authLoading || isLoading) {
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
                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                <SelectTrigger className="w-full md:w-[240px]">
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
                        </div>
                    </CardContent>
                </Card>
            </AnimatedCard>
            
            {filteredDocuments.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredDocuments.map((docItem, index) => (
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
                                <CardContent>
                                     <Button asChild className="w-full">
                                        <Link href={docItem.fileURL} target="_blank" rel="noopener noreferrer">
                                            <Download className="mr-2 h-4 w-4"/>
                                            Download
                                        </Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        </AnimatedCard>
                    ))}
                </div>
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

