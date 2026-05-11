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
const queue: Array<{ run: () => void; cancelled: boolean }> = [];

function drainQueue() {
  while (queue.length > 0 && activeCount < MAX_CONCURRENT) {
    const next = queue.shift()!;
    if (next.cancelled) continue;
    next.run();
  }
}

interface Cancellable<T> {
  promise: Promise<T>;
  cancel: () => void;
}

function enqueue<T>(fn: () => Promise<T>): Cancellable<T> {
  let entry: { run: () => void; cancelled: boolean } | null = null;

  const promise = new Promise<T>((resolve, reject) => {
    function run() {
      activeCount++;
      fn()
        .then(resolve, reject)
        .finally(() => {
          activeCount--;
          drainQueue();
        });
    }

    if (activeCount < MAX_CONCURRENT) {
      run();
    } else {
      entry = { run, cancelled: false };
      queue.push(entry);
    }
  });

  return {
    promise,
    cancel() {
      if (entry) entry.cancelled = true;
    },
  };
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
    let pending: Cancellable<unknown> | null = null;

    function attempt() {
      const task = enqueue(() => clipboardGet(itemId));
      pending = task as Cancellable<unknown>;
      task.promise.then((detail) => {
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
      if (pending) pending.cancel();
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
