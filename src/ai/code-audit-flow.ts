'use server';

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { CodeAuditInputSchema, type CodeAuditInput, CodeAuditOutputSchema, type CodeAuditOutput } from '@/schemas/code-audit-schema';
import * as fs from 'node:fs/promises';


/**
 * Analyzes a code file and provides suggestions for improvements.
 * @param input The data containing the file path of the code to be analyzed.
 * @returns A promise that resolves with a summary of the code analysis and suggestions.
 */
export async function codeAuditFlow(input: CodeAuditInput): Promise<CodeAuditOutput> {
    const validatedInput = CodeAuditInputSchema.parse(input);
    return codeAuditFlowInner(validatedInput);
}

const codeAuditFlowInner = ai.defineFlow({
    name: 'codeAuditFlow',
    inputSchema: CodeAuditInputSchema,
    outputSchema: CodeAuditOutputSchema,
}, async (input) => {
    try {
        // Read the file content
        const fileContent = await fs.readFile(input.filePath, 'utf8');
        
        const response = await ai.generate({
            model: googleAI.model('gemini-1.5-flash'),
            prompt: `You are a senior software engineer performing a code audit on the following file. Your goal is to identify potential issues and suggest improvements. Be specific and concise. Format the output as follows:
Summary: [A one-sentence summary of the file's purpose.]
Potential Issues:
- [Specific issue 1 and why it matters]
- [Specific issue 2 and why it matters]
...
Suggestions:
- [Specific suggestion 1 for improvement]
- [Specific suggestion 2 for improvement]
...
Filepath: ${input.filePath}
File Content:
\`\`\`
${fileContent}
\`\`\`
`,
            maxOutputTokens: 2048,
        });

        return { analysisSummary: response.text };
    } catch (error) {
        console.error('Code audit failed:', error);
        return { analysisSummary: `Code audit failed: ${error.message}` };
    }
});
