
import { z } from "zod";
import type { Timestamp } from 'firebase/firestore';

export const MAX_IMAGE_SIZE_MB = 5;

export const postFormSchema = z.object({
  content: z.string().min(1, "Post content cannot be empty.").max(2000, "Post is too long."),
  imageFile: z.custom<FileList>().optional()
    .refine((files) => !files || files.length === 0 || files?.[0]?.size <= MAX_IMAGE_SIZE_MB * 1024 * 1024, 
            `Image size should be less than ${MAX_IMAGE_SIZE_MB}MB.`),
});

export type PostFormValues = z.infer<typeof postFormSchema>;

export interface StoredPost {
  id: string;
  userId: string;
  userDisplayName: string;
  userAvatarUrl: string | null;
  content: string;
  imageUrl?: string;
  createdAt: Timestamp;
  likes: string[]; // Array of user UIDs who liked the post
  likeCount: number;
}
