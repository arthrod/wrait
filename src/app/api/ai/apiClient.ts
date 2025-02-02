import { AIConfig, AIRequestParams, AIResponse, StreamingOptions } from './types';
import { AIStateManager } from './stateManager';

export class APIClient {
  private readonly apiEndpoint: string;
  private readonly apiKey?: string;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly stateManager: AIStateManager;

  constructor(config: AIConfig) {
    this.apiEndpoint = config.apiEndpoint || 'http://127.0.0.1:5002';
    this.apiKey = config.apiKey;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
    this.stateManager = AIStateManager.getInstance();
  }

  private async handleResponse(response: Response): Promise<AIResponse> {
    // Update rate limit info from headers
    this.stateManager.updateRateLimits(response.headers);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    return { content: await response.text() };
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    endpoint: string,
    retryCount = 0
  ): Promise<T> {
    if (!this.stateManager.canMakeRequest()) {
      const { resetTime } = this.stateManager.getRateLimitInfo();
      throw new Error(`Rate limit exceeded. Try again after ${resetTime?.toLocaleString()}`);
    }

    try {
      this.stateManager.startRequest(endpoint);
      return await operation();
    } catch (error: any) {
      this.stateManager.endRequest(error.message);

      if (retryCount >= this.maxRetries || error?.response?.status === 429) {
        throw error;
      }

      const delayTime = this.retryDelay * Math.pow(2, retryCount);
      await this.delay(delayTime);

      return this.retryWithBackoff(operation, endpoint, retryCount + 1);
    }
  }

  private formatMessages(params: AIRequestParams): string {
    // Combine all messages into a single prompt
    return params.messages.map(msg => {
      if (msg.role === 'system') {
        return `Instructions: ${msg.content}\n\n`;
      }
      if (msg.role === 'assistant') {
        return `Assistant: ${msg.content}\n`;
      }
      return msg.content;
    }).join('\n');
  }

  async streamingRequest(options: StreamingOptions): Promise<AIResponse> {
    const { endpoint, params, onProgress } = options;
    let fullMessage = '';

    return this.retryWithBackoff(async () => {
      try {
        const response = await fetch(`${this.apiEndpoint}/api/ai/${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.apiKey && { 'X-API-Key': this.apiKey }),
          },
          body: JSON.stringify({
            prompt: this.formatMessages(params),
            temperature: params.temperature,
            stream: true,
          }),
        });

        // Update rate limit info from headers
        this.stateManager.updateRateLimits(response.headers);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Response body reader not available');
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const textChunk = new TextDecoder().decode(value);
          fullMessage += textChunk;
          onProgress(fullMessage);
        }

        this.stateManager.endRequest();
        return { content: fullMessage };

      } catch (error: any) {
        const errorMessage = error.message || 'An error occurred';
        this.stateManager.endRequest(errorMessage);
        return {
          content: fullMessage,
          error: `API request failed: ${errorMessage}`,
        };
      }
    }, endpoint);
  }

  async proofread(params: AIRequestParams): Promise<AIResponse> {
    return this.streamingRequest({
      endpoint: 'proofread',
      params,
      onProgress: () => {},
    });
  }

  async complete(params: AIRequestParams): Promise<AIResponse> {
    return this.streamingRequest({
      endpoint: 'complete',
      params,
      onProgress: () => {},
    });
  }

  async request(endpoint: string, params: AIRequestParams): Promise<AIResponse> {
    return this.retryWithBackoff(async () => {
      try {
        const response = await fetch(`${this.apiEndpoint}/api/ai/${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.apiKey && { 'X-API-Key': this.apiKey }),
          },
          body: JSON.stringify({
            prompt: this.formatMessages(params),
            temperature: params.temperature,
            stream: false,
          }),
        });

        const result = await this.handleResponse(response);
        this.stateManager.endRequest();
        return result;
      } catch (error: any) {
        const errorMessage = error.message || 'An error occurred';
        this.stateManager.endRequest(errorMessage);
        return {
          content: '',
          error: `API request failed: ${errorMessage}`,
        };
      }
    }, endpoint);
  }

  getStateManager(): AIStateManager {
    return this.stateManager;
  }
}