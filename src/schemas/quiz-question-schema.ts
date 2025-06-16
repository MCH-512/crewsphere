
import { z } from "zod";

export const questionTypes = ["mcq", "tf", "short"] as const;
export type QuestionType = typeof questionTypes[number];

export const questionOptionSchema = z.object({
  id: z.string().optional(), // For key in UI
  text: z.string().min(1, "Option text cannot be empty."),
});
export type QuestionOption = z.infer<typeof questionOptionSchema>;

export const questionFormSchema = z.object({
  questionText: z.string().min(5, "Question text must be at least 5 characters."),
  questionType: z.enum(questionTypes, { required_error: "Please select a question type." }),
  options: z.array(questionOptionSchema).optional(),
  correctAnswer: z.string().min(1, "Correct answer cannot be empty."),
  // For MCQ, correctAnswer will be the text of one of the options.
  // For TF, correctAnswer will be "True" or "False".
  // For Short, correctAnswer will be the expected answer string.
});

export type QuestionFormValues = z.infer<typeof questionFormSchema>;

export const defaultQuestionOptionValue: QuestionOption = { text: "" };

export const defaultQuestionFormValues: Partial<QuestionFormValues> = {
  questionText: "",
  questionType: "mcq",
  options: [{ text: "" }, { text: "" }], // Default to 2 options for MCQ
  correctAnswer: "",
};

// Schema for Firestore document (includes quizId and timestamps)
export const storedQuestionSchema = questionFormSchema.extend({
  quizId: z.string(),
  createdAt: z.custom<FirebaseFirestore.Timestamp>((val) => val instanceof Object && 'toDate' in val && typeof val.toDate === 'function'), // For reading
  updatedAt: z.custom<FirebaseFirestore.Timestamp>((val) => val instanceof Object && 'toDate' in val && typeof val.toDate === 'function'), // For reading
});

export type StoredQuestion = z.infer<typeof storedQuestionSchema>;
