
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import { 
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogPrimitiveDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle as AlertDialogPrimitiveTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area"; 
import { Download, Eye, FileText as FileTextIcon, Loader2, AlertTriangle, RefreshCw, FilePlus, StickyNote, Layers } from "lucide-react"; // Added FilePlus, Layers
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db, storage } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp, doc, deleteDoc } from "firebase/firestore";
import { ref as storageRef, deleteObject } from "firebase/storage";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { AnimatedCard } from "@/components/motion/animated-card";
import { documentCategories, documentSources } from "@/config/document-options";
import { logAuditEvent } from "@/lib/audit-logger";

interface Document {
  id: string;
  title: string;
  category: string;
  source: string; 
  version?: string;
  lastUpdated: Timestamp | string;
  size?: string;
  downloadURL?: string; 
  filePath?: string; 
  fileName?: string; 
  fileType?: string; 
  uploadedBy?: string;
  uploaderEmail?: string;
  documentContentType?: 'file' | 'markdown' | 'fileWithMarkdown'; 
  content?: string; 
}

const categories = documentCategories; // Use imported categories

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
  
  const [documentToDelete, setDocumentToDelete] = React.useState<Document | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const [totalDocumentsCount, setTotalDocumentsCount] = React.useState<number>(0);
  const [fileCount, setFileCount] = React.useState<number>(0);
  const [textNoteCount, setTextNoteCount] = React.useState<number>(0);
  const [combinedCount, setCombinedCount] = React.useState<number>(0);


  const fetchDocuments = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setTotalDocumentsCount(0);
    setFileCount(0);
    setTextNoteCount(0);
    setCombinedCount(0);
    try {
      const q = query(collection(db, "documents"), orderBy("lastUpdated", "desc"));
      const querySnapshot = await getDocs(q);
      let tempFileCount = 0;
      let tempTextNoteCount = 0;
      let tempCombinedCount = 0;

      const fetchedDocuments = querySnapshot.docs.map(doc => {
        const data = doc.data();
        const docContentType = data.documentContentType || (data.downloadURL ? 'file' : 'markdown'); 
        if (docContentType === 'file') {
          tempFileCount++;
        } else if (docContentType === 'markdown') {
          tempTextNoteCount++;
        } else if (docContentType === 'fileWithMarkdown') {
          tempCombinedCount++;
        }
        return {
          id: doc.id,
          title: data.title || "Untitled Document",
          category: data.category || "Uncategorized",
          source: data.source || "Unknown", 
          version: data.version,
          lastUpdated: data.lastUpdated,
          size: data.size,
          downloadURL: data.downloadURL,
          filePath: data.filePath, 
          fileType: data.fileType,
          uploadedBy: data.uploadedBy,
          uploaderEmail: data.uploaderEmail,
          documentContentType: docContentType,
          content: data.content,
        } as Document;
      });
      setDocuments(fetchedDocuments);
      setTotalDocumentsCount(fetchedDocuments.length);
      setFileCount(tempFileCount);
      setTextNoteCount(tempTextNoteCount);
      setCombinedCount(tempCombinedCount);

    } catch (err) {
      console.error("Error fetching documents:", err);
      setError("Failed to load documents. Please try again.");
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

  const handleDeleteDocument = async () => {
    if (!documentToDelete || !user) return;
    setIsDeleting(true);
    try {
      // Delete Firestore document
      await deleteDoc(doc(db, "documents", documentToDelete.id));

      // Delete file from Firebase Storage if filePath exists
      if (documentToDelete.filePath && (documentToDelete.documentContentType === 'file' || documentToDelete.documentContentType === 'fileWithMarkdown')) {
        const fileRef = storageRef(storage, documentToDelete.filePath);
        try {
            await deleteObject(fileRef);
        } catch (storageError: any) {
            // Log storage error but proceed if Firestore deletion was successful
            console.warn(`Could not delete file ${documentToDelete.filePath} from storage:`, storageError);
            if (storageError.code !== 'storage/object-not-found') { // Don't toast if file was already gone
                 toast({ title: "File Deletion Warning", description: `Document record deleted, but associated file could not be removed from storage: ${storageError.message}`, variant: "warning" });
            }
        }
      }
      
      await logAuditEvent({
        userId: user.uid,
        userEmail: user.email || "N/A",
        actionType: "DELETE_DOCUMENT",
        entityType: "DOCUMENT",
        entityId: documentToDelete.id,
        details: { title: documentToDelete.title, category: documentToDelete.category, source: documentToDelete.source },
      });

      toast({ title: "Document Deleted", description: `"${documentToDelete.title}" has been successfully deleted.` });
      setDocumentToDelete(null); 
      fetchDocuments(); 
    } catch (error) {
      console.error("Error deleting document:", error);
      toast({ title: "Deletion Failed", description: "Could not delete the document. Please try again.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

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
      try { return format(new Date(dateValue), "PPp"); } catch (e) { return dateValue; }
    }
    if (dateValue instanceof Timestamp) { return format(dateValue.toDate(), "PPp"); }
    return "Invalid Date";
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (doc.uploaderEmail || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (doc.source || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || doc.category === categoryFilter;
    const matchesSource = sourceFilter === "all" || doc.source === sourceFilter; 
    return matchesSearch && matchesCategory && matchesSource;
  });

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
            <CardDescription>View, create, and manage documents, notes, and procedures.</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={fetchDocuments} disabled={isLoading} className="w-full sm:w-auto">
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/admin/documents/create">
                <FilePlus className="mr-2 h-4 w-4" />
                Create Document
              </Link>
            </Button>
          </div>
        </CardHeader>
      </Card>
      
      <AnimatedCard delay={0.1}>
        <Card className="shadow-md">
            <CardHeader>
                <CardTitle className="text-lg font-headline flex items-center">
                    Document Statistics
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading && totalDocumentsCount === 0 ? (
                    <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <p className="ml-2 text-muted-foreground">Loading statistics...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-center sm:text-left">
                        <div>
                            <p className="text-sm text-muted-foreground">Total Documents</p>
                            <p className="text-2xl font-bold">{totalDocumentsCount}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Files Only</p>
                            <p className="text-2xl font-bold">{fileCount}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Text Only</p>
                            <p className="text-2xl font-bold">{textNoteCount}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Combined (Text + File)</p>
                            <p className="text-2xl font-bold">{combinedCount}</p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
      </AnimatedCard>

      <Card className="shadow-lg mt-6">
        <CardHeader>
            <CardTitle className="text-xl font-headline">Document List & Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Input 
              placeholder="Search by title, uploader, or source..." 
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

          {isLoading && documents.length === 0 && (
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
            <p className="text-muted-foreground text-center py-10">No documents found matching your criteria. Click "Create Document" to add new content.</p>
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
                      <TableCell>{doc.documentContentType === 'markdown' ? "N/A" : (doc.size || "N/A")}</TableCell>
                      <TableCell className="text-xs">{doc.uploaderEmail || 'N/A'}</TableCell>
                      <TableCell className="text-xs">{formatDate(doc.lastUpdated)}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => handleViewDocument(doc)} aria-label={`View document: ${doc.title}`}>
                            <Eye className="h-4 w-4" />
                        </Button>
                        {(doc.documentContentType === 'file' || doc.documentContentType === 'fileWithMarkdown') && doc.downloadURL && (
                            <Button variant="ghost" size="icon" asChild aria-label={`Download document: ${doc.title}`}>
                                <a href={doc.downloadURL} download={doc.fileName || doc.title}><Download className="h-4 w-4" /></a>
                            </Button>
                        )}
                        <Button variant="ghost" size="icon" asChild aria-label={`Edit document: ${doc.title}`}>
                          <Link href={`/admin/documents/edit/${doc.id}`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" aria-label={`Delete document: ${doc.title}`} onClick={() => setDocumentToDelete(doc)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogPrimitiveTitle>Confirm Deletion</AlertDialogPrimitiveTitle>
                                <AlertDialogPrimitiveDescription>
                                    Are you sure you want to delete the document: "{documentToDelete?.title}"?
                                    {(documentToDelete?.documentContentType === 'file' || documentToDelete?.documentContentType === 'fileWithMarkdown') && " This will also delete the associated file from storage."}
                                    This action cannot be undone.
                                </AlertDialogPrimitiveDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setDocumentToDelete(null)} disabled={isDeleting}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteDocument} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell> 
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
}
