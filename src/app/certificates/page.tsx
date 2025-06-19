
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Award, FileText as FileTextIcon, AlertTriangle, Loader2, CheckCircle } from "lucide-react";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, doc, getDoc, Timestamp } from "firebase/firestore";

interface CourseData {
  id: string; 
  title: string;
  description: string;
  category: string;
  imageHint: string;
  quizId: string;
  quizTitle?: string; 
  mandatory: boolean;
  modules?: { moduleTitle: string; durationMinutes: number }[];
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

interface CertifiedCourse extends CourseData {
  progress: UserProgressData; 
}

export default function CertificatesPage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  
  const [certifiedCourses, setCertifiedCourses] = React.useState<CertifiedCourse[]>([]);
  const [isLoadingCertificates, setIsLoadingCertificates] = React.useState(true);
  const [loadingError, setLoadingError] = React.useState<string | null>(null);

  const [selectedCourseForCert, setSelectedCourseForCert] = React.useState<CertifiedCourse | null>(null);
  const [isCertDialogOpen, setIsCertDialogOpen] = React.useState(false);

  const fetchCertificates = React.useCallback(async () => {
    if (!user) {
      setIsLoadingCertificates(false);
      return;
    }
    setIsLoadingCertificates(true);
    setLoadingError(null);
    try {
      const progressQuery = query(
        collection(db, "userTrainingProgress"), 
        where("userId", "==", user.uid),
        where("quizStatus", "==", "Passed")
      );
      const progressSnapshot = await getDocs(progressQuery);
      
      const fetchedCertifiedCourses: CertifiedCourse[] = [];

      for (const progressDoc of progressSnapshot.docs) {
        const progressData = progressDoc.data() as UserProgressData;
        
        if (!progressData.certificateDetails || !progressData.certificateDetails.certificateId) {
          continue; 
        }

        const courseDocRef = doc(db, "courses", progressData.courseId);
        const courseDocSnap = await getDoc(courseDocRef);

        if (courseDocSnap.exists()) {
          const courseDataFromDb = courseDocSnap.data() as Omit<CourseData, 'id' | 'quizTitle'>;
          let currentQuizTitle = courseDataFromDb.quizTitle; 
           if (!currentQuizTitle && courseDataFromDb.quizId) { 
                const quizDocRef = doc(db, "quizzes", courseDataFromDb.quizId);
                const quizSnap = await getDoc(quizDocRef);
                if (quizSnap.exists()) {
                    currentQuizTitle = quizSnap.data()?.title || "Course Quiz";
                } else {
                    currentQuizTitle = "Course Quiz"; 
                }
            } else if (!currentQuizTitle) {
                currentQuizTitle = "Course Quiz"; 
            }
            
            const finalProgressData = { ...progressData };
            if (finalProgressData.certificateDetails) {
                finalProgressData.certificateDetails.logoURL = finalProgressData.certificateDetails.logoURL || "https://placehold.co/150x50.png";
                finalProgressData.certificateDetails.signatureTextOrURL = finalProgressData.certificateDetails.signatureTextOrURL || "Express Airline Training Department";
                finalProgressData.certificateDetails.provider = finalProgressData.certificateDetails.provider || "AirCrew Hub Training Dept.";
            }


          fetchedCertifiedCourses.push({ 
            id: courseDocSnap.id,
            ...courseDataFromDb,
            quizTitle: currentQuizTitle, 
            progress: finalProgressData 
          });
        }
      }
      setCertifiedCourses(fetchedCertifiedCourses.sort((a,b) => 
        new Date(b.progress.certificateDetails!.issuedDate).getTime() - new Date(a.progress.certificateDetails!.issuedDate).getTime()
      ));
    } catch (err) {
      console.error("Error fetching certificates:", err);
      setLoadingError("Failed to load your certificates. Please try again.");
      toast({ title: "Loading Error", description: "Could not fetch certificates.", variant: "destructive" });
    } finally {
      setIsLoadingCertificates(false);
    }
  }, [user, toast]);

  React.useEffect(() => {
    if (!authLoading && user) {
      fetchCertificates();
    } else if (!authLoading && !user) {
      setIsLoadingCertificates(false); 
    }
  }, [authLoading, user, fetchCertificates]);
  
  const openCertificateDialog = (course: CertifiedCourse) => {
    setSelectedCourseForCert(course);
    setIsCertDialogOpen(true);
  };

  if (authLoading || isLoadingCertificates) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading your certificates...</p>
      </div>
    );
  }

  if (!user && !authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <CardTitle className="text-xl mb-2">Access Denied</CardTitle>
        <p className="text-muted-foreground">Please log in to view your certificates.</p>
        <Button onClick={() => window.location.href='/login'} className="mt-4">Go to Login</Button>
      </div>
    );
  }
  
  if (loadingError) {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <CardTitle className="text-xl mb-2">Error Loading Certificates</CardTitle>
        <p className="text-muted-foreground mb-4">{loadingError}</p>
        <Button onClick={fetchCertificates} disabled={isLoadingCertificates}>
            {isLoadingCertificates && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
            <Award className="mr-3 h-7 w-7 text-primary" />
            My Certificates
          </CardTitle>
          <CardDescription>View all your earned training certificates and their details.</CardDescription>
        </CardHeader>
        <CardContent>
           <p className="text-muted-foreground">Keep track of your qualifications and accomplishments.</p>
        </CardContent>
      </Card>

      <section>
        {certifiedCourses.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {certifiedCourses.map((course) => (
              <Card key={course.id} className="shadow-md hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start gap-3 mb-2">
                    <Image src={`https://placehold.co/60x60.png`} alt={course.title} width={60} height={60} className="rounded-lg" data-ai-hint={course.imageHint || "certificate"} />
                    <div>
                      <CardTitle className="text-lg">{course.title}</CardTitle>
                       <Badge variant="success" className="mt-1">Passed ({course.progress?.quizScore}%)</Badge>
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
                  <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => openCertificateDialog(course)}>
                    <FileTextIcon className="mr-2 h-4 w-4"/> View Certificate
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
           <Card className="text-muted-foreground p-6 text-center shadow-md">
            <Award className="mx-auto h-12 w-12 text-primary mb-4" />
            <p className="font-semibold">No certificates earned yet.</p>
            <p className="text-sm">Complete courses and pass their quizzes to earn certificates. Check the "Training Hub" or "Course Library".</p>
          </Card>
        )}
      </section>

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
                  <Image src={selectedCourseForCert.progress.certificateDetails.logoURL || "https://placehold.co/150x50.png"} alt="Airline Logo" width={120} height={40} className="mb-4 mx-auto" data-ai-hint="company logo"/>
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

