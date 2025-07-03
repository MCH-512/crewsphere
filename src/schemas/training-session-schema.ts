
import { z } from "zod";
import type { Timestamp } from 'firebase/firestore';

export const trainingSessionFormSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters.").max(100),
  description: z.string().min(10, "Description must be at least 10 characters.").max(1000),
  location: z.string().min(3, "Location is required.").max(100),
  sessionDateTimeUTC: z.string().refine((val) => val && !isNaN(Date.parse(val)), { message: "Invalid session date/time." }),
  attendeeIds: z.array(z.string()).min(1, "At least one attendee must be assigned."),
});

export type TrainingSessionFormValues = z.infer<typeof trainingSessionFormSchema>;

export interface StoredTrainingSession extends TrainingSessionFormValues {
  id: string;
  createdBy: string; // Admin's UID
  createdAt: Timestamp;
  updatedAt: Timestamp;
  activityIds?: Record<string, string>; // Maps userId -> activityId
}
