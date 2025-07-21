
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth, type User } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import { Loader2, AlertTriangle, ArrowLeft, ShieldCheck, Download, Plane } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { StoredUserQuizAttempt } from "@/schemas/user-progress-schema";
import { StoredCourse, StoredCertificateRule } from "@/schemas/course-schema";
import { format, add } from "date-fns";
import { cn } from "@/lib/utils";

interface CertificateData {
    attempt: StoredUserQuizAttempt;
    user: User;
    course: StoredCourse;
    certRule: StoredCertificateRule;
}

export default function CertificatePage() {
    const { user: authUser, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();
    const attemptId = params.attemptId as string;

    const [data, setData] = React.useState<CertificateData | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!attemptId) return;
        if (authLoading) return;
        if (!authUser) {
            router.push('/login');
            return;
        }

        const fetchCertificateData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const attemptDocRef = doc(db, "userQuizAttempts", attemptId);
                const attemptSnap = await getDoc(attemptDocRef);
                if (!attemptSnap.exists() || attemptSnap.data().status !== 'passed') {
                    throw new Error("Certificate not found or quiz was not passed.");
                }
                const attempt = { id: attemptSnap.id, ...attemptSnap.data() } as StoredUserQuizAttempt;

                // Security check: ensure the logged-in user is the owner or an admin
                if (authUser.uid !== attempt.userId && authUser.role !== 'admin') {
                     throw new Error("You do not have permission to view this certificate.");
                }

                const [userSnap, courseSnap] = await Promise.all([
                    getDoc(doc(db, "users", attempt.userId)),
                    getDoc(doc(db, "courses", attempt.courseId)),
                ]);

                if (!userSnap.exists()) throw new Error("User data for this certificate could not be found.");
                if (!courseSnap.exists()) throw new Error("Course data for this certificate could not be found.");
                
                const course = { id: courseSnap.id, ...courseSnap.data() } as StoredCourse;
                
                if (!course.certificateRuleId) throw new Error("Certificate rule definition missing for this course.");
                const certRuleSnap = await getDoc(doc(db, "certificateRules", course.certificateRuleId));
                if (!certRuleSnap.exists()) throw new Error("Certificate rules could not be found.");

                setData({
                    attempt,
                    user: { ...userSnap.data(), uid: userSnap.id, email: userSnap.data().email || '' } as User,
                    course,
                    certRule: { id: certRuleSnap.id, ...certRuleSnap.data() } as StoredCertificateRule,
                });

            } catch (err: any) {
                setError(err.message || "An unknown error occurred while loading the certificate.");
                toast({ title: "Loading Error", description: err.message, variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };

        fetchCertificateData();
    }, [attemptId, authUser, authLoading, router, toast]);

    if (authLoading || isLoading) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3">Loading Certificate...</p></div>;
    }

    if (error) {
        return <div className="text-center py-10"><AlertTriangle className="mx-auto h-12 w-12 text-destructive" /><p className="mt-4 text-lg">{error}</p><Button onClick={() => router.push('/training')} className="mt-4">Back to Training</Button></div>;
    }

    if (!data) return null;

    const { attempt, user, course, certRule } = data;
    const completionDate = attempt.completedAt.toDate();
    const expiryDate = add(completionDate, { days: certRule.expiryDurationDays });

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
             <div className="flex justify-between items-center print:hidden">
                <Button variant="outline" onClick={() => router.push('/training')}><ArrowLeft className="mr-2 h-4 w-4"/>Back to E-Learning</Button>
                <Button onClick={() => window.print()}><Download className="mr-2 h-4 w-4"/>Print Certificate</Button>
            </div>
            
            <Card className="shadow-2xl border-4 border-primary/20 aspect-[1.414/1] print:shadow-none print:border-none">
                <div className="relative w-full h-full p-8 flex flex-col items-center justify-center text-center bg-gradient-to-br from-background via-card to-background">
                   {/* Watermark */}
                   <Plane className="absolute text-muted/10 h-3/4 w-3/4 -rotate-12 z-0 print:text-gray-200" />
                   
                    <div className="relative z-10 space-y-4">
                        <h1 className="text-sm uppercase tracking-widest text-muted-foreground">Certificate of Completion</h1>
                        <p className="text-lg">This certifies that</p>
                        <h2 className="text-4xl font-bold text-primary font-headline">{user.fullName || user.displayName}</h2>
                        <p className="text-lg">has successfully completed the course</p>
                        <h3 className="text-2xl font-semibold">{course.title}</h3>
                        <p className="text-sm text-muted-foreground">
                            with a score of <span className="font-bold">{attempt.score.toFixed(0)}%</span> on <span className="font-bold">{format(completionDate, "MMMM d, yyyy")}</span>.
                        </p>
                    </div>

                    <div className="relative z-10 mt-12 flex justify-between w-full max-w-lg">
                        <div className="text-center text-xs">
                           <p className="font-serif italic mb-2">AirCrew Hub Training Department</p>
                           <hr />
                           <p className="mt-1">Authorized Signature</p>
                        </div>
                        <div className="text-center text-xs">
                           <p className="font-bold mb-2">{format(completionDate, "yyyy-MM-dd")}</p>
                           <hr />
                           <p className="mt-1">Date of Issue</p>
                        </div>
                        <div className="text-center text-xs">
                           <p className="font-bold mb-2">{certRule.expiryDurationDays > 0 ? format(expiryDate, "yyyy-MM-dd") : "Never"}</p>
                           <hr />
                           <p className="mt-1">Expiration Date</p>
                        </div>
                    </div>
                     <ShieldCheck className="absolute bottom-6 right-6 h-12 w-12 text-primary/30 z-10 print:text-primary" />
                </div>
            </Card>
        </div>
    );
}
