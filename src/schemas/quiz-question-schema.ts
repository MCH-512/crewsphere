
import { z } from "zod";
import { Timestamp } from "firebase/firestore";

export const questionTypes = ["mcq", "tf", "short"] as const;
export type QuestionType = typeof questionTypes[number];

export const questionOptionSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1, "Option text cannot be empty."),
});
export type QuestionOption = z.infer<typeof questionOptionSchema>;

export const questionFormSchema = z.object({
  id: z.string().optional(),
  quizId: z.string().optional(),
  questionText: z.string().min(5, "Question text must be at least 5 characters."),
  questionType: z.enum(questionTypes, { required_error: "Please select a question type." }),
  options: z.array(questionOptionSchema).optional(),
  correctAnswer: z.string().min(1, "Correct answer cannot be empty."),
});

export type QuestionFormValues = z.infer<typeof questionFormSchema>;

export const defaultQuestionOptionValue: QuestionOption = { text: "" };

export const defaultQuestionFormValues: Partial<QuestionFormValues> = {
  questionText: "",
  questionType: "mcq",
  options: [{ text: "" }, { text: "" }],
  correctAnswer: "",
};

// Schema for Firestore document (includes timestamps)
export const storedQuestionSchema = questionFormSchema.extend({
  quizId: z.string(),
  createdAt: z.custom<Timestamp>((val) => val instanceof Timestamp),
  updatedAt: z.custom<Timestamp>((val) => val instanceof Timestamp),
});

export type StoredQuestion = z.infer<typeof storedQuestionSchema> & { id: string };
