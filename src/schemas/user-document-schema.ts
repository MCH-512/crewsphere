
import { z } from "zod";
import type { Timestamp } from 'firebase/firestore';
import { differenceInDays } from "date-fns";
import { CalendarX, CalendarClock, CalendarCheck2 } from "lucide-react";

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

// Define the base object without the refinement.
const baseUserDocumentObject = z.object({
  documentName: z.string().min(3, "Document name is required.").max(100),
  documentType: z.enum(userDocumentTypes, { required_error: "Please select a document type." }),
  issueDate: z.string().refine((val) => val && !isNaN(Date.parse(val)), { message: "Invalid issue date." }),
  expiryDate: z.string().refine((val) => val && !isNaN(Date.parse(val)), { message: "Invalid expiry date." }),
  notes: z.string().max(500).optional(),
});

// The refine function to apply to all schemas that use dates.
const dateRefinement = (data: { expiryDate: string, issueDate: string }) => new Date(data.expiryDate) > new Date(data.issueDate);

// Schema for an Admin editing/creating a document for a user (no file upload)
export const adminUserDocumentFormSchema = baseUserDocumentObject.extend({
  userId: z.string().min(1, "A user must be selected."),
}).refine(dateRefinement, {
    message: "Expiry date must be after the issue date.",
    path: ["expiryDate"],
});
export type AdminUserDocumentFormValues = z.infer<typeof adminUserDocumentFormSchema>;


// A schema for when a user is creating a document for the first time
export const userDocumentCreateFormSchema = baseUserDocumentObject.extend({
    file: fileSchema // File is required on creation
}).refine(dateRefinement, {
    message: "Expiry date must be after the issue date.",
    path: ["expiryDate"],
});

// A schema for when a user is updating a document
export const userDocumentUpdateFormSchema = baseUserDocumentObject.extend({
    file: fileSchema.optional() // File is optional on update
}).refine(dateRefinement, {
    message: "Expiry date must be after the issue date.",
    path: ["expiryDate"],
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


// --- UI Helper Functions ---

/**
 * Determines the status of a user document based on its expiry date and validation status.
 * @param doc The user document object from Firestore.
 * @param warningDays The number of days before expiry to show a warning.
 * @returns The calculated UserDocumentStatus.
 */
export const getDocumentStatus = (doc: StoredUserDocument, warningDays: number): UserDocumentStatus => {
    if (doc.status === 'pending-validation') return 'pending-validation';
    const today = new Date();
    const daysUntilExpiry = differenceInDays(doc.expiryDate.toDate(), today);
    if (daysUntilExpiry < 0) return 'expired';
    if (daysUntilExpiry <= warningDays) return 'expiring-soon';
    return 'approved';
};

/**
 * Configuration for displaying document statuses.
 */
export const statusConfig: Record<UserDocumentStatus, { icon: React.ElementType, color: string, label: string }> = {
    'pending-validation': { icon: CalendarClock, color: "text-blue-600", label: "Pending Validation" },
    expired: { icon: CalendarX, color: "text-destructive", label: "Expired" },
    'expiring-soon': { icon: CalendarClock, color: "text-yellow-600", label: "Expiring Soon" },
    approved: { icon: CalendarCheck2, color: "text-green-600", label: "Approved" },
};

/**
 * Returns the appropriate badge variant for a given document status.
 * @param status The status of the document.
 * @returns The corresponding badge variant.
 */
export const getStatusBadgeVariant = (status: UserDocumentStatus) => {
    if (status === 'approved' || status === 'expiring-soon') return 'success';
    if (status === 'expired') return 'destructive';
    if (status === 'pending-validation') return 'outline';
    return 'secondary';
}
