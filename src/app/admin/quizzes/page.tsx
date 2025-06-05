
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { CheckSquare, Loader2, AlertTriangle, RefreshCw, Edit3, CheckCircle, XCircle, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

// This interface is derived from the 'courses' collection structure
// as quizzes are currently defined as part of courses.
interface CourseDerivedQuiz {
  id: string; // Course document ID
  courseTitle: string;
  quizTitle?: string; // This is the specific quiz title from the course
  quizId?: string;    // This is the specific quiz ID from the course
  category?: string;
  mandatory?: boolean;
  // We might add more quiz-specific fields if we create a separate 'quizzes' collection later
}

export default function AdminQuizzesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [quizzes, setQuizzes] = React.useState<CourseDerivedQuiz[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchQuizzes = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Quizzes are defined within courses for now
      const q = query(collection(db, "courses"), orderBy("title", "asc"));
      const querySnapshot = await getDocs(q);
      const fetchedQuizzes = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id, // Using course ID as the unique key for this list item
          courseTitle: data.title,
          quizTitle: data.quizTitle,
          quizId: data.quizId,
          category: data.category,
          mandatory: data.mandatory,
        } as CourseDerivedQuiz;
      });
      setQuizzes(fetchedQuizzes);
    } catch (err) {
      console.error("Error fetching quizzes (from courses):", err);
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
              All Defined Quizzes
            </CardTitle>
            <CardDescription>View all quizzes associated with training courses. Manage questions and settings (future).</CardDescription>
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
            <p className="text-muted-foreground text-center py-8">No quizzes found. Quizzes are defined when creating courses.</p>
          )}
          {quizzes.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course Title (Quiz Context)</TableHead>
                    <TableHead>Quiz Title</TableHead>
                    <TableHead>Quiz ID</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Mandatory</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quizzes.map((quiz) => (
                    <TableRow key={quiz.id}>
                      <TableCell className="font-medium">{quiz.courseTitle}</TableCell>
                      <TableCell>{quiz.quizTitle || 'N/A'}</TableCell>
                      <TableCell><Badge variant="secondary">{quiz.quizId || 'N/A'}</Badge></TableCell>
                      <TableCell><Badge variant="outline">{quiz.category}</Badge></TableCell>
                      <TableCell>
                        {quiz.mandatory ? (
                          <Badge variant="destructive" className="flex items-center w-fit">
                            <CheckCircle className="mr-1 h-3 w-3" /> Yes
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="flex items-center w-fit">
                            <XCircle className="mr-1 h-3 w-3" /> No
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => toast({ title: "Manage Questions", description: "Question management functionality coming soon!"})} 
                          disabled // Enable when question management page is ready
                          aria-label={`Manage questions for quiz: ${quiz.quizTitle || quiz.courseTitle}`}
                        >
                          <Edit3 className="mr-1 h-4 w-4" /> Manage Questions
                        </Button>
                        {/* Future: Edit Quiz Metadata button if quizzes become separate entities */}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
           <CardDescription className="mt-4 text-xs">
            Quizzes are currently defined within each course. "Manage Questions" will allow adding/editing questions for the selected quiz ID.
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}

    