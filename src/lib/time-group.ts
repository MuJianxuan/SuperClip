/**
 * 列表分组口径：置顶项单独成组（后端 `ORDER BY is_pinned DESC, last_seen_at DESC` 会把置顶项
 * 排到最前，若仍按时间分组会出现「更早 → 今天 → 更早」的重复组头），其余按相对时间标签
 * （刚刚 / X 分钟前 / X 小时前 / X 天前）推断今天 / 昨天 / 更早。
 * Main 列表与 Popup 共用同一口径。
 */
export type TimeGroupId = "pinned" | "today" | "yesterday" | "earlier";

export const TIME_GROUP_ORDER: TimeGroupId[] = ["pinned", "today", "yesterday", "earlier"];

export const TIME_GROUP_LABELS: Record<TimeGroupId, string> = {
  pinned: "已置顶",
  today: "今天",
  yesterday: "昨天",
  earlier: "更早",
};

export function groupOf(timeLabel: string, isPinned = false): TimeGroupId {
  if (isPinned) return "pinned";
  if (timeLabel.includes("分钟") || timeLabel.includes("小时") || timeLabel === "刚刚") {
    return "today";
  }
  if (/^1 ?天前$/.test(timeLabel.trim())) {
    return "yesterday";
  }
  return "earlier";
}
