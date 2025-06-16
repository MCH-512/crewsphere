
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { CheckCircle, BookOpen, PlayCircle, Award, XCircle, HelpCircle, ChevronRight, FileText as FileTextIcon, AlertTriangle, Loader2, Library, List, Download, Link as LinkIcon, Image as ImageIcon, Video } from "lucide-react";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, doc, getDoc, setDoc, updateDoc, Timestamp, orderBy } from "firebase/firestore";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Chapter, Resource } from "@/schemas/course-schema"; // Import Chapter type
import ChapterDisplay from "@/components/features/course-chapter-display"; // Import ChapterDisplay
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import ReactMarkdown from "react-markdown";

// Interface CourseData now uses chapters instead of modules
interface CourseData {
  id: string; 
  title: string;
  description: string;
  category: string;
  imageHint: string;
  quizId: string;
  quizTitle: string; 
  mandatory: boolean;
  chapters?: Chapter[]; // Changed from modules
  duration?: string; 
  fileURL?: string; 
  certificateRuleId?: string; 
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
    issuedDate: string; 
    expiryDate?: string; 
    logoURL?: string;
    signatureTextOrURL?: string;
  };
  lastUpdated: Timestamp;
}

interface CombinedCourse extends CourseData {
  progress?: UserProgressData; 
}

const getResourceIconDialog = (type?: Resource['type']) => {
  switch (type) {
    case "pdf": return <FileTextIcon className="h-4 w-4 mr-2 flex-shrink-0 text-primary" />;
    case "image": return <ImageIcon className="h-4 w-4 mr-2 flex-shrink-0 text-primary" />;
    case "video": return <Video className="h-4 w-4 mr-2 flex-shrink-0 text-primary" />;
    case "link": return <LinkIcon className="h-4 w-4 mr-2 flex-shrink-0 text-primary" />;
    case "file":
    default: return <FileTextIcon className="h-4 w-4 mr-2 flex-shrink-0 text-primary" />;
  }
};


