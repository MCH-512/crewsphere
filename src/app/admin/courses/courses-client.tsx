
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, writeBatch, doc, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, AlertTriangle, RefreshCw, PlusCircle, Trash2, Edit, Search, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { courseCategories, courseTypes } from "@/schemas/course-schema";
import { StoredCourse } from "@/schemas/course-schema";
import { logAuditEvent } from "@/lib/audit-logger";
import { Badge } from "@/components/ui/badge";
import { SortableHeader } from "@/components/custom/custom-sortable-header";
import { CourseForm } from "@/components/admin/course-form";

type SortableColumn = 'title' | 'category' | 'courseType' | 'published';
type SortDirection = 'asc' | 'desc';
type CourseCategory = StoredCourse["category"];
type CourseType = StoredCourse["courseType"];
type StatusFilter = "all" | "published" | "draft";

export function AdminCoursesClient({ initialCourses }: { initialCourses: StoredCourse[] }) {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [courses, setCourses] = React.useState<StoredCourse[]>(initialCourses);
    const [isLoading, setIsLoading] = React.useState(false); // For manual refreshes
    const [isManageDialogOpen, setIsManageDialogOpen] = React.useState(false);
    
    const [isEditMode, setIsEditMode] = React.useState(false);
    const [currentCourse, setCurrentCourse] = React.useState<StoredCourse | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [courseToDelete, setCourseToDelete] = React.useState<StoredCourse | null>(null);
    
    const [sortColumn, setSortColumn] = React.useState<SortableColumn>("title");
    const [sortDirection, setSortDirection] = React.useState<SortDirection>("asc");
    
    const [searchTerm, setSearchTerm] = React.useState("");
    const [categoryFilter, setCategoryFilter] = React.useState<CourseCategory | "all">("all");
    const [typeFilter, setTypeFilter] = React.useState<CourseType | "all">("all");
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");

    const refreshCourses = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, "courses"), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredCourse)));
            toast({ title: "Refreshed", description: "Course list has been updated." });
        } catch (err) {
            toast({ title: "Error", description: "Could not refresh courses.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        if (!authLoading) {
            if (!user || user.role !== 'admin') router.push('/');
        }
    }, [user, authLoading, router]);
    
     const sortedCourses = React.useMemo(() => {
        const filtered = courses.filter(course => {
            if (searchTerm && !course.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            if (categoryFilter !== 'all' && course.category !== categoryFilter) return false;
            if (typeFilter !== 'all' && course.courseType !== typeFilter) return false;
            if (statusFilter !== 'all') {
                if (statusFilter === 'published' && !course.published) return false;
                if (statusFilter === 'draft' && course.published) return false;
            }
            return true;
        });

        const sorted = [...filtered];
        sorted.sort((a, b) => {
            const valA = a[sortColumn];
            const valB = b[sortColumn];
            let comparison = 0;

            if (typeof valA === 'boolean' && typeof valB === 'boolean') {
                comparison = valA === valB ? 0 : valA ? -1 : 1;
            } else {
                comparison = String(valA).localeCompare(String(valB));
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });
        return sorted;
    }, [courses, sortColumn, sortDirection, searchTerm, categoryFilter, typeFilter, statusFilter]);

    const handleSort = (column: SortableColumn) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const handleOpenDialog = (courseToEdit?: StoredCourse) => {
        if (courseToEdit) {
            setIsEditMode(true);
            setCurrentCourse(courseToEdit);
        } else {
            setIsEditMode(false);
            setCurrentCourse(null);
        }
        setIsManageDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!courseToDelete || !user) return;
        try {
            const batch = writeBatch(db);
            const questionsQuery = query(collection(db, "questions"), where("quizId", "==", courseToDelete.quizId));
            const questionsSnapshot = await getDocs(questionsQuery);
            questionsSnapshot.docs.forEach(d => batch.delete(d.ref));
            batch.delete(doc(db, "quizzes", courseToDelete.quizId));
            batch.delete(doc(db, "certificateRules", courseToDelete.certificateRuleId));
            batch.delete(doc(db, "courses", courseToDelete.id));

            await batch.commit();
            await logAuditEvent({ userId: user.uid, userEmail: user.email!, actionType: 'DELETE_COURSE', entityType: "COURSE", entityId: courseToDelete.id, details: { title: courseToDelete.title }});
            toast({ title: "Course Deleted", description: `"${courseToDelete.title}" and all its associated data have been removed.` });
            refreshCourses();
        } catch (error) {
            console.error(error);
            toast({ title: "Deletion Failed", variant: "destructive" });
        } finally {
            setIsDeleteDialogOpen(false);
            setCourseToDelete(null);
        }
    };
    
    const onFormSubmitSuccess = () => {
        setIsManageDialogOpen(false);
        refreshCourses();
    }

    if (authLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    if (!user || user.role !== 'admin') return <div className="text-center p-4"><AlertTriangle className="mx-auto h-12 w-12 text-destructive" /><CardTitle>Access Denied</CardTitle></div>;

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader className="flex flex-row justify-between items-start">
                    <div>
                        <CardTitle className="text-2xl font-headline flex items-center"><GraduationCap className="mr-3 h-7 w-7 text-primary" />Course Management</CardTitle>
                        <CardDescription>Create, manage, and publish e-learning courses.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={refreshCourses} disabled={isLoading}><RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />Refresh</Button>
                        <Button onClick={() => handleOpenDialog()}><PlusCircle className="mr-2 h-4 w-4" />Create Course</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-2 mb-6">
                        <div className="relative flex-grow">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search by title..."
                                className="pl-8 w-full"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as any)}>
                            <SelectTrigger className="w-full md:w-[240px]"><Filter className="mr-2 h-4 w-4" /><SelectValue placeholder="Filter by category" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All Categories</SelectItem>{courseCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                         <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as any)}>
                            <SelectTrigger className="w-full md:w-[200px]"><Filter className="mr-2 h-4 w-4" /><SelectValue placeholder="Filter by type" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All Types</SelectItem>{courseTypes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
                            <SelectTrigger className="w-full md:w-[180px]"><Filter className="mr-2 h-4 w-4" /><SelectValue placeholder="Filter by status" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="draft">Draft</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <Table>
                        <TableHeader><TableRow>
                            <SortableHeader<SortableColumn> column="title" label="Title" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                            <SortableHeader<SortableColumn> column="category" label="Category" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                            <SortableHeader<SortableColumn> column="courseType" label="Type" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                            <SortableHeader<SortableColumn> column="published" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                            <TableHead>Actions</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                            {sortedCourses.map(course => (
                                <TableRow key={course.id}>
                                    <TableCell className="font-medium">{course.title}</TableCell>
                                    <TableCell>{course.category}</TableCell>
                                    <TableCell>{course.courseType}</TableCell>
                                    <TableCell>
                                        <Badge variant={course.published ? "success" : "secondary"}>
                                            {course.published ? "Published" : "Draft"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="space-x-1">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(course)} title="Edit Course Details"><Edit className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title="Delete Course" onClick={() => { setCourseToDelete(course); setIsDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {sortedCourses.length === 0 && <p className="text-center text-muted-foreground p-8">No courses found matching your criteria.</p>}
                </CardContent>
            </Card>

            <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
                <DialogContent className="max-w-4xl">
                     <CourseForm 
                        isEditMode={isEditMode}
                        currentCourse={currentCourse}
                        onFormSubmitSuccess={onFormSubmitSuccess}
                     />
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the course "{courseToDelete?.title}" and all its associated data, including its quiz, questions, and any user progress.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setCourseToDelete(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete Course</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

