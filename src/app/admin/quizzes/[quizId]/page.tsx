
"use client";

import * as React from "react";
import { useRouter, useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from "lucide-react";


export default function AdminQuizDetailPage() {
    const router = useRouter();
    const { toast } = useToast();
    const params = useParams();
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
