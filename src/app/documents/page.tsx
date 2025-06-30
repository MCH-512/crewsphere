
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter as DialogPrimitiveFooter, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Eye, FileText as FileTextIcon, Loader2, AlertTriangle, RefreshCw, Layers, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp } from "firebase/firestore";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { AnimatedCard } from "@/components/motion/animated-card";
import ReactMarkdown from "react-markdown";
import { documentSources, familyConfig } from "@/config/document-options";
import { cn } from "@/lib/utils";

interface Document {
  id: string;
  title: string;
  category: string;
  source: string;
  version?: string;
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
      case 'markdown': return <FileTextIcon className="h-5 w-5 text-yellow-500" />;
      case 'file': return <FileTextIcon className="h-5 w-5 text-primary" />;
      case 'fileWithMarkdown': return <Layers className="h-5 w-5 text-green-500" />;
      default:
           if (doc.downloadURL) return <FileTextIcon className="h-5 w-5 text-primary" />;
           if (doc.content) return <FileTextIcon className="h-5 w-5 text-yellow-500" />;
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


export default function DocumentsPage() {
  const [allDocuments, setAllDocuments] = React.useState<Document[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { toast } = useToast();

  const [selectedDocumentForView, setSelectedDocumentForView] = React.useState<Document | null>(null);
  const [isViewNoteDialogOpen, setIsViewNoteDialogOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [sourceFilter, setSourceFilter] = React.useState("all");
  const [familyCounts, setFamilyCounts] = React.useState<Record<string, number>>({});

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
          source: data.source || "Other",
          version: data.version,
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
    const counts: Record<string, number> = {};
    documentSources.forEach(source => {
        counts[source] = 0;
    });
    allDocuments.forEach(doc => {
        if (counts[doc.source] !== undefined) {
            counts[doc.source]++;
        }
    });
    setFamilyCounts(counts);
  }, [allDocuments]);

  const filteredDocuments = React.useMemo(() => {
    let docs = [...allDocuments];
    if (sourceFilter !== "all") {
        docs = docs.filter(doc => doc.source === sourceFilter);
    }
    if (searchTerm) {
        const lowercasedTerm = searchTerm.toLowerCase();
        docs = docs.filter(doc => 
            doc.title.toLowerCase().includes(lowercasedTerm) ||
            doc.category.toLowerCase().includes(lowercasedTerm) ||
            (doc.content || "").toLowerCase().includes(lowercasedTerm)
        );
    }
    return docs;
  }, [allDocuments, searchTerm, sourceFilter]);

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
          <CardHeader>
            <CardTitle className="text-2xl font-headline">Document Library</CardTitle>
            <CardDescription>Access all essential manuals, procedures, policies, and training materials.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        placeholder="Search all documents..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button variant="outline" onClick={fetchDocuments} disabled={isLoading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>
          </CardContent>
        </Card>
      </AnimatedCard>

      <AnimatedCard delay={0.1}>
        <Card className="shadow-md">
            <CardHeader>
                <CardTitle className="text-lg font-headline">Browse by Family</CardTitle>
            </CardHeader>
            <CardContent>
                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                    <Card
                        className={cn(
                            "flex flex-col items-center justify-center p-4 rounded-lg cursor-pointer hover:shadow-md hover:bg-muted/50 transition-all",
                            sourceFilter === 'all' && "ring-2 ring-primary shadow-lg"
                        )}
                        onClick={() => setSourceFilter('all')}
                    >
                        <Layers className="h-8 w-8 text-primary mb-2" />
                        <p className="text-2xl font-bold">{allDocuments.length}</p>
                        <p className="text-sm text-muted-foreground text-center">All Documents</p>
                    </Card>
                    {documentSources.map(source => {
                        const familyInfo = familyConfig[source as keyof typeof familyConfig];
                        const IconComponent = familyInfo?.icon || FileTextIcon;
                        return (
                            <Card
                                key={source}
                                className={cn(
                                    "flex flex-col items-center justify-center p-4 rounded-lg cursor-pointer hover:shadow-md hover:bg-muted/50 transition-all",
                                    sourceFilter === source && "ring-2 ring-primary shadow-lg"
                                )}
                                onClick={() => setSourceFilter(source)}
                            >
                                <IconComponent className="h-8 w-8 text-primary mb-2" />
                                <p className="text-2xl font-bold">{familyCounts[source] || 0}</p>
                                <p className="text-sm text-muted-foreground text-center">{source}</p>
                            </Card>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
      </AnimatedCard>

      <Card className="shadow-lg mt-6">
        <CardHeader>
          <CardTitle className="text-xl font-headline">
            {sourceFilter === "all" ? "All Documents" : `Documents: ${sourceFilter}`}
          </CardTitle>
          <CardDescription>
            {filteredDocuments.length} document(s) found.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">Loading documents...</p>
            </div>
          ) : error ? (
            <div className="p-4 mb-4 text-sm text-destructive-foreground bg-destructive rounded-md flex items-center gap-2 justify-center">
              <AlertTriangle className="h-5 w-5" /> {error}
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">No documents found matching your criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocuments.map(doc => (
                  <Card key={doc.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                          <CardTitle className="text-base font-semibold flex items-center gap-2">
                              {getIconForDocumentType(doc)}
                              <span className="truncate" title={doc.title}>{doc.title}</span>
                          </CardTitle>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                              <Badge variant="outline" className="px-1.5 py-0">{doc.category}</Badge>
                              <span>|</span>
                              <span>Updated: {formatDate(doc.lastUpdated)}</span>
                              {doc.version && <span>| Ver: {doc.version}</span>}
                          </div>
                      </CardHeader>
                      <CardFooter className="gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleViewDocument(doc)} className="flex-1">
                              <Eye className="mr-2 h-4 w-4" /> View
                          </Button>
                          {(doc.documentContentType === 'file' || doc.documentContentType === 'fileWithMarkdown') && doc.downloadURL && (
                              <Button variant="outline" size="sm" asChild className="flex-1">
                                  <a href={doc.downloadURL} download={doc.fileName || doc.title}><Download className="mr-2 h-4 w-4" /> Download</a>
                              </Button>
                          )}
                      </CardFooter>
                  </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>


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
