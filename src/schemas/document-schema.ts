
import { z } from "zod";
import type { Timestamp } from 'firebase/firestore';

export const documentCategories = [
    "Operational Manuals",
    "Safety Procedures",
    "Company Policies",
    "Training Materials",
    "Technical Documentation",
    "Flight Forms",
] as const;

export const documentFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters.").max(100),
  description: z.string().min(10, "Description must be at least 10 characters.").max(500),
  category: z.enum(documentCategories, { required_error: "Please select a category." }),
  version: z.string().min(1, "Version is required.").max(20),
  file: z.any()
    .refine((files) => files?.length === 1, "File is required.")
    .refine((files) => files?.[0]?.size <= 10000000, `Max file size is 10MB.`) // 10MB
    .refine(
      (files) => files?.[0]?.type, // Just check that type exists
      "A valid file type is required."
    ),
});

export const documentEditFormSchema = documentFormSchema.extend({
    file: z.any().optional(), // File is optional when editing
});


export type DocumentFormValues = z.infer<typeof documentFormSchema>;
export type DocumentEditFormValues = z.infer<typeof documentEditFormSchema>;

export interface StoredDocument {
  id: string;
  title: string;
  description: string;
  category: typeof documentCategories[number];
  version: string;
  
  fileURL: string;
  filePath: string; // To find it in storage for deletion
  fileName: string;
  fileType: string;

  uploaderId: string;
  uploaderEmail: string;
  lastUpdated: Timestamp;

  readBy?: string[]; // Array of user UIDs who have acknowledged reading
}
