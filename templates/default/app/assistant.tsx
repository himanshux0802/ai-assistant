"use client";

import {
  AssistantRuntimeProvider,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  CompositeAttachmentAdapter,
  RuntimeAdapterProvider,
  useRemoteThreadListRuntime,
} from "@assistant-ui/react";
import {
  useChatRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { Thread } from "@/components/assistant-ui/thread";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThreadListSidebar } from "@/components/assistant-ui/threadlist-sidebar";
import { Separator } from "@/components/ui/separator";
import { AIModeProvider, useAIModes } from "@/hooks/use-ai-modes";
import { useMemo, useState } from "react";
import { createLocalThreadListAdapter } from "@/lib/local-thread-adapter";
import { InfoIcon, XIcon } from "lucide-react";

const attachmentAdapter = new CompositeAttachmentAdapter([
  new SimpleImageAttachmentAdapter(),
  new SimpleTextAttachmentAdapter(),
]);

function useChatThreadRuntime() {
  const { thinking, effectivePrompt } = useAIModes();

  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: "/api/chat",
        headers: {
          "x-enable-thinking": thinking ? "1" : "0",
          "x-system-prompt": effectivePrompt
            ? encodeURIComponent(effectivePrompt)
            : "",
        },
      }),
    [thinking, effectivePrompt],
  );

  return useChatRuntime({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    transport,
  });
}

const AssistantInner = () => {
  const adapter = useMemo(() => createLocalThreadListAdapter(), []);

  const runtime = useRemoteThreadListRuntime({
    runtimeHook: useChatThreadRuntime,
    adapter,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <RuntimeAdapterProvider adapters={{ attachments: attachmentAdapter }}>
        <SidebarProvider>
          <div className="flex h-dvh w-full pr-0.5">
            <ThreadListSidebar />
            <SidebarInset>
              <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
                <SidebarTrigger />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <span className="font-medium text-muted-foreground text-sm">
                  Skyler AI
                </span>
                <div className="ml-auto">
                  <ModelInfoButton />
                </div>
              </header>
              <div className="flex-1 overflow-hidden">
                <Thread />
              </div>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </RuntimeAdapterProvider>
    </AssistantRuntimeProvider>
  );
};

const ModelInfoButton = () => {
  const [open, setOpen] = useState(false);
  const { thinking, enabled, activePresetId, presets } = useAIModes();
  const activePreset = activePresetId ? presets.find((p) => p.id === activePresetId) : null;
  const model = "LM Studio";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Model Info"
      >
        <InfoIcon className="size-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border bg-popover p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-sm">Model Info</span>
              <button onClick={() => setOpen(false)} className="rounded p-0.5 text-muted-foreground hover:bg-muted">
                <XIcon className="size-3.5" />
              </button>
            </div>
            <div className="flex flex-col gap-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Model</span>
                <span className="truncate ml-2 max-w-[140px] font-mono">{model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mode</span>
                <span>{thinking ? "🧠 Thinking" : "⚡ Quick"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">System Prompt</span>
                <span>{enabled ? (activePreset ? activePreset.name : "Custom") : "Off"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Streaming</span>
                <span>Always On</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export const Assistant = () => {
  return (
    <AIModeProvider>
      <AssistantInner />
    </AIModeProvider>
  );
};
