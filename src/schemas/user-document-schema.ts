
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

export const userDocumentFormSchema = z.object({
  documentName: z.string().min(3, "Document name is required.").max(100),
  documentType: z.enum(userDocumentTypes, { required_error: "Please select a document type." }),
  issueDate: z.string().refine((val) => val && !isNaN(Date.parse(val)), { message: "Invalid issue date." }),
  expiryDate: z.string().refine((val) => val && !isNaN(Date.parse(val)), { message: "Invalid expiry date." }),
  notes: z.string().max(500).optional(),
  file: fileSchema.optional(), // Make it optional initially
}).refine(data => new Date(data.expiryDate) > new Date(data.issueDate), {
    message: "Expiry date must be after the issue date.",
    path: ["expiryDate"],
}).superRefine((data, ctx) => {
    // In creation mode, file is required. We can't check if we're in edit mode here,
    // so this check must happen in the component logic or by using separate schemas.
    // For a single schema, we can make it optional and check `documentToEdit` in the component.
});

// A slightly different schema for when a user is creating a document for the first time
export const userDocumentCreateFormSchema = userDocumentFormSchema.extend({
    file: fileSchema // File is required on creation
});

// A slightly different schema for when a user is updating a document
export const userDocumentUpdateFormSchema = userDocumentFormSchema.extend({
    file: fileSchema.optional() // File is optional on update
});


export type UserDocumentFormValues = z.infer<typeof userDocumentFormSchema>;

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
  status: UserDocumentStatus;
  lastUpdatedAt: Timestamp;
  // adminLastUpdatedBy is now optional as users can update
  adminLastUpdatedBy?: string; 
}