'use client';

import { useState, useRef, useEffect } from 'react';

/*
 * LazyMount — true windowing for the continuous feed.
 * The feed can hold ~2000 articles in state. Rendering them all (images +
 * canvas color extraction + Mapbox GL) — or even just keeping every card the
 * user has scrolled past mounted — locks the browser. This mounts a card's
 * content only while it is near the viewport and UNMOUNTS it once it scrolls
 * far away, reserving the last measured height so scrolling stays stable.
 */
export default function LazyMount({ children, estimate = 460 }) {
  const ref = useRef(null);
  const heightRef = useRef(estimate);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setVisible(true);
        } else {
          // Remember the rendered height before unmounting so layout doesn't jump.
          const h = el.getBoundingClientRect().height;
          if (h > 0) heightRef.current = h;
          setVisible(false);
        }
      },
      { rootMargin: '800px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ minHeight: visible ? undefined : heightRef.current }}>
      {visible ? children : null}
    </div>
  );
}
