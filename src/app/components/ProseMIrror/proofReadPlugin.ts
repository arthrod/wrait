import {
  EditorState,
  Plugin,
  PluginKey,
  Transaction,
} from "prosemirror-state";
import { Decoration, DecorationSet, EditorView } from "prosemirror-view";
import { Node } from "prosemirror-model";
import { ProofReadController } from "./ProofReadController";

const styles = {
  deleteStyle: "deleteStyle",
  diffStyle: "diffStyle",
  insertStyle: "insertStyle"
};

export interface State {
  state: "proofReading" | "waiting" | "idle";
  activeProofRead: ProofRead | undefined;
  proofReads: ProofRead[];
}

export interface ProofRead {
  from: number;
  to: number;
  diff: string;
}

export const proofreadingPluginKey = new PluginKey<State>("proofreading");

export const ProofReadPlugin = new Plugin<State>({
  key: proofreadingPluginKey,
  state: {
    init() {
      return { proofReads: [], activeProofRead: undefined, state: "idle" };
    },
    apply(tr, state) {
      const command = tr.getMeta(proofreadingPluginKey);
      let newState: ProofRead[] = state.proofReads;
      let activeProofRead = state.activeProofRead;

      if (command) {
        switch (command.type) {
          case "updateState":
            if (command.state === "waiting" && state.state === "proofReading") {
              if (state.proofReads.length) {
                return {
                  ...state,
                  state: command.state,
                  activeProofRead: state.proofReads[0],
                };
              } else {
                return {
                  ...state,
                  state: "idle",
                  activeProofRead: undefined,
                };
              }
            }
            return {
              ...state,
              state: command.state,
            };
          case "replace":
            return {
              proofReads: command.proofReads || [],
              activeProofRead: undefined,
              state: state.state,
            };
          case "delete":
            if (command.proofRead) {
              const index = state.proofReads.findIndex((r) => {
                return (
                  r.from === command.proofRead!.from &&
                  r.to === command.proofRead!.to
                );
              });
              newState = state.proofReads.filter((r) => {
                return (
                  r.from !== command.proofRead!.from ||
                  r.to !== command.proofRead!.to
                );
              });
              if (
                activeProofRead?.from === command.proofRead.from &&
                activeProofRead?.to === command.proofRead.to
              ) {
                activeProofRead = newState[index] ?? newState[0];
              }
            }
            break;
          case "activate":
            if (command.proofRead && state.proofReads.some((r) => {
              return (
                r.from === command.proofRead!.from &&
                r.to === command.proofRead!.to
              );
            })) {
              activeProofRead = command.proofRead;
            }
            break;
          case "reset":
            return {
              proofReads: [],
              activeProofRead: undefined,
              state: "idle",
            };
        }
      }

      return {
        proofReads: newState,
        state: state.state,
        activeProofRead,
      };
    },
  },
  props: {
    handleKeyDown(view, event) {
      if (event.key === "'" && event.metaKey) {
        const controller = new ProofReadController(view);
        controller.proofReadSelection().catch(console.error);
        return true;
      }
      return false;
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

function createInsertionWidget(diff: ProofRead): HTMLElement {
  const span = document.createElement("span");
  span.className = styles.insertStyle;
  span.textContent = diff.diff;
  span.setAttribute("data-pf-diff", JSON.stringify(diff));
  return span;
}

export function getProofReadDerivedState(state: EditorState) {
  const pluginState = proofreadingPluginKey.getState(state);
  return {
    activeProofRead: pluginState?.activeProofRead,
    state: pluginState?.state ?? "idle",
  };
}

export function applySuggestion(view: EditorView, diff: ProofRead) {
  let tr = view.state.tr;
  if (diff.diff) {
    tr = tr.replaceWith(diff.from, diff.to, view.state.schema.text(diff.diff));
  } else {
    tr = tr.deleteRange(diff.from, diff.to);
  }
  view.dispatch(tr);
}

export function rejectSuggestion(view: EditorView, diff: ProofRead) {
  const tr = view.state.tr;
  tr.setMeta(proofreadingPluginKey, {
    type: "delete",
    proofRead: diff,
  });
  view.dispatch(tr);
}

export function activateProofReadItem(view: EditorView, diff: ProofRead) {
  const tr = view.state.tr;
  tr.setMeta(proofreadingPluginKey, {
    type: "activate",
    proofRead: diff,
  });
  view.dispatch(tr);
}

export function resetProofRead(view: EditorView) {
  const tr = view.state.tr;
  tr.setMeta(proofreadingPluginKey, {
    type: "reset",
  });
  view.dispatch(tr);
}

// Add the missing proofread export
export async function proofread(view: EditorView) {
  const controller = new ProofReadController(view);
  await controller.proofReadSelection();
}
