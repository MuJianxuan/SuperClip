import type { LucideIcon } from "lucide-react";
import { File, FileCode2, FileImage, FileText, Type } from "lucide-react";
import type { ClipboardKind } from "./types";

/** 与正式 `src/windows/main/kind-meta.ts` 对齐的类型元数据 */
export const KIND_META: Record<
  ClipboardKind,
  { label: string; color: string; icon: LucideIcon }
> = {
  text: { label: "文本", color: "#38bdf8", icon: Type },
  html: { label: "HTML", color: "#a78bfa", icon: FileCode2 },
  rtf: { label: "RTF", color: "#38bdf8", icon: FileText },
  image: { label: "图片", color: "#fb7185", icon: FileImage },
  file: { label: "文件", color: "#60a5fa", icon: File },
};

export function kindColor(kind: ClipboardKind): string {
  return KIND_META[kind]?.color ?? "#38bdf8";
}
