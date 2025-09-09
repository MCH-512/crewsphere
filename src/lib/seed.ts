'use server';

import { collection, getDocs, query, where, writeBatch, doc, serverTimestamp } from "firebase/firestore";
import { db, isConfigValid } from "./firebase";
import { type Chapter } from "@/schemas/course-schema";
import { type StoredQuestion } from "@/schemas/quiz-question-schema";

const courseData = {
    title: "Administration et Contrôle du Manuel Opérationnel",
    description: "Ce cours initie les PNC à la structure du Manuel Opérationnel (OMA) et à son cycle de gestion : révisions, distribution, feedback, et mise à jour. L’objectif est de garantir que chaque équipier comprenne comment exploiter le manuel comme outil central de conformité réglementaire et opérationnelle.\n\nObjectifs pédagogiques:\n- Comprendre la structure générale du manuel et son mode de révision.\n- Identifier les processus de distribution, de feedback et de mise à jour.\n- Savoir exploiter les documents associés (listes, fiches, formulaires).",
    category: "Regulations & Compliance",
    courseType: "Initial Training",
    referenceBody: "Operation Manual",
    duration: "2 hours",
    mandatory: true,
    published: true,
    imageHint: "manual book",
    quizTitle: "Quiz : Administration et Contrôle du Manuel",
    passingThreshold: 80,
    certificateExpiryDays: 365,
    certificateSignature: "AirCrew Hub Training Department",
    chapters: [
        { title: "Compliance Statement", content: "This chapter confirms that the manual complies with all applicable national and international regulations, serving as the primary reference for operational procedures." },
        { title: "Structure du manuel", content: "Details the organization of the manual into parts (OMA, OMB, OMC, OMD), chapters, and sections, allowing for quick and logical access to information." },
        { title: "Liste des pages en vigueur (LOEP)", content: "The List of Effective Pages (LOEP) ensures that all manual holders have the most current version of each page. It must be checked after every revision." },
        { title: "Liste de distribution", content: "Defines who holds controlled copies of the manual, both physically and digitally, to ensure updates are disseminated correctly." },
        { title: "Enregistrement des révisions normales/temporaires", content: "A log where all revisions, whether planned (normal) or urgent (temporary), are recorded by the manual holder to confirm their manual is up-to-date." },
        { title: "Contrôle du manuel (mise à jour, versions, numérotation)", content: "Outlines the procedures for version control, page numbering, and how to properly insert and remove revised pages to maintain manual integrity." },
        { title: "Feedback et suggestions (formulaires et voies de transmission)", content: "Describes the official channels and forms for crew members to submit feedback or suggest improvements to the manual, fostering a proactive safety culture." },
        { title: "Réunions, bulletins et conventions éditoriales", content: "Explains how operational information is communicated through meetings and bulletins, and defines the standard editorial conventions used for clarity and consistency." },
    ] as Omit<Chapter, 'id'>[],
    questions: [
        { questionText: "Quelle section du manuel décrit la structure du document ?", options: ["Section 1.1", "Section 1.2", "Section 1.3", "Section 1.4"], correctAnswer: "Section 1.2" },
        { questionText: "Comment identifier une page mise à jour dans la 'List of Effective Pages' ?", options: ["Par la couleur", "Par la date et le numéro de révision", "Par un symbole spécial", "Par la taille de la police"], correctAnswer: "Par la date et le numéro de révision" },
        { questionText: "Qui est responsable de la distribution du manuel aux équipages ?", options: ["Le commandant de bord", "Le service administratif de l’opérateur", "Chaque équipier individuellement", "Le chef de cabine"], correctAnswer: "Le service administratif de l’opérateur" },
        { questionText: "Quelle est la différence entre une révision normale et temporaire ?", options: ["La couleur du papier", "Une révision normale est planifiée, une temporaire est urgente", "Il n'y a pas de différence", "La révision temporaire n'est pas documentée"], correctAnswer: "Une révision normale est planifiée, une temporaire est urgente" },
        { questionText: "Quel document enregistre les feedbacks ou suggestions concernant le manuel ?", options: ["Le journal de bord", "Section 1.8 (Feedback and Suggestions)", "Uniquement par email", "Le rapport de vol"], correctAnswer: "Section 1.8 (Feedback and Suggestions)" },
    ] as { questionText: string; options: string[], correctAnswer: string }[]
};

export async function seedInitialCourses(): Promise<{ success: boolean; message: string; courseTitle?: string }> {
    if (!isConfigValid || !db) {
        const message = "Seeding failed. Firebase is not configured. Please check your .env file.";
        console.error(message);
        return { success: false, message: message };
    }

    const coursesRef = collection(db, "courses");
    const q = query(coursesRef, where("title", "==", courseData.title));
    const existingCourse = await getDocs(q);

    if (!existingCourse.empty) {
        return { success: false, message: `Course "${courseData.title}" already exists. Seeding was skipped.` };
    }

    const batch = writeBatch(db);

    const courseRef = doc(collection(db, "courses"));
    const quizRef = doc(collection(db, "quizzes"));
    const certRuleRef = doc(collection(db, "certificateRules"));

    batch.set(courseRef, {
        title: courseData.title,
        category: courseData.category,
        courseType: courseData.courseType,
        referenceBody: courseData.referenceBody,
        description: courseData.description,
        duration: courseData.duration,
        mandatory: courseData.mandatory,
        published: courseData.published,
        imageHint: courseData.imageHint,
        chapters: courseData.chapters,
        quizId: quizRef.id,
        certificateRuleId: certRuleRef.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    batch.set(quizRef, {
        courseId: courseRef.id,
        title: courseData.quizTitle,
        randomizeQuestions: true,
        randomizeAnswers: true,
        createdAt: serverTimestamp(),
    });

    batch.set(certRuleRef, {
        courseId: courseRef.id,
        passingThreshold: courseData.passingThreshold,
        expiryDurationDays: courseData.certificateExpiryDays,
        signatureTextOrURL: courseData.certificateSignature,
        createdAt: serverTimestamp(),
    });

    courseData.questions.forEach(question => {
        const questionRef = doc(collection(db, "questions"));
        batch.set(questionRef, {
            questionText: question.questionText,
            questionType: "mcq",
            quizId: quizRef.id,
            category: courseData.category,
            options: question.options,
            correctAnswer: question.correctAnswer,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    });

    await batch.commit();
    
    return { success: true, message: `Successfully seeded the course "${courseData.title}" and its ${courseData.questions.length} questions.`, courseTitle: courseData.title };
}
