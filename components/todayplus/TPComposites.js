// TodayPlus Feed — composite layouts v2.
//
// A composite = an image base (Cover or Classic) with ONE module embedded
// "open" beneath it, and the remaining supported modules demoted to a thin
// switcher-pill row (tap to swap which module is open). Embedded modules
// render SMALL, light-on-white — distinct from their full-frame pure cards.
//
// The 8 shapes: COVER, COVER_STATS, CLASSIC_STATS, CLASSIC_CHART,
// CLASSIC_TIMELINE, CLASSIC_VERSUS, CLASSIC_QUOTE, SPLIT. COVER/COVER_STATS
// reuse the existing CoverCard (it already lays the headline in the photo and
// shows the open stats row); SPLIT reuses SplitCard. The CLASSIC_* family is
// assembled here.

import React, { useState, useEffect } from 'react';
import { TP, FONT_HEAD, FONT_BODY, FONT_MONO, Markup, formatNumber } from './tokens';
import {
  KickerRow, Bullets, StatsRow, CardFooter, Headline,
  ParallaxImage, CountUp, useRevealOnce, revealStyle,
} from './shared';
import { CoverCard, SplitCard, MiniChart } from './TPCards';

// ── embedded mini-modules (small, light-on-white) ────────────────────────────

function MiniStats({ display, accent, storyId }) {
  return <StatsRow stats={display.stats} accent={accent} cardKey={`emb-${storyId}`} />;
}

function MiniChartEmbed({ display, accent, storyId }) {
  // MiniChart already renders a 64px line / mini-donut / 3-row ranking + caption.
  return <MiniChart display={display} accent={accent} storyId={storyId} />;
}

function MiniTimeline({ display, accent }) {
  const entries = (display.timeline || []).slice(0, 3);
  if (!entries.length) return null;
  return (
    <div style={{ position: 'relative' }}>
      <span style={{
        position: 'absolute', left: 4, top: 5, bottom: 5, width: 1.5,
        background: `linear-gradient(to bottom, ${accent}, ${TP.line})`,
      }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {entries.map((entry, i) => {
          const [date, text] = Array.isArray(entry) ? entry : [entry?.date, entry?.text];
          return (
            <div key={i} style={{ position: 'relative', paddingLeft: 22 }}>
              <span style={{
                position: 'absolute', left: 0, top: 1, width: 9, height: 9, borderRadius: '50%',
                border: `2px solid ${accent}`, background: i === 0 ? accent : TP.bg, boxSizing: 'border-box',
              }} />
              <span style={{
                fontFamily: FONT_MONO, fontSize: 9, fontWeight: 500, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: accent,
              }}>{date}</span>
              <div style={{ fontFamily: FONT_BODY, fontSize: 13.5, lineHeight: 1.45, color: TP.ink2, marginTop: 2 }}>
                <Markup raw={text || ''} emColor={accent} strongColor={TP.ink} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniVersus({ display, accent, storyId }) {
  const v = display.versus || { a: {}, b: {}, ratio: 0.5 };
  const ratio = Math.min(0.95, Math.max(0.05, Number(v.ratio) || 0.5));
  const side = (s, key, align) => (
    <div style={{ textAlign: align, minWidth: 0, flex: 1 }}>
      <div style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 24, letterSpacing: '-0.03em', color: TP.ink }}>
        <CountUp value={Number(s?.val) || 0} unit={s?.unit || ''}
          unitStyle={{ fontSize: '0.5em', color: accent }} animKey={`embvs.${storyId}.${key}`} />
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: TP.ink3, marginTop: 3, whiteSpace: 'nowrap' }}>{s?.who || ''}</div>
    </div>
  );
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {side(v.a, 'a', 'left')}
        {side(v.b, 'b', 'right')}
      </div>
      <div style={{ height: 5, borderRadius: 99, background: TP.line, marginTop: 8, overflow: 'hidden', display: 'flex' }}>
        <div style={{ width: `${ratio * 100}%`, background: `linear-gradient(90deg, color-mix(in srgb, ${accent} 72%, white), ${accent})`, borderRadius: 99 }} />
        <div style={{ flex: 1, background: `color-mix(in srgb, ${accent} 26%, white)`, borderRadius: 99 }} />
      </div>
      {v.note ? (
        <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, lineHeight: 1.4, color: TP.ink2, marginTop: 7 }}>{v.note}</div>
      ) : null}
    </div>
  );
}

function MiniQuote({ display, accent }) {
  const q = display.quote || { text: '', who: '' };
  const [name, ...role] = (q.who || '').split(' · ');
  return (
    <div style={{
      borderLeft: `3px solid ${accent}`, paddingLeft: 12,
      background: `linear-gradient(160deg, color-mix(in srgb, ${accent} 6%, white), ${TP.bg})`,
      borderRadius: '4px 12px 12px 4px', padding: '10px 12px',
    }}>
      <div style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontStyle: 'italic', fontSize: 16, lineHeight: 1.32, color: TP.ink }}>
        “<Markup raw={q.text} emColor={accent} strongColor={TP.ink} strongWeight={700} />”
      </div>
      {q.who ? (
        <div style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: TP.ink3, marginTop: 6 }}>
          <span style={{ color: TP.ink2, fontWeight: 500 }}>{name}</span>{role.length ? ` · ${role.join(' · ')}` : ''}
        </div>
      ) : null}
    </div>
  );
}

