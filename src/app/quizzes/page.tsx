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
  id: string; 
  title: string; 
  description: string; 
  category: string; 
  imageHint: string;
  quizId: string; // ID of the quiz document in 'quizzes' collection
  quizTitle: string; // Title of the quiz itself
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
      // Query courses that have a quizId, indicating they have an associated quiz
      const coursesQuery = query(collection(db, "courses"), where("quizId", "!=", null), orderBy("title"));
      const coursesSnapshot = await getDocs(coursesQuery);
      
      const fetchedCoursesWithQuiz: CourseForQuiz[] = [];
      for (const courseDoc of coursesSnapshot.docs) {
        const courseData = courseDoc.data();
        if (courseData.quizId) { // Ensure quizId exists
            let currentQuizTitle = "Course Quiz"; // Default
            const quizSnap = await getDoc(doc(db, "quizzes", courseData.quizId));
            if(quizSnap.exists()) {
                currentQuizTitle = quizSnap.data()?.title || "Course Quiz";
            }

            fetchedCoursesWithQuiz.push({
                id: courseDoc.id,
                title: courseData.title,
                description: courseData.description,
                category: courseData.category,
                imageHint: courseData.imageHint,
                quizId: courseData.quizId,
                quizTitle: currentQuizTitle,
                mandatory: courseData.mandatory || false,
            } as CourseForQuiz);
        }
      }


      const combinedQuizItems: CombinedQuizItem[] = [];

      for (const course of fetchedCoursesWithQuiz) {
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
            actionDisabled = false; // Button becomes a link to training
        } else { 
            if (userProgress.quizStatus === 'Passed') {
                statusLabel = `Passed (Score: ${userProgress.quizScore}%)`;
                actionLabel = "Review Quiz"; 
                ActionIcon = CheckCircle;
                actionDisabled = true; // Placeholder for review, which isn't implemented
            } else if (userProgress.quizStatus === 'Failed') {
                statusLabel = `Failed (Score: ${userProgress.quizScore}%)`;
                actionLabel = "Retake Quiz";
                ActionIcon = PlayCircle;
                // Link to /training to simulate retake via course action
                actionLink = `/training`;
            } else { // NotTaken or Attempted but not Passed/Failed (e.g. if interrupted)
                statusLabel = "Ready for Quiz";
                actionLabel = "Start Quiz";
                ActionIcon = Zap;
                // Link to /training to simulate start via course action
                actionLink = `/training`; 
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

  const handleQuizAction = (quizItem: CombinedQuizItem) => {
    if (quizItem.actionLink) {
        // If it's a link (e.g., "Complete Course First" or "Retake/Start Quiz" via training page)
        window.location.href = quizItem.actionLink; 
        return;
    }
    // For actions that don't navigate (like "Review Quiz" which is disabled or future actual quiz taking)
    toast({
      title: `Quiz Action: ${quizItem.quizTitle}`,
      description: "This quiz interaction is currently simulated or linked through the Training Hub. Full quiz-taking or review functionality within this page is coming soon!",
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
            Regularly completing quizzes helps reinforce critical knowledge and procedures. Course content must be completed before taking a quiz.
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
        {quizzes.map((quizItem) => {
          const Icon = quizItem.ActionIcon;
          const buttonContent = (
            <>
                <Icon className="mr-2 h-4 w-4" />
                {quizItem.actionLabel}
            </>
          );
          return (
            <Card key={quizItem.id} className="shadow-md hover:shadow-lg transition-shadow flex flex-col">
              <CardHeader className="flex-shrink-0">
                <div className="flex items-start gap-4">
                    <Image
                        src={`https://placehold.co/70x70.png`}
                        alt={quizItem.quizTitle}
                        width={70}
                        height={70}
                        className="rounded-lg"
                        data-ai-hint={quizItem.imageHint || "quiz assessment"}
                    />
                    <div>
                        <CardTitle className="text-lg mb-1">{quizItem.quizTitle}</CardTitle>
                        <Badge variant="outline" className="text-xs">{quizItem.category}</Badge>
                         {quizItem.mandatory && (
                            <Badge variant="destructive" className="mt-1 ml-1 text-xs">Mandatory</Badge>
                        )}
                         <p className="text-xs text-muted-foreground mt-1">Course: {quizItem.title}</p>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col justify-between">
                <div>
                    <p className="text-sm text-muted-foreground mb-3 h-12 overflow-hidden" title={quizItem.description}>
                      {quizItem.description}
                    </p>
                    <div className="text-xs text-muted-foreground mb-3">
                        <span className="font-semibold">
                           Status: {quizItem.statusLabel}
                        </span>
                    </div>
                </div>
                
                <Button className="w-full mt-2" onClick={() => handleQuizAction(quizItem)} disabled={quizItem.actionDisabled}>
                    {buttonContent}
                </Button>
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
