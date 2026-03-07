// hooks/useScrollReveal.ts
// Apple-style IntersectionObserver scroll reveal hook.
// Elements start invisible and animate in once they enter the viewport.

import { useEffect, useRef, RefObject } from 'react';

interface ScrollRevealOptions {
  threshold?: number;   // 0–1, default 0.15
  rootMargin?: string;  // default '0px 0px -60px 0px'
  once?: boolean;       // animate only once (default true)
}

/**
 * useScrollReveal
 *
 * Attach the returned ref to any element. On mount, the element will have
 * `data-reveal="hidden"` applied (opacity 0, translateY 24px). When it
 * crosses the threshold, `data-reveal="visible"` is set (opacity 1, translate 0).
 *
 * CSS transitions for [data-reveal] are defined in globals.css.
 */
export function useScrollReveal<T extends HTMLElement>(
  options: ScrollRevealOptions = {},
): RefObject<T> {
  const ref = useRef<T>(null);
  const { threshold = 0.15, rootMargin = '0px 0px -60px 0px', once = true } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.setAttribute('data-reveal', 'hidden');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.setAttribute('data-reveal', 'visible');
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            entry.target.setAttribute('data-reveal', 'hidden');
          }
        });
      },
      { threshold, rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return ref;
}

/**
 * useScrollRevealGroup
 *
 * Stagger-reveals a list of child elements inside a parent container.
 * Each child gets an increasing animation-delay (delayStep * index ms).
 */
export function useScrollRevealGroup<T extends HTMLElement>(
  count: number,
  options: ScrollRevealOptions & { delayStep?: number } = {},
): RefObject<T>[] {
  const { delayStep = 80, ...revealOpts } = options;
  const refs = Array.from({ length: count }, () => useRef<T>(null)); // eslint-disable-line react-hooks/rules-of-hooks

  useEffect(() => {
    const els = refs.map((r) => r.current).filter(Boolean) as T[];
    if (!els.length) return;

    els.forEach((el, i) => {
      el.setAttribute('data-reveal', 'hidden');
      el.style.transitionDelay = `${i * delayStep}ms`;
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.setAttribute('data-reveal', 'visible');
            if (revealOpts.once !== false) observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: revealOpts.threshold ?? 0.1,
        rootMargin: revealOpts.rootMargin ?? '0px 0px -40px 0px',
      },
    );

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return refs;
}
