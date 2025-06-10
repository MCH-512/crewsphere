
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Eye, FileText as FileTextIcon, Loader2, AlertTriangle, RefreshCw, Edit, Trash2, PlusCircle, UploadCloud, StickyNote, FileEdit } from "lucide-react";
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
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  uploadedBy?: string;
  uploaderEmail?: string;
  documentContentType?: 'file' | 'text';
  content?: string; // For text documents
}

const categories = ["Operations", "Safety", "HR", "Training", "Service", "Regulatory", "General", "Manuals", "Bulletins", "Forms", "Procedures", "Memos"];
const documentSources = [
  "Operations Manual (OMA)",
  "Operations Manual (OMD)",
  "Cabin Safety Manual (CSM)",
  "EASA",
  "IATA",
  "ICAO",
  "DGAC",
  "Cabin Procedures Manual (CPM)",
  "Compagnie procedures",
  "Relevant Tunisian laws",
  "Internal Memo",
  "Safety Bulletin",
  "Operational Notice",
  "Other",
];

export default function AdminDocumentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [documents, setDocuments] = React.useState<Document[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
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
          uploadedBy: data.uploadedBy,
          uploaderEmail: data.uploaderEmail,
          documentContentType: data.documentContentType || 'file', // Default to file if not set
          content: data.content,
        } as Document;
      });
      setDocuments(fetchedDocuments);
    } catch (err) {
      console.error("Error fetching documents:", err);
      setError("Failed to load documents.");
      toast({ title: "Loading Error", description: "Could not fetch documents.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'admin') {
        router.push('/'); 
      } else {
        fetchDocuments();
      }
    }
  }, [user, authLoading, router, fetchDocuments]);

  const getIconForDocumentType = (doc: Document) => {
    if (doc.documentContentType === 'text') {
      return <StickyNote className="h-5 w-5 text-yellow-500" />;
    }
    if (!doc.fileType) return <FileTextIcon className="h-5 w-5 text-muted-foreground" />;
    if (doc.fileType.includes("pdf") || doc.fileType.includes("word") || doc.fileType.includes("document") || doc.fileType.includes("excel") || doc.fileType.includes("sheet")) {
      return <FileTextIcon className="h-5 w-5 text-primary" />;
    }
    return <FileTextIcon className="h-5 w-5 text-muted-foreground" />;
  };

  const formatDate = (dateValue: Timestamp | string) => {
    if (!dateValue) return "N/A";
    if (typeof dateValue === "string") {
      try { return format(new Date(dateValue), "PPp"); } catch (e) { return dateValue; }
    }
    if (dateValue instanceof Timestamp) { return format(dateValue.toDate(), "PPp"); }
    return "Invalid Date";
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (doc.uploaderEmail || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || doc.category === categoryFilter;
    const matchesSource = sourceFilter === "all" || doc.source === sourceFilter; 
    return matchesSearch && matchesCategory && matchesSource;
  });

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


  if (authLoading || (isLoading && !user)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user || user.role !== 'admin') {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <CardTitle className="text-xl mb-2">Access Denied</CardTitle>
        <p className="text-muted-foreground">You do not have permission to view this page.</p>
        <Button onClick={() => router.push('/')} className="mt-4">Go to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start gap-2">
          <div>
            <CardTitle className="text-2xl font-headline flex items-center">
              <FileTextIcon className="mr-3 h-7 w-7 text-primary" />
              Document Management
            </CardTitle>
            <CardDescription>View, upload files, or create textual notes/procedures.</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={fetchDocuments} disabled={isLoading} className="w-full sm:w-auto">
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/admin/documents/upload">
                <UploadCloud className="mr-2 h-4 w-4" />
                Upload File
              </Link>
            </Button>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/admin/documents/create-note">
                <FileEdit className="mr-2 h-4 w-4" /> {/* Changed icon */}
                Create Note
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Input 
              placeholder="Search by title or uploader..." 
              className="flex-grow sm:flex-grow-0 sm:max-w-xs" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={isLoading} 
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
                {categories.map(cat => (
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
            <p className="text-muted-foreground text-center py-10">No documents found matching your criteria. Click "Upload File" or "Create Note" to add new content.</p>
          )}

          {!isLoading && !error && filteredDocuments.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Provenance</TableHead> 
                    <TableHead>Version</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Uploaded By</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>{getIconForDocumentType(doc)}</TableCell>
                      <TableCell className="font-medium max-w-xs truncate" title={doc.title}>{doc.title}</TableCell>
                      <TableCell><Badge variant="outline">{doc.category}</Badge></TableCell>
                      <TableCell><Badge variant="secondary">{doc.source}</Badge></TableCell> 
                      <TableCell>{doc.version || "N/A"}</TableCell>
                      <TableCell>{doc.documentContentType === 'text' ? "N/A" : (doc.size || "N/A")}</TableCell>
                      <TableCell className="text-xs">{doc.uploaderEmail || 'N/A'}</TableCell>
                      <TableCell className="text-xs">{formatDate(doc.lastUpdated)}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => handleViewDocument(doc)} aria-label={`View document: ${doc.title}`}>
                            <Eye className="h-4 w-4" />
                        </Button>
                        {doc.documentContentType === 'file' && doc.downloadURL && (
                            <Button variant="ghost" size="icon" asChild aria-label={`Download document: ${doc.title}`}>
                                <a href={doc.downloadURL} download><Download className="h-4 w-4" /></a>
                            </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => toast({ title: "Edit Document", description: "Editing functionality coming soon!"})} disabled aria-label={`Edit document: ${doc.title}`}>
                          <Edit className="h-4 w-4" />
                        </Button>
                         <Button variant="ghost" size="icon" onClick={() => toast({ title: "Delete Document", description: "Deletion functionality coming soon!"})} disabled className="text-destructive hover:text-destructive/80" aria-label={`Delete document: ${doc.title}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
            <ScrollArea className="flex-grow pr-6 -mr-6"> {/* Added negative margin for scrollbar */}
                <div className="py-4 prose prose-sm max-w-none dark:prose-invert text-foreground whitespace-pre-wrap">
                    <ReactMarkdown>{selectedDocumentForView.content || "No content available."}</ReactMarkdown>
                </div>
            </ScrollArea>
            <DialogFooter className="mt-auto pt-4 border-t"> {/* Ensure footer is at bottom */}
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
