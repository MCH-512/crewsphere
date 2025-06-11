
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";

export interface AuditLogData {
  userId: string;
  userEmail?: string;
  actionType: string; // e.g., "CREATE_ALERT", "UPDATE_USER_ROLE"
  entityType?: string; // e.g., "ALERT", "USER"
  entityId?: string; // ID of the document/entity affected
  details?: string | object; // Summary or specific data related to the action
}

interface AuditLogEntry extends AuditLogData {
  timestamp: Timestamp;
}

/**
 * Logs an audit event to Firestore.
 * @param logData The data for the audit log entry.
 */
export async function logAuditEvent(logData: AuditLogData): Promise<void> {
  try {
    const logEntry: AuditLogEntry = {
      ...logData,
      timestamp: serverTimestamp() as Timestamp, // Will be replaced by server
    };
    await addDoc(collection(db, "auditLogs"), logEntry);
  } catch (error) {
    console.error("Error logging audit event:", error);
    // Depending on requirements, you might want to handle this error more gracefully
    // or re-throw it if it's critical that audit logs are always saved.
    // For now, we'll log it to the console.
  }
}
