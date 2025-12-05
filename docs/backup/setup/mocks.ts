// src/__tests__/setup/mocks.ts
// Mock external services for testing

/**
 * Mock Azure Storage Gateway
 * 
 * Use this in tests to avoid real Azure Storage calls
 */
export const mockAzureStorageGateway = {
  uploadFile: jest.fn().mockResolvedValue({
    url: 'https://mock-storage.azure.com/file.jpg',
    signedUrl: 'https://mock-storage.azure.com/file.jpg?signature=mock',
  }),
  deleteFile: jest.fn().mockResolvedValue(undefined),
  generateSignedUrl: jest.fn().mockResolvedValue('https://mock-storage.azure.com/file.jpg?signature=mock'),
  getFile: jest.fn().mockResolvedValue(Buffer.from('mock-file-data')),
};

/**
 * Mock OpenAI Provider
 * 
 * Use this in tests to avoid real OpenAI API calls
 */
export const mockOpenAIProvider = {
  generateResponse: jest.fn().mockResolvedValue({
    content: 'Mock AI response',
    model: 'gpt-4',
    usage: {
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    },
  }),
  createAssistant: jest.fn().mockResolvedValue({
    assistantId: 'mock-assistant-id',
    threadId: 'mock-thread-id',
  }),
};

/**
 * Mock Anthropic Provider
 */
export const mockAnthropicProvider = {
  generateResponse: jest.fn().mockResolvedValue({
    content: 'Mock Claude response',
    model: 'claude-3-opus',
    usage: {
      inputTokens: 10,
      outputTokens: 5,
    },
  }),
};

/**
 * Setup mocks for external services
 * 
 * Call this in beforeAll() of your test suite
 */
export function setupExternalServiceMocks() {
  // Mock Azure Storage
  jest.mock('../../storage/azureStorageGateway', () => ({
    AzureStorageGateway: jest.fn().mockImplementation(() => mockAzureStorageGateway),
  }));
  
  // Mock AI Providers (if needed)
  jest.mock('../../../ai/aiGateway/src/providers/openai-provider', () => ({
    OpenAIProvider: jest.fn().mockImplementation(() => mockOpenAIProvider),
  }));
  
  jest.mock('../../../ai/aiGateway/src/providers/anthropic-provider', () => ({
    AnthropicProvider: jest.fn().mockImplementation(() => mockAnthropicProvider),
  }));
}

/**
 * Reset all mocks
 * 
 * Call this in beforeEach() to reset mock call history
 */
export function resetExternalServiceMocks() {
  Object.values(mockAzureStorageGateway).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockClear();
    }
  });
  
  Object.values(mockOpenAIProvider).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockClear();
    }
  });
  
  Object.values(mockAnthropicProvider).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockClear();
    }
  });
}

