'use server';
/**
 * @fileOverview A Genkit flow that audits a file using an AI model for TypeScript and React Hook Form issues.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';

export const codeAuditFlow = ai.defineFlow(
  {
    name: 'codeAuditFlow',
    inputSchema: z.object({ filePath: z.string() }),
    outputSchema: z.string(),
  },
  async ({ filePath }) => {
    console.log(`🤖 Starting code audit for: ${filePath}`);

    const fullPath = path.resolve(process.cwd(), filePath);
    let fileContent;
    try {
      fileContent = await fs.readFile(fullPath, 'utf-8');
    } catch (err) {
      console.error(`Error reading file at ${fullPath}:`, err);
      return `Error: Could not read the specified file at ${fullPath}.`;
    }

    const prompt = `
      You are an expert software architect specializing in Next.js 14, React, Firebase, and Genkit.
      Your task is to audit the following code file: ${filePath}.

      Please focus on these areas:
      1.  **TypeScript Best Practices**: Identify type errors, "any" types, and opportunities for stricter typing.
      2.  **React Hook Form Issues**: Look for common mistakes in form state management, validation, and submission logic.
      3.  **Next.js 14 Anti-Patterns**: Check for incorrect use of Server/Client components, data fetching in client components, etc.
      4.  **General Code Quality**: Look for code smells, performance bottlenecks, or security vulnerabilities.

      Provide a concise, actionable report in clear Markdown format. If you find issues, suggest specific code changes.

      File Content:
      ---
      ${fileContent}
      ---
    `;

    const llmResponse = await ai.generate({ prompt });
    const responseText = llmResponse.text();

    console.log(`✅ Audit complete for: ${filePath}`);
    return responseText;
  }
);
