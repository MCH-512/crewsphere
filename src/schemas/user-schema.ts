
import type { VariantProps } from "class-variance-authority";
import { badgeVariants } from "@/components/ui/badge";
import { z } from "zod";

export type SpecificRole = 'admin' | 'purser' | 'cabin crew' | 'instructor' | 'pilote' | 'stagiaire' | 'other';
export type AccountStatus = 'active' | 'inactive';

export const availableRoles: SpecificRole[] = ['admin', 'purser', 'cabin crew', 'instructor', 'pilote', 'stagiaire', 'other'];

// The single source of truth for the User object structure.
export interface User {
  // Fields from Firebase Auth
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;

  // Custom fields from Firestore
  role?: SpecificRole;
  fullName?: string;
  employeeId?: string;
  joiningDate?: string | null;
  accountStatus?: AccountStatus;
  baseAirport?: string; // ICAO code
}

// Zod schema for the user management form
export const manageUserFormSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().optional(), 
  confirmPassword: z.string().optional(), 
  displayName: z.string().min(2, "Display name must be at least 2 characters.").max(50),
  fullName: z.string().min(2, "Full name must be at least 2 characters.").max(100),
  employeeId: z.string().max(50).optional(), 
  joiningDate: z.string().optional().refine(val => val === "" || !val || !isNaN(new Date(val).getTime()), { message: "Invalid date format. Please use YYYY-MM-DD or leave empty."}), 
  baseAirport: z.string().max(4, "Invalid ICAO code").optional(),
  role: z.string().optional(), 
  accountStatus: z.boolean().default(true), 
})
.refine((data) => {
  // Password confirmation is only required if a password is being set
  if (data.password) {
    if (!data.confirmPassword) return false; 
    return data.password === data.confirmPassword;
  }
  return true; 
}, {
  message: "Passwords don't match or confirmation is missing.",
  path: ["confirmPassword"],
})
.superRefine((data, ctx) => {
    // These fields are only truly required for new users, identified by the presence of a password.
    // When editing, they are pre-filled and validated individually by their own rules.
    if (data.password) { 
        if (!data.email || data.email.trim() === "") {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Email is required for new users.", path: ["email"]});
        }
        if (data.password.length < 6) {
           ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Password must be at least 6 characters.", path: ["password"]});
        }
        if (!data.fullName || data.fullName.trim() === "") {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Full name is required for new users.", path: ["fullName"]});
        }
         if (!data.displayName || data.displayName.trim() === "") {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Display name is required for new users.", path: ["displayName"]});
        }
    }
});

export type ManageUserFormValues = z.infer<typeof manageUserFormSchema>;


// UI Helpers
export const getRoleBadgeVariant = (role?: SpecificRole | null): VariantProps<typeof badgeVariants>["variant"] => {
    switch (role) {
      case "admin": return "destructive";
      case "purser": return "default"; 
      case "cabin crew": return "secondary";
      case "instructor": return "default"; 
      case "pilote": return "default";    
      case "stagiaire": return "outline";
      case "other": return "outline";
      default: return "outline";
    }
};

export const getStatusBadgeVariant = (status?: AccountStatus | null): VariantProps<typeof badgeVariants>["variant"] => {
    switch (status) {