
import { configureGenkit } from '@genkit-ai/core';
import { googleAI } from '@genkit-ai/googleai';
import { defineFlow } from '@genkit-ai/flow';
import { z } from 'zod';

configureGenkit({
  plugins: [
    googleAI(),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});

export const translateFlow = defineFlow(
  {
    name: 'translateFlow',
    inputSchema: z.object({
      text: z.string(),
      targetLanguage: z.string(),
    }),
    outputSchema: z.string(),
  },
  async (input) => {
    const { text, targetLanguage } = input;

    const llm = googleAI.model('gemini-1.5-flash');
    const prompt = `Translate the following text to ${targetLanguage}: ${text}`;
    const result = await llm.generate({
        prompt: prompt
    });

    return result.text();
  }
);
