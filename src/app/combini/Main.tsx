// This component has been replaced by page.tsx
// Keeping this file as a reference for now, but it should be removed
// once we confirm page.tsx is working correctly

import React from "react";
import styles from "./Main.module.css";

interface MainProps {
  className?: string;
  children?: React.ReactNode;
}

export const Main = ({ className, children }: MainProps) => {
  return (
    <div className={`${styles.container} ${className || ""}`}>
      <main className={styles.mainArea}>
        {children}
      </main>
    </div>
  );
};
