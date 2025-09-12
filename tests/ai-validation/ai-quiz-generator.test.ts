import { generateQuizFromContent } from '@/ai/flows/generate-quiz-flow';

// Mock the AI flow to return predictable data and avoid actual API calls
jest.mock('@/ai/flows/generate-quiz-flow', () => ({
  generateQuizFromContent: jest.fn(),
}));

const mockedGenerateQuiz = generateQuizFromContent as jest.Mock;

describe('AI Quiz Generator Validation', () => {

  beforeEach(() => {
    mockedGenerateQuiz.mockClear();
  });

  test('AI should generate valid multiple-choice questions with correct structure', async () => {
    const mockResponse = {
      questions: [
        {
          questionText: 'What is the primary purpose of the sterile flight deck rule?',
          options: [
            'To ensure pilots can eat without interruption',
            'To minimize distractions during critical phases of flight',
            'To practice silent communication',
            'To save fuel by reducing chatter'
          ],
          correctAnswer: 'To minimize distractions during critical phases of flight',
        },
        {
          questionText: 'What does "Mayday" signify?',
          options: [
            'A request for weather information',
            'A minor technical issue',
            'A life-threatening emergency',
            'The end of a flight duty period'
          ],
          correctAnswer: 'A life-threatening emergency',
        },
      ],
    };
    mockedGenerateQuiz.mockResolvedValue(mockResponse);

    const manualText = `
      The sterile flight deck rule is a regulation that prohibits non-essential conversations 
      and activities in the cockpit during critical phases of flight, typically below 10,000 feet. 
      The term "Mayday" is the international distress signal indicating a life-threatening emergency.
    `;

    const result = await generateQuizFromContent({
        courseTitle: 'Critical Communications',
        courseContent: manualText,
        questionCount: 2,
    });

    expect(result).toBeDefined();
    expect(result.questions).toHaveLength(2);
    
    // Validate the structure of the first question
    const firstQuestion = result.questions[0];
    expect(firstQuestion).toHaveProperty('questionText');
    expect(firstQuestion).toHaveProperty('options');
    expect(firstQuestion).toHaveProperty('correctAnswer');
    expect(firstQuestion.options).toHaveLength(4);
    expect(firstQuestion.options).toContain(firstQuestion.correctAnswer);
  });

  test('AI should return an empty array if no questions can be generated', async () => {
    mockedGenerateQuiz.mockResolvedValue({ questions: [] });
    
    const result = await generateQuizFromContent({
        courseTitle: 'Empty Course',
        courseContent: 'This is an empty course with no substantial content.',
        questionCount: 5
    });

    expect(result).toBeDefined();
    expect(result.questions).toEqual([]);
  });

});
