// TodayPlus Feed — the feed shell (spec §7) + block assembly (spec §4).
// Sticky blurred header (wordmark + personal read counter), 2px gold reading
// progress bar, breaking marquee ticker, then story cards (9 templates) with
// one interstitial module after every 3 story cards. Articles without a
// `display` payload render the existing legacy FeedCard. Single-player only —
// no aggregate user counts anywhere (§1.4).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import FeedCard from '../feed/FeedCard';
import CardBoundary from '../feed/CardBoundary';
import LazyMount from '../feed/LazyMount';
import { TP, FONT_HEAD, FONT_MONO, accentFor, plainText } from './tokens';
import { Entrance, useReducedMotion, useVisibleOnce } from './shared';
import { createSelector } from './selector';
import { buildModuleRotation, ModuleBlock } from './TPModules';
import {
  CoverCard, ClassicCard, StatHeroCard, QuoteCard,
  VersusCard, TimelineCard, SplitCard, ChartCard,
} from './TPCards';
import { MapCard } from './TPMapCard';

const CARD_BY_TEMPLATE = {
  cover: CoverCard,
  classic: ClassicCard,
  stat: StatHeroCard,
  quote: QuoteCard,
  versus: VersusCard,
  line: TimelineCard,
  split: SplitCard,
  chart: ChartCard,
  map: MapCard,
};

// ── Block assembly: incremental, stable across loadMore appends ─────────────

function useFeedBlocks(stories, modules) {
  const cacheRef = useRef(null);

  return useMemo(() => {
    const news = stories.filter((s) => s && s.type === 'news');
    const firstId = news[0]?.id ?? null;
    let cache = cacheRef.current;

    const modulesReady = !!modules;
    if (
      !cache ||
      cache.firstId !== firstId ||
      news.length < cache.count ||
      cache.modulesReady !== modulesReady
    ) {
      cache = {
        firstId,
        count: 0,
        blocks: [],
        selector: createSelector(),
        nextModule: buildModuleRotation(modules),
        storyCount: 0,
        blockIdx: 0,
        modulesReady,
      };
      cacheRef.current = cache;
    }

    for (let i = cache.count; i < news.length; i += 1) {
      const story = news[i];
      const display = story.display || null;
      let template = 'legacy';
      if (display) template = cache.selector.choose(display, cache.blockIdx);
      else cache.selector.recordLegacy(cache.blockIdx);

      cache.blocks.push({ type: 'story', story, template, key: `s-${story.id ?? i}` });
      cache.blockIdx += 1;
      cache.storyCount += 1;

      // One module after every 3 story cards (§4); modules don't touch rhythm.
      if (cache.storyCount % 3 === 0) {
        const item = cache.nextModule();
        if (item) {
          cache.blocks.push({ type: 'module', item, key: `m-${cache.blockIdx}-${cache.storyCount}` });
          cache.blockIdx += 1;
        }
      }
    }
    cache.count = news.length;
    return cache.blocks.slice();
  }, [stories, modules]);
}

// ── Sticky header pieces ─────────────────────────────────────────────────────

function ReadCounter({ count }) {
  const reduced = useReducedMotion();
  const [pop, setPop] = useState(false);
  const prevRef = useRef(count);
  useEffect(() => {
    if (count > prevRef.current && !reduced) {
      setPop(true);
      const t = setTimeout(() => setPop(false), 450);
      return () => clearTimeout(t);
    }
    prevRef.current = count;
    return undefined;
  }, [count, reduced]);
  useEffect(() => { prevRef.current = count; }, [count]);

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      transform: pop ? 'scale(1.14)' : 'scale(1)',
      transition: reduced ? 'none' : 'transform 0.45s cubic-bezier(.3,1.8,.4,1)',
    }}>
      <svg width="11" height="13" viewBox="0 0 11 14" aria-hidden>
        <path d="M6.5 0L0 8h4L3.5 14 11 5.5H6.6L8 0z" fill={TP.gold} />
      </svg>
      <span style={{
        fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 14, color: TP.ink,
        fontVariantNumeric: 'tabular-nums',
      }}>{count}</span>
      <span style={{
        fontFamily: FONT_MONO, fontSize: 9, fontWeight: 500,
        letterSpacing: '0.12em', color: TP.ink3,
      }}>READ</span>
    </span>
  );
}

