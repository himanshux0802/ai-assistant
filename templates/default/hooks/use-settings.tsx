"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type SettingsContextType = {
  systemPromptEnabled: boolean;
  setSystemPromptEnabled: (v: boolean) => void;
  systemPrompt: string;
  setSystemPrompt: (v: string) => void;
};

const DEFAULT_SYSTEM_PROMPT = "";

const SettingsContext = createContext<SettingsContextType>({
  systemPromptEnabled: false,
  setSystemPromptEnabled: () => {},
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  setSystemPrompt: () => {},
});

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [systemPromptEnabled, setSystemPromptEnabled] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);

  return (
    <SettingsContext.Provider
      value={{
        systemPromptEnabled,
        setSystemPromptEnabled,
        systemPrompt,
        setSystemPrompt,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};
