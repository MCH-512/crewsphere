
'use server';
/**
 * @fileOverview An AI flow for generating comprehensive course outlines, including quiz and certificate suggestions.
 *
 * - generateCourseOutline - A function that generates a course outline based on detailed input.
 * - CourseGenerationInput - The input type for the generateCourseOutline function.
 * - CourseGenerationOutput - The return type for the generateCourseOutline function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
// Chapter type from schema is not directly used here, as we define a simplified one for AI generation first.

const GeneratedChapterSchema = z.object({
  id: z.string().optional(), 
  title: z.string().describe("Title of the chapter."),
  description: z.string().describe("A brief overview of this chapter's specific learning objectives and what key topics it covers."),
  content: z.string().describe("Detailed pedagogical content for this chapter, in Markdown format (key points, procedures, examples)."),
});

const CourseGenerationInputSchema = z.object({
  courseTopic: z.string().min(5, "Course topic must be at least 5 characters.").describe("The main topic or subject of the course to be generated."),
  courseCategory: z.string().describe("The primary category of the course (e.g., Safety, CRM, Aircraft Systems)."),
  courseType: z.string().describe("The type of course (e.g., Initial Training, Recurrent Training)."),
  referenceDocuments: z.string().optional().describe("Key reference documents or bodies for the course content (e.g., Operation Manual Part A, EASA regulations)."),
  durationEstimate: z.string().optional().describe("The estimated duration for the entire course (e.g., '2 hours', '1 Day')."),
  targetAudience: z.enum(["Cabin Crew", "Pilot", "Ground Staff", "All Crew", "Other"]).default("All Crew").describe("The primary audience for this course."),
  numberOfChapters: z.coerce.number().int().min(1, "Minimum 1 chapter.").max(10, "Maximum 10 chapters.").default(5).describe("Approximate number of chapters desired."),
  detailLevel: z.enum(["overview", "standard", "detailed"]).default("standard").describe("Level of detail for chapter content."),
});
export type CourseGenerationInput = z.infer<typeof CourseGenerationInputSchema>;

const QuizQuestionSchema = z.object({
    question: z.string().describe("The full text of the quiz question."),
    type: z.enum(["mcq", "tf", "short"]).describe("Question type: Multiple Choice (mcq), True/False (tf), or Short Answer (short)."),
    options: z.array(z.string()).optional().describe("Array of option strings for mcq/tf. For 'tf', should be ['True', 'False']."),
    correctAnswer: z.string().describe("The correct answer text. For mcq, must match one of the options."),
});

const CertificateSettingsSchema = z.object({
    passingScore: z.number().min(0).max(100).describe("Suggested passing score percentage (e.g., 80)."),
    expiryDays: z.number().int().min(0).describe("Suggested certificate validity in days (0 for no expiry)."),
    issuingAuthority: z.string().describe("Suggested text for the certificate issuing authority (e.g., 'AirCrew Hub Training Department')."),
});

const CourseGenerationOutputSchema = z.object({
  courseTitle: z.string().describe("A concise and relevant title for the generated course."),
  suggestedCategory: z.string().describe("A suggested category for this course (e.g., Safety, CRM, Aircraft Systems). This might refine the input category."),
  description: z.string().describe("A brief overview of the course content and objectives."),
  chapters: z.array(GeneratedChapterSchema).describe("An array of generated chapters, each with a title, description, and detailed content."),
  mainQuiz: z.array(QuizQuestionSchema).optional().describe("An array of 3-5 suggested quiz questions with types, options, and answers."),
  certificateSettings: CertificateSettingsSchema.optional().describe("Suggested settings for the course certificate."),
});
export type CourseGenerationOutput = z.infer<typeof CourseGenerationOutputSchema>;


export async function generateCourseOutline(
  input: CourseGenerationInput
): Promise<CourseGenerationOutput> {
  return courseGeneratorFlow(input);
}

const courseGeneratorPrompt = ai.definePrompt({
  name: 'detailedCourseGeneratorPrompt',
  input: {schema: CourseGenerationInputSchema},
  output: {schema: CourseGenerationOutputSchema},
  prompt: `You are an expert instructional designer and Senior Cabin Crew Instructor, specializing in creating comprehensive and engaging training programs for airline personnel, specifically for {{targetAudience}}.
Your task is to generate a detailed course structure based on the provided inputs. The output must be practical, realistic, and ready for an LMS (Learning Management System).

Course Topic/Title Idea: "{{courseTopic}}"
Intended Category: {{courseCategory}}
Intended Type: {{courseType}}
Reference Documents/Body: {{#if referenceDocuments}}{{{referenceDocuments}}}{{else}}Not specified{{/if}}
Estimated Duration: {{#if durationEstimate}}{{{durationEstimate}}}{{else}}Not specified{{/if}}

The course should have approximately {{numberOfChapters}} chapters.
The level of detail for each chapter's content should be: {{detailLevel}}.

Please generate the following in valid JSON format conforming to the output schema:

1.  **courseTitle**: A clear, engaging, and professional title for the course (you may refine the initial courseTopic).
2.  **suggestedCategory**: Re-evaluate the "Intended Category" and confirm or suggest a more appropriate training category (e.g., Safety Equipment, Emergency Procedures, CRM, Aircraft Type Rating, Dangerous Goods, Service Excellence).
3.  **description**: A concise (2-4 sentences) overall description of the course, outlining its main objectives, target audience relevance, and expected learning outcomes.
4.  **chapters**: An array of approximately {{numberOfChapters}} chapters. Each chapter object *must* have:
    *   **title**: A specific and descriptive title for the chapter.
    *   **description**: A brief (1-2 sentences) overview of this chapter's specific learning objectives and what key topics it covers.
    *   **content**: Detailed pedagogical content. This should include key learning points, procedures, best practices, examples, or case studies. Use Markdown for formatting (bullet points, bolding, etc.). If 'detailed', provide substantial content. If 'standard', provide key points and summaries. If 'overview', provide high-level summaries. Focus on practical application and operational relevance for {{targetAudience}}.
5.  **mainQuiz** (Optional but highly recommended): An array of 3-5 sample quiz questions to assess understanding of the core concepts. Each question object should have:
    *   **question**: The full text of the question.
    *   **type**: The question type (must be one of "mcq", "tf", "short").
        *   For "mcq" (Multiple Choice Question): provide 3-4 string \`options\` and a string \`correctAnswer\` (matching one of the options).
        *   For "tf" (True/False): \`options\` should be an array like ["True", "False"], and \`correctAnswer\` is "True" or "False".
        *   For "short" (Short Answer): \`options\` can be omitted or an empty array. \`correctAnswer\` should be a concise example of an acceptable answer.
    *   **options**: An array of strings for MCQ/TF options.
    *   **correctAnswer**: The correct answer string.
6.  **certificateSettings** (Optional): Suggested settings for the course certificate.
    *   **passingScore**: A suggested passing score for the quiz as a number (e.g., 80).
    *   **expiryDays**: Suggested validity period for the certificate in days as a number (e.g., 365 for 1 year, 730 for 2 years, 0 for no expiry).
    *   **issuingAuthority**: Suggested text for the issuing authority as a string (e.g., "AirCrew Hub Training Department").

Example chapter structure:
{
  "title": "Chapter X: Handling In-flight Medical Emergencies",
  "description": "This chapter covers the assessment of medical situations, communication protocols with ground medical support, and the use of onboard medical kits for {{targetAudience}}.",
  "content": "- Initial assessment: DRSABCD protocol.\n- Utilizing MedLink/StatMD: Information to provide.\n- Overview of First Aid Kit (FAK) and Emergency Medical Kit (EMK) contents and usage for common scenarios (e.g., fainting, minor burns, allergic reactions).\n- Documentation and reporting procedures post-incident."
}

Ensure the output is valid JSON and all specified fields are present as described in the output schema.
The chapter content should be operationally relevant and avoid overly academic or theoretical language unless essential for {{targetAudience}}.
Prioritize safety, efficiency, and passenger care in all relevant content.
If generating a quiz, ensure questions cover diverse aspects of the generated chapter content.
`,
});

const courseGeneratorFlow = ai.defineFlow(
  {
    name: 'detailedCourseGeneratorFlow', // Renamed flow for clarity
    inputSchema: CourseGenerationInputSchema,
    outputSchema: CourseGenerationOutputSchema,
  },
  async (input: CourseGenerationInput) => {
    const {output} = await courseGeneratorPrompt(input);
    if (!output) {
      throw new Error("The AI failed to generate a course outline. Please try again or adjust your topic.");
    }
    // Ensure chapters array has IDs for potential future use if we were to display them with keys
    const chaptersWithIds = output.chapters.map((chapter, index) => ({
        ...chapter,
        id: chapter.id || `gen_chapter_${index}_${Date.now()}` 
    }));
    return { ...output, chapters: chaptersWithIds };
  }
);
