## Implementation Plan with Code Examples

Here's the architectural plan split into actionable tasks, with code examples for each step:

**1. Setup Adapter Foundation**

- **Create `ProseMirrorAdapterWrapper.tsx`:**

```tsx
// src/app/components/ProseMIrror/ProseMirrorAdapterWrapper.tsx
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
```

- **Modify `TextEditorWrapper.tsx` to use the provider:**

```tsx
// src/app/components/TextEditorWrapper.tsx
import React, { useRef, useCallback, useEffect, useState } from 'react';
import { EditorView } from 'prosemirror-view';
import { EditorState } from 'prosemirror-state';
import { keymap } from 'prosemirror-keymap';
import { history } from 'prosemirror-history';
import { baseKeymap } from 'prosemirror-commands';
import { buildInputRules } from './ProseMIrror/inputRules';
import { textSchema } from './ProseMIrror/schema';
import { actionsPlugin } from './ProseMIrror/actionsPlugin';
import { autoCompletePlugin } from './ProseMIrror/autoCompletePlugin';
import { ProofReadPlugin } from './ProseMIrror/proofReadPlugin';
import { smartExpansionPlugin, SmartExpansionState } from './ProseMIrror/smartExpansionPlugin';
import { TextEditorContext, TextEditorContextValue } from '@/app/combini/TextEditor';
import { useCombiniAI } from '@/app/api/ai/viewAI';
import { getAutoCompleteDerivedState } from './ProseMIrror/autoCompletePlugin';
import { getProofReadDerivedState } from './ProseMIrror/proofReadPlugin';
import { getSmartExpansionState as getSmartExpansionDerivedState } from './ProseMIrror/smartExpansionPlugin';
import { ProseMirrorAdapterWrapper } from './ProseMIrror/ProseMirrorAdapterWrapper'; // Import the wrapper

export interface TextEditorWrapperProps {
  content?: string;
}

export const TextEditorWrapper: React.FC<TextEditorWrapperProps> = ({ content }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [editorState, setEditorState] = useState<EditorState>(() => {
    return EditorState.create({
      doc: content ? textSchema.node('doc', null, textSchema.node('paragraph', null, textSchema.text(content))) : undefined,
      plugins: [
        history(),
        keymap(baseKeymap),
        buildInputRules(),
        actionsPlugin,
        autoCompletePlugin,
        ProofReadPlugin,
        smartExpansionPlugin,
      ],
      schema: textSchema,
    });
  });


  useEffect(() => {
    if (editorRef.current && !viewRef.current) {
      viewRef.current = new EditorView(editorRef.current, {
        state: editorState,
        dispatchTransaction(transaction) {
          const newState = viewRef.current!.state.apply(transaction);
          viewRef.current!.updateState(newState);
          setEditorState(newState); // Update React state
        },
      });
    }
    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [editorState]);


  const proofReadState = getProofReadDerivedState(editorState);
  const autoCompleteState = getAutoCompleteDerivedState(editorState);
  const smartExpansionState = getSmartExpansionDerivedState(editorState);


  const contextValue: TextEditorContextValue = {
    proofReadState,
    autoCompleteState,
    smartExpansionState,
  };


  return (
    <ProseMirrorAdapterWrapper> {/* Wrap with the provider */}
      <TextEditorContext.Provider value={contextValue}>
        <div className="editor-container">
          <div ref={editorRef} />
        </div>
      </TextEditorContext.Provider>
    </ProseMirrorAdapterWrapper>
  );
};
```

**2. Convert Proofreading System**

- **Create `ProofreadSuggestion.tsx` component:**

```tsx
// src/app/components/ProseMIrror/ProofreadSuggestion.tsx
'use client';
import React from 'react';
import { useNodeViewContext } from '@prosemirror-adapter/react';

export const ProofreadSuggestion = () => {
  const { selected, contentRef } = useNodeViewContext();
  return (
    <span className={'proofread-suggestion'} style={{ outline: selected ? '1px solid blue' : 'none' }} ref={contentRef} />
  );
};
```

- **Refactor `proofReadPlugin.ts` to use `nodeViewFactory`:**

