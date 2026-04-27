"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type ThinkingModeContextType = {
  enabled: boolean;
  toggle: () => void;
};

const ThinkingModeContext = createContext<ThinkingModeContextType>({
  enabled: false,
  toggle: () => {},
});

export const useThinkingMode = () => useContext(ThinkingModeContext);

export const ThinkingModeProvider = ({ children }: { children: ReactNode }) => {
  const [enabled, setEnabled] = useState(false);
  return (
    <ThinkingModeContext.Provider
      value={{ enabled, toggle: () => setEnabled((v) => !v) }}
    >
      {children}
    </ThinkingModeContext.Provider>
  );
};
