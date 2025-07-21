
import { z } from "zod";
import type { Timestamp } from 'firebase/firestore';

export const trainingSessionFormSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters.").max(100),
  description: z.string().min(10, "Description must be at least 10 characters.").max(1000),
  location: z.string().min(3, "Location is required.").max(100),
  sessionDateTimeUTC: z.string().refine((val) => val && !isNaN(Date.parse(val)), { message: "Invalid session date/time." }),
  
  // Replaced attendeeIds with role-specific arrays
  purserIds: z.array(z.string()).optional(),
  pilotIds: z.array(z.string()).optional(),
  cabinCrewIds: z.array(z.string()).optional(),
  instructorIds: z.array(z.string()).optional(),
  traineeIds: z.array(z.string()).optional(),
}).refine(data => 
    (data.purserIds?.length || 0) + 
    (data.pilotIds?.length || 0) + 
    (data.cabinCrewIds?.length || 0) + 
    (data.instructorIds?.length || 0) + 
    (data.traineeIds?.length || 0) > 0, 
{
    message: "At least one attendee must be assigned.",
    path: ["purserIds"], // Or any other field, just need a path
});


export type TrainingSessionFormValues = z.infer<typeof trainingSessionFormSchema>;

export interface StoredTrainingSession {
  id: string;
  title: string;
  description: string;
  location: string;
  sessionDateTimeUTC: Timestamp; // Changed from string to Timestamp
  attendeeIds: string[]; // Still stored as a single array in Firestore
  createdBy: string; // Admin's UID
  createdAt: Timestamp;
  updatedAt: Timestamp;
  activityIds?: Record<string, string>; // Maps userId -> activityId
}

    

    
