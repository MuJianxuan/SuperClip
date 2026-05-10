import { useEffect, useRef, useState } from "react";
import { FileImage } from "lucide-react";
import { clipboardGet } from "../lib/superclip";

interface ImageThumbnailProps {
  itemId: string;
  className?: string;
}

const cache = new Map<string, string>();

export function ImageThumbnail({ itemId, className }: ImageThumbnailProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(() => cache.get(itemId) ?? null);
  const [failed, setFailed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (cache.has(itemId)) {
      setDataUrl(cache.get(itemId)!);
      return;
    }

    let cancelled = false;

    clipboardGet(itemId).then((detail) => {
      if (cancelled) return;
      const { imageBytes, imageWidth, imageHeight } = detail.payload;
      if (!imageBytes || !imageWidth || !imageHeight) {
        setFailed(true);
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) {
        setFailed(true);
        return;
      }

      canvas.width = imageWidth;
      canvas.height = imageHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setFailed(true);
        return;
      }

      const imageData = ctx.createImageData(imageWidth, imageHeight);
      const pixels = new Uint8ClampedArray(imageBytes);
      imageData.data.set(pixels);
      ctx.putImageData(imageData, 0, 0);

      const url = canvas.toDataURL("image/png");
      cache.set(itemId, url);
      setDataUrl(url);
    }).catch(() => {
      if (!cancelled) setFailed(true);
    });

    return () => { cancelled = true; };
  }, [itemId]);

  if (failed) {
    return <FileImage className={`text-[var(--text-tertiary)] ${className ?? "h-4 w-4"}`} />;
  }

  if (!dataUrl) {
    return (
      <>
        <canvas ref={canvasRef} className="hidden" />
        <div className={`animate-pulse rounded bg-[var(--surface-2)] ${className ?? "h-8 w-8"}`} />
      </>
    );
  }

  return (
    <img
      src={dataUrl}
      alt="thumbnail"
      className={`rounded object-cover ${className ?? "h-8 w-8"}`}
    />
  );
}
