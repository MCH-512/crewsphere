
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

export const userDocumentFormSchema = z.object({
  userId: z.string().min(1, "A user must be selected."),
  documentName: z.string().min(3, "Document name is required.").max(100),
  documentType: z.enum(userDocumentTypes, { required_error: "Please select a document type." }),
  issueDate: z.string().refine((val) => val && !isNaN(Date.parse(val)), { message: "Invalid issue date." }),
  expiryDate: z.string().refine((val) => val && !isNaN(Date.parse(val)), { message: "Invalid expiry date." }),
  notes: z.string().max(500).optional(),
}).refine(data => new Date(data.expiryDate) > new Date(data.issueDate), {
    message: "Expiry date must be after the issue date.",
    path: ["expiryDate"],
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
  lastUpdatedAt: Timestamp;
  adminLastUpdatedBy: string; // UID of admin
}
