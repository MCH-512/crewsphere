'use server';

import "server-only";
import { CoursesClient } from "./courses-client";
import { getCourses } from "@/services/course-service";
import { z } from "zod";

const EmptySchema = z.object({});


export default async function AdminCoursesPage() {
    EmptySchema.parse({}); // Zod validation
    const { courses, quizzes, certRules, questions } = await getCourses();
    
    return <CoursesClient 
        initialCourses={courses}
        initialQuizzes={quizzes}
        initialCertRules={certRules}
        initialQuestions={questions}
    />;
}
