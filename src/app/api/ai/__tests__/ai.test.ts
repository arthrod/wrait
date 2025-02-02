import { AI } from '../ai';
import { AIStateManager } from '../stateManager';
import { APIClient } from '../apiClient';

// Mock fetch
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(global, 'localStorage', { value: mockLocalStorage });

describe('AI Service', () => {
  let ai: AI;
  let stateManager: AIStateManager;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    
    // Reset state manager
    stateManager = AIStateManager.getInstance();
    stateManager.reset();

    // Create new AI instance
    ai = new AI({
      apiEndpoint: 'http://test-api',
      maxRetries: 2,
      retryDelay: 100,
    });
  });

  describe('Request Handling', () => {
    it('should handle successful requests', async () => {
      const mockResponse = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Test response'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockResponse,
        headers: new Headers({
          'X-RateLimit-Remaining': '99',
          'X-RateLimit-Reset': '1234567890',
        }),
      });

      const onUpdate = jest.fn();
      const result = await ai.request(
        {
          messages: [{ role: 'user', content: 'test prompt' }],
        },
        onUpdate
      );

      expect(result).toBe('Test response');
      expect(onUpdate).toHaveBeenCalled();
      expect(stateManager.getState().error).toBeNull();
    });

    it('should handle rate limiting', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limit exceeded'),
        headers: new Headers({
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': '1234567890',
        }),
      });

      const onUpdate = jest.fn();
      await expect(
        ai.request(
          {
            messages: [{ role: 'user', content: 'test prompt' }],
          },
          onUpdate
        )
      ).rejects.toThrow('Rate limit exceeded');

      expect(stateManager.getState().error).toContain('Rate limit exceeded');
      expect(stateManager.getState().rateLimitRemaining).toBe(0);
    });

    it('should retry failed requests', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('Success after retry'));
              controller.close();
            },
          }),
          headers: new Headers(),
        });

      const onUpdate = jest.fn();
      const result = await ai.request(
        {
          messages: [{ role: 'user', content: 'test prompt' }],
        },
        onUpdate
      );

      expect(result).toBe('Success after retry');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Specialized Endpoints', () => {
    it('should handle proofread requests', async () => {
      const mockResponse = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Corrected text'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockResponse,
        headers: new Headers(),
      });

      const apiClient = new APIClient({});
      const result = await apiClient.proofread({
        messages: [{ role: 'user', content: 'test text' }],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/ai/proofread'),
        expect.any(Object)
      );
      expect(result.content).toBe('Corrected text');
    });

    it('should handle complete requests', async () => {
      const mockResponse = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Completed text'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockResponse,
        headers: new Headers(),
      });

      const apiClient = new APIClient({});
      const result = await apiClient.complete({
        messages: [{ role: 'user', content: 'test prompt' }],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/ai/complete'),
        expect.any(Object)
      );
      expect(result.content).toBe('Completed text');
    });
  });

  describe('State Management', () => {
    it('should persist state between requests', async () => {
      const mockResponse = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Test response'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        body: mockResponse,
        headers: new Headers({
          'X-RateLimit-Remaining': '98',
          'X-RateLimit-Reset': '1234567890',
        }),
      });

      const apiClient = new APIClient({});
      await apiClient.request('generate', {
        messages: [{ role: 'user', content: 'test prompt' }],
      });

      const state = stateManager.getState();
      expect(state.requestCount).toBe(1);
      expect(state.rateLimitRemaining).toBe(98);
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should load persisted state', () => {
      const savedState = {
        isLoading: false,
        error: null,
        lastRequest: { timestamp: Date.now(), endpoint: 'generate' },
        requestCount: 5,
        rateLimitRemaining: 95,
        rateLimitReset: 1234567890,
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedState));
      const newStateManager = AIStateManager.getInstance();
      const loadedState = newStateManager.getState();

      expect(loadedState).toEqual(expect.objectContaining(savedState));
    });
  });
});