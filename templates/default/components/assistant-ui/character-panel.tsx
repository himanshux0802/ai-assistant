"use client";

import { type FC, useState } from "react";
import { useAIModes, buildCharacterPrompt } from "@/hooks/use-ai-modes";
import { UserIcon, XIcon } from "lucide-react";

export const CharacterPanel: FC = () => {
  const { character, setCharacter } = useAIModes();
  const [open, setOpen] = useState(false);
  const hasChar = !!(character.name || character.appearance || character.clothing || character.other);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`rounded-full p-1.5 transition-colors ${hasChar ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
        title="Character Template"
      >
        <UserIcon className="size-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border bg-popover p-3 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-medium text-sm">Character Template</span>
              <button onClick={() => setOpen(false)} className="rounded p-0.5 text-muted-foreground hover:bg-muted"><XIcon className="size-3.5" /></button>
            </div>
            <p className="mb-3 text-[10px] text-muted-foreground">Auto-injected into every image prompt</p>
            <div className="flex flex-col gap-2.5">
              <div>
                <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground">Name</label>
                <input value={character.name} onChange={(e) => setCharacter({ ...character, name: e.target.value })} placeholder="e.g. Luna" className="w-full rounded border bg-background px-2 py-1.5 text-xs outline-none focus:border-ring/75" />
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground">Appearance</label>
                <textarea value={character.appearance} onChange={(e) => setCharacter({ ...character, appearance: e.target.value })} placeholder="e.g. red hair, green eyes, tall" className="w-full resize-none rounded border bg-background px-2 py-1.5 text-xs outline-none focus:border-ring/75" rows={2} />
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground">Clothing</label>
                <textarea value={character.clothing} onChange={(e) => setCharacter({ ...character, clothing: e.target.value })} placeholder="e.g. blue dress, white sneakers" className="w-full resize-none rounded border bg-background px-2 py-1.5 text-xs outline-none focus:border-ring/75" rows={2} />
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground">Other details</label>
                <textarea value={character.other} onChange={(e) => setCharacter({ ...character, other: e.target.value })} placeholder="e.g. carries a sword, scar on cheek" className="w-full resize-none rounded border bg-background px-2 py-1.5 text-xs outline-none focus:border-ring/75" rows={2} />
              </div>
            </div>
            {hasChar && (
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground truncate max-w-[180px]">{buildCharacterPrompt(character).slice(0, 60)}...</span>
                <button onClick={() => setCharacter({ name: "", appearance: "", clothing: "", other: "" })} className="text-[10px] text-destructive hover:underline">Clear</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
