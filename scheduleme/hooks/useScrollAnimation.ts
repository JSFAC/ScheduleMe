// hooks/useScrollAnimation.ts
import { useEffect, useRef, useState } from 'react';

interface UseScrollAnimationOptions {
  threshold?: number;   // 0–1, percentage of element visible to trigger
  rootMargin?: string;  // e.g. "0px 0px -80px 0px"
  once?: boolean;       // only trigger once (default true)
}

/**
 * useScrollAnimation
 *
 * Returns a ref to attach to a DOM element and a boolean `isVisible`
 * that flips true when the element enters the viewport.
 *
 * Usage:
 *   const { ref, isVisible } = useScrollAnimation();
 *   <div ref={ref} className={isVisible ? 'animate-fade-up' : 'opacity-0'}>
 */
export function useScrollAnimation(options: UseScrollAnimationOptions = {}) {
  const { threshold = 0.15, rootMargin = '0px 0px -60px 0px', once = true } = options;
  const ref = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) observer.unobserve(el);
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return { ref, isVisible };
}

/**
 * useStaggeredAnimation
 *
 * For a list of items — returns an array of visibility booleans,
 * each triggering slightly after the last.
 */
export function useStaggeredAnimation(count: number, staggerMs = 100) {
  const containerRef = useRef<HTMLElement>(null);
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Stagger each child visibility
          for (let i = 0; i < count; i++) {
            setTimeout(() => setVisibleCount((v) => Math.max(v, i + 1)), i * staggerMs);
          }
          observer.unobserve(el);
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [count, staggerMs]);

  return { containerRef, visibleItems: Array.from({ length: count }, (_, i) => i < visibleCount) };
}
