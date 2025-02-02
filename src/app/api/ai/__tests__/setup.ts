// Mock fetch globally
global.fetch = jest.fn();

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn(),
  removeItem: jest.fn(),
  key: jest.fn(),
  length: 0,
};

Object.defineProperty(global, 'localStorage', { value: mockLocalStorage });

// Mock ReadableStream if not available in test environment
if (typeof ReadableStream === 'undefined') {
  (global as any).ReadableStream = class MockReadableStream {
    constructor(public source: any) {}
  };
}

// Mock TextEncoder if not available in test environment
if (typeof TextEncoder === 'undefined') {
  (global as any).TextEncoder = class MockTextEncoder {
    encode(text: string) {
      return Buffer.from(text);
    }
  };
}

// Mock TextDecoder if not available in test environment
if (typeof TextDecoder === 'undefined') {
  (global as any).TextDecoder = class MockTextDecoder {
    decode(buffer: Buffer) {
      return buffer.toString();
    }
  };
}

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  mockLocalStorage.getItem.mockReset();
  mockLocalStorage.setItem.mockReset();
  mockLocalStorage.clear.mockReset();
  mockLocalStorage.removeItem.mockReset();
  mockLocalStorage.key.mockReset();
});