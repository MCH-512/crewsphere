'use server';
/**
 * @fileOverview A service for generating audio from text.
 * This file contains functions for interacting with Text-to-Speech (TTS) models.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { GenerateAudioInputSchema, type GenerateAudioInput, GenerateAudioOutputSchema, type GenerateAudioOutput } from '@/schemas/video-schema';
import wav from 'wav';


/**
 * Generates an audio file from a given text prompt and voice configuration.
 * @param input The data containing the prompt text and desired voice.
 * @returns A promise that resolves with the data URI of the generated WAV audio file.
 */
export async function generateAudio(input: GenerateAudioInput): Promise<GenerateAudioOutput> {
  const { media } = await ai.generate({
    model: googleAI.model('gemini-2.5-flash-preview-tts'),
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: input.voice },
        },
      },
    },
    prompt: input.prompt,
  });

  if (!media) {
    throw new Error('Audio generation failed to return valid media.');
  }

  const audioBuffer = Buffer.from(media.url.substring(media.url.indexOf(',') + 1), 'base64');
  
  const wavDataUri = 'data:audio/wav;base64,' + (await toWav(audioBuffer));

  return { audioUrl: wavDataUri };
}


/**
 * Converts raw PCM audio data into a Base64 encoded WAV format.
 * @param pcmData The raw PCM audio buffer.
 * @param channels Number of audio channels.
 * @param rate Sample rate.
 * @param sampleWidth Sample width in bytes.
 * @returns A promise that resolves to the Base64 encoded WAV string.
 */
async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    const bufs: any[] = [];
    writer.on('error', reject);
    writer.on('data', (d) => bufs.push(d));
    writer.on('end', () => resolve(Buffer.concat(bufs).toString('base64')));

    writer.write(pcmData);
    writer.end();
  });
}
