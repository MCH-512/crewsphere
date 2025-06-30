
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter as DialogPrimitiveFooter, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Eye, FileText as FileTextIcon, Loader2, AlertTriangle, RefreshCw, Layers, Building, Flag, Shield, Globe, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp } from "firebase/firestore";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { AnimatedCard } from "@/components/motion/animated-card";
import ReactMarkdown from "react-markdown";
import { documentCategories, documentSources } from "@/config/document-options";
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

const familyConfig = {
    "Documentation Compagnie": { icon: Building, description: "Procédures opérationnelles standard, manuels et notes de service internes." },
    "Documentation Tunisienne": { icon: Flag, description: "Réglementations et publications des autorités de l'aviation civile tunisienne." },
    "Documentation Européenne": { icon: Shield, description: "Règles et directives de l'Agence de l'Union européenne pour la sécurité aérienne (EASA)." },
    "Documentation Internationale": { icon: Globe, description: "Normes et pratiques recommandées par l'OACI et l'IATA." },
    "Autre": { icon: HelpCircle, description: "Documents divers et autres références externes." }
};


export default function DocumentsPage() {
  const [allDocuments, setAllDocuments] = React.useState<Document[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { toast } = useToast();

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
          source: data.source || "Autre",
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
  
  const groupedDocuments = React.useMemo(() => {
    return documentSources.reduce((acc, source) => {
        acc[source] = allDocuments.filter(doc => doc.source === source);
        return acc;
    }, {} as Record<string, Document[]>);
  }, [allDocuments]);


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
              <CardTitle className="text-2xl font-headline">Bibliothèque de Documents</CardTitle>
              <CardDescription>Accédez à tous les manuels, procédures, politiques et supports de formation essentiels.</CardDescription>
            </div>
             <Button variant="outline" onClick={fetchDocuments} disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </CardHeader>
        </Card>
      </AnimatedCard>

       {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="ml-3 text-muted-foreground">Chargement des documents...</p>
          </div>
        ) : error ? (
           <div className="p-4 mb-4 text-sm text-destructive-foreground bg-destructive rounded-md flex items-center gap-2 justify-center">
            <AlertTriangle className="h-5 w-5" /> {error}
          </div>
        ) : (
            <Accordion type="multiple" className="w-full space-y-4">
            {documentSources.map((family) => {
                const docs = groupedDocuments[family];
                const familyInfo = familyConfig[family as keyof typeof familyConfig] || { icon: HelpCircle, description: "" };
                const IconComponent = familyInfo.icon;
                
                if (!docs || docs.length === 0) return null;

                return (
                    <Card key={family} className="shadow-md">
                        <AccordionItem value={family} className="border-b-0">
                            <AccordionTrigger className="p-4 hover:no-underline">
                                <div className="flex items-center gap-3">
                                    <IconComponent className="h-6 w-6 text-primary" />
                                    <div className="text-left">
                                        <h3 className="text-lg font-semibold">{family}</h3>
                                        <p className="text-xs text-muted-foreground font-normal">{familyInfo.description}</p>
                                    </div>
                                    <Badge variant="secondary">{docs.length}</Badge>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <div className="space-y-2 px-4 pb-4">
                                {docs.map(doc => (
                                    <div key={doc.id} className="border rounded-md p-3 flex justify-between items-center hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            {getIconForDocumentType(doc)}
                                            <div>
                                                <p className="font-medium text-sm">{doc.title}</p>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <Badge variant="outline" className="px-1.5 py-0">{doc.category}</Badge>
                                                    <span>|</span>
                                                    <span>Mis à jour: {formatDate(doc.lastUpdated)}</span>
                                                    {doc.version && <span>| Ver: {doc.version}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                             <Button variant="ghost" size="sm" onClick={() => handleViewDocument(doc)}>
                                                <Eye className="mr-2 h-4 w-4" /> Voir
                                            </Button>
                                            {(doc.documentContentType === 'file' || doc.documentContentType === 'fileWithMarkdown') && doc.downloadURL && (
                                                <Button variant="ghost" size="sm" asChild>
                                                    <a href={doc.downloadURL} download={doc.fileName || doc.title}><Download className="mr-2 h-4 w-4" /> Télécharger</a>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Card>
                )
            })}
            </Accordion>
        )}


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
