
import { z } from "zod";
import { Timestamp } from 'firebase/firestore';

export const userRequestSchema = z.object({
  userId: z.string(),
  requestType: z.string(),
  status: z.enum(['pending', 'approved', 'rejected']),
  createdAt: z.custom<Timestamp>((val) => val instanceof Timestamp),
});

export type UserRequest = z.infer<typeof userRequestSchema>;

export interface StoredUserRequest extends UserRequest {
  id: string;
}
