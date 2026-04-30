import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from "@/components/assistant-ui/attachment";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import { Reasoning, ReasoningGroup } from "@/components/assistant-ui/reasoning";
import { ToolFallback } from "@/components/assistant-ui/tool-fallback";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ActionBarMorePrimitive,
  ActionBarPrimitive,
  AuiIf,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  SuggestionPrimitive,
  ThreadPrimitive,
  useAuiState,
  useMessageTiming,
} from "@assistant-ui/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BrainIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CodeIcon,
  CopyIcon,
  DownloadIcon,
  FileTextIcon,
  ImageIcon,
  InfoIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PencilIcon,
  RefreshCwIcon,
  SettingsIcon,
  SquareIcon,
  XIcon,
  ZapIcon,
} from "lucide-react";
import { type FC, useCallback, useEffect, useRef, useState } from "react";
import { useAIModes } from "@/hooks/use-ai-modes";
import { SettingsDialog } from "@/components/assistant-ui/settings-dialog";
import { CharacterPanel } from "@/components/assistant-ui/character-panel";

const AT_COMMANDS = [
  { id: "image", label: "@image", icon: "🖼️", desc: "Generate a single image" },
  { id: "story", label: "@story", icon: "📖", desc: "Generate sequential scenes" },
  { id: "scene", label: "@scene", icon: "🎬", desc: "Visualize current chat" },
  { id: "enhance", label: "@enhance", icon: "🧠", desc: "Ultra deep thinking" },
  { id: "raw", label: "@raw", icon: "⚡", desc: "Direct prompt to image gen" },
] as const;

export const Thread: FC = () => {
  return (
    <ThreadPrimitive.Root
      className="aui-root aui-thread-root @container flex h-full flex-col bg-background"
      style={{
        ["--thread-max-width" as string]: "44rem",
        ["--composer-radius" as string]: "24px",
        ["--composer-padding" as string]: "10px",
      }}
    >
      <ThreadPrimitive.Viewport
        turnAnchor="top"
        data-slot="aui_thread-viewport"
        className="relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth"
      >
        <div className="mx-auto flex w-full max-w-(--thread-max-width) flex-1 flex-col px-4 pt-4">
          <AuiIf condition={(s) => s.thread.isEmpty}>
            <ThreadWelcome />
          </AuiIf>

          <div
            data-slot="aui_message-group"
            className="mb-10 flex flex-col gap-y-8 empty:hidden"
          >
            <ThreadPrimitive.Messages>
              {() => <ThreadMessage />}
            </ThreadPrimitive.Messages>
          </div>

          <ThreadPrimitive.ViewportFooter className="aui-thread-viewport-footer sticky bottom-0 mt-auto flex flex-col gap-4 overflow-visible rounded-t-(--composer-radius) bg-background pb-4 md:pb-6">
            <ThreadScrollToBottom />
            <Composer />
          </ThreadPrimitive.ViewportFooter>
        </div>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
};

const ThreadMessage: FC = () => {
  const role = useAuiState((s) => s.message.role);
  const isEditing = useAuiState((s) => s.message.composer.isEditing);

  if (isEditing) return <EditComposer />;
  if (role === "user") return <UserMessage />;
  return <AssistantMessage />;
};

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        variant="outline"
        className="aui-thread-scroll-to-bottom absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible dark:border-border dark:bg-background dark:hover:bg-accent"
      >
        <ArrowDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

const ThreadWelcome: FC = () => {
  return (
    <div className="aui-thread-welcome-root my-auto flex grow flex-col">
      <div className="aui-thread-welcome-center flex w-full grow flex-col items-center justify-center">
        <div className="aui-thread-welcome-message flex size-full flex-col justify-center px-4">
          <h1 className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in fill-mode-both font-semibold text-2xl duration-200">
            Hey, I&apos;m Skyler
          </h1>
          <p className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in fill-mode-both text-muted-foreground text-xl delay-75 duration-200">
            How can I help you today?
          </p>
        </div>
      </div>
      <ThreadSuggestions />
    </div>
  );
};

const ThreadSuggestions: FC = () => {
  return (
    <div className="aui-thread-welcome-suggestions grid w-full @md:grid-cols-2 gap-2 pb-4">
      <ThreadPrimitive.Suggestions>
        {() => <ThreadSuggestionItem />}
      </ThreadPrimitive.Suggestions>
    </div>
  );
};

const ThreadSuggestionItem: FC = () => {
  return (
    <div className="aui-thread-welcome-suggestion-display fade-in slide-in-from-bottom-2 @md:nth-[n+3]:block nth-[n+3]:hidden animate-in fill-mode-both duration-200">
      <SuggestionPrimitive.Trigger send asChild>
        <Button
          variant="ghost"
          className="aui-thread-welcome-suggestion h-auto w-full @md:flex-col flex-wrap items-start justify-start gap-1 rounded-3xl border bg-background px-4 py-3 text-left text-sm transition-colors hover:bg-muted"
        >
          <SuggestionPrimitive.Title className="aui-thread-welcome-suggestion-text-1 font-medium" />
          <SuggestionPrimitive.Description className="aui-thread-welcome-suggestion-text-2 text-muted-foreground empty:hidden" />
        </Button>
      </SuggestionPrimitive.Trigger>
    </div>
  );
};

const AtCommandPopup: FC<{
  query: string;
  visible: boolean;
  onSelect: (cmd: string) => void;
  selectedIndex: number;
}> = ({ query, visible, onSelect, selectedIndex }) => {
  if (!visible) return null;

  const filtered = AT_COMMANDS.filter((c) =>
    c.id.startsWith(query.toLowerCase()),
  );

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 z-50 mb-2 w-64 overflow-hidden rounded-lg border bg-popover p-1 shadow-lg">
      {filtered.map((cmd, i) => (
        <button
          key={cmd.id}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(cmd.id);
          }}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
            i === selectedIndex ? "bg-accent" : "hover:bg-accent/50",
          )}
        >
          <span className="text-base">{cmd.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-xs">{cmd.label}</div>
            <div className="text-[10px] text-muted-foreground">{cmd.desc}</div>
          </div>
        </button>
      ))}
    </div>
  );
};

