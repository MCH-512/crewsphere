
import type { User as FirebaseUser } from "firebase/auth";

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
