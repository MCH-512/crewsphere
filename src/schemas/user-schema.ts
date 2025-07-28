
import type { User as FirebaseUser } from "firebase/auth";
import type { VariantProps } from "class-variance-authority";
import { badgeVariants } from "@/components/ui/badge";

export type SpecificRole = 'admin' | 'purser' | 'cabin crew' | 'instructor' | 'pilote' | 'stagiaire' | 'other' | null;
export type AccountStatus = 'active' | 'inactive';


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
}


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
        case "active": return "success";
        case "inactive": return "destructive";
        default: return "outline";
    }
};
