// TodayPlus Feed — the article card templates (spec §5), craft pass v2.
// Every card choreographs its own reveal the first time it's looked at:
// elements stagger in (figure → headline → bullets → footer), numbers count,
// bars fill, dashes draw. One-shot per session; Reduce Motion renders the
// final state instantly. Category names never appear as text — the category
// lives in the accent color alone.

import React, { useState } from 'react';
import {
  TP, FONT_HEAD, FONT_SERIF, FONT_BODY, FONT_MONO,
  ageLabel, Markup, shouldAnimateOnce, hasAnimated,
} from './tokens';
import {
  KickerRow, Bullets, StatsRow, CardFooter, Headline,
  CountUp, ParallaxImage, useVisibleOnce, useReducedMotion,
  useRevealOnce, revealStyle,
} from './shared';

// ── 5.1 COVER — headline inside the photo ───────────────────────────────────

export function CoverCard({ story, display, accent, onOpen }) {
  const [ref, shown, animate] = useRevealOnce(`cover.${story.id}`, 0.3);

  return (
    <article ref={ref}>
      <div>
        <ParallaxImage
          src={display.imageURL || story.urlToImage}
          aspectRatio="4 / 4.8"
          borderRadius={28}
          overlay={
            <div style={{
              position: 'absolute', inset: 0, zIndex: 1,
              background: 'linear-gradient(to bottom, rgba(12,11,8,0.18) 0%, rgba(12,11,8,0) 28%, rgba(12,11,8,0.18) 48%, rgba(12,11,8,0.55) 64%, rgba(12,11,8,0.88) 82%, rgba(12,11,8,0.96) 100%)',
            }} />
          }
        >
          <span style={{
            position: 'absolute', top: 14, right: 14, zIndex: 3,
            fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.92)',
            background: 'rgba(12,11,8,0.42)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 99, padding: '5px 10px',
          }}>{ageLabel(story.publishedAt)}</span>

          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 3, padding: 22 }}>
            <h2 style={{
              fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 27.5, lineHeight: 1.13,
              letterSpacing: '-0.016em', color: '#fff', margin: 0, textWrap: 'balance',
              textShadow: '0 2px 26px rgba(0,0,0,0.45)',
              ...revealStyle(shown, animate, 0.05, 18),
            }}>
              {/* on photos, entity marks use goldSoft — dark gold is illegible */}
              <Markup raw={display.title} emColor={TP.goldSoft} strongColor="#fff" strongWeight={800} />
            </h2>
            {display.lede ? (
              <p style={{
                fontFamily: FONT_BODY, fontSize: 14.8, lineHeight: 1.48, fontWeight: 450,
                color: 'rgba(255,255,255,0.85)', maxWidth: '50ch', margin: '9px 0 0',
                ...revealStyle(shown, animate, 0.22, 14),
              }}>{display.lede}</p>
            ) : null}
          </div>
        </ParallaxImage>
      </div>

      {display.stats?.length ? (
        <div style={{ marginTop: 20 }}>
          <StatsRow stats={display.stats} accent={accent} cardKey={`c${story.id}`} />
        </div>
      ) : null}
      <div style={{ marginTop: 14, ...revealStyle(shown, animate, 0.3, 8) }}>
        <CardFooter story={story} tags={display.tags} onOpen={onOpen} />
      </div>
    </article>
  );
}

// ── 5.2 CLASSIC — photo top, text below ─────────────────────────────────────

export function ClassicCard({ story, display, accent, onOpen }) {
  const [ref, shown, animate] = useRevealOnce(`classic.${story.id}`, 0.25);

  return (
    <article ref={ref}>
      <div>
        <ParallaxImage src={display.imageURL || story.urlToImage} aspectRatio="16 / 10" borderRadius={26} />

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 17, ...revealStyle(shown, animate, 0.08, 12) }}>
          <div style={{ flex: 1 }}>
            <Headline raw={display.title} accent={accent} size={24.5} />
          </div>
          <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: TP.ink3, flexShrink: 0 }}>
            {ageLabel(story.publishedAt)}
          </span>
        </div>

        <div style={{ marginTop: 14 }}>
          <Bullets bullets={display.bullets} accent={accent} reveal={{ shown, animate, baseDelay: 0.2 }} />
        </div>
      </div>

      {display.stats?.length ? (
        <div style={{ marginTop: 20 }}>
          <StatsRow stats={display.stats} accent={accent} cardKey={`c${story.id}`} />
        </div>
      ) : null}
      <div style={{ marginTop: 14, ...revealStyle(shown, animate, 0.42, 8) }}>
        <CardFooter story={story} tags={display.tags} onOpen={onOpen} />
      </div>
    </article>
  );
}