function BreakingTicker({ items }) {
  const reduced = useReducedMotion();
  if (!items.length) return null;

  const line = items.map((title, i) => (
    <span key={i} style={{ whiteSpace: 'nowrap' }}>
      <span style={{ color: TP.red, fontWeight: 500 }}>BREAKING </span>
      <span style={{ color: TP.ink }}>{title}</span>
      <span style={{ color: TP.ink3 }}>{'   ·   '}</span>
    </span>
  ));

  return (
    <div style={{
      borderTop: `1px solid ${TP.line}`, borderBottom: `1px solid ${TP.line}`,
      padding: '7px 0', overflow: 'hidden',
      fontFamily: FONT_MONO, fontSize: 10.5,
    }}>
      {reduced ? (
        <div style={{ padding: '0 16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {line}
        </div>
      ) : (
        <div className="tp-ticker-track" style={{ display: 'flex', width: 'max-content' }}>
          <span style={{ display: 'inline-flex' }}>{line}</span>
          <span style={{ display: 'inline-flex' }} aria-hidden>{line}</span>
        </div>
      )}
    </div>
  );
}

// ── Story block: counts toward the read counter at ≥55% visibility ──────────

function StoryBlock({ story, template, onRead, onOpen, onEngage, isDark, textOnly }) {
  const ref = useVisibleOnce(0.55, onRead);
  const accent = accentFor(story.display?.category || story.category);
  const Card = CARD_BY_TEMPLATE[template];

  const open = (s) => {
    onEngage?.(s);
    onOpen?.(s);
  };

  return (
    <div ref={ref}>
      {Card && story.display ? (
        <div style={{ padding: '0 16px' }}>
          <Card story={story} display={story.display} accent={accent} onOpen={open} />
        </div>
      ) : (
        // display == null → the current/legacy card, untouched (light surface).
        <FeedCard
          story={story}
          isDark={false}
          textOnly={textOnly}
          onOpen={open}
          onEngage={onEngage}
        />
      )}
    </div>
  );
}

// ── The feed ─────────────────────────────────────────────────────────────────

export default function TodayPlusFeed({
  stories,
  user,
  paywallThreshold = 6,
  renderPaywall,
  onOpen,
  onEngage,
  onLoadMore,
  hasMore,
  loadingMore,
  textOnly,
  accountControl,
}) {
  const [modules, setModules] = useState(null);
  const [readCount, setReadCount] = useState(0);
  const readIdsRef = useRef(new Set());
  const [progress, setProgress] = useState(0);
  const sentinelRef = useRef(null);
  const reduced = useReducedMotion();

  // Daily interstitial modules — a missing key is skipped in the rotation.
  useEffect(() => {
    let alive = true;
    fetch('/api/feed/modules')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d?.modules) setModules(d.modules); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Reading progress bar (§7.1): scroll progress of the page.
  useEffect(() => {
    let raf = null;
    const update = () => {
      raf = null;
      const doc = document.documentElement;
      const scrollable = Math.max(1, doc.scrollHeight - window.innerHeight);
      setProgress(Math.min(1, Math.max(0, window.scrollY / scrollable)));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  // Infinite scroll (§7.4): sentinel ~1100px below the viewport bottom.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return undefined;
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) onLoadMore?.(); },
      { rootMargin: '1100px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, onLoadMore, loadingMore]);

  const blocks = useFeedBlocks(stories, modules);

  const breakingTitles = useMemo(
    () => blocks
      .filter((b) => b.type === 'story' && b.story.display?.breaking)
      .map((b) => plainText(b.story.display.title))
      .slice(0, 8),
    [blocks]
  );

  const markRead = (id) => {
    if (readIdsRef.current.has(id)) return;
    readIdsRef.current.add(id);
    setReadCount(readIdsRef.current.size);
  };

  // Render with the existing sign-up gate: non-users see paywall at index N.
  let storyIdx = 0;
  const rendered = [];
  for (const block of blocks) {
    if (block.type === 'story') {
      if (!user && storyIdx >= paywallThreshold) {
        if (storyIdx === paywallThreshold && renderPaywall) rendered.push(<React.Fragment key="paywall">{renderPaywall()}</React.Fragment>);
        break;
      }
      const id = String(block.story.id ?? block.key);
      rendered.push(
        <LazyMount key={block.key} estimate={520}>
          <CardBoundary>
            <Entrance entryKey={block.key}>
              <StoryBlock
                story={block.story}
                template={block.template}
                onRead={() => markRead(id)}
                onOpen={onOpen}
                onEngage={onEngage}
                textOnly={textOnly}
              />
            </Entrance>
          </CardBoundary>
        </LazyMount>
      );
      storyIdx += 1;
    } else {
      rendered.push(
        <LazyMount key={block.key} estimate={260}>
          <CardBoundary>
            <Entrance entryKey={block.key}>
              <div style={{ padding: '0 16px' }}>
                <ModuleBlock item={block.item} moduleKey={block.key} />
              </div>
            </Entrance>
          </CardBoundary>
        </LazyMount>
      );
    }
  }

  return (
    <div style={{ background: TP.bg, minHeight: '100vh' }}>
      {/* Sticky header (§7.1) */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(252,251,248,0.8)',
        backdropFilter: 'blur(18px) saturate(160%)',
        WebkitBackdropFilter: 'blur(18px) saturate(160%)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          maxWidth: 600, margin: '0 auto', padding: '12px 16px 10px',
          paddingTop: 'max(12px, env(safe-area-inset-top))',
        }}>
          <span style={{
            fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 17.5,
            letterSpacing: '-0.03em', color: TP.ink,
          }}>
            today<span style={{ color: TP.gold }}>plus</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 14 }}>
            <ReadCounter count={readCount} />
            {accountControl}
          </span>
        </div>
        {/* 2px reading progress bar */}
        <div style={{ height: 2, background: 'transparent' }}>
          <div style={{
            height: '100%', width: `${progress * 100}%`,
            background: TP.gold,
          }} />
        </div>
        <BreakingTicker items={breakingTitles} />
      </header>

      {/* Block list — 48px vertical rhythm (§2.4) */}
      <main style={{
        maxWidth: 600, margin: '0 auto',
        display: 'flex', flexDirection: 'column', gap: 48,
        padding: '24px 0 90px',
      }}>
        {rendered}

        {hasMore ? <div ref={sentinelRef} style={{ height: 1 }} /> : null}

        {loadingMore ? (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 7, padding: '8px 0' }}>
            {[0, 1, 2].map((i) => (
              <span key={i} className={reduced ? '' : 'tp-dot-hop'} style={{
                width: 5, height: 5, borderRadius: '50%', background: TP.ink3,
                animationDelay: `${i * 0.15}s`,
              }} />
            ))}
          </div>
        ) : null}

        {!hasMore && (user || storyIdx < paywallThreshold) ? (
          <div style={{
            textAlign: 'center', fontFamily: FONT_MONO, fontSize: 10.5,
            letterSpacing: '0.2em', textTransform: 'uppercase', color: TP.ink3,
          }}>· You're all caught up ·</div>
        ) : null}
      </main>

      {/* Keyframes for marquee / pulses / loader (reduce-motion kills them) */}
      <style jsx global>{`
        .tp-ticker-track {
          animation: tp-marquee 38s linear infinite;
        }
        @keyframes tp-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .tp-breaking-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: ${TP.breakingDot}; flex-shrink: 0;
          animation: tp-pulse-ring 2s ease-out infinite;
        }
        @keyframes tp-pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(255,90,82,0.7); }
          100% { box-shadow: 0 0 0 9px rgba(255,90,82,0); }
        }
        .tp-map-pulse {
          transform-box: fill-box;
          transform-origin: center;
          animation: tp-map-pulse 2.2s ease-out infinite;
        }
        @keyframes tp-map-pulse {
          0% { transform: scale(0.4); opacity: 0.9; }
          100% { transform: scale(2.6); opacity: 0; }
        }
        .tp-dot-hop {
          animation: tp-hop 0.9s ease-in-out infinite;
        }
        @keyframes tp-hop {
          0%, 100% { transform: translateY(0); background: ${TP.ink3}; }
          50% { transform: translateY(-7px); background: ${TP.gold}; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tp-ticker-track, .tp-breaking-dot, .tp-map-pulse, .tp-dot-hop {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
