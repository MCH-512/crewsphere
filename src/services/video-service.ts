'use server';

/**
 * @fileOverview Un service pour la génération de vidéos.
 * Ce fichier contient les fonctions pour interagir avec les modèles de génération de vidéo.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { GenerateVideoInputSchema, type GenerateVideoInput, GenerateVideoOutputSchema, type GenerateVideoOutput } from '@/schemas/video-schema';
import * as fs from 'fs';
import { Readable } from 'stream';
import type { MediaPart } from 'genkit';


/**
 * Génère une vidéo à partir d'un prompt texte et/ou d'une image.
 * @param input Les données d'entrée contenant le prompt et l'image optionnelle.
 * @returns Une promesse qui se résout avec l'URL de la vidéo générée.
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
  // It is secure to be passed to the client for direct download.
  return { videoUrl: video.media.url };
}
