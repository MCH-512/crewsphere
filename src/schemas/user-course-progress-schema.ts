
import { z } from "zod";
import { Timestamp } from 'firebase/firestore';

export const userCourseProgressSchema = z.object({
  userId: z.string(),
  courseId: z.string(),
  status: z.enum(['not-started', 'in-progress', 'completed']),
  lastActivity: z.custom<Timestamp>((val) => val instanceof Timestamp),
});

export type UserCourseProgress = z.infer<typeof userCourseProgressSchema>;

export interface StoredUserCourseProgress extends UserCourseProgress {
  id: string;
}
