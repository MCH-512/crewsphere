
import { z } from "zod";
import type { Timestamp } from 'firebase/firestore';

export const userQuizAttemptSchema = z.object({
  userId: z.string(),
  courseId: z.string(),
  quizId: z.string(),
  score: z.number(),
  status: z.enum(['passed', 'failed']),
  completedAt: z.instanceof(Timestamp),
  answers: z.record(z.string(), z.string()), // questionId -> userAnswer
});

export type UserQuizAttempt = z.infer<typeof userQuizAttemptSchema>;

export interface StoredUserQuizAttempt extends UserQuizAttempt {
  id: string;
}

    