const EMBED_RENDER = {
  stats: MiniStats,
  chart: MiniChartEmbed,
  timeline: MiniTimeline,
  versus: MiniVersus,
  quote: MiniQuote,
};

const EMBED_LABEL = {
  stats: 'BY THE NUMBERS', chart: 'THE TREND', timeline: 'TIMELINE',
  versus: 'HEAD TO HEAD', quote: 'IN THEIR WORDS',
};

// ── switcher pill row (tap to swap the open module) ──────────────────────────

function SwitcherPills({ options, active, onPick, accent }) {
  if (!options || options.length < 1) return null;
  return (
    <div style={{ display: 'flex', gap: 7, marginTop: 14, flexWrap: 'wrap' }}>
      {options.map((opt) => {
        const on = opt === active;
        return (
          <button
            key={opt}
            onClick={(e) => { e.stopPropagation(); onPick(opt); }}
            style={{
              all: 'unset', cursor: 'pointer',
              fontFamily: FONT_MONO, fontSize: 9, fontWeight: 500, letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: on ? '#fff' : TP.ink2,
              background: on ? accent : 'rgba(255,255,255,0.65)',
              border: `1px solid ${on ? accent : 'rgba(22,21,15,0.09)'}`,
              borderRadius: 99, padding: '5px 11px',
              transition: 'background 0.18s ease, color 0.18s ease',
            }}
          >{EMBED_LABEL[opt] || opt}</button>
        );
      })}
    </div>
  );
}

// ── Classic composite (image top → headline → bullets → embedded → pills) ────

function ClassicComposite({ story, display, accent, hero, switchers }) {
  const [ref, shown, animate] = useRevealOnce(`comp.${story.id}`, 0.25);
  const [active, setActive] = useState(hero);
  // Resync the open module when the planner hands this mounted instance a new
  // hero/article (a feed reorder rebuild keeps the same React key, so without
  // this the switcher would highlight a stale module). Resets a manual pill
  // choice only on a full rebuild — acceptable.
  useEffect(() => { setActive(hero); }, [hero, story.id]);
  const Embed = EMBED_RENDER[active];
  // pills offer the hero + switchers so the user can return to the default
  const pillOptions = [hero, ...switchers].filter((v, i, a) => v && a.indexOf(v) === i);

  return (
    <article ref={ref}>
      <div>
        <ParallaxImage src={display.imageURL || story.urlToImage} aspectRatio="16 / 10" borderRadius={26} focus={display.image_focus} />

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 17, ...revealStyle(shown, animate, 0.08, 12) }}>
          <div style={{ flex: 1 }}><Headline raw={display.title} accent={accent} size={22.5} /></div>
        </div>

        {(display.bullets || []).length ? (
          <div style={{ marginTop: 13 }}>
            <Bullets bullets={display.bullets} accent={accent} max={2} reveal={{ shown, animate, baseDelay: 0.18 }} />
          </div>
        ) : null}

        {Embed ? (
          <div style={{ marginTop: 16, ...revealStyle(shown, animate, 0.32, 10) }}>
            <div style={{
              fontFamily: FONT_MONO, fontSize: 9, fontWeight: 500, letterSpacing: '0.16em',
              textTransform: 'uppercase', color: accent, marginBottom: 9,
            }}>{EMBED_LABEL[active]}</div>
            <Embed display={display} accent={accent} storyId={`${story.id}-${active}`} />
          </div>
        ) : null}

        {pillOptions.length > 1 ? (
          <SwitcherPills options={pillOptions} active={active} onPick={setActive} accent={accent} />
        ) : null}
      </div>
      <div style={{ marginTop: 14, ...revealStyle(shown, animate, 0.5, 8) }}>
        <CardFooter story={story} tags={display.tags} onOpen={() => {}} />
      </div>
    </article>
  );
}

// ── dispatcher ───────────────────────────────────────────────────────────────

export function CompositeCard({ story, display, accent, plan }) {
  const { shape, base, hero, switchers = [] } = plan || {};
  if (base === 'cover' || shape === 'COVER' || shape === 'COVER_STATS') {
    // CoverCard already lays the headline in the photo + shows the open stats
    // row; cover only embeds stats, so there's no switcher to add.
    return <CoverCard story={story} display={display} accent={accent} />;
  }
  if (shape === 'SPLIT') {
    return <SplitCard story={story} display={display} accent={accent} />;
  }
  if (base === 'classic' && hero && EMBED_RENDER[hero]) {
    return <ClassicComposite story={story} display={display} accent={accent} hero={hero} switchers={switchers} />;
  }
  // plain classic (image but no embeddable module, or CLASSIC bullets-only):
  // fall back to a bullets composite with no embed.
  return <ClassicComposite story={story} display={display} accent={accent} hero={null} switchers={[]} />;
}
