export interface AIConfig {
  apiEndpoint?: string;
  apiKey?: string;
  maxRetries?: number;
  retryDelay?: number;
}

export interface AIRequestParams {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  temperature?: number;
  endpoint?: 'generate' | 'proofread' | 'complete';  // Add endpoint property
}

export interface AIResponse {
  content: string;
  error?: string;
}

export interface StreamingOptions {
  endpoint: string;
  params: AIRequestParams;
  onProgress: (text: string) => void;
}

export interface EventEmitter {
  on(event: string, callback: (...args: any[]) => void): void;
  off(event: string, callback: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
}

export class SimpleEventEmitter implements EventEmitter {
  private listeners: { [key: string]: Array<(...args: any[]) => void> } = {};

  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event: string, callback: (...args: any[]) => void): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  emit(event: string, ...args: any[]): void {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => callback(...args));
  }
}