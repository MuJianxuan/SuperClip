import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, FileImage } from "lucide-react";
import { clipboardGet, settingsGet, systemAppearanceGet, type ClipboardItemDetail } from "../lib/superclip";
import { resolveImageDataUrl } from "../lib/image-utils";
import type { ClipboardItem } from "../components/history-row";

interface PreviewPayload {
  item: ClipboardItem;
}

const KIND_LABELS: Record<string, string> = {
  text: "文本",
  html: "HTML",
  rtf: "RTF",
  image: "图片",
  file: "文件",
};

const KIND_COLOR: Record<string, string> = {
  text: "var(--type-text)",
  html: "var(--type-html)",
  rtf: "var(--type-text)",
  image: "var(--type-image)",
  file: "var(--type-file)",
};

/** 三模式主题同步：浅/深/跟随系统。panel 窗口不能用 matchMedia 推断 system 模式——
 * WKWebView 的 prefers-color-scheme 在窗口被 Rust 侧 setAppearance 锁定后停止跟随
 * 系统外观（Sky.app #37/#60），会造成前端主题与磨砂背景错配。改由 Rust 提供有效外观：
 * 挂载/变更时经 systemAppearanceGet 取解析值，运行中订阅 panel-appearance-changed。 */
function applyThemeMode(mode: string) {
  const root = document.documentElement;
  if (mode !== "system") {
    root.dataset.themeMode = mode;
    return;
  }
  void systemAppearanceGet()
    .then((appearance) => {
      if (appearance === "dark" || appearance === "light") {
        root.dataset.themeMode = appearance;
      }
    })
    .catch(() => {
      root.dataset.themeMode = "light";
    });
}

