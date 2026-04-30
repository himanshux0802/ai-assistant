"use client";

import "@assistant-ui/react-markdown/styles/dot.css";

import {
  type CodeHeaderProps,
  MarkdownTextPrimitive,
  unstable_memoizeMarkdownComponents as memoizeMarkdownComponents,
  useIsMarkdownCodeBlock,
} from "@assistant-ui/react-markdown";
import remarkGfm from "remark-gfm";
import { type FC, memo, useState, useEffect, useRef } from "react";
import { CheckIcon, CopyIcon, DownloadIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";
import { useAuiState } from "@assistant-ui/react";

import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { ImageViewer } from "@/components/assistant-ui/image-viewer";
import { cn } from "@/lib/utils";

// Global cache so images survive component remounts (tab switching)
const imageCache = new Map<string, string[]>();

const InlineImage: FC<{ prompt: string }> = ({ prompt }) => {
  const [images, setImages] = useState<string[]>(imageCache.get(prompt) || []);
  const [loading, setLoading] = useState(!imageCache.has(prompt));
  const [error, setError] = useState<string | null>(null);
  const called = useRef(imageCache.has(prompt));
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const generate = (overridePrompt?: string) => {
    const p = overridePrompt || prompt;
    setLoading(true);
    setError(null);

    let artStyle = "";
    let shape = "";
    let imageCount = 1;
    let charPrompt = "";
    try {
      const stored = localStorage.getItem("skyler-image-settings");
      if (stored) {
        const parsed = JSON.parse(stored);
        artStyle = parsed.artStyle || "";
        shape = parsed.shape || "";
        imageCount = parsed.imageCount || 1;
      }
      const charStored = localStorage.getItem("skyler-character");
      if (charStored) {
        const c = JSON.parse(charStored);
        const parts: string[] = [];
        if (c.name) parts.push(`Character: ${c.name}`);
        if (c.appearance) parts.push(`Appearance: ${c.appearance}`);
        if (c.clothing) parts.push(`Clothing: ${c.clothing}`);
        if (c.other) parts.push(c.other);
        charPrompt = parts.join(". ");
      }
    } catch {}

    const fullPrompt = charPrompt ? `${charPrompt}. ${p}` : p;

    (async () => {
      try {
        const res = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: fullPrompt, artStyle, shape, imageCount }),
        });
        const data = await res.json();
        if (data.success && data.images?.length) {
          const srcs = data.images.map((img: any) => `data:image/png;base64,${img.base64}`);
          setImages(srcs);
          imageCache.set(p, srcs);
        } else {
          setError(data.error || "Failed to generate");
        }
      } catch {
        setError("Image server not running");
      }
      setLoading(false);
    })();
  };

  useEffect(() => {
    if (called.current) return;
    called.current = true;
    generate();
  }, [prompt]);

  const downloadImage = (src: string, idx: number) => {
    const a = document.createElement("a");
    a.href = src;
    a.download = `${prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "_")}_${idx + 1}.png`;
    a.click();
  };

  const copyImage = async (src: string) => {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    } catch {}
  };

  if (loading) {
    return (
      <div className="my-3 flex items-center gap-2 rounded-lg border border-dashed p-4 text-muted-foreground text-sm">
        <Loader2Icon className="size-4 animate-spin" />
        Generating image: {prompt.slice(0, 60)}...
      </div>
    );
  }
  if (error) {
    return (
      <div className="my-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        <p className="text-destructive text-xs">{error}</p>
        <button onClick={() => generate()} className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
          <RefreshCwIcon className="size-3" /> Retry
        </button>
      </div>
    );
  }
  if (images.length > 0) {
    return (
      <div className="my-3 flex flex-col gap-2">
        <div className={`grid gap-2 ${images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {images.map((src, i) => (
            <div key={i} className="group relative overflow-hidden rounded-lg border">
              <img
                src={src}
                alt={`${prompt} ${i + 1}`}
                className="w-full cursor-pointer"
                onClick={() => setViewerIndex(i)}
              />
              <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button onClick={() => copyImage(src)} className="rounded-md bg-black/60 p-1.5 text-white hover:bg-black/80" title="Copy">
                  <CopyIcon className="size-3" />
                </button>
                <button onClick={() => downloadImage(src, i)} className="rounded-md bg-black/60 p-1.5 text-white hover:bg-black/80" title="Download">
                  <DownloadIcon className="size-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => { imageCache.delete(prompt); generate(); }}
          className="flex items-center gap-1 self-start rounded-md px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <RefreshCwIcon className="size-3" /> Regenerate
        </button>
        {viewerIndex !== null && (
          <ImageViewer images={images} initialIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
        )}
      </div>
    );
  }
  return null;
};

// Parse text for [GENERATE_IMAGE: ...] tags
const TextWithImages: FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/(\[GENERATE_IMAGE:\s*([^\]]+)\])/);
  if (parts.length === 1) return <>{text}</>;

  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < parts.length) {
    if (parts[i]?.startsWith("[GENERATE_IMAGE:")) {
      const prompt = parts[i + 1]?.trim();
      if (prompt) elements.push(<InlineImage key={i} prompt={prompt} />);
      i += 2;
    } else {
      if (parts[i]) elements.push(<span key={i}>{parts[i]}</span>);
      i += 1;
    }
  }
  return <>{elements}</>;
};

const MarkdownTextImpl = () => {
  return (
    <MarkdownTextPrimitive
      remarkPlugins={[remarkGfm]}
      className="aui-md"
      components={defaultComponents}
    />
  );
};

const MarkdownTextBase = memo(MarkdownTextImpl);

// Wrapper that detects [GENERATE_IMAGE: ...] in the raw text
export const MarkdownText: FC = () => {
  const text = useAuiState((s) => {
    const parts = s.message?.parts;
    if (!parts) return "";
    return parts
      .filter((p: any) => p.type === "text")
      .map((p: any) => p.text)
      .join("");
  });

  // Find ALL image tags
  const imageMatches = [...text.matchAll(/\[GENERATE_IMAGE:\s*([^\]]+)\]/g)];

  if (imageMatches.length === 0) return <MarkdownTextBase />;

  // Story mode: multiple images with scene labels
  if (imageMatches.length > 1) {
    const elements: React.ReactNode[] = [];
    let lastEnd = 0;

    imageMatches.forEach((match, i) => {
      const before = text.slice(lastEnd, match.index).trim();
      if (before) elements.push(<div key={`t${i}`} className="aui-md">{before}</div>);

      elements.push(
        <div key={`s${i}`} className="my-2">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              Scene {i + 1}
            </span>
            <span className="text-[10px] text-muted-foreground truncate max-w-xs">
              {match[1].trim().slice(0, 60)}
            </span>
          </div>
          <InlineImage prompt={match[1].trim()} />
        </div>,
      );

      lastEnd = (match.index || 0) + match[0].length;
    });

    const trailing = text.slice(lastEnd).trim();
    if (trailing) elements.push(<div key="trail" className="aui-md">{trailing}</div>);

    return <div className="flex flex-col gap-1">{elements}</div>;
  }

  // Single image
  const match = imageMatches[0];
  const prompt = match[1].trim();
  const before = text.slice(0, match.index).trim();
  const after = text.slice((match.index || 0) + match[0].length).trim();

  return (
    <>
      {before && <div className="aui-md">{before}</div>}
      <InlineImage prompt={prompt} />
      {after && <div className="aui-md">{after}</div>}
    </>
  );
};

const CodeHeader: FC<CodeHeaderProps> = ({ language, code }) => {
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  const onCopy = () => {
    if (!code || isCopied) return;
    copyToClipboard(code);
  };

  return (
    <div className="aui-code-header-root mt-2.5 flex items-center justify-between rounded-t-lg border border-border/50 border-b-0 bg-muted/50 px-3 py-1.5 text-xs">
      <span className="aui-code-header-language font-medium text-muted-foreground lowercase">
        {language}
      </span>
      <TooltipIconButton tooltip="Copy" onClick={onCopy}>
        {!isCopied && <CopyIcon />}
        {isCopied && <CheckIcon />}
      </TooltipIconButton>
    </div>
  );
};

const useCopyToClipboard = ({
  copiedDuration = 3000,
}: {
  copiedDuration?: number;
} = {}) => {
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const copyToClipboard = (value: string) => {
    if (!value) return;

    navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), copiedDuration);
    });
  };

  return { isCopied, copyToClipboard };
};

const defaultComponents = memoizeMarkdownComponents({
  h1: ({ className, ...props }) => (
    <h1
      className={cn(
        "aui-md-h1 mb-2 scroll-m-20 font-semibold text-base first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={cn(
        "aui-md-h2 mt-3 mb-1.5 scroll-m-20 font-semibold text-sm first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3
      className={cn(
        "aui-md-h3 mt-2.5 mb-1 scroll-m-20 font-semibold text-sm first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h4: ({ className, ...props }) => (
    <h4
      className={cn(
        "aui-md-h4 mt-2 mb-1 scroll-m-20 font-medium text-sm first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h5: ({ className, ...props }) => (
    <h5
      className={cn(
        "aui-md-h5 mt-2 mb-1 font-medium text-sm first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h6: ({ className, ...props }) => (
    <h6
      className={cn(
        "aui-md-h6 mt-2 mb-1 font-medium text-sm first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  p: ({ className, ...props }) => (
    <p
      className={cn(
        "aui-md-p my-2.5 leading-normal first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  a: ({ className, ...props }) => (
    <a
      className={cn(
        "aui-md-a text-primary underline underline-offset-2 hover:text-primary/80",
        className,
      )}
      {...props}
    />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn(
        "aui-md-blockquote my-2.5 border-muted-foreground/30 border-l-2 pl-3 text-muted-foreground italic",
        className,
      )}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul
      className={cn(
        "aui-md-ul my-2 ml-4 list-disc marker:text-muted-foreground [&>li]:mt-1",
        className,
      )}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={cn(
        "aui-md-ol my-2 ml-4 list-decimal marker:text-muted-foreground [&>li]:mt-1",
        className,
      )}
      {...props}
    />
  ),
  hr: ({ className, ...props }) => (
    <hr
      className={cn("aui-md-hr my-2 border-muted-foreground/20", className)}
      {...props}
    />
  ),
  table: ({ className, ...props }) => (
    <table
      className={cn(
        "aui-md-table my-2 w-full border-separate border-spacing-0 overflow-y-auto",
        className,
      )}
      {...props}
    />
  ),
  th: ({ className, ...props }) => (
    <th
      className={cn(
        "aui-md-th bg-muted px-2 py-1 text-left font-medium first:rounded-tl-lg last:rounded-tr-lg [[align=center]]:text-center [[align=right]]:text-right",
        className,
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td
      className={cn(
        "aui-md-td border-muted-foreground/20 border-b border-l px-2 py-1 text-left last:border-r [[align=center]]:text-center [[align=right]]:text-right",
        className,
      )}
      {...props}
    />
  ),
  tr: ({ className, ...props }) => (
    <tr
      className={cn(
        "aui-md-tr m-0 border-b p-0 first:border-t [&:last-child>td:first-child]:rounded-bl-lg [&:last-child>td:last-child]:rounded-br-lg",
        className,
      )}
      {...props}
    />
  ),
  li: ({ className, ...props }) => (
    <li className={cn("aui-md-li leading-normal", className)} {...props} />
  ),
  sup: ({ className, ...props }) => (
    <sup
      className={cn("aui-md-sup [&>a]:text-xs [&>a]:no-underline", className)}
      {...props}
    />
  ),
  pre: ({ className, ...props }) => (
    <pre
      className={cn(
        "aui-md-pre overflow-x-auto rounded-t-none rounded-b-lg border border-border/50 border-t-0 bg-muted/30 p-3 text-xs leading-relaxed",
        className,
      )}
      {...props}
    />
  ),
  code: function Code({ className, ...props }) {
    const isCodeBlock = useIsMarkdownCodeBlock();
    return (
      <code
        className={cn(
          !isCodeBlock &&
            "aui-md-inline-code rounded-md border border-border/50 bg-muted/50 px-1.5 py-0.5 font-mono text-[0.85em]",
          className,
        )}
        {...props}
      />
    );
  },
  CodeHeader,
});
