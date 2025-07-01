import { z } from 'zod';
import type { Timestamp } from 'firebase/firestore';

export const trainingSessionFormSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters.").max(100),
  location: z.string().min(3, "Location is required.").max(100),
  venue: z.string().min(2, "Venue/Room is required.").max(50),
  instructor: z.string().min(3, "Instructor name is required.").max(100),
  sessionDateTimeUTC: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid session datetime."}),
  durationHours: z.coerce.number().min(0.5, "Duration must be at least 0.5 hours.").max(12),
  notes: z.string().max(1000, "Notes cannot exceed 1000 characters.").optional(),
});

export type TrainingSessionFormValues = z.infer<typeof trainingSessionFormSchema>;

export interface StoredTrainingSession {
  id: string;
  title: string;
  location: string;
  venue: string;
  instructor: string;
  sessionDateTimeUTC: string;
  durationHours: number;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}