function useImageDataUrl(detail: ClipboardItemDetail | null) {
  return useMemo(() => {
    return resolveImageDataUrl(detail?.payload ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.item?.id]);
}

/* 段落与代码块（``` 包裹段）区分渲染 */
function renderRichContent(content: string) {
  const segments = content.split("```");

  return segments.map((seg, idx) => {
    if (idx % 2 === 1) {
      // 代码块：去除首行语言标注（如 tsx），等宽深底，类型色文字
      const lines = seg.split("\n");
      const firstLine = lines[0].trim();
      const isLangLine = /^[a-z]+$/.test(firstLine) && lines.length > 1;
      const codeLines = isLangLine ? lines.slice(1) : lines;

      return (
        <pre
          key={idx}
          className="my-2 overflow-x-auto rounded-lg px-3 py-2.5 text-[11px] leading-[1.6]"
          style={{
            background: "var(--preview-code-bg)",
            border: "1px solid var(--preview-divider)",
            color: "var(--preview-code-text)",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            whiteSpace: "pre",
          }}
        >
          {codeLines.join("\n")}
        </pre>
      );
    }

    // 普通段落：按空行拆段
    return seg
      .split(/\n\n+/)
      .filter((p) => p.trim())
      .map((para, i) => (
        <p
          key={`${idx}-${i}`}
          className="mb-2 text-[12px] leading-[1.7]"
          style={{
            color: "var(--text-secondary)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {para.trim()}
        </p>
      ));
  });
}

export function PreviewApp() {
  const [item, setItem] = useState<ClipboardItem | null>(null);
  const [detail, setDetail] = useState<ClipboardItemDetail | null>(null);
  const emitRef = useRef<((event: string, payload?: unknown) => Promise<void>) | null>(null);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let unlisten: (() => void) | null = null;
    let disposed = false;

    void import("@tauri-apps/api/event")
      .then(({ listen, emit }) => {
        emitRef.current = emit;
        return listen<PreviewPayload>("preview:show", (event) => {
          if (!disposed) {
            setItem(event.payload.item);
            setDetail(null);
          }
        });
      })
      .then((fn) => {
        if (disposed) void fn();
        else unlisten = fn;
      })
      .catch(() => {});

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!item) return;
    let active = true;
    clipboardGet(item.id)
      .then((d) => {
        if (active) setDetail(d);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [item?.id]);

  // 三模式主题同步：挂载读一次 + 监听 settings-updated / panel-appearance-changed
  useEffect(() => {
    settingsGet()
      .then((s) => applyThemeMode(s?.themeMode ?? "system"))
      .catch(() => applyThemeMode("system"));

    if (!("__TAURI_INTERNALS__" in window)) return;
    let unlisten: Array<() => void> = [];
    let disposed = false;

    void import("@tauri-apps/api/event")
      .then(({ listen }) =>
        Promise.all([
          listen<{ theme_mode?: string }>("settings-updated", (event) => {
            if (!disposed && event.payload.theme_mode) {
              applyThemeMode(event.payload.theme_mode);
            }
          }),
          listen<{ appearance?: string }>("panel-appearance-changed", (event) => {
            if (disposed) return;
            const appearance = event.payload.appearance;
            if (appearance === "dark" || appearance === "light") {
              document.documentElement.dataset.themeMode = appearance;
            }
          }),
        ]),
      )
      .then((fns) => {
        if (disposed) fns.forEach((f) => void f());
        else unlisten = fns;
      })
      .catch(() => {});

    return () => {
      disposed = true;
      unlisten.forEach((f) => f());
    };
  }, []);

  const imageDataUrl = useImageDataUrl(detail);

  function handleMouseEnter() {
    emitRef.current?.("preview:mouse-enter").catch(() => {});
  }

  function handleMouseLeave() {
    emitRef.current?.("preview:mouse-leave").catch(() => {});
  }

  if (!item) {
    return <div className="h-screen w-screen" />;
  }

  const accent = KIND_COLOR[item.kind] ?? "var(--text-tertiary)";
  const kindLabel = KIND_LABELS[item.kind] ?? item.kind;
  const previewText =
    detail?.payload?.textPlain?.trim() || item.preview || "暂无预览";

  return (
    <div
      key={item.id}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="preview-shell flex h-screen w-screen flex-col overflow-hidden rounded-[12px] border border-[var(--popup-border)] bg-[var(--popup-bg)] shadow-[var(--popup-shadow)] frost-window"
      style={{ animation: "previewFadeIn 0.22s ease-out" }}
    >
      {/* Header：类型色点 + 类型标签 + 时间 */}
      <div
        className="flex items-center justify-between px-3.5 py-2.5"
        style={{ borderBottom: "1px solid var(--preview-divider)" }}
      >
        <div className="flex items-center gap-[7px]">
          <span
            className="h-[5px] w-[5px] rounded-full"
            style={{ background: accent, boxShadow: `0 0 6px color-mix(in_srgb, ${accent} 40%, transparent)` }}
          />
          <span
            className="text-[10.5px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: "var(--text-secondary)" }}
          >
            {kindLabel}
          </span>
        </div>
        <span
          className="text-[10px] tabular-nums"
          style={{ color: "var(--preview-header-time)" }}
        >
          {item.timeLabel}
        </span>
      </div>

      {/* 内容区 */}
      <div
        className={
          item.kind === "image"
            ? "flex-1 overflow-auto px-3 py-3"
            : "flex-1 overflow-auto px-4 pt-3.5 pb-3"
        }
      >
        {item.kind === "image" ? (
          <div className="flex w-full justify-center">
            {imageDataUrl ? (
              <img
                src={imageDataUrl}
                alt=""
                className="max-h-full max-w-full rounded object-contain"
              />
            ) : (
              <div
                className="relative flex h-[190px] w-full items-center justify-center overflow-hidden rounded-[10px]"
                style={{
                  background:
                    "linear-gradient(135deg, color-mix(in srgb, var(--type-image) 8%, transparent), color-mix(in srgb, var(--type-image) 2.4%, transparent))",
                  border: "1px solid var(--preview-divider)",
                }}
              >
                {/* 径向光斑装饰（G2 占位语言） */}
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    opacity: 0.05,
                    backgroundImage:
                      "radial-gradient(circle at 30% 40%, var(--type-image) 0%, transparent 50%), radial-gradient(circle at 70% 60%, var(--type-image) 0%, transparent 50%)",
                  }}
                />
                <div className="relative z-10 text-center">
                  <FileImage
                    className="mx-auto mb-2 h-[30px] w-[30px]"
                    style={{ color: "var(--preview-image-icon)", opacity: 0.3 }}
                  />
                  <span className="block text-[12px]" style={{ color: "var(--preview-faint-text)" }}>
                    {item.meta || "图片"}
                  </span>
                  {item.title ? (
                    <span
                      className="mt-1 block text-[10px]"
                      style={{ color: "var(--preview-ghost-text)" }}
                    >
                      {item.title}
                    </span>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="max-h-[300px] overflow-auto">
            {item.title ? (
              <h3
                className="mb-2.5 text-[14px] font-semibold leading-[1.4]"
                style={{ color: "var(--text-primary)" }}
              >
                {item.title}
              </h3>
            ) : null}
            {renderRichContent(previewText)}
          </div>
        )}
      </div>

      {/* Footer：来自 · App */}
      <div
        className="flex items-center gap-1.5 px-3.5 py-2"
        style={{ borderTop: "1px solid var(--preview-divider-faint)" }}
      >
        <Clock size={10} style={{ color: "var(--preview-faint-icon)" }} />
        <span className="text-[10px]" style={{ color: "var(--preview-faint-text)" }}>
          来自{item.sourceApp ? ` · ${item.sourceApp}` : ""}
        </span>
      </div>
    </div>
  );
}