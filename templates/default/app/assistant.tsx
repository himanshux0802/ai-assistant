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
import { useMemo } from "react";
import { createLocalThreadListAdapter } from "@/lib/local-thread-adapter";

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
    <AIModeProvider>
      <AssistantInner />
    </AIModeProvider>
  );
};
