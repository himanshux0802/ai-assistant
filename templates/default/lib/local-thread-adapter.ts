import type { RemoteThreadListAdapter } from "@assistant-ui/react";
import type { RemoteThreadMetadata, RemoteThreadListResponse, RemoteThreadInitializeResponse } from "@assistant-ui/core";
import type { ThreadMessage } from "ai";

const STORAGE_KEY = "assistant-threads";

function loadThreads(): RemoteThreadMetadata[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveThreads(threads: RemoteThreadMetadata[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
}

export function createLocalThreadListAdapter(): RemoteThreadListAdapter {
  return {
    async list(): Promise<RemoteThreadListResponse> {
      return { threads: loadThreads() };
    },

    async initialize(threadId: string): Promise<RemoteThreadInitializeResponse> {
      const threads = loadThreads();
      const existing = threads.find((t) => t.remoteId === threadId);
      if (existing) return { remoteId: existing.remoteId, externalId: existing.externalId };

      const newThread: RemoteThreadMetadata = {
        status: "regular",
        remoteId: threadId,
        title: "New Chat",
      };
      threads.unshift(newThread);
      saveThreads(threads);
      return { remoteId: threadId, externalId: undefined };
    },

    async rename(remoteId: string, newTitle: string) {
      const threads = loadThreads();
      const idx = threads.findIndex((t) => t.remoteId === remoteId);
      if (idx !== -1) {
        threads[idx] = { ...threads[idx], title: newTitle };
        saveThreads(threads);
      }
    },

    async archive(remoteId: string) {
      const threads = loadThreads();
      const idx = threads.findIndex((t) => t.remoteId === remoteId);
      if (idx !== -1) {
        threads[idx] = { ...threads[idx], status: "archived" };
        saveThreads(threads);
      }
    },

    async unarchive(remoteId: string) {
      const threads = loadThreads();
      const idx = threads.findIndex((t) => t.remoteId === remoteId);
      if (idx !== -1) {
        threads[idx] = { ...threads[idx], status: "regular" };
        saveThreads(threads);
      }
    },

    async delete(remoteId: string) {
      const threads = loadThreads().filter((t) => t.remoteId !== remoteId);
      saveThreads(threads);
    },

    async generateTitle(remoteId: string, messages: readonly ThreadMessage[]) {
      const firstUserMsg = messages.find((m) => m.role === "user");
      const text = firstUserMsg
        ? firstUserMsg.parts
            ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join(" ")
            .slice(0, 50) || "New Chat"
        : "New Chat";

      const title = text.length >= 50 ? text + "…" : text;
      await this.rename(remoteId, title);

      // Return a minimal AssistantStream-compatible response
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(title));
          controller.close();
        },
      });
      return stream as any;
    },

    async fetch(threadId: string) {
      const threads = loadThreads();
      const found = threads.find((t) => t.remoteId === threadId);
      if (!found) throw new Error(`Thread ${threadId} not found`);
      return found;
    },
  };
}