export default function CoursesLibraryPage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  
  const [allCourses, setAllCourses] = React.useState<CombinedCourse[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = React.useState(true);
  const [loadingError, setLoadingError] = React.useState<string | null>(null);

  const [selectedCourseForContent, setSelectedCourseForContent] = React.useState<CombinedCourse | null>(null);
  const [selectedCourseForQuiz, setSelectedCourseForQuiz] = React.useState<CombinedCourse | null>(null);
  const [selectedCourseForCert, setSelectedCourseForCert] = React.useState<CombinedCourse | null>(null);
  const [isContentDialogOpen, setIsContentDialogOpen] = React.useState(false);
  const [isQuizDialogOpen, setIsQuizDialogOpen] = React.useState(false);
  const [isCertDialogOpen, setIsCertDialogOpen] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);

  const fetchAllCoursesAndProgress = React.useCallback(async () => {
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
           userProgress = {
            userId: user.uid,
            courseId: courseData.id,
            contentStatus: 'NotStarted',
            quizStatus: 'NotTaken',
            lastUpdated: Timestamp.now() 
          };
        }
        
        let currentQuizTitle = courseData.quizTitle;
        if (!currentQuizTitle && courseData.quizId) {
            const quizDocRef = doc(db, "quizzes", courseData.quizId);
            const quizSnap = await getDoc(quizDocRef);
            if (quizSnap.exists()) {
                currentQuizTitle = quizSnap.data()?.title || "Course Quiz";
            } else {
                currentQuizTitle = "Course Quiz";
            }
        } else if (!currentQuizTitle) {
            currentQuizTitle = "Course Quiz"; 
        }

        combinedCoursesWithProgress.push({ ...courseData, quizTitle: currentQuizTitle, progress: userProgress });
      }
      setAllCourses(combinedCoursesWithProgress);
    } catch (err) {
      console.error("Error fetching courses data:", err);
      setLoadingError("Failed to load courses. Please try again.");
      toast({ title: "Loading Error", description: "Could not fetch courses.", variant: "destructive" });
    } finally {
      setIsLoadingCourses(false);
    }
  }, [user, toast]);

  React.useEffect(() => {
    if (!authLoading && user) {
      fetchAllCoursesAndProgress();
    } else if (!authLoading && !user) {
      setIsLoadingCourses(false); 
    }
  }, [authLoading, user, fetchAllCoursesAndProgress]);

  const handleCourseAction = async (courseId: string) => {
    if (!user) return;
    const course = allCourses.find(c => c.id === courseId);
    if (!course) return;

    if (course.progress?.quizStatus === 'Passed' && course.progress?.certificateDetails) {
        setSelectedCourseForCert(course); 
        setIsCertDialogOpen(true);
    } else if (course.progress?.contentStatus !== 'Completed') {
        setSelectedCourseForContent(course);
        setIsContentDialogOpen(true);
    } else {
      setSelectedCourseForQuiz(course);
      setIsQuizDialogOpen(true);
    }
  };

  const markContentCompleted = async () => {
    if(!user || !selectedCourseForContent) return;
    
    setIsUpdating(true);
    const progressDocId = `${user.uid}_${selectedCourseForContent.id}`;
    const progressDocRef = doc(db, "userTrainingProgress", progressDocId);

    try {
        const newProgressData: Partial<UserProgressData> = {
            userId: user.uid,
            courseId: selectedCourseForContent.id,
            contentStatus: 'Completed',
            lastUpdated: Timestamp.now(),
        };
        if(!selectedCourseForContent.progress || !selectedCourseForContent.progress.quizStatus){
            newProgressData.quizStatus = 'NotTaken';
        }
        await setDoc(progressDocRef, newProgressData, { merge: true });
        toast({ title: "Course Content Viewed", description: `You have completed the material for "${selectedCourseForContent.title}". You can now take the quiz.` });
        fetchAllCoursesAndProgress(); 
        setIsContentDialogOpen(false);
        setSelectedCourseForContent(null);
    } catch (error) {
      console.error("Error updating course progress:", error);
      toast({ title: "Update Error", description: "Could not update course progress.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  }

  const simulateQuiz = async (courseId: string, passed: boolean) => {
    if (!user) return;
    const course = allCourses.find(c => c.id === courseId);
    if (!course) return;
    
    setIsUpdating(true);
    const progressDocId = `${user.uid}_${course.id}`;
    const progressDocRef = doc(db, "userTrainingProgress", progressDocId);
    const score = passed ? Math.floor(Math.random() * 21) + 80 : Math.floor(Math.random() * 40) + 40; 

    let expiryDurationDays = 365; 
    let logoURL = "https://placehold.co/150x50.png";
    let signatureTextOrURL = "Express Airline Training Department";
    let provider = "AirCrew Hub Training Dept.";

    if (course.certificateRuleId) {
        try {
            const ruleSnap = await getDoc(doc(db, "certificateRules", course.certificateRuleId));
            if (ruleSnap.exists()) {
                 const ruleData = ruleSnap.data();
                 expiryDurationDays = ruleData.expiryDurationDays === 0 ? 0 : (ruleData.expiryDurationDays || 365);
                 logoURL = ruleData.logoURL || logoURL;
                 signatureTextOrURL = ruleData.signatureTextOrURL || signatureTextOrURL;
                 provider = ruleData.provider || provider;
            }
        } catch (e) { console.error("Could not fetch cert rule, using default values", e); }
    }

    const newProgressData: Partial<UserProgressData> = {
      userId: user.uid,
      courseId: course.id,
      quizStatus: passed ? 'Passed' : 'Failed',
      quizScore: score,
      lastUpdated: Timestamp.now(),
    };

    if (passed) {
      const issuedDate = new Date().toISOString();
      let expiryDate: string | undefined = undefined;
      if (expiryDurationDays > 0) {
        expiryDate = new Date(new Date().setDate(new Date().getDate() + expiryDurationDays)).toISOString();
      }
      newProgressData.certificateDetails = {
        provider: provider,
        certificateId: `ACH-CERT-${course.id.substring(0,5)}-${new Date().getFullYear()}`,
        issuedDate: issuedDate,
        expiryDate: expiryDate, 
        logoURL: logoURL,
        signatureTextOrURL: signatureTextOrURL,
      };
    }

    try {
      await setDoc(progressDocRef, newProgressData, { merge: true });
      toast({
        title: `Quiz ${passed ? 'Passed' : 'Failed'}`,
        description: `You scored ${score}% on "${course.quizTitle}". ${passed ? 'Congratulations! Your certificate is now available on the "My Certificates" page.' : 'Please review the material and try again.'}`,
        variant: passed ? "default" : "destructive",
      });
      fetchAllCoursesAndProgress(); 
    } catch (error) {
      console.error("Error updating quiz results:", error);
      toast({ title: "Quiz Update Error", description: "Could not save quiz results.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
      setIsQuizDialogOpen(false);
      setSelectedCourseForQuiz(null);
    }
  };
  
  if (authLoading || isLoadingCourses) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading course library...</p>
      </div>
    );
  }

  if (!user && !authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <CardTitle className="text-xl mb-2">Access Denied</CardTitle>
        <p className="text-muted-foreground">Please log in to access the course library.</p>
        <Button onClick={() => window.location.href='/login'} className="mt-4">Go to Login</Button>
      </div>
    );
  }
  
  if (loadingError) {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <CardTitle className="text-xl mb-2">Error Loading Courses</CardTitle>
        <p className="text-muted-foreground mb-4">{loadingError}</p>
        <Button onClick={fetchAllCoursesAndProgress} disabled={isUpdating}>
            {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Library className="mr-3 h-7 w-7 text-primary" />
            Course Library
          </CardTitle>
          <CardDescription>Browse all available training courses. Start a new course or continue your progress.</CardDescription>
        </CardHeader>
        <CardContent>
           <p className="text-muted-foreground">Expand your knowledge and skills with our comprehensive course catalog.</p>
        </CardContent>
      </Card>

      <section>
        {allCourses.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {allCourses.map((course) => {
              const contentStatus = course.progress?.contentStatus || 'NotStarted';
              const quizStatus = course.progress?.quizStatus || 'NotTaken';
              const quizScore = course.progress?.quizScore;

              let actionLabel = "View Course";
              let ActionIcon = BookOpen;
              if (quizStatus === 'Passed') {
                actionLabel = "View Certificate";
                ActionIcon = Award;
              } else if (contentStatus !== 'Completed') {
                actionLabel = contentStatus === 'NotStarted' ? 'Start Course' : 'Continue Course';
                ActionIcon = ChevronRight;
              } else {
                actionLabel = quizStatus === 'Failed' ? 'Retake Quiz' : 'Take Quiz';
                ActionIcon = quizStatus === 'Failed' ? XCircle : PlayCircle;
              }

              return (
              <Card key={course.id} className="shadow-md hover:shadow-lg transition-shadow flex flex-col">
                <CardHeader className="flex-shrink-0">
                  <div className="flex items-start gap-3 mb-2">
                    <Image src={`https://placehold.co/60x60.png`} alt={course.title} width={60} height={60} className="rounded-lg" data-ai-hint={course.imageHint || "training"} />
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
                    <p className="text-sm text-muted-foreground mb-1 line-clamp-4" title={course.description}>
                      {course.description}
                    </p>
                    {course.duration && <p className="text-xs text-muted-foreground mb-3">Est. Duration: {course.duration}</p>}
                    
                    {(course.chapters && course.chapters.length > 0) && (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-muted-foreground">Chapters: {course.chapters.length}</p>
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground mb-1">
                        Content: <Badge variant={contentStatus === 'Completed' ? 'success' : 'secondary'} >{contentStatus}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mb-3">
                        Quiz: <Badge variant={quizStatus === 'Failed' ? 'destructive' : (quizStatus === 'Passed' ? 'success' : 'secondary')} >{quizStatus} {quizScore !== undefined && `(${quizScore}%)`}</Badge>
                    </div>
                  </div>
                  <Button onClick={() => handleCourseAction(course.id)} className="w-full mt-2" disabled={isUpdating}>
                    {isUpdating && course.id === (selectedCourseForContent?.id || selectedCourseForQuiz?.id || selectedCourseForCert?.id) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ActionIcon className="mr-2 h-4 w-4" />}
                    {actionLabel}
                  </Button>
                </CardContent>
              </Card>
            )})}
          </div>
        ) : (
          <Card className="text-muted-foreground p-6 text-center shadow-md">
            <Library className="mx-auto h-12 w-12 text-primary mb-4" />
            <p className="font-semibold">No courses found in the library.</p>
            <p className="text-sm">Please check back later, or contact an administrator if you believe this is an error.</p>
          </Card>
        )}
      </section>

      {selectedCourseForContent && (
        <Dialog open={isContentDialogOpen} onOpenChange={setIsContentDialogOpen}>
            <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{selectedCourseForContent.title}</DialogTitle>
                    <DialogDescription>
                        Category: {selectedCourseForContent.category} | Duration: {selectedCourseForContent.duration || 'N/A'}
                        {selectedCourseForContent.mandatory && <Badge variant="destructive" className="ml-2">Mandatory</Badge>}
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-grow">
                    <div className="py-4 space-y-4">
                        <p className="text-sm text-muted-foreground mb-4">{selectedCourseForContent.description}</p>
                        
                        {selectedCourseForContent.fileURL && (
                            <Button asChild variant="outline" className="mb-4">
                                <a href={selectedCourseForContent.fileURL} target="_blank" rel="noopener noreferrer">
                                    <FileTextIcon className="mr-2 h-4 w-4"/> View Main Course Document
                                </a>
                            </Button>
                        )}

                        {selectedCourseForContent.chapters && selectedCourseForContent.chapters.length > 0 ? (
                            <div className="mt-4">
                                <h3 className="font-semibold mb-2 flex items-center"><List className="mr-2 h-5 w-5 text-primary"/>Course Content:</h3>
                                 <Accordion type="single" collapsible className="w-full">
                                    {selectedCourseForContent.chapters.map((chapter, index) => (
                                        <AccordionItem value={`chapter-${index}`} key={chapter.id || index}>
                                            <AccordionTrigger className="text-base hover:no-underline">
                                                {chapter.title}
                                            </AccordionTrigger>
                                            <AccordionContent className="space-y-3 pt-2">
                                                {chapter.description && (
                                                    <p className="text-sm text-muted-foreground italic mb-2">{chapter.description}</p>
                                                )}
                                                {chapter.content && (
                                                    <div className="prose prose-sm max-w-none dark:prose-invert text-foreground">
                                                        <ReactMarkdown>{chapter.content}</ReactMarkdown>
                                                    </div>
                                                )}
                                                {chapter.resources && chapter.resources.length > 0 && (
                                                  <div className="mt-3 pt-3 border-t">
                                                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">Chapter Resources:</h4>
                                                    <ul className="space-y-1">
                                                      {chapter.resources.map((resource, rIndex) => (
                                                        <li key={rIndex}>
                                                          <Button
                                                            variant="link"
                                                            asChild
                                                            className="p-0 h-auto text-sm text-primary hover:underline flex items-center justify-start text-left"
                                                          >
                                                            <a href={resource.url} target="_blank" rel="noopener noreferrer">
                                                              {getResourceIconDialog(resource.type)}
                                                              <span className="truncate">{resource.filename || resource.url}</span>
                                                              {resource.type === 'link' && <LinkIcon className="h-3 w-3 ml-1.5 flex-shrink-0" />}
                                                              {resource.type !== 'link' && <Download className="h-3 w-3 ml-1.5 flex-shrink-0" />}
                                                            </a>
                                                          </Button>
                                                        </li>
                                                      ))}
                                                    </ul>
                                                  </div>
                                                )}
                                                {chapter.children && chapter.children.length > 0 && (
                                                    <div className="mt-4">
                                                        {/* Using ChapterDisplay for nested children */}
                                                        {chapter.children.map((childChapter, childIndex) => (
                                                            <ChapterDisplay
                                                                key={childChapter.id || `child-${index}-${childIndex}`}
                                                                chapter={childChapter}
                                                                level={1} 
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </div>
                        ) : (
                            <p className="text-sm italic text-muted-foreground">No specific chapters or downloadable content. Review the description above.</p>
                         )}
                    </div>
                </ScrollArea>
                <DialogFooter className="mt-auto pt-4 border-t">
                    <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
                    <Button onClick={markContentCompleted} disabled={isUpdating}>
                        {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Mark Content as Completed
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}

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

      {selectedCourseForCert && selectedCourseForCert.progress?.certificateDetails && (
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
                  <Image src={selectedCourseForCert.progress.certificateDetails.logoURL || "https://placehold.co/150x50.png"} alt="Airline Logo" width={120} height={40} className="mb-4 mx-auto" data-ai-hint="company logo airline"/>
                  <div className="border-2 border-dashed border-primary p-6 rounded-lg bg-secondary/30 aspect-[8.5/5.5] w-full max-w-md flex flex-col items-center justify-around text-center" data-ai-hint="certificate award">
                        <h4 className="text-2xl font-bold text-primary">Certificate of Completion</h4>
                        <p className="text-sm my-2">This certifies that</p>
                        <p className="text-xl font-semibold">{user?.displayName || user?.email || "Crew Member"}</p>
                        <p className="text-sm my-2">has successfully completed the course</p>
                        <p className="text-lg font-medium">&quot;{selectedCourseForCert?.title}&quot;</p>
                        <p className="text-xs mt-3">Date of Completion: {selectedCourseForCert.progress.certificateDetails.issuedDate ? new Date(selectedCourseForCert.progress.certificateDetails.issuedDate).toLocaleDateString() : 'N/A'}</p>
                        <p className="text-xs mt-1">Certificate ID: {selectedCourseForCert.progress.certificateDetails.certificateId}</p>
                         {selectedCourseForCert.progress.certificateDetails.expiryDate && <p className="text-xs mt-1">Valid Until: {new Date(selectedCourseForCert.progress.certificateDetails.expiryDate).toLocaleDateString()}</p>}
                        <p className="text-xs mt-3">Issued by: {selectedCourseForCert.progress.certificateDetails.provider}</p>
                        <p className="text-xs mt-3">Signature: {selectedCourseForCert.progress.certificateDetails.signatureTextOrURL || "Express Airline Training Department"}</p>
                    </div>
                </div>
                <div className="space-y-1 text-sm mt-4">
                   <p className="font-semibold text-center">Achieved Score: {selectedCourseForCert?.progress?.quizScore}%</p>
                   {selectedCourseForCert?.mandatory && <p className="font-semibold text-destructive text-center mt-1">This was a mandatory training.</p>}
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
      )}
    </div>
  );
}

    
