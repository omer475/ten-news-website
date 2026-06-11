// TodayPlus Feed — the article card templates (spec §5), craft pass v2.
// Every card choreographs its own reveal the first time it's looked at:
// elements stagger in (figure → headline → bullets → footer), numbers count,
// bars fill, dashes draw. One-shot per session; Reduce Motion renders the
// final state instantly. Category names never appear as text — the category
// lives in the accent color alone.

import React, { useState } from 'react';
import {
  TP, FONT_HEAD, FONT_BODY, FONT_MONO,
  ageLabel, Markup, formatNumber, shouldAnimateOnce, hasAnimated,
} from './tokens';
import {
  KickerRow, Bullets, StatsRow, CardFooter, Headline,
  CountUp, ParallaxImage, useVisibleOnce, useReducedMotion,
  useRevealOnce, revealStyle, TPCountdownChip,
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
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            {display.countdown ? (
              <span style={{
                background: 'rgba(12,11,8,0.42)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.14)', borderRadius: 99, padding: '5px 10px',
                display: 'inline-flex',
              }}>
                <TPCountdownChip countdown={display.countdown} accent={TP.goldSoft} light />
              </span>
            ) : null}
            <span style={{
              fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.92)',
              background: 'rgba(12,11,8,0.42)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: 99, padding: '5px 10px',
            }}>{ageLabel(story.publishedAt)}</span>
          </span>

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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {display.countdown ? <TPCountdownChip countdown={display.countdown} accent={accent} /> : null}
            <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: TP.ink3 }}>
              {ageLabel(story.publishedAt)}
            </span>
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
          <KickerRow category={display.category} accent={accent} story={story} countdown={display.countdown} />
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
          <KickerRow category={display.category} accent={accent} story={story} countdown={display.countdown} />
        </div>

        {/* chat-style quote bubble: soft accent tint, speech corner, and a
            springing quote badge — designed, not a newspaper glyph */}
        <div style={{ position: 'relative', marginTop: 26 }}>
          <span aria-hidden style={{
            position: 'absolute', top: -17, left: 18, zIndex: 1,
            width: 36, height: 36, borderRadius: '50%',
            background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 80%, white), ${accent})`,
            boxShadow: `0 5px 14px color-mix(in srgb, ${accent} 35%, transparent), 0 0 0 3px ${TP.bg}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: shown ? 1 : 0,
            transform: shown ? 'scale(1) rotate(0deg)' : 'scale(0.3) rotate(-30deg)',
            transition: animate ? 'opacity 0.4s ease-out 0.3s, transform 0.55s cubic-bezier(.22,1.6,.36,1) 0.3s' : 'none',
          }}>
            <svg width="16" height="13" viewBox="0 0 16 13" aria-hidden>
              <path d="M0 13V8.2C0 5.9.5 4.1 1.6 2.7 2.7 1.3 4.3.4 6.4 0l.9 2.1c-1.2.4-2.1 1-2.7 1.8-.5.7-.8 1.5-.9 2.4H7V13H0zm9 0V8.2c0-2.3.5-4.1 1.6-5.5C11.7 1.3 13.3.4 15.4 0l.6 2.1c-1.2.4-2.1 1-2.7 1.8-.5.7-.8 1.5-.9 2.4H16V13H9z" fill="#fff"/>
            </svg>
          </span>

          <blockquote style={{
            fontFamily: FONT_HEAD, fontWeight: 700,
            fontSize: 23, lineHeight: 1.3, letterSpacing: '-0.012em',
            color: TP.ink, margin: 0, textWrap: 'balance',
            background: `linear-gradient(165deg, color-mix(in srgb, ${accent} 7%, white), color-mix(in srgb, ${accent} 3%, ${TP.bg}))`,
            border: `1px solid color-mix(in srgb, ${accent} 13%, white)`,
            borderRadius: '6px 24px 24px 24px',
            padding: '26px 20px 18px',
            ...revealStyle(shown, animate, 0.12, 14),
          }}>
            <Markup raw={quote.text} emColor={accent} strongColor={TP.ink} strongWeight={700} />
          </blockquote>
        </div>

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
          <KickerRow category={display.category} accent={accent} story={story} countdown={display.countdown} />
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
          <KickerRow category={display.category} accent={accent} story={story} countdown={display.countdown} />
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
            <KickerRow category={display.category} accent={accent} story={story} countdown={display.countdown} />
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

