import { db, isConfigValid } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";

export type ActionType = 
    | "CREATE_USER" | "UPDATE_USER" | "DELETE_USER"
    | "CREATE_ALERT" | "UPDATE_ALERT" | "DELETE_ALERT"
    | "CREATE_COURSE" | "UPDATE_COURSE" | "DELETE_COURSE"
    | "CREATE_DOCUMENT" | "UPDATE_DOCUMENT" | "DELETE_DOCUMENT" | "ACKNOWLEDGE_DOCUMENT"
    | "APPROVE_USER_DOCUMENT" | "CREATE_SELF_DOCUMENT" | "UPDATE_SELF_DOCUMENT" | "DELETE_USER_DOCUMENT"
    | "CREATE_FLIGHT" | "UPDATE_FLIGHT" | "DELETE_FLIGHT"
    | "CREATE_RECURRING_FLIGHTS"
    | "APPROVE_FLIGHT_SWAP" | "REJECT_FLIGHT_SWAP" | "POST_FLIGHT_SWAP" | "REQUEST_FLIGHT_SWAP" | "CANCEL_FLIGHT_SWAP"
    | "SUBMIT_PURSER_REPORT" | "UPDATE_REPORT_STATUS" | "UPDATE_REPORT_NOTES"
    | "CREATE_REQUEST" | "UPDATE_REQUEST_STATUS"
    | "CREATE_SUGGESTION" | "UPDATE_SUGGESTION"
    | "CREATE_TRAINING_SESSION" | "UPDATE_TRAINING_SESSION" | "DELETE_TRAINING_SESSION"
    | "UPDATE_SYSTEM_SETTINGS"
    | "COMPLETE_QUIZ"
    | "CREATE_MANUAL_ACTIVITY"
    | "SUBMIT_SUGGESTION"; // Added for weekly trends

export interface AuditLogData {
  userId: string;
  userEmail?: string;
  actionType: ActionType;
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
  if (!isConfigValid || !db) {
    console.warn("Audit log skipped: Firebase not configured.", logData);
    return;
  }
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
