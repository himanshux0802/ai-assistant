"use client";

import {
  AssistantRuntimeProvider,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  CompositeAttachmentAdapter,
  RuntimeAdapterProvider,
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
import {
  ThinkingModeProvider,
  useThinkingMode,
} from "@/hooks/use-thinking-mode";
import { SettingsProvider, useSettings } from "@/hooks/use-settings";
import { useMemo, useRef } from "react";

const attachmentAdapter = new CompositeAttachmentAdapter([
  new SimpleImageAttachmentAdapter(),
  new SimpleTextAttachmentAdapter(),
]);

const AssistantInner = () => {
  const thinkingMode = useThinkingMode();
  const { systemPromptEnabled, systemPrompt } = useSettings();
  const threadIdRef = useRef(
    `thread_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  );

  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: "/api/chat",
        headers: {
          "x-enable-thinking": thinkingMode.enabled ? "1" : "0",
          "x-system-prompt":
            systemPromptEnabled && systemPrompt
              ? encodeURIComponent(systemPrompt)
              : "",
          "x-thread-id": threadIdRef.current,
        },
      }),
    [thinkingMode.enabled, systemPromptEnabled, systemPrompt],
  );

  const runtime = useChatRuntime({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    transport,
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

export const Assistant = () => {
  return (
    <SettingsProvider>
      <ThinkingModeProvider>
        <AssistantInner />
      </ThinkingModeProvider>
    </SettingsProvider>
  );
};
