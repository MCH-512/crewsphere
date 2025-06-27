
/**
 * @fileOverview Centralized Genkit initialization.
 * This file initializes the main `ai` object with the Google AI plugin.
 * This `ai` object is then used throughout the application to define flows, prompts, etc.
 */
'use server';

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Initialize and export the AI object.
// All flows and tools should import and use this `ai` object.
export const ai = genkit({
  plugins: [googleAI()],
});
