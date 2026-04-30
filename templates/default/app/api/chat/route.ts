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

const STORY_SYSTEM = `You are a visual storyboard creator. The user describes an action or scene. Your job is to break it into sequential visual moments and output ONLY [GENERATE_IMAGE: ...] tags, one per scene. Each tag should describe a single frame/moment with enough visual detail to generate an image. Include character appearance, pose, camera angle, setting. Output NOTHING else — no text, no explanation, no numbering. Just the tags, one per line. Generate between 2 and 3 scenes.`;

const SCENE_SYSTEM = `You are a scene visualizer. Read the entire conversation above carefully. Your job is to generate a single [GENERATE_IMAGE: ...] tag that visually captures the current moment/scenario being discussed. Include character appearances, poses, setting, mood, lighting. Output NOTHING else — just the single [GENERATE_IMAGE: ...] tag.`;

const IMAGE_SYSTEM = `You are an image prompt enhancer. The user will describe an image they want. Your ONLY job is to enhance their description into a detailed image generation prompt and output it as: [GENERATE_IMAGE: your enhanced description]. Output NOTHING else — no explanation, no markdown, no headers, no technical specs. Just the single [GENERATE_IMAGE: ...] tag.`;

function detectAtCommand(messages: UIMessage[]): { command: string | null; cleanedText: string } {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return { command: null, cleanedText: "" };

  const text = Array.isArray(lastUser.parts)
    ? lastUser.parts.filter((p: any) => p.type === "text").map((p: any) => p.text).join("")
    : "";

  const match = text.match(/^@(image|story|scene|enhance|raw)\s*/i);
  if (!match) return { command: null, cleanedText: text };

  return {
    command: match[1].toLowerCase(),
    cleanedText: text.slice(match[0].length).trim(),
  };
}

const ENHANCE_SYSTEM = `You are in ultra-deep thinking mode. Think extremely carefully, consider every angle, every edge case, every nuance. Take your time. Provide the most thorough, well-reasoned, and comprehensive response possible. Do not rush. Quality over speed.`;

const RAW_SYSTEM = `The user wants to generate an image directly. Take their exact description and output it as: [GENERATE_IMAGE: their exact text unchanged]. Do NOT enhance, modify, or add anything. Just wrap their text in the tag exactly as they wrote it.`;

export async function POST(req: Request) {
  const enableThinking = req.headers.get("x-enable-thinking") === "1";

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

  // Detect @ commands and override system prompt
  const { command: atCommand, cleanedText: atText } = detectAtCommand(messages);
  let effectiveSystem = systemPromptFromHeader || system;
  let forceThinking = false;

  if (atCommand === "story") {
    effectiveSystem = STORY_SYSTEM;
  } else if (atCommand === "scene") {
    effectiveSystem = SCENE_SYSTEM;
  } else if (atCommand === "image") {
    effectiveSystem = IMAGE_SYSTEM;
  } else if (atCommand === "enhance") {
    effectiveSystem = (effectiveSystem ? effectiveSystem + "\n\n" : "") + ENHANCE_SYSTEM;
    forceThinking = true;
  } else if (atCommand === "raw") {
    effectiveSystem = RAW_SYSTEM;
  }

  const modelMessages = await convertToModelMessages(messages);

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

  // Clean @ prefix from the last user message
  if (atCommand) {
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const m = allMessages[i];
      if (m.role === "user") {
        if (typeof m.content === "string") {
          const cleaned = m.content.replace(/^@(image|story|scene|enhance|raw)\s*/i, "").trim();
          m.content = (atCommand === "scene" && !cleaned)
            ? "Visualize the current scene from our conversation."
            : cleaned;
        }
        break;
      }
    }
  }

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
              stream: true,
              chat_template_kwargs: { enable_thinking: forceThinking || enableThinking },
            }),
          },
        );

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

        if (reasoningId) {
          writer.write({ type: "reasoning-end", id: reasoningId });
        }
        if (textId) {
          writer.write({ type: "text-end", id: textId });
        }
      },
    }),
  });
}
