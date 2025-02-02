'use client';
import React, { createContext, useContext } from 'react';
import { EditorView } from 'prosemirror-view';
import { EditorState, Transaction } from 'prosemirror-state';

interface ProseMirrorContextValue {
  view: EditorView | null;
  state: EditorState;
  dispatch: (tr: Transaction) => void;
}

const ProseMirrorContext = createContext<ProseMirrorContextValue | undefined>(undefined);

interface ProseMirrorProviderProps {
  view: EditorView;
  state: EditorState;
  dispatch: (tr: Transaction) => void;
  children: React.ReactNode;
}

export const ProseMirrorProvider: React.FC<ProseMirrorProviderProps> = ({ view, state, dispatch, children }) => {
  const value = { view, state, dispatch };
  return (
    <ProseMirrorContext.Provider value={value}>
      {children}
    </ProseMirrorContext.Provider>
  );
};

export const useProseMirrorContext = () => {
  const context = useContext(ProseMirrorContext);
  if (!context) {
    throw new Error('useProseMirrorContext must be used within a ProseMirrorProvider');
  }
  return context;
};