import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  clipboardSearch,
  type ClipboardItemDetail,
  clipboardGet,
} from "../lib/superclip";
import type { ClipboardItem } from "../components/history-row";

const SEARCH_DEBOUNCE_MS = 150;
const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  items: ClipboardItem[];
  ts: number;
}

interface DataState {
  items: ClipboardItem[];
  selectedId: string;
  isLoading: boolean;
}

type DataAction =
  | { type: "SET_DATA"; items: ClipboardItem[]; keepSelection: boolean; prevSelectedId: string }
  | { type: "SET_SELECTED"; id: string }
  | { type: "SET_LOADING" };

function deriveSelectedId(
  items: ClipboardItem[],
  prevId: string,
  keepSelection: boolean,
): string {
  if (!items.length) return "";
  if (keepSelection && items.some((i) => i.id === prevId)) return prevId;
  return items[0].id;
}

function dataReducer(state: DataState, action: DataAction): DataState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: true };
    case "SET_DATA": {
      const selectedId = deriveSelectedId(
        action.items,
        action.prevSelectedId,
        action.keepSelection,
      );
      return { items: action.items, selectedId, isLoading: false };
    }
    case "SET_SELECTED":
      if (!state.items.length || !state.items.some((i) => i.id === action.id)) {
        return state.selectedId === "" ? state : { ...state, selectedId: "" };
      }
      return state.selectedId === action.id ? state : { ...state, selectedId: action.id };
  }
}

export interface UseClipboardDataOptions {
  kindFilter?: string;
  pinnedOnly?: boolean;
  /** 空查询（浏览列表）时返回的最大条数；不传则用后端上限（5000）。
   * popup 小窗用限量的最近列表加速首次就绪，搜索（非空查询）不受限。 */
  listLimit?: number;
}

export function useClipboardData(options: UseClipboardDataOptions = {}) {
  const { kindFilter, pinnedOnly, listLimit } = options;

  const [query, setQuery] = useReducer((_: string, next: string) => next, "");
  const [debouncedQuery, setDebouncedQuery] = useReducer((_: string, next: string) => next, "");

  const [state, dispatch] = useReducer(dataReducer, {
    items: [],
    selectedId: "",
    isLoading: true,
  });

  const itemsRef = useRef<ClipboardItem[]>([]);
  itemsRef.current = state.items;

  const selectedIdRef = useRef("");
  selectedIdRef.current = state.selectedId;

  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const refreshNonceRef = useRef(0);
  const [refreshNonce, bumpNonce] = useReducer((n: number) => n + 1, 0);
  const debouncedQueryRef = useRef("");

  const enqueueRefresh = useCallback(() => {
    bumpNonce();
  }, []);

  useEffect(() => {
    if (!query) {
      setDebouncedQuery("");
      return;
    }
    const t = window.setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    debouncedQueryRef.current = debouncedQuery;
  }, [debouncedQuery]);

  useEffect(() => {
    let active = true;
    const cacheKey = `${kindFilter ?? ""}:${pinnedOnly ? "1" : "0"}:${listLimit ?? ""}:${debouncedQuery}`;
    const cached = cacheRef.current.get(cacheKey);
    const now = Date.now();

    if (cached) {
      dispatch({
        type: "SET_DATA",
        items: cached.items,
        keepSelection: true,
        prevSelectedId: selectedIdRef.current,
      });

      const isStale = now - cached.ts > CACHE_TTL_MS;
      if (!isStale && refreshNonce === refreshNonceRef.current) {
        return;
      }
    } else {
      dispatch({ type: "SET_LOADING" });
    }

    refreshNonceRef.current = refreshNonce;

    async function fetchData() {
      try {
        const response = await clipboardSearch(
          debouncedQuery,
          kindFilter,
          pinnedOnly,
          // 仅浏览列表（空查询）时应用 listLimit；搜索时保持全量结果
          debouncedQuery ? undefined : listLimit,
        );
        if (!active) return;

        cacheRef.current.set(cacheKey, { items: response.results, ts: Date.now() });

        dispatch({
          type: "SET_DATA",
          items: response.results,
          keepSelection: !!cached,
          prevSelectedId: selectedIdRef.current,
        });
      } catch {
        // 请求失败时保留已有数据
      }
    }

    void fetchData();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, refreshNonce, kindFilter, pinnedOnly]);

  useEffect(() => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;

    let unlisten: Array<() => void> = [];
    let disposed = false;

    void import("@tauri-apps/api/event")
      .then(({ listen }) =>
        Promise.all([
          listen("history-updated", () => {
            if (!disposed) {
              cacheRef.current.clear();
              enqueueRefresh();
            }
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

  const setSelectedId = useCallback((id: string) => {
    dispatch({ type: "SET_SELECTED", id });
  }, []);

  const selectedItem =
    state.items.find((item) => item.id === state.selectedId) ?? state.items[0] ?? null;

  return {
    query,
    setQuery,
    items: state.items,
    itemsRef,
    selectedId: state.selectedId,
    setSelectedId,
    selectedItem,
    isLoading: state.isLoading,
    enqueueRefresh,
  };
}

export function useClipboardDetail(itemId: string | null) {
  const [detail, setDetail] = useReducer(
    (_: ClipboardItemDetail | null, next: ClipboardItemDetail | null) => next,
    null,
  );
  const [loadState, setLoadState] = useReducer(
    (_: "idle" | "loading" | "ready" | "error", next: "idle" | "loading" | "ready" | "error") => next,
    "idle",
  );

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
