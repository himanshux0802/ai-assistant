"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useSettings } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";
import {
  DownloadIcon,
  FolderOpenIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { type FC, useCallback, useEffect, useState } from "react";

type SavedThread = {
  id: string;
  title: string;
  updatedAt: string;
};

type SettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const SettingsDialog: FC<SettingsDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const {
    systemPromptEnabled,
    setSystemPromptEnabled,
    systemPrompt,
    setSystemPrompt,
  } = useSettings();

  const [threads, setThreads] = useState<SavedThread[]>([]);
  const [tab, setTab] = useState<"general" | "history">("general");

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/threads");
      if (res.ok) setThreads(await res.json());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (open && tab === "history") loadThreads();
  }, [open, tab, loadThreads]);

  const deleteThread = async (id: string) => {
    await fetch(`/api/threads?id=${id}`, { method: "DELETE" });
    setThreads((t) => t.filter((x) => x.id !== id));
  };

  const renameThread = async (id: string, currentTitle: string) => {
    const newTitle = prompt("Rename chat:", currentTitle);
    if (!newTitle || newTitle === currentTitle) return;
    await fetch("/api/threads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, title: newTitle }),
    });
    setThreads((t) =>
      t.map((x) => (x.id === id ? { ...x, title: newTitle } : x)),
    );
  };

  const exportThread = async (id: string, title: string) => {
    const res = await fetch(`/api/threads?id=${id}`);
    if (!res.ok) return;
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogTitle className="font-semibold text-lg">Settings</DialogTitle>

        {/* Tabs */}
        <div className="flex gap-1 border-b">
          <button
            type="button"
            onClick={() => setTab("general")}
            className={cn(
              "px-3 py-1.5 font-medium text-sm transition-colors",
              tab === "general"
                ? "border-primary border-b-2 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            General
          </button>
          <button
            type="button"
            onClick={() => setTab("history")}
            className={cn(
              "px-3 py-1.5 font-medium text-sm transition-colors",
              tab === "history"
                ? "border-primary border-b-2 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Chat History
          </button>
        </div>

        {tab === "general" && (
          <div className="flex flex-col gap-4 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">System Prompt</p>
                <p className="text-muted-foreground text-xs">
                  Custom instructions for the AI
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={systemPromptEnabled}
                onClick={() => setSystemPromptEnabled(!systemPromptEnabled)}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                  systemPromptEnabled ? "bg-primary" : "bg-input",
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none block size-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
                    systemPromptEnabled ? "translate-x-5" : "translate-x-0",
                  )}
                />
              </button>
            </div>

            {systemPromptEnabled && (
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="You are a helpful assistant..."
                className="min-h-32 w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-ring/75 focus:ring-2 focus:ring-ring/20"
                rows={5}
              />
            )}
          </div>
        )}

        {tab === "history" && (
          <div className="flex flex-col gap-2 pt-2">
            {threads.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground text-sm">
                No saved chats yet
              </p>
            ) : (
              <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                {threads.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-sm">{t.title}</p>
                      <p className="text-muted-foreground text-xs">
                        {new Date(t.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => renameThread(t.id, t.title)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Rename"
                      >
                        <PencilIcon className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => exportThread(t.id, t.title)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Export as JSON"
                      >
                        <DownloadIcon className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteThread(t.id)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2Icon className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Import */}
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-muted-foreground text-sm transition-colors hover:bg-muted">
              <FolderOpenIcon className="size-4" />
              Import chat from JSON
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    if (data.id && data.messages) {
                      await fetch("/api/threads", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(data),
                      });
                      loadThreads();
                    }
                  } catch {
                    // invalid file
                  }
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
