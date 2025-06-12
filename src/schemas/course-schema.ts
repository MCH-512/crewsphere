
import { z } from "zod";

// Schemas for sub-documents
export const resourceSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["pdf", "image", "video", "link", "file"], { required_error: "Resource type is required."}).default("file"),
  url: z.string().min(1, "Resource URL or path cannot be empty."),
  filename: z.string().optional().describe("Original filename for uploaded files"),
});

export type Resource = z.infer<typeof resourceSchema>;

// Chapter schema with recursive definition for children
const baseChapterSchema = z.object({
  id: z.string().optional(), // For existing chapters during edit
  title: z.string().min(1, "Chapter/Section title cannot be empty."),
  content: z.string().optional().describe("HTML or Markdown content for this chapter/section."),
  resources: z.array(resourceSchema).optional(),
});

type ChapterSchemaType = z.infer<typeof baseChapterSchema> & {
  children?: ChapterSchemaType[];
};

export const chapterSchema: z.ZodType<ChapterSchemaType> = baseChapterSchema.extend({
  children: z.lazy(() => chapterSchema.array()).optional(),
});

export type Chapter = z.infer<typeof chapterSchema>;

// Main Course Form Schema
export const courseFormSchema = z.object({
  // Course Details
  title: z.string().min(5, "Title must be at least 5 characters.").max(150),
  category: z.string({ required_error: "Please select a course category." }),
  courseType: z.string({ required_error: "Please select a course type." }),
  referenceBody: z.string().optional(),
  description: z.string().min(10, "Description must be at least 10 characters.").max(1000),
  duration: z.string({ required_error: "Please select an estimated duration." }),
  mandatory: z.boolean().default(false),
  associatedFile: z.custom<FileList>().optional().describe("Main course file like a global PDF if any."), // This might be deprecated if resources per chapter cover all needs.
  imageHint: z.string().max(50).optional().describe("Keywords for course image (e.g., emergency exit)"),
  existingFileUrl: z.string().optional(), // For edit form, if `associatedFile` is kept.

  // Hierarchical Chapters/Content Structure
  chapters: z.array(chapterSchema).min(1, "Course must have at least one chapter."),

  // Quiz title (quiz questions will be AI generated later or managed separately)
  quizTitle: z.string().min(5, "Quiz Title must be at least 5 characters.").max(100),
  randomizeQuestions: z.boolean().default(false).describe("AI generated quiz - randomize question order?"),
  randomizeAnswers: z.boolean().default(false).describe("AI generated quiz - randomize MCQ answer order?"),

  // Certification Rules
  passingThreshold: z.coerce.number().min(0).max(100, "Threshold must be between 0 and 100.").default(80),
  certificateExpiryDays: z.coerce.number().int().min(0, "Expiry days must be 0 or more (0 for no expiry).").default(365),
  certificateLogoUrl: z.string().url("Must be a valid URL or leave empty.").optional().or(z.literal("")),
  certificateSignature: z.string().min(2, "Signature text/URL is required.").default("Express Airline Training Department"),
});

export type CourseFormValues = z.infer<typeof courseFormSchema>;

// Default values for array fields
export const defaultResourceValue: Resource = {
  type: "file",
  url: "",
  filename: "",
};

export const defaultChapterValue: Chapter = { // Ensure it matches Chapter type
  title: "",
  content: "",
  resources: [],
  children: [],
};

// Default values for the entire form
export const defaultValues: CourseFormValues = {
  title: "",
  category: "",
  courseType: "Initial Training",
  referenceBody: "",
  description: "",
  duration: "1 hour",
  mandatory: false,
  imageHint: "",
  existingFileUrl: "",
  associatedFile: undefined, // Make sure to initialize optional fields for react-hook-form
  chapters: [defaultChapterValue],
  quizTitle: "Final Assessment",
  randomizeQuestions: false,
  randomizeAnswers: false,
  passingThreshold: 80,
  certificateExpiryDays: 365,
  certificateLogoUrl: "https://placehold.co/150x50.png",
  certificateSignature: "Express Airline Training Department",
};
