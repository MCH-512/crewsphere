
import { z } from "zod";

// Schemas for sub-documents
export const mcqOptionSchema = z.object({
  text: z.string().min(1, "Option text cannot be empty."),
  isCorrect: z.boolean().default(false),
});

export const moduleSchema = z.object({
  id: z.string().optional(), // For identifying existing modules during edit
  moduleTitle: z.string().min(3, "Module title is required and must be at least 3 characters."),
  moduleObjectives: z.string().min(10, "Module objectives are required and must be at least 10 characters."),
});

export const questionSchema = z.object({
  id: z.string().optional(), // For identifying existing questions during edit
  text: z.string().min(5, "Question text must be at least 5 characters."),
  questionType: z.enum(["mcq", "tf", "short"], { required_error: "Please select a question type." }),
  options: z.array(mcqOptionSchema).optional(),
  correctAnswerBoolean: z.boolean().optional(),
  correctAnswerText: z.string().optional(),
  weight: z.coerce.number().min(1, "Weight must be at least 1.").default(1),
});

// Main Course Form Schema (Unified for Create and Edit)
export const courseFormSchema = z.object({
  // Course Details
  title: z.string().min(5, "Title must be at least 5 characters.").max(150),
  category: z.string({ required_error: "Please select a course category." }),
  courseType: z.string({ required_error: "Please select a course type." }),
  referenceBody: z.string().optional(),
  description: z.string().min(10, "Description must be at least 10 characters.").max(1000),
  duration: z.string({ required_error: "Please select an estimated duration." }),
  mandatory: z.boolean().default(false),
  associatedFile: z.custom<FileList>().optional(),
  imageHint: z.string().max(50).optional().describe("Keywords for course image (e.g., emergency exit)"),
  existingFileUrl: z.string().optional(), // For edit page to show current file and handle replacement logic

  // Course Modules
  modules: z.array(moduleSchema).optional(),

  // Quiz Details
  quizTitle: z.string().min(5, "Quiz Title must be at least 5 characters.").max(100),
  questions: z.array(questionSchema).min(1, "At least one question is required for the quiz."),
  randomizeQuestions: z.boolean().default(false),
  randomizeAnswers: z.boolean().default(false),

  // Certification Rules
  passingThreshold: z.coerce.number().min(0).max(100, "Threshold must be between 0 and 100.").default(80),
  certificateExpiryDays: z.coerce.number().int().min(0, "Expiry days must be 0 or more (0 for no expiry).").default(365),
  certificateLogoUrl: z.string().url("Must be a valid URL or leave empty.").optional().or(z.literal("")),
  certificateSignature: z.string().min(2, "Signature text/URL is required.").default("Express Airline Training Department"),
});

export type CourseFormValues = z.infer<typeof courseFormSchema>;

// Default values for array fields
export const defaultModuleValue: Omit<z.infer<typeof moduleSchema>, 'id'> = { // Ensure id is not part of default value if it's truly optional only for existing
  moduleTitle: "",
  moduleObjectives: "",
};

export const defaultQuestionValue: Omit<z.infer<typeof questionSchema>, 'id'> = {
  text: "",
  questionType: "mcq",
  options: [{ text: "", isCorrect: false }, { text: "", isCorrect: false }],
  weight: 1,
};

// Default values for the entire form
export const defaultValues: Partial<CourseFormValues> = {
  title: "",
  category: "",
  courseType: "Initial Training",
  referenceBody: "",
  description: "",
  duration: "1 hour",
  mandatory: false,
  imageHint: "",
  existingFileUrl: "", // Initialize for consistency, used by edit page
  modules: [defaultModuleValue], // Start with one default module
  quizTitle: "",
  questions: [defaultQuestionValue], // Start with one default question
  randomizeQuestions: false,
  randomizeAnswers: false,
  passingThreshold: 80,
  certificateExpiryDays: 365,
  certificateLogoUrl: "https://placehold.co/150x50.png",
  certificateSignature: "Express Airline Training Department",
};
