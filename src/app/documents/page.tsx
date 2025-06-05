
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, Eye, File, FileSpreadsheet, FileText as FileTextIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const documents = [
  { id: "FOM-2024-V3", title: "Flight Operations Manual", type: "Manual", version: "3.0", lastUpdated: "2024-07-15", category: "Operations", icon: File, size: "15.2MB" },
  { id: "SPG-2024-V1.2", title: "Safety Procedures Guide", type: "Guide", version: "1.2", lastUpdated: "2024-06-28", category: "Safety", icon: File, size: "8.5MB" },
  { id: "CHB-2023-V2", title: "Company Handbook", type: "Policy", version: "2.0", lastUpdated: "2023-12-10", category: "HR", icon: FileTextIcon, size: "3.1MB" },
  { id: "TRM-ADV-CRM", title: "Advanced CRM Training", type: "Training Material", version: "N/A", lastUpdated: "2024-05-01", category: "Training", icon: FileTextIcon, size: "12.0MB" },
  { id: "EMG-PROC-001", title: "Emergency Evacuation Checklist", type: "Checklist", version: "1.5", lastUpdated: "2024-07-01", category: "Safety", icon: FileSpreadsheet, size: "0.8MB" },
  { id: "SVC-STD-JUL24", title: "In-flight Service Standards", type: "Standard", version: "July 2024", lastUpdated: "2024-07-05", category: "Service", icon: File, size: "2.5MB" },
];

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Document Library</CardTitle>
          <CardDescription>Access all essential manuals, procedures, policies, and training materials.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Input placeholder="Search documents..." className="max-w-xs" />
            <Select defaultValue="all">
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="operations">Operations</SelectItem>
                <SelectItem value="safety">Safety</SelectItem>
                <SelectItem value="hr">HR</SelectItem>
                <SelectItem value="training">Training</SelectItem>
                <SelectItem value="service">Service</SelectItem>
              </SelectContent>
            </Select>
            <Button>Search</Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Icon</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => {
                  const Icon = doc.icon;
                  return (
                    <TableRow key={doc.id}>
                      <TableCell><Icon className="h-6 w-6 text-primary" /></TableCell>
                      <TableCell className="font-medium">{doc.title}</TableCell>
                      <TableCell><Badge variant="outline">{doc.category}</Badge></TableCell>
                      <TableCell>{doc.version}</TableCell>
                      <TableCell>{doc.lastUpdated}</TableCell>
                      <TableCell>{doc.size}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="icon" aria-label="View document">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Download document">
                          <Download className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