// ── 5.3 STAT-HERO — no photo, one giant number ──────────────────────────────

export function StatHeroCard({ story, display, accent, onOpen }) {
  const [ref, shown, animate] = useRevealOnce(`stat.${story.id}`, 0.35);
  const big = display.big || [0, '', '', ''];
  const [value, prefix, unit, caption] = big;

  return (
    <article ref={ref}>
      {/* 3px accent rule draws itself across the card */}
      <div style={{
        height: 3.5, background: `linear-gradient(90deg, ${accent}, color-mix(in srgb, ${accent} 30%, white))`,
        borderRadius: 99,
        transform: shown ? 'scaleX(1)' : 'scaleX(0)', transformOrigin: 'left',
        transition: animate ? 'transform 0.8s cubic-bezier(.2,.7,.2,1)' : 'none',
      }} />
      <div style={{ paddingTop: 18 }}>
        <div style={revealStyle(shown, animate, 0.05, 8)}>
          <KickerRow category={display.category} accent={accent} story={story} />
        </div>
        <div style={{ marginTop: 12, ...revealStyle(shown, animate, 0.12, 12) }}>
          <Headline raw={display.title} accent={accent} size={29} />
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 22, flexWrap: 'wrap', ...revealStyle(shown, animate, 0.3, 14) }}>
          <span style={{
            fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 60, lineHeight: 0.95,
            letterSpacing: '-0.025em',
            background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 78%, white) 0%, ${accent} 55%, color-mix(in srgb, ${accent} 78%, black) 100%)`,
            WebkitBackgroundClip: 'text', backgroundClip: 'text',
            WebkitTextFillColor: 'transparent', color: 'transparent',
          }}>
            <CountUp
              value={Number(value) || 0}
              prefix={prefix || ''}
              unit={unit || ''}
              unitStyle={{ fontSize: '0.42em', letterSpacing: '-0.01em' }}
              animKey={`big.${story.id}`}
            />
          </span>
          {caption ? (
            <span style={{
              fontFamily: FONT_BODY, fontSize: 13.8, fontWeight: 450, color: TP.ink2,
              maxWidth: '24ch', lineHeight: 1.42,
            }}>
              {caption}
            </span>
          ) : null}
        </div>

        <div style={{ marginTop: 18 }}>
          <Bullets bullets={display.bullets} accent={accent} max={2} reveal={{ shown, animate, baseDelay: 0.45 }} />
        </div>
      </div>
      {/* NO stats row — the big number replaces it (§5.3) */}
      <div style={{ marginTop: 14, ...revealStyle(shown, animate, 0.6, 8) }}>
        <CardFooter story={story} tags={display.tags} onOpen={onOpen} />
      </div>
    </article>
  );
}

// ── 5.4 QUOTE — pull-quote led ──────────────────────────────────────────────

export function QuoteCard({ story, display, accent, onOpen }) {
  const [ref, shown, animate] = useRevealOnce(`quote.${story.id}`, 0.35);
  const quote = display.quote || { text: '', who: '' };
  const [name, ...roleParts] = (quote.who || '').split(' · ');

  return (
    <article ref={ref}>
      <div>
        <div style={revealStyle(shown, animate, 0, 6)}>
          <KickerRow category={display.category} accent={accent} story={story} />
        </div>

        <div aria-hidden style={{
          fontFamily: FONT_SERIF, fontStyle: 'italic', fontWeight: 600, fontSize: 104, lineHeight: 1,
          background: `linear-gradient(160deg, ${accent}, color-mix(in srgb, ${accent} 55%, white))`,
          WebkitBackgroundClip: 'text', backgroundClip: 'text',
          WebkitTextFillColor: 'transparent', color: 'transparent',
          height: 38, overflow: 'hidden', marginTop: 16,
          opacity: shown ? 1 : 0,
          transform: shown ? 'scale(1)' : 'scale(0.6)',
          transformOrigin: 'left bottom',
          transition: animate ? 'opacity 0.5s ease-out 0.08s, transform 0.6s cubic-bezier(.22,1.4,.36,1) 0.08s' : 'none',
        }}>“</div>

        <blockquote style={{
          fontFamily: FONT_SERIF, fontWeight: 500, fontStyle: 'italic',
          fontSize: 27, lineHeight: 1.32, letterSpacing: '-0.005em',
          fontOpticalSizing: 'auto',
          color: TP.ink, margin: '6px 0 0', textWrap: 'balance',
          ...revealStyle(shown, animate, 0.18, 14),
        }}>
          <Markup raw={quote.text} emColor={accent} strongColor={TP.ink} strongWeight={700} />
        </blockquote>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
          <span style={{
            width: 26, height: 1.5, background: accent, flexShrink: 0,
            transform: shown ? 'scaleX(1)' : 'scaleX(0)', transformOrigin: 'left',
            transition: animate ? 'transform 0.5s cubic-bezier(.2,.7,.2,1) 0.42s' : 'none',
          }} />
          <span style={{
            fontFamily: FONT_MONO, fontSize: 10, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: TP.ink3,
            ...revealStyle(shown, animate, 0.5, 6),
          }}>
            <span style={{ color: TP.ink2, fontWeight: 500 }}>{name}</span>
            {roleParts.length ? ` · ${roleParts.join(' · ')}` : ''}
          </span>
        </div>

        {/* headline as subhead — quote owns the color, emphasis inverts (§5.4) */}
        <h3 style={{
          fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 16.5, lineHeight: 1.34,
          letterSpacing: '-0.008em', color: TP.ink2, margin: '20px 0 0', textWrap: 'balance',
          ...revealStyle(shown, animate, 0.58, 10),
        }}>
          <Markup raw={display.title} emColor={TP.ink} strongColor={TP.ink} strongWeight={700} />
        </h3>

        <div style={{ marginTop: 14 }}>
          <Bullets bullets={display.bullets} accent={accent} max={2} reveal={{ shown, animate, baseDelay: 0.68 }} />
        </div>
      </div>
      <div style={{ marginTop: 14, ...revealStyle(shown, animate, 0.82, 8) }}>
        <CardFooter story={story} tags={display.tags} onOpen={onOpen} />
      </div>
    </article>
  );
}

// ── 5.5 VERSUS — three typed variants ───────────────────────────────────────
// versus.kind: "duel" (opposed tallies — VS circle + ratio bar) · "change"
// (before → after, accent arrow + delta chip, NO circle/bar) · "gap" (two
// scales contrasted — proportional mini-bars, no fight framing). Old rows
// without kind render as duel. who labels are ≤16 chars and must render on
// ONE line — never ellipsized; the mono size steps down on narrow columns.

function whoLabel(text, color = TP.ink3) {
  const long = (text || '').length > 12;
  return (
    <div style={{
      fontFamily: FONT_MONO, fontSize: long ? 8 : 9, letterSpacing: long ? '0.06em' : '0.12em',
      textTransform: 'uppercase', color, marginTop: 7, whiteSpace: 'nowrap',
    }}>{text || ''}</div>
  );
}

export function VersusCard({ story, display, accent, onOpen }) {
  const versus = display.versus || { a: {}, b: {}, ratio: 0.5 };
  const kind = versus.kind === 'change' || versus.kind === 'gap' ? versus.kind : 'duel';
  const reduced = useReducedMotion();
  const [ref, shown, animate] = useRevealOnce(`versus.${story.id}`, 0.35);
  const already = hasAnimated(`vsbar.${story.id}`);
  const [filled, setFilled] = useState(already || reduced);
  const barRef = useVisibleOnce(0.5, () => {
    shouldAnimateOnce(`vsbar.${story.id}`);
    setTimeout(() => setFilled(true), 150);
  });

  const value = (s, key, size, color, unitColor) => (
    <div style={{
      fontFamily: FONT_HEAD, fontWeight: 800, fontSize: size, lineHeight: 1,
      letterSpacing: '-0.02em', color,
    }}>
      <CountUp
        value={Number(s?.val) || 0}
        unit={s?.unit || ''}
        unitStyle={{ fontSize: '0.45em', color: unitColor }}
        animKey={`vs.${story.id}.${key}`}
      />
    </div>
  );

  const sideReveal = (fromX, delay = 0.22) => ({
    opacity: shown ? 1 : 0,
    transform: shown ? 'none' : `translateX(${fromX}px)`,
    transition: animate ? `opacity 0.6s cubic-bezier(.2,.7,.2,1) ${delay}s, transform 0.6s cubic-bezier(.2,.7,.2,1) ${delay}s` : 'none',
  });

  // ── duel: two tallies face off — VS circle + ratio bar ──
  const duelFigure = () => {
    const ratio = Math.min(0.95, Math.max(0.05, Number(versus.ratio) || 0.5));
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 22 }}>
          <div style={{ flex: 1, textAlign: 'center', minWidth: 0, ...sideReveal(-14) }}>
            {value(versus.a, 'a', 40, TP.ink, accent)}
            {whoLabel(versus.a?.who)}
          </div>
          <div style={{
            width: 42, height: 42, borderRadius: '50%',
            border: `1.5px solid ${accent}`,
            background: `color-mix(in srgb, ${accent} 7%, transparent)`,
            boxShadow: `0 0 18px color-mix(in srgb, ${accent} 22%, transparent)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 12.5, color: accent,
            marginTop: 2,
            opacity: shown ? 1 : 0,
            transform: shown ? 'scale(1)' : 'scale(0.4)',
            transition: animate ? 'opacity 0.45s ease-out 0.4s, transform 0.6s cubic-bezier(.22,1.6,.36,1) 0.4s' : 'none',
          }}>VS</div>
          <div style={{ flex: 1, textAlign: 'center', minWidth: 0, ...sideReveal(14) }}>
            {value(versus.b, 'b', 40, TP.ink, accent)}
            {whoLabel(versus.b?.who)}
          </div>
        </div>

        <div ref={barRef} style={{ position: 'relative', marginTop: 20 }}>
          <div style={{ height: 6, borderRadius: 99, background: TP.line, overflow: 'hidden', display: 'flex' }}>
            <div style={{
              width: `${ratio * 100}%`,
              transform: filled ? 'scaleX(1)' : 'scaleX(0)',
              transformOrigin: 'left',
              transition: reduced ? 'none' : 'transform 1s cubic-bezier(.2,.7,.2,1)',
              background: `linear-gradient(90deg, color-mix(in srgb, ${accent} 72%, white), ${accent})`,
              borderRadius: 99,
            }} />
            <div style={{ flex: 1, background: `color-mix(in srgb, ${accent} 26%, white)`, borderRadius: 99 }} />
          </div>
          <span style={{
            position: 'absolute', top: '50%', left: `${ratio * 100}%`,
            width: 12, height: 12, marginLeft: -6, marginTop: -6,
            borderRadius: '50%', background: '#fff',
            border: `2.5px solid ${accent}`, boxSizing: 'border-box',
            boxShadow: `0 1px 6px color-mix(in srgb, ${accent} 45%, transparent)`,
            opacity: filled ? 1 : 0,
            transform: filled ? 'scale(1)' : 'scale(0)',
            transition: reduced ? 'none' : 'opacity 0.3s ease-out 0.85s, transform 0.45s cubic-bezier(.22,1.6,.36,1) 0.85s',
          }} />
        </div>
      </>
    );
  };

  // ── change: before → after; the AFTER value is the hero ──
  const changeFigure = () => {
    const delta = versus.delta || '';
    const deltaColor = delta.trim().startsWith('+') ? TP.green
      : /^[−-]/.test(delta.trim()) ? TP.red
      : accent;
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginTop: 22 }}>
        <div style={{ flex: 1, textAlign: 'center', minWidth: 0, ...sideReveal(-14) }}>
          {value(versus.a, 'a', 33, TP.ink3, TP.ink3)}
          {whoLabel(versus.a?.who)}
        </div>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
          flexShrink: 0, marginTop: 2,
          opacity: shown ? 1 : 0,
          transform: shown ? 'none' : 'translateX(-10px)',
          transition: animate ? 'opacity 0.55s ease-out 0.45s, transform 0.55s cubic-bezier(.2,.7,.2,1) 0.45s' : 'none',
        }}>
          <svg width="30" height="16" viewBox="0 0 30 16" aria-hidden>
            <path d="M1 8h26M21 2l6.5 6L21 14" fill="none" stroke={accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {delta ? (
            <span style={{
              fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.06em',
              color: deltaColor,
              background: `color-mix(in srgb, ${deltaColor} 9%, white)`,
              border: `1px solid color-mix(in srgb, ${deltaColor} 28%, white)`,
              borderRadius: 99, padding: '3px 8px', whiteSpace: 'nowrap',
              opacity: shown ? 1 : 0,
              transform: shown ? 'scale(1)' : 'scale(0.5)',
              transition: animate ? 'opacity 0.4s ease-out 0.8s, transform 0.5s cubic-bezier(.22,1.6,.36,1) 0.8s' : 'none',
            }}>{delta}</span>
          ) : null}
        </div>
        <div style={{ flex: 1, textAlign: 'center', minWidth: 0, ...sideReveal(14, 0.32) }}>
          {value(versus.b, 'b', 42, TP.ink, accent)}
          {whoLabel(versus.b?.who, TP.ink2)}
        </div>
      </div>
    );
  };

  // ── gap: scale contrast — proportional mini-bars, no fight framing ──
  const gapFigure = () => {
    const aVal = Math.abs(Number(versus.a?.val) || 0);
    const bVal = Math.abs(Number(versus.b?.val) || 0);
    const maxVal = Math.max(aVal, bVal, 0.0001);
    const bar = (val, fill, delay) => (
      <div style={{ height: 6, borderRadius: 99, background: TP.line, marginTop: 10, overflow: 'hidden' }}>
        <div style={{
          width: `${Math.max(4, (val / maxVal) * 100)}%`, height: '100%', borderRadius: 99,
          background: fill,
          transform: filled ? 'scaleX(1)' : 'scaleX(0)', transformOrigin: 'left',
          transition: reduced ? 'none' : `transform 0.9s cubic-bezier(.2,.7,.2,1) ${delay}s`,
        }} />
      </div>
    );
    return (
      <div ref={barRef} style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginTop: 22 }}>
        <div style={{ flex: 1, minWidth: 0, ...sideReveal(-14) }}>
          {value(versus.a, 'a', 38, TP.ink, accent)}
          {whoLabel(versus.a?.who)}
          {bar(aVal, `linear-gradient(90deg, color-mix(in srgb, ${accent} 72%, white), ${accent})`, 0.15)}
        </div>
        <div style={{ flex: 1, minWidth: 0, ...sideReveal(14, 0.3) }}>
          {value(versus.b, 'b', 38, TP.ink, accent)}
          {whoLabel(versus.b?.who)}
          {bar(bVal, `color-mix(in srgb, ${accent} 30%, white)`, 0.3)}
        </div>
      </div>
    );
  };

  return (
    <article ref={ref}>
      <div>
        <div style={revealStyle(shown, animate, 0, 6)}>
          <KickerRow category={display.category} accent={accent} story={story} />
        </div>
        <div style={{ marginTop: 12, ...revealStyle(shown, animate, 0.08, 12) }}>
          <Headline raw={display.title} accent={accent} size={24.5} />
        </div>

        {kind === 'duel' ? duelFigure() : null}
        {kind === 'change' ? changeFigure() : null}
        {kind === 'gap' ? gapFigure() : null}

        {versus.note ? (
          <div style={{ marginTop: 16 }}>
            <Bullets bullets={[versus.note]} accent={accent} max={1} reveal={{ shown, animate, baseDelay: 0.55 }} />
          </div>
        ) : null}
      </div>
      <div style={{ marginTop: 14, ...revealStyle(shown, animate, 0.7, 8) }}>
        <CardFooter story={story} tags={display.tags} onOpen={onOpen} />
      </div>
    </article>
  );
}

