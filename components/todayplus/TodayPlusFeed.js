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
import { TP, FONT_MONO, accentFor } from './tokens';
import { Entrance, useReducedMotion } from './shared';
import { createSelector, rememberedTemplate, rememberTemplate } from './selector';
import { recordImpression, markSeenRead } from '../../utils/exposure';
import { buildModuleRotation, ModuleBlock } from './TPModules';
import {
  CoverCard, ClassicCard, StatHeroCard, QuoteCard,
  VersusCard, TimelineCard, SplitCard, ChartCard, ReceiptsCard,
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
  receipts: ReceiptsCard,
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
      if (display) {
        // Same article = same card style across loads (24h memory), so a
        // repeat can't masquerade as a new story in a different template.
        const kept = rememberedTemplate(story.id);
        if (kept && kept !== 'legacy' && CARD_BY_TEMPLATE[kept]) {
          template = cache.selector.use(kept, cache.blockIdx);
        } else {
          template = cache.selector.choose(display, cache.blockIdx);
          rememberTemplate(story.id, template);
        }
      } else {
        cache.selector.recordLegacy(cache.blockIdx);
      }

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

// ── Story block: counts toward the read counter at ≥55% visibility ──────────

function StoryBlock({ story, template, onOpen, onEngage, isDark, textOnly }) {
  const accent = accentFor(story.display?.category || story.category);
  const Card = CARD_BY_TEMPLATE[template];
  const rootRef = useRef(null);

  // Cards are read IN PLACE (no tap), so visibility is the read signal:
  //   ≥55% visible for 1.5s  → impression: exposure decay sinks it next load
  //   ≥55% visible for 7s    → read: 24h exclusion + engagement event, so the
  //                            interest engine keeps learning without taps.
  // Leaving the viewport before a threshold cancels it (fast scrolls count
  // nothing). Both fire at most once per card per page load.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || story?.id == null || story.type !== 'news') return undefined;
    let impressionTimer = null;
    let readTimer = null;
    let readDone = false;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting;
        if (visible) {
          if (!impressionTimer) {
            impressionTimer = setTimeout(() => recordImpression(story.id), 1500);
          }
          if (!readTimer && !readDone) {
            readTimer = setTimeout(() => {
              readDone = true;
              markSeenRead(story.id);
              try { onEngage?.(story); } catch (_) {}
              io.disconnect();
            }, 7000);
          }
        } else {
          if (impressionTimer) { clearTimeout(impressionTimer); impressionTimer = null; }
          if (readTimer) { clearTimeout(readTimer); readTimer = null; }
        }
      },
      { threshold: 0.55 }
    );
    io.observe(el);
    return () => {
      if (impressionTimer) clearTimeout(impressionTimer);
      if (readTimer) clearTimeout(readTimer);
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  // Per user direction (2026-06-13): tapping an article does NOTHING — cards
  // are read in place. Only bookmark/share in the footer are interactive.
  return (
    <div ref={rootRef}>
      {Card && story.display ? (
        <div style={{ padding: '0 16px' }}>
          <Card story={story} display={story.display} accent={accent} />
        </div>
      ) : (
        <FeedCard
          story={story}
          isDark={false}
          textOnly={textOnly}
          onOpen={() => {}}
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
}) {
  const [modules, setModules] = useState(null);
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

  // Render with the existing sign-up gate: non-users see paywall at index N.
  let storyIdx = 0;
  const rendered = [];
  for (const block of blocks) {
    if (block.type === 'story') {
      if (!user && storyIdx >= paywallThreshold) {
        if (storyIdx === paywallThreshold && renderPaywall) rendered.push(<React.Fragment key="paywall">{renderPaywall()}</React.Fragment>);
        break;
      }
      rendered.push(
        <LazyMount key={block.key} estimate={520}>
          <CardBoundary>
            <Entrance entryKey={block.key}>
              <StoryBlock
                story={block.story}
                template={block.template}
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
      {/* Per user direction (2026-06-12): no extra todayplus header / read
          counter / breaking ticker — the site's existing header is enough.
          The feed starts directly with the cards. */}

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
          .tp-map-pulse, .tp-dot-hop {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
