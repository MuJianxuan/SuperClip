import { useCallback, useEffect, useRef, useState } from "react";

export interface UseHoverPreviewOptions {
  delay?: number;
  hideDelay?: number;
  /** 鼠标离开行时立即开始隐藏计时（默认 true）；popup 等悬浮窗距离行较远的场景可传 false，
   * 改由「离开窗口」handlePanelLeave 触发隐藏，避免行→悬浮窗长距离移动被中途隐藏 */
  hideOnRowLeave?: boolean;
}

export function useHoverPreview<T>(options: UseHoverPreviewOptions = {}) {
  const { delay = 300, hideDelay = 100, hideOnRowLeave = true } = options;
  const [hoveredItem, setHoveredItem] = useState<T | null>(null);
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);

  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const isOverPreviewRef = useRef(false);

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

  /** 统一隐藏计时入口：先清旧计时器再起新计时。所有触发源（行离开/窗口离开/离开悬浮窗）
   * 都走这里，避免残留的旧计时器在鼠标进入悬浮窗后再次触发隐藏 */
  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    hideTimerRef.current = window.setTimeout(() => {
      if (!isOverPreviewRef.current) {
        setIsPreviewVisible(false);
        setHoveredItem(null);
        setHoveredRect(null);
      }
      hideTimerRef.current = null;
    }, hideDelay);
  }, [hideDelay]);

  const handleRowEnter = useCallback(
    (item: T, rect: DOMRect) => {
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
    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (hideOnRowLeave) {
      scheduleHide();
    }
  }, [hideOnRowLeave, scheduleHide]);

  /** 鼠标离开 popup/主窗口（relatedTarget 不在窗口内）时重置隐藏计时；
   * 窗口内停留（等 hover 其他行/操作）不触发；进入悬浮窗时由 handlePreviewEnter 取消 */
  const handlePanelLeave = useCallback(() => {
    scheduleHide();
  }, [scheduleHide]);

  const handlePreviewEnter = useCallback(() => {
    isOverPreviewRef.current = true;
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const handlePreviewLeave = useCallback(() => {
    isOverPreviewRef.current = false;
    scheduleHide();
  }, [scheduleHide]);

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
  };
}
