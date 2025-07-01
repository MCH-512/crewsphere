
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { CheckCircle, BookOpen, PlayCircle, Award, XCircle, HelpCircle, ChevronRight, FileText as FileTextIcon, AlertTriangle, Loader2, GraduationCap, List, Download, Link as LinkIcon, ImageIcon, Video, Library, ListChecks, ShieldCheck, Users, HeartPulse, ClipboardCheck, Plane, Sparkles, BookCopy } from "lucide-react";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, doc, getDoc, setDoc, Timestamp, orderBy, limit } from "firebase/firestore";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Chapter, Resource } from "@/schemas/course-schema";
import ChapterDisplay from "@/components/features/course-chapter-display";
import Link from "next/link";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import ReactMarkdown from "react-markdown";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle as ShadAlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { StoredQuestion } from "@/schemas/quiz-question-schema";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";


// --- SHARED INTERFACES ---

interface CourseData {
  id: string; 
  title: string;
  description: string;
  category: string;
  imageHint: string;
  quizId: string;
  quizTitle?: string; 
  mandatory: boolean;
  published?: boolean;
  chapters?: Chapter[];
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


// --- HELPER FUNCTIONS & DATA ---

const getResourceIconDialog = (type?: Resource['type']) => {
  switch (type) {
    case "pdf": return <FileTextIcon className="h-4 w-4 mr-2 flex-shrink-0 text-primary" />;
    case "image": return <ImageIcon className="h-4 w-4 mr-2 flex-shrink-0 text-primary" />;
    case "video": return <Video className="h-4 w-4 mr-2 flex-shrink-0 text-primary" />;
    case "link": return <LinkIcon className="h-4 w-4 mr-2 flex-shrink-0 text-primary" />;
    case "file": default: return <FileTextIcon className="h-4 w-4 mr-2 flex-shrink-0 text-primary" />;
  }
};

const trainingFamilies = [
  { name: "Safety & Security", icon: ShieldCheck, categories: ["Safety and Security", "Dangerous Goods", "First Aid", "Safety Management System (SMS)", "Regulations & Compliance"] },
  { name: "Operational & Human Factors", icon: Plane, categories: ["Aircraft Type Rating", "Crew Resource Management (CRM)"] },
  { name: "Professional Development", icon: Award, categories: ["Brand & Grooming", "Specialized Training"] },
  { name: "Other", icon: BookCopy, categories: ["Other Training"] }
];

const getCourseFamily = (category: string) => {
    for (const family of trainingFamilies) {
        if (family.categories.includes(category)) {
            return family;
        }
    }
    // Fallback to "Other"
    return trainingFamilies.find(f => f.name === "Other")!;
};


// --- TAB COMPONENTS ---

const MyLearningTab = ({ onAction, onRefresh, courses, isLoading, error }: { onAction: (id: string) => void, onRefresh: () => void, courses: CombinedCourse[], isLoading: boolean, error: string | null }) => {
  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading active trainings...</p></div>;
  }
  if (error) {
    return <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><ShadAlertTitle>Error</ShadAlertTitle><AlertDescription>{error} <Button variant="link" onClick={onRefresh}>Try again</Button></AlertDescription></Alert>;
  }

  const groupedCourses = courses.reduce((acc, course) => {
    const family = getCourseFamily(course.category).name;
    if (!acc[family]) {
      acc[family] = [];
    }
    acc[family].push(course);
    return acc;
  }, {} as Record<string, CombinedCourse[]>);

  const hasCourses = Object.keys(groupedCourses).length > 0;

  return (
    <div className="space-y-8 mt-4">
      {hasCourses ? (
        trainingFamilies.map(family => {
          const coursesInFamily = groupedCourses[family.name];
          if (coursesInFamily && coursesInFamily.length > 0) {
            const Icon = family.icon;
            return (
              <section key={family.name}>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Icon className="h-6 w-6 text-primary"/>
                  {family.name}
                </h2>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {coursesInFamily.map(course => <CourseCard key={course.id} course={course} onAction={onAction} />)}
                </div>
              </section>
            );
          }
          return null;
        })
      ) : (
        <Card className="text-muted-foreground p-6 text-center shadow-md">
          <GraduationCap className="mx-auto h-12 w-12 text-primary mb-4" />
          <p className="font-semibold">No active or required trainings for you at this time.</p>
          <p className="text-sm">Visit the Course Library to find new courses.</p>
        </Card>
      )}
    </div>
  );
};

