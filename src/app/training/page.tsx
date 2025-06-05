
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { CheckCircle, BookOpen, PlayCircle, Award, XCircle, HelpCircle, ChevronRight, FileText as FileTextIcon } from "lucide-react";
import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Course {
  id: string;
  title: string;
  description: string;
  category: string; 
  courseIcon: LucideIcon;
  imageHint: string;
  contentStatus: 'NotStarted' | 'InProgress' | 'Completed';
  quizId: string; 
  quizTitle: string;
  quizStatus: 'NotTaken' | 'Attempted' | 'Passed' | 'Failed';
  quizScore?: number;
  certificateDetails?: {
    provider: string;
    certificateId: string;
    expiryDate?: string;
  };
}

const initialCourses: Course[] = [
  {
    id: "CRS001",
    title: "Emergency Procedures Review",
    description: "Master standard emergency protocols and aircraft-specific procedures.",
    category: "Safety",
    courseIcon: BookOpen,
    imageHint: "emergency exit",
    contentStatus: 'NotStarted',
    quizId: "QZ001",
    quizTitle: "Emergency Procedures Quiz",
    quizStatus: 'NotTaken',
  },
  {
    id: "CRS002",
    title: "Boeing 787 Systems Overview",
    description: "Understand the key systems of the Boeing 787 Dreamliner.",
    category: "Aircraft Systems",
    courseIcon: BookOpen,
    imageHint: "aircraft cockpit",
    contentStatus: 'InProgress',
    quizId: "QZ002",
    quizTitle: "B787 Systems Quiz",
    quizStatus: 'NotTaken',
  },
  {
    id: "CRS003",
    title: "Dangerous Goods Handling Regulations",
    description: "Stay current with regulations for handling dangerous goods.",
    category: "Regulations",
    courseIcon: BookOpen,
    imageHint: "hazard symbol",
    contentStatus: 'Completed', 
    quizId: "QZ003",
    quizTitle: "Dangerous Goods Quiz",
    quizStatus: 'NotTaken',
  },
  {
    id: "CRS004",
    title: "Customer Service Excellence Program",
    description: "Learn techniques for superior passenger experience.",
    category: "Service",
    courseIcon: BookOpen,
    imageHint: "flight attendant",
    contentStatus: 'Completed',
    quizId: "QZ004",
    quizTitle: "Service Scenarios Quiz",
    quizStatus: 'Passed', 
    quizScore: 92,
    certificateDetails: { provider: "SkyHigh Training Co.", certificateId: "CERT-CSE-004", expiryDate: "2026-07-01" }
  },
   {
    id: "CRS005",
    title: "First Aid & CPR Refresher",
    description: "Annual refresher for First Aid & CPR certification.",
    category: "Safety",
    courseIcon: BookOpen,
    imageHint: "first aid kit",
    contentStatus: 'Completed',
    quizId: "QZ005",
    quizTitle: "First Aid & CPR Quiz",
    quizStatus: 'Failed', 
    quizScore: 65,
    certificateDetails: { provider: "Red Cross", certificateId: "CERT-FA-CPR-005" } 
  },
];


