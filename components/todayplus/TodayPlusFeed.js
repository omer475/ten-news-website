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
import { TP, FONT_MONO, FONT_HEAD, accentFor } from './tokens';
import { Entrance, useReducedMotion } from './shared';
import { createSelector, rememberedTemplate, rememberTemplate } from './selector';
import { recordImpression, markSeenRead } from '../../utils/exposure';
import { buildModuleRotation, ModuleBlock, countdownCards } from './TPModules';
import {
  CoverCard, ClassicCard, StatHeroCard, QuoteCard,
  VersusCard, TimelineCard, SplitCard, ChartCard, ReceiptsCard, ScoreCard,
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
  score: ScoreCard,
  map: MapCard,
};

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
    const hasHero = promoteHero(news);
    const firstId = news[0]?.id ?? null;
    let cache = cacheRef.current;

    const modulesReady = !!modules;
    // Identity of the module payload — a personalized refetch (login/out, interests)
    // swaps one non-null payload for another, so the boolean modulesReady alone
    // wouldn't rebuild; this forces a clean rebuild (fresh rotation + countdownPool).
    const modulesSig = modules
      ? JSON.stringify({ d: modules.date || null, p: modules.countdown_primary || null, c: modules.countdown_cards || null, n: modules.notd || null, h: !!modules.history?.rows?.length, b: !!modules.briefs?.rows?.length })
      : null;
    if (
      !cache ||
      cache.firstId !== firstId ||
      news.length < cache.count ||
      cache.modulesReady !== modulesReady ||
      cache.modulesSig !== modulesSig
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
        modulesSig,
        countdownPool: countdownCards(modules),
        sinceCountdown: 0,
        lastRestType: null,
      };
      cacheRef.current = cache;
    }

    if (!cache.lightPool) cache.lightPool = [];
    if (cache.countdownPool == null) cache.countdownPool = countdownCards(modules);
    if (cache.sinceCountdown == null) cache.sinceCountdown = 0;
    if (cache.lastRestType === undefined) cache.lastRestType = null;

    // Assign a template (honoring 24h per-article memory + image rhythm) and push.
    const placeStory = (story, key, isFirst) => {
      const display = story.display || null;
      let template = 'legacy';
      if (display) {
        if (isFirst && hasHero) {
          // The promoted breaking story always opens as the flagship Cover.
          template = cache.selector.use('cover', cache.blockIdx, display);
          rememberTemplate(story.id, 'cover');
        } else {
          // Same article = same card style across loads (24h memory).
          const kept = rememberedTemplate(story.id);
          const reused = kept && kept !== 'legacy' && CARD_BY_TEMPLATE[kept]
            ? cache.selector.use(kept, cache.blockIdx, display)
            : null;
          if (reused) {
            template = reused;
          } else {
            template = cache.selector.choose(display, cache.blockIdx);
            rememberTemplate(story.id, template);
          }
        }
      } else {
        cache.selector.recordLegacy(cache.blockIdx);
      }
      cache.blocks.push({ type: 'story', story, template, key });
      cache.blockIdx += 1;
      cache.storyCount += 1;
      cache.sinceCountdown += 1;
      // Essential stories are split into Layer 1 at render, so they don't count
      // as the "previous rendered block" for Layer-2 no-cluster checks.
      if (!story.is_essential) cache.lastRestType = 'story';
    };

    // Feature 3 — a non-essential "light" story becomes a mood reset placed ~every
    // 10 cards (not its natural slot). Essentials never get pulled aside.
    const isLight = (s) => !!(s && s.display && String(s.display.tone || '').toLowerCase().startsWith('li')) && !s.is_essential;

    for (let i = cache.count; i < news.length; i += 1) {
      const story = news[i];

      // Hold light stories aside (the hero at i===0 is never pooled).
      if (isLight(story) && !(i === 0 && hasHero)) { cache.lightPool.push(story); continue; }

      placeStory(story, `s-${story.id ?? i}`, i === 0);

      // One module after every 3 story cards (§4); modules don't touch rhythm.
      if (cache.storyCount % 3 === 0) {
        const item = cache.nextModule();
        if (item) {
          cache.blocks.push({ type: 'module', item, key: `m-${cache.blockIdx}-${cache.storyCount}` });
          cache.blockIdx += 1;
          cache.lastRestType = 'module';
        }
      }

      // One light story as a mood reset every ~10 cards (never two in a row).
      if (cache.storyCount % 10 === 0 && cache.lightPool.length) {
        const ls = cache.lightPool.shift();
        placeStory(ls, `s-light-${ls.id}`, false);
      }

      // An extra relevant countdown card ~every 9 cards — but never right after
      // another module/countdown in the RENDERED layer (essentials are split out,
      // so check the last non-essential block, not the raw flat array). Holds the
      // slot until a clean spot opens, then resets.
      if (cache.sinceCountdown >= 9 && cache.countdownPool.length) {
        if (cache.lastRestType !== 'module') {
          const cd = cache.countdownPool.shift();
          cache.blocks.push({ type: 'module', item: { kind: 'countdown', row: cd }, key: `cd-${cd.id ?? cache.blockIdx}` });
          cache.blockIdx += 1;
          cache.lastRestType = 'module';
          cache.sinceCountdown = 0;
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
            impressionTimer = setTimeout(() => recordImpression(story.id, story.world_event?.id), 1500);
          }
          if (!readTimer && !readDone) {
            readTimer = setTimeout(() => {
              readDone = true;
              markSeenRead(story.id, story.world_event?.id);
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

// ── Layer dividers / finish line (black minimal) ───────────────────────────
function FeedDivider({ label }) {
  return (
    <div style={{ padding: '0 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ flex: 1, height: 1, background: TP.line }} />
        <span style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: TP.ink2, whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ flex: 1, height: 1, background: TP.line }} />
      </div>
    </div>
  );
}

function FeedNote({ text }) {
  return (
    <div style={{ padding: '0 20px', textAlign: 'center', fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: TP.ink3 }}>
      {text}
    </div>
  );
}

function EssentialsFinish({ onKeepReading }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '8px 24px' }}>
      <div style={{ width: 42, height: 42, borderRadius: '50%', border: `1.5px solid ${TP.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={TP.ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7" /></svg>
      </div>
      <div style={{ fontFamily: FONT_HEAD, fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em', color: TP.ink, textAlign: 'center', maxWidth: 280, lineHeight: 1.25 }}>
        You’re caught up on today’s essentials
      </div>
      <button onClick={onKeepReading} style={{
        all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7,
        height: 44, padding: '0 22px', borderRadius: 999, background: TP.ink, color: '#000',
        fontFamily: FONT_HEAD, fontSize: 15, fontWeight: 600, WebkitTapHighlightColor: 'transparent',
      }}>
        Keep reading
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
      </button>
    </div>
  );
}

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
  const [lastVisit, setLastVisit] = useState(undefined); // undefined=loading · null=first visit · number=ms
  const sentinelRef = useRef(null);
  const reduced = useReducedMotion();

  // "New since you were here": read the PRIOR visit, THEN stamp now. For logged-in
  // users also fold in the backend's last_feed_visit_at when exposed. Read once.
  useEffect(() => {
    let prev = null;
    try {
      const v = localStorage.getItem('tn_last_visit');
      prev = v ? Number(v) : null;
      localStorage.setItem('tn_last_visit', String(Date.now()));
    } catch (_) {}
    let backend = null;
    try {
      const t = user && user.last_feed_visit_at;
      if (t) { const ms = new Date(t).getTime(); if (!Number.isNaN(ms)) backend = ms; }
    } catch (_) {}
    const cand = [prev, backend].filter((v) => v != null && !Number.isNaN(v));
    setLastVisit(cand.length ? Math.max(...cand) : null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Daily interstitial modules — USER-AWARE: pass auth id / guest id + the
  // locally-known interests so the payload is personalized. Unknown params are
  // ignored by the backend, and a global payload still renders fine.
  useEffect(() => {
    let alive = true;
    const qs = new URLSearchParams();
    try {
      const u = JSON.parse(localStorage.getItem('tennews_user') || 'null');
      if (u && u.id) qs.set('user_id', String(u.id));
    } catch (_) {}
    try {
      let gid = localStorage.getItem('tn_guest_id');
      if (!gid) { gid = `g_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`; localStorage.setItem('tn_guest_id', gid); }
      qs.set('guest_device_id', gid); // match the house contract (api/feed/main, explore, analytics)
    } catch (_) {}
    try {
      const p = JSON.parse(localStorage.getItem('todayplus_preferences') || 'null');
      if (p) {
        if (Array.isArray(p.followed_topics) && p.followed_topics.length) qs.set('topics', p.followed_topics.join(','));
        if (Array.isArray(p.followed_subtopics) && p.followed_subtopics.length) qs.set('subtopics', p.followed_subtopics.slice(0, 24).join(','));
        if (p.home_country) qs.set('country', String(p.home_country));
      }
    } catch (_) {}
    const url = qs.toString() ? `/api/feed/modules?${qs.toString()}` : '/api/feed/modules';
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d?.modules) setModules(d.modules); })
      .catch(() => {});
    return () => { alive = false; };
    // Depend on the stable auth id (not the user object, which gets a fresh
    // reference every render for guests) so we refetch on login/out, not on every render.
  }, [user && user.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Two-layer feed: Today's Essentials first → finish line → Keep reading ──
  const renderStoryBlock = (block) => (
    <LazyMount key={block.key} estimate={520}>
      <CardBoundary>
        <Entrance entryKey={block.key}>
          <StoryBlock story={block.story} template={block.template} onOpen={onOpen} onEngage={onEngage} textOnly={textOnly} />
        </Entrance>
      </CardBoundary>
    </LazyMount>
  );
  const renderModuleBlock = (block) => (
    <LazyMount key={block.key} estimate={260}>
      <CardBoundary>
        <Entrance entryKey={block.key}>
          <div style={{ padding: '0 16px' }}><ModuleBlock item={block.item} moduleKey={block.key} /></div>
        </Entrance>
      </CardBoundary>
    </LazyMount>
  );

  const storyMs = (s) => {
    const t = s && (s.published_at || s.publishedAt);
    const ms = t ? new Date(t).getTime() : NaN;
    return Number.isNaN(ms) ? null : ms;
  };

  const essentialBlocks = blocks.filter((b) => b.type === 'story' && b.story && b.story.is_essential);
  const restBlocks = blocks.filter((b) => !(b.type === 'story' && b.story && b.story.is_essential));
  const hasEssentials = essentialBlocks.length > 0;
  const isReturn = typeof lastVisit === 'number';
  const newEssentials = isReturn
    ? essentialBlocks.filter((b) => { const ms = storyMs(b.story); return ms != null && ms > lastVisit; }).length
    : 0;

  // Sign-up gate spans both layers (paywall after N total stories).
  let storyIdx = 0;
  let stopped = false;
  const gateStory = (push, block, bucket) => {
    if (stopped) return;
    if (!user && storyIdx >= paywallThreshold) {
      if (storyIdx === paywallThreshold && renderPaywall) bucket.push(<React.Fragment key="paywall">{renderPaywall()}</React.Fragment>);
      stopped = true;
      return;
    }
    bucket.push(push(block));
    storyIdx += 1;
  };

  // Layer 1 — essentials (+ "new since you were here" divider on return visits)
  const layer1 = [];
  if (isReturn && hasEssentials && newEssentials === 0) {
    layer1.push(<FeedNote key="ahead" text="Nothing major since you were here — you're ahead." />);
  }
  let newDividerPlaced = false;
  for (const block of essentialBlocks) {
    if (isReturn && !newDividerPlaced && newEssentials > 0) {
      const ms = storyMs(block.story);
      if (ms != null && ms > lastVisit) { layer1.push(<FeedDivider key="new-since" label="New since you were here" />); newDividerPlaced = true; }
    }
    gateStory(renderStoryBlock, block, layer1);
  }

  // Layer 2 — the rest (infinite scroll)
  const layer2 = [];
  for (const block of restBlocks) {
    if (stopped) break;
    if (block.type === 'story') gateStory(renderStoryBlock, block, layer2);
    else layer2.push(renderModuleBlock(block));
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
        {layer1}

        {hasEssentials && !stopped ? (
          <EssentialsFinish onKeepReading={() => {
            try { document.getElementById('tp-keep-reading')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); } catch (_) {}
          }} />
        ) : null}

        {hasEssentials ? <div id="tp-keep-reading" style={{ scrollMarginTop: 70 }} /> : null}

        {layer2}

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
