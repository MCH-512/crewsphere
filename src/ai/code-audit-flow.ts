
'use server';

import { ai } from "@/ai/genkit";
import { defineFlow } from "@genkit-ai/flow";
import { z } from "zod";
import { promises as fs } from 'fs';
import path from 'path';

/**
 * A Genkit flow that audits a file using an AI model.
 */
export const codeAuditFlow = defineFlow(
  {
    name: "codeAuditFlow",
    inputSchema: z.object({ filePath: z.string() }),
    outputSchema: z.string(),
  },
  async ({ filePath }: { filePath: string }) => {
    console.log(`
    🤖 Starting code audit for: ${filePath}
    `);

    const fullPath = path.resolve(process.cwd(), filePath);
    let fileContent;
    try {
        fileContent = await fs.readFile(fullPath, 'utf-8');
    } catch (err) {
        console.error(`Error reading file at ${fullPath}:`, err);
        return "Error: Could not read the specified file.";
    }

    const prompt = `
        As a senior software engineer, please audit the following code file: ${filePath}.

        Please provide a brief, high-level summary of the file's purpose, then identify potential bugs, performance issues, or deviations from standard best practices.
        
        Your response should be concise, actionable, and formatted in clear markdown.

        Here is the file content:
        ---
        ${fileContent}
        ---
    `;

    const llmResponse = await ai.generate({ prompt });
    const responseText = llmResponse.text;

    console.log(`
    ✅ Audit complete for: ${filePath}
    `);

    return responseText;
  }
);
