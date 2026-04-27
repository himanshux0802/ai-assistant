import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

const HISTORY_DIR = path.join(process.cwd(), "..", "chat_history");

async function ensureDir() {
  await fs.mkdir(HISTORY_DIR, { recursive: true });
}

// GET — list all threads or get a single thread
export async function GET(req: Request) {
  await ensureDir();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    try {
      const data = await fs.readFile(
        path.join(HISTORY_DIR, `${id}.json`),
        "utf-8",
      );
      return NextResponse.json(JSON.parse(data));
    } catch {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  // List all threads (sorted by updatedAt desc)
  const files = await fs.readdir(HISTORY_DIR);
  const threads = await Promise.all(
    files
      .filter((f) => f.endsWith(".json"))
      .map(async (f) => {
        const data = JSON.parse(
          await fs.readFile(path.join(HISTORY_DIR, f), "utf-8"),
        );
        return {
          id: data.id,
          title: data.title || "New Chat",
          updatedAt: data.updatedAt,
        };
      }),
  );
  threads.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  return NextResponse.json(threads);
}

// POST — save/update a thread
export async function POST(req: Request) {
  await ensureDir();
  const body = await req.json();
  const { id, title, messages } = body;

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const filePath = path.join(HISTORY_DIR, `${id}.json`);
  const now = new Date().toISOString();

  let existing: any = {};
  try {
    existing = JSON.parse(await fs.readFile(filePath, "utf-8"));
  } catch {
    // new thread
  }

  const thread = {
    id,
    title: title || existing.title || "New Chat",
    messages: messages ?? existing.messages ?? [],
    createdAt: existing.createdAt || now,
    updatedAt: now,
  };

  await fs.writeFile(filePath, JSON.stringify(thread, null, 2));
  return NextResponse.json({ ok: true });
}

// DELETE — delete a thread
export async function DELETE(req: Request) {
  await ensureDir();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  try {
    await fs.unlink(path.join(HISTORY_DIR, `${id}.json`));
  } catch {
    // already deleted
  }
  return NextResponse.json({ ok: true });
}

// PATCH — rename a thread
export async function PATCH(req: Request) {
  await ensureDir();
  const { id, title } = await req.json();

  if (!id || !title) {
    return NextResponse.json(
      { error: "id and title required" },
      { status: 400 },
    );
  }

  const filePath = path.join(HISTORY_DIR, `${id}.json`);
  try {
    const data = JSON.parse(await fs.readFile(filePath, "utf-8"));
    data.title = title;
    data.updatedAt = new Date().toISOString();
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
