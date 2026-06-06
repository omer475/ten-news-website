'use client';

import { useState, useRef, useEffect } from 'react';

/*
 * LazyMount — windowing for the continuous feed.
 * The feed can hold ~2000 articles in state; rendering them all at once
 * (images + canvas color extraction + Mapbox) locks the browser. This mounts
 * a card's real content only once it scrolls near the viewport; until then it
 * reserves space with a lightweight placeholder so scrolling stays smooth.
 */
export default function LazyMount({ children, estimate = 460 }) {
  const ref = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (mounted) return;
    const el = ref.current;
    if (!el) return;
    // Fallback for very old browsers: mount immediately.
    if (typeof IntersectionObserver === 'undefined') {
      setMounted(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMounted(true);
          io.disconnect();
        }
      },
      { rootMargin: '600px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mounted]);

  return (
    <div ref={ref} style={{ minHeight: mounted ? undefined : estimate }}>
      {mounted ? children : null}
    </div>
  );
}
