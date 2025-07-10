'use server';
import { z } from "zod";

export const manualActivityTypes = ["Standby", "Day Off", "Sick Leave", "Emergency Leave", "Annual Leave"] as const;

export const manualActivityFormSchema = z.object({
    activityType: z.enum(manualActivityTypes, { required_error: "Please select an activity type." }),
    startDate: z.string().refine((val) => val && !isNaN(Date.parse(val)), { message: "Invalid start date." }),
    endDate: z.string().refine((val) => val && !isNaN(Date.parse(val)), { message: "Invalid end date." }),
    comments: z.string().max(200).optional(),
}).refine(data => new Date(data.endDate) >= new Date(data.startDate), {
    message: "End date cannot be before start date.",
    path: ["endDate"],
});

export type ManualActivityFormValues = z.infer<typeof manualActivityFormSchema>;
