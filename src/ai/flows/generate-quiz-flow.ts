
'use server';
/**
 * @fileOverview An AI flow to generate quiz questions from course content.
 *
 * - generateQuizFromContent - A function that takes course content and generates a set of multiple-choice questions.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Define the schema for individual questions in the output
const QuizQuestionSchema = z.object({
  questionText: z.string().describe('The text of the multiple-choice question.'),
  options: z.array(z.string()).length(4).describe('An array of exactly four string options for the question.'),
  correctAnswer: z.string().describe('The correct answer, which must be one of the provided options.'),
});

// Define the input schema for the flow
const GenerateQuizInputSchema = z.object({
  courseTitle: z.string().describe('The title of the course.'),
  courseContent: z.string().describe('The full text content of the course, including all chapters.'),
  questionCount: z.number().int().min(1).max(10).describe('The number of questions to generate.'),
});
export type GenerateQuizInput = z.infer<typeof GenerateQuizInputSchema>;

// Define the output schema for the flow
const GenerateQuizOutputSchema = z.object({
  questions: z.array(QuizQuestionSchema).describe('An array of generated quiz questions.'),
});
export type GenerateQuizOutput = z.infer<typeof GenerateQuizOutputSchema>;


/**
 * Generates a quiz based on the provided course content.
 * @param input The course title, content, and desired number of questions.
 * @returns A promise that resolves to the generated quiz questions.
 */
export async function generateQuizFromContent(input: GenerateQuizInput): Promise<GenerateQuizOutput> {
  return generateQuizFlow(input);
}


// Define the Genkit prompt
const quizGenerationPrompt = ai.definePrompt({
  name: 'quizGenerationPrompt',
  model: 'googleai/gemini-1.5-flash-latest',
  input: { schema: GenerateQuizInputSchema },
  output: { schema: GenerateQuizOutputSchema },
  prompt: `You are an expert instructional designer specializing in creating effective quiz questions for the aviation industry.
Your task is to generate a set of multiple-choice questions based on the provided course content.

Course Title: {{{courseTitle}}}

Rules:
1. Generate exactly {{{questionCount}}} multiple-choice questions.
2. Each question must have exactly four options.
3. The correct answer must be one of the four options.
4. The questions should be relevant, clear, and test understanding of the key concepts in the content.
5. Ensure the incorrect options (distractors) are plausible but clearly wrong based on the provided text.
6. Do not ask questions about the document structure (e.g., "Which section...") unless the content is specifically about that structure. Focus on the substance of the material.

Course Content:
---
{{{courseContent}}}
---
`,
});

// Define the Genkit flow
const generateQuizFlow = ai.defineFlow(
  {
    name: 'generateQuizFlow',
    inputSchema: GenerateQuizInputSchema,
    outputSchema: GenerateQuizOutputSchema,
  },
  async (input) => {
    const { output } = await quizGenerationPrompt(input);
    if (!output) {
      throw new Error('The AI model did not return a valid quiz structure.');
    }
    return output;
  }
);
