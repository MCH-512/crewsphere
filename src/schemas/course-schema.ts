
import { z } from "zod";
import type { Timestamp } from 'firebase/firestore';
import { questionFormSchema } from "./quiz-question-schema";

export const courseCategories = [
    "Safety & Emergency Procedures (SEP)",
    "Customer Service & Hospitality",
    "Aviation Regulations & Compliance",
    "First Aid & Medical Training",
    "Security Procedures",
    "Aircraft Specific Training",
    "Human Factors & CRM",
    "Company Policies & Procedures",
] as const;

export const courseTypes = [
    "Initial Training",
    "Recurrent Training",
    "Conversion Course",
    "Refresher Course",
    "Specialized Training",
] as const;


export const chapterSchema = z.object({
  title: z.string().min(1, "Chapter title cannot be empty."),
});

export const courseFormSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters.").max(100),
  description: z.string().min(20, "Description must be at least 20 characters.").max(2000),
  category: z.enum(courseCategories, { required_error: "Please select a category." }),
  courseType: z.enum(courseTypes, { required_error: "Please select a course type." }),
  referenceBody: z.string().max(100).optional(),
  duration: z.string().min(3, "Please provide an estimated duration.").max(50),
  mandatory: z.boolean().default(true),
  published: z.boolean().default(false),
  imageHint: z.string().max(50).optional(),
  
  // Nested schemas
  chapters: z.array(chapterSchema).min(1, "At least one chapter is required."),
  quizTitle: z.string().min(5, "Quiz title must be at least 5 characters."),
  passingThreshold: z.number().min(0).max(100).default(80),
  certificateExpiryDays: z.number().min(0).default(365),
  questions: z.array(questionFormSchema).min(1, "At least one quiz question is required."),
});

export type CourseFormValues = z.infer<typeof courseFormSchema>;
export type Chapter = z.infer<typeof chapterSchema> & { id: string };

export interface StoredCourse {
  id: string;
  title: string;
  description: string;
  category: typeof courseCategories[number];
  courseType: typeof courseTypes[number];
  referenceBody?: string;
  duration: string;
  mandatory: boolean;
  published: boolean;
  imageHint?: string;
  chapters: Omit<Chapter, 'id'>[];
  quizId: string;
  certificateRuleId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StoredQuiz {
    id: string;
    courseId: string;
    title: string;
    createdAt: Timestamp;
}

export interface StoredCertificateRule {
    id: string;
    courseId: string;
    passingThreshold: number;
    expiryDurationDays: number;
    createdAt: Timestamp;
}

    