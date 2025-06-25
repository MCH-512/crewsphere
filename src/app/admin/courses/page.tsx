
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp, doc, getDoc, deleteDoc, where, writeBatch } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { BookOpen, Loader2, AlertTriangle, RefreshCw, Edit, Trash2, CheckCircle, XCircle, PlusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { logAuditEvent } from "@/lib/audit-logger";

interface Course {
  id: string;
  title: string;
  category: string;
  courseType?: string;
  description?: string;
  duration?: string;
  quizId?: string;
  certificateRuleId?: string; 
  published?: boolean;
  createdAt?: Timestamp;
  createdBy?: string;
  quizTitle?: string; 
}

interface QuizInfo {
  title: string;
}


export default function AdminCoursesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [courseToDelete, setCourseToDelete] = React.useState<Course | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const fetchCourses = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const q = query(collection(db, "courses"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedCoursesPromises = querySnapshot.docs.map(async (docSnapshot) => {
        const courseData = docSnapshot.data() as Omit<Course, 'id' | 'quizTitle'>;
        const course: Course = {
          id: docSnapshot.id,
          ...courseData,
        };

        if (courseData.quizId) {
          try {
            const quizDocRef = doc(db, "quizzes", courseData.quizId);
            const quizDocSnap = await getDoc(quizDocRef);
            if (quizDocSnap.exists()) {
              course.quizTitle = (quizDocSnap.data() as QuizInfo).title;
            } else {
              course.quizTitle = "Quiz details not found";
            }
          } catch (quizError) {
             console.warn(`Could not fetch quiz for course ${course.id}:`, quizError);
             course.quizTitle = "Error loading quiz";
          }
        }
        return course;
      });
      
      const fetchedCourses = await Promise.all(fetchedCoursesPromises);
      setCourses(fetchedCourses);

    } catch (err) {
      console.error("Error fetching courses:", err);
      setError("Failed to load courses. Please try again.");
      toast({ title: "Loading Error", description: "Could not fetch courses.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'admin') {
        router.push('/'); 
      } else {
        fetchCourses();
      }
    }
  }, [user, authLoading, router, fetchCourses]);

  const handleDeleteCourse = async () => {
    if (!courseToDelete || !user) return;
    setIsDeleting(true);
    const batch = writeBatch(db);

    try {
      const courseRef = doc(db, "courses", courseToDelete.id);
      batch.delete(courseRef);

      if (courseToDelete.quizId) {
        const quizRef = doc(db, "quizzes", courseToDelete.quizId);
        batch.delete(quizRef);

        const questionsQuery = query(collection(db, "questions"), where("quizId", "==", courseToDelete.quizId));
        const questionsSnap = await getDocs(questionsQuery);
        questionsSnap.forEach(qDoc => batch.delete(qDoc.ref));
      }

      if (courseToDelete.certificateRuleId) {
        const certRuleRef = doc(db, "certificateRules", courseToDelete.certificateRuleId);
        batch.delete(certRuleRef);
      }
      
      await batch.commit();

      await logAuditEvent({
        userId: user.uid,
        userEmail: user.email || "N/A",
        actionType: "DELETE_COURSE",
        entityType: "COURSE",
        entityId: courseToDelete.id,
        details: { title: courseToDelete.title, category: courseToDelete.category },
      });

      toast({ title: "Course Deleted", description: `Course "${courseToDelete.title}" and its associated quiz/questions have been deleted.` });
      fetchCourses(); 
    } catch (error) {
      console.error("Error deleting course and associated data:", error);
      toast({ title: "Deletion Failed", description: "Could not delete the course. Please try again.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setCourseToDelete(null);
    }
  };


  if (authLoading || (isLoading && courses.length === 0 && !user)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading courses...</p>
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
        <CardHeader className="flex flex-row justify-between items-start">
          <div>
            <CardTitle className="text-2xl font-headline flex items-center">
              <BookOpen className="mr-3 h-7 w-7 text-primary" />
              Courses Management
            </CardTitle>
            <CardDescription>View and manage all training courses in the system. New courses include quiz and certificate setup.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchCourses} disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button asChild>
              <Link href="/admin/courses/create">
                <PlusCircle className="mr-2 h-4 w-4" /> Create New Course
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="p-4 mb-4 text-sm text-destructive-foreground bg-destructive rounded-md flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> {error}
            </div>
          )}
          {isLoading && courses.length === 0 && (
             <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Loading course list...</p>
            </div>
          )}
          {!isLoading && courses.length === 0 && !error && (
            <p className="text-muted-foreground text-center py-8">No courses found. Use the &quot;Create New Course&quot; button to add one.</p>
          )}
          {courses.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Quiz Title</TableHead>
                    <TableHead>Published</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courses.map((course) => (
                    <TableRow key={course.id}>
                      <TableCell className="font-medium max-w-xs truncate" title={course.title}>{course.title}</TableCell>
                      <TableCell><Badge variant="outline">{course.category}</Badge></TableCell>
                      <TableCell><Badge variant="secondary">{course.courseType || "N/A"}</Badge></TableCell>
                      <TableCell>{course.quizTitle || 'N/A'}</TableCell>
                      <TableCell>
                        {course.published ? (
                          <Badge variant="success" className="flex items-center w-fit">
                            <CheckCircle className="mr-1 h-3 w-3" /> Yes
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="flex items-center w-fit">
                            <XCircle className="mr-1 h-3 w-3" /> No
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="sm" asChild aria-label={`Edit course: ${course.title}`}>
                          <Link href={`/admin/courses/edit/${course.id}`}>
                            <Edit className="mr-1 h-4 w-4" /> Edit
                          </Link>
                        </Button>
                         <AlertDialog>
                          <AlertDialogTrigger asChild>
                           <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive/80" onClick={() => setCourseToDelete(course)} aria-label={`Delete course: ${course.title}`}>
                            <Trash2 className="mr-1 h-4 w-4" /> Delete
                          </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete the course: "{courseToDelete?.title}"? This will also delete its associated quiz, questions, and certificate rule. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setCourseToDelete(null)} disabled={isDeleting}>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDeleteCourse} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Delete Course
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
    </div>
  );
}
