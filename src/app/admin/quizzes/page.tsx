
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, doc, getDoc } from "firebase/firestore"; // Added doc, getDoc
import { useRouter } from "next/navigation";
import { CheckSquare, Loader2, AlertTriangle, RefreshCw, Edit3, PlusCircle, BookOpen } from "lucide-react"; // Added PlusCircle, BookOpen
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

interface Quiz {
  id: string; // Quiz document ID
  title: string;
  courseId: string;
  randomizeQuestions?: boolean;
  randomizeAnswers?: boolean;
  // Fields to fetch from linked course
  courseTitle?: string;
  courseCategory?: string;
}

interface CourseInfo {
  title: string;
  category: string;
}

export default function AdminQuizzesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [quizzes, setQuizzes] = React.useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchQuizzes = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const q = query(collection(db, "quizzes"), orderBy("title", "asc"));
      const querySnapshot = await getDocs(q);
      
      const fetchedQuizzesPromises = querySnapshot.docs.map(async (docSnapshot) => {
        const quizData = docSnapshot.data() as Omit<Quiz, 'id' | 'courseTitle' | 'courseCategory'>;
        const quiz: Quiz = {
          id: docSnapshot.id,
          ...quizData,
        };

        // Fetch linked course title and category
        if (quizData.courseId) {
          const courseDocRef = doc(db, "courses", quizData.courseId);
          const courseDocSnap = await getDoc(courseDocRef);
          if (courseDocSnap.exists()) {
            const courseInfo = courseDocSnap.data() as CourseInfo;
            quiz.courseTitle = courseInfo.title;
            quiz.courseCategory = courseInfo.category;
          } else {
            quiz.courseTitle = "Course not found";
          }
        }
        return quiz;
      });

      const fetchedQuizzes = await Promise.all(fetchedQuizzesPromises);
      setQuizzes(fetchedQuizzes);

    } catch (err) {
      console.error("Error fetching quizzes:", err);
      setError("Failed to load quizzes. Please try again.");
      toast({ title: "Loading Error", description: "Could not fetch quiz list.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'admin') {
        router.push('/'); 
      } else {
        fetchQuizzes();
      }
    }
  }, [user, authLoading, router, fetchQuizzes]);

  if (authLoading || (isLoading && quizzes.length === 0 && !user)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading quizzes...</p>
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
              <CheckSquare className="mr-3 h-7 w-7 text-primary" />
              Quizzes Management
            </CardTitle>
            <CardDescription>View all quizzes defined in the system. Manage questions and settings from the course creation/editing page.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchQuizzes} disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
             <Button asChild>
                <Link href="/admin/courses/create">
                  <PlusCircle className="mr-2 h-4 w-4" /> Create New Quiz (via Course)
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
          {isLoading && quizzes.length === 0 && (
             <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Loading quiz list...</p>
            </div>
          )}
          {!isLoading && quizzes.length === 0 && !error && (
            <p className="text-muted-foreground text-center py-8">No quizzes found. Quizzes are created as part of a course.</p>
          )}
          {quizzes.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quiz Title</TableHead>
                    <TableHead>Associated Course</TableHead>
                    <TableHead>Course Category</TableHead>
                    <TableHead>Randomize Questions</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quizzes.map((quiz) => (
                    <TableRow key={quiz.id}>
                      <TableCell className="font-medium">{quiz.title}</TableCell>
                      <TableCell>
                        <Link href={`/admin/courses/edit/${quiz.courseId}`} className="hover:underline text-primary flex items-center gap-1">
                            <BookOpen className="h-4 w-4"/>{quiz.courseTitle || 'N/A'}
                        </Link>
                      </TableCell>
                      <TableCell><Badge variant="outline">{quiz.courseCategory || 'N/A'}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={quiz.randomizeQuestions ? "default" : "secondary"}>
                          {quiz.randomizeQuestions ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => toast({ title: "Manage Questions", description: "Manage questions via the course edit page."})} 
                          aria-label={`Manage questions for quiz: ${quiz.title}`}
                        >
                          <Edit3 className="mr-1 h-4 w-4" /> Manage Questions
                        </Button>
                        {/* Future: Link to edit quiz directly if becomes separate from course edit */}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
           <CardDescription className="mt-4 text-xs">
            Quizzes are created and their questions are managed within the course creation/editing interface.
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}
