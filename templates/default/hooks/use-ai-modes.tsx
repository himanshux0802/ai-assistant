"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Preset = {
  id: string;
  name: string;
  prompt: string;
  color: string;
  builtin?: boolean;
};

const BUILTIN_PRESETS: Preset[] = [
  { id: "concise", name: "Concise", prompt: "Be extremely concise and direct. Give the shortest possible answer. No filler.", color: "#f97316", builtin: true },
  { id: "formal", name: "Formal", prompt: "Respond in a formal, professional tone. Use proper grammar and structured responses.", color: "#3b82f6", builtin: true },
  { id: "creative", name: "Creative", prompt: "Be highly creative and imaginative. Think outside the box, use vivid language and novel ideas.", color: "#a855f7", builtin: true },
  { id: "comprehensive", name: "Comprehensive", prompt: "Provide thorough, detailed responses. Cover all angles and edge cases.", color: "#10b981", builtin: true },
];

export type ImageMode = "off" | "ai" | "image";

const STORAGE_PRESETS = "skyler-custom-presets";
const STORAGE_ACTIVE = "skyler-active-preset";
const STORAGE_CUSTOM_PROMPT = "skyler-custom-prompt";
const STORAGE_ENABLED = "skyler-prompt-enabled";
const STORAGE_THINKING = "skyler-thinking";
const STORAGE_IMAGE_MODE = "skyler-image-mode";
const STORAGE_IMAGE_SETTINGS = "skyler-image-settings";

export type ImageSettings = {
  artStyle: string;
  shape: string;
  guidanceScale: string;
  negativePrompt: string;
};

const DEFAULT_IMAGE_SETTINGS: ImageSettings = {
  artStyle: "Painted Anime Plus",
  shape: "Portrait(512x768px)",
  guidanceScale: "default(7)",
  negativePrompt: "",
};

type ContextType = {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  activePresetId: string | null;
  setActivePreset: (id: string | null) => void;
  customPrompt: string;
  setCustomPrompt: (v: string) => void;
  effectivePrompt: string;
  presets: Preset[];
  addPreset: (p: Omit<Preset, "id">) => void;
  deletePreset: (id: string) => void;
  thinking: boolean;
  toggleThinking: () => void;
  imageMode: ImageMode;
  setImageMode: (m: ImageMode) => void;
  imageSettings: ImageSettings;
  setImageSettings: (s: ImageSettings) => void;
};

const Ctx = createContext<ContextType>({
  enabled: false,
  setEnabled: () => {},
  activePresetId: null,
  setActivePreset: () => {},
  customPrompt: "",
  setCustomPrompt: () => {},
  effectivePrompt: "",
  presets: BUILTIN_PRESETS,
  addPreset: () => {},
  deletePreset: () => {},
  thinking: false,
  toggleThinking: () => {},
  imageMode: "off",
  setImageMode: () => {},
  imageSettings: DEFAULT_IMAGE_SETTINGS,
  setImageSettings: () => {},
});

export const useAIModes = () => useContext(Ctx);

export const AIModeProvider = ({ children }: { children: ReactNode }) => {
  const [enabled, setEnabled] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [customPresets, setCustomPresets] = useState<Preset[]>([]);
  const [thinking, setThinking] = useState(false);
  const [imageMode, setImageModeState] = useState<ImageMode>("off");
  const [imageSettings, setImageSettingsState] = useState<ImageSettings>(DEFAULT_IMAGE_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(STORAGE_ENABLED) === "1");
      setActivePresetId(localStorage.getItem(STORAGE_ACTIVE) || null);
      setCustomPrompt(localStorage.getItem(STORAGE_CUSTOM_PROMPT) || "");
      setThinking(localStorage.getItem(STORAGE_THINKING) === "1");
      setImageModeState((localStorage.getItem(STORAGE_IMAGE_MODE) as ImageMode) || "off");
      const storedPresets = localStorage.getItem(STORAGE_PRESETS);
      if (storedPresets) setCustomPresets(JSON.parse(storedPresets));
      const storedImgSettings = localStorage.getItem(STORAGE_IMAGE_SETTINGS);
      if (storedImgSettings) setImageSettingsState(JSON.parse(storedImgSettings));
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => { if (loaded) localStorage.setItem(STORAGE_ENABLED, enabled ? "1" : "0"); }, [enabled, loaded]);
  useEffect(() => { if (loaded) localStorage.setItem(STORAGE_ACTIVE, activePresetId || ""); }, [activePresetId, loaded]);
  useEffect(() => { if (loaded) localStorage.setItem(STORAGE_CUSTOM_PROMPT, customPrompt); }, [customPrompt, loaded]);
  useEffect(() => { if (loaded) localStorage.setItem(STORAGE_THINKING, thinking ? "1" : "0"); }, [thinking, loaded]);
  useEffect(() => { if (loaded) localStorage.setItem(STORAGE_PRESETS, JSON.stringify(customPresets)); }, [customPresets, loaded]);
  useEffect(() => { if (loaded) localStorage.setItem(STORAGE_IMAGE_MODE, imageMode); }, [imageMode, loaded]);
  useEffect(() => { if (loaded) localStorage.setItem(STORAGE_IMAGE_SETTINGS, JSON.stringify(imageSettings)); }, [imageSettings, loaded]);

  const presets = [...BUILTIN_PRESETS, ...customPresets];

  // When a preset is selected, use its prompt. When "custom" (null), use customPrompt.
  const activePreset = activePresetId
    ? presets.find((p) => p.id === activePresetId)
    : null;
  const effectivePrompt = enabled
    ? activePreset
      ? activePreset.prompt
      : customPrompt
    : "";

  const setActivePreset = useCallback((id: string | null) => setActivePresetId(id), []);
  const addPreset = useCallback((p: Omit<Preset, "id">) => setCustomPresets((prev) => [...prev, { ...p, id: `custom-${Date.now()}` }]), []);
  const deletePreset = useCallback((id: string) => { setCustomPresets((prev) => prev.filter((p) => p.id !== id)); if (activePresetId === id) setActivePresetId(null); }, [activePresetId]);
  const toggleThinking = useCallback(() => setThinking((v) => !v), []);
  const setImageMode = useCallback((m: ImageMode) => setImageModeState(m), []);
  const setImageSettings = useCallback((s: ImageSettings) => setImageSettingsState(s), []);

  return (
    <Ctx.Provider
      value={{
        enabled, setEnabled,
        activePresetId, setActivePreset,
        customPrompt, setCustomPrompt,
        effectivePrompt,
        presets, addPreset, deletePreset,
        thinking, toggleThinking,
        imageMode, setImageMode,
        imageSettings, setImageSettings,
      }}
    >
      {children}
    </Ctx.Provider>
  );
};
