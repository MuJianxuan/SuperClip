import { useCallback, useEffect, useRef, useState } from "react";

export interface UseHoverPreviewOptions {
  delay?: number;
  hideDelay?: number;
}

export function useHoverPreview<T>(options: UseHoverPreviewOptions = {}) {
  const { delay = 300, hideDelay = 100 } = options;
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
    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
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

  const handlePreviewEnter = useCallback(() => {
    isOverPreviewRef.current = true;
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const handlePreviewLeave = useCallback(() => {
    isOverPreviewRef.current = false;
    hideTimerRef.current = window.setTimeout(() => {
      setIsPreviewVisible(false);
      setHoveredItem(null);
      setHoveredRect(null);
      hideTimerRef.current = null;
    }, hideDelay);
  }, [hideDelay]);

  useEffect(() => {
    return clearTimers;
  }, [clearTimers]);

  return {
    hoveredItem,
    hoveredRect,
    isPreviewVisible,
    handleRowEnter,
    handleRowLeave,
    handlePreviewEnter,
    handlePreviewLeave,
  };
}
