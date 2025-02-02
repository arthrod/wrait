'use client';
import React from 'react';
import { useMarkViewContext } from '@prosemirror-adapter/react';

export const AutoCompleteSuggestion = () => {
  const { contentRef } = useMarkViewContext();
  return (
    <span className="autocomplete-suggestion" ref={contentRef} />
  );
};