/**
 * @fileOverview Centralized Genkit initialization.
 * This file initializes the main `ai` object with the Google AI plugin.
 * This `ai` object is then used throughout the application to define flows, prompts, etc.
 */

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Initialize and export the AI object.
// Telemetry providers that use dynamic require() are disabled by default
// to ensure compatibility with Next.js.
export const ai = genkit({
  plugins: [googleAI()],
});