// CourseLibraryTab: Shows all available courses
const CourseLibraryTab = ({ onAction, onRefresh, courses, isLoading, error }: { onAction: (id: string) => void, onRefresh: () => void, courses: CombinedCourse[], isLoading: boolean, error: string | null }) => {
  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading course library...</p></div>;
  }
  if (error) {
    return <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><ShadAlertTitle>Error</ShadAlertTitle><AlertDescription>{error} <Button variant="link" onClick={onRefresh}>Try again</Button></AlertDescription></Alert>;
  }

  return (
    <div className="space-y-8 mt-4">
      {courses.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {courses.map(course => <CourseCard key={course.id} course={course} onAction={onAction} />)}
        </div>
      ) : (
        <Card className="text-muted-foreground p-6 text-center shadow-md">
          <Library className="mx-auto h-12 w-12 text-primary mb-4" />
          <p className="font-semibold">No courses found in the library.</p>
          <p className="text-sm">Please check back later, or contact an administrator.</p>
        </Card>
      )}
    </div>
  );
};

// CertificatesTab: Shows earned certificates
const CertificatesTab = ({ onAction, onRefresh, courses, isLoading, error }: { onAction: (id: string) => void, onRefresh: () => void, courses: CombinedCourse[], isLoading: boolean, error: string | null }) => {
  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading certificates...</p></div>;
  }
  if (error) {
    return <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><ShadAlertTitle>Error</ShadAlertTitle><AlertDescription>{error} <Button variant="link" onClick={onRefresh}>Try again</Button></AlertDescription></Alert>;
  }

  return (
    <div className="space-y-8 mt-4">
      {courses.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {courses.map(course => <CourseCard key={course.id} course={course} onAction={onAction} isCertificateView={true} />)}
        </div>
      ) : (
        <Card className="text-muted-foreground p-6 text-center shadow-md">
          <Award className="mx-auto h-12 w-12 text-primary mb-4" />
          <p className="font-semibold">No certificates earned yet.</p>
          <p className="text-sm">Complete courses and pass their quizzes to earn certificates.</p>
        </Card>
      )}
    </div>
  );
};

// --- SHARED UI COMPONENT ---

