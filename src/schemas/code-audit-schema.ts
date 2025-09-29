import { z } from 'zod';

export const CodeAuditInputSchema = z.object({
  filePath: z.string().min(1, { message: 'Filepath cannot be empty.' }),
});

export const CodeAuditOutputSchema = z.object({
    analysisSummary: z.string(),
});

export type CodeAuditInput = z.infer<typeof CodeAuditInputSchema>;
export type CodeAuditOutput = z.infer<typeof CodeAuditOutputSchema>;
