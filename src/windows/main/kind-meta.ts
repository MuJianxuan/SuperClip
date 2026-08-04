import type { LucideIcon } from "lucide-react";
import { File, FileCode2, FileImage, FileText, Type } from "lucide-react";
import type { ClipboardKind } from "../../components/history-row";

/**
 * E2 统一的类型元数据：全表面类型色 token（text #38bdf8 / image #fb7185 /
 * file #60a5fa / html #a78bfa），rtf 归入文本类色。
 */
export const KIND_META: Record<ClipboardKind, { label: string; color: string; icon: LucideIcon }> = {
  text: { label: "文本", color: "#38bdf8", icon: Type },
  html: { label: "HTML", color: "#a78bfa", icon: FileCode2 },
  rtf: { label: "RTF", color: "#38bdf8", icon: FileText },
  image: { label: "图片", color: "#fb7185", icon: FileImage },
  file: { label: "文件", color: "#60a5fa", icon: File },
};

export function kindColor(kind: ClipboardKind): string {
  return KIND_META[kind]?.color ?? "#38bdf8";
}