const CourseCard = ({ course, onAction, isCertificateView = false }: { course: CombinedCourse; onAction: (id: string) => void; isCertificateView?: boolean; }) => {
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
    <Card className="shadow-md hover:shadow-lg transition-shadow flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-start gap-3 mb-2">
          <Image src={`https://placehold.co/60x60.png`} alt={course.title} width={60} height={60} className="rounded-lg" data-ai-hint={course.imageHint || "training"} />
          <div>
            <CardTitle className="text-lg">{course.title}</CardTitle>
            <Badge variant="outline" className="mt-1">{course.category}</Badge>
            {course.mandatory && <Badge variant="destructive" className="mt-1 ml-2">Mandatory</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1 line-clamp-4" title={course.description}>
            {course.description}
          </p>
          {course.duration && <p className="text-xs text-muted-foreground mb-3">Est. Duration: {course.duration}</p>}
          
          {isCertificateView ? (
             <div className="text-xs text-muted-foreground mb-3 space-y-1">
              <p>Certified on: {course.progress?.certificateDetails?.issuedDate ? new Date(course.progress.certificateDetails.issuedDate).toLocaleDateString() : 'N/A'}</p>
              {course.progress?.certificateDetails?.expiryDate && <p>Expires: {new Date(course.progress.certificateDetails.expiryDate).toLocaleDateString()}</p>}
             </div>
          ) : (
            <>
              <div className="text-xs text-muted-foreground mb-1">Content: <Badge variant={contentStatus === 'Completed' ? 'success' : 'secondary'}>{contentStatus}</Badge></div>
              <div className="text-xs text-muted-foreground mb-3">Quiz: <Badge variant={quizStatus === 'Failed' ? 'destructive' : (quizStatus === 'Passed' ? 'success' : 'secondary')}>{quizStatus} {quizScore !== undefined && `(${quizScore}%)`}</Badge></div>
            </>
          )}
        </div>
        <Button onClick={() => onAction(course.id)} className="w-full mt-2">
          <ActionIcon className="mr-2 h-4 w-4" />{actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
};


// --- MAIN PAGE COMPONENT ---

export default function TrainingHubPage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  
  const [allCourses, setAllCourses] = React.useState<CombinedCourse[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [selectedCourseForContent, setSelectedCourseForContent] = React.useState<CombinedCourse | null>(null);
  const [selectedCourseForQuiz, setSelectedCourseForQuiz] = React.useState<CombinedCourse | null>(null);
  const [selectedCourseForCert, setSelectedCourseForCert] = React.useState<CombinedCourse | null>(null);
  const [isContentDialogOpen, setIsContentDialogOpen] = React.useState(false);
  const [isQuizDialogOpen, setIsQuizDialogOpen] = React.useState(false);
  const [isCertDialogOpen, setIsCertDialogOpen] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);

  const fetchAllData = React.useCallback(async () => {
    if (!user) { setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);
    try {
      const coursesQuery = query(collection(db, "courses"), where("published", "==", true), orderBy("title"));
      const coursesSnapshot = await getDocs(coursesQuery);
      const fetchedCoursesData = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CourseData));
      const progressPromises = fetchedCoursesData.map(course => getDoc(doc(db, "userTrainingProgress", `${user.uid}_${course.id}`)));
      const progressSnapshots = await Promise.all(progressPromises);
      const quizPromises = fetchedCoursesData.map(course => course.quizId ? getDoc(doc(db, "quizzes", course.quizId)) : Promise.resolve(null));
      const quizSnapshots = await Promise.all(quizPromises);

      const combinedCourses = fetchedCoursesData.map((course, index) => {
        const progressSnap = progressSnapshots[index];
        const quizSnap = quizSnapshots[index];
        let userProgress: UserProgressData = {
            userId: user.uid,
            courseId: course.id,
            contentStatus: 'NotStarted',
            quizStatus: 'NotTaken',
            lastUpdated: Timestamp.now() 
        };
        if (progressSnap.exists()) {
          userProgress = { ...userProgress, ...progressSnap.data() } as UserProgressData;
        }
        const quizTitle = quizSnap?.exists() ? quizSnap.data()?.title : "Course Quiz";
        return { ...course, quizTitle, progress: userProgress };
      });
      setAllCourses(combinedCourses);
    } catch (err) {
      console.error("Error fetching training data:", err);
      setError("Failed to load your training data. Please try again.");
      toast({ title: "Loading Error", description: "Could not fetch your training data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  React.useEffect(() => {
    if (!authLoading) fetchAllData();
  }, [authLoading, fetchAllData]);

  const handleCourseAction = (courseId: string) => {
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
    if (!user || !selectedCourseForContent) return;
    setIsUpdating(true);
    const progressDocId = `${user.uid}_${selectedCourseForContent.id}`;
    const progressDocRef = doc(db, "userTrainingProgress", progressDocId);
    try {
      const newProgressData: Partial<UserProgressData> = {
        userId: user.uid,
        courseId: selectedCourseForContent.id,
        contentStatus: 'Completed',
        lastUpdated: Timestamp.now(),
        quizStatus: selectedCourseForContent.progress?.quizStatus === 'NotTaken' ? 'NotTaken' : selectedCourseForContent.progress?.quizStatus
      };
      await setDoc(progressDocRef, newProgressData, { merge: true });
      toast({ title: "Course Content Viewed", description: `You have completed the material for "${selectedCourseForContent.title}". You can now take the quiz.` });
      fetchAllData();
      setIsContentDialogOpen(false);
    } catch (error) {
      toast({ title: "Update Error", description: "Could not update course progress.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleQuizSubmit = async (courseId: string, score: number) => {
    if (!user) return;
    const course = allCourses.find(c => c.id === courseId);
    if (!course) return;
    setIsUpdating(true);
    
    let passingThreshold = 80; // default
    let ruleData: any = {};
    if (course.certificateRuleId) {
        const ruleSnap = await getDoc(doc(db, "certificateRules", course.certificateRuleId));
        if (ruleSnap.exists()) {
            ruleData = ruleSnap.data();
            passingThreshold = ruleData.passingThreshold || 80;
        }
    }
    
    const passed = score >= passingThreshold;
    const progressDocId = `${user.uid}_${course.id}`;
    const progressDocRef = doc(db, "userTrainingProgress", progressDocId);
    
    const newProgressData: Partial<UserProgressData> = {
      quizStatus: passed ? 'Passed' : 'Failed',
      quizScore: score,
      lastUpdated: Timestamp.now(),
    };

    if (passed) {
      const expiryDays = ruleData.expiryDurationDays ?? 365;
      newProgressData.certificateDetails = {
        provider: ruleData.provider || "AirCrew Hub Training Dept.",
        certificateId: `ACH-CERT-${course.id.substring(0,5)}-${new Date().getFullYear()}`,
        issuedDate: new Date().toISOString(),
        expiryDate: expiryDays > 0 ? new Date(new Date().setDate(new Date().getDate() + expiryDays)).toISOString() : undefined,
        logoURL: ruleData.logoURL || "https://placehold.co/150x50.png",
        signatureTextOrURL: ruleData.signatureTextOrURL || "Express Airline Training Department",
      };
    }

    try {
      await setDoc(progressDocRef, newProgressData, { merge: true });
      toast({
        title: `Quiz ${passed ? 'Passed' : 'Failed'}`,
        description: `You scored ${score}% on "${course.quizTitle}". ${passed ? 'Congratulations!' : 'Please review and try again.'}`,
        variant: passed ? "default" : "destructive",
      });
      fetchAllData();
    } catch (error) {
      toast({ title: "Quiz Update Error", description: "Could not save quiz results.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
      setIsQuizDialogOpen(false);
    }
  };

  if (authLoading) return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (!user) return <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center"><AlertTriangle className="h-12 w-12 text-destructive mb-4" /><CardTitle className="text-xl mb-2">Access Denied</CardTitle><p className="text-muted-foreground">Please log in to access the Training Hub.</p><Button onClick={() => window.location.href='/login'} className="mt-4">Go to Login</Button></div>;

  const myLearningCourses = allCourses.filter(c => c.progress?.quizStatus !== 'Passed' && (c.mandatory || c.progress?.contentStatus !== 'NotStarted'));
  const certificates = allCourses.filter(c => c.progress?.quizStatus === 'Passed' && c.progress?.certificateDetails);

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center gap-3">
          <GraduationCap className="h-7 w-7 text-primary" />
          <div>
            <CardTitle className="text-2xl font-headline">Training Hub</CardTitle>
            <CardDescription>Your central place to complete mandatory trainings, browse courses, and view certificates.</CardDescription>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="my-learning" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="my-learning">My Learning</TabsTrigger>
          <TabsTrigger value="course-library">Course Library</TabsTrigger>
          <TabsTrigger value="my-certificates">My Certificates</TabsTrigger>
        </TabsList>
        <TabsContent value="my-learning">
          <MyLearningTab courses={myLearningCourses} isLoading={isLoading} error={error} onAction={handleCourseAction} onRefresh={fetchAllData} />
        </TabsContent>
        <TabsContent value="course-library">
          <CourseLibraryTab courses={allCourses} isLoading={isLoading} error={error} onAction={handleCourseAction} onRefresh={fetchAllData} />
        </TabsContent>
        <TabsContent value="my-certificates">
          <CertificatesTab courses={certificates} isLoading={isLoading} error={error} onAction={handleCourseAction} onRefresh={fetchAllData} />
        </TabsContent>
      </Tabs>
      
      {/* DIALOGS */}
      {selectedCourseForContent && <CourseContentDialog course={selectedCourseForContent} isOpen={isContentDialogOpen} onOpenChange={setIsContentDialogOpen} onComplete={markContentCompleted} isUpdating={isUpdating} />}
      {selectedCourseForQuiz && <QuizDialog course={selectedCourseForQuiz} isOpen={isQuizDialogOpen} onOpenChange={setIsQuizDialogOpen} onQuizSubmit={handleQuizSubmit} isUpdating={isUpdating} />}
      {selectedCourseForCert && <CertificateDialog course={selectedCourseForCert} isOpen={isCertDialogOpen} onOpenChange={setIsCertDialogOpen} user={user} />}
    </div>
  );
}


// --- DIALOG COMPONENTS ---

const CourseContentDialog = ({ course, isOpen, onOpenChange, onComplete, isUpdating }: { course: CombinedCourse, isOpen: boolean, onOpenChange: (open: boolean) => void, onComplete: () => void, isUpdating: boolean }) => (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader><DialogTitle>{course.title}</DialogTitle><DialogDescription>Category: {course.category} | Duration: {course.duration || 'N/A'}{course.mandatory && <Badge variant="destructive" className="ml-2">Mandatory</Badge>}</DialogDescription></DialogHeader>
            <ScrollArea className="flex-grow"><div className="py-4 space-y-4"><p className="text-sm text-muted-foreground mb-4">{course.description}</p>{course.fileURL && <Button asChild variant="outline" className="mb-4"><a href={course.fileURL} target="_blank" rel="noopener noreferrer"><FileTextIcon className="mr-2 h-4 w-4"/>View Main Course Document</a></Button>}{course.chapters && course.chapters.length > 0 ? <div className="mt-4"><h3 className="font-semibold mb-2 flex items-center"><List className="mr-2 h-5 w-5 text-primary"/>Course Content:</h3><Accordion type="single" collapsible className="w-full">{course.chapters.map((chapter, index) => <AccordionItem value={`chapter-${index}`} key={chapter.id || index}><AccordionTrigger className="text-base hover:no-underline">{chapter.title}</AccordionTrigger><AccordionContent className="space-y-3 pt-2">{chapter.description && <p className="text-sm text-muted-foreground italic mb-2">{chapter.description}</p>}{chapter.content && <div className="prose prose-sm max-w-none dark:prose-invert text-foreground"><ReactMarkdown>{chapter.content}</ReactMarkdown></div>}{chapter.resources && chapter.resources.length > 0 && <div className="mt-3 pt-3 border-t"><h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">Chapter Resources:</h4><ul className="space-y-1">{chapter.resources.map((resource, rIndex) => <li key={rIndex}><Button variant="link" asChild className="p-0 h-auto text-sm text-primary hover:underline flex items-center justify-start text-left"><a href={resource.url} target="_blank" rel="noopener noreferrer">{getResourceIconDialog(resource.type)}<span className="truncate">{resource.filename || resource.url}</span>{resource.type === 'link' ? <LinkIcon className="h-3 w-3 ml-1.5 flex-shrink-0" /> : <Download className="h-3 w-3 ml-1.5 flex-shrink-0" />}</a></Button></li>)}</ul></div>}{chapter.children && chapter.children.length > 0 && <div className="mt-4">{chapter.children.map((childChapter, childIndex) => <ChapterDisplay key={childChapter.id || `child-${index}-${childIndex}`} chapter={childChapter} level={1} />)}</div>}</AccordionContent></AccordionItem>)}</Accordion></div> : <p className="text-sm italic text-muted-foreground">No specific chapters. Review the description.</p>}</div></ScrollArea>
            <DialogFooter className="mt-auto pt-4 border-t"><DialogClose asChild><Button variant="outline">Close</Button></DialogClose><Button onClick={onComplete} disabled={isUpdating}>{isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null} Mark as Completed</Button></DialogFooter>
        </DialogContent>
    </Dialog>
);

const QuizDialog = ({ course, isOpen, onOpenChange, onQuizSubmit, isUpdating }: { course: CombinedCourse, isOpen: boolean, onOpenChange: (open: boolean) => void, onQuizSubmit: (id: string, score: number) => Promise<void>, isUpdating: boolean }) => {
    const { toast } = useToast();
    const [questions, setQuestions] = React.useState<StoredQuestion[]>([]);
    const [isLoadingQuestions, setIsLoadingQuestions] = React.useState(true);
    const [answers, setAnswers] = React.useState<Record<string, string>>({});
    
    const handleAnswerChange = (questionId: string, answer: string) => {
      setAnswers(prev => ({ ...prev, [questionId]: answer }));
    };

    React.useEffect(() => {
        if (isOpen && course) {
            const fetchQuestions = async () => {
                setIsLoadingQuestions(true);
                setAnswers({}); // Reset answers when opening
                try {
                    const q = query(
                        collection(db, "questions"),
                        where("quizId", "==", course.quizId),
                    );
                    const snapshot = await getDocs(q);
                    const fetchedQuestions = snapshot.docs
                        .map(doc => ({ id: doc.id, ...doc.data() } as StoredQuestion));
                    
                    if(course.randomizeQuestions){
                        fetchedQuestions.sort(() => 0.5 - Math.random());
                    }

                    setQuestions(fetchedQuestions);
                } catch (err) {
                    console.error("Error fetching questions for quiz:", err);
                    toast({ title: "Error", description: "Could not load questions for the quiz." });
                } finally {
                    setIsLoadingQuestions(false);
                }
            };
            fetchQuestions();
        }
    }, [isOpen, course, toast]);
    
    const handleSubmit = async () => {
        if (Object.keys(answers).length < questions.length) {
            toast({ title: "Incomplete", description: "Please answer all questions before submitting.", variant: "default" });
            return;
        }

        let correctCount = 0;
        questions.forEach(q => {
            if (answers[q.id] && answers[q.id].toLowerCase() === q.correctAnswer.toLowerCase()) {
                correctCount++;
            }
        });

        const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 100;
        await onQuizSubmit(course.id, score);
    };

    const allQuestionsAnswered = Object.keys(answers).length === questions.length;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Quiz: {course.quizTitle}</DialogTitle>
              <DialogDescription>Answer all questions to complete the quiz for {course.title}.</DialogDescription>
            </DialogHeader>
            <div className="flex-grow py-4 pr-1">
                <ScrollArea className="h-[60vh] pr-4">
                    {isLoadingQuestions ? (
                        <div className="text-center p-4"><Loader2 className="h-6 w-6 animate-spin mx-auto" /><p className="text-sm text-muted-foreground mt-2">Loading questions...</p></div>
                    ) : questions.length === 0 ? (
                        <div className="text-center p-4"><HelpCircle className="h-8 w-8 mx-auto text-muted-foreground"/><p className="text-sm text-muted-foreground mt-2">No questions found for this course category.</p></div>
                    ) : (
                        <div className="space-y-6">
                            {questions.map((q, index) => (
                                <Card key={q.id} className="shadow-sm">
                                    <CardHeader className="pb-4">
                                        <CardTitle className="text-base font-semibold">Question {index + 1}</CardTitle>
                                        <CardDescription className="text-sm !mt-1 text-foreground">{q.questionText}</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <RadioGroup value={answers[q.id] || ""} onValueChange={(value) => handleAnswerChange(q.id, value)}>
                                            {(q.options || []).map((opt, optIndex) => (
                                                <div key={optIndex} className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted transition-colors">
                                                    <RadioGroupItem value={opt} id={`${q.id}-${optIndex}`} />
                                                    <Label htmlFor={`${q.id}-${optIndex}`} className="font-normal cursor-pointer flex-grow">{opt}</Label>
                                                </div>
                                            ))}
                                        </RadioGroup>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button onClick={handleSubmit} disabled={isUpdating || isLoadingQuestions || !allQuestionsAnswered}>
                {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                Submit Quiz
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    );
};

const CertificateDialog = ({ course, isOpen, onOpenChange, user }: { course: CombinedCourse, isOpen: boolean, onOpenChange: (open: boolean) => void, user: any }) => {
    const { toast } = useToast();
    const details = course.progress?.certificateDetails;
    if (!details) return null;
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[650px]">
              <DialogHeader><DialogTitle>Certificate of Completion</DialogTitle><DialogDescription>For the successful completion of the {course.title} program.</DialogDescription></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="mx-auto my-4">
                  <div className="border-2 border-dashed border-primary p-6 rounded-lg bg-secondary/30 aspect-[8.5/5.5] w-full max-w-md flex flex-col items-center justify-around text-center" data-ai-hint="certificate award">
                    <Image src={details.logoURL || "https://placehold.co/150x50.png"} alt="Airline Logo" width={120} height={40} className="mb-4 mx-auto" data-ai-hint="company logo airline"/>
                    <h4 className="text-2xl font-bold text-primary">Certificate of Completion</h4>
                    <p className="text-sm my-2">This certifies that</p>
                    <p className="text-xl font-semibold">{user?.displayName || user?.email}</p>
                    <p className="text-sm my-2">has successfully completed the course</p>
                    <p className="text-lg font-medium">&quot;{course.title}&quot;</p>
                    <p className="text-xs mt-3">Date: {new Date(details.issuedDate).toLocaleDateString()}</p>
                    <p className="text-xs mt-1">ID: {details.certificateId}</p>
                    {details.expiryDate && <p className="text-xs mt-1">Valid Until: {new Date(details.expiryDate).toLocaleDateString()}</p>}
                    <p className="text-xs mt-3">Issued by: {details.provider}</p>
                    <p className="text-xs mt-3">Signature: {details.signatureTextOrURL}</p>
                  </div>
                </div>
                <div className="space-y-1 text-sm mt-4">
                  <p className="font-semibold text-center">Achieved Score: {course.progress?.quizScore}%</p>
                  {course.mandatory && <p className="font-semibold text-destructive text-center mt-1">This was a mandatory training.</p>}
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="secondary">Close</Button></DialogClose>
                <Button type="button" onClick={() => toast({title: "Feature Not Implemented", description: "PDF download is not available."})}>Download PDF</Button>
              </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
