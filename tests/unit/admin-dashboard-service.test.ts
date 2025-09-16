import { getAdminDashboardStats } from '@/services/admin-dashboard-service';
import { getCountFromServer } from 'firebase/firestore';

// Mock the entire firebase/firestore module
jest.mock('firebase/firestore', () => ({
  ...jest.requireActual('firebase/firestore'), // import and retain all actual exports
  getCountFromServer: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
}));

// Mock the session user
jest.mock('@/lib/session', () => ({
  getCurrentUser: jest.fn().mockResolvedValue({
    uid: 'admin123',
    role: 'admin',
    email: 'admin@test.com',
  }),
}));

// Type assertion for the mocked function
const mockedGetCountFromServer = getCountFromServer as jest.Mock;

describe('Admin Dashboard Service', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockedGetCountFromServer.mockClear();
  });

  it('returns correct stats structure with zero counts if queries return zero', async () => {
    mockedGetCountFromServer.mockResolvedValue({ data: () => ({ count: 0 }) });

    const result = await getAdminDashboardStats();

    expect(result).toEqual({
      pendingRequests: 0,
      pendingDocValidations: 0,
      newSuggestions: 0,
      pendingSwaps: 0,
      pendingReports: 0,
      activeAlerts: 0,
    });
    expect(mockedGetCountFromServer).toHaveBeenCalledTimes(6);
  });

  it('correctly aggregates counts from multiple queries', async () => {
    // Simulate different counts for each query
    mockedGetCountFromServer
      .mockResolvedValueOnce({ data: () => ({ count: 15 }) }) // pendingRequests
      .mockResolvedValueOnce({ data: () => ({ count: 3 }) })  // pendingDocValidations
      .mockResolvedValueOnce({ data: () => ({ count: 10 }) }) // newSuggestions
      .mockResolvedValueOnce({ data: () => ({ count: 2 }) })  // pendingSwaps
      .mockResolvedValueOnce({ data: () => ({ count: 5 }) })  // pendingReports
      .mockResolvedValueOnce({ data: () => ({ count: 1 }) });// activeAlerts

    const result = await getAdminDashboardStats();

    expect(result).toEqual({
      pendingRequests: 15,
      pendingDocValidations: 3,
      newSuggestions: 10,
      pendingSwaps: 2,
      pendingReports: 5,
      activeAlerts: 1,
    });
    expect(mockedGetCountFromServer).toHaveBeenCalledTimes(6);
  });

  it('handles query failures gracefully by returning zeroed stats', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedGetCountFromServer.mockRejectedValue(new Error('Firestore query failed'));

    const result = await getAdminDashboardStats();
    
    expect(result).toEqual({
      pendingRequests: 0,
      pendingDocValidations: 0,
      newSuggestions: 0,
      pendingSwaps: 0,
      pendingReports: 0,
      activeAlerts: 0,
    });
    
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
