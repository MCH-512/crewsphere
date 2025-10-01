
'use server';

/**
 * @fileOverview A service for video generation.
 * This file contains functions for interacting with video generation models.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { GenerateVideoInputSchema, type GenerateVideoInput, type GenerateVideoOutput } from '@/schemas/video-schema';
import { z } from 'zod';


/**
 * Generates a video from a text prompt and/or an image.
 * @param input The input data containing the prompt and optional image.
 * @returns A promise that resolves to the URL of the generated video.
 */
export async function generateVideo(input: GenerateVideoInput): Promise<GenerateVideoOutput> {
  const validatedInput = GenerateVideoInputSchema.parse(input);

  const { operation } = await ai.generate({
    model: googleAI.model('veo-3.0-generate-preview'), // Use the latest Veo 3 model
    prompt: validatedInput.prompt,
    // Config options like durationSeconds and aspectRatio are not needed for Veo 3
  });

  if (!operation) {
    throw new Error('Expected the model to return an operation');
  }

  // Poll for completion
  let finalOperation = operation;
  while (!finalOperation.done) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    finalOperation = await ai.checkOperation(finalOperation);
  }

  if (finalOperation.error) {
    throw new Error('failed to generate video: ' + finalOperation.error.message);
  }

  const video = finalOperation.output?.message?.content.find((p) => !!p.media);
  if (!video || !video.media?.url) {
    throw new Error('Failed to find the generated video in the operation result.');
  }

  // The URL provided by the operation is a temporary, signed URL.
  // The Gemini API key needs to be appended for the download/display to work from the browser.
  const videoUrlWithKey = `${video.media.url}&key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`;
  
  return { videoUrl: videoUrlWithKey };
}
