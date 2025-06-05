
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, Eye, FileText as FileTextIcon, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
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

interface Document {
  id: string;
  title: string;
  category: string;
  version?: string;
  lastUpdated: Timestamp | string; // Can be Firestore Timestamp or string date
  size?: string;
  downloadURL: string;
  iconName?: "FileTextIcon" | "FileSpreadsheet"; // Example icon names
}

export default function DocumentsPage() {
  const [documents, setDocuments] = React.useState<Document[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { toast } = useToast();

  // Define available categories for the filter dropdown
  const categories = ["Operations", "Safety", "HR", "Training", "Service", "Regulatory", "General"];


  const fetchDocuments = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // For now, let's order by title. We can make this more sophisticated later.
      const q = query(collection(db, "documents"), orderBy("title", "asc"));
      const querySnapshot = await getDocs(q);
      const fetchedDocuments = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || "Untitled Document",
          category: data.category || "Uncategorized",
          version: data.version,
          lastUpdated: data.lastUpdated, // Keep as Timestamp or string
          size: data.size,
          downloadURL: data.downloadURL || "#",
          iconName: data.iconName,
        } as Document;
      });
      setDocuments(fetchedDocuments);
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

  const getIconForDocument = (doc: Document) => {
    // Basic mapping, can be expanded
    if (doc.iconName === "FileSpreadsheet") return <FileTextIcon className="h-6 w-6 text-primary" />; // Placeholder, ideally use actual FileSpreadsheet
    return <FileTextIcon className="h-6 w-6 text-primary" />;
  };

  const formatDate = (dateValue: Timestamp | string) => {
    if (!dateValue) return "N/A";
    if (typeof dateValue === "string") {
      try {
        return format(new Date(dateValue), "yyyy-MM-dd");
      } catch (e) {
        return dateValue; // If string is not a valid date, show as is
      }
    }
    if (dateValue instanceof Timestamp) {
      return format(dateValue.toDate(), "yyyy-MM-dd");
    }
    return "Invalid Date";
  };

  return (
    <div className="space-y-6">
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
            <Input placeholder="Search documents... (coming soon)" className="max-w-xs" disabled={isLoading} />
            <Select defaultValue="all" disabled={isLoading}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat.toLowerCase()}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button disabled={isLoading}>Search</Button>
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

          {!isLoading && !error && documents.length === 0 && (
            <p className="text-muted-foreground text-center py-10">No documents found. Admins can upload documents via the Admin Console.</p>
          )}

          {!isLoading && !error && documents.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Icon</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>{getIconForDocument(doc)}</TableCell>
                      <TableCell className="font-medium">{doc.title}</TableCell>
                      <TableCell><Badge variant="outline">{doc.category}</Badge></TableCell>
                      <TableCell>{doc.version || "N/A"}</TableCell>
                      <TableCell>{formatDate(doc.lastUpdated)}</TableCell>
                      <TableCell>{doc.size || "N/A"}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="icon" asChild aria-label="View document">
                          <a href={doc.downloadURL} target="_blank" rel="noopener noreferrer"><Eye className="h-4 w-4" /></a>
                        </Button>
                        <Button variant="ghost" size="icon" asChild aria-label="Download document">
                           <a href={doc.downloadURL} download><Download className="h-4 w-4" /></a>
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
    </div>
  );

    