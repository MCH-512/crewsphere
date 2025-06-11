
import { z } from "zod";

export const MAX_FILE_SIZE_MB = 15;

export const documentFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters.").max(150),
  category: z.string({ required_error: "Please select a category." }),
  source: z.string({ required_error: "Please select the document source/type." }),
  version: z.string().max(20).optional(),
  content: z.string().max(20000, "Content is too long (max 20,000 chars).").optional(),
  file: z.custom<FileList>().optional()
    .refine((files) => !files || files.length === 0 || files?.[0]?.size <= MAX_FILE_SIZE_MB * 1024 * 1024, 
            `File size should be less than ${MAX_FILE_SIZE_MB}MB.`),
  existingFileUrl: z.string().optional(), // For edit form
  existingFilePath: z.string().optional(), // For edit form
  existingFileName: z.string().optional(), // For edit form
}).superRefine((data, ctx) => {
  // This refine logic works for both create and edit:
  // Create: existingFileUrl will be undefined, so it boils down to needing content OR a new file.
  // Edit: Needs content OR a new file OR an existing file to be valid.
  if (!data.content?.trim() && (!data.file || data.file.length === 0) && !data.existingFileUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Document must have content or a file. Please add content or upload/keep a file.",
      path: ["content"], // Could also point to 'file' or be a general form error
    });
  }
});

export type DocumentFormValues = z.infer<typeof documentFormSchema>;
