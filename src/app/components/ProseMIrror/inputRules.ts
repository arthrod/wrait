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

// Helper to ensure rules only trigger at start of line/block
const atStartOnly = (regex: RegExp) => new RegExp(`^(?:${regex.source})$`);

// Matches '>' at the start of a line for blockquotes
const blockQuoteRule = wrappingInputRule(
  atStartOnly(/\s*>\s/),
  textSchema.nodes.blockquote
);

// Matches '1.' at the start of a line for ordered lists
const orderedListRule = wrappingInputRule(
  atStartOnly(/(\d+)\.\s/),
  textSchema.nodes.ordered_list,
  (match: string[]): { order: number } => ({ order: +match[1] }),
  (match: string[], node: Node): boolean => node.childCount + node.attrs.order === +match[1]
);

// Matches '-', '+', '*' at the start of a line for bullet lists
const bulletListRule = wrappingInputRule(
  atStartOnly(/\s*([-+*])\s/),
  textSchema.nodes.bullet_list
);

// Matches '```' at the start of a line for code blocks
const codeBlockRule = textblockTypeInputRule(
  atStartOnly(/```/),
  textSchema.nodes.code_block
);

// Matches '#', '##', '###' at the start of a line for headings
const headingRule = textblockTypeInputRule(
  atStartOnly(/(#{1,3})\s/),
  textSchema.nodes.heading,
  (match: string[]): { level: number } => ({ level: match[1].length })
);

// Matches '---' on a line by itself for horizontal rules
const horizontalRuleRule = new InputRule(
  atStartOnly(/(?:---|___|\*\*\*)/),
  (state: EditorState, match: string[], start: number, end: number): Transaction | null => {
    // Only apply if we're at the start of a block
    if (start === 0 || state.doc.resolve(start).parent.type.name === "paragraph") {
      const tr = state.tr;
      tr.replaceRangeWith(start, end, textSchema.nodes.horizontal_rule.create());
      return tr;
    }
    return null;
  }
);

// Combine all input rules
export const buildInputRules = () => {
  // Basic typography rules
  const typographyRules = [
    ...smartQuotes,  // Smart quotes ('' -> "", etc.)
    ellipsis,        // ... -> ...
    emDash,          // -- -> —
  ];

  // Block structure rules
  const blockRules = [
    blockQuoteRule,   // > -> blockquote
    orderedListRule,  // 1. -> ordered list
    bulletListRule,   // - -> bullet list
    headingRule,      // # -> heading
  ];

  // Special block rules that should be handled carefully
  const specialRules = [
    codeBlockRule,      // ``` -> code block
    horizontalRuleRule, // --- -> horizontal rule
  ];

  // Combine all rules in order of precedence
  const rules = [
    ...typographyRules,  // Typography rules first (least disruptive)
    ...blockRules,       // Block structure rules next
    ...specialRules,     // Special rules last (most disruptive)
  ];
  return inputRules({ rules });
};