// ── 5.8 CHART — three data shapes, one card ─────────────────────────────────
// display.trend (time series, style "line" | "bar"), display.breakdown
// (composition → donut), display.ranking (entities → horizontal bars).
// All share the kicker/headline/caption/footer chrome; Reduce Motion renders
// final state instantly; values follow §7.2 count-up rules. Old trend rows
// without a style render as "bar".

function smoothPath(pts) {
  // Catmull-Rom → cubic bezier through every point
  if (pts.length < 2) return '';
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

// — trend, style "line": smooth accent path + gradient fill, dots on first and
//   last points, floating value chip on the live end —
function TrendLine({ trend, accent, drawn, animate, storyId }) {
  const vals = trend.vals || [];
  const labels = trend.labels || [];
  const n = vals.length;
  const lastIdx = n - 1;
  if (n < 2) return null;

  const W = 560, H = 190, PAD_X = 14, PAD_T = 44, PAD_B = 14;
  const min = Math.min(...vals, 0);
  const max = Math.max(...vals, 0.0001);
  const span = Math.max(max - min, 0.0001);
  const x = (i) => PAD_X + (i * (W - PAD_X * 2)) / Math.max(1, n - 1);
  const y = (v) => PAD_T + (1 - (v - min) / span) * (H - PAD_T - PAD_B);
  const pts = vals.map((v, i) => [x(i), y(v)]);
  const line = smoothPath(pts);
  const area = `${line} L ${x(lastIdx)} ${H} L ${x(0)} ${H} Z`;
  const gid = `tpg-${storyId}`;
  const lastVal = vals[lastIdx] ?? 0;
  const chipText = `${formatNumber(lastVal)}${trend.unit || ''}`;
  const chipX = Math.min(Math.max(x(lastIdx), 56), W - 56);

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }} aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.18" />
            <stop offset="70%" stopColor={accent} stopOpacity="0.04" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.55, 0.85].map((f) => (
          <line key={f} x1={PAD_X} x2={W - PAD_X}
            y1={PAD_T + f * (H - PAD_T - PAD_B)} y2={PAD_T + f * (H - PAD_T - PAD_B)}
            stroke={TP.line} strokeWidth="1" strokeDasharray="1 7" strokeLinecap="round" />
        ))}
        <path d={area} fill={`url(#${gid})`}
          style={{ opacity: drawn ? 1 : 0, transition: animate ? 'opacity 0.8s ease-out 0.5s' : 'none' }} />
        <path d={line} fill="none" stroke={accent} strokeWidth="3"
          strokeLinecap="round" strokeLinejoin="round"
          pathLength="1" strokeDasharray="1" strokeDashoffset={drawn ? 0 : 1}
          style={{ transition: animate ? 'stroke-dashoffset 0.9s ease-out' : 'none' }} />
        {/* dots on the FIRST and LAST points only */}
        <circle cx={x(0)} cy={y(vals[0])} r="3.5" fill={TP.bg} stroke={accent} strokeWidth="2"
          style={{ opacity: drawn ? 1 : 0, transition: animate ? 'opacity 0.3s ease-out 0.25s' : 'none' }} />
        <circle cx={x(lastIdx)} cy={y(lastVal)} r="4.5" fill={accent}
          style={{
            opacity: drawn ? 1 : 0,
            transform: drawn ? 'scale(1)' : 'scale(0)',
            transformOrigin: `${x(lastIdx)}px ${y(lastVal)}px`,
            transition: animate ? 'opacity 0.3s ease-out 0.85s, transform 0.45s cubic-bezier(.22,1.6,.36,1) 0.85s' : 'none',
          }} />
        <circle cx={x(lastIdx)} cy={y(lastVal)} r="11"
          fill="none" stroke={accent} strokeOpacity="0.25" strokeWidth="5"
          style={{ opacity: drawn ? 1 : 0, transition: animate ? 'opacity 0.5s ease-out 1.0s' : 'none' }} />
        <g style={{
          opacity: drawn ? 1 : 0,
          transform: drawn ? 'translateY(0)' : 'translateY(8px)',
          transition: animate ? 'opacity 0.45s ease-out 1.0s, transform 0.5s cubic-bezier(.22,1.4,.36,1) 1.0s' : 'none',
        }}>
          <rect x={chipX - 34} y={y(lastVal) - 40} rx="13" ry="13" width="68" height="26" fill={accent} />
          <text x={chipX} y={y(lastVal) - 22.5} textAnchor="middle"
            fontFamily={FONT_HEAD} fontWeight="700" fontSize="13.5" fill="#fff">{chipText}</text>
        </g>
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        {labels.map((label, i) => (
          <span key={i} style={{
            fontFamily: FONT_MONO, fontSize: 9.5,
            color: i === lastIdx ? accent : TP.ink3,
            fontWeight: i === lastIdx ? 500 : 400,
            opacity: drawn ? 1 : 0,
            transition: animate ? `opacity 0.4s ease-out ${0.2 + i * 0.08}s` : 'none',
          }}>{label}</span>
        ))}
      </div>
    </>
  );
}

// — trend, style "bar" (and legacy rows without style) —
function TrendBars({ trend, accent, drawn, animate, storyId }) {
  const vals = trend.vals || [];
  const labels = trend.labels || [];
  const maxVal = Math.max(...vals, 0.0001);
  const lastIdx = vals.length - 1;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 146 }}>
        {vals.map((v, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
            <div style={{
              textAlign: 'center', fontFamily: FONT_MONO, fontSize: 9,
              fontWeight: i === lastIdx ? 500 : 400,
              color: i === lastIdx ? accent : TP.ink3, marginBottom: 4,
              opacity: drawn ? 1 : 0,
              transition: animate ? `opacity 0.5s ease-out ${0.25 + i * 0.09}s` : 'none',
            }}>
              <CountUp value={v} unit={trend.unit && i === lastIdx ? trend.unit : ''} animKey={`chartval.${storyId}.${i}`} />
            </div>
            <div style={{
              height: Math.max(6, (120 * v) / maxVal),
              borderRadius: '8px 8px 3px 3px',
              background: i === lastIdx
                ? `linear-gradient(to top, ${accent}, color-mix(in srgb, ${accent} 72%, white))`
                : `color-mix(in srgb, ${accent} 22%, white)`,
              boxShadow: i === lastIdx ? `0 4px 14px color-mix(in srgb, ${accent} 36%, transparent)` : 'none',
              transform: drawn ? 'scaleY(1)' : 'scaleY(0.001)',
              transformOrigin: 'bottom',
              transition: animate ? `transform 0.9s cubic-bezier(.22,1.32,.36,1) ${i * 0.09}s` : 'none',
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        {labels.map((label, i) => (
          <div key={i} style={{
            flex: 1, textAlign: 'center', fontFamily: FONT_MONO, fontSize: 9,
            color: i === lastIdx ? TP.ink2 : TP.ink3,
            opacity: drawn ? 1 : 0,
            transition: animate ? `opacity 0.45s ease-out ${0.15 + i * 0.09}s` : 'none',
          }}>{label}</div>
        ))}
      </div>
    </>
  );
}

// — breakdown → DONUT: largest slice solid accent, descending white-mixes,
//   2° gaps, sweep-in segments, count-up center —
const DONUT_MIXES = [100, 70, 50, 35, 22, 14];

function BreakdownDonut({ breakdown, accent, drawn, animate, storyId }) {
  const slices = (breakdown.slices || []).slice(0, 6);
  const total = slices.reduce((sum, sl) => sum + (Number(sl[1]) || 0), 0) || 1;
  const D = 120, STROKE = 14, R = (D - STROKE) / 2;
  const GAP_UNITS = (2 / 360) * 100; // 2° gap in pathLength=100 units
  const [bigLabel, bigVal] = slices[0] || ['', 0];

  let offset = 25; // start at 12 o'clock (pathLength 100, 0 = 3 o'clock)
  const segs = slices.map((sl, i) => {
    const pct = ((Number(sl[1]) || 0) / total) * 100;
    const len = Math.max(0, pct - GAP_UNITS);
    const seg = { len, offset, color: i === 0 ? accent : `color-mix(in srgb, ${accent} ${DONUT_MIXES[i] || 14}%, white)` };
    offset -= pct; // clockwise
    return seg;
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: D, height: D, flexShrink: 0 }}>
        <svg viewBox={`0 0 ${D} ${D}`} width={D} height={D} aria-hidden>
          <circle cx={D / 2} cy={D / 2} r={R} fill="none" stroke={TP.line} strokeOpacity="0.5" strokeWidth={STROKE} />
          {segs.map((seg, i) => (
            <circle key={i} cx={D / 2} cy={D / 2} r={R} fill="none"
              stroke={seg.color} strokeWidth={STROKE} strokeLinecap="butt"
              pathLength="100"
              strokeDasharray={drawn ? `${seg.len} ${100 - seg.len}` : `0 100`}
              strokeDashoffset={seg.offset}
              style={{ transition: animate ? `stroke-dasharray 0.9s cubic-bezier(.2,.7,.2,1) ${i * 0.06}s` : 'none' }} />
          ))}
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        }}>
          <span style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 27, lineHeight: 1, letterSpacing: '-0.02em', color: TP.ink }}>
            <CountUp value={Number(bigVal) || 0} unit={breakdown.unit || ''}
              unitStyle={{ fontSize: '0.55em', color: accent }} animKey={`donut.${storyId}`} />
          </span>
          <span style={{
            fontFamily: FONT_MONO, fontSize: 8, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: TP.ink3, marginTop: 3, maxWidth: D - STROKE * 2 - 10,
            overflow: 'hidden', whiteSpace: 'nowrap',
          }}>{bigLabel}</span>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 150, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {slices.map((sl, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            opacity: drawn ? 1 : 0,
            transform: drawn ? 'none' : 'translateX(8px)',
            transition: animate ? `opacity 0.45s ease-out ${0.25 + i * 0.07}s, transform 0.45s ease-out ${0.25 + i * 0.07}s` : 'none',
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: 2.5, flexShrink: 0,
              background: i === 0 ? accent : `color-mix(in srgb, ${accent} ${DONUT_MIXES[i] || 14}%, white)`,
            }} />
            <span style={{
              fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: TP.ink3, flex: 1,
              overflow: 'hidden', whiteSpace: 'nowrap',
            }}>{sl[0]}</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 500, color: TP.ink2, fontVariantNumeric: 'tabular-nums' }}>
              {formatNumber(Number(sl[1]) || 0)}{breakdown.unit || ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// — ranking → HORIZONTAL bars: top row solid accent, rest 30% mix —
function RankingBars({ ranking, accent, drawn, animate }) {
  const rows = (ranking.rows || []).slice(0, 6);
  const maxVal = Math.max(...rows.map((r) => Math.abs(Number(r[1]) || 0)), 0.0001);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {rows.map((row, i) => {
        const [label, val] = row;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: TP.ink3, width: 72, flexShrink: 0,
              overflow: 'hidden', whiteSpace: 'nowrap',
            }}>{label}</span>
            <div style={{ flex: 1, height: 10 }}>
              <div style={{
                width: `${Math.max(3, (Math.abs(Number(val) || 0) / maxVal) * 100)}%`,
                height: '100%', borderRadius: 5,
                background: i === 0
                  ? `linear-gradient(90deg, color-mix(in srgb, ${accent} 78%, white), ${accent})`
                  : `color-mix(in srgb, ${accent} 30%, white)`,
                boxShadow: i === 0 ? `0 2px 8px color-mix(in srgb, ${accent} 30%, transparent)` : 'none',
                transform: drawn ? 'scaleX(1)' : 'scaleX(0)', transformOrigin: 'left',
                transition: animate ? `transform 0.8s cubic-bezier(.2,.7,.2,1) ${i * 0.08}s` : 'none',
              }} />
            </div>
            <span style={{
              fontFamily: FONT_MONO, fontSize: 10, fontWeight: i === 0 ? 500 : 400,
              color: i === 0 ? TP.ink : TP.ink2, fontVariantNumeric: 'tabular-nums',
              minWidth: 38, textAlign: 'right', flexShrink: 0,
              opacity: drawn ? 1 : 0,
              transition: animate ? `opacity 0.4s ease-out ${0.3 + i * 0.08}s` : 'none',
            }}>{formatNumber(Number(val) || 0)}{ranking.unit || ''}</span>
          </div>
        );
      })}
    </div>
  );
}

export function ChartCard({ story, display, accent, onOpen }) {
  const reduced = useReducedMotion();
  const already = hasAnimated(`chart.${story.id}`);
  const [drawn, setDrawn] = useState(already || reduced);
  const [ref, shown, animateReveal] = useRevealOnce(`chartcard.${story.id}`, 0.3);
  const chartRef = useVisibleOnce(0.5, () => {
    shouldAnimateOnce(`chart.${story.id}`);
    setDrawn(true);
  });
  const animate = !reduced && !already;

  // shape priority: breakdown (donut) → ranking (h-bars) → trend (line/bar)
  const breakdown = display.breakdown;
  const ranking = display.ranking;
  const trend = display.trend;
  const caption = breakdown?.caption || ranking?.caption || trend?.caption;

  return (
    <article ref={ref}>
      <div>
        <div style={revealStyle(shown, animateReveal, 0, 6)}>
          <KickerRow category={display.category} accent={accent} story={story} countdown={display.countdown} />
        </div>
        <div style={{ marginTop: 12, ...revealStyle(shown, animateReveal, 0.08, 12) }}>
          <Headline raw={display.title} accent={accent} size={24.5} />
        </div>

        <div ref={chartRef} style={{ marginTop: 20 }}>
          {breakdown?.slices?.length ? (
            <BreakdownDonut breakdown={breakdown} accent={accent} drawn={drawn} animate={animate} storyId={story.id} />
          ) : ranking?.rows?.length ? (
            <RankingBars ranking={ranking} accent={accent} drawn={drawn} animate={animate} />
          ) : trend?.vals?.length ? (
            trend.style === 'line'
              ? <TrendLine trend={trend} accent={accent} drawn={drawn} animate={animate} storyId={story.id} />
              : <TrendBars trend={trend} accent={accent} drawn={drawn} animate={animate} storyId={story.id} />
          ) : null}
        </div>

        {caption ? (
          <p style={{
            fontFamily: FONT_BODY, fontSize: 14.2, lineHeight: 1.52, color: TP.ink2, margin: '14px 0 0',
            opacity: drawn ? 1 : 0,
            transition: animate ? 'opacity 0.6s ease-out 0.9s' : 'none',
          }}>
            {caption}
          </p>
        ) : null}
      </div>
      <div style={{ marginTop: 14 }}>
        <CardFooter story={story} tags={display.tags} onOpen={onOpen} />
      </div>
    </article>
  );
}


