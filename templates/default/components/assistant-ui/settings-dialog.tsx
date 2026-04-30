"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAIModes, ART_STYLES } from "@/hooks/use-ai-modes";
import { cn } from "@/lib/utils";
import {
  CheckIcon,
  CodeIcon,
  CopyIcon,
  ImageIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { type FC, useEffect, useState } from "react";

type GalleryImage = { filename: string; prompt: string; timestamp: string; base64: string };
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

const GalleryModal: FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/generate-image?gallery=1")
      .then((r) => r.json())
      .then((data) => setImages(data.images || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="relative max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-lg border bg-background shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="font-medium text-sm">Image Gallery ({images.length})</span>
          <button onClick={onClose} className="rounded p-1.5 text-muted-foreground hover:bg-muted"><XIcon className="size-4" /></button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-4">
          {loading && <p className="py-8 text-center text-muted-foreground text-sm">Loading...</p>}
          {!loading && images.length === 0 && <p className="py-8 text-center text-muted-foreground text-sm">No images generated yet</p>}
          {!loading && images.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((img, i) => (
                <div key={i} className="group relative overflow-hidden rounded-lg border">
                  <img src={`data:image/png;base64,${img.base64}`} alt={img.prompt} className="w-full" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <p className="truncate text-[10px] text-white">{img.prompt}</p>
                    <p className="text-[9px] text-white/60">{img.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const SettingsDialog: FC<SettingsDialogProps> = ({ open, onOpenChange }) => {
  const { enabled, setEnabled, activePresetId, setActivePreset, customPrompt, setCustomPrompt, presets, addPreset, deletePreset, imageSettings, setImageSettings } = useAIModes();
  const [tab, setTab] = useState<"general" | "image">("general");
  const [showJson, setShowJson] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [newColor, setNewColor] = useState("#10b981");

  return (
    <>
      <JsonViewer open={showJson} onClose={() => setShowJson(false)} />
      <GalleryModal open={showGallery} onClose={() => setShowGallery(false)} />
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle className="font-semibold text-lg">Customize Skyler</DialogTitle>
          <div className="flex items-center justify-between border-b">
            <div className="flex gap-1">
              {(["general", "image"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)} className={cn("px-3 py-1.5 font-medium text-sm transition-colors", tab === t ? "border-primary border-b-2 text-primary" : "text-muted-foreground hover:text-foreground")}>
                  {t === "general" ? "Instructions" : "Image"}
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

          {tab === "image" && (
            <div className="flex flex-col gap-4 pt-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Image Generation</p>
                  <p className="text-muted-foreground text-xs">Configure Perchance settings</p>
                </div>
                <button type="button" onClick={() => setShowGallery(true)} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted">
                  <ImageIcon className="size-3.5" /> Gallery
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-medium text-xs text-muted-foreground">Art Style</label>
                  <select value={imageSettings.artStyle} onChange={(e) => setImageSettings({ ...imageSettings, artStyle: e.target.value })} className="w-full rounded-lg border bg-background px-2 py-1.5 text-sm outline-none focus:border-ring/75 focus:ring-2 focus:ring-ring/20">
                    <option value="">Default</option>
                    {ART_STYLES.filter(Boolean).map((s) => (<option key={s} value={s}>{s}</option>))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-medium text-xs text-muted-foreground">Shape</label>
                  <select value={imageSettings.shape} onChange={(e) => setImageSettings({ ...imageSettings, shape: e.target.value })} className="w-full rounded-lg border bg-background px-2 py-1.5 text-sm outline-none focus:border-ring/75 focus:ring-2 focus:ring-ring/20">
                    <option value="">Default</option>
                    <option value="Square">Square</option>
                    <option value="Portrait">Portrait</option>
                    <option value="Landscape">Landscape</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-xs text-muted-foreground">Images per prompt</label>
                <div className="flex gap-2">
                  {[1, 2, 3].map((n) => (
                    <button key={n} type="button" onClick={() => setImageSettings({ ...imageSettings, imageCount: n })}
                      className={cn("flex-1 rounded-lg border py-2 text-center text-sm font-medium transition-all", imageSettings.imageCount === n ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
                      {n} {n === 1 ? "image" : "images"}
                    </button>
                  ))}
                </div>
              </div>

              {(imageSettings.artStyle || imageSettings.shape) && (
                <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  {imageSettings.artStyle && <span>Style: <span className="font-medium text-foreground">{imageSettings.artStyle}</span></span>}
                  {imageSettings.artStyle && imageSettings.shape && <span> · </span>}
                  {imageSettings.shape && <span>Shape: <span className="font-medium text-foreground">{imageSettings.shape}</span></span>}
                </div>
              )}

              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="mb-2 font-medium text-xs">@ Commands</p>
                <div className="flex flex-col gap-1.5 text-[11px] text-muted-foreground">
                  {[
                    ["@image", "Generate a single image"],
                    ["@story", "Break into 2-3 sequential scenes"],
                    ["@scene", "Visualize current chat moment"],
                    ["@enhance", "Ultra deep thinking for one message"],
                    ["@raw", "Send exact prompt to image gen"],
                  ].map(([cmd, desc]) => (
                    <div key={cmd} className="flex items-center gap-2">
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">{cmd}</code>
                      <span>{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
