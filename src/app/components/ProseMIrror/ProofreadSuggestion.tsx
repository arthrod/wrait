'use client';
import React from 'react';
import { useNodeViewContext } from '@prosemirror-adapter/react';

export const ProofreadSuggestion = () => {
  const { selected, contentRef } = useNodeViewContext();
  return (
    <span className={'proofread-suggestion'} style={{ outline: selected ? '1px solid blue' : 'none' }} ref={contentRef} />
  );
};