const Composer: FC = () => {
  const [atQuery, setAtQuery] = useState("");
  const [showAtPopup, setShowAtPopup] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const handleAtSelect = useCallback((cmdId: string) => {
    const input = inputRef.current || document.querySelector<HTMLTextAreaElement>(".aui-composer-input");
    if (!input) return;

    const val = input.value;
    const atPos = val.lastIndexOf("@");
    if (atPos === -1) return;

    const before = val.slice(0, atPos);
    const after = val.slice(atPos).replace(/^@\S*/, "");
    const newVal = `${before}@${cmdId}${after.startsWith(" ") ? after : " " + after.trimStart()}`;

    // Set value via native setter to trigger React's onChange
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    if (nativeSetter) {
      nativeSetter.call(input, newVal);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }

    setShowAtPopup(false);
    setAtQuery("");
    input.focus();

    // Move cursor after the command
    const cursorPos = before.length + cmdId.length + 2;
    requestAnimationFrame(() => {
      input.setSelectionRange(cursorPos, cursorPos);
    });
  }, []);

  const handleInputChange = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    const val = (e.target as HTMLTextAreaElement).value;
    const cursorPos = (e.target as HTMLTextAreaElement).selectionStart || 0;
    const textBeforeCursor = val.slice(0, cursorPos);

    // Check if we're typing an @ command
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      const q = atMatch[1];
      setAtQuery(q);
      setShowAtPopup(true);
      setSelectedIdx(0);
    } else {
      setShowAtPopup(false);
      setAtQuery("");
    }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showAtPopup) return;

    const filtered = AT_COMMANDS.filter((c) =>
      c.id.startsWith(atQuery.toLowerCase()),
    );

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (filtered.length > 0) {
        e.preventDefault();
        handleAtSelect(filtered[selectedIdx]?.id || filtered[0].id);
      }
    } else if (e.key === "Escape") {
      setShowAtPopup(false);
    }
  }, [showAtPopup, atQuery, selectedIdx, handleAtSelect]);

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          const input = document.querySelector<HTMLInputElement>(".aui-composer-input");
          if (input) {
            const dt = new DataTransfer();
            dt.items.add(file);
            const dropEvent = new DragEvent("drop", { dataTransfer: dt, bubbles: true });
            input.closest("[data-slot='aui_composer-shell']")?.dispatchEvent(dropEvent);
          }
        }
      }
    }
  };

  return (
    <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
      <ComposerPrimitive.AttachmentDropzone asChild>
        <div
          data-slot="aui_composer-shell"
          className="relative flex w-full flex-col gap-2 rounded-(--composer-radius) border bg-background p-(--composer-padding) transition-shadow focus-within:border-ring/75 focus-within:ring-2 focus-within:ring-ring/20 data-[dragging=true]:border-ring data-[dragging=true]:border-dashed data-[dragging=true]:bg-accent/50"
          onPaste={handlePaste}
        >
          <ComposerAttachments />
          <AtCommandPopup
            query={atQuery}
            visible={showAtPopup}
            onSelect={handleAtSelect}
            selectedIndex={selectedIdx}
          />
          <ComposerPrimitive.Input
            placeholder="Send a message... (type @ for commands)"
            className="aui-composer-input max-h-32 min-h-10 w-full resize-none bg-transparent px-1.75 py-1 text-sm outline-none placeholder:text-muted-foreground/80"
            rows={1}
            autoFocus
            aria-label="Message input"
            onInput={handleInputChange}
            onKeyDown={handleKeyDown}
            ref={(el: any) => { inputRef.current = el; }}
          />
          <ComposerAction />
        </div>
      </ComposerPrimitive.AttachmentDropzone>
    </ComposerPrimitive.Root>
  );
};

