
import { z } from "zod";
import type { Timestamp } from 'firebase/firestore';
import { questionFormSchema } from "./quiz-question-schema";
import { StoredUserQuizAttempt } from "./user-progress-schema";

export const courseCategories = ["Regulations & Compliance", "Safety & Emergency", "Customer Service", "Technical Knowledge", "Health & First Aid"] as const;
export const courseTypes = ["Initial Training", "Recurrent Training", "Conversion Course", "Refresher"] as const;

// Chapter schema now includes content
export const chapterSchema = z.object({
  title: z.string().min(1, "Chapter title cannot be empty."),
  content: z.string().min(10, "Chapter content must have at least 10 characters.").max(10000, "Chapter content is too long."),
});

export const courseFormSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters.").max(100),
  description: z.string().min(10, "Description must be at least 10 characters.").max(2000),
  category: z.enum(courseCategories),
  courseType: z.enum(courseTypes),
  referenceBody: z.string().max(100).optional(),
  duration: z.string().max(50).optional(),
  mandatory: z.boolean().default(true),
  published: z.boolean().default(false),
  imageHint: z.string().max(100).optional(),
  chapters: z.array(chapterSchema).min(1, "At least one chapter is required."),
  quizTitle: z.string().min(5, "Quiz title is required.").max(150),
  questions: z.array(questionFormSchema).min(1, "At least one quiz question is required."),
  passingThreshold: z.number().min(0).max(100),
  certificateExpiryDays: z.number().min(0),
});

export type CourseFormValues = z.infer<typeof courseFormSchema>;
export type Chapter = z.infer<typeof chapterSchema>;

export interface StoredCourse {
  id: string;
  title: string;
  description: string;
  category: typeof courseCategories[number];
  courseType: typeof courseTypes[number];
  referenceBody?: string;
  duration?: string;
  mandatory: boolean;
  published: boolean;
  imageUrl?: string | null;
  imageHint?: string;
  chapters: Chapter[];
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
  randomizeQuestions?: boolean;
  randomizeAnswers?: boolean;
}

export interface StoredCertificateRule {
  id: string;
  courseId: string;
  passingThreshold: number;
  expiryDurationDays: number; // 0 for no expiry
  signatureTextOrURL?: string;
  createdAt: Timestamp;
}

// AI Image Generation Schemas
export const GenerateCourseImageInputSchema = z.object({
    prompt: z.string().min(3, "Image prompt must be at least 3 characters.").describe("A short hint or topic for the course image, e.g., 'cockpit controls' or 'safety manual'."),
});
export type GenerateCourseImageInput = z.infer<typeof GenerateCourseImageInputSchema>;

export const GenerateCourseImageOutputSchema = z.object({
    imageDataUri: z.string().describe("The generated image as a Base64 encoded data URI."),
});
export type GenerateCourseImageOutput = z.infer<typeof GenerateCourseImageOutputSchema>;

// Progress schema
export interface StoredUserProgress {
    readChapters?: string[];
    lastAttempt?: StoredUserQuizAttempt;
}