```typescript
// src/app/components/ProseMIrror/proofReadPlugin.ts
import {
  EditorState,
  Plugin,
  PluginKey,
  Transaction,
} from "prosemirror-state";
import { Decoration, DecorationSet, EditorView } from "prosemirror-view";
import { Node } from "prosemirror-model";
import { ProofReadController } from "./ProofReadController";
import { useNodeViewFactory } from '@prosemirror-adapter/react'; // Import hook
import { ProofreadSuggestion } from './ProofreadSuggestion'; // Import React Component

// ... rest of the file ...

export const ProofReadPlugin = new Plugin<State>({
  key: proofreadingPluginKey,
  state: {
    // ... state implementation ...
  },
  props: {
    handleKeyDown(view, event) {
      // ... keydown handling ...
    },
    decorations(state) {
      const pluginState = proofreadingPluginKey.getState(state);
      if (!pluginState) {
        return DecorationSet.empty;
      }
      return DecorationSet.create(
        state.doc,
        createDiffsDecorations(pluginState.proofReads)
      );
    },
    nodeViews: { // Add nodeViews prop
      proofread_suggestion: (node, view, getPos) => {
        const factory = useNodeViewFactory(); // Use the hook inside nodeViews
        return factory({
          component: ProofreadSuggestion,
        })(node, view, getPos);
      },
    }
  },
});

function createDiffsDecorations(diffs: ProofRead[]): Decoration[] {
  return diffs.map((diff) => {
    if (diff.from === diff.to) {
      return Decoration.widget(diff.from, createInsertionWidget(diff));
    } else if (diff.diff === "") {
      return Decoration.inline(diff.from, diff.to, {
        class: styles.deleteStyle,
        "data-pf-diff": JSON.stringify(diff),
      });
    } else {
      return Decoration.inline(diff.from, diff.to, {
        class: styles.diffStyle,
        "data-pf-diff": JSON.stringify(diff),
      });
    }
  });
}

// ... rest of the file ...
```

