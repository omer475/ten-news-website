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
import { Entrance, useReducedMotion, FeedSignalContext, CardFooter } from './shared';
import { recordImpression, markSeenRead } from '../../utils/exposure';
import { buildModuleRotation, ModuleBlock } from './TPModules';
import { createPlanner } from './cardPlan';
import {
  CoverCard, ClassicCard, StatHeroCard, QuoteCard,
  VersusCard, TimelineCard, SplitCard, ChartCard, ReceiptsCard, ScoreCard,
  ArticleCard, PhotoStrip, WashLayer, InsetPhoto,
} from './TPCards';
import { MapCard } from './TPMapCard';

// Card-render instrumentation (§E): record dwell + skip for stat-hero / quote /
// versus shown PURE vs EMBEDDED, so we can later force types permanently pure
// if embedding loses. Fire-and-forget; deduped per card per load.
const _modeLogged = new Set();
function logCardMode(story, heroType, mode, outcome, dwellMs) {
  if (!story?.id || _modeLogged.has(`${story.id}:${outcome}`)) return;
  _modeLogged.add(`${story.id}:${outcome}`);
  try {
    const body = JSON.stringify({
      event_type: 'card_mode',
      article_id: story.id,
      metadata: { hero_type: heroType, mode, outcome, dwell_ms: Math.round(dwellMs) },
    });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/analytics/track', new Blob([body], { type: 'application/json' }));
    else fetch('/api/analytics/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch (_) {}
}
const INSTRUMENTED_HEROES = new Set(['big', 'stat', 'quote', 'versus']);

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
  score: ScoreCard,
  map: MapCard,
};

// ── Card render: content (article|data) × photo placement (v4) ──────────────

// A DATA card with its photo accent (placement) applied.
function DataCardView({ plan, story, display, accent }) {
  const Comp = CARD_BY_TEMPLATE[plan.template];
  if (!Comp) return null;
  const { placement } = plan;

  if (placement === 'inset') {
    return <Comp story={story} display={display} accent={accent} insetPhoto={<InsetPhoto display={display} story={story} />} />;
  }
  if (placement === 'wash') {
    return (
      <div style={{ position: 'relative', borderRadius: 24 }}>
        <WashLayer display={display} story={story} accent={accent} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Comp story={story} display={display} accent={accent} />
        </div>
      </div>
    );
  }
  if (placement === 'strip-above') {
    return (
      <div>
        <PhotoStrip display={display} story={story} position="above" />
        <Comp story={story} display={display} accent={accent} />
      </div>
    );
  }
  if (placement === 'strip-below') {
    // wrapper owns the footer so the strip sits between figure and footer:
    // suppress the card's built-in footer via context, render ours after the strip.
    return (
      <FeedSignalContext.Consumer>
        {(ctx) => (
          <div>
            <FeedSignalContext.Provider value={{ ...ctx, suppressFooter: true }}>
              <Comp story={story} display={display} accent={accent} />
            </FeedSignalContext.Provider>
            <PhotoStrip display={display} story={story} position="below" />
            <div style={{ marginTop: 14 }}>
              <CardFooter story={story} tags={display.tags} />
            </div>
          </div>
        )}
      </FeedSignalContext.Consumer>
    );
  }
  return <Comp story={story} display={display} accent={accent} />; // 'none' — clean data beat
}

// Resolve a plan to the right card component.
function CardView({ plan, story, display, accent }) {
  if (plan.mode === 'article') {
    if (plan.placement === 'full-bleed') return <CoverCard story={story} display={display} accent={accent} />;
    return <ArticleCard story={story} display={display} accent={accent} placement={plan.placement} />;
  }
  return <DataCardView plan={plan} story={story} display={display} accent={accent} />;
}

// ── Block assembly: incremental, stable across loadMore appends ─────────────

// Hero-first: opening the site should land on the day's biggest story as a
// full Cover card. Promote the highest-scored BREAKING story (with a usable
// full-bleed image) from the first dozen to position 0. Deterministic for a
// given stories array, so incremental appends stay stable.
function promoteHero(news) {
  let heroIdx = -1;
  let heroScore = -Infinity;
  let heroBreaking = false;
  for (let i = 0; i < Math.min(news.length, 12); i += 1) {
    const d = news[i]?.display;
    if (!d || d.cover_ok === false) continue;
    if (!(d.imageURL || news[i].urlToImage)) continue;
    const breaking = !!d.breaking;
    const score = Number(news[i].final_score) || 0;
    // breaking always outranks non-breaking; within a tier, highest score
    if (breaking && !heroBreaking) { heroBreaking = true; heroScore = score; heroIdx = i; continue; }
    if (breaking === heroBreaking && score > heroScore) { heroScore = score; heroIdx = i; }
  }
  if (heroIdx > 0) {
    const [hero] = news.splice(heroIdx, 1);
    news.unshift(hero);
  }
  return heroIdx >= 0;
}

function useFeedBlocks(stories, modules) {
  const cacheRef = useRef(null);

  return useMemo(() => {
    const news = stories.filter((s) => s && s.type === 'news');
    promoteHero(news); // reorders so the day's breaking story is first (→ pure cover)
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
        planner: createPlanner(),
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
      // display == null → legacy card (no plan). Otherwise the v3 planner
      // resolves ONE pure card type (image OR data) with the rhythm engine
      // carried across loadMore via the cached planner instance. The plan is
      // deterministic for a given stories order, so reloads stay stable without
      // a separate template memory.
      const plan = display ? cache.planner.plan(display, story) : null;

      // index-qualified so duplicate ids across loadMore appends can't collide
      cache.blocks.push({ type: 'story', story, plan, key: `s-${i}-${story.id ?? 'x'}` });
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

function StoryBlock({ story, plan, onOpen, onEngage, onSignal, isDark, textOnly }) {
  const accent = accentFor(story.display?.category || story.category);
  const rootRef = useRef(null);
  const [dismissed, setDismissed] = useState(false);

  // §E instrumentation: record which content type + placement each article
  // rendered as, plus dwell on read / skip on early exit.
  const heroType = plan?.template || (plan?.mode === 'article' ? 'article' : null);
  const instrument = !!heroType && INSTRUMENTED_HEROES.has(heroType);
  const mode = plan?.placement || 'none';

  // Signal bus for this card's footer (save / share / like / not-interested).
  const signalCtx = useMemo(() => ({
    fireSignal: (type) => { try { onSignal?.(type, story); } catch (_) {} },
    notInterested: () => { try { onSignal?.('article_not_interested', story); } catch (_) {} setDismissed(true); },
  }), [onSignal, story]);

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
    let enterAt = 0;
    let skipLogged = false;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting;
        if (visible) {
          enterAt = Date.now();
          if (!impressionTimer) {
            impressionTimer = setTimeout(() => recordImpression(story.id, story.world_event?.id), 1500);
          }
          if (!readTimer && !readDone) {
            readTimer = setTimeout(() => {
              readDone = true;
              markSeenRead(story.id, story.world_event?.id);
              try { onEngage?.(story); } catch (_) {}
              if (instrument) logCardMode(story, heroType, mode, 'read', Date.now() - enterAt);
              io.disconnect();
            }, 7000);
          }
        } else {
          if (impressionTimer) { clearTimeout(impressionTimer); impressionTimer = null; }
          if (readTimer) { clearTimeout(readTimer); readTimer = null; }
          // left before the 7s read → a skip; log dwell for pure-vs-embedded.
          if (instrument && !readDone && !skipLogged && enterAt) {
            skipLogged = true;
            logCardMode(story, heroType, mode, 'skip', Date.now() - enterAt);
          }
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
  }, [story?.id, heroType, mode]);

  // Cards are read IN PLACE — only the footer controls are interactive.
  const canRender = !!(story.display && plan && (plan.mode === 'article' || CARD_BY_TEMPLATE[plan.template]));

  if (dismissed) {
    return (
      <div ref={rootRef} style={{ padding: '0 16px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9, justifyContent: 'center',
          padding: '22px 0', color: TP.ink3, fontFamily: FONT_MONO, fontSize: 11,
          letterSpacing: '0.06em', borderTop: `1px solid ${TP.line}`, borderBottom: `1px solid ${TP.line}`,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={TP.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 6.5"/></svg>
          Got it — you’ll see less like this.
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef}>
      {!canRender ? (
        <FeedCard story={story} isDark={false} textOnly={textOnly} onOpen={() => {}} onEngage={onEngage} />
      ) : (
        <div style={{ padding: '0 16px' }}>
          <FeedSignalContext.Provider value={signalCtx}>
            <CardView plan={plan} story={story} display={story.display} accent={accent} />
          </FeedSignalContext.Provider>
        </div>
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
  onSignal,
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
                plan={block.plan}
                onOpen={onOpen}
                onEngage={onEngage}
                onSignal={onSignal}
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
