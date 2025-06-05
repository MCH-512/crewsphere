
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { CheckCircle, BookOpen, PlayCircle, Award, XCircle, HelpCircle, ChevronRight, FileText as FileTextIcon, AlertTriangle, Loader2 } from "lucide-react";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, doc, getDoc, setDoc, updateDoc, Timestamp, orderBy } from "firebase/firestore";

interface CourseData {
  id: string; // Firestore document ID
  title: string;
  description: string;
  category: string;
  imageHint: string;
  quizId: string;
  quizTitle: string;
  mandatory: boolean;
  // courseIcon can be mapped from category or be a default
}

interface UserProgressData {
  userId: string;
  courseId: string;
  contentStatus: 'NotStarted' | 'InProgress' | 'Completed';
  quizStatus: 'NotTaken' | 'Attempted' | 'Passed' | 'Failed';
  quizScore?: number;
  certificateDetails?: {
    provider: string;
    certificateId: string;
    issuedDate: string; // ISO String
    expiryDate?: string; // ISO String
  };
  lastUpdated: Timestamp;
}

interface CombinedCourse extends CourseData {
  progress?: UserProgressData; // User's progress for this course
}

export default function TrainingPage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  
  const [courses, setCourses] = React.useState<CombinedCourse[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = React.useState(true);
  const [loadingError, setLoadingError] = React.useState<string | null>(null);

  const [selectedCourseForQuiz, setSelectedCourseForQuiz] = React.useState<CombinedCourse | null>(null);
  const [selectedCourseForCert, setSelectedCourseForCert] = React.useState<CombinedCourse | null>(null);
  const [isQuizDialogOpen, setIsQuizDialogOpen] = React.useState(false);
  const [isCertDialogOpen, setIsCertDialogOpen] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);

  const fetchTrainingData = React.useCallback(async () => {
    if (!user) {
      setIsLoadingCourses(false);
      return;
    }
    setIsLoadingCourses(true);
    setLoadingError(null);
    try {
      const coursesQuery = query(collection(db, "courses"), orderBy("title"));
      const coursesSnapshot = await getDocs(coursesQuery);
      const fetchedCoursesData = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CourseData));

      const combinedCoursesWithProgress: CombinedCourse[] = [];

      for (const courseData of fetchedCoursesData) {
        const progressDocId = `${user.uid}_${courseData.id}`;
        const progressDocRef = doc(db, "userTrainingProgress", progressDocId);
        const progressDocSnap = await getDoc(progressDocRef);

        let userProgress: UserProgressData | undefined = undefined;
        if (progressDocSnap.exists()) {
          userProgress = progressDocSnap.data() as UserProgressData;
        } else {
          // Default progress if none exists (will be created on first action)
           userProgress = {
            userId: user.uid,
            courseId: courseData.id,
            contentStatus: 'NotStarted',
            quizStatus: 'NotTaken',
            lastUpdated: Timestamp.now() // Placeholder, will be updated
          };
        }
        combinedCoursesWithProgress.push({ ...courseData, progress: userProgress });
      }
      setCourses(combinedCoursesWithProgress);
    } catch (err) {
      console.error("Error fetching training data:", err);
      setLoadingError("Failed to load training data. Please try again.");
      toast({ title: "Loading Error", description: "Could not fetch training data.", variant: "destructive" });
    } finally {
      setIsLoadingCourses(false);
    }
  }, [user, toast]);

  React.useEffect(() => {
    if (!authLoading && user) {
      fetchTrainingData();
    } else if (!authLoading && !user) {
      setIsLoadingCourses(false); // Not logged in, no data to fetch
    }
  }, [authLoading, user, fetchTrainingData]);


  const handleCourseAction = async (courseId: string) => {
    if (!user) return;
    const course = courses.find(c => c.id === courseId);
    if (!course) return;

    setIsUpdating(true);
    const progressDocId = `${user.uid}_${course.id}`;
    const progressDocRef = doc(db, "userTrainingProgress", progressDocId);

    try {
      if (course.progress?.contentStatus !== 'Completed') {
        const newProgressData: Partial<UserProgressData> = {
          userId: user.uid,
          courseId: course.id,
          contentStatus: 'Completed',
          lastUpdated: Timestamp.now(),
        };
        // If progress doc doesn't exist or contentStatus is not set, initialize other fields
        if(!course.progress || !course.progress.quizStatus){
            newProgressData.quizStatus = 'NotTaken';
        }

        await setDoc(progressDocRef, newProgressData, { merge: true });
        toast({ title: "Course Content Viewed", description: `You have completed the material for "${course.title}". You can now take the quiz.` });
        fetchTrainingData(); // Refresh data
      } else {
        setSelectedCourseForQuiz(course);
        setIsQuizDialogOpen(true);
      }
    } catch (error) {
      console.error("Error updating course progress:", error);
      toast({ title: "Update Error", description: "Could not update course progress.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const simulateQuiz = async (courseId: string, passed: boolean) => {
    if (!user) return;
    const course = courses.find(c => c.id === courseId);
    if (!course) return;
    
    setIsUpdating(true);
    const progressDocId = `${user.uid}_${course.id}`;
    const progressDocRef = doc(db, "userTrainingProgress", progressDocId);
    const score = passed ? Math.floor(Math.random() * 21) + 80 : Math.floor(Math.random() * 40) + 40;

    const newProgressData: Partial<UserProgressData> = {
      userId: user.uid,
      courseId: course.id,
      quizStatus: passed ? 'Passed' : 'Failed',
      quizScore: score,
      lastUpdated: Timestamp.now(),
    };

    if (passed) {
      const issuedDate = new Date().toISOString();
      const expiryYears = course.title.toLowerCase().includes("recurrent") || course.title.toLowerCase().includes("refresher") ? 1 : 2;
      const expiryDate = new Date(new Date().setFullYear(new Date().getFullYear() + expiryYears)).toISOString();
      
      newProgressData.certificateDetails = {
        provider: "In-House Certification Body",
        certificateId: `CERT-${course.id}-${new Date().getFullYear()}`,
        issuedDate: issuedDate,
        expiryDate: expiryDate,
      };
    }

    try {
      await setDoc(progressDocRef, newProgressData, { merge: true });
      toast({
        title: `Quiz ${passed ? 'Passed' : 'Failed'}`,
        description: `You scored ${score}% on "${course.quizTitle}". ${passed ? 'Congratulations! Your certificate is now available.' : 'Please review the material and try again.'}`,
        variant: passed ? "default" : "destructive",
      });
      fetchTrainingData(); // Refresh data
    } catch (error) {
      console.error("Error updating quiz results:", error);
      toast({ title: "Quiz Update Error", description: "Could not save quiz results.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
      setIsQuizDialogOpen(false);
      setSelectedCourseForQuiz(null);
    }
  };

  const openCertificateDialog = (course: CombinedCourse) => {
    setSelectedCourseForCert(course);
    setIsCertDialogOpen(true);
  };
  
  if (authLoading || isLoadingCourses) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading training data...</p>
      </div>
    );
  }

  if (!user && !authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <CardTitle className="text-xl mb-2">Access Denied</CardTitle>
        <p className="text-muted-foreground">Please log in to access your training.</p>
        <Button onClick={() => window.location.href='/login'} className="mt-4">Go to Login</Button>
      </div>
    );
  }
  
  if (loadingError) {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <CardTitle className="text-xl mb-2">Error Loading Training</CardTitle>
        <p className="text-muted-foreground mb-4">{loadingError}</p>
        <Button onClick={fetchTrainingData} disabled={isUpdating}>
            {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Try Again
        </Button>
      </div>
    );
  }

  const availableCourses = courses.filter(c => c.progress?.quizStatus !== 'Passed');
  const completedWithCerts = courses.filter(c => c.progress?.quizStatus === 'Passed' && c.progress?.certificateDetails);


  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">My Training Hub</CardTitle>
          <CardDescription>Complete courses, pass quizzes, and earn certificates to enhance your skills. Mandatory trainings are marked.</CardDescription>
        </CardHeader>
        <CardContent>
           <p className="text-muted-foreground">Track your progress and stay up-to-date with your certifications.</p>
        </CardContent>
      </Card>

      <section>
        <h2 className="text-xl font-semibold mb-4 font-headline flex items-center">
          <BookOpen className="mr-2 h-6 w-6 text-primary" />
          Available & In-Progress Training
        </h2>
        {availableCourses.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {availableCourses.map((course) => {
              const contentStatus = course.progress?.contentStatus || 'NotStarted';
              const quizStatus = course.progress?.quizStatus || 'NotTaken';
              const quizScore = course.progress?.quizScore;

              const CourseActionIcon = contentStatus !== 'Completed' ? ChevronRight : 
                                       quizStatus === 'NotTaken' ? HelpCircle : 
                                       quizStatus === 'Failed' ? XCircle : PlayCircle;
              return (
              <Card key={course.id} className="shadow-md hover:shadow-lg transition-shadow flex flex-col">
                <CardHeader className="flex-shrink-0">
                  <div className="flex items-start gap-3 mb-2">
                    <Image src={`https://placehold.co/80x80.png`} alt={course.title} width={60} height={60} className="rounded-lg" data-ai-hint={course.imageHint || "training"} />
                    <div>
                      <CardTitle className="text-lg">{course.title}</CardTitle>
                      <Badge variant="outline" className="mt-1">{course.category}</Badge>
                      {course.mandatory && (
                        <Badge variant="destructive" className="mt-1 ml-2">Mandatory</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-3 h-16 overflow-hidden">
                      {course.description}
                    </p>
                    <div className="text-xs text-muted-foreground mb-1">
                        Content: <Badge variant={contentStatus === 'Completed' ? 'default' : 'secondary'} className={contentStatus === 'Completed' ? 'bg-green-500/20 text-green-700 border-green-500/30' : '' }>{contentStatus}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mb-3">
                        Quiz: <Badge variant={quizStatus === 'Failed' ? 'destructive' : (quizStatus === 'Passed' ? 'default' : 'secondary')} >{quizStatus} {quizScore !== undefined && `(${quizScore}%)`}</Badge>
                    </div>
                  </div>
                  <Button onClick={() => handleCourseAction(course.id)} className="w-full mt-2" disabled={isUpdating}>
                    {isUpdating && courses.find(c => c.id === course.id) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CourseActionIcon className="mr-2 h-4 w-4" />}
                    {contentStatus !== 'Completed' ? (contentStatus === 'NotStarted' ? 'Start Course' : 'Continue Course') :
                     quizStatus === 'Failed' ? 'Retake Quiz' : (quizStatus === 'NotTaken' ? 'Take Quiz' : 'Review Quiz')}
                  </Button>
                </CardContent>
              </Card>
            )})}
          </div>
        ) : (
          <Card className="text-muted-foreground p-6 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
            <p className="font-semibold">All available trainings are completed or certified!</p>
            <p className="text-sm">Check the "Completed Trainings & Certificates" section below or look out for new assignments.</p>
          </Card>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4 font-headline flex items-center">
          <Award className="mr-2 h-6 w-6 text-green-500" />
          Completed Trainings & Certificates
        </h2>
        {completedWithCerts.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {completedWithCerts.map((course) => (
              <Card key={course.id} className="shadow-md hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start gap-3 mb-2">
                    <Image src={`https://placehold.co/80x80.png`} alt={course.title} width={60} height={60} className="rounded-lg" data-ai-hint={course.imageHint || "certificate"} />
                    <div>
                      <CardTitle className="text-lg">{course.title}</CardTitle>
                       <Badge variant="default" className="mt-1 bg-green-100 text-green-700 border-green-300">Passed ({course.progress?.quizScore}%)</Badge>
                        {course.mandatory && (
                          <Badge variant="destructive" className="mt-1 ml-2">Mandatory</Badge>
                        )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Certified on: {course.progress?.certificateDetails?.issuedDate ? new Date(course.progress.certificateDetails.issuedDate).toLocaleDateString() : 'N/A'}
                  </p>
                  <p className="text-sm text-muted-foreground">Provider: {course.progress?.certificateDetails?.provider}</p>
                  {course.progress?.certificateDetails?.expiryDate && <p className="text-sm text-muted-foreground">Expires: {new Date(course.progress.certificateDetails.expiryDate).toLocaleDateString()}</p>}
                  <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => openCertificateDialog(course)} disabled={isUpdating}>
                    <FileTextIcon className="mr-2 h-4 w-4"/> View Certificate
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
           <Card className="text-muted-foreground p-6 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-primary mb-4" />
            <p className="font-semibold">No trainings completed and certified yet.</p>
            <p className="text-sm">Finish a course from the section above and pass the quiz to earn a certificate!</p>
          </Card>
        )}
      </section>

      {/* Quiz Simulation Dialog */}
      <Dialog open={isQuizDialogOpen} onOpenChange={setIsQuizDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Take Quiz: {selectedCourseForQuiz?.quizTitle}</DialogTitle>
            <DialogDescription>
              This is a simulation. In a real system, you would answer quiz questions here.
              For now, choose to simulate passing or failing. A passing score is 80% or more.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">Course: {selectedCourseForQuiz?.title}</p>
            {selectedCourseForQuiz?.mandatory && <p className="text-sm font-semibold text-destructive flex items-center gap-1"><AlertTriangle className="h-4 w-4"/> This is a mandatory training quiz.</p>}
            <p className="text-sm">Click a button below to simulate your quiz result.</p>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
             <Button variant="outline" onClick={() => selectedCourseForQuiz && simulateQuiz(selectedCourseForQuiz.id, false)} disabled={isUpdating}>
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
              <XCircle className="mr-2 h-4 w-4"/> Simulate Fail
            </Button>
            <Button onClick={() => selectedCourseForQuiz && simulateQuiz(selectedCourseForQuiz.id, true)} disabled={isUpdating}>
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
              <CheckCircle className="mr-2 h-4 w-4"/> Simulate Pass
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Certificate Viewing Dialog */}
      <Dialog open={isCertDialogOpen} onOpenChange={setIsCertDialogOpen}>
          <DialogContent className="sm:max-w-[650px]">
            <DialogHeader>
              <DialogTitle>Certificate of Completion</DialogTitle>
              <DialogDescription>
                This certificate is awarded for the successful completion of the {selectedCourseForCert?.title} program.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="mx-auto my-4">
                <Image src="https://placehold.co/500x350.png" alt="Certificate Preview" width={500} height={350} className="rounded-md border" data-ai-hint="official certificate document" />
              </div>
              <div className="space-y-1 text-sm">
                <p><strong>Issued to:</strong> {user?.displayName || user?.email || "Demo User"}</p>
                <p><strong>Training Program:</strong> {selectedCourseForCert?.title}</p>
                <p><strong>Certificate ID:</strong> {selectedCourseForCert?.progress?.certificateDetails?.certificateId}</p>
                <p><strong>Date Issued:</strong> {selectedCourseForCert?.progress?.certificateDetails?.issuedDate ? new Date(selectedCourseForCert.progress.certificateDetails.issuedDate).toLocaleDateString() : 'N/A'}</p>
                <p><strong>Issuing Body:</strong> {selectedCourseForCert?.progress?.certificateDetails?.provider}</p>
                {selectedCourseForCert?.progress?.certificateDetails?.expiryDate && <p><strong>Valid Until:</strong> {new Date(selectedCourseForCert.progress.certificateDetails.expiryDate).toLocaleDateString()}</p>}
                 <p className="font-semibold mt-2">Achieved Score: {selectedCourseForCert?.progress?.quizScore}%</p>
                 {selectedCourseForCert?.mandatory && <p className="font-semibold text-destructive mt-1">This was a mandatory training.</p>}
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">Close</Button>
              </DialogClose>
              <Button type="button" onClick={() => {toast({title: "Feature Not Implemented", description: "PDF download is not available in this demo."});} }>Download PDF</Button>
            </DialogFooter>
          </DialogContent>
      </Dialog>

      <div className="text-center mt-8">
        <Button variant="link" onClick={() => {toast({title: "Feature Not Implemented", description: "Full course catalog browsing is not available in this demo."});}}>Browse Full Course Catalog (Conceptual)</Button>
      </div>
    </div>
  );
}

    
