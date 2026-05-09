import { useCallback, useEffect, useState } from "react";
import {
  clipboardSearch,
  type ClipboardItemDetail,
  clipboardGet,
} from "../lib/superclip";
import type { ClipboardItem } from "../components/history-row";

export interface UseClipboardDataOptions {
  kindFilter?: string;
  pinnedOnly?: boolean;
}

export function useClipboardData(options: UseClipboardDataOptions = {}) {
  const { kindFilter, pinnedOnly } = options;
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ClipboardItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const enqueueRefresh = useCallback(() => {
    setRefreshNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    let active = true;

    async function fetchData() {
      setIsLoading(true);
      const response = await clipboardSearch(query);

      if (!active) return;

      let results = response.results;

      if (kindFilter) {
        results = results.filter((item) => item.kind === kindFilter);
      }
      if (pinnedOnly) {
        results = results.filter((item) => item.isPinned);
      }

      setItems(results);
      setIsLoading(false);
    }

    fetchData();
    return () => { active = false; };
  }, [query, refreshNonce, kindFilter, pinnedOnly]);

  useEffect(() => {
    if (!items.length) {
      setSelectedId("");
      return;
    }
    if (!items.some((item) => item.id === selectedId)) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  useEffect(() => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;

    let unlisten: Array<() => void> = [];
    let disposed = false;

    void import("@tauri-apps/api/event")
      .then(({ listen }) =>
        Promise.all([
          listen("history-updated", () => {
            if (!disposed) enqueueRefresh();
          }),
        ]),
      )
      .then((cleanupFns) => {
        if (disposed) {
          cleanupFns.forEach((fn) => void fn());
          return;
        }
        unlisten = cleanupFns;
      })
      .catch(() => {});

    return () => {
      disposed = true;
      unlisten.forEach((fn) => void fn());
    };
  }, [enqueueRefresh]);

  const selectedItem = items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  return {
    query,
    setQuery,
    items,
    selectedId,
    setSelectedId,
    selectedItem,
    isLoading,
    enqueueRefresh,
  };
}

export function useClipboardDetail(itemId: string | null) {
  const [detail, setDetail] = useState<ClipboardItemDetail | null>(null);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    if (!itemId) {
      setDetail(null);
      setLoadState("idle");
      return;
    }

    let active = true;
    setDetail(null);
    setLoadState("loading");

    void clipboardGet(itemId)
      .then((d) => {
        if (!active) return;
        setDetail(d);
        setLoadState("ready");
      })
      .catch(() => {
        if (!active) return;
        setDetail(null);
        setLoadState("error");
      });

    return () => { active = false; };
  }, [itemId]);

  return { detail, loadState };
}
