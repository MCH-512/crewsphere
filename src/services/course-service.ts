
import 'server-only';
import { db, isConfigValid } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import type { StoredCourse, StoredQuiz, StoredCertificateRule } from "@/schemas/course-schema";
import type { StoredQuestion } from "@/schemas/quiz-question-schema";
import { getCurrentUser } from "@/lib/session";
import { z } from 'zod';

const EmptySchema = z.object({});

export async function getCourses() {
    EmptySchema.parse({}); // Zod validation
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin' || !isConfigValid || !db) {
        console.error("Unauthorized or unconfigured attempt to fetch courses.");
        return { courses: [], quizzes: [], certRules: [], questions: [] };
    }

    try {
        const coursesQuery = query(collection(db, "courses"), orderBy("createdAt", "desc"));
        const quizzesQuery = query(collection(db, "quizzes"));
        const certRulesQuery = query(collection(db, "certificateRules"));
        const questionsQuery = query(collection(db, "questions"), orderBy("createdAt", "asc"));

        const [coursesSnapshot, quizzesSnapshot, certRulesSnapshot, questionsSnapshot] = await Promise.all([
            getDocs(coursesQuery),
            getDocs(quizzesQuery),
            getDocs(certRulesQuery),
            getDocs(questionsQuery),
        ]);

        const courses = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredCourse));
        const quizzes = quizzesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredQuiz));
        const certRules = certRulesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredCertificateRule));
        const questions = questionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredQuestion));
        
        return { courses, quizzes, certRules, questions };
    } catch (err) {
        console.error("Error fetching courses data:", err);
        return { courses: [], quizzes: [], certRules: [], questions: [] };
    }
}