const ImageModeDropdown: FC = () => {
  const { imageMode, setImageMode } = useAIModes();
  const [open, setOpen] = useState(false);
  const [imgSettingsOpen, setImgSettingsOpen] = useState(false);
  const modes = [
    { id: "off" as const, label: "Off", icon: "\ud83d\udeab", desc: "No images" },
    { id: "ai" as const, label: "AI Mode", icon: "\ud83e\udd16", desc: "AI sends images when it wants" },
    { id: "image" as const, label: "Image Mode", icon: "\ud83c\udfa8", desc: "Everything becomes an image" },
  ];
  const current = modes.find((m) => m.id === imageMode) || modes[0];
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className={cn("flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-all",
          imageMode === "off" ? "text-muted-foreground hover:bg-muted"
            : imageMode === "ai" ? "border border-blue-400/30 bg-blue-400/10 text-blue-400"
              : "border border-pink-400/30 bg-pink-400/10 text-pink-400")}>
        <ImageIcon className="size-3.5" />
        {imageMode !== "off" && current.label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 z-50 mb-1 min-w-48 overflow-hidden rounded-lg border bg-popover p-1 shadow-lg">
            {modes.map((m) => (
              <button key={m.id} type="button" onClick={() => { setImageMode(m.id); setOpen(false); }}
                className={cn("flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent", imageMode === m.id && "bg-accent")}>
                <span className="text-base">{m.icon}</span>
                <div className="flex-1">
                  <div className="font-medium text-xs">{m.label}</div>
                  <div className="text-[10px] text-muted-foreground">{m.desc}</div>
                </div>
                {imageMode === m.id && <CheckIcon className="size-3 text-primary" />}
              </button>
            ))}
            <div className="mx-1 my-0.5 border-t" />
            <button type="button" onClick={() => { setOpen(false); setImgSettingsOpen(true); }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent">
              <SettingsIcon className="size-4 text-muted-foreground" />
              <span className="text-xs">Image Settings</span>
            </button>
          </div>
        </>
      )}
      <SettingsDialog open={imgSettingsOpen} onOpenChange={setImgSettingsOpen} />
    </div>
  );
};

const ComposerAction: FC = () => {
  const { thinking, toggleThinking, enabled, activePresetId, presets } = useAIModes();
  const activePreset = activePresetId ? presets.find((p) => p.id === activePresetId) : null;
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="aui-composer-action-wrapper relative flex items-center justify-between">
      <div className="flex items-center gap-1">
        <ComposerAddAttachment />
        <ImageModeDropdown />
        <button
          type="button"
          onClick={toggleThinking}
          className={cn(
            "flex items-center gap-1 rounded-full px-2.5 py-1 font-medium text-xs transition-all",
            thinking
              ? "border border-primary/30 bg-primary/10 text-primary"
              : "border border-transparent text-muted-foreground hover:bg-muted",
          )}
          title={thinking ? "Thinking mode ON \u2014 click to turn off" : "Quick mode \u2014 click to enable thinking"}
        >
          {thinking ? <BrainIcon className="size-3.5" /> : <ZapIcon className="size-3.5" />}
          {thinking ? "Think" : "Quick"}
        </button>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all hover:opacity-80"
          style={enabled && activePreset
            ? { borderColor: `${activePreset.color}40`, color: activePreset.color, backgroundColor: `${activePreset.color}10` }
            : enabled
              ? { borderColor: "#10b98140", color: "#10b981", backgroundColor: "#10b98110" }
              : {}}
        >
          {enabled && (
            <div className="size-1.5 rounded-full" style={{ backgroundColor: activePreset?.color || "#10b981" }} />
          )}
          {enabled ? (activePreset ? activePreset.name : "Custom") : "Default"}
        </button>
        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      </div>
      <AuiIf condition={(s) => !s.thread.isRunning}>
        <ComposerPrimitive.Send asChild>
          <TooltipIconButton
            tooltip="Send message"
            side="bottom"
            type="button"
            variant="default"
            size="icon"
            className="aui-composer-send size-8 rounded-full"
            aria-label="Send message"
          >
            <ArrowUpIcon className="aui-composer-send-icon size-4" />
          </TooltipIconButton>
        </ComposerPrimitive.Send>
      </AuiIf>
      <AuiIf condition={(s) => s.thread.isRunning}>
        <ComposerPrimitive.Cancel asChild>
          <Button
            type="button"
            variant="default"
            size="icon"
            className="aui-composer-cancel size-8 rounded-full"
            aria-label="Stop generating"
          >
            <SquareIcon className="aui-composer-cancel-icon size-3 fill-current" />
          </Button>
        </ComposerPrimitive.Cancel>
      </AuiIf>
    </div>
  );
};

