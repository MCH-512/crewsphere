
import { z } from "zod";
import type { Timestamp } from 'firebase/firestore';
import type { User } from "@/contexts/auth-context";

export const communityPostFormSchema = z.object({
  content: z.string().min(1, "Post cannot be empty.").max(1000, "Post cannot exceed 1000 characters."),
});

export type CommunityPostFormValues = z.infer<typeof communityPostFormSchema>;

export interface StoredCommunityPost {
  id: string;
  content: string;
  authorId: string;
  authorName?: string | null; // Make optional to handle old data
  authorEmail?: string | null; // Add for fallback
  authorRole: User['role'];
  authorPhotoURL?: string | null;
  createdAt: Timestamp;
  likes: string[]; // Array of user UIDs who liked the post
  likeCount: number;
}

    