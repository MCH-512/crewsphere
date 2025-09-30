import "server-only";
import { CoursesClient } from "./courses-client";
import { getCourses } from "@/services/course-service";

export default async function AdminCoursesPage() {
    const { courses, quizzes, certRules, questions } = await getCourses();
    
    return <CoursesClient 
        initialCourses={courses}
        initialQuizzes={quizzes}
        initialCertRules={certRules}
        initialQuestions={questions}
    />;
}