const MessageError: FC = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className="aui-message-error-root mt-2 rounded-md border border-destructive bg-destructive/10 p-3 text-destructive text-sm dark:bg-destructive/5 dark:text-red-200">
        <ErrorPrimitive.Message className="aui-message-error-message line-clamp-2" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  );
};

const AssistantMessage: FC = () => {
  const ACTION_BAR_PT = "pt-1.5";
  const ACTION_BAR_HEIGHT = `-mb-7.5 min-h-7.5 ${ACTION_BAR_PT}`;
  const [showRaw, setShowRaw] = useState(false);

  return (
    <MessagePrimitive.Root
      data-slot="aui_assistant-message-root"
      data-role="assistant"
      className="fade-in slide-in-from-bottom-1 relative animate-in duration-150"
    >
      <div
        data-slot="aui_assistant-message-content"
        className="wrap-break-word px-2 text-foreground leading-relaxed"
      >
        {showRaw ? (
          <RawMarkdownView />
        ) : (
          <MessagePrimitive.Parts
            components={{
              Text: MarkdownText,
              Reasoning: Reasoning,
              ReasoningGroup: ReasoningGroup,
              tools: { Fallback: ToolFallback },
            }}
          />
        )}
        <MessageError />
      </div>

      <div
        data-slot="aui_assistant-message-footer"
        className={cn("ml-2 flex items-center gap-2", ACTION_BAR_HEIGHT)}
      >
        <BranchPicker />
        <GenerationTime />
        <AssistantActionBar showRaw={showRaw} onToggleRaw={() => setShowRaw((v) => !v)} />
      </div>
    </MessagePrimitive.Root>
  );
};

const RawMarkdownView: FC = () => {
  const message = useAuiState((s) => s.message);
  const raw = message.parts
    ?.filter((p: any) => p.type === "text")
    .map((p: any) => p.text)
    .join("") || "";

  return (
    <pre className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 font-mono text-xs leading-relaxed">
      {raw}
    </pre>
  );
};

const GenerationTime: FC = () => {
  const timing = useMessageTiming();
  const isRunning = useAuiState((s) => s.message.status?.type === "running");
  if (isRunning || !timing?.totalStreamTime) return null;

  const seconds = (timing.totalStreamTime / 1000).toFixed(1);
  const tps = timing.tokensPerSecond?.toFixed(1);
  const tokens = timing.tokenCount;

  return (
    <span className="text-muted-foreground text-xs">
      {seconds}s{tps ? ` · ${tps} tok/s` : ""}{tokens ? ` · ${tokens} tokens` : ""}
    </span>
  );
};

const RawJsonModal: FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const message = useAuiState((s) => s.message);
  const [copied, setCopied] = useState(false);
  if (!open) return null;

  const json = JSON.stringify(message, null, 2);
  const handleCopy = () => {
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-lg border bg-background shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="font-medium text-sm">Raw Message JSON</span>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted"
              title="Copy"
            >
              {copied ? (
                <CheckIcon className="size-4" />
              ) : (
                <CopyIcon className="size-4" />
              )}
            </button>
            <button
              onClick={onClose}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        </div>
        <pre className="max-h-[70vh] overflow-auto p-4 text-xs leading-relaxed">
          <code>{json}</code>
        </pre>
      </div>
    </div>
  );
};

