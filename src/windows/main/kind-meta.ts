import type { LucideIcon } from "lucide-react";
import { File, FileCode2, FileImage, FileText, Layers, Link2, Type } from "lucide-react";
import type { ClipboardKind } from "../../components/history-row";

/**
 * E2 统一的类型元数据：类型色已收敛为中性灰（--icon-idle），
 * 类型只靠图标形状区分；全表面仅保留强调色 / 置顶 / 危险三种语义用色。
 */
export const KIND_META: Record<ClipboardKind, { label: string; icon: LucideIcon }> = {
  text: { label: "文本", icon: Type },
  html: { label: "HTML", icon: FileCode2 },
  rtf: { label: "RTF", icon: FileText },
  image: { label: "图片", icon: FileImage },
  file: { label: "文件", icon: File },
  link: { label: "链接", icon: Link2 },
  other: { label: "其他", icon: Layers },
};
