
'use server';
/**
 * @fileOverview An AI flow for parsing raw text into a structured quiz question.
 *
 * - parseQuestionFromText - A function that takes a block of text and returns a structured question object.
 * - ParseQuestionInput - The input type for the parseQuestionFromText function.
 * - ParseQuestionOutput - The return type for the parseQuestionFromText function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { questionOptionSchema } from '@/schemas/quiz-question-schema';


const ParseQuestionInputSchema = z.object({
  rawText: z.string().describe('A block of text containing a single quiz question, its options (e.g., A, B, C, D), and the indicated correct answer.'),
});
export type ParseQuestionInput = z.infer<typeof ParseQuestionInputSchema>;


const ParseQuestionOutputSchema = z.object({
  questionText: z.string().describe('The main text of the question.'),
  questionType: z.enum(['mcq']).default('mcq').describe('The type of question, should be "mcq".'),
  options: z.array(questionOptionSchema).describe('An array of all possible options for the question.'),
  correctAnswer: z.string().describe('The full text of the correct answer.'),
});
export type ParseQuestionOutput = z.infer<typeof ParseQuestionOutputSchema>;


export async function parseQuestionFromText(input: ParseQuestionInput): Promise<ParseQuestionOutput> {
  return parseQuestionFlow(input);
}

const parsingPrompt = ai.definePrompt({
  name: 'questionParsingPrompt',
  input: {schema: ParseQuestionInputSchema},
  output: {schema: ParseQuestionOutputSchema},
  prompt: `You are an intelligent assistant that parses raw text into a structured quiz question format.
  Analyze the following text and extract the question, the multiple-choice options, and the correct answer.

  The input text is:
  ---
  {{rawText}}
  ---

  Follow these rules for parsing:
  1. The question is the first part of the text, before the options start.
  2. The options are typically prefixed with letters like A., B., C., or similar. Extract the full text for each option, but do not include the letter prefix (e.g., 'A. ').
  3. The correct answer is indicated by a marker like '✅ Correct answer:'. Extract the full text of the correct answer.
  4. The question type should always be 'mcq'.
  5. Structure the output exactly according to the provided JSON schema. Ensure the 'options' field is an array of objects, each with a 'text' key.
  
  Example Input:
  In case of a lithium-ion battery fire, which equipment is most appropriate?
  A. Life vest
  B. Water extinguisher
  C. Emergency blanket
  D. Halon extinguisher + containment bag (if available)
  ✅ Correct answer: D. Halon extinguisher + containment bag (if available)

  Example JSON Output:
  {
    "questionText": "In case of a lithium-ion battery fire, which equipment is most appropriate?",
    "questionType": "mcq",
    "options": [
      { "text": "Life vest" },
      { "text": "Water extinguisher" },
      { "text": "Emergency blanket" },
      { "text": "Halon extinguisher + containment bag (if available)" }
    ],
    "correctAnswer": "Halon extinguisher + containment bag (if available)"
  }
  `,
});

const parseQuestionFlow = ai.defineFlow(
  {
    name: 'parseQuestionFlow',
    inputSchema: ParseQuestionInputSchema,
    outputSchema: ParseQuestionOutputSchema,
  },
  async (input) => {
    const {output} = await parsingPrompt(input);
    if (!output) {
      throw new Error("Failed to parse question from text using AI.");
    }
    return output;
  }
);
