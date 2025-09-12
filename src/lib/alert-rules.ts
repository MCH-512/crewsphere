// src/lib/alert-rules.ts

export interface AlertRule {
  threshold: number; // e.g., Number of pending requests
  timeoutHours?: number; // How long until an alert becomes critical
  description: string;
}

export const ALERT_RULES: Record<string, AlertRule> = {
  PENDING_REQUESTS: {
    threshold: 10,
    timeoutHours: 24,
    description: "Triggers when there are too many pending user requests.",
  },
  PENDING_DOC_VALIDATIONS: {
    threshold: 5,
    timeoutHours: 48,
    description: "Triggers when user-submitted documents are awaiting validation for too long.",
  },
  FAILED_SWAPS: {
    threshold: 3,
    description: "Triggers on multiple consecutive failed flight swap attempts.",
  },
};
