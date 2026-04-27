import {
  type JSONSchema7,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";

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

  const {
    messages,
    system,
  }: {
    messages: UIMessage[];
    system?: string;
    tools?: Record<string, { description?: string; parameters: JSONSchema7 }>;
  } = await req.json();

  const modelMessages = await convertToModelMessages(messages);

  const allMessages = [
    ...(system ? [{ role: "system" as const, content: system }] : []),
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
        stream: true,
      }),
    },
  );

  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: async ({ writer }) => {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let reasoningId = "";
        let reasoningStarted = false;
        let reasoningEnded = false;
        let textId = "";
        let textStarted = false;
        let insideThinkTag = false;
        let pendingContent = "";

        function emitText(text: string) {
          if (!text) return;
          if (!textStarted) {
            textStarted = true;
            textId = nextId();
            writer.write({ type: "text-start", id: textId });
          }
          writer.write({ type: "text-delta", id: textId, delta: text });
        }

        function startReasoning() {
          if (!reasoningStarted) {
            reasoningStarted = true;
            reasoningId = nextId();
            writer.write({ type: "reasoning-start", id: reasoningId });
          }
        }

        function emitReasoning(text: string) {
          if (!text) return;
          startReasoning();
          writer.write({
            type: "reasoning-delta",
            id: reasoningId,
            delta: text,
          });
        }

        function endReasoning() {
          if (reasoningStarted && !reasoningEnded) {
            reasoningEnded = true;
            writer.write({ type: "reasoning-end", id: reasoningId });
          }
        }

        function processContent(content: string) {
          pendingContent += content;

          while (pendingContent.length > 0) {
            if (!insideThinkTag) {
              const thinkStart = pendingContent.indexOf("<think>");
              if (thinkStart === -1) {
                const partialIdx = pendingContent.lastIndexOf("<");
                if (
                  partialIdx !== -1 &&
                  partialIdx > pendingContent.length - 8
                ) {
                  const safe = pendingContent.slice(0, partialIdx);
                  if (safe) emitText(safe);
                  pendingContent = pendingContent.slice(partialIdx);
                  return;
                }
                emitText(pendingContent);
                pendingContent = "";
                return;
              }
              if (thinkStart > 0) {
                emitText(pendingContent.slice(0, thinkStart));
              }
              insideThinkTag = true;
              pendingContent = pendingContent.slice(thinkStart + 7);
              if (enableThinking) startReasoning();
            } else {
              const thinkEnd = pendingContent.indexOf("</think>");
              if (thinkEnd === -1) {
                const partialIdx = pendingContent.lastIndexOf("<");
                if (
                  partialIdx !== -1 &&
                  partialIdx > pendingContent.length - 9
                ) {
                  const safe = pendingContent.slice(0, partialIdx);
                  if (enableThinking && safe) emitReasoning(safe);
                  pendingContent = pendingContent.slice(partialIdx);
                  return;
                }
                if (enableThinking) emitReasoning(pendingContent);
                pendingContent = "";
                return;
              }
              if (enableThinking && thinkEnd > 0) {
                emitReasoning(pendingContent.slice(0, thinkEnd));
              }
              insideThinkTag = false;
              if (enableThinking) endReasoning();
              pendingContent = pendingContent.slice(thinkEnd + 8);
            }
          }
        }

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
            if (data === "[DONE]") break;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;
              if (!delta) continue;

              // Handle dedicated reasoning_content field (DeepSeek-style / LM Studio reasoning toggle)
              if (delta.reasoning_content) {
                if (enableThinking) {
                  emitReasoning(delta.reasoning_content);
                }
                // When thinking is off, silently discard
              }

              if (delta.content) {
                if (delta.reasoning_content !== undefined) {
                  // Model uses separate reasoning_content — content is the actual answer
                  if (enableThinking) endReasoning();
                  emitText(delta.content);
                } else {
                  // Model may use <think> tags in content
                  processContent(delta.content);
                }
              }
            } catch {
              // skip malformed chunks
            }
          }
        }

        // Flush remaining
        if (pendingContent) {
          if (insideThinkTag && enableThinking) {
            emitReasoning(pendingContent);
          } else if (!insideThinkTag) {
            emitText(pendingContent);
          }
        }

        if (enableThinking) endReasoning();
        if (textStarted) {
          writer.write({ type: "text-end", id: textId });
        }
      },
    }),
  });
}
