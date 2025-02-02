"use client";

import { useState, useCallback } from "react";
import { Column } from "./combini/Flex";
import styles from "./combini/Main.module.css";
import { LoadingAIProgressBar } from "./combini/LoadingAIProgressBar";
import { TextEditorWrapper } from "./components/TextEditorWrapper";
import { Footer } from "./combini/Footer";
import { Chat, Message } from "./combini/Chat"; // Import Chat Component
import { v4 as uuidv4 } from 'uuid'; // Import UUID for message IDs

if (typeof navigator === "undefined") {
  global.navigator = {
    userAgent: "nodejs",
    platform: "nodejs",
  } as Navigator;
}

export default function Home() {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([ // Initialize messages state
    {
      id: uuidv4(),
      role: "assistant",
      content: "Hello! How can I help you today?",
    },
  ]);
  const [input, setInput] = useState(""); // Initialize input state
  const [isChatLoading, setChatLoading] = useState(false); // Initialize loading state for chat

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  const handleChatSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (input.trim()) {
        setChatLoading(true);
        const userMessage: Message = { // Create user message
          id: uuidv4(),
          role: "user",
          content: input,
        };
        setMessages((prevMessages) => [...prevMessages, userMessage]); // Add user message to chat
        setInput(""); // Clear input field

        try {
          // **Backend Call to Litellm will go here**
          // For now, a placeholder AI response:
          await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate AI delay
          const aiResponse: Message = {
            id: uuidv4(),
            role: "assistant",
            content: `Echo: ${input}`, // Replace with actual AI response from litellm
          };
          setMessages((prevMessages) => [...prevMessages, aiResponse]); // Add AI response
        } catch (err) {
          console.error("Error during chat:", err);
          // Handle error appropriately (e.g., display error message in chat)
        } finally {
          setChatLoading(false);
        }
      }
    },
    [input]
  );

  return (
    <Column className={styles.container} gap="xs">
      <LoadingAIProgressBar
        progress={loadingProgress}
        className={styles.progressBar}
        errorMessage={error}
      />
      <Chat messages={messages} onSubmit={handleChatSubmit} input={input} handleInputChange={handleInputChange} isLoading={isChatLoading} /> {/* Add Chat Component */}
      <TextEditorWrapper
        hasLoadedAI={loadingProgress === 100}
        onProgress={(n) => setLoadingProgress(n * 100)}
        onLoadError={(e) => setError(e)}
        onHasLoadedAI={() => {
          setLoadingProgress(100);
        }}
      />
      <Footer className={styles.footer} />
    </Column>
  );
}
