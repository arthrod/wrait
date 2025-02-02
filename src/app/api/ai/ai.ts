import { AIConfig, AIRequestParams } from "./types";

export class AI {
  #loaded = true;
  private readonly config: AIConfig;

  constructor(config: AIConfig = {}) {
    this.config = {
      apiEndpoint: 'http://127.0.0.1:5002',
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    };
  }

  loaded() {
    return this.#loaded;
  }

  async load() {
    // No loading needed for backend API
    return Promise.resolve();
  }

  async request(
    params: AIRequestParams,
    onUpdate: (text: string, abort: () => void) => void
  ): Promise<string> {
    let shouldAbort = false;
    const abortFn = () => {
      shouldAbort = true;
    };
    let fullMessage = "";

    try {
      // Determine the endpoint
      const endpoint = params.endpoint || 'generate';
      const response = await fetch(`${this.config.apiEndpoint}/api/ai/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: params.messages[params.messages.length - 1].content,
          temperature: params.temperature
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response body reader not available");
      }

      while (true) {
        if (shouldAbort) {
          reader.cancel();
          return fullMessage;
        }
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        const textChunk = new TextDecoder().decode(value);
        fullMessage += textChunk;
        onUpdate(fullMessage, abortFn);
      }
      return fullMessage;

    } catch (error: any) {
      console.error("API request failed:", error);
      const errorMessage = error.message || "An error occurred.";
      onUpdate(`Error: ${errorMessage}`, abortFn);
      throw new Error(`API request failed: ${errorMessage}`);
    }
  }
}
