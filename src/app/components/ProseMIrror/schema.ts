import { Schema } from "prosemirror-model";
import styles from "../TextEditorWrapper.module.css";

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
    },
    heading: {
      attrs: { level: { default: 1 } },
      content: "inline*",
      group: "block",
      defining: true,
      parseDOM: [
        { tag: "h1", attrs: { level: 1 } },
        { tag: "h2", attrs: { level: 2 } },
        { tag: "h3", attrs: { level: 3 } }
      ],
      toDOM(node) { return ["h" + node.attrs.level, 0] }
    },
    blockquote: {
      group: "block",
      content: "block+",
      defining: true,
      parseDOM: [{ tag: "blockquote" }],
      toDOM() { return ["blockquote", 0] }
    },
    code_block: {
      group: "block",
      content: "text*",
      code: true,
      defining: true,
      marks: "",
      parseDOM: [{ tag: "pre", preserveWhitespace: "full" }],
      toDOM() { return ["pre", ["code", 0]] }
    },
    horizontal_rule: {
      group: "block",
      parseDOM: [{ tag: "hr" }],
      toDOM() { return ["hr"] }
    },
    ordered_list: {
      group: "block",
      content: "list_item+",
      attrs: { order: { default: 1 } },
      parseDOM: [{
        tag: "ol",
        getAttrs(dom) {
          return { order: (dom as HTMLElement).hasAttribute("start") ? +(dom as HTMLElement).getAttribute("start")! : 1 }
        }
      }],
      toDOM(node) {
        return node.attrs.order === 1 ? ["ol", 0] : ["ol", { start: node.attrs.order }, 0]
      }
    },
    bullet_list: {
      group: "block",
      content: "list_item+",
      parseDOM: [{ tag: "ul" }],
      toDOM() { return ["ul", 0] }
    },
    list_item: {
      content: "paragraph block*",
      defining: true,
      parseDOM: [{ tag: "li" }],
      toDOM() { return ["li", 0] }
    },
    hard_break: {
      inline: true,
      group: "inline",
      selectable: false,
      parseDOM: [{ tag: "br" }],
      toDOM() { return ["br"] }
    },
    doc: { content: "block+" },
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
    bold: {
      parseDOM: [
        { tag: "strong" },
        { tag: "b" },
        {
          style: "font-weight",
          getAttrs: (value) => {
            if (typeof value === 'string') {
              return value === "bold" || value === "700" ? {} : false;
            }
            return false;
          }
        }
      ],
      toDOM() { return ["strong", 0] }
    },
    italic: {
      parseDOM: [
        { tag: "i" },
        { tag: "em" },
        { style: "font-style=italic" }
      ],
      toDOM() { return ["em", 0] }
    },
    underline: {
      parseDOM: [
        { tag: "u" },
        { style: "text-decoration=underline" }
      ],
      toDOM() { return ["u", 0] }
    },
    highlight: {
      parseDOM: [{ tag: "mark" }],
      toDOM() { return ["mark", 0] }
    },
    textColor: {
      attrs: { color: {} },
      parseDOM: [{
        style: "color",
        getAttrs: color => ({ color })
      }],
      toDOM(mark) { return ["span", { style: `color: ${mark.attrs.color}` }, 0] }
    },
    link: {
      attrs: {
        href: {},
        title: { default: null }
      },
      inclusive: false,
      parseDOM: [{
        tag: "a[href]",
        getAttrs(dom) {
          return {
            href: (dom as HTMLElement).getAttribute("href"),
            title: (dom as HTMLElement).getAttribute("title")
          }
        }
      }],
      toDOM(node) { return ["a", node.attrs, 0] }
    },
    code: {
      excludes: "_",
      parseDOM: [{ tag: "code" }],
      toDOM() { return ["code", 0] }
    },
    subscript: {
      excludes: "superscript",
      parseDOM: [{ tag: "sub" }, { style: "vertical-align=sub" }],
      toDOM() { return ["sub", 0] }
    },
    superscript: {
      excludes: "subscript",
      parseDOM: [{ tag: "sup" }, { style: "vertical-align=super" }],
      toDOM() { return ["sup", 0] }
    },
    strikethrough: {
      parseDOM: [
        { tag: "strike" },
        { tag: "s" },
        { tag: "del" },
        { style: "text-decoration=line-through" }
      ],
      toDOM() { return ["s", 0] }
    },
  },
});