*(Note: This is a conceptual example. `useNodeViewFactory` hook needs to be correctly integrated within the plugin's `nodeViews` prop, which might require a slightly different approach as `useNodeViewFactory` is meant to be used within React components. A factory function might be needed to bridge the gap.)*

**3. Refactor AutoComplete**

- **Create `AutoCompleteSuggestion.tsx`:**

```tsx
// src/app/components/ProseMIrror/AutoCompleteSuggestion.tsx
'use client';
import React from 'react';
import { useMarkViewContext } from '@prosemirror-adapter/react';

export const AutoCompleteSuggestion = () => {
  const { contentRef } = useMarkViewContext();
  return (
    <span className="autocomplete-suggestion" ref={contentRef} />
  );
};
```

- **Update `autoCompletePlugin.ts` with `markViewFactory`:**

```typescript
// src/app/components/ProseMIrror/autoCompletePlugin.ts
import {
  EditorState,
  Plugin,
  PluginKey,
  TextSelection,
  Transaction,
} from "prosemirror-state";
import { Decoration, DecorationSet, EditorView } from "prosemirror-view";
import { textSchema } from "./schema";
import { Mapping } from "prosemirror-transform";
import { getAI } from "@/app/api/ai/viewAI";
import { useMarkViewFactory } from '@prosemirror-adapter/react'; // Import hook
import { AutoCompleteSuggestion } from './AutoCompleteSuggestion'; // Import React Component


export const autoCompletePlugin = new Plugin<PluginState>({
  key: pluginKey,
  state: {
    init() {
      return { autoComplete: undefined };
    },
    apply(tr, value, oldState, newState): PluginState {
      // ... state apply logic ...
    },
  },
  props: {
    handleKeyDown(view, event) {
      // ... keydown handling ...
    },
    markViews: { // Add markViews prop
      autoComplete: (mark, view) => {
        const factory = useMarkViewFactory(); // Use the hook inside markViews
        return factory({
          component: AutoCompleteSuggestion,
        })(mark, view);
      },
    }
  },
  view(editorView) {
    return {
      update(view, prevState) {
        // ... update view logic ...
      },
    };
  },
});
```

*(Note: Similar to `nodeViewFactory`, `useMarkViewFactory` needs to be correctly integrated within the plugin's `markViews` prop. A factory function might be needed.)*

**4. Adapt Smart Expansion**

- **Create `ExpansionWidget.tsx`:**

```tsx
// src/app/components/ProseMIrror/ExpansionWidget.tsx
'use client';
import React from 'react';
import { useWidgetViewContext } from '@prosemirror-adapter/react';

export const ExpansionWidget = () => {
  const { spec } = useWidgetViewContext();
  return (
    <span className="expansion-widget">...</span>
  );
};
```

- **Update `smartExpansionPlugin.ts` to use `widgetViewFactory`:**

```typescript
// src/app/components/ProseMIrror/smartExpansionPlugin.ts
import { getAI } from "@/app/api/ai/viewAI";
import { Plugin, PluginKey, EditorState, Transaction } from "prosemirror-state";
import { Decoration, DecorationSet, EditorView } from "prosemirror-view";
import styles from "./../TextEditorWrapper.module.css";
import { useWidgetViewFactory } from '@prosemirror-adapter/react'; // Import hook
import { ExpansionWidget } from './ExpansionWidget'; // Import React Component


export const SmartExpansionPlugin = new Plugin<SmartExpansionState>({
  key: smartExpansionKey,
  state: {
    // ... state implementation ...
  },
  view(editorView) {
    return {
      update(view, prevState) {
        // ... update view logic ...
      },
    };
  },
  props: {
    handleKeyDown(view, event) {
      // ... keydown handling ...
    },
    decorations(state: EditorState): DecorationSet | undefined {
      const pluginState = this.getState(state);
      if (!pluginState) {
        return;
      }
      switch (pluginState.type) {
        case "generating":
        case "hintGenerating":
          const widgetFactory = useWidgetViewFactory(); // Use hook here
          const widget = widgetFactory({
            component: ExpansionWidget,
            as: 'span',
          });
          return DecorationSet.create(state.doc, [
            widget(pluginState.from, { side: -1 }), // Widget decoration
            Decoration.inline(pluginState.from, pluginState.to, { // Inline decoration
              class: styles.expandingLoading,
            }),
          ]);
        case "idle":
          return undefined;
        default:
          const _: never = pluginState;
      }
    },
  },
});
```

*(Note: `useWidgetViewFactory` is used within the `decorations` prop to create widget decorations with the React component.)*

**5. Update Schema Configuration**

- **Modify `schema.ts` to use adapter-compatible node specs:**

```typescript
// src/app/components/ProseMIrror/schema.ts
import { Schema } from "prosemirror-model";
import styles from "../TextEditorWrapper.module.css";
import { Paragraph } from './ParagraphComponent'; // Example React NodeView Component

export const textSchema = new Schema({
  nodes: {
    text: {
      group: "inline",
      inline: true,
      toDOM() { return ["span", 0] }
    },
    paragraph: {
      group: "block",
      content: "inline*",
      toDOM() {
        return ["div", { "data-node-view-wrapper": "", "data-placeholder": "Type something..." }, ["p", {"data-node-view-content": ""}, 0]];
      },
      parseDOM: [{ tag: "div" }],
      // nodeView: Paragraph, // Remove direct nodeView, adapter will handle it
    },
    // ... other node definitions ...
  },
  marks: {
    autoComplete: {
      toDOM() {
        return [
          "span",
          { contentEditable: "false", class: styles.autoComplete },
          0,
        ];
      },
      // markView: AutoCompleteMark, // Remove direct markView, adapter will handle it
    },
    // ... other mark definitions ...
  },
});
```

*(Note:  Direct `nodeView` and `markView` properties are removed from the schema. The adapter will handle these via the plugin props.)*

**6. Input Rules Migration**

- **Update `inputRules.ts` to work with React components:**

```typescript
// src/app/components/ProseMIrror/inputRules.ts
import {
  inputRules,
  wrappingInputRule,
  textblockTypeInputRule,
  smartQuotes,
  emDash,
  ellipsis,
  InputRule
} from "prosemirror-inputrules";
import { NodeType, Node } from "prosemirror-model";
import { EditorState, Transaction } from "prosemirror-state";
import { textSchema } from "./schema";

// Input rules logic remains mostly the same, as they are schema-driven
// and don't directly render React components.
// You might adjust them if you need to trigger specific React component updates
// based on input rules, but the core logic is Prosemirror-based.

// Example: Blockquote rule (no changes needed for React adapter in basic rules)
const blockQuoteRule = wrappingInputRule(
  atStartOnly(/\s*>\s/),
  textSchema.nodes.blockquote
);

// ... other input rules ...

export const buildInputRules = () => {
  const rules = [
    ...typographyRules,
    ...blockRules,
    ...specialRules,
  ];
  return inputRules({ rules });
};
```

*(Note: Input rules themselves don't directly involve React components in rendering. If you had more complex input rules that needed to interact with React components, you might need to adjust their action functions to dispatch transactions that trigger state updates handled by React components, but basic input rules remain largely unchanged.)*

**7. State Management Integration**

- **Create `ProseMirrorContext.tsx` for shared state:**

```tsx
// src/app/components/ProseMIrror/ProseMirrorContext.tsx
'use client';
import React, { createContext, useContext } from 'react';
import { EditorView } from 'prosemirror-view';
import { EditorState } from 'prosemirror-state';

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
```

- **Convert plugin state updates to use React context & Update transaction handling:**

*(This step requires significant refactoring of your plugin state management to use the context.  It's too extensive to provide a concise code example here.  The general idea is to replace plugin-internal state management with context-based state.  You would use `useProseMirrorContext` in your React NodeView/MarkView/WidgetView components to access the `view` and `state`, and potentially a `dispatch` function if you need to trigger transactions from within these components.  Plugin logic would dispatch transactions via the `dispatch` function from the context, and React components would re-render based on state changes in the context.)*

**8. Testing Plan**

- **Add Storybook stories for each React view component:** Create stories in Storybook for `ProofreadSuggestion.tsx`, `AutoCompleteSuggestion.tsx`, and `ExpansionWidget.tsx` to visually test and develop these components in isolation.
- **Update Jest tests to use adapter context:** Modify your Jest tests to render components within the `ProsemirrorAdapterProvider` to properly test interactions with the adapter context and hooks.
- **Verify plugin functionality in integrated environment:**  End-to-end tests to ensure that all plugins (proofreading, autocomplete, smart expansion) function correctly after integration with `@prosemirror-adapter/react`.

This plan provides a structured approach to migrate your ProseMirror setup to use `@prosemirror-adapter/react`. Remember that the key is to progressively convert view logic to React components and leverage the adapter's factory hooks and context to bridge ProseMirror and React.