// ── 5.6 TIMELINE — developing story ─────────────────────────────────────────

export function TimelineCard({ story, display, accent, onOpen }) {
  const [ref, shown, animate] = useRevealOnce(`line.${story.id}`, 0.3);
  const entries = display.timeline || [];

  return (
    <article ref={ref}>
      <div>
        <div style={revealStyle(shown, animate, 0, 6)}>
          <KickerRow category={display.category} accent={accent} story={story} />
        </div>
        <div style={{ marginTop: 12, ...revealStyle(shown, animate, 0.08, 12) }}>
          <Headline raw={display.title} accent={accent} size={24.5} />
        </div>

        <div style={{ position: 'relative', marginTop: 22 }}>
          {/* rail draws downward; accent fades into the hairline */}
          <span style={{
            position: 'absolute', left: 5, top: 6, bottom: 6, width: 1.5,
            background: `linear-gradient(to bottom, ${accent} 0%, color-mix(in srgb, ${accent} 35%, ${'#EAE6DD'}) 40%, #EAE6DD 100%)`,
            transform: shown ? 'scaleY(1)' : 'scaleY(0)',
            transformOrigin: 'top',
            transition: animate ? 'transform 0.9s cubic-bezier(.2,.7,.2,1) 0.2s' : 'none',
          }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 19 }}>
            {entries.map((entry, i) => {
              const [date, text] = Array.isArray(entry) ? entry : [entry?.date, entry?.text];
              const delay = 0.25 + i * 0.14;
              return (
                <div key={i} style={{ position: 'relative', paddingLeft: 26, ...revealStyle(shown, animate, delay, 10) }}>
                  <span style={{
                    position: 'absolute', left: 0, top: 2, width: 11, height: 11,
                    borderRadius: '50%', border: `2px solid ${accent}`,
                    background: i === 0 ? accent : TP.bg, boxSizing: 'border-box',
                    boxShadow: i === 0 ? `0 0 10px color-mix(in srgb, ${accent} 55%, transparent)` : 'none',
                  }} />
                  <div style={{
                    fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 500,
                    letterSpacing: '0.14em', textTransform: 'uppercase', color: accent,
                  }}>{date}</div>
                  <div style={{
                    fontFamily: FONT_BODY, fontSize: 14.8, lineHeight: 1.52,
                    color: i === 0 ? TP.ink : TP.ink2,
                    fontWeight: i === 0 ? 500 : 400,
                    marginTop: 4,
                  }}>
                    <Markup raw={text || ''} emColor={accent} strongColor={TP.ink} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 14, ...revealStyle(shown, animate, 0.25 + entries.length * 0.14, 8) }}>
        <CardFooter story={story} tags={display.tags} onOpen={onOpen} />
      </div>
    </article>
  );
}

// ── 5.7 SPLIT — compact, square thumb left ──────────────────────────────────

export function SplitCard({ story, display, accent, onOpen }) {
  const [ref, shown, animate] = useRevealOnce(`split.${story.id}`, 0.35);
  // the lede is written to fit this card — render it whole, never truncated
  const summary = display.lede || '';
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <article ref={ref}>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{
          position: 'relative', width: 116, height: 116, borderRadius: 20,
          overflow: 'hidden', background: TP.line, flexShrink: 0,
          ...revealStyle(shown, animate, 0.05, 8),
        }}>
          <img
            src={display.imageURL || story.urlToImage}
            alt=""
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.5s ease-out',
            }}
          />
          <span style={{
            position: 'absolute', inset: 0, borderRadius: 20, pointerEvents: 'none',
            boxShadow: 'inset 0 0 0 1px rgba(22,21,15,0.05)',
          }} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={revealStyle(shown, animate, 0.12, 6)}>
            <KickerRow category={display.category} accent={accent} story={story} />
          </div>
          <h2 style={{
            fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 18, lineHeight: 1.24,
            letterSpacing: '-0.012em', color: TP.ink, margin: '8px 0 0', textWrap: 'balance',
            ...revealStyle(shown, animate, 0.18, 10),
          }}>
            <Markup raw={display.title} emColor={accent} strongColor={TP.ink} strongWeight={800} />
          </h2>
          {summary ? (
            <p style={{
              fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.5, color: TP.ink2,
              margin: '7px 0 0',
              ...revealStyle(shown, animate, 0.28, 8),
            }}>
              {summary}
            </p>
          ) : null}
        </div>
      </div>
      <div style={{ marginTop: 12, ...revealStyle(shown, animate, 0.4, 8) }}>
        <CardFooter story={story} tags={display.tags} onOpen={onOpen} />
      </div>
    </article>
  );
}

