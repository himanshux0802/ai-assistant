"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAIModes } from "@/hooks/use-ai-modes";
import { cn } from "@/lib/utils";
import {
  CheckIcon,
  CodeIcon,
  CopyIcon,
  DownloadIcon,
  FolderOpenIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { type FC, useCallback, useEffect, useState } from "react";

type SavedThread = { id: string; title: string; updatedAt: string };
type SettingsDialogProps = { open: boolean; onOpenChange: (open: boolean) => void };

const JsonViewer: FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const ctx = useAIModes();
  const [copied, setCopied] = useState(false);
  if (!open) return null;
  const json = JSON.stringify({ enabled: ctx.enabled, thinking: ctx.thinking, activePresetId: ctx.activePresetId, customPrompt: ctx.customPrompt, effectivePrompt: ctx.effectivePrompt, presets: ctx.presets }, null, 2);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="relative max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-lg border bg-background shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="font-medium text-sm">Configuration JSON</span>
          <div className="flex items-center gap-1">
            <button onClick={() => { navigator.clipboard.writeText(json); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="rounded p-1.5 text-muted-foreground hover:bg-muted">
              {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
            </button>
            <button onClick={onClose} className="rounded p-1.5 text-muted-foreground hover:bg-muted"><XIcon className="size-4" /></button>
          </div>
        </div>
        <pre className="max-h-[70vh] overflow-auto p-4 text-xs leading-relaxed"><code>{json}</code></pre>
      </div>
    </div>
  );
};

export const SettingsDialog: FC<SettingsDialogProps> = ({ open, onOpenChange }) => {
  const { enabled, setEnabled, activePresetId, setActivePreset, customPrompt, setCustomPrompt, presets, addPreset, deletePreset } = useAIModes();
  const [threads, setThreads] = useState<SavedThread[]>([]);
  const [tab, setTab] = useState<"general" | "history">("general");
  const [showJson, setShowJson] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [newColor, setNewColor] = useState("#10b981");

  const loadThreads = useCallback(async () => {
    try { const res = await fetch("/api/threads"); if (res.ok) setThreads(await res.json()); } catch {}
  }, []);
  useEffect(() => { if (open && tab === "history") loadThreads(); }, [open, tab, loadThreads]);

  const deleteThread = async (id: string) => { await fetch(`/api/threads?id=${id}`, { method: "DELETE" }); setThreads((t) => t.filter((x) => x.id !== id)); };
  const renameThread = async (id: string, cur: string) => { const n = prompt("Rename chat:", cur); if (!n || n === cur) return; await fetch("/api/threads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, title: n }) }); setThreads((t) => t.map((x) => (x.id === id ? { ...x, title: n } : x))); };
  const exportThread = async (id: string, title: string) => { const res = await fetch(`/api/threads?id=${id}`); if (!res.ok) return; const data = await res.json(); const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${title.replace(/[^a-zA-Z0-9]/g, "_")}.json`; a.click(); URL.revokeObjectURL(url); };

  return (
    <>
      <JsonViewer open={showJson} onClose={() => setShowJson(false)} />
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle className="font-semibold text-lg">Customize Skyler</DialogTitle>
          <div className="flex items-center justify-between border-b">
            <div className="flex gap-1">
              {(["general", "history"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)} className={cn("px-3 py-1.5 font-medium text-sm transition-colors", tab === t ? "border-primary border-b-2 text-primary" : "text-muted-foreground hover:text-foreground")}>
                  {t === "general" ? "Instructions" : "Chat History"}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setShowJson(true)} className="rounded p-1.5 text-muted-foreground hover:bg-muted" title="View JSON Config"><CodeIcon className="size-4" /></button>
          </div>

          {tab === "general" && (
            <div className="flex flex-col gap-4 pt-1">
              <div>
                <p className="font-medium text-sm">Instructions</p>
                <p className="text-muted-foreground text-xs">Choose how Skyler should behave</p>
              </div>

              {/* Preset buttons — always visible */}
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => { setEnabled(false); setActivePreset(null); }}
                  className={cn("flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all", !enabled ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
                  Default {!enabled && <CheckIcon className="size-3" />}
                </button>
                <button type="button" onClick={() => { setEnabled(true); setActivePreset(null); }}
                  className={cn("flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all", enabled && activePresetId === null ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
                  Custom {enabled && activePresetId === null && <CheckIcon className="size-3" />}
                </button>
                {presets.map((p) => (
                  <div key={p.id} className="group relative flex items-center">
                    <button type="button" onClick={() => { setEnabled(true); setActivePreset(p.id); }}
                      className={cn("flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all", enabled && activePresetId === p.id ? "border-2 shadow-sm" : "text-muted-foreground hover:bg-muted")}
                      style={enabled && activePresetId === p.id ? { borderColor: p.color, backgroundColor: `${p.color}15`, color: p.color } : undefined}>
                      {p.name} {enabled && activePresetId === p.id && <CheckIcon className="size-3" />}
                    </button>
                    {!p.builtin && (
                      <button type="button" onClick={() => deletePreset(p.id)} className="ml-0.5 hidden rounded-full p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:block">
                        <XIcon className="size-3" />
                      </button>
                    )}
                  </div>
                ))}
                {!creating && (
                  <button type="button" onClick={() => setCreating(true)} className="flex items-center gap-1 rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted">
                    <PlusIcon className="size-3" /> Add
                  </button>
                )}
              </div>

              {creating && (
                <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
                  <div className="flex items-center gap-2">
                    <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="size-7 cursor-pointer rounded border-none bg-transparent" />
                    <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Preset name..." className="flex-1 rounded border bg-background px-2 py-1 text-sm outline-none" />
                  </div>
                  <textarea value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} placeholder="System prompt..." className="min-h-16 w-full resize-y rounded border bg-background px-2 py-1.5 text-sm outline-none" rows={2} />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setCreating(false); setNewName(""); setNewPrompt(""); }}>Cancel</Button>
                    <Button size="sm" disabled={!newName.trim()} onClick={() => { addPreset({ name: newName, prompt: newPrompt, color: newColor }); setCreating(false); setNewName(""); setNewPrompt(""); setNewColor("#10b981"); }}>Create</Button>
                  </div>
                </div>
              )}

              {/* Textarea — only when not Default */}
              {enabled && (
                activePresetId ? (
                  <div className="relative">
                    <textarea value={presets.find((p) => p.id === activePresetId)?.prompt || ""} readOnly className="min-h-28 w-full resize-y rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground outline-none" rows={4} />
                    <span className="absolute top-2 right-3 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">read-only</span>
                  </div>
                ) : (
                  <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} placeholder="How should Skyler behave?" className="min-h-28 w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-ring/75 focus:ring-2 focus:ring-ring/20" rows={4} />
                )
              )}
            </div>
          )}

          {tab === "history" && (
            <div className="flex flex-col gap-2 pt-2">
              {threads.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground text-sm">No saved chats yet</p>
              ) : (
                <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                  {threads.map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-sm">{t.title}</p>
                        <p className="text-muted-foreground text-xs">{new Date(t.updatedAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => renameThread(t.id, t.title)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Rename"><PencilIcon className="size-3.5" /></button>
                        <button type="button" onClick={() => exportThread(t.id, t.title)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Export"><DownloadIcon className="size-3.5" /></button>
                        <button type="button" onClick={() => deleteThread(t.id)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete"><Trash2Icon className="size-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-muted-foreground text-sm transition-colors hover:bg-muted">
                <FolderOpenIcon className="size-4" /> Import chat from JSON
                <input type="file" accept=".json" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { const text = await file.text(); const data = JSON.parse(text); if (data.id && data.messages) { await fetch("/api/threads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); loadThreads(); } } catch {} e.target.value = ""; }} />
              </label>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
