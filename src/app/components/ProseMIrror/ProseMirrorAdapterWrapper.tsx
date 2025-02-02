'use client';
import { ProsemirrorAdapterProvider } from '@prosemirror-adapter/react';
import React from 'react';

interface ProseMirrorAdapterWrapperProps {
  children: React.ReactNode;
}

export const ProseMirrorAdapterWrapper: React.FC<ProseMirrorAdapterWrapperProps> = ({ children }) => {
  return (
    <ProsemirrorAdapterProvider>
      {children}
    </ProsemirrorAdapterProvider>
  );
};