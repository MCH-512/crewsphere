
import { z } from "zod";
import type { Timestamp } from 'firebase/firestore';

export const userDocumentTypes = [
    "Medical Certificate",
    "Pilot License",
    "Cabin Crew Attestation",
    "Passport",
    "Visa",
    "Company ID",
    "Recurrent Training",
    "Specific Qualification",
    "Other"
] as const;

export const userDocumentStatuses = [ "approved", "pending-validation", "expired", "expiring-soon" ] as const;
export type UserDocumentStatus = typeof userDocumentStatuses[number];


const fileSchema = z.any()
    .refine((files) => files?.length > 0, "File is required.")
    .refine((files) => files?.[0]?.size <= 5000000, `Max file size is 5MB.`)
    .refine(
      (files) => ["image/jpeg", "image/png", "application/pdf"].includes(files?.[0]?.type),
      "Only .jpg, .png, and .pdf formats are supported."
    );

export const baseUserDocumentFormSchema = z.object({
  documentName: z.string().min(3, "Document name is required.").max(100),
  documentType: z.enum(userDocumentTypes, { required_error: "Please select a document type." }),
  issueDate: z.string().refine((val) => val && !isNaN(Date.parse(val)), { message: "Invalid issue date." }),
  expiryDate: z.string().refine((val) => val && !isNaN(Date.parse(val)), { message: "Invalid expiry date." }),
  notes: z.string().max(500).optional(),
}).refine(data => new Date(data.expiryDate) > new Date(data.issueDate), {
    message: "Expiry date must be after the issue date.",
    path: ["expiryDate"],
});

// Schema for an Admin editing/creating a document for a user (no file upload)
export const adminUserDocumentFormSchema = baseUserDocumentFormSchema.extend({
  userId: z.string().min(1, "A user must be selected."),
});
export type AdminUserDocumentFormValues = z.infer<typeof adminUserDocumentFormSchema>;


// A schema for when a user is creating a document for the first time
export const userDocumentCreateFormSchema = baseUserDocumentFormSchema.extend({
    file: fileSchema // File is required on creation
});

// A schema for when a user is updating a document
export const userDocumentUpdateFormSchema = baseUserDocumentFormSchema.extend({
    file: fileSchema.optional() // File is optional on update
});


export type UserDocumentFormValues = z.infer<typeof userDocumentCreateFormSchema>;

export interface StoredUserDocument {
  id: string;
  userId: string;
  userEmail: string;
  documentName: string;
  documentType: typeof userDocumentTypes[number];
  issueDate: Timestamp;
  expiryDate: Timestamp;
  notes?: string;
  fileURL?: string;
  filePath?: string;
  status: 'approved' | 'pending-validation'; // Simplified from UserDocumentStatus for storage logic
  lastUpdatedAt: Timestamp;
  createdAt: Timestamp;
  adminLastUpdatedBy?: string; 
}
