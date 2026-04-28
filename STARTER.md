# 🚀 Starter Guide — Skyler AI Chat UI

A step-by-step guide for first-time setup after cloning this repo.

---

## Prerequisites

| Tool | Version | How to Install |
|------|---------|----------------|
| Node.js | **>= 24** | https://nodejs.org (download LTS) |
| pnpm | **10.33.2** | Run: `corepack enable && corepack prepare pnpm@10.33.2 --activate` |
| LM Studio | Latest | https://lmstudio.ai (download & install) |

> **Tip:** After installing Node.js, open a new terminal and run `node -v` to verify.

---

## Step 1 — Install Dependencies

```bash
cd assistant-ui
pnpm install
```

This installs everything across the monorepo. It may take a few minutes the first time.

---

## Step 2 — Build Core Packages

You do **NOT** need to build the entire monorepo. Only build what the chat UI needs:

```bash
pnpm turbo build --filter=assistant-ui-starter...
```

> The `...` suffix tells turbo to build `assistant-ui-starter` and all its dependencies only.

---

## Step 3 — Set Up Your AI Backend

The chat UI lives in `templates/default/`. It needs an AI backend to talk to.

### Option A: LM Studio (Local, Free)

1. Download & open [LM Studio](https://lmstudio.ai)
2. Download a model (e.g. `qwen3.5-9b-claude-4.6-opus-uncensored-distilled` or any model you like)
3. Start the local server in LM Studio (it runs on `http://localhost:1234` by default)
4. Edit `templates/default/.env.local`:

```env
OPENAI_API_KEY=lm-studio
OPENAI_BASE_URL=http://localhost:1234/v1
LM_STUDIO_MODEL=your-model-name-here
```

> See `LM_STUDIO_TEMPLATE.md` in `templates/default/` for recommended Jinja templates and settings.

### Option B: OpenAI API

1. Get an API key from https://platform.openai.com/api-keys
2. Edit `templates/default/.env.local`:

```env
OPENAI_API_KEY=sk-your-key-here
OPENAI_BASE_URL=https://api.openai.com/v1
LM_STUDIO_MODEL=gpt-4o
```

### Option C: Any OpenAI-Compatible API

Any provider that exposes an OpenAI-compatible `/v1/chat/completions` endpoint works. Just set the three env vars above accordingly.

---

## Step 4 — Run the Chat UI

You have two ways to run it:

### Option 1: From the project root (recommended)

```bash
pnpm --filter=assistant-ui-starter dev
```

### Option 2: cd into the folder

```bash
cd templates/default
pnpm dev --turbopack
```

Both do the same thing. Open **http://localhost:3000** in your browser. That's it! 🎉

### Custom Port

To run on a different port (e.g. 6969):

```bash
# From root
pnpm --filter=assistant-ui-starter dev -- -p 6969

# Or from templates/default
cd templates/default
pnpm dev --turbopack -p 6969
```

Then open **http://localhost:6969**.

---

## Project Structure (What Matters)

```
assistant-ui/
├── templates/default/          ← 🟢 THE CHAT UI APP (this is what you run)
│   ├── app/
│   │   ├── page.tsx            ← Main page
│   │   ├── assistant.tsx       ← Chat component
│   │   └── api/chat/route.ts   ← Backend API route
│   ├── components/             ← UI components
│   ├── .env.local              ← Your API keys (create from .env.example)
│   └── package.json
├── packages/                   ← Core libraries (built in Step 2)
├── examples/                   ← Demo apps (optional, for reference)
├── apps/docs/                  ← Documentation website (not the chat UI)
└── STARTER.md                  ← You are here
```

---

## Common Issues

### "Module not found" or import errors
You forgot to build. Run:
```bash
pnpm turbo build --filter=assistant-ui-starter...
```

### Chat loads but messages fail
- Make sure LM Studio is running (or your API key is valid)
- Check that `.env.local` has the correct `OPENAI_BASE_URL` and `LM_STUDIO_MODEL`

### `pnpm` not found
```bash
corepack enable
corepack prepare pnpm@10.33.2 --activate
```

### `pnpm install` fails
Make sure you're on Node.js >= 24:
```bash
node -v
```

### Build fails with path errors (e.g. `C:\C:\...`)
Ignore it — that's a bug in the `social-media` app. It doesn't affect the chat UI. The `--filter` command in Step 2 avoids this entirely.

---

## Quick Reference

| What | Command |
|------|---------|
| Install deps | `pnpm install` |
| Build (first time) | `pnpm turbo build --filter=assistant-ui-starter...` |
| Run chat UI (from root) | `pnpm --filter=assistant-ui-starter dev` |
| Run chat UI (from folder) | `cd templates/default && pnpm dev --turbopack` |
| Run on custom port | `pnpm --filter=assistant-ui-starter dev -- -p 6969` |
| Run docs site | `pnpm docs:dev` |
| Run an example | `cd examples/with-ai-sdk-v6 && pnpm dev` |
