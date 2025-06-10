
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Eye, FileText as FileTextIcon, Loader2, AlertTriangle, RefreshCw, StickyNote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp } from "firebase/firestore";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { AnimatedCard } from "@/components/motion/animated-card";
import ReactMarkdown from "react-markdown";

interface Document {
  id: string;
  title: string;
  category: string;
  source: string; 
  version?: string;
  lastUpdated: Timestamp | string;
  size?: string;
  downloadURL?: string; // Optional for text documents
  fileType?: string; // Optional for text documents
  documentContentType?: 'file' | 'text';
  content?: string; // For text documents
}

const categories = ["Operations", "Safety", "HR", "Training", "Service", "Regulatory", "General", "Manuals", "Bulletins", "Forms", "Procedures", "Memos"];

export default function DocumentsPage() {
  const [allDocuments, setAllDocuments] = React.useState<Document[]>([]);
  const [filteredDocuments, setFilteredDocuments] = React.useState<Document[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");

  const [selectedDocumentForView, setSelectedDocumentForView] = React.useState<Document | null>(null);
  const [isViewNoteDialogOpen, setIsViewNoteDialogOpen] = React.useState(false);


  const fetchDocuments = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const q = query(collection(db, "documents"), orderBy("lastUpdated", "desc")); 
      const querySnapshot = await getDocs(q);
      const fetchedDocuments = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || "Untitled Document",
          category: data.category || "Uncategorized",
          source: data.source || "Unknown", 
          version: data.version,
          lastUpdated: data.lastUpdated, 
          size: data.size,
          downloadURL: data.downloadURL,
          fileType: data.fileType,
          documentContentType: data.documentContentType || 'file',
          content: data.content,
        } as Document;
      });
      setAllDocuments(fetchedDocuments);
      setFilteredDocuments(fetchedDocuments); 
    } catch (err) {
      console.error("Error fetching documents:", err);
      setError("Failed to load documents. Please ensure you have a 'documents' collection in Firestore.");
      toast({
        title: "Loading Error",
        description: "Could not fetch documents from Firestore.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  React.useEffect(() => {
    let currentDocuments = [...allDocuments];
    if (categoryFilter !== "all") {
      currentDocuments = currentDocuments.filter(doc => doc.category === categoryFilter);
    }
    if (searchTerm) {
      currentDocuments = currentDocuments.filter(doc => 
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.source.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setFilteredDocuments(currentDocuments);
  }, [searchTerm, categoryFilter, allDocuments]);


  const getIconForDocumentType = (doc: Document) => {
    if (doc.documentContentType === 'text') {
      return <StickyNote className="h-5 w-5 text-yellow-500" />;
    }
    if (!doc.fileType) return <FileTextIcon className="h-5 w-5 text-muted-foreground" />;
    if (doc.fileType.includes("pdf")) return <FileTextIcon className="h-5 w-5 text-red-600" />;
    if (doc.fileType.includes("word") || doc.fileType.includes("document")) return <FileTextIcon className="h-5 w-5 text-blue-600" />;
    if (doc.fileType.includes("excel") || doc.fileType.includes("sheet")) return <FileTextIcon className="h-5 w-5 text-green-600" />;
    return <FileTextIcon className="h-5 w-5 text-primary" />;
  };

  const formatDate = (dateValue: Timestamp | string) => {
    if (!dateValue) return "N/A";
    if (typeof dateValue === "string") {
      try {
        return format(new Date(dateValue), "PP"); 
      } catch (e) {
        return dateValue; 
      }
    }
    if (dateValue instanceof Timestamp) {
      return format(dateValue.toDate(), "PP");
    }
    return "Invalid Date";
  };

  const handleViewDocument = (doc: Document) => {
    if (doc.documentContentType === 'text') {
      setSelectedDocumentForView(doc);
      setIsViewNoteDialogOpen(true);
    } else if (doc.downloadURL) {
      window.open(doc.downloadURL, '_blank');
    } else {
      toast({ title: "View Error", description: "No content or URL available for this document.", variant: "destructive"});
    }
  };

  return (
    <div className="space-y-6">
      <AnimatedCard>
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row justify-between items-start">
            <div>
              <CardTitle className="text-2xl font-headline">Document Library</CardTitle>
              <CardDescription>Access all essential manuals, procedures, policies, and training materials.</CardDescription>
            </div>
             <Button variant="outline" onClick={fetchDocuments} disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <Input 
                placeholder="Search by title or source..." 
                className="max-w-xs" 
                disabled={isLoading} 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Select 
                value={categoryFilter}
                onValueChange={setCategoryFilter}
                disabled={isLoading}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Loading documents...</p>
              </div>
            )}

            {error && !isLoading && (
              <div className="p-4 mb-4 text-sm text-destructive-foreground bg-destructive rounded-md flex items-center gap-2 justify-center">
                <AlertTriangle className="h-5 w-5" /> {error}
              </div>
            )}

            {!isLoading && !error && filteredDocuments.length === 0 && (
              <p className="text-muted-foreground text-center py-10">No documents found{categoryFilter !== "all" || searchTerm ? " matching your criteria" : ""}.</p>
            )}

            {!isLoading && !error && filteredDocuments.length > 0 && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">Type</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Provenance</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocuments.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>{getIconForDocumentType(doc)}</TableCell>
                        <TableCell className="font-medium max-w-sm truncate" title={doc.title}>{doc.title}</TableCell>
                        <TableCell><Badge variant="outline">{doc.category}</Badge></TableCell>
                        <TableCell><Badge variant="secondary">{doc.source}</Badge></TableCell>
                        <TableCell>{doc.version || "N/A"}</TableCell>
                        <TableCell>{formatDate(doc.lastUpdated)}</TableCell>
                        <TableCell>{doc.documentContentType === 'text' ? "N/A" : (doc.size || "N/A")}</TableCell>
                        <TableCell className="text-right space-x-2">
                           <Button variant="ghost" size="icon" onClick={() => handleViewDocument(doc)} aria-label={`View document: ${doc.title}`}>
                                <Eye className="h-4 w-4" />
                            </Button>
                          {doc.documentContentType === 'file' && doc.downloadURL && (
                            <Button variant="ghost" size="icon" asChild aria-label={`Download document: ${doc.title}`}>
                                <a href={doc.downloadURL} download><Download className="h-4 w-4" /></a>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </AnimatedCard>

       {selectedDocumentForView && selectedDocumentForView.documentContentType === 'text' && (
        <Dialog open={isViewNoteDialogOpen} onOpenChange={setIsViewNoteDialogOpen}>
          <DialogContent className="sm:max-w-2xl md:max-w-3xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{selectedDocumentForView.title}</DialogTitle>
              <DialogDescription>
                Category: {selectedDocumentForView.category} | Source: {selectedDocumentForView.source}
                {selectedDocumentForView.version && ` | Version: ${selectedDocumentForView.version}`}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-grow pr-6 -mr-6"> 
                <div className="py-4 prose prose-sm max-w-none dark:prose-invert text-foreground whitespace-pre-wrap">
                    <ReactMarkdown>{selectedDocumentForView.content || "No content available."}</ReactMarkdown>
                </div>
            </ScrollArea>
            <DialogFooter className="mt-auto pt-4 border-t">
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
    
