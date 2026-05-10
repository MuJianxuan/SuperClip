import { useEffect, useRef, useState } from "react";
import { FileImage } from "lucide-react";
import { clipboardGet } from "../lib/superclip";
import { resolveImageDataUrl } from "../lib/image-utils";

interface ImageThumbnailProps {
  itemId: string;
  className?: string;
}

const MAX_CACHE_SIZE = 200;
const cache = new Map<string, string>();

function cacheSet(key: string, value: string) {
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value!;
    cache.delete(firstKey);
  }
  cache.set(key, value);
}

const MAX_CONCURRENT = 2;
let activeCount = 0;
const queue: Array<() => void> = [];

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    function run() {
      activeCount++;
      fn()
        .then(resolve, reject)
        .finally(() => {
          activeCount--;
          if (queue.length > 0) {
            queue.shift()!();
          }
        });
    }

    if (activeCount < MAX_CONCURRENT) {
      run();
    } else {
      queue.push(run);
    }
  });
}

const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 3000;

export function ImageThumbnail({ itemId, className }: ImageThumbnailProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(() => cache.get(itemId) ?? null);
  const [failed, setFailed] = useState(false);
  const retriesRef = useRef(0);

  useEffect(() => {
    retriesRef.current = 0;
    setFailed(false);

    if (cache.has(itemId)) {
      setDataUrl(cache.get(itemId)!);
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function attempt() {
      enqueue(() => clipboardGet(itemId)).then((detail) => {
        if (cancelled) return;
        const url = resolveImageDataUrl(detail.payload);
        if (!url) {
          if (retriesRef.current < MAX_RETRIES) {
            retriesRef.current++;
            retryTimer = setTimeout(attempt, RETRY_DELAY_MS);
          } else {
            setFailed(true);
          }
          return;
        }
        cacheSet(itemId, url);
        setDataUrl(url);
      }).catch(() => {
        if (cancelled) return;
        if (retriesRef.current < MAX_RETRIES) {
          retriesRef.current++;
          retryTimer = setTimeout(attempt, RETRY_DELAY_MS);
        } else {
          setFailed(true);
        }
      });
    }

    attempt();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [itemId]);

  if (failed) {
    return <FileImage className={`text-[var(--text-tertiary)] ${className ?? "h-4 w-4"}`} />;
  }

  if (!dataUrl) {
    return (
      <div className={`animate-pulse rounded bg-[var(--surface-2)] ${className ?? "h-8 w-8"}`} />
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
