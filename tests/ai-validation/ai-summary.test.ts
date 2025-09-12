import { summarizeReport } from '@/ai/flows/summarize-report-flow';

// Mock the AI flow
jest.mock('@/ai/flows/summarize-report-flow', () => ({
  summarizeReport: jest.fn(),
}));

const mockedSummarizeReport = summarizeReport as jest.Mock;

describe('AI Report Summarizer Validation', () => {

  beforeEach(() => {
    mockedSummarizeReport.mockClear();
  });

  test('AI should extract key risks and summary from a standard report', async () => {
    const mockResponse = {
      summary: 'The flight was mostly routine, but a passenger medical issue and a minor technical problem with a galley oven were noted.',
      keyPoints: [
        'Passenger in seat 15C reported dizziness.',
        'Galley oven G2 was inoperative.',
        'Crew coordination was excellent during the medical event.',
      ],
      potentialRisks: ['Passenger medical issue', 'Inoperative galley equipment'],
    };
    mockedSummarizeReport.mockResolvedValue(mockResponse);

    const reportText = `
      Flight 123 from DTTA to LFPG. Overall smooth flight. Passenger in 15C felt dizzy mid-flight, 
      oxygen was administered, and they felt better upon landing. Crew handled it well. 
      Also, galley oven G2 was not heating. Maintenance should check it.
    `;
    
    const result = await summarizeReport({ reportContent: reportText });

    expect(result).toBeDefined();
    expect(result.summary).toContain('medical issue');
    expect(result.potentialRisks).toContain('Passenger medical issue');
    expect(result.keyPoints.length).toBeGreaterThan(0);
  });

  test('AI should return empty arrays for risks and key points if none are found', async () => {
     const mockResponse = {
      summary: 'A completely uneventful and smooth flight with no issues to report.',
      keyPoints: [],
      potentialRisks: [],
    };
    mockedSummarizeReport.mockResolvedValue(mockResponse);
    
    const reportText = "Everything was perfect. The flight was smooth, service went well, and there were no issues at all.";
    
    const result = await summarizeReport({ reportContent: reportText });

    expect(result).toBeDefined();
    expect(result.summary).toContain('uneventful');
    expect(result.keyPoints).toHaveLength(0);
    expect(result.potentialRisks).toHaveLength(0);
  });

});
