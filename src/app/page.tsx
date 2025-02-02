"use client";

import { useState, useCallback } from "react";
import { Column } from "./combini/Flex";
import styles from "./combini/Main.module.css";
import { LoadingAIProgressBar } from "./combini/LoadingAIProgressBar";
import { TextEditorWrapper } from "./components/TextEditorWrapper";
import { Footer } from "./combini/Footer";
import { Chat, TextMessage } from "./combini/Chat";
import { v4 as uuidv4 } from 'uuid';
import { AI } from "./api/ai/ai";
import { AIConfig } from "./api/ai/types";

if (typeof navigator === "undefined") {
  global.navigator = {
    userAgent: "nodejs",
    platform: "nodejs",
  } as Navigator;
}

export default function Home() {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<TextMessage[]>([]);
  const [input, setInput] = useState("");
  const [isChatLoading, setChatLoading] = useState(false);

  // Initialize AI with proper configuration
  const [ai] = useState(() => {
    const config: AIConfig = {
      apiEndpoint: 'http://127.0.0.1:5002',
      maxRetries: 3,
      retryDelay: 1000
    };
    return new AI(config);
  });

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isChatLoading) return;

    const userMessage: TextMessage = {
      id: uuidv4(),
      role: "user",
      content: input,
    };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInput("");
    setChatLoading(true);

    try {
      let currentResponse = "";
      await ai.request(
        {
          messages: [
            {
              role: "system",
              content: "You are a helpful AI assistant. Respond in a clear and friendly manner.",
            },
            ...messages.map(({ role, content }) => ({ role, content })),
            { role: userMessage.role, content: userMessage.content }
          ],
        },
        (text: string) => {
          currentResponse = text;
          setMessages((prevMessages) => {
            const newMessages = [...prevMessages];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage?.role === "assistant") {
              lastMessage.content = text;
              return newMessages;
            } else {
              return [
                ...newMessages,
                {
                  id: uuidv4(),
                  role: "assistant",
                  content: text,
                },
              ];
            }
          });
        }
      );
    } catch (error) {
      console.error("Error during chat:", error);
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          id: uuidv4(),
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <Column className={styles.container} gap="xs">
      <LoadingAIProgressBar
        progress={loadingProgress}
        className={styles.progressBar}
        errorMessage={error}
      />
      <Chat 
        messages={messages} 
        onSubmit={handleSubmit} 
        input={input} 
        handleInputChange={handleInputChange} 
        isLoading={isChatLoading} 
      />
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
