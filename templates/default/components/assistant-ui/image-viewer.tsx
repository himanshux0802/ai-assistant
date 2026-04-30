"use client";

import { type FC, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, XIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";

type Props = { images: string[]; initialIndex: number; onClose: () => void };

export const ImageViewer: FC<Props> = ({ images, initialIndex, onClose }) => {
  const [index, setIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const reset = () => { setScale(1); setPos({ x: 0, y: 0 }); };
  const prev = useCallback(() => { setIndex((i) => (i - 1 + images.length) % images.length); reset(); }, [images.length]);
  const next = useCallback(() => { setIndex((i) => (i + 1) % images.length); reset(); }, [images.length]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
      if (e.key === "+" || e.key === "=") setScale((s) => Math.min(s + 0.25, 5));
      if (e.key === "-") setScale((s) => Math.max(s - 0.25, 0.5));
      if (e.key === "0") reset();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, prev, next]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.min(Math.max(s - e.deltaY * 0.001, 0.5), 5));
  }, []);

  const onDown = useCallback((e: React.MouseEvent) => {
    if (scale <= 1) return;
    dragging.current = true;
    dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  }, [scale, pos]);

  const onMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    setPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  }, []);

  const onUp = useCallback(() => { dragging.current = false; }, []);

  const download = () => {
    const a = document.createElement("a");
    a.href = images[index];
    a.download = `image_${index + 1}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90" onClick={onClose}>
      <div className="relative flex size-full items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-4 py-3">
          <span className="rounded-full bg-black/50 px-3 py-1 text-xs text-white/70">{index + 1} / {images.length}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setScale((s) => Math.max(s - 0.25, 0.5))} className="rounded-full bg-black/50 p-2 text-white/70 hover:text-white"><ZoomOutIcon className="size-4" /></button>
            <button onClick={reset} className="rounded-full bg-black/50 px-2.5 py-1.5 text-xs text-white/70 hover:text-white">{Math.round(scale * 100)}%</button>
            <button onClick={() => setScale((s) => Math.min(s + 0.25, 5))} className="rounded-full bg-black/50 p-2 text-white/70 hover:text-white"><ZoomInIcon className="size-4" /></button>
            <button onClick={download} className="rounded-full bg-black/50 p-2 text-white/70 hover:text-white"><DownloadIcon className="size-4" /></button>
            <button onClick={onClose} className="rounded-full bg-black/50 p-2 text-white/70 hover:text-white"><XIcon className="size-4" /></button>
          </div>
        </div>
        {images.length > 1 && (
          <>
            <button onClick={prev} className="absolute left-4 z-10 rounded-full bg-black/50 p-3 text-white/70 hover:text-white"><ChevronLeftIcon className="size-5" /></button>
            <button onClick={next} className="absolute right-4 z-10 rounded-full bg-black/50 p-3 text-white/70 hover:text-white"><ChevronRightIcon className="size-5" /></button>
          </>
        )}
        <div
          style={{ cursor: scale > 1 ? "grab" : "default", width: "100%", height: "100%" }}
          className="flex items-center justify-center overflow-hidden"
          onWheel={onWheel} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
        >
          <img
            src={images[index]}
            alt={`Image ${index + 1}`}
            className="max-h-[85vh] max-w-[90vw] select-none rounded-lg object-contain"
            style={{ transform: `scale(${scale}) translate(${pos.x / scale}px, ${pos.y / scale}px)`, transition: dragging.current ? "none" : "transform 0.15s ease" }}
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
};
