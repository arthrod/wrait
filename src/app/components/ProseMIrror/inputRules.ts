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

// Matches '>', '1.', '1)', '(1)' at the start of a line
const blockQuoteRule = wrappingInputRule(
  /^\s*>\s$/,
  textSchema.nodes.blockquote
);

const orderedListRule = wrappingInputRule(
  /^(\d+)\.\s$/,
  textSchema.nodes.ordered_list,
  (match: string[]): { order: number } => ({ order: +match[1] }),
  (match: string[], node: Node): boolean => node.childCount + node.attrs.order === +match[1]
);

const bulletListRule = wrappingInputRule(
  /^\s*([-+*])\s$/,
  textSchema.nodes.bullet_list
);

// Matches '```' or '~~~' at the start of a line
const codeBlockRule = textblockTypeInputRule(
  /^```|~~~$/,
  textSchema.nodes.code_block
);

// Matches '#', '##', '###' at the start of a line
const headingRule = textblockTypeInputRule(
  /^(#{1,3})\s$/,
  textSchema.nodes.heading,
  (match: string[]): { level: number } => ({ level: match[1].length })
);

// Matches '---', '***', '___' on a line by itself
const horizontalRuleRule = new InputRule(
  /^(?:---|___|\*\*\*)\s$/, 
  (state: EditorState, match: string[], start: number, end: number): Transaction | null => {
    const tr = state.tr;
    if (match[0]) {
      tr.replaceRangeWith(start, end, textSchema.nodes.horizontal_rule.create());
      return tr;
    }
    return null;
  }
);

// Combine all input rules
export const buildInputRules = () => {
  const rules = smartQuotes.concat([
    ellipsis,
    emDash,
    blockQuoteRule,
    orderedListRule,
    bulletListRule,
    codeBlockRule,
    headingRule,
    horizontalRuleRule
  ]);

  return inputRules({ rules });
};