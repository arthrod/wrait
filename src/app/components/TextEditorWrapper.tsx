import { MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import { DocumentManager } from "../api/document/documentManager";
import { AIPromptDialog } from "./AIPromptDialog";
import { EditorState, NodeSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { keymap } from "prosemirror-keymap";
import { history, redo, undo } from "prosemirror-history";
import { baseKeymap, setBlockType, wrapIn, lift, toggleMark } from "prosemirror-commands";
import { buildInputRules } from "./ProseMIrror/inputRules";
import { dropCursor } from "prosemirror-dropcursor";
import { gapCursor } from "prosemirror-gapcursor";
import { actionsPlugin } from "./ProseMIrror/actionsPlugin";
import { textSchema } from "./ProseMIrror/schema";
import {
  acceptAutoComplete,
  autoCompletePlugin,
  getAutoCompleteDerivedState,
  performAutoComplete,
} from "./ProseMIrror/autoCompletePlugin";
import { setAI } from "../api/ai/viewAI";
import { AI } from "../api/ai/ai";
import {
  ProofRead,
  ProofReadPlugin,
  activateProofReadItem,
  applySuggestion,
  getProofReadDerivedState,
  proofread,
  rejectSuggestion,
  resetProofRead,
} from "./ProseMIrror/proofReadPlugin";
import {
  SmartExpansionPlugin,
  SmartExpansionState,
  applyExpansion,
  applyRewrite,
  getSmartExpansionState,
} from "./ProseMIrror/smartExpansionPlugin";
import { TextEditor } from "../combini/TextEditor";
import { Card, CardContent } from "../combini/Card";
import { EditorToolbar } from "../combini/EditorToolbar";
import styles from "./TextEditorWrapper.module.css";
import { EditorButton } from "../combini/EditorButton";
import { ChangeAcceptanceCard } from "../combini/ChangeAcceptanceCard";

const initial = textSchema.node("doc", null, [
  textSchema.node("paragraph", null, [
    textSchema.text("A smart text editor running in your browser."),
  ]),
  textSchema.node("paragraph", null, [
    textSchema.text(
      "This is a smart text editor running directly in your browser, powered by Meta's LLAMA and webllm. Try typing <insert a joke here> or put your thoughts in [], then let AI clean it up for you, like this: [there are still some glitches here and there... well this is a demo, but i hope you like it] and then press tab!"
    ),
  ]),
]);

function makeInitialState() {
  return EditorState.create({
    schema: textSchema,
    doc: initial,
    plugins: [
      history(),
      buildInputRules(),
      keymap({
        "Mod-b": toggleMark(textSchema.marks.bold),
        "Mod-i": toggleMark(textSchema.marks.italic),
        "Mod-u": toggleMark(textSchema.marks.underline),
        "Mod-`": toggleMark(textSchema.marks.code),
        "Mod-[": lift,
        "Mod->": wrapIn(textSchema.nodes.blockquote),
        "Mod-z": undo,
        "Mod-y": redo,
      }),
      keymap(baseKeymap),
      actionsPlugin,
      autoCompletePlugin,
      ProofReadPlugin,
      SmartExpansionPlugin,
      dropCursor(),
      gapCursor(),
    ],
  });
}

type SelectionType = "single" | "range" | "none";

type EditorDerivedState = {
  proofReadState: {
    activeProofRead: ProofRead | undefined;
    state: "idle" | "waiting" | "proofReading";
  };
  autoCompleteState: {
    state: "idle" | "waiting" | "autoCompleting";
  };
  smartExpansionState: SmartExpansionState;
  selectionType: SelectionType;
};

interface FormatButtonProps {
  icon: string;
  title: string;
  isActive: boolean;
  onClick: () => void;
}

const FormatButton: React.FC<FormatButtonProps> = ({ icon, title, isActive, onClick }) => (
  <button
    className={`${styles.formatButton} ${isActive ? styles.active : ''}`}
    onClick={onClick}
    title={title}
  >
    {icon}
  </button>
);

export const TextEditorWrapper = ({
  onProgress,
  onLoadError,
  onHasLoadedAI,
  hasLoadedAI,
}: {
  onProgress: (progress: number) => void;
  onLoadError: (error: string) => void;
  onHasLoadedAI: () => void;
  hasLoadedAI: boolean;
}) => {
  const [isAIPromptOpen, setIsAIPromptOpen] = useState(false);
  const documentManager = useRef(DocumentManager.getInstance());
  const domRef = useRef<HTMLDivElement>() as MutableRefObject<HTMLDivElement>;
  const viewRef = useRef<EditorView | null>(null);
  const [editorDerivedState, setEditorDerivedState] =
    useState<EditorDerivedState>({
      proofReadState: {
        activeProofRead: undefined,
        state: "idle",
      },
      autoCompleteState: {
        state: "idle",
      },
      smartExpansionState: {
        type: "idle",
      },
      selectionType: "none",
    });

  const isMarkActive = useCallback((markType: string) => {
    if (!viewRef.current) return false;
    const { from, $from, to, empty } = viewRef.current.state.selection;
    if (empty) {
      return !!viewRef.current.state.storedMarks?.some(mark => mark.type.name === markType);
    }
    return viewRef.current.state.doc.rangeHasMark(from, to, viewRef.current.state.schema.marks[markType]);
  }, []);

  const isNodeActive = useCallback((nodeType: string, attrs: any = {}) => {
    if (!viewRef.current) return false;
    const state = viewRef.current.state;
    const { selection } = state;
    
    if (selection instanceof NodeSelection && selection.node) {
      return selection.node.hasMarkup(state.schema.nodes[nodeType], attrs);
    }

    const $from = selection.$from;
    const $to = selection.$to;
    const range = $from.blockRange($to);

    if (!range) return false;

    return range.parent.hasMarkup(state.schema.nodes[nodeType], attrs);
  }, []);

  const toggleFormat = useCallback((markType: string) => {
    if (viewRef.current) {
      const command = toggleMark(viewRef.current.state.schema.marks[markType]);
      command(viewRef.current.state, viewRef.current.dispatch);
    }
  }, []);

  const setHeading = useCallback((level: number) => {
    if (viewRef.current) {
      const command = setBlockType(viewRef.current.state.schema.nodes.heading, { level });
      command(viewRef.current.state, viewRef.current.dispatch);
    }
  }, []);

  const handleCustomAIPrompt = useCallback((prompt: string) => {
    if (viewRef.current) {
      const view = viewRef.current;
      const { from, to } = view.state.selection;
      const selectedText = view.state.doc.textBetween(from, to);
      
      // Add custom system message
      const fullPrompt = `Instructions: ${prompt}\n\n${selectedText}`;
      
      // Use the AI to process the text
      const ai = new AI();
      ai.request(
        { messages: [{ role: 'user', content: fullPrompt }], temperature: 0.7 },
        (text) => {
          const tr = view.state.tr.replaceWith(
            from,
            to,
            view.state.schema.text(text)
          );
          view.dispatch(tr);
        }
      );
    }
  }, []);

  useEffect(() => {
    if (viewRef.current) {
      return;
    }
    const initialState = makeInitialState();
    const editorView = new EditorView(domRef.current, {
      state: initialState,
      dispatchTransaction: (tr) => {
        const view = viewRef.current;
        if (!view) {
          return;
        }
        const newState = view.state.apply(tr);
        view.updateState(newState);
        
        // Save document state after each transaction
        documentManager.current.saveDocument(newState).catch(console.error);
        
        setEditorDerivedState({
          proofReadState: getProofReadDerivedState(newState),
          autoCompleteState: getAutoCompleteDerivedState(newState),
          smartExpansionState: getSmartExpansionState(newState),
          selectionType: !view.hasFocus()
            ? "none"
            : newState.selection.from === newState.selection.to
              ? "single"
              : "range",
        });
      },
    });
    editorView.focus();

    // Initialize AI with backend configuration
    const ai = new AI({
      apiEndpoint: 'http://127.0.0.1:5002',
      maxRetries: 3,
      retryDelay: 1000
    });
    setAI(editorView, ai);

    // No need to load since we're using the backend
    onProgress(1);
    onHasLoadedAI();

    viewRef.current = editorView;

    // Start auto-save
    documentManager.current.startAutoSave(initialState);
    return () => documentManager.current.stopAutoSave();
  }, [onProgress, onHasLoadedAI]);

  const activeProofRead = editorDerivedState.proofReadState.activeProofRead;

  const [proofReadPos, setProofReadPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const hoverElement: Element | undefined = (() => {
    if (!activeProofRead) {
      return;
    }
    return (
      domRef.current?.querySelector(
        `[data-pf-diff=${JSON.stringify(JSON.stringify(activeProofRead))}]`
      ) ?? undefined
    );
  })();

  useEffect(() => {
    if (hoverElement) {
      const updatePopoverPosition = () => {
        const rect = hoverElement.getBoundingClientRect();
        const outerRect = outerDomRef.current!.getBoundingClientRect();
        setProofReadPos({
          top: rect.bottom - outerRect.top,
          left: rect.left - outerRect.left,
        });
      };

      updatePopoverPosition();

      const observer = new MutationObserver(updatePopoverPosition);
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });

      return () => observer.disconnect();
    } else {
      setProofReadPos(null);
    }
  }, [hoverElement]);

  const smartExpansionState = editorDerivedState.smartExpansionState;
  const outerDomRef = useRef<HTMLDivElement>(null);

  return (
    <div className={styles.content} ref={outerDomRef}>
      <Card>
        <EditorToolbar className={styles.toolbar}>
          <FormatButton
            icon="H1"
            title="Heading 1"
            isActive={isNodeActive('heading', { level: 1 })}
            onClick={() => setHeading(1)}
          />
          <FormatButton
            icon="H2"
            title="Heading 2"
            isActive={isNodeActive('heading', { level: 2 })}
            onClick={() => setHeading(2)}
          />
          <FormatButton
            icon="B"
            title="Bold"
            isActive={isMarkActive('bold')}
            onClick={() => toggleFormat('bold')}
          />
          <FormatButton
            icon="I"
            title="Italic"
            isActive={isMarkActive('italic')}
            onClick={() => toggleFormat('italic')}
          />
          <FormatButton
            icon="U"
            title="Underline"
            isActive={isMarkActive('underline')}
            onClick={() => toggleFormat('underline')}
          />
          <FormatButton
            icon="H"
            title="Highlight"
            isActive={isMarkActive('highlight')}
            onClick={() => toggleFormat('highlight')}
          />
          <FormatButton
            icon="C"
            title="Code"
            isActive={isMarkActive('code')}
            onClick={() => toggleFormat('code')}
          />
          <FormatButton
            icon="❝"
            title="Blockquote"
            isActive={isNodeActive('blockquote')}
            onClick={() => {
              if (viewRef.current) {
                wrapIn(textSchema.nodes.blockquote)(
                  viewRef.current.state,
                  viewRef.current.dispatch
                );
              }
            }}
          />
          <FormatButton
            icon="1."
            title="Ordered List"
            isActive={isNodeActive('ordered_list')}
            onClick={() => {
              if (viewRef.current) {
                wrapIn(textSchema.nodes.ordered_list)(
                  viewRef.current.state,
                  viewRef.current.dispatch
                );
              }
            }}
          />
          <FormatButton
            icon="•"
            title="Bullet List"
            isActive={isNodeActive('bullet_list')}
            onClick={() => {
              if (viewRef.current) {
                wrapIn(textSchema.nodes.bullet_list)(
                  viewRef.current.state,
                  viewRef.current.dispatch
                );
              }
            }}
          />
          <EditorButton
            action={() => setIsAIPromptOpen(true)}
            disabled={!hasLoadedAI}
            label="Custom AI"
            shortcut="mod+shift+p"
          />
          <EditorButton
            action={() => {
              if (viewRef.current) {
                if (editorDerivedState.proofReadState.activeProofRead) {
                  resetProofRead(viewRef.current);
                } else {
                  proofread(viewRef.current);
                }
              }
            }}
            loading={editorDerivedState.proofReadState.state === "proofReading"}
            disabled={
              !hasLoadedAI ||
              editorDerivedState.proofReadState.state === "proofReading"
            }
            label={(() => {
              if (editorDerivedState.proofReadState.state === "proofReading") {
                return "Proofreading...";
              } else if (editorDerivedState.proofReadState.activeProofRead) {
                return `Done proof reading`;
              } else {
                return `Proof read`;
              }
            })()}
            shortcut="mod+'"
          />
          <EditorButton
            action={() => {
              if (viewRef.current) {
                if (editorDerivedState.autoCompleteState.state === "waiting") {
                  acceptAutoComplete(viewRef.current);
                } else {
                  performAutoComplete(viewRef.current);
                }
              }
            }}
            loading={
              editorDerivedState.autoCompleteState.state === "autoCompleting"
            }
            disabled={
              !hasLoadedAI ||
              editorDerivedState.autoCompleteState.state === "autoCompleting"
            }
            label={(() => {
              if (
                editorDerivedState.autoCompleteState.state === "autoCompleting"
              ) {
                return "Writing...";
              } else if (
                editorDerivedState.autoCompleteState.state === "waiting"
              ) {
                return "Accept (Tab)";
              } else {
                return `Continue writing`;
              }
            })()}
            shortcut="mod+."
          />
          <EditorButton
            action={() => {
              if (viewRef.current) {
                applyExpansion(
                  viewRef.current,
                  viewRef.current.state.selection.from,
                  viewRef.current.state.selection.to
                );
              }
            }}
            loading={
              editorDerivedState.smartExpansionState.type === "generating" &&
              editorDerivedState.smartExpansionState.generateType === "expand"
            }
            disabled={
              !hasLoadedAI ||
              editorDerivedState.selectionType !== "range" ||
              editorDerivedState.smartExpansionState.type === "generating"
            }
            label={
              editorDerivedState.smartExpansionState.type === "generating" &&
              editorDerivedState.smartExpansionState.generateType === "expand"
                ? "Expanding"
                : "Smart expand"
            }
            shortcut="<>"
          />
          <EditorButton
            action={() => {
              if (viewRef.current) {
                applyRewrite(
                  viewRef.current,
                  viewRef.current.state.selection.from,
                  viewRef.current.state.selection.to
                );
              }
            }}
            loading={
              editorDerivedState.smartExpansionState.type === "generating" &&
              editorDerivedState.smartExpansionState.generateType === "rewrite"
            }
            disabled={
              !hasLoadedAI ||
              editorDerivedState.selectionType !== "range" ||
              editorDerivedState.smartExpansionState.type === "generating"
            }
            label={
              editorDerivedState.smartExpansionState.type === "generating" &&
              editorDerivedState.smartExpansionState.generateType === "rewrite"
                ? "Rewriting"
                : "Smart rewrite"
            }
            shortcut="[]"
          />
        </EditorToolbar>
        <TextEditor
          editorRef={domRef}
          onMouseOver={(e) => {
            const target = (e.target as HTMLElement).closest("[data-pf-diff]");
            if (!target) {
              return;
            }
            const diff = JSON.parse(
              target.getAttribute("data-pf-diff") ?? "{}"
            );
            if (viewRef.current) {
              activateProofReadItem(viewRef.current, diff);
            }
          }}
        ></TextEditor>
      </Card>
      {proofReadPos && editorDerivedState.proofReadState.activeProofRead && (
        <ChangeAcceptanceCard
          className={styles.proofReadCard}
          style={proofReadPos}
          changeText={
            editorDerivedState.proofReadState.activeProofRead.diff !== "" &&
            editorDerivedState.proofReadState.activeProofRead.from !==
              editorDerivedState.proofReadState.activeProofRead.to
              ? editorDerivedState.proofReadState.activeProofRead.diff
              : undefined
          }
          onAccept={() => {
            if (
              viewRef.current &&
              editorDerivedState.proofReadState.activeProofRead
            ) {
              applySuggestion(
                viewRef.current,
                editorDerivedState.proofReadState.activeProofRead
              );
            }
          }}
          onReject={() => {
            if (
              viewRef.current &&
              editorDerivedState.proofReadState.activeProofRead
            ) {
              rejectSuggestion(
                viewRef.current,
                editorDerivedState.proofReadState.activeProofRead
              );
            }
          }}
        />
      )}
      {smartExpansionState.type === "generating" && (
        <Card
          style={{
            top:
              (viewRef.current?.coordsAtPos(smartExpansionState.from)?.top ??
                0) - outerDomRef.current!.getBoundingClientRect().top,
            left: "100%",
            marginLeft: "var(--spacing-md)",
            width: "20rem",
            position: "absolute",
          }}
        >
          <CardContent>
            {smartExpansionState.generatedText || "Thinking..."}
          </CardContent>
        </Card>
      )}
      {(() => {
        if (smartExpansionState.type === "hintGenerating") {
          const coords = viewRef.current?.coordsAtPos(smartExpansionState.to);
          const base = outerDomRef.current!.getBoundingClientRect();
          return (
            <Card
              style={{
                top: coords?.top ? coords.top - base.top : 0,
                left: coords?.left ? coords.left - base.left : 0,
                position: "absolute",
              }}
            >
              <CardContent>
                {hasLoadedAI
                  ? `Tab to ${smartExpansionState.generateType}`
                  : "Waiting for AI to load..."}
              </CardContent>
            </Card>
          );
        }
      })()}
      <AIPromptDialog
        open={isAIPromptOpen}
        onClose={() => setIsAIPromptOpen(false)}
        onSubmit={handleCustomAIPrompt}
      />
    </div>
  );
};

