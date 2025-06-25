
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter as DialogPrimitiveFooter, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Eye, FileText as FileTextIcon, Loader2, AlertTriangle, RefreshCw, StickyNote, Layers } from "lucide-react";
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
import { documentCategories, documentSources } from "@/config/document-options";

interface Document {
  id: string;
  title: string;
  category: string;
  source: string;
  version?: string;
  description?: string;
  lastUpdated: Timestamp | string;
  size?: string;
  downloadURL?: string;
  fileName?: string;
  fileType?: string;
  documentContentType?: 'file' | 'markdown' | 'fileWithMarkdown';
  content?: string;
}


const getIconForDocumentType = (doc: Document) => {
   switch (doc.documentContentType) {
      case 'markdown': return <StickyNote className="h-5 w-5 text-yellow-500" />;
      case 'file': return <FileTextIcon className="h-5 w-5 text-primary" />;
      case 'fileWithMarkdown': return <Layers className="h-5 w-5 text-green-500" />;
      default:
           if (doc.downloadURL) return <FileTextIcon className="h-5 w-5 text-primary" />;
           if (doc.content) return <StickyNote className="h-5 w-5 text-yellow-500" />;
          return <FileTextIcon className="h-5 w-5 text-muted-foreground" />;
  }
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

// New component for the document card
const DocumentCard = ({ document, onView }: { document: Document; onView: (doc: Document) => void }) => {
  const Icon = getIconForDocumentType(document);
  return (
    <AnimatedCard className="h-full">
      <Card className="flex flex-col h-full shadow-md hover:shadow-xl transition-shadow duration-300">
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className="pt-1">{Icon}</div>
            <div>
              <CardTitle className="text-lg leading-tight">{document.title}</CardTitle>
              {document.version && (
                <CardDescription className="text-xs mt-1">Version: {document.version}</CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-grow space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{document.category}</Badge>
            <Badge variant="secondary">{document.source}</Badge>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-3" title={document.description}>
            {document.description || "No description available."}
          </p>
        </CardContent>
        <CardFooter className="flex-col items-stretch space-y-2 pt-4">
           <p className="text-xs text-muted-foreground text-center mb-2">
            Last Updated: {formatDate(document.lastUpdated)}
          </p>
          <div className="flex gap-2 w-full">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => onView(document)}>
              <Eye className="mr-2 h-4 w-4" /> View
            </Button>
            {(document.documentContentType === 'file' || document.documentContentType === 'fileWithMarkdown') && document.downloadURL && (
              <Button variant="secondary" size="sm" className="flex-1" asChild>
                <a href={document.downloadURL} download={document.fileName || document.title}>
                  <Download className="mr-2 h-4 w-4" /> Download
                </a>
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </AnimatedCard>
  );
};


export default function DocumentsPage() {
  const [allDocuments, setAllDocuments] = React.useState<Document[]>([]);
  const [filteredDocuments, setFilteredDocuments] = React.useState<Document[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [sourceFilter, setSourceFilter] = React.useState("all");

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
        const contentPreview = data.description || (data.content ? data.content.substring(0, 150) + "..." : "No description available.");
        return {
          id: doc.id,
          title: data.title || "Untitled Document",
          category: data.category || "Uncategorized",
          source: data.source || "Unknown",
          version: data.version,
          description: contentPreview,
          lastUpdated: data.lastUpdated,
          size: data.size,
          downloadURL: data.downloadURL,
          fileName: data.fileName,
          fileType: data.fileType,
          documentContentType: data.documentContentType || (data.downloadURL ? 'file' : 'markdown'),
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
    if (sourceFilter !== "all") {
      currentDocuments = currentDocuments.filter(doc => doc.source === sourceFilter);
    }
    if (searchTerm) {
      currentDocuments = currentDocuments.filter(doc =>
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.source.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setFilteredDocuments(currentDocuments);
  }, [searchTerm, categoryFilter, sourceFilter, allDocuments]);


  const handleViewDocument = (doc: Document) => {
    if (doc.documentContentType === 'markdown' || doc.documentContentType === 'fileWithMarkdown') {
      setSelectedDocumentForView(doc);
      setIsViewNoteDialogOpen(true);
    } else if (doc.documentContentType === 'file' && doc.downloadURL) {
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
            <div className="flex flex-col sm:flex-row flex-wrap gap-4 mb-6">
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
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {documentCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={sourceFilter}
                onValueChange={setSourceFilter}
                disabled={isLoading}
              >
                <SelectTrigger className="w-full sm:w-[240px]">
                  <SelectValue placeholder="Filter by provenance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Provenances</SelectItem>
                  {documentSources.map(src => (
                    <SelectItem key={src} value={src}>{src}</SelectItem>
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
              <p className="text-muted-foreground text-center py-10">No documents found{categoryFilter !== "all" || sourceFilter !== "all" || searchTerm ? " matching your criteria" : ""}.</p>
            )}

            {!isLoading && !error && filteredDocuments.length > 0 && (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                  {filteredDocuments.map((doc) => (
                      <DocumentCard key={doc.id} document={doc} onView={handleViewDocument} />
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </AnimatedCard>

      {selectedDocumentForView && (selectedDocumentForView.documentContentType === 'markdown' || selectedDocumentForView.documentContentType === 'fileWithMarkdown') && (
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
                <div className="py-4 prose prose-sm max-w-none dark:prose-invert text-foreground">
                  {selectedDocumentForView.content && <ReactMarkdown>{selectedDocumentForView.content}</ReactMarkdown>}
                  {selectedDocumentForView.documentContentType === 'fileWithMarkdown' && selectedDocumentForView.downloadURL && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="font-semibold mb-2">Attached File:</h4>
                      <Button asChild variant="outline">
                        <a href={selectedDocumentForView.downloadURL} target="_blank" rel="noopener noreferrer" download={selectedDocumentForView.fileName || selectedDocumentForView.title}>
                          <Download className="mr-2 h-4 w-4" /> {selectedDocumentForView.fileName || "Download File"} ({selectedDocumentForView.size})
                        </a>
                      </Button>
                    </div>
                  )}
                  {selectedDocumentForView.documentContentType === 'markdown' && !selectedDocumentForView.content && (
                     <p className="italic">No text content available for this document.</p>
                  )}
                </div>
            </ScrollArea>
            <DialogPrimitiveFooter className="mt-auto pt-4 border-t">
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
            </DialogPrimitiveFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
