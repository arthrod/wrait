import { EditorView } from "prosemirror-view";
import { TextSelection, EditorState } from "prosemirror-state";
import { Node } from "prosemirror-model";
import { getAI } from "@/app/api/ai/viewAI";
import { DocConsumer, visit } from "./DocVisitor";
import { proofreadingPluginKey, ProofRead } from "./proofReadPlugin";
import { DiffMatchPatch } from "diff-match-patch-typescript";

interface EditorContext {
  documentType: "text";
  locale: "en-US";
}

export interface Command {
  type: "updateState" | "replace" | "delete" | "activate" | "reset";
  state?: "proofReading" | "waiting" | "idle";
  proofReads?: ProofRead[];
  proofRead?: ProofRead;
}

export function setCommand(tr: any, command: Command) {
  return tr.setMeta(proofreadingPluginKey, command);
}

export class BlockConsumer implements DocConsumer {
  private curPos: number;
  private textStartEnd: [number, number][] = [];

  constructor(startPos: number) {
    this.curPos = startPos;
  }

  enterNode(node: Node): void {
    if (node.type.isBlock) {
      this.curPos += 1;
    }
  }

  exitNode(node: Node): void {
    if (node.type.isBlock) {
      this.curPos += 1;
    } else if (node.type.isText) {
      const nextPos = this.curPos + node.nodeSize;
      this.textStartEnd.push([this.curPos, nextPos]);
      this.curPos = nextPos;
    } else {
      this.curPos += node.nodeSize;
    }
  }

  getTextRanges(): [number, number][] {
    return this.textStartEnd;
  }
}

export class ProofReadController {
  private readonly view: EditorView;
  private abortController: AbortController | null = null;

  constructor(view: EditorView) {
    this.view = view;
  }

  private getContext(): EditorContext {
    return {
      documentType: "text",
      locale: "en-US"
    };
  }

  private getPluginState(state: EditorState) {
    return proofreadingPluginKey.getState(state);
  }

  async proofReadBlock(from: number, to: number): Promise<void> {
    const ai = getAI(this.view);
    if (!ai?.loaded()) {
      throw new Error("AI service not loaded");
    }

    const itemsBefore: ProofRead[] = this.getPluginState(this.view.state)?.proofReads ?? [];

    const selectedText = this.view.state.doc
      .textBetween(from, to)
      .replace(/( |"|"|')/g, (match: string) => {
        switch (match) {
          case " ": return " ";
          case "\u201C": // Opening double quote
          case "\u201D": // Closing double quote
            return '"';
          case "\u2019": // Right single quote
            return "'";
          default: return match;
        }
      });

    this.abortController = new AbortController();

    let curText = "";
    try {
      await ai.request(
        {
          messages: [
            {
              role: "user",
              content: [
                "Proof read the text after --- and output a version with only spelling, grammatical, spacing and word-use mistakes fixed.",
                "Note:",
                "1. Only correct words that are wrong. Improvement is not asked for.",
                "2. Maintain the original tone and style.",
                "3. Do not add new lines.",
                "4. Only output the corrected text without anything else before or after.",
                "---",
                selectedText
              ].join("\n")
            }
          ],
          temperature: 0
        },
        (text: string) => {
          if (this.abortController?.signal.aborted) return;

          curText = text;
          const diffs = this.generateProofReads(selectedText, curText, from, false);
          this.view.dispatch(
            setCommand(this.view.state.tr, {
              type: "replace",
              proofReads: [...itemsBefore, ...diffs],
            })
          );
        }
      );

      if (!this.abortController?.signal.aborted) {
        const diffs = this.generateProofReads(selectedText, curText, from, true);
        this.view.dispatch(
          setCommand(this.view.state.tr, {
            type: "replace",
            proofReads: [...itemsBefore, ...diffs],
          })
        );
      }
    } catch (error) {
      console.error("Proofreading error:", error);
      throw error;
    }
  }

  private generateProofReads(
    oldStr: string,
    newStr: string,
    baseOffset: number,
    hasFinished: boolean
  ): ProofRead[] {
    const dmp = new DiffMatchPatch();
    const diffs = dmp.diff_main(oldStr, newStr);
    dmp.diff_cleanupSemantic(diffs);

    const proofReads: ProofRead[] = [];
    let currentProofRead: ProofRead | null = null;
    let offset = 0;

    for (const [op, text] of diffs) {
      if (op === 0) {
        if (currentProofRead) {
          proofReads.push(currentProofRead);
          currentProofRead = null;
        }
        offset += text.length;
      } else if (op === -1) {
        if (!currentProofRead) {
          currentProofRead = {
            from: baseOffset + offset,
            to: baseOffset + offset + text.length,
            diff: "",
          };
        } else {
          currentProofRead.to += text.length;
        }
        offset += text.length;
      } else if (op === 1) {
        if (!currentProofRead) {
          currentProofRead = {
            from: baseOffset + offset,
            to: baseOffset + offset,
            diff: text,
          };
        } else {
          currentProofRead.diff += text;
        }
      }
    }

    if (currentProofRead) {
      proofReads.push(currentProofRead);
    }

    if (!hasFinished && proofReads.length > 0) {
      proofReads.pop();
    }

    return proofReads;
  }

  async proofReadSelection(): Promise<void> {
    const { state } = this.view;
    const { selection } = state;
    const { from, to } = selection.empty
      ? { from: 0, to: state.doc.nodeSize - 2 }
      : selection;

    if (!selection.empty) {
      const newSelection = TextSelection.create(
        state.doc,
        selection.from,
        selection.from
      );
      this.view.dispatch(state.tr.setSelection(newSelection));
    }

    const slice = state.doc.slice(from, to);
    const consumer = new BlockConsumer(from - slice.openStart);

    const { content } = slice;
    for (let i = 0; i < content.childCount; i++) {
      const child = content.child(i);
      if (child) {
        visit(child, consumer);
      }
    }

    this.view.dispatch(
      setCommand(state.tr, {
        type: "updateState",
        state: "proofReading",
      })
    );

    try {
      for (const [blockFrom, blockTo] of consumer.getTextRanges()) {
        await this.proofReadBlock(blockFrom, blockTo);
      }

      this.view.dispatch(
        setCommand(state.tr, {
          type: "updateState",
          state: "waiting",
        })
      );
    } catch (error) {
      this.view.dispatch(
        setCommand(state.tr, {
          type: "updateState",
          state: "idle",
        })
      );
      throw error;
    }
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  destroy(): void {
    this.abort();
  }
}