const AssistantActionBar: FC<{ showRaw: boolean; onToggleRaw: () => void }> = ({ showRaw, onToggleRaw }) => {
  const [showJson, setShowJson] = useState(false);

  return (
    <>
      <RawJsonModal open={showJson} onClose={() => setShowJson(false)} />
      <ActionBarPrimitive.Root
        hideWhenRunning
        autohide="not-last"
        className="aui-assistant-action-bar-root col-start-3 row-start-2 -ml-1 flex gap-1 text-muted-foreground"
      >
        <ActionBarPrimitive.Copy asChild>
          <TooltipIconButton tooltip="Copy">
            <AuiIf condition={(s) => s.message.isCopied}>
              <CheckIcon />
            </AuiIf>
            <AuiIf condition={(s) => !s.message.isCopied}>
              <CopyIcon />
            </AuiIf>
          </TooltipIconButton>
        </ActionBarPrimitive.Copy>
        <ActionBarPrimitive.Reload asChild>
          <TooltipIconButton tooltip="Refresh">
            <RefreshCwIcon />
          </TooltipIconButton>
        </ActionBarPrimitive.Reload>
        <TooltipIconButton
          tooltip={showRaw ? "Show rendered" : "Show raw markdown"}
          onClick={onToggleRaw}
          className={showRaw ? "text-primary" : ""}
        >
          <FileTextIcon />
        </TooltipIconButton>
        <ActionBarMorePrimitive.Root>
          <ActionBarMorePrimitive.Trigger asChild>
            <TooltipIconButton
              tooltip="More"
              className="data-[state=open]:bg-accent"
            >
              <MoreHorizontalIcon />
            </TooltipIconButton>
          </ActionBarMorePrimitive.Trigger>
          <ActionBarMorePrimitive.Content
            side="bottom"
            align="start"
            className="aui-action-bar-more-content z-50 min-w-32 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          >
            <ActionBarPrimitive.ExportMarkdown asChild>
              <ActionBarMorePrimitive.Item className="aui-action-bar-more-item flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
                <DownloadIcon className="size-4" />
                Export as Markdown
              </ActionBarMorePrimitive.Item>
            </ActionBarPrimitive.ExportMarkdown>
            <ActionBarMorePrimitive.Item
              className="aui-action-bar-more-item flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
              onClick={() => setShowJson(true)}
            >
              <CodeIcon className="size-4" />
              View Raw JSON
            </ActionBarMorePrimitive.Item>
          </ActionBarMorePrimitive.Content>
        </ActionBarMorePrimitive.Root>
      </ActionBarPrimitive.Root>
    </>
  );
};

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root
      data-slot="aui_user-message-root"
      className="fade-in slide-in-from-bottom-1 grid animate-in auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 duration-150 [&:where(>*)]:col-start-2"
      data-role="user"
    >
      <UserMessageAttachments />

      <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
        <div className="aui-user-message-content wrap-break-word peer rounded-2xl bg-muted px-4 py-2.5 text-foreground empty:hidden">
          <MessagePrimitive.Parts />
        </div>
        <div className="aui-user-action-bar-wrapper absolute top-1/2 left-0 -translate-x-full -translate-y-1/2 pr-2 peer-empty:hidden">
          <UserActionBar />
        </div>
      </div>

      <BranchPicker
        data-slot="aui_user-branch-picker"
        className="col-span-full col-start-1 row-start-3 -mr-1 justify-end"
      />
    </MessagePrimitive.Root>
  );
};

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-user-action-bar-root flex flex-col items-end"
    >
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton tooltip="Edit" className="aui-user-action-edit p-4">
          <PencilIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  );
};

const EditComposer: FC = () => {
  return (
    <MessagePrimitive.Root
      data-slot="aui_edit-composer-wrapper"
      className="flex flex-col px-2"
    >
      <ComposerPrimitive.Root className="aui-edit-composer-root ml-auto flex w-full max-w-[85%] flex-col rounded-2xl bg-muted">
        <ComposerPrimitive.Input
          className="aui-edit-composer-input min-h-14 w-full resize-none bg-transparent p-4 text-foreground text-sm outline-none"
          autoFocus
        />
        <div className="aui-edit-composer-footer mx-3 mb-3 flex items-center gap-2 self-end">
          <ComposerPrimitive.Cancel asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <Button size="sm">Update</Button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  );
};

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
  className,
  ...rest
}) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        "aui-branch-picker-root mr-2 -ml-2 inline-flex items-center text-muted-foreground text-xs",
        className,
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton tooltip="Previous">
          <ChevronLeftIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      <span className="aui-branch-picker-state font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton tooltip="Next">
          <ChevronRightIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};
