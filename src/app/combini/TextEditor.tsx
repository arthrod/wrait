"use client";

import React from "react";
import styles from "./TextEditor.module.css";

interface TextEditorProps {
  className?: string;
  editorRef: React.RefObject<HTMLDivElement>;
  onMouseOver?: (e: React.MouseEvent<HTMLDivElement>) => void;
  children?: React.ReactNode;
}

export const TextEditor = ({
  className = "",
  editorRef,
  children,
  onMouseOver,
}: TextEditorProps) => {
  React.useEffect(() => {
    // Ensure editor gets focus when mounted
    if (editorRef.current) {
      editorRef.current.focus();
    }
  }, [editorRef]);
  const handleClick = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Ensure editor gets focus when clicking anywhere in the container
    if (editorRef.current) {
      editorRef.current.focus();
    }
  }, [editorRef]);

  return (
    <div className={`${styles.container} ${className}`} onClick={handleClick}>
      <div
        ref={editorRef}
        className={styles.editor}
        onMouseOver={onMouseOver}
        contentEditable="true"
        suppressContentEditableWarning={true}
        spellCheck="true"
        autoCorrect="off"
        autoCapitalize="off"
        translate="no"
        data-gramm="false" // Disable Grammarly
        role="textbox"
        aria-multiline="true"
        aria-label="Text editor content"
      />
      {children}
    </div>
  );
};
