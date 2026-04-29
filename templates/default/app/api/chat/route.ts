import {
  type JSONSchema7,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import fs from "node:fs/promises";
import path from "node:path";

const HISTORY_DIR = path.join(process.cwd(), "..", "chat_history");

let partCounter = 0;
function nextId() {
  return `part_${partCounter++}`;
}

function extractBase64(data: unknown): string {
  if (typeof data === "string") {
    return data.startsWith("data:") ? data.split(",")[1] || data : data;
  }
  return Buffer.from(data as ArrayBuffer).toString("base64");
}

export async function POST(req: Request) {
  const enableThinking = req.headers.get("x-enable-thinking") === "1";
  console.log("[chat] enableThinking =", enableThinking, "| header =", req.headers.get("x-enable-thinking"), "| sending to LM Studio: enable_thinking =", enableThinking);

  const customSystemPrompt = req.headers.get("x-system-prompt");
  const systemPromptFromHeader = customSystemPrompt
    ? decodeURIComponent(customSystemPrompt)
    : "";

  const {
    messages,
    system,
  }: {
    messages: UIMessage[];
    system?: string;
    tools?: Record<string, { description?: string; parameters: JSONSchema7 }>;
  } = await req.json();

  const modelMessages = await convertToModelMessages(messages);
  const effectiveSystem = systemPromptFromHeader || system;

  const allMessages = [
    ...(effectiveSystem ? [{ role: "system" as const, content: effectiveSystem }] : []),
    ...modelMessages.map((m) => {
      if (typeof m.content === "string") {
        return { role: m.role, content: m.content };
      }

      type TextPart = { type: "text"; text: string };
      type ImagePart = { type: "image_url"; image_url: { url: string } };
      const parts: Array<TextPart | ImagePart> = [];

      for (const p of m.content) {
        if (p.type === "text") {
          parts.push({ type: "text", text: (p as any).text });
        } else if (p.type === "file") {
          const { mediaType = "", data, filename } = p as any;
          if (mediaType.startsWith("image/")) {
            const b64 = extractBase64(data);
            const mime =
              mediaType === "image/webp" || mediaType === "image/gif"
                ? "image/png"
                : mediaType;
            parts.push({
              type: "image_url",
              image_url: { url: `data:${mime};base64,${b64}` },
            });
          } else {
            const text =
              typeof data === "string"
                ? Buffer.from(data, "base64").toString("utf-8")
                : new TextDecoder().decode(data);
            parts.push({
              type: "text",
              text: `[File: ${filename || "unknown"}]\n${text}`,
            });
          }
        }
      }

      if (parts.length === 0) return { role: m.role, content: "" };

      const hasImages = parts.some((p) => p.type === "image_url");
      if (!hasImages) {
        return {
          role: m.role,
          content: (parts as TextPart[]).map((p) => p.text).join(""),
        };
      }

      return { role: m.role, content: parts };
    }),
  ];

  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: async ({ writer }) => {
        const response = await fetch(
          `${process.env.OPENAI_BASE_URL}/chat/completions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: process.env.LM_STUDIO_MODEL,
              messages: allMessages,
              stream: enableThinking,
              chat_template_kwargs: { enable_thinking: enableThinking },
            }),
          },
        );

        if (!enableThinking) {
          // Quick mode: stream:false so chat_template_kwargs works
          const json = await response.json();
          const raw = json.choices?.[0]?.message?.content || "";

          // Parse <think> blocks and send as reasoning bubbles
          const thinkMatch = raw.match(/<think>([\s\S]*?)<\/think>/);
          if (thinkMatch && thinkMatch[1].trim()) {
            const rid = nextId();
            writer.write({ type: "reasoning-start", id: rid });
            writer.write({ type: "reasoning-delta", id: rid, delta: thinkMatch[1].trim() });
            writer.write({ type: "reasoning-end", id: rid });
          }

          // Send the actual answer (everything after </think>)
          let content = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
          if (content) {
            const textId = nextId();
            writer.write({ type: "text-start", id: textId });
            const words = content.split(/(\s+)/);
            for (const word of words) {
              writer.write({ type: "text-delta", id: textId, delta: word });
            }
            writer.write({ type: "text-end", id: textId });
          }
        } else {
          // Thinking mode: real streaming with reasoning bubbles
          if (!response.body) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let reasoningId: string | null = null;
        let textId: string | null = null;
        let insideThink = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            if (data === "[DONE]") continue;

            let parsed: any;
            try {
              parsed = JSON.parse(data);
            } catch {
              continue;
            }

            const delta = parsed.choices?.[0]?.delta;
            if (!delta) continue;

            const chunk: string = delta.content || "";
            if (!chunk) continue;

            if (chunk.includes("<think>")) {
              insideThink = true;
              if (!reasoningId) {
                reasoningId = nextId();
                writer.write({ type: "reasoning-start", id: reasoningId });
              }
              continue;
            }

            if (chunk.includes("</think>")) {
              insideThink = false;
              if (reasoningId) {
                writer.write({ type: "reasoning-end", id: reasoningId });
                reasoningId = null;
              }
              continue;
            }

            if (insideThink && reasoningId) {
              writer.write({ type: "reasoning-delta", id: reasoningId, delta: chunk });
              continue;
            }
            if (!textId) {
              textId = nextId();
              writer.write({ type: "text-start", id: textId });
            }
            writer.write({ type: "text-delta", id: textId, delta: chunk });
          }
        }

        }

        // Auto-save chat history
        try {
          await fs.mkdir(HISTORY_DIR, { recursive: true });
          const threadId =
            req.headers.get("x-thread-id") || `thread_${Date.now()}`;
          const firstUserMsg = messages.find((m) => m.role === "user");
          const title = firstUserMsg
            ? (Array.isArray(firstUserMsg.parts)
                ? (
                    firstUserMsg.parts.find(
                      (p: any) => p.type === "text",
                    ) as any
                  )?.text
                : "New Chat"
              )?.slice(0, 80) || "New Chat"
            : "New Chat";

          const filePath = path.join(HISTORY_DIR, `${threadId}.json`);
          const now = new Date().toISOString();
          let existing: any = {};
          try {
            existing = JSON.parse(await fs.readFile(filePath, "utf-8"));
          } catch {
            // new thread
          }
          const saved = {
            id: threadId,
            title: existing.title || title,
            messages: messages.map((m) => ({
              id: m.id,
              role: m.role,
              content: Array.isArray(m.parts)
                ? m.parts
                    .filter((p: any) => p.type === "text")
                    .map((p: any) => p.text)
                    .join("")
                : "",
            })),
            createdAt: existing.createdAt || now,
            updatedAt: now,
          };
          await fs.writeFile(filePath, JSON.stringify(saved, null, 2));
        } catch {
          // silently fail — don't break the response
        }
      },
    }),
  });
}