export default function TrainingPage() {
  const { toast } = useToast();
  const [courses, setCourses] = React.useState<Course[]>(initialCourses);
  const [selectedCourseForQuiz, setSelectedCourseForQuiz] = React.useState<Course | null>(null);
  const [selectedCourseForCert, setSelectedCourseForCert] = React.useState<Course | null>(null);
  const [isQuizDialogOpen, setIsQuizDialogOpen] = React.useState(false);
  const [isCertDialogOpen, setIsCertDialogOpen] = React.useState(false);

  const handleCourseAction = (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;

    if (course.contentStatus !== 'Completed') {
      // Simulate completing course content
      setCourses(prevCourses => prevCourses.map(c => 
        c.id === courseId ? { ...c, contentStatus: 'Completed' } : c
      ));
      toast({ title: "Course Content Viewed", description: `You have completed the material for "${course.title}". You can now take the quiz.` });
    } else {
      // Open quiz dialog
      setSelectedCourseForQuiz(course);
      setIsQuizDialogOpen(true);
    }
  };

  const simulateQuiz = (courseId: string, passed: boolean) => {
    const score = passed ? Math.floor(Math.random() * 21) + 80 : Math.floor(Math.random() * 40) + 40; // 80-100 if passed, 40-79 if failed
    
    setCourses(prevCourses => prevCourses.map(c => {
      if (c.id === courseId) {
        const newQuizStatus = passed ? 'Passed' : 'Failed';
        const newCourseData: Course = {
          ...c,
          quizStatus: newQuizStatus,
          quizScore: score,
        };
        if (passed && !newCourseData.certificateDetails) {
            // Assign mock certificate details if passed and none exist
            newCourseData.certificateDetails = {
                provider: "In-House Certification",
                certificateId: `CERT-${c.id}-${new Date().getFullYear()}`,
                expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0] // Expires in 2 years
            };
        }
        return newCourseData;
      }
      return c;
    }));

    const course = courses.find(c => c.id === courseId);
    toast({
      title: `Quiz ${passed ? 'Passed' : 'Failed'}`,
      description: `You scored ${score}% on the "${course?.quizTitle}". ${passed ? 'Congratulations! Your certificate is now available.' : 'Please review the material and try again.'}`,
      variant: passed ? "default" : "destructive",
    });
    setIsQuizDialogOpen(false);
    setSelectedCourseForQuiz(null);
  };

  const openCertificateDialog = (course: Course) => {
    setSelectedCourseForCert(course);
    setIsCertDialogOpen(true);
  };

  const availableCourses = courses.filter(c => c.quizStatus !== 'Passed');
  const completedWithCerts = courses.filter(c => c.quizStatus === 'Passed');

  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">My Training Hub</CardTitle>
          <CardDescription>Complete courses, pass quizzes, and earn certificates to enhance your skills.</CardDescription>
        </CardHeader>
        <CardContent>
           <p className="text-muted-foreground">Track your progress and stay up-to-date with your certifications.</p>
        </CardContent>
      </Card>

      <section>
        <h2 className="text-xl font-semibold mb-4 font-headline flex items-center">
          <BookOpen className="mr-2 h-6 w-6 text-primary" />
          Available & In-Progress Courses
        </h2>
        {availableCourses.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {availableCourses.map((course) => {
              const CourseActionIcon = course.contentStatus !== 'Completed' ? ChevronRight : 
                                       course.quizStatus === 'NotTaken' ? HelpCircle : 
                                       course.quizStatus === 'Failed' ? XCircle : PlayCircle;
              return (
              <Card key={course.id} className="shadow-md hover:shadow-lg transition-shadow flex flex-col">
                <CardHeader className="flex-shrink-0">
                  <div className="flex items-start gap-3 mb-2">
                    <Image src={`https://placehold.co/80x80.png`} alt={course.title} width={60} height={60} className="rounded-lg" data-ai-hint={course.imageHint} />
                    <div>
                      <CardTitle className="text-lg">{course.title}</CardTitle>
                      <Badge variant="outline" className="mt-1">{course.category}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-3 h-16 overflow-hidden">
                      {course.description}
                    </p>
                    <div className="text-xs text-muted-foreground mb-1">
                        Content: <Badge variant={course.contentStatus === 'Completed' ? 'default' : 'secondary'} className={course.contentStatus === 'Completed' ? 'bg-green-500/20 text-green-700 border-green-500/30' : '' }>{course.contentStatus}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mb-3">
                        Quiz: <Badge variant={course.quizStatus === 'Failed' ? 'destructive' : 'secondary'} >{course.quizStatus} {course.quizScore && `(${course.quizScore}%)`}</Badge>
                    </div>
                  </div>
                  <Button onClick={() => handleCourseAction(course.id)} className="w-full mt-2">
                    <CourseActionIcon className="mr-2 h-4 w-4" />
                    {course.contentStatus !== 'Completed' ? (course.contentStatus === 'NotStarted' ? 'Start Course' : 'Continue Course') :
                     course.quizStatus === 'Failed' ? 'Retake Quiz' : 'Take Quiz'}
                  </Button>
                </CardContent>
              </Card>
            )})}
          </div>
        ) : (
          <p className="text-muted-foreground">No courses currently available or in progress. Check the completed section!</p>
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
                  <div className="flex items-center gap-3 mb-2">
                    <Image src={`https://placehold.co/80x80.png`} alt={course.title} width={60} height={60} className="rounded-lg" data-ai-hint={course.imageHint} />
                    <div>
                      <CardTitle className="text-lg">{course.title}</CardTitle>
                       <Badge variant="default" className="mt-1 bg-green-100 text-green-700 border-green-300">Passed ({course.quizScore}%)</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Completed on: {course.certificateDetails?.expiryDate ? new Date(new Date(course.certificateDetails.expiryDate).setFullYear(new Date(course.certificateDetails.expiryDate).getFullYear() - 2)).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]} (Simulated)
                  </p>
                  <p className="text-sm text-muted-foreground">Provider: {course.certificateDetails?.provider}</p>
                  <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => openCertificateDialog(course)}>
                    <FileTextIcon className="mr-2 h-4 w-4"/> View Certificate
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
           <p className="text-muted-foreground">No trainings completed yet. Finish a course and pass the quiz to earn a certificate!</p>
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
            <p className="text-sm">Click a button below to simulate your quiz result.</p>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
             <Button variant="outline" onClick={() => simulateQuiz(selectedCourseForQuiz!.id, false)}>
              <XCircle className="mr-2 h-4 w-4"/> Simulate Fail (e.g., 60%)
            </Button>
            <Button onClick={() => simulateQuiz(selectedCourseForQuiz!.id, true)}>
              <CheckCircle className="mr-2 h-4 w-4"/> Simulate Pass (e.g., 85%)
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
                <Image src="https://placehold.co/500x350.png" alt="Certificate Preview" width={500} height={350} className="rounded-md border" data-ai-hint="certificate document" />
              </div>
              <div className="space-y-1 text-sm">
                <p><strong>Issued to:</strong> Alex Crewman (Demo User)</p>
                <p><strong>Training Program:</strong> {selectedCourseForCert?.title}</p>
                <p><strong>Certificate ID:</strong> {selectedCourseForCert?.certificateDetails?.certificateId}</p>
                <p><strong>Date Issued:</strong> {selectedCourseForCert?.certificateDetails?.expiryDate ? new Date(new Date(selectedCourseForCert.certificateDetails.expiryDate).setFullYear(new Date(selectedCourseForCert.certificateDetails.expiryDate).getFullYear() - 2)).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}</p>
                <p><strong>Issuing Body:</strong> {selectedCourseForCert?.certificateDetails?.provider}</p>
                {selectedCourseForCert?.certificateDetails?.expiryDate && <p><strong>Valid Until:</strong> {selectedCourseForCert.certificateDetails.expiryDate}</p>}
                 <p className="font-semibold mt-2">Achieved Score: {selectedCourseForCert?.quizScore}%</p>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">Close</Button>
              </DialogClose>
              <Button type="button" onClick={() => alert('Download functionality not implemented yet.')}>Download PDF</Button>
            </DialogFooter>
          </DialogContent>
      </Dialog>

      <div className="text-center mt-8">
        <Button variant="link">Browse Full Course Catalog (Conceptual)</Button>
      </div>
    </div>
  );
}

    