// ── 5.8 CHART — animated trend bars ─────────────────────────────────────────

export function ChartCard({ story, display, accent, onOpen }) {
  const trend = display.trend || { vals: [], labels: [] };
  const reduced = useReducedMotion();
  const already = hasAnimated(`chart.${story.id}`);
  const [grown, setGrown] = useState(already || reduced);
  const [ref, shown, animateReveal] = useRevealOnce(`chartcard.${story.id}`, 0.3);
  const chartRef = useVisibleOnce(0.5, () => {
    shouldAnimateOnce(`chart.${story.id}`);
    setGrown(true);
  });

  const vals = trend.vals || [];
  const maxVal = Math.max(...vals, 0.0001);
  const lastIdx = vals.length - 1;
  const animate = !reduced && !already;

  return (
    <article ref={ref}>
      <div>
        <div style={revealStyle(shown, animateReveal, 0, 6)}>
          <KickerRow category={display.category} accent={accent} story={story} />
        </div>
        <div style={{ marginTop: 12, ...revealStyle(shown, animateReveal, 0.08, 12) }}>
          <Headline raw={display.title} accent={accent} size={24.5} />
        </div>

        <div ref={chartRef} style={{ marginTop: 22 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 146 }}>
            {vals.map((v, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'stretch', height: '100%' }}>
                <div style={{
                  textAlign: 'center', fontFamily: FONT_MONO, fontSize: 9,
                  fontWeight: i === lastIdx ? 500 : 400,
                  color: i === lastIdx ? accent : TP.ink3, marginBottom: 4,
                  opacity: grown ? 1 : 0,
                  transition: animate ? `opacity 0.5s ease-out ${0.25 + i * 0.09}s` : 'none',
                }}>
                  {/* values tick up in sync with the growing bars */}
                  <CountUp
                    value={v}
                    unit={trend.unit && i === lastIdx ? trend.unit : ''}
                    animKey={`chartval.${story.id}.${i}`}
                  />
                </div>
                <div style={{
                  height: Math.max(6, (120 * v) / maxVal),
                  borderRadius: '8px 8px 3px 3px',
                  background: i === lastIdx
                    ? `linear-gradient(to top, ${accent}, color-mix(in srgb, ${accent} 72%, white))`
                    : `color-mix(in srgb, ${accent} 22%, white)`,
                  boxShadow: i === lastIdx ? `0 4px 14px color-mix(in srgb, ${accent} 36%, transparent)` : 'none',
                  transform: grown ? 'scaleY(1)' : 'scaleY(0.001)',
                  transformOrigin: 'bottom',
                  // springy overshoot, staggered left → right
                  transition: animate ? `transform 0.9s cubic-bezier(.22,1.32,.36,1) ${i * 0.09}s` : 'none',
                }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            {(trend.labels || []).map((label, i) => (
              <div key={i} style={{
                flex: 1, textAlign: 'center', fontFamily: FONT_MONO, fontSize: 9,
                color: i === lastIdx ? TP.ink2 : TP.ink3,
                opacity: grown ? 1 : 0,
                transform: grown ? 'translateY(0)' : 'translateY(4px)',
                transition: animate ? `opacity 0.45s ease-out ${0.15 + i * 0.09}s, transform 0.45s ease-out ${0.15 + i * 0.09}s` : 'none',
              }}>{label}</div>
            ))}
          </div>
        </div>

        {trend.caption ? (
          <p style={{
            fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.5, color: TP.ink2, margin: '14px 0 0',
            opacity: grown ? 1 : 0,
            transition: animate ? 'opacity 0.6s ease-out 0.7s' : 'none',
          }}>
            {trend.caption}
          </p>
        ) : null}
      </div>
      <div style={{ marginTop: 14 }}>
        <CardFooter story={story} tags={display.tags} onOpen={onOpen} />
      </div>
    </article>
  );
}
