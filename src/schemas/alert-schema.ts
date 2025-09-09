
import { z } from "zod";
import type { Timestamp } from 'firebase/firestore';

export const alertTypes = ["info", "warning", "critical"] as const;
export const alertAudiences = ["all", "admin", "purser", "cabin crew", "instructor", "pilote", "stagiaire"] as const;

export const alertFormSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters.").max(100),
  message: z.string().min(10, "Message must be at least 10 characters.").max(1000),
  type: z.enum(alertTypes, { required_error: "Please select an alert type." }),
  targetAudience: z.enum(alertAudiences, { required_error: "Please select a target audience." }),
  isActive: z.boolean().default(true),
});

export type AlertFormValues = z.infer<typeof alertFormSchema>;

export interface StoredAlert {
  id: string;
  title: string;
  message: string;
  type: typeof alertTypes[number];
  targetAudience: typeof alertAudiences[number];
  isActive: boolean;
  createdBy: string; // Admin's user ID
  creatorEmail: string; // Admin's email
  createdAt: Timestamp;
}
