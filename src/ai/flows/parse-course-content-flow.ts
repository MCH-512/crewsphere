
'use server';
/**
 * @fileOverview An AI flow for parsing raw text from a manual into a structured course content format.
 *
 * - parseCourseContent - A function that takes a block of text and returns a structured array of Chapters.
 * - ParseCourseContentInput - The input type for the parseCourseContent function.
 * - ParseCourseContentOutput - The return type for the parseCourseContent function (an array of Chapter objects).
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { chapterSchema } from '@/schemas/course-schema';


const ParseCourseContentInputSchema = z.object({
  rawText: z.string().describe('A block of text from a manual, with hierarchical numbering (e.g., 4.2, 4.2.1, a)).'),
});
export type ParseCourseContentInput = z.infer<typeof ParseCourseContentInputSchema>;

const ParseCourseContentOutputSchema = z.array(chapterSchema);
export type ParseCourseContentOutput = z.infer<typeof ParseCourseContentOutputSchema>;


export async function parseCourseContent(input: ParseCourseContentInput): Promise<ParseCourseContentOutput> {
  return parseCourseContentFlow(input);
}

const parsingPrompt = ai.definePrompt({
  name: 'courseContentParsingPrompt',
  model: 'googleai/gemini-2.0-flash',
  input: {schema: ParseCourseContentInputSchema},
  output: {schema: ParseCourseContentOutputSchema},
  prompt: `You are an intelligent assistant that parses raw, structured text from a manual into a hierarchical JSON format for a learning management system.
  Analyze the following text and extract the chapters, sections, and sub-sections based on the numbering (e.g., 4.2, 4.2.1, a), b)).

  The input text is:
  ---
  {{rawText}}
  ---

  Follow these rules for parsing:
  1.  Identify headings by their numbering (e.g., "4.2", "4.2.1", "a)", "Note."). These will become the "title" of each chapter or section.
  2.  All text following a heading, until the next heading of the same or higher level, should be considered the "content" for that heading.
  3.  Create a nested JSON structure. A section like "4.2.1" should be a child in the "children" array of the "4.2" section. A list item like "a)" should be a child of the preceding section.
  4.  The output MUST be a JSON array that strictly adheres to the provided Zod schema for an array of Chapters. Each object in the array can have a 'title', 'content', and a 'children' array which contains more chapter objects.
  5.  Clean the titles by removing the leading numbers/letters (e.g., "4.2.1 The aim of the crew briefing" should become "The aim of the crew briefing").
  6.  Combine consecutive paragraphs of content into a single string with newline characters.
  
  Example Input:
  4.2 PREFLIGHT BRIEFING
  4.2.1 General
  Briefing is probably the most important part of any flight preparation.
  a) Document check
  The purser starts by welcoming the crewmembers.
  
  Example JSON Output:
  [
    {
      "title": "PREFLIGHT BRIEFING",
      "children": [
        {
          "title": "General",
          "content": "Briefing is probably the most important part of any flight preparation.",
          "children": [
            {
              "title": "Document check",
              "content": "The purser starts by welcoming the crewmembers."
            }
          ]
        }
      ]
    }
  ]
  `,
});

const parseCourseContentFlow = ai.defineFlow(
  {
    name: 'parseCourseContentFlow',
    inputSchema: ParseCourseContentInputSchema,
    outputSchema: ParseCourseContentOutputSchema,
  },
  async (input) => {
    const {output} = await parsingPrompt(input);
    if (!output) {
      throw new Error("Failed to parse course content from text using AI.");
    }
    return output;
  }
);
