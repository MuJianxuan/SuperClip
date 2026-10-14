import { useEffect, useMemo, useRef, useState } from "react";
import { FileImage } from "lucide-react";
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
  link: "链接",
  other: "其他",
};

/** 字节数 → 人类可读体积（B / KB / MB），保留 1 位小数 */
function formatBytes(bytes: number | undefined | null): string | null {
  if (typeof bytes !== "number" || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 字符数（按码点计，中文与 emoji 各算 1） */
function countChars(value: string): number {
  return Array.from(value).length;
}

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

/** 元信息小胶囊（等宽、浅底，与设计稿 pv-meta .chipx 同语言） */
function MetaChip({ children, testId }: { children: React.ReactNode; testId?: string }) {
  return (
    <span
      data-testid={testId}
      className="rounded-[5px] px-1.5 py-0.5 font-mono text-[10px]"
      style={{ background: "var(--surface-2)", color: "var(--text-tertiary)" }}
    >
      {children}
    </span>
  );
}

/** 表示清单：「这条记录携带哪些表示」（flavor 名 + 体积 + 截断标记），不含二进制。 */
function FlavorSection({ flavors }: { flavors: ClipboardItemDetail["flavors"] }) {
  const [expanded, setExpanded] = useState(false);

  if (!flavors || flavors.length === 0) return null;

  const visible = expanded ? flavors : flavors.slice(0, 6);
  const hiddenCount = flavors.length - visible.length;

  return (
    <section
      data-testid="preview-flavors"
      className="mb-2.5 rounded-[8px] px-2 py-1.5"
      style={{ background: "var(--surface-2)", border: "1px solid var(--preview-divider)" }}
    >
      <div
        className="mb-1 text-[10px] tracking-[0.3px]"
        style={{ color: "var(--text-tertiary)" }}
      >
        表示（{flavors.length}）
      </div>
      <ul className="m-0 list-none space-y-[3px] p-0">
        {visible.map((flavor) => (
          <li
            key={`${flavor.ordinal}-${flavor.format}`}
            className="flex items-center gap-1.5 text-[10.5px]"
            style={{ color: "var(--text-secondary)" }}
          >
            <span className="truncate font-mono">{flavor.format}</span>
            <span className="ml-auto shrink-0 tabular-nums" style={{ color: "var(--text-tertiary)" }}>
              {formatBytes(flavor.sizeBytes)}
            </span>
            {flavor.isTruncated ? (
              <span
                data-testid="preview-flavor-truncated"
                className="shrink-0 rounded-[4px] px-1"
                style={{ background: "var(--accent-soft)", color: "var(--accent-text)" }}
              >
                已截断
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {hiddenCount > 0 || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 text-[10px]"
          style={{ color: "var(--accent-text)" }}
        >
          {expanded ? "收起" : `还有 ${hiddenCount} 种…`}
        </button>
      ) : null}
    </section>
  );
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
            // 只更新 item；detail 清空交给下方 effect（依赖 item?.id）处理：
            // 同一行连续 hover 时 PopupApp 发来的 item 对象引用不变，setItem 不会重渲染，
            // 若在此清 detail 会导致 detail 停在 null——effect 依赖 item?.id 未变不重新加载，
            // 图片预览永远显示占位（切换行正常、离开再回来同一行异常）。
            setItem(event.payload.item);
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
    // item 变化时先清空旧 detail，避免串条；
    // 同一 item 连续 hover（引用不变）此 effect 不触发，detail 缓存直接复用
    setDetail(null);
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

  // emitRef 可能尚未就绪（懒加载 import 未完成/失败）：直接调用会因 optional chaining
  // 返回 undefined 后在 .catch 上抛 TypeError，进而中断 onMouseLeave——覆盖标记残留
  // 导致宿主悬浮窗永不消失。统一守卫：无 emit 时静默跳过。
  function emitPreviewEvent(event: string) {
    const emitFn = emitRef.current;
    if (emitFn) void emitFn(event).catch(() => {});
  }

  function handleMouseEnter() {
    emitPreviewEvent("preview:mouse-enter");
  }

  function handleMouseLeave() {
    emitPreviewEvent("preview:mouse-leave");
  }

  if (!item) {
    return <div className="h-screen w-screen" />;
  }

  const kindLabel = KIND_LABELS[item.kind] ?? item.kind;
  // 字符数只在 detail（全量 payload）就绪后统计：item.preview 是后端截断的预览文本，
  // 拿它统计会先显示偏小值再跳变；「暂无预览」占位文本也不应计数
  const fullText = detail?.payload?.textPlain?.trim();
  const previewText = fullText || item.preview || "暂无预览";
  const charCount =
    item.kind === "image" || item.kind === "file" || !fullText
      ? null
      : countChars(fullText);
  const sizeLabel = formatBytes(item.payloadSizeBytes);
  const useCount = item.useCount ?? 0;
  const sourceInitial = (item.sourceApp || "?").trim().charAt(0).toUpperCase();

  return (
    <div
      key={item.id}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="preview-shell flex h-screen w-screen flex-col overflow-hidden rounded-[12px] border border-[var(--popup-border)] bg-[var(--popup-bg)] shadow-[var(--popup-shadow)] frost-window"
      style={{ animation: "previewFadeIn 0.22s ease-out" }}
    >
      {/* Header：类型标签（中性灰）+ 时间 + 只读标识 */}
      <div
        className="flex shrink-0 items-center gap-2 px-3.5 pb-[9px] pt-[11px]"
        style={{ borderBottom: "1px solid var(--preview-divider)" }}
      >
        <span
          className="text-[12.5px] font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {kindLabel}
        </span>
        <span
          className="text-[11px] tabular-nums"
          style={{ color: "var(--preview-header-time)" }}
        >
          {item.timeLabel}
        </span>
        <span
          className="ml-auto text-[10px] tracking-[0.4px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          只读预览
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
        {item.isTruncated ? (
          <p
            data-testid="preview-truncated-note"
            className="mb-2 text-[11px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            该条目内容过大，已截断存储。
          </p>
        ) : null}
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
                    "linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, transparent), color-mix(in srgb, var(--warn) 8%, transparent)), var(--surface-2)",
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
                      "radial-gradient(circle at 30% 40%, var(--icon-idle) 0%, transparent 50%), radial-gradient(circle at 70% 60%, var(--icon-idle) 0%, transparent 50%)",
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
            {item.kind === "other" ? (
              <p
                data-testid="preview-copy-only-note"
                className="mb-2 text-[11px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                该类型仅支持复制，可手动粘贴。
              </p>
            ) : null}
            {renderRichContent(previewText)}
            <FlavorSection flavors={detail?.flavors ?? []} />
          </div>
        )}
      </div>

      {/* Footer：来源 App 头像 + 体积 / 字符数 / 使用次数（对齐 D9 元信息层级） */}
      <div
        className="flex shrink-0 items-center gap-[7px] px-3.5 py-[9px]"
        style={{ borderTop: "1px solid var(--preview-divider-faint)" }}
      >
        <span
          data-testid="preview-source-avatar"
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] text-[8.5px] font-bold"
          style={{ background: "var(--icon-bg)", color: "var(--text-secondary)" }}
        >
          {sourceInitial}
        </span>
        <span className="text-[10.5px]" style={{ color: "var(--preview-faint-text)" }}>
          来自 {item.sourceApp || "未知来源"}
        </span>
        <span className="ml-auto flex items-center gap-[7px]">
          {sizeLabel ? (
            <MetaChip testId="preview-meta-size">{sizeLabel}</MetaChip>
          ) : null}
          {charCount !== null ? (
            <MetaChip testId="preview-meta-chars">{charCount} 字符</MetaChip>
          ) : null}
          {useCount > 0 ? (
            <MetaChip testId="preview-meta-uses">复制过 {useCount} 次</MetaChip>
          ) : null}
        </span>
      </div>
    </div>
  );
}