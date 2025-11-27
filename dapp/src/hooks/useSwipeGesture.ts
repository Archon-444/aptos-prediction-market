import { useEffect, useRef, useState } from 'react';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

interface UseSwipeGestureOptions {
  onSwipe?: (direction: SwipeDirection) => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  enabled?: boolean;
}

export const useSwipeGesture = ({
  onSwipe,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 50,
  enabled = true,
}: UseSwipeGestureOptions = {}) => {
  const [swipeDistance, setSwipeDistance] = useState({ x: 0, y: 0 });
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const currentY = useRef(0);
  const isSwiping = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      isSwiping.current = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isSwiping.current) return;

      currentX.current = e.touches[0].clientX;
      currentY.current = e.touches[0].clientY;

      const deltaX = currentX.current - startX.current;
      const deltaY = currentY.current - startY.current;

      setSwipeDistance({ x: deltaX, y: deltaY });
    };

    const handleTouchEnd = () => {
      if (!isSwiping.current) return;

      const deltaX = currentX.current - startX.current;
      const deltaY = currentY.current - startY.current;

      // Determine swipe direction
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX > threshold || absY > threshold) {
        if (absX > absY) {
          // Horizontal swipe
          const direction: SwipeDirection = deltaX > 0 ? 'right' : 'left';
          onSwipe?.(direction);
          if (direction === 'left') onSwipeLeft?.();
          if (direction === 'right') onSwipeRight?.();
        } else {
          // Vertical swipe
          const direction: SwipeDirection = deltaY > 0 ? 'down' : 'up';
          onSwipe?.(direction);
          if (direction === 'up') onSwipeUp?.();
          if (direction === 'down') onSwipeDown?.();
        }
      }

      // Reset
      isSwiping.current = false;
      setSwipeDistance({ x: 0, y: 0 });
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, onSwipe, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold]);

  return {
    swipeDistance,
    isSwiping: isSwiping.current,
  };
};