// ── RECEIPTS — claim vs. evidence (rare by design) ──────────────────────────
// Kicker reads THE RECEIPTS; the claim owns the visual weight (title demotes
// to a subhead), receipt rows carry check glyphs + source pills, and the
// verdict sits under a hairline. No photo, no stats row.

export function ReceiptsCard({ story, display, accent, onOpen }) {
  const [ref, shown, animate] = useRevealOnce(`receipts.${story.id}`, 0.3);
  const r = display.receipts || { claim: '', who: '', receipts: [], verdict: '' };
  const [name, ...roleParts] = (r.who || '').split(' · ');

  return (
    <article ref={ref}>
      <div>
        <div style={revealStyle(shown, animate, 0, 6)}>
          <KickerRow category={display.category} accent={accent} story={story}
            countdown={display.countdown} label="THE RECEIPTS" />
        </div>

        {/* article title demoted to a subhead — the claim owns the weight */}
        <h3 style={{
          fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 16.5, lineHeight: 1.34,
          letterSpacing: '-0.008em', color: TP.ink2, margin: '14px 0 0', textWrap: 'balance',
          ...revealStyle(shown, animate, 0.08, 8),
        }}>
          <Markup raw={display.title} emColor={TP.ink} strongColor={TP.ink} strongWeight={700} />
        </h3>

        <blockquote style={{
          fontFamily: FONT_HEAD, fontWeight: 700, fontStyle: 'italic',
          fontSize: 23, lineHeight: 1.3, letterSpacing: '-0.012em',
          color: TP.ink, margin: '18px 0 0', textWrap: 'balance',
          borderLeft: `3px solid ${accent}`, paddingLeft: 14,
          ...revealStyle(shown, animate, 0.16, 12),
        }}>
          “{r.claim}”
        </blockquote>

        {r.who ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, ...revealStyle(shown, animate, 0.3, 6) }}>
            <span style={{ width: 26, height: 1.5, background: accent, flexShrink: 0 }} />
            <span style={{
              fontFamily: FONT_MONO, fontSize: 10, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: TP.ink3,
            }}>
              <span style={{ color: TP.ink2, fontWeight: 500 }}>{name}</span>
              {roleParts.length ? ` · ${roleParts.join(' · ')}` : ''}
            </span>
          </div>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginTop: 18 }}>
          {(r.receipts || []).slice(0, 2).map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, ...revealStyle(shown, animate, 0.4 + i * 0.12, 10) }}>
              <svg width="15" height="15" viewBox="0 0 15 15" style={{ flexShrink: 0, marginTop: 2.5 }} aria-hidden>
                <circle cx="7.5" cy="7.5" r="7" fill={`color-mix(in srgb, ${accent} 12%, white)`} stroke={accent} strokeWidth="1" />
                <path d="M4.4 7.8l2.1 2.1 4.1-4.6" fill="none" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontFamily: FONT_BODY, fontSize: 14.7, lineHeight: 1.52, color: TP.ink2, minWidth: 0 }}>
                <Markup raw={item.text || ''} emColor={accent} strongColor={TP.ink} />
                {item.source ? (
                  <span style={{
                    fontFamily: FONT_MONO, fontSize: 9, fontWeight: 500,
                    letterSpacing: '0.08em', textTransform: 'uppercase', color: accent,
                    border: '1px solid rgba(22,21,15,0.09)', borderRadius: 99,
                    padding: '2.5px 8px', marginLeft: 8, whiteSpace: 'nowrap',
                    verticalAlign: '1px', display: 'inline-block',
                  }}>{item.source}</span>
                ) : null}
              </span>
            </div>
          ))}
        </div>

        {r.verdict ? (
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 10,
            borderTop: `1px solid ${TP.line}`, marginTop: 18, padding: '12px 0 2px',
            ...revealStyle(shown, animate, 0.65, 8),
          }}>
            <span style={{
              fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 500,
              letterSpacing: '0.18em', textTransform: 'uppercase', color: accent, flexShrink: 0,
            }}>VERDICT</span>
            <span style={{ fontFamily: FONT_BODY, fontSize: 15, fontWeight: 700, lineHeight: 1.45, color: TP.ink }}>
              {r.verdict}
            </span>
          </div>
        ) : null}
      </div>
      <div style={{ marginTop: 14, ...revealStyle(shown, animate, 0.78, 8) }}>
        <CardFooter story={story} tags={display.tags} onOpen={onOpen} />
      </div>
    </article>
  );
}
