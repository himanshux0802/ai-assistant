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

const IMAGE_TAG_INSTRUCTION =
  "You can generate images. When you want to show the user an image, write ONLY this tag on its own line: [GENERATE_IMAGE: your detailed image description]. Do NOT write markdown, do NOT explain the image, do NOT add technical specs. Just the tag. The system will generate and display the image automatically.";

const IMAGE_ONLY_INSTRUCTION =
  "You are an image prompt enhancer. The user will describe an image they want. Your ONLY job is to enhance their description into a detailed image generation prompt and output it as: [GENERATE_IMAGE: your enhanced description]. Output NOTHING else — no explanation, no markdown, no headers, no technical specs. Just the single [GENERATE_IMAGE: ...] tag.";

const STORY_INSTRUCTION =
  `You are a visual storyboard creator. The user describes an action or scene. Your job is to break it into sequential visual moments and output ONLY [GENERATE_IMAGE: ...] tags, one per scene. Each tag should describe a single frame/moment with enough visual detail to generate an image. Include character appearance, pose, camera angle, setting. Output NOTHING else — no text, no explanation, no numbering. Just the tags, one per line. Generate between 2 and 3 scenes.`;

const SCENE_INSTRUCTION =
  `You are a scene visualizer. Read the entire conversation above carefully. Your job is to generate a single [GENERATE_IMAGE: ...] tag that visually captures the current moment/scenario being discussed. Include character appearances, poses, setting, mood, lighting. Output NOTHING else — just the single [GENERATE_IMAGE: ...] tag.`;

function useChatThreadRuntime() {
  const { thinking, effectivePrompt, imageMode } = useAIModes();

  let systemPrompt = effectivePrompt;
  if (imageMode === "ai") {
    systemPrompt = (effectivePrompt ? effectivePrompt + "\n\n" : "") + IMAGE_TAG_INSTRUCTION;
  } else if (imageMode === "image") {
    systemPrompt = IMAGE_ONLY_INSTRUCTION;
  }

  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: "/api/chat",
        headers: {
          "x-enable-thinking": thinking ? "1" : "0",
          "x-system-prompt": systemPrompt
            ? encodeURIComponent(systemPrompt)
            : "",
        },
      }),
    [thinking, systemPrompt],
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

export { STORY_INSTRUCTION, SCENE_INSTRUCTION, IMAGE_TAG_INSTRUCTION, IMAGE_ONLY_INSTRUCTION };

export const Assistant = () => {
  return (
    <AIModeProvider>
      <AssistantInner />
    </AIModeProvider>
  );
};
