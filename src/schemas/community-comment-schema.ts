
import { z } from "zod";
import type { Timestamp } from 'firebase/firestore';

export const commentFormSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty.").max(1000, "Comment is too long."),
});

export type CommentFormValues = z.infer<typeof commentFormSchema>;

export interface StoredComment {
  id: string;
  postId: string;
  userId: string;
  userDisplayName: string;
  userAvatarUrl: string | null;
  content: string;
  createdAt: Timestamp;
}
