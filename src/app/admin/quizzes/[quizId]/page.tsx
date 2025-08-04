
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, orderBy, addDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import { CheckSquare, Loader2, AlertTriangle, ArrowLeft, PlusCircle, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { StoredQuestion } from "@/schemas/quiz-question-schema";
import { StoredQuiz, StoredCourse } from "@/schemas/course-schema";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { questionFormSchema, type QuestionFormValues } from "@/schemas/quiz-question-schema";
import { logAuditEvent } from "@/lib/audit-logger";

export default function QuizDetailPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();
    const quizId = params.quizId as string;

    React.useEffect(() => {
        // Redirect logic for deprecation
        if (quizId) {
            toast({
                title: "Page Deprecated",
                description: "Quiz management is now integrated into Course Management. Redirecting...",
                variant: "default"
            });
            router.replace('/admin/courses');
        }
    }, [quizId, router, toast]);


    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <h1 className="text-xl font-semibold mb-2">Redirecting...</h1>
            <p className="text-muted-foreground max-w-md">
                Quiz Management has been integrated directly into the Course Management page for a more streamlined workflow. You are being redirected.
            </p>
        </div>
    );
}
