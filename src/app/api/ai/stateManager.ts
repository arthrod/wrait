import { SimpleEventEmitter } from './types';

export interface AIState {
  isLoading: boolean;
  error: string | null;
  lastRequest: {
    timestamp: number;
    endpoint: string;
  } | null;
  requestCount: number;
  rateLimitRemaining: number | null;
  rateLimitReset: number | null;
}

export interface AIStateUpdate extends Partial<AIState> {}

export class AIStateManager {
  private static instance: AIStateManager;
  private eventEmitter: SimpleEventEmitter;
  private state: AIState;
  private storageKey = 'ai_state';

  private constructor() {
    this.eventEmitter = new SimpleEventEmitter();
    this.state = this.loadState();
  }

  static getInstance(): AIStateManager {
    if (!AIStateManager.instance) {
      AIStateManager.instance = new AIStateManager();
    }
    return AIStateManager.instance;
  }

  private loadState(): AIState {
    const defaultState: AIState = {
      isLoading: false,
      error: null,
      lastRequest: null,
      requestCount: 0,
      rateLimitRemaining: null,
      rateLimitReset: null,
    };

    try {
      const savedState = localStorage.getItem(this.storageKey);
      if (savedState) {
        return { ...defaultState, ...JSON.parse(savedState) };
      }
    } catch (error) {
      console.error('Error loading AI state:', error);
    }

    return defaultState;
  }

  private saveState(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    } catch (error) {
      console.error('Error saving AI state:', error);
    }
  }

  getState(): AIState {
    return { ...this.state };
  }

  updateState(update: AIStateUpdate): void {
    this.state = { ...this.state, ...update };
    this.saveState();
    this.eventEmitter.emit('stateChange', this.state);
  }

  updateRateLimits(headers: Headers): void {
    const remaining = headers.get('X-RateLimit-Remaining');
    const reset = headers.get('X-RateLimit-Reset');

    this.updateState({
      rateLimitRemaining: remaining ? parseInt(remaining, 10) : null,
      rateLimitReset: reset ? parseInt(reset, 10) : null,
    });
  }

  startRequest(endpoint: string): void {
    this.updateState({
      isLoading: true,
      error: null,
      lastRequest: {
        timestamp: Date.now(),
        endpoint,
      },
      requestCount: this.state.requestCount + 1,
    });
  }

  endRequest(error?: string): void {
    this.updateState({
      isLoading: false,
      error: error || null,
    });
  }

  onStateChange(callback: (state: AIState) => void): () => void {
    this.eventEmitter.on('stateChange', callback);
    return () => this.eventEmitter.off('stateChange', callback);
  }

  getRateLimitInfo(): { remaining: number | null; resetTime: Date | null } {
    return {
      remaining: this.state.rateLimitRemaining,
      resetTime: this.state.rateLimitReset
        ? new Date(this.state.rateLimitReset * 1000)
        : null,
    };
  }

  canMakeRequest(): boolean {
    const { rateLimitRemaining, rateLimitReset } = this.state;
    if (rateLimitRemaining === null || rateLimitReset === null) {
      return true;
    }

    return (
      rateLimitRemaining > 0 || Date.now() / 1000 >= rateLimitReset
    );
  }

  getRequestStats(): { total: number; lastRequest: Date | null } {
    return {
      total: this.state.requestCount,
      lastRequest: this.state.lastRequest
        ? new Date(this.state.lastRequest.timestamp)
        : null,
    };
  }

  clearError(): void {
    this.updateState({ error: null });
  }

  reset(): void {
    this.updateState({
      isLoading: false,
      error: null,
      lastRequest: null,
      requestCount: 0,
      rateLimitRemaining: null,
      rateLimitReset: null,
    });
  }
}