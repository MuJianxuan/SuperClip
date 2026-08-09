import { useCallback, useEffect, useRef, useState } from "react";

export interface UseHoverPreviewOptions {
  delay?: number;
  hideDelay?: number;
  /** 鼠标离开行时立即开始隐藏计时（默认 true）；popup 等悬浮窗距离行较远的场景可传 false，
   * 改由「离开窗口」handlePanelLeave 触发隐藏，避免行→悬浮窗长距离移动被中途隐藏 */
  hideOnRowLeave?: boolean;
}

/** 悬浮窗「覆盖」标记（isOverPreviewRef）的存活上限。preview:mouse-leave 事件在
 * WKWebView/非激活面板场景可能丢失（鼠标跨界移出不派发 mouseleave），标记会永久卡 true，
 * 导致后续所有隐藏计时被跳过（悬浮窗永不消失）。进入悬浮窗超过该时长且鼠标不在任何行上时，
 * 强制解除覆盖并开始隐藏计时。 */
const PREVIEW_OVERSTAY_MS = 10_000;

export function useHoverPreview<T>(options: UseHoverPreviewOptions = {}) {
  const { delay = 300, hideDelay = 100, hideOnRowLeave = true } = options;
  const [hoveredItem, setHoveredItem] = useState<T | null>(null);
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);

  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const isOverPreviewRef = useRef(false);
  /** 鼠标当前是否在列表行上：悬浮窗跟随行时（行 enter 先于悬浮窗 leave IPC 到达）
   * 由 handlePreviewLeave 据此跳过隐藏计时，修复从悬浮窗移回行的竞态误隐藏 */
  const rowActiveRef = useRef(false);
  /** 进入悬浮窗后启动的覆盖失效兜底计时器（见 PREVIEW_OVERSTAY_MS） */
  const overstayTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  /** 统一隐藏计时入口。所有触发源（行离开/窗口离开/离开悬浮窗/轮询）都走这里。
   * 幂等：已有隐藏计时在跑时不重启——高频触发（轮询间隔 < hideDelay、连续离开
   * 事件）若每次都重置，计时器会被无限推迟永不触发（悬浮窗永不消失）。需要重新
   * 计时的场景（鼠标回到行/悬浮窗上）由对应 handler 先 clear 再 scheduleHide。 */
  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current !== null) {
      return;
    }
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      if (!isOverPreviewRef.current) {
        setIsPreviewVisible(false);
        setHoveredItem(null);
        setHoveredRect(null);
      }
    }, hideDelay);
  }, [hideDelay]);

  const handleRowEnter = useCallback(
    (item: T, rect: DOMRect) => {
      // 新行 hover 时鼠标必然在行上（不在悬浮窗上）：重置悬浮窗覆盖标记，
      // 清除上次 hover 残留的 true——否则后续所有隐藏计时都会被跳过（悬浮窗永不消失）
      isOverPreviewRef.current = false;
      rowActiveRef.current = true;

      // 鼠标回到行上：覆盖失效兜底计时作废（后续重新进入悬浮窗会重启）
      if (overstayTimerRef.current !== null) {
        window.clearTimeout(overstayTimerRef.current);
        overstayTimerRef.current = null;
      }

      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }

      if (showTimerRef.current !== null) {
        window.clearTimeout(showTimerRef.current);
      }

      setHoveredItem(item);
      setHoveredRect(rect);

      showTimerRef.current = window.setTimeout(() => {
        setIsPreviewVisible(true);
        showTimerRef.current = null;
      }, delay);
    },
    [delay],
  );

  const handleRowLeave = useCallback(() => {
    // 鼠标离开行：清显示计时器（快速滑过行时不显示预览）；
    // 按配置决定是否立即开始隐藏计时
    rowActiveRef.current = false;
    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (hideOnRowLeave) {
      scheduleHide();
    }
  }, [hideOnRowLeave, scheduleHide]);

  /** 鼠标离开 popup/主窗口（relatedTarget 不在窗口内）时重置隐藏计时；
   * 窗口内停留（等 hover 其他行/操作）不触发；进入悬浮窗时由 handlePreviewEnter 取消。
   * 同时作废悬浮窗覆盖标记：鼠标已离开宿主窗口，此前进入悬浮窗留下的 isOverPreviewRef
   * 必须清除，否则 preview:mouse-leave 丢失时会永久卡 true、跳过本计时（悬浮窗永不消失） */
  const handlePanelLeave = useCallback(() => {
    rowActiveRef.current = false;
    isOverPreviewRef.current = false;
    if (overstayTimerRef.current !== null) {
      window.clearTimeout(overstayTimerRef.current);
      overstayTimerRef.current = null;
    }
    scheduleHide();
  }, [scheduleHide]);

  const handlePreviewEnter = useCallback(() => {
    isOverPreviewRef.current = true;
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    // 兜底：preview:mouse-leave 丢失时覆盖标记会永久卡 true（悬浮窗永不消失）。
    // 进入悬浮窗超过 PREVIEW_OVERSTAY_MS 且鼠标不在任何行上，视为已离开悬浮窗，
    // 强制解除覆盖并隐藏（正常场景下鼠标在悬浮窗上停留不会超过该时长）
    if (overstayTimerRef.current !== null) {
      window.clearTimeout(overstayTimerRef.current);
      overstayTimerRef.current = null;
    }
    overstayTimerRef.current = window.setTimeout(() => {
      overstayTimerRef.current = null;
      if (!rowActiveRef.current) {
        isOverPreviewRef.current = false;
        scheduleHide();
      }
    }, PREVIEW_OVERSTAY_MS);
  }, [scheduleHide]);

  const handlePreviewLeave = useCallback(() => {
    isOverPreviewRef.current = false;
    // 鼠标从悬浮窗移回列表行时，行 enter 已先于悬浮窗 leave IPC 到达（rowActive=true），
    // 悬浮窗正在跟随该行——此时启动隐藏计时会误杀悬浮窗；移到空白/窗口外才隐藏
    if (rowActiveRef.current) return;
    scheduleHide();
  }, [scheduleHide]);

  /** 重置全部悬停状态（窗口隐藏/显示切换时调用）：清计时器 + 覆盖标记 + 状态，
   * 避免残留状态在窗口隐藏后仍响应全局 preview 事件、干扰共享悬浮窗 */
  const reset = useCallback(() => {
    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (overstayTimerRef.current !== null) {
      window.clearTimeout(overstayTimerRef.current);
      overstayTimerRef.current = null;
    }
    isOverPreviewRef.current = false;
    rowActiveRef.current = false;
    setIsPreviewVisible(false);
    setHoveredItem(null);
    setHoveredRect(null);
  }, []);

  useEffect(() => {
    return clearTimers;
  }, [clearTimers]);

  return {
    hoveredItem,
    hoveredRect,
    isPreviewVisible,
    handleRowEnter,
    handleRowLeave,
    handlePanelLeave,
    handlePreviewEnter,
    handlePreviewLeave,
    reset,
  };
}
