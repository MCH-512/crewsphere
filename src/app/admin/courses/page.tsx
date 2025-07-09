
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { db, storage } from "@/lib/firebase";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { collection, getDocs, query, orderBy, writeBatch, doc, serverTimestamp, where, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, AlertTriangle, RefreshCw, PlusCircle, Trash2, Edit, CheckSquare, ListOrdered, FileQuestion, ArrowUpDown, ArrowUp, ArrowDown, Search, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { courseFormSchema, CourseFormValues, courseCategories, courseTypes } from "@/schemas/course-schema";
import { StoredCourse } from "@/schemas/course-schema";
import { logAuditEvent } from "@/lib/audit-logger";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { StoredQuiz, StoredCertificateRule } from "@/schemas/course-schema";
import { generateCourseImage } from "@/ai/flows/generate-course-image-flow";
import { Badge } from "@/components/ui/badge";

type SortableColumn = 'title' | 'category' | 'courseType' | 'published';
type SortDirection = 'asc' | 'desc';
type CourseCategory = StoredCourse["category"];
type CourseType = StoredCourse["courseType"];
type StatusFilter = "all" | "published" | "draft";


export default function AdminCoursesPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [courses, setCourses] = React.useState<StoredCourse[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isManageDialogOpen, setIsManageDialogOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
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


    const form = useForm<CourseFormValues>({
        resolver: zodResolver(courseFormSchema),
        defaultValues: {
            title: "", description: "", category: undefined, courseType: undefined,
            referenceBody: "", duration: "", mandatory: true, published: false, imageHint: "",
            chapters: [{ title: "" }], quizTitle: "",
            passingThreshold: 80, certificateExpiryDays: 365,
            questions: [{ questionText: "", options: ["", "", ""], correctAnswer: "" }]
        },
    });

    const { fields: chapterFields, append: appendChapter, remove: removeChapter } = useFieldArray({ control: form.control, name: "chapters" });
    const { fields: questionFields, append: appendQuestion, remove: removeQuestion } = useFieldArray({ control: form.control, name: "questions" });

    const fetchCourses = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, "courses"), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredCourse)));
        } catch (err) {
            toast({ title: "Error", description: "Could not fetch courses.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        if (!authLoading) {
            if (!user || user.role !== 'admin') router.push('/');
            else fetchCourses();
        }
    }, [user, authLoading, router, fetchCourses]);
    
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
    
    const SortableHeader = ({ column, label }: { column: SortableColumn; label: string }) => (
        <TableHead onClick={() => handleSort(column)} className="cursor-pointer hover:bg-muted/50">
            <div className="flex items-center gap-2">
                {label}
                {sortColumn === column ? (
                    sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                ) : (
                    <ArrowUpDown className="h-4 w-4 opacity-50" />
                )}
            </div>
        </TableHead>
    );

    const handleOpenDialog = async (courseToEdit?: StoredCourse) => {
        if (courseToEdit) {
            setIsEditMode(true);
            setCurrentCourse(courseToEdit);
            try {
                const quizSnap = await getDoc(doc(db, "quizzes", courseToEdit.quizId));
                const certRuleSnap = await getDoc(doc(db, "certificateRules", courseToEdit.certificateRuleId));
                const quizData = quizSnap.data() as StoredQuiz;
                const certRuleData = certRuleSnap.data() as StoredCertificateRule;

                form.reset({
                    title: courseToEdit.title, description: courseToEdit.description,
                    category: courseToEdit.category, courseType: courseToEdit.courseType,
                    referenceBody: courseToEdit.referenceBody, duration: courseToEdit.duration,
                    mandatory: courseToEdit.mandatory, published: courseToEdit.published,
                    imageHint: courseToEdit.imageHint,
                    quizTitle: quizData.title,
                    passingThreshold: certRuleData.passingThreshold,
                    certificateExpiryDays: certRuleData.expiryDurationDays,
                    chapters: courseToEdit.chapters,
                    questions: [], 
                });
            } catch (error) {
                toast({ title: "Error", description: "Could not load course data for editing.", variant: "destructive"});
                return;
            }
        } else {
            setIsEditMode(false);
            setCurrentCourse(null);
            form.reset({
                title: "", description: "", category: undefined, courseType: undefined,
                referenceBody: "", duration: "", mandatory: true, published: false, imageHint: "",
                chapters: [{ title: "" }], quizTitle: "",
                passingThreshold: 80, certificateExpiryDays: 365,
                questions: [{ questionText: "", options: ["", "", ""], correctAnswer: "" }]
            });
        }
        setIsManageDialogOpen(true);
    };


    const handleFormSubmit = async (data: CourseFormValues) => {
        if (!user) return;
        setIsSubmitting(true);
        try {
            const batch = writeBatch(db);
            let imageUrl: string | undefined = undefined;

            const courseRef = isEditMode && currentCourse ? doc(db, "courses", currentCourse.id) : doc(collection(db, "courses"));
            
            if (data.imageHint && storage) {
                try {
                    toast({ title: "Generating AI Image...", description: "This may take a moment. Please wait." });
                    const result = await generateCourseImage({ prompt: data.imageHint });
                    if (result.imageDataUri) {
                        const storageRef = ref(storage, `course-images/${courseRef.id}/${Date.now()}.png`);
                        await uploadString(storageRef, result.imageDataUri, 'data_url');
                        imageUrl = await getDownloadURL(storageRef);
                         toast({ title: "AI Image Generated", description: "The course image has been successfully created." });
                    }
                } catch (imageError) {
                    console.error("AI Image generation/upload failed:", imageError);
                    toast({ title: "AI Image Failed", description: "Could not generate AI image, continuing without it.", variant: "default" });
                }
            }


            if (isEditMode && currentCourse) {
                const quizRef = doc(db, "quizzes", currentCourse.quizId);
                const certRuleRef = doc(db, "certificateRules", currentCourse.certificateRuleId);
                
                const updateData: Partial<StoredCourse> = {
                    title: data.title, description: data.description, category: data.category,
                    courseType: data.courseType, referenceBody: data.referenceBody, duration: data.duration,
                    mandatory: data.mandatory, published: data.published, imageHint: data.imageHint,
                    chapters: data.chapters.filter(c => c.title.trim() !== ""),
                    updatedAt: serverTimestamp(),
                };

                if (imageUrl) {
                    updateData.imageUrl = imageUrl;
                }

                batch.update(courseRef, updateData);
                batch.update(quizRef, { title: data.quizTitle });
                batch.update(certRuleRef, { passingThreshold: data.passingThreshold, expiryDurationDays: data.certificateExpiryDays });

                await batch.commit();
                await logAuditEvent({ userId: user.uid, userEmail: user.email, actionType: 'UPDATE_COURSE', entityType: "COURSE", entityId: currentCourse.id, details: { title: data.title }});
                toast({ title: "Course Updated", description: `"${data.title}" has been updated successfully.` });
            
            } else {
                const quizRef = doc(collection(db, "quizzes"));
                const certRuleRef = doc(collection(db, "certificateRules"));

                batch.set(courseRef, {
                    title: data.title, description: data.description, category: data.category,
                    courseType: data.courseType, referenceBody: data.referenceBody, duration: data.duration,
                    mandatory: data.mandatory, published: data.published, imageHint: data.imageHint,
                    chapters: data.chapters.filter(c => c.title.trim() !== ""),
                    quizId: quizRef.id, certificateRuleId: certRuleRef.id,
                    imageUrl: imageUrl || null,
                    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
                });

                batch.set(quizRef, { courseId: courseRef.id, title: data.quizTitle, createdAt: serverTimestamp() });
                batch.set(certRuleRef, { courseId: courseRef.id, passingThreshold: data.passingThreshold, expiryDurationDays: data.certificateExpiryDays, createdAt: serverTimestamp() });

                data.questions.forEach(q => {
                    if (q.questionText.trim() !== "") {
                        const questionRef = doc(collection(db, "questions"));
                        batch.set(questionRef, { ...q, quizId: quizRef.id, questionType: 'mcq', createdAt: serverTimestamp() });
                    }
                });
                
                await batch.commit();
                await logAuditEvent({ userId: user.uid, userEmail: user.email, actionType: 'CREATE_COURSE', entityType: "COURSE", entityId: courseRef.id, details: { title: data.title }});
                toast({ title: "Course Created", description: `"${data.title}" has been saved successfully.` });
            }

            fetchCourses();
            setIsManageDialogOpen(false);
        } catch (error) {
            console.error(error);
            toast({ title: isEditMode ? "Update Failed" : "Creation Failed", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
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
            await logAuditEvent({ userId: user.uid, userEmail: user.email, actionType: 'DELETE_COURSE', entityType: "COURSE", entityId: courseToDelete.id, details: { title: courseToDelete.title }});
            toast({ title: "Course Deleted", description: `"${courseToDelete.title}" and all its data have been removed.` });
            fetchCourses();
        } catch (error) {
            console.error(error);
            toast({ title: "Deletion Failed", variant: "destructive" });
        } finally {
            setIsDeleteDialogOpen(false);
            setCourseToDelete(null);
        }
    };

    if (authLoading || isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
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
                        <Button variant="outline" onClick={fetchCourses} disabled={isLoading}><RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />Refresh</Button>
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
                            <SortableHeader column="title" label="Title" />
                            <SortableHeader column="category" label="Category" />
                            <SortableHeader column="courseType" label="Type" />
                            <SortableHeader column="published" label="Status" />
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
                                        <Button variant="ghost" size="icon" asChild title="Manage Quiz Questions"><Link href={`/admin/quizzes/${course.quizId}`}><CheckSquare className="h-4 w-4"/></Link></Button>
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
                    <DialogHeader>
                        <DialogTitle>{isEditMode ? "Edit Course" : "Create New Course"}</DialogTitle>
                        <DialogDescription>{isEditMode ? "Update course details below. Chapters and questions are managed separately." : "Fill out the details for the new course, chapters, and quiz questions."}</DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleFormSubmit)}>
                            <ScrollArea className="h-[70vh] p-4">
                                <div className="space-y-6">
                                    <FormField control={form.control} name="title" render={({ field }) => <FormItem><FormLabel>Course Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
                                    <FormField control={form.control} name="description" render={({ field }) => <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} className="min-h-[100px]" /></FormControl><FormMessage /></FormItem>} />
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <FormField control={form.control} name="category" render={({ field }) => <FormItem><FormLabel>Category</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select course category" /></SelectTrigger></FormControl><SelectContent>{courseCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
                                        <FormField control={form.control} name="courseType" render={({ field }) => <FormItem><FormLabel>Course Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select course type" /></SelectTrigger></FormControl><SelectContent>{courseTypes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
                                        <FormField control={form.control} name="referenceBody" render={({ field }) => <FormItem><FormLabel>Reference</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
                                        <FormField control={form.control} name="duration" render={({ field }) => <FormItem><FormLabel>Duration</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
                                        <FormField control={form.control} name="imageHint" render={({ field }) => <FormItem><FormLabel>AI Image Hint</FormLabel><FormControl><Input {...field} placeholder="e.g. cockpit, safety manual" /></FormControl><FormMessage /></FormItem>} />
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-4">
                                       <FormField control={form.control} name="mandatory" render={({ field }) => <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3"><div className="space-y-0.5"><FormLabel>Mandatory</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>} />
                                       <FormField control={form.control} name="published" render={({ field }) => <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3"><div className="space-y-0.5"><FormLabel>Published</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>} />
                                    </div>

                                    <Separator />
                                    <div className="space-y-4">
                                        <FormLabel className="font-semibold text-base flex items-center gap-2"><ListOrdered/>Chapters</FormLabel>
                                        {chapterFields.map((field, index) => (
                                            <FormField key={field.id} control={form.control} name={`chapters.${index}.title`} render={({ field }) => (
                                                <FormItem className="flex items-center gap-2"><FormControl><Input {...field} placeholder={`Chapter ${index + 1} title`} /></FormControl><Button type="button" variant="ghost" size="icon" onClick={() => removeChapter(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button><FormMessage /></FormItem>
                                            )}/>
                                        ))}
                                        <Button type="button" variant="outline" size="sm" onClick={() => appendChapter({ title: "" })}>Add Chapter</Button>
                                    </div>
                                    
                                    <Separator />
                                    <div className="space-y-4">
                                        <FormLabel className="font-semibold text-base flex items-center gap-2"><CheckSquare/>Quiz & Certificate</FormLabel>
                                         <FormField control={form.control} name="quizTitle" render={({ field }) => <FormItem><FormLabel>Quiz Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
                                         <div className="grid md:grid-cols-2 gap-4">
                                            <FormField control={form.control} name="passingThreshold" render={({ field }) => <FormItem><FormLabel>Passing Score (%)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl><FormMessage /></FormItem>} />
                                            <FormField control={form.control} name="certificateExpiryDays" render={({ field }) => <FormItem><FormLabel>Certificate Expiry (Days)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl><FormMessage /></FormItem>} />
                                         </div>
                                    </div>
                                    
                                    {!isEditMode && <>
                                    <Separator />
                                    <div className="space-y-4">
                                        <FormLabel className="font-semibold text-base flex items-center gap-2"><FileQuestion/>Quiz Questions</FormLabel>
                                        {questionFields.map((questionField, qIndex) => (
                                            <div key={questionField.id} className="space-y-3 p-4 border rounded-md relative">
                                                <Button type="button" variant="destructive" size="icon" className="absolute -top-3 -right-3 h-7 w-7" onClick={() => removeQuestion(qIndex)}><Trash2 className="h-4 w-4" /></Button>
                                                <FormField control={form.control} name={`questions.${qIndex}.questionText`} render={({ field }) => <FormItem><FormLabel>Question {qIndex + 1}</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>} />
                                                <div className="grid md:grid-cols-2 gap-2">
                                                    {[0, 1, 2, 3].map(oIndex => (
                                                        <FormField key={oIndex} control={form.control} name={`questions.${qIndex}.options.${oIndex}`} render={({ field }) => <FormItem><FormLabel>Option {oIndex + 1}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
                                                    ))}
                                                </div>
                                                <FormField control={form.control} name={`questions.${qIndex}.correctAnswer`} render={({ field }) => <FormItem><FormLabel>Correct Answer</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select the correct option" /></SelectTrigger></FormControl><SelectContent>{form.watch(`questions.${qIndex}.options`).filter(o => o?.trim() !== "").map((opt, optIndex) => <SelectItem key={optIndex} value={opt}>{opt}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
                                            </div>
                                        ))}
                                        <Button type="button" variant="outline" size="sm" onClick={() => appendQuestion({ questionText: "", options: ["", "", ""], correctAnswer: "" })}>Add Question</Button>
                                    </div>
                                    </>}
                                     {isEditMode && (
                                        <div className="p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
                                           Questions for this quiz can be managed from the <Link href={`/admin/quizzes/${currentCourse?.quizId}`} className="text-primary underline">quiz management page</Link>.
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                            <DialogFooter className="mt-4 pt-4 border-t">
                                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                                <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{isEditMode ? "Save Changes" : "Create Course"}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the course "{courseToDelete?.title}" and all associated data, including its quiz, questions, and any user progress.
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

    