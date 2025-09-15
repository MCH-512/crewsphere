
'use server';

/**
 * @fileOverview A service for video generation.
 * This file contains functions for interacting with video generation models.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { GenerateVideoInputSchema, type GenerateVideoInput, GenerateVideoOutputSchema, type GenerateVideoOutput } from '@/schemas/video-schema';
import * as fs from 'fs';
import { Readable } from 'stream';
import type { MediaPart } from 'genkit';


/**
 * Generates a video from a text prompt and/or an image.
 * @param input The input data containing the prompt and optional image.
 * @returns A promise that resolves with the URL of the generated video.
 */
export async function generateVideo(input: GenerateVideoInput): Promise<GenerateVideoOutput> {
  const { operation } = await ai.generate({
    model: googleAI.model('veo-2.0-generate-001'),
    prompt: input.prompt,
    config: {
      durationSeconds: 5,
      aspectRatio: '16:9',
    },
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
  // It is secure to be passed to the client for direct download or display.
  // Note: The key for this URL is NOT the Gemini API key, it's a temporary signature key.
  // It needs to be appended with the actual Gemini API key for download to work.
  const videoUrlWithKey = `${video.media.url}&key=${process.env.GEMINI_API_KEY}`;
  
  return { videoUrl: videoUrlWithKey };
}
