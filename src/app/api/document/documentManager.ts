import { EditorState } from "prosemirror-state";
import { Node as ProseMirrorNode } from "prosemirror-model";

export interface DocumentState {
  content: { type: string; content: any };
  timestamp: string;
}

export class DocumentManager {
  private static instance: DocumentManager;
  private currentDocId: string | null = null;
  private autoSaveInterval: number | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): DocumentManager {
    if (!DocumentManager.instance) {
      DocumentManager.instance = new DocumentManager();
    }
    return DocumentManager.instance;
  }

  async saveDocument(state: EditorState): Promise<void> {
    if (!this.currentDocId) {
      this.currentDocId = crypto.randomUUID();
    }

    const content = state.doc.toJSON();
    
    try {
      const response = await fetch('http://127.0.0.1:5002/api/document/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: this.currentDocId,
          content,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save document');
      }
    } catch (error) {
      console.error('Error saving document:', error);
      throw error;
    }
  }

  async loadDocument(docId: string): Promise<DocumentState> {
    try {
      const response = await fetch(`http://127.0.0.1:5002/api/document/load/${docId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load document');
      }

      const data = await response.json();
      this.currentDocId = docId;
      return data;
    } catch (error) {
      console.error('Error loading document:', error);
      throw error;
    }
  }

  startAutoSave(state: EditorState, interval: number = 30000): void {
    if (this.autoSaveInterval) {
      this.stopAutoSave();
    }

    this.autoSaveInterval = window.setInterval(() => {
      this.saveDocument(state).catch(console.error);
    }, interval);
  }

  stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  getCurrentDocId(): string | null {
    return this.currentDocId;
  }
}