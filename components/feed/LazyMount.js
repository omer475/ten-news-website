'use client';

import { useState, useRef, useEffect } from 'react';

/*
 * LazyMount — defers a feed card until it nears the viewport, then keeps it
 * mounted. This prevents the initial freeze (rendering ~600 cards — images +
 * canvas color extraction + Mapbox — at once) WITHOUT the scroll jank that
 * comes from unmounting: once mounted, a card's height never changes under the
 * user, so scrolling stays smooth and never snaps back.
 */
export default function LazyMount({ children, estimate = 460 }) {
  const ref = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (mounted) return;
    const el = ref.current;
    if (!el) return;
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
      { rootMargin: '1200px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mounted]);

  // Reserve space before mount so the scrollbar doesn't jump; after mount the
  // card sizes itself. overflowAnchor:none keeps the browser from fighting scroll.
  return (
    <div ref={ref} style={{ minHeight: mounted ? undefined : estimate, overflowAnchor: 'none' }}>
      {mounted ? children : null}
    </div>
  );
}
