
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Note: The explicit startup check for Google AI credentials has been removed
// to allow the application to start even if GOOGLE_API_KEY or ADC are not set.
// However, Genkit flows using Google AI models WILL FAIL at runtime if these
// credentials are not properly configured in your environment.
// Please ensure GOOGLE_API_KEY (or Application Default Credentials like
// GOOGLE_APPLICATION_CREDENTIALS / GCLOUD_PROJECT) is set for Genkit to function.

export const ai = genkit({
  plugins: [googleAI()],
  // Removed model: 'gemini-pro' from here
});
