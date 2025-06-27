
import { z } from "zod";
import type { Timestamp } from 'firebase/firestore';

export const suggestionCategories = [
  "Flight Operations",
  "Cabin Service",
  "Training & Development",
  "Crew Well-being",
  "Uniform & Equipment",
  "App & Technology",
  "Other",
] as const;

export const suggestionFormSchema = z.object({
  category: z.enum(suggestionCategories, {
    required_error: "Please select a category for your suggestion.",
  }),
  subject: z.string().min(5, "Subject must be at least 5 characters.").max(100),
  details: z.string().min(20, "Please provide at least 20 characters of detail.").max(2000),
  isAnonymous: z.boolean().default(false),
});

export type SuggestionFormValues = z.infer<typeof suggestionFormSchema>;

export interface StoredSuggestion {
  id: string;
  userId: string;
  userEmail?: string;
  isAnonymous: boolean;
  category: typeof suggestionCategories[number];
  subject: string;
  details: string;
  status: 'new' | 'under-review' | 'planned' | 'implemented' | 'rejected';
  upvotes: string[];
  upvoteCount: number;
  createdAt: Timestamp;
  adminNotes?: string;
}
