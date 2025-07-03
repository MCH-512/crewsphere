
import { z } from "zod";
import type { Timestamp } from 'firebase/firestore';

export const questionFormSchema = z.object({
  questionText: z.string().min(10, "Question must be at least 10 characters."),
  options: z.array(z.string().min(1, "Option cannot be empty.")).min(2, "At least two options are required.").max(5, "Maximum of 5 options allowed."),
  correctAnswer: z.string().min(1, "You must select a correct answer."),
}).superRefine((data, ctx) => {
    if (!data.options.includes(data.correctAnswer)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "The correct answer must be one of the provided options.",
            path: ["correctAnswer"],
        });
    }
});


export type QuestionFormValues = z.infer<typeof questionFormSchema>;

export interface StoredQuestion extends QuestionFormValues {
  id: string;
  quizId: string;
  questionType: 'mcq'; // Can be extended later
  createdAt: Timestamp;
}

    

    