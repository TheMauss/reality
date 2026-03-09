"use client";

import { useState } from "react";

export default function ImageGallery({ images }: { images: string[] }) {
  const [selected, setSelected] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  if (images.length === 0) return null;

  return (
    <>
      <div className="space-y-3">
        {/* Main image */}
        <div
          className="relative cursor-pointer overflow-hidden rounded-xl bg-border/20"
          style={{ aspectRatio: "16/10" }}
          onClick={() => setLightbox(true)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[selected]}
            alt={`Foto ${selected + 1}`}
            className="h-full w-full object-cover transition-transform hover:scale-[1.02]"
          />
          <div className="absolute bottom-3 right-3 rounded-lg bg-black/60 px-2.5 py-1 text-xs text-white backdrop-blur-sm">
            {selected + 1} / {images.length}
          </div>
        </div>

        {/* Thumbnails */}
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className={`shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                  i === selected
                    ? "border-accent"
                    : "border-transparent opacity-60 hover:opacity-100"
                }`}
                style={{ width: 72, height: 54 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img}
                  alt={`Thumbnail ${i + 1}`}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setLightbox(false)}
        >
          <button
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            onClick={() => setLightbox(false)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          {images.length > 1 && (
            <>
              <button
                className="absolute left-4 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected((s) => (s - 1 + images.length) % images.length);
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                className="absolute right-4 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected((s) => (s + 1) % images.length);
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[selected]}
            alt={`Foto ${selected + 1}`}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          <div className="absolute bottom-4 rounded-lg bg-black/60 px-3 py-1.5 text-sm text-white">
            {selected + 1} / {images.length}
          </div>
        </div>
      )}
    </>
  );
}
