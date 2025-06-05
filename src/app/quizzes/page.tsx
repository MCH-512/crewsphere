
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListChecks, PlayCircle, CheckCircle, Zap, AlertTriangle, Loader2, BookOpen } from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, Timestamp, orderBy, doc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

interface CourseForQuiz {
  id: string; // Firestore document ID from courses collection
  title: string; // Course title (used as quiz context)
  description: string; // Course description (can be adapted for quiz)
  category: string; // Course category
  imageHint: string;
  quizId: string;
  quizTitle: string;
  mandatory: boolean;
}

interface UserProgressForQuiz {
  contentStatus: 'NotStarted' | 'InProgress' | 'Completed';
  quizStatus: 'NotTaken' | 'Attempted' | 'Passed' | 'Failed';
  quizScore?: number;
}

interface CombinedQuizItem extends CourseForQuiz {
  userProgress?: UserProgressForQuiz;
  statusLabel: string;
  actionLabel: string;
  ActionIcon: React.ElementType;
  actionDisabled: boolean;
  actionLink?: string;
}

export default function QuizzesPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [quizzes, setQuizzes] = React.useState<CombinedQuizItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchQuizzesAndProgress = React.useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      setError("Please log in to view quizzes.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const coursesQuery = query(collection(db, "courses"), orderBy("title"));
      const coursesSnapshot = await getDocs(coursesQuery);
      const fetchedCourses = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CourseForQuiz));

      const combinedQuizItems: CombinedQuizItem[] = [];

      for (const course of fetchedCourses) {
        const progressDocId = `${user.uid}_${course.id}`;
        const progressDocRef = doc(db, "userTrainingProgress", progressDocId);
        const progressSnap = await getDoc(progressDocRef);

        let userProgress: UserProgressForQuiz = {
            contentStatus: 'NotStarted',
            quizStatus: 'NotTaken',
        };
        if (progressSnap.exists()) {
          const data = progressSnap.data();
          userProgress = {
            contentStatus: data.contentStatus || 'NotStarted',
            quizStatus: data.quizStatus || 'NotTaken',
            quizScore: data.quizScore,
          };
        }

        let statusLabel = "Not Started";
        let actionLabel = "Start Quiz";
        let ActionIcon: React.ElementType = PlayCircle;
        let actionDisabled = false;
        let actionLink: string | undefined = undefined;


        if (userProgress.contentStatus !== 'Completed') {
            statusLabel = userProgress.contentStatus === 'NotStarted' ? "Course Not Started" : "Course In Progress";
            actionLabel = "Complete Course First";
            ActionIcon = BookOpen;
            actionLink = "/training"; // Link to general training page
            actionDisabled = false; // Make it a link, not a disabled button
        } else { // Content is Completed
            if (userProgress.quizStatus === 'Passed') {
                statusLabel = `Passed (Score: ${userProgress.quizScore}%)`;
                actionLabel = "Review Quiz"; // Or "View Certificate"
                ActionIcon = CheckCircle;
            } else if (userProgress.quizStatus === 'Failed') {
                statusLabel = `Failed (Score: ${userProgress.quizScore}%)`;
                actionLabel = "Retake Quiz";
                ActionIcon = PlayCircle;
            } else { // NotTaken or Attempted
                statusLabel = "Ready for Quiz";
                actionLabel = "Start Quiz";
                ActionIcon = Zap;
            }
        }
        
        combinedQuizItems.push({
          ...course,
          userProgress,
          statusLabel,
          actionLabel,
          ActionIcon,
          actionDisabled,
          actionLink,
        });
      }
      setQuizzes(combinedQuizItems);
    } catch (err) {
      console.error("Error fetching quizzes:", err);
      setError("Failed to load quizzes. Please try again later.");
      toast({ title: "Loading Error", description: "Could not fetch quizzes.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  React.useEffect(() => {
    if (!authLoading) {
      fetchQuizzesAndProgress();
    }
  }, [user, authLoading, fetchQuizzesAndProgress]);

  const handleQuizAction = (quizTitle: string, link?: string) => {
    if (link) {
        // Using window.location.href for simplicity, Next.js router.push can also be used
        window.location.href = link;
        return;
    }
    toast({
      title: `Quiz Action: ${quizTitle}`,
      description: "Full quiz-taking or review functionality is coming soon!",
    });
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading quizzes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <CardTitle className="text-xl mb-2">Error Loading Quizzes</CardTitle>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={fetchQuizzesAndProgress} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Try Again
        </Button>
      </div>
    );
  }
  
  if (!user && !authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <CardTitle className="text-xl mb-2">Access Denied</CardTitle>
        <p className="text-muted-foreground">Please log in to access quizzes.</p>
        <Button onClick={() => window.location.href='/login'} className="mt-4">Go to Login</Button>
      </div>
    );
  }


  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-start gap-4">
          <ListChecks className="h-8 w-8 text-primary mt-1" />
          <div>
            <CardTitle className="text-2xl font-headline">Quizzes</CardTitle>
            <CardDescription>
              Test your knowledge and stay sharp with our interactive quizzes. Select a quiz below to get started.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Regularly completing quizzes helps reinforce critical knowledge and procedures.
          </p>
        </CardContent>
      </Card>

      {quizzes.length === 0 && !isLoading && (
         <Card className="text-muted-foreground p-6 text-center shadow-md">
            <ListChecks className="mx-auto h-12 w-12 text-primary mb-4" />
            <p className="font-semibold">No quizzes available at the moment.</p>
            <p className="text-sm">Please check back later, or ensure courses are added and content is completed via the Training Hub.</p>
          </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {quizzes.map((quiz) => {
          const Icon = quiz.ActionIcon;
          const buttonContent = (
            <>
                <Icon className="mr-2 h-4 w-4" />
                {quiz.actionLabel}
            </>
          );
          return (
            <Card key={quiz.id} className="shadow-md hover:shadow-lg transition-shadow flex flex-col">
              <CardHeader className="flex-shrink-0">
                <div className="flex items-start gap-4">
                    <Image
                        src={`https://placehold.co/100x100.png`}
                        alt={quiz.quizTitle}
                        width={70}
                        height={70}
                        className="rounded-lg"
                        data-ai-hint={quiz.imageHint || "quiz icon"}
                    />
                    <div>
                        <CardTitle className="text-lg mb-1">{quiz.quizTitle}</CardTitle>
                        <Badge variant="outline">{quiz.category}</Badge>
                         {quiz.mandatory && (
                            <Badge variant="destructive" className="mt-1 ml-1 text-xs">Mandatory</Badge>
                        )}
                    </div>
                </div>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col justify-between">
                <div>
                    <p className="text-sm text-muted-foreground mb-3 h-16 overflow-hidden" title={quiz.description}>
                      {quiz.description}
                    </p>
                    <div className="text-xs text-muted-foreground mb-3">
                        <span>~10-20 Questions (Placeholder)</span> |
                        <span className="ml-1 font-semibold">
                           Status: {quiz.statusLabel}
                        </span>
                    </div>
                </div>
                {quiz.actionLink ? (
                     <Button asChild className="w-full mt-2" disabled={quiz.actionDisabled}>
                        <Link href={quiz.actionLink}>
                           {buttonContent}
                        </Link>
                    </Button>
                ) : (
                    <Button className="w-full mt-2" onClick={() => handleQuizAction(quiz.quizTitle)} disabled={quiz.actionDisabled}>
                     {buttonContent}
                    </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
       <Card className="shadow-md mt-8">
        <CardHeader>
            <CardTitle className="text-lg font-headline">Why Quizzes?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Interactive quizzes are an effective way to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Reinforce learning of critical procedures and information.</li>
              <li>Identify areas where you might need further review.</li>
              <li>Stay current with evolving standards and regulations.</li>
              <li>Prepare for formal assessments and evaluations.</li>
            </ul>
            <p className="font-semibold">Complete course content via the Training Hub to unlock quizzes. New quizzes are added regularly!</p>
        </CardContent>
      </Card>
    </div>
  );
}
    
