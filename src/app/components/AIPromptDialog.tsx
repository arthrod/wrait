import React, { useState } from 'react';
import { Dialog } from '../combini/Dialog';
import { Button } from '../combini/Button';
import { Textarea } from '../combini/Textarea';
import styles from './TextEditorWrapper.module.css';

interface AIPromptDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (prompt: string) => void;
}

export const AIPromptDialog: React.FC<AIPromptDialogProps> = ({
  open,
  onClose,
  onSubmit,
}) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onSubmit(prompt);
      setPrompt('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <form onSubmit={handleSubmit} className={styles.aiPromptForm}>
        <h2>Custom AI Prompt</h2>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your instructions for the AI..."
          rows={4}
        />
        <div className={styles.dialogButtons}>
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!prompt.trim()}>Submit</Button>
        </div>
      </form>
    </Dialog>
  );
};