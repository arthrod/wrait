'use client';
import React from 'react';
import { useWidgetViewContext } from '@prosemirror-adapter/react';

export const ExpansionWidget = () => {
  const { spec } = useWidgetViewContext();
  return (
    <span className="expansion-widget">...</span>
  );
};