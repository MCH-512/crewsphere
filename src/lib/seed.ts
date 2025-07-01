
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
        { title: "Compliance Statement" },
        { title: "Structure du manuel" },
        { title: "Liste des pages en vigueur (LOEP)" },
        { title: "Liste de distribution" },
        { title: "Enregistrement des révisions normales/temporaires" },
        { title: "Contrôle du manuel (mise à jour, versions, numérotation)" },
        { title: "Feedback et suggestions (formulaires et voies de transmission)" },
        { title: "Réunions, bulletins et conventions éditoriales" },
    ] as Omit<Chapter, 'id'>[],
    questions: [
        { questionText: "Quelle section du manuel décrit la structure du document ?", options: ["Section 1.1", "Section 1.2", "Section 1.3"], correctAnswer: "Section 1.2" },
        { questionText: "Comment identifier une page mise à jour dans la 'List of Effective Pages' ?", options: ["Par la couleur", "Par la date et le numéro de révision", "Par un symbole spécial"], correctAnswer: "Par la date et le numéro de révision" },
        { questionText: "Qui est responsable de la distribution du manuel aux équipages ?", options: ["Le commandant de bord", "Le service administratif de l’opérateur", "Chaque équipier individuellement"], correctAnswer: "Le service administratif de l’opérateur" },
        { questionText: "Quelle est la différence entre une révision normale et temporaire ?", options: ["La couleur du papier", "Une révision normale est planifiée, une temporaire est urgente", "Il n'y a pas de différence"], correctAnswer: "Une révision normale est planifiée, une temporaire est urgente" },
        { questionText: "Quel document enregistre les feedbacks ou suggestions concernant le manuel ?", options: ["Le journal de bord", "Section 1.8 (Feedback and Suggestions)", "Uniquement par email"], correctAnswer: "Section 1.8 (Feedback and Suggestions)" },
        { questionText: "Quelles conventions éditoriales sont utilisées dans le manuel ?", options: ["Style libre", "Police, format, symboles standardisés", "Uniquement des images"], correctAnswer: "Police, format, symboles standardisés" },
        { questionText: "Comment les bulletins opérationnels sont-ils diffusés aux équipages ?", options: ["Par courrier postal", "Uniquement oralement", "Par email ou affichage interne"], correctAnswer: "Par email ou affichage interne" },
        { questionText: "Quels documents sont associés à la gestion administrative du manuel ?", options: ["Factures", "Fiches de révision, formulaires de feedback", "Contrats de travail"], correctAnswer: "Fiches de révision, formulaires de feedback" },
        { questionText: "Quel est le rôle des réunions dans la mise à jour du manuel ?", options: ["Planifier les vacances", "Discuter des mises à jour ou des incidents", "Organiser des fêtes"], correctAnswer: "Discuter des mises à jour ou des incidents" },
        { questionText: "Quels éléments doivent être vérifiés lors d’une inspection du manuel ?", options: ["La couverture du manuel", "Validité des pages, présence des révisions, accessibilité", "Le poids du manuel"], correctAnswer: "Validité des pages, présence des révisions, accessibilité" },
    ] as { questionText: string; options: string[], correctAnswer: string }[]
};

export async function seedInitialCourses() {
    if (!isConfigValid || !db) {
        const message = "Seeding failed. Firebase is not configured. Please check your .env file.";
        console.error(message);
        return { success: false, message: message };
    }

    const coursesRef = collection(db, "courses");
    const q = query(coursesRef, where("title", "==", courseData.title));
    const existingCourse = await getDocs(q);

    if (!existingCourse.empty) {
        console.log("Course already exists. Seeding skipped.");
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
            category: courseData.category,
            options: question.options,
            correctAnswer: question.correctAnswer,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    });

    await batch.commit();

    console.log("Initial course seeded successfully.");
    return { success: true, message: `Successfully seeded the course "${courseData.title}" and its ${courseData.questions.length} questions.`, courseTitle: courseData.title };
}
