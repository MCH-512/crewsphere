
"use server";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { GraduationCap, AlertTriangle, CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getTrainingStatus } from "@/services/dashboard-service";

export async function MyTrainingStatusCard() {
    const stats = await getTrainingStatus();
    const coursesToDo = stats ? stats.totalMandatory - stats.completed : 0;

    return (
        <Card className="h-full shadow-md hover:shadow-lg transition-shadow flex flex-col">
            <CardHeader>
                <CardTitle className="font-headline text-xl flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    My Training Status
                </CardTitle>
                 <CardDescription>Your mandatory training progress.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
                {!stats ? (
                     <div className="flex items-start gap-4 text-destructive">
                        <AlertTriangle className="h-6 w-6 mt-1" />
                         <div>
                            <p className="font-semibold text-lg">Could not load status</p>
                            <p className="text-sm">There was an error fetching your data.</p>
                        </div>
                    </div>
                ) : coursesToDo > 0 ? (
                    <div className="flex items-start gap-4">
                        <AlertTriangle className="h-8 w-8 text-warning-foreground mt-1 flex-shrink-0" />
                        <div>
                            <p className="font-semibold text-lg">{coursesToDo} mandatory course(s) to complete</p>
                            <p className="text-sm text-muted-foreground">Stay up-to-date with your required training to ensure compliance and safety.</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-start gap-4 text-success">
                        <CheckCircle className="h-8 w-8 mt-1 flex-shrink-0" />
                         <div>
                            <p className="font-semibold text-lg">All mandatory training complete!</p>
                            <p className="text-sm text-muted-foreground">Excellent work. You are fully compliant with all training requirements.</p>
                        </div>
                    </div>
                )}
            </CardContent>
            <CardFooter>
                 <Button asChild className="w-full">
                    <Link href={(coursesToDo > 0 && stats?.nextCourseId) ? `/training/${stats.nextCourseId}` : '/training'}>
                        {coursesToDo > 0 ? 'Start Next Course' : 'Go to E-Learning Center'}
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
}
