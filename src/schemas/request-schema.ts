import { z } from "zod";
import type { Timestamp } from 'firebase/firestore';
import type { VariantProps } from "class-variance-authority";
import { badgeVariants } from "@/components/ui/badge";
import { alertVariants } from "@/components/ui/alert";

export const requestCategoriesAndTypes = {
  "Roster & Availability": [
    "Roster change request",
    "Temporary unavailability (exam, pregnancy, etc.)",
    "Flight swap between colleagues",
    "Request for exceptional day off",
    "Roster error reporting",
    "Positioning flight or deadhead request"
  ],
  "Leave & Absences": [
    "Annual leave request",
    "Sick leave request",
    "Maternity/Paternity leave",
    "Unplanned absence – urgent notice",
    "Special leave request (bereavement, wedding, etc.)",
    "Rest days tracking"
  ],
  "Human Resources": [
    "Update of personal data",
    "HR complaint or conflict",
    "Follow-up on individual interview",
    "Request for administrative letter (certificate, etc.)",
    "Bank details change",
    "Unfair treatment complaint"
  ],
  "Training & Qualifications": [
    "Enrollment in a training session",
    "Issue with license validity",
    "Training postponement or cancellation",
    "Access issue with e-learning platform",
    "Equivalency or exemption request",
    "Training/exam result complaint"
  ],
  "Uniform & Equipment": [
    "Uniform order or replacement",
    "Size issue or uniform defect report",
    "Lost or stolen equipment",
    "Replenishment of allocated items",
    "Problem with service shoes",
    "Uniform delivery delay"
  ],
  "Payroll & Compensation": [
    "Salary calculation request",
    "Missing or incorrect flight allowance",
    "Payslip clarification request",
    "Unreceived daily allowances",
    "Travel expense reimbursement issue",
    "Request for adjustment (flown hours, standby, etc.)"
  ],
  "Mobility & Special Assignments": [
    "Application for special assignment (event, VIP flight...)",
    "Voluntary transfer to another base",
    "Temporary mission request",
    "Interest in Cabin Crew Ambassador Program",
    "Temporary transfer request",
    "Post-assignment feedback"
  ],
  "App Access & Technical Issues": [
    "Crew app login issue",
    "Roster display bug",
    "Access denied to some features",
    "Schedule synchronization error",
    "E-learning portal issue",
    "Password reset / 2FA problem"
  ],
  "Meetings & Support": [
    "Request meeting with manager",
    "Need for emotional or psychological support",
    "Request for mediation or support session",
    "Follow-up after difficult flight",
    "Request for coaching or mentoring",
    "Feedback group participation"
  ]
};

export const requestCategoryKeys = Object.keys(requestCategoriesAndTypes) as (keyof typeof requestCategoriesAndTypes)[];
export const allRequestCategories = [...requestCategoryKeys, "General Inquiry", "Other"];

export const requestFormSchema = z.object({
  requestCategory: z.string({ required_error: "Please select a request category." }),
  specificRequestType: z.string().optional(),
  urgencyLevel: z.enum(["Low", "Medium", "High", "Critical"], { required_error: "Please select an urgency level." }),
  subject: z.string().max(100, { message: "Subject must not be longer than 100 characters." }).optional(),
  details: z.string().min(10, "Details must be at least 10 characters.").max(1000, "Details must not be longer than 1000 characters."),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
}).superRefine((data, ctx) => {
  const categoryHasSpecificTypes = data.requestCategory in requestCategoriesAndTypes;
  
  if (categoryHasSpecificTypes && (!data.specificRequestType || data.specificRequestType.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please select a specific request type for this category.",
      path: ["specificRequestType"],
    });
  }

  if (!categoryHasSpecificTypes && (!data.subject || data.subject.trim() === "" || data.subject.length < 5)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Subject is required and must be at least 5 characters.",
        path: ["subject"],
      });
  }

  if (data.requestCategory === "Leave & Absences") {
    if (!data.startDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Start date is required for leave requests.", path: ["startDate"] });
    }
    if (!data.endDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "End date is required for leave requests.", path: ["endDate"] });
    }
    if (data.startDate && data.endDate && new Date(data.endDate) < new Date(data.startDate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "End date cannot be before start date.", path: ["endDate"] });
    }
  }
});

export type RequestFormValues = z.infer<typeof requestFormSchema>;

export const requestStatuses = ["pending", "in-progress", "approved", "rejected"] as const;
export type RequestStatus = typeof requestStatuses[number];

export const urgencyLevels: { level: RequestFormValues["urgencyLevel"]; description: string }[] = [
    { level: "Low", description: "Standard, non-urgent request." },
    { level: "Medium", description: "Requires attention in the next few days." },
    { level: "High", description: "Urgent, requires prompt attention." },
    { level: "Critical", description: "Immediate, flight-impacting issue." },
];

export interface StoredUserRequest {
  id: string;
  userId: string;
  userEmail: string;
  requestType: string;
  specificRequestType?: string | null;
  urgencyLevel: "Low" | "Medium" | "High" | "Critical";
  subject: string;
  details: string;
  createdAt: Timestamp;
  status: RequestStatus;
  adminResponse?: string;
  updatedAt?: Timestamp;
  startDate?: string;
  endDate?: string;
}


// UI Helpers
export const getStatusBadgeVariant = (status: RequestStatus): VariantProps<typeof badgeVariants>["variant"] => {
    switch (status) {
      case "pending": return "secondary";
      case "approved": return "success";
      case "rejected": return "destructive";
      case "in-progress": return "outline";
      default: return "secondary";
    }
};

export const getUrgencyBadgeVariant = (level: StoredUserRequest["urgencyLevel"]): VariantProps<typeof badgeVariants>["variant"] => {
    switch (level) {
      case "Critical": return "destructive";
      case "High": return "default";
      case "Medium": return "secondary";
      case "Low": return "outline";
      default: return "outline";
    }
};

export const getAdminResponseAlertVariant = (status: RequestStatus): VariantProps<typeof alertVariants>["variant"] => {
    switch (status) {
      case "approved": return "success";
      case "rejected": return "destructive";
      default: return "default";
    }
};
