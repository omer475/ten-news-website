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
  KickerRow, Bullets, CardFooter, Headline,
  CountUp, ParallaxImage, useVisibleOnce, useReducedMotion,
  useRevealOnce, revealStyle, TPCountdownChip, focusObjectPosition,
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
          focus={display.image_focus}
          focusTargetY={0.42}
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
              fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 25, lineHeight: 1.14,
              letterSpacing: '-0.016em', color: '#fff', margin: 0, textWrap: 'balance',
              textShadow: '0 2px 26px rgba(0,0,0,0.45)',
              ...revealStyle(shown, animate, 0.05, 18),
            }}>
              {/* on photos, entity marks use goldSoft — dark gold is illegible */}
              <Markup raw={display.title} emColor={TP.goldSoft} strongColor="#fff" strongWeight={800} />
            </h2>
            {display.lede ? (
              <p style={{
                fontFamily: FONT_BODY, fontSize: 14.4, lineHeight: 1.48, fontWeight: 450,
                color: 'rgba(255,255,255,0.85)', maxWidth: '50ch', margin: '9px 0 0',
                ...revealStyle(shown, animate, 0.22, 14),
              }}>{display.lede}</p>
            ) : null}
          </div>
        </ParallaxImage>
      </div>

      {/* Image card: photo + headline + lede only — no embedded modules (§redesign). */}
      <div style={{ marginTop: 14, ...revealStyle(shown, animate, 0.3, 8) }}>
        <CardFooter story={story} tags={display.tags} onOpen={onOpen} />
      </div>
    </article>
  );
}

// ── 5.2 CLASSIC — photo top, text below (the only card with a bullet list) ───

export function ClassicCard({ story, display, accent, onOpen }) {
  const [ref, shown, animate] = useRevealOnce(`classic.${story.id}`, 0.25);

  return (
    <article ref={ref}>
      <div>
        <ParallaxImage src={display.imageURL || story.urlToImage} aspectRatio="16 / 10" borderRadius={26} focus={display.image_focus} />

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 17, ...revealStyle(shown, animate, 0.08, 12) }}>
          <div style={{ flex: 1 }}>
            <Headline raw={display.title} accent={accent} size={22.5} />
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

      {/* Classic is the ONE card that carries a bullet list — no embedded modules. */}
      <div style={{ marginTop: 14, ...revealStyle(shown, animate, 0.42, 8) }}>
        <CardFooter story={story} tags={display.tags} onOpen={onOpen} />
      </div>
    </article>
  );
}

// ── 5.3 STAT-HERO — pure data card: one giant number, no photo, no bullets ───

export function StatHeroCard({ story, display, accent, onOpen, insetPhoto }) {
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
        {insetPhoto || null}
        <div style={revealStyle(shown, animate, 0.05, 8)}>
          <KickerRow category={display.category} accent={accent} story={story} countdown={display.countdown} />
        </div>
        <div style={{ marginTop: 12, ...revealStyle(shown, animate, 0.12, 12) }}>
          <Headline raw={display.title} accent={accent} size={26} />
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 22, flexWrap: 'wrap', ...revealStyle(shown, animate, 0.3, 14) }}>
          <span style={{
            fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 52, lineHeight: 0.95,
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

        {/* one supporting sentence — NOT a bullet list (§redesign) */}
        {display.lede ? (
          <p style={{
            fontFamily: FONT_BODY, fontSize: 14.6, lineHeight: 1.55, fontWeight: 450,
            color: TP.ink2, margin: '18px 0 0', maxWidth: '52ch',
            ...revealStyle(shown, animate, 0.45, 10),
          }}>{display.lede}</p>
        ) : null}
      </div>
      {/* NO stats row, NO mini-chart — the big number owns the frame (§5.3) */}
      <div style={{ marginTop: 18, ...revealStyle(shown, animate, 0.6, 8) }}>
        <CardFooter story={story} tags={display.tags} onOpen={onOpen} />
      </div>
    </article>
  );
}

// ── 5.4 QUOTE — pure data card: pull-quote led, no photo, no bullets ─────────

export function QuoteCard({ story, display, accent, onOpen, insetPhoto }) {
  const [ref, shown, animate] = useRevealOnce(`quote.${story.id}`, 0.35);
  const quote = display.quote || { text: '', who: '' };
  const [name, ...roleParts] = (quote.who || '').split(' · ');

  return (
    <article ref={ref}>
      <div>
        {insetPhoto || null}
        <div style={revealStyle(shown, animate, 0, 6)}>
          <KickerRow category={display.category} accent={accent} story={story} countdown={display.countdown} />
        </div>

        {/* chat-style quote bubble: soft accent tint, speech corner, and a
            springing quote badge — designed, not a newspaper glyph */}
        <div style={{ position: 'relative', marginTop: 26 }}>
          <span aria-hidden style={{
            position: 'absolute', top: -17, left: 18, zIndex: 1,
            width: 32, height: 32, borderRadius: '50%',
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
            fontSize: 21, lineHeight: 1.32, letterSpacing: '-0.012em',
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
          fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 15.5, lineHeight: 1.36,
          letterSpacing: '-0.008em', color: TP.ink2, margin: '20px 0 0', textWrap: 'balance',
          ...revealStyle(shown, animate, 0.58, 10),
        }}>
          <Markup raw={display.title} emColor={TP.ink} strongColor={TP.ink} strongWeight={700} />
        </h3>
      </div>
      {/* NO bullets, NO mini-chart — the quote owns the frame (§redesign) */}
      <div style={{ marginTop: 18, ...revealStyle(shown, animate, 0.82, 8) }}>
        <CardFooter story={story} tags={display.tags} onOpen={onOpen} />
      </div>
    </article>
  );
}

// ── 5.5 VERSUS — pure data card: three typed variants, no photo, no bullets ──
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
            {value(versus.a, 'a', 35, TP.ink, accent)}
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
            {value(versus.b, 'b', 35, TP.ink, accent)}
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
          {value(versus.a, 'a', 28, TP.ink3, TP.ink3)}
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
          {value(versus.b, 'b', 37, TP.ink, accent)}
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
          {value(versus.a, 'a', 33, TP.ink, accent)}
          {whoLabel(versus.a?.who)}
          {bar(aVal, `linear-gradient(90deg, color-mix(in srgb, ${accent} 72%, white), ${accent})`, 0.15)}
        </div>
        <div style={{ flex: 1, minWidth: 0, ...sideReveal(14, 0.3) }}>
          {value(versus.b, 'b', 33, TP.ink, accent)}
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
          <Headline raw={display.title} accent={accent} size={22.5} />
        </div>

        {kind === 'duel' ? duelFigure() : null}
        {kind === 'change' ? changeFigure() : null}
        {kind === 'gap' ? gapFigure() : null}

        {versus.note ? (
          <p style={{
            fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.5, color: TP.ink2,
            textAlign: 'center', margin: '18px auto 0', maxWidth: '42ch',
            ...revealStyle(shown, animate, 0.55, 8),
          }}>{versus.note}</p>
        ) : null}
      </div>
      {/* NO mini-chart — the contest figure owns the frame (§redesign) */}
      <div style={{ marginTop: 18, ...revealStyle(shown, animate, 0.7, 8) }}>
        <CardFooter story={story} tags={display.tags} onOpen={onOpen} />
      </div>
    </article>
  );
}

// ── 5.6 TIMELINE — pure data card: developing story, no photo, no bullets ────

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
          <Headline raw={display.title} accent={accent} size={22.5} />
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
      <div style={{ marginTop: 18, ...revealStyle(shown, animate, 0.25 + entries.length * 0.14, 8) }}>
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
  const [thumbPos, setThumbPos] = useState('50% 50%');
  // the thumbnail shows only when the pipeline graded the image as readable
  // at square-thumb size; otherwise the card runs text-only full width and
  // stays the feed's breath.
  const showImage = display.split_ok === true && (display.imageURL || story.urlToImage);

  return (
    <article ref={ref}>
      <div style={{ display: 'flex', gap: 16 }}>
        {showImage ? (
        <div style={{
          position: 'relative', width: 116, height: 116, borderRadius: 20,
          overflow: 'hidden', background: TP.line, flexShrink: 0,
          ...revealStyle(shown, animate, 0.05, 8),
        }}>
          <img
            src={display.imageURL || story.urlToImage}
            alt=""
            loading="lazy"
            onLoad={(e) => {
              setImgLoaded(true);
              setThumbPos(focusObjectPosition(e.currentTarget, display.image_focus));
            }}
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              objectPosition: thumbPos,
              opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.5s ease-out',
            }}
          />
          <span style={{
            position: 'absolute', inset: 0, borderRadius: 20, pointerEvents: 'none',
            boxShadow: 'inset 0 0 0 1px rgba(22,21,15,0.05)',
          }} />
        </div>
        ) : null}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={revealStyle(shown, animate, 0.12, 6)}>
            <KickerRow category={display.category} accent={accent} story={story} countdown={display.countdown} />
          </div>
          <h2 style={{
            fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 16.5, lineHeight: 1.26,
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
  // y-domain hugs the DATA (±15% headroom), not zero — a 22% six-month move
  // must visibly travel the chart, not render as a flat line.
  const dMin = Math.min(...vals);
  const dMax = Math.max(...vals);
  const range = Math.max(dMax - dMin, Math.abs(dMax) * 0.02, 0.0001);
  const min = dMin - 0.15 * range;
  const max = dMax + 0.15 * range;
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
        <text x={x(0)} y={y(vals[0]) - 10} textAnchor="start"
          fontFamily={FONT_MONO} fontSize="10.5" fill={TP.ink3}
          style={{ opacity: drawn ? 1 : 0, transition: animate ? 'opacity 0.4s ease-out 0.35s' : 'none' }}>
          {formatNumber(vals[0])}{trend.unit || ''}
        </text>
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
  const minVal = Math.min(...vals);
  // when every value sits within 25% of the max, a zero baseline renders
  // near-identical bars — lift the baseline so the differences show.
  const tight = vals.length > 1 && (maxVal - minVal) <= 0.25 * Math.abs(maxVal);
  const baseline = tight ? Math.max(0, minVal - 0.3 * Math.max(maxVal - minVal, 0.0001)) : 0;
  const denom = Math.max(maxVal - baseline, 0.0001);
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
              height: Math.max(6, (120 * (v - baseline)) / denom),
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
          <span style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 24, lineHeight: 1, letterSpacing: '-0.02em', color: TP.ink }}>
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
          <Headline raw={display.title} accent={accent} size={22.5} />
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
          fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 15.5, lineHeight: 1.36,
          letterSpacing: '-0.008em', color: TP.ink2, margin: '14px 0 0', textWrap: 'balance',
          ...revealStyle(shown, animate, 0.08, 8),
        }}>
          <Markup raw={display.title} emColor={TP.ink} strongColor={TP.ink} strongWeight={700} />
        </h3>

        <blockquote style={{
          fontFamily: FONT_HEAD, fontWeight: 700, fontStyle: 'italic',
          fontSize: 21, lineHeight: 1.32, letterSpacing: '-0.012em',
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
      <div style={{ marginTop: 18, ...revealStyle(shown, animate, 0.78, 8) }}>
        <CardFooter story={story} tags={display.tags} onOpen={onOpen} />
      </div>
    </article>
  );
}


// ── SCORE — head-to-head match results ──────────────────────────────────────
// Two scores face each other across a hairline with the status chip pinned on
// it. Winner takes ink + an accent dash under the team name; LIVE pulses.
// Sport garnish stays subtle: tennis shares the set line, 3-digit sports
// shrink, MMA/boxing hide a silly 1–0 and lead with the method chip.

const SPORT_GLYPHS = {
  football: <><circle cx="6" cy="6" r="5.2" /><path d="M6 3.6l2.2 1.6-.84 2.6H4.64L3.8 5.2z" /></>,
  basketball: <><circle cx="6" cy="6" r="5.2" /><path d="M.8 6h10.4M6 .8v10.4M2.2 2.2c2.5 2.5 2.5 5.1 0 7.6M9.8 2.2c-2.5 2.5-2.5 5.1 0 7.6" /></>,
  tennis: <><circle cx="6" cy="6" r="5.2" /><path d="M1 4c3 1 7 1 10-.6M1 8.6C4 7 8 7 11 8" /></>,
  hockey: <><ellipse cx="6" cy="6" rx="5.2" ry="2.6" /><path d="M.8 6v2c0 1.4 2.3 2.6 5.2 2.6s5.2-1.2 5.2-2.6V6" /></>,
  baseball: <><circle cx="6" cy="6" r="5.2" /><path d="M2 2.4c1.4 2 1.4 5.2 0 7.2M10 2.4c-1.4 2-1.4 5.2 0 7.2" /></>,
  cricket: <><path d="M2 10L8.4 3.6M7.2 2.4l2.4 2.4" /><circle cx="9.6" cy="9.4" r="1.6" /></>,
  rugby: <><ellipse cx="6" cy="6" rx="5.4" ry="3.4" transform="rotate(-32 6 6)" /><path d="M4.4 7.6l3.2-3.2M5.1 8.3L8.3 5.1" /></>,
  amfootball: <><ellipse cx="6" cy="6" rx="5.4" ry="3.4" transform="rotate(-32 6 6)" /><path d="M4.4 7.6l3.2-3.2M5.2 6.4l1.2 1.2M6.4 5.2l1.2 1.2" /></>,
  mma: <><path d="M3 5.4V4a3 3 0 016 0v1.4M2.4 5.4h7.2v2.4a3.6 3.6 0 01-7.2 0z" /></>,
  boxing: <><path d="M3 5.4V4a3 3 0 016 0v1.4M2.4 5.4h7.2v2.4a3.6 3.6 0 01-7.2 0z" /></>,
  volleyball: <><circle cx="6" cy="6" r="5.2" /><path d="M6 .8c.4 3.4-1 6.4-4.6 8M11 4C8 5 4.8 4.6 2.6 2.4M9.6 10.2C7 8 5.8 5 6.4.9" /></>,
  other: <path d="M.8 6h2.4l1.6-3.6L7.2 9.6 8.8 6h2.4" />,
};

function SportGlyph({ sport, accent }) {
  const glyph = SPORT_GLYPHS[sport] || SPORT_GLYPHS.other;
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" aria-hidden
      style={{ flexShrink: 0, display: 'block' }}
      fill="none" stroke={accent} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
      {glyph}
    </svg>
  );
}

export function ScoreCard({ story, display, accent, onOpen }) {
  const [ref, shown, animate] = useRevealOnce(`score.${story.id}`, 0.35);
  const sc = display.score || { a: {}, b: {}, status: '', sport: 'other' };
  const live = (sc.status || '').toUpperCase() === 'LIVE';
  const fight = sc.sport === 'mma' || sc.sport === 'boxing';

  const aNum = parseFloat(sc.a?.score);
  const bNum = parseFloat(sc.b?.score);
  const numeric = Number.isFinite(aNum) && Number.isFinite(bNum);
  const aWins = numeric && aNum > bNum;
  const bWins = numeric && bNum > aNum;
  // a 1–0 scoreline looks silly for a knockout — names + method chip only
  const hideNumbers = fight && numeric && aNum <= 1 && bNum <= 1;
  const threeDigit = numeric && (aNum >= 100 || bNum >= 100);
  const scoreSize = threeDigit ? 40 : 48;

  // tennis: one shared set line under the scoreline when only side a has it
  const sharedDetail = sc.sport === 'tennis' && sc.a?.detail && !sc.b?.detail ? sc.a.detail : null;

  const side = (s, wins, loses, fromX, key) => (
    <div style={{
      flex: 1, textAlign: 'center', minWidth: 0,
      opacity: shown ? 1 : 0,
      transform: shown ? 'none' : `translateX(${fromX}px)`,
      transition: animate ? 'opacity 0.6s cubic-bezier(.2,.7,.2,1) 0.2s, transform 0.6s cubic-bezier(.2,.7,.2,1) 0.2s' : 'none',
    }}>
      <div style={{
        fontFamily: FONT_MONO, fontSize: 10, fontWeight: 500, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: TP.ink3, whiteSpace: 'nowrap',
      }}>{s?.team || ''}</div>
      <div style={{
        width: 22, height: 2.5, borderRadius: 99, background: accent,
        margin: '5px auto 0',
        opacity: wins ? 1 : 0,
        transform: wins && shown ? 'scaleX(1)' : 'scaleX(0)',
        transition: animate ? 'transform 0.5s cubic-bezier(.2,.7,.2,1) 0.9s' : 'none',
      }} />
      {!hideNumbers ? (
        <div style={{
          fontFamily: FONT_HEAD, fontWeight: 800, fontSize: scoreSize, lineHeight: 1,
          letterSpacing: '-0.02em', color: loses ? TP.ink3 : TP.ink, marginTop: 6,
        }}>
          {Number.isFinite(parseFloat(s?.score)) ? (
            <CountUp value={parseFloat(s.score)} animKey={`score.${story.id}.${key}`} />
          ) : (s?.score || '')}
        </div>
      ) : null}
      {s?.detail && !sharedDetail ? (
        <div style={{
          fontFamily: FONT_MONO, fontSize: 9.5, color: TP.ink2, marginTop: 6,
          whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
        }}>{s.detail}</div>
      ) : null}
    </div>
  );

  return (
    <article ref={ref}>
      <div>
        {/* kicker: sport glyph (+ pulsing dot when LIVE) · countdown · age */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, ...revealStyle(shown, animate, 0, 6) }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <SportGlyph sport={sc.sport} accent={accent} />
            {live ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span className="tp-cd-pulse" style={{
                  width: 6, height: 6, borderRadius: '50%', background: TP.breakingDot,
                  '--tp-cd-color': 'rgba(255,90,82,0.55)',
                }} />
                <span style={{
                  fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 500,
                  letterSpacing: '0.18em', color: TP.red,
                }}>LIVE</span>
              </span>
            ) : null}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
            {display.countdown ? <TPCountdownChip countdown={display.countdown} accent={accent} /> : null}
            <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: TP.ink3 }}>
              {ageLabel(story.publishedAt)}
            </span>
          </span>
        </div>

        <div style={{ marginTop: 12, ...revealStyle(shown, animate, 0.08, 12) }}>
          <Headline raw={display.title} accent={accent} size={22.5} />
        </div>

        {/* scoreline: two scores face off across a hairline w/ status chip */}
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 14, marginTop: 22 }}>
          {side(sc.a, aWins, bWins, -14, 'a')}
          <div style={{
            position: 'relative', width: 1.5, alignSelf: 'stretch', minHeight: 76,
            background: TP.line, flexShrink: 0,
            opacity: shown ? 1 : 0,
            transition: animate ? 'opacity 0.5s ease-out 0.35s' : 'none',
          }}>
            {sc.status ? (
              <span style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                fontFamily: FONT_MONO, fontSize: 9, fontWeight: 500,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                whiteSpace: 'nowrap', borderRadius: 99, padding: '4px 9px',
                // MMA/boxing: the method chip is the verdict — accent fill
                background: fight ? accent : TP.bg,
                color: fight ? '#fff' : TP.ink2,
                border: fight ? `1px solid ${accent}` : `1px solid color-mix(in srgb, ${accent} 45%, white)`,
                boxShadow: fight ? `0 3px 10px color-mix(in srgb, ${accent} 30%, transparent)` : 'none',
              }}>{sc.status}</span>
            ) : null}
          </div>
          {side(sc.b, bWins, aWins, 14, 'b')}
        </div>

        {sharedDetail ? (
          <div style={{
            textAlign: 'center', fontFamily: FONT_MONO, fontSize: 9.5, color: TP.ink2,
            marginTop: 10, fontVariantNumeric: 'tabular-nums',
            ...revealStyle(shown, animate, 0.5, 6),
          }}>{sharedDetail}</div>
        ) : null}

        {sc.note ? (
          <p style={{
            fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.5, color: TP.ink2,
            textAlign: 'center', margin: '18px auto 0', maxWidth: '42ch',
            ...revealStyle(shown, animate, 0.55, 8),
          }}>{sc.note}</p>
        ) : null}
      </div>
      {/* NO mini-chart — the scoreline owns the frame (§redesign) */}
      <div style={{ marginTop: 18, ...revealStyle(shown, animate, 0.7, 8) }}>
        <CardFooter story={story} tags={display.tags} onOpen={onOpen} />
      </div>
    </article>
  );
}


// ── Mini-chart strip (add-on) ────────────────────────────────────────────────
// When a story carries chart data but the rhythm picked a NON-chart template,
// a compact strip renders between the bullets and the footer: 64px line for
// trend, 64px mini-donut for breakdown, max-3-row bars for ranking, with the
// caption as one mono line. Static — it inherits the card's own entrance.

export function MiniChart({ display, accent, storyId }) {
  const trend = display.trend;
  const breakdown = display.breakdown;
  const ranking = display.ranking;
  if (!trend?.vals?.length && !breakdown?.slices?.length && !ranking?.rows?.length) return null;
  const caption = breakdown?.caption || ranking?.caption || trend?.caption;

  let body = null;

  if (breakdown?.slices?.length) {
    const slices = breakdown.slices.slice(0, 6);
    const total = slices.reduce((sum, sl) => sum + (Number(sl[1]) || 0), 0) || 1;
    const D = 64, ST = 9, R = (D - ST) / 2;
    const GAP = (2 / 360) * 100;
    let offset = 25;
    const segs = slices.map((sl, i) => {
      const pct = ((Number(sl[1]) || 0) / total) * 100;
      const seg = { len: Math.max(0, pct - GAP), offset, color: i === 0 ? accent : `color-mix(in srgb, ${accent} ${DONUT_MIXES[i] || 14}%, white)` };
      offset -= pct;
      return seg;
    });
    const [topLabel, topVal] = slices[0] || ['', 0];
    body = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <svg viewBox={`0 0 ${D} ${D}`} width={D} height={D} aria-hidden style={{ flexShrink: 0 }}>
          <circle cx={D / 2} cy={D / 2} r={R} fill="none" stroke={TP.line} strokeOpacity="0.5" strokeWidth={ST} />
          {segs.map((seg, i) => (
            <circle key={i} cx={D / 2} cy={D / 2} r={R} fill="none"
              stroke={seg.color} strokeWidth={ST} pathLength="100"
              strokeDasharray={`${seg.len} ${100 - seg.len}`} strokeDashoffset={seg.offset} />
          ))}
        </svg>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 21, letterSpacing: '-0.02em', color: TP.ink, fontVariantNumeric: 'tabular-nums' }}>
            {formatNumber(Number(topVal) || 0)}<span style={{ fontSize: '0.6em', color: accent }}>{breakdown.unit || ''}</span>
          </span>
          <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: TP.ink3, marginTop: 2 }}>{topLabel}</div>
        </div>
      </div>
    );
  } else if (ranking?.rows?.length) {
    const rows = ranking.rows.slice(0, 3);
    const maxVal = Math.max(...rows.map((r) => Math.abs(Number(r[1]) || 0)), 0.0001);
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: TP.ink3, width: 58, flexShrink: 0, overflow: 'hidden', whiteSpace: 'nowrap' }}>{row[0]}</span>
            <div style={{ flex: 1, height: 7 }}>
              <div style={{
                width: `${Math.max(3, (Math.abs(Number(row[1]) || 0) / maxVal) * 100)}%`, height: '100%', borderRadius: 4,
                background: i === 0 ? accent : `color-mix(in srgb, ${accent} 30%, white)`,
              }} />
            </div>
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: i === 0 ? TP.ink : TP.ink2, minWidth: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {formatNumber(Number(row[1]) || 0)}{ranking.unit || ''}
            </span>
          </div>
        ))}
      </div>
    );
  } else if (trend?.vals?.length >= 2) {
    const vals = trend.vals;
    const labels = trend.labels || [];
    const n = vals.length;
    const W = 560, H = 64, PX = 6, PY = 8;
    const dMin = Math.min(...vals);
    const dMax = Math.max(...vals);
    const range = Math.max(dMax - dMin, Math.abs(dMax) * 0.02, 0.0001);
    const lo = dMin - 0.15 * range, hi = dMax + 0.15 * range;
    const x = (i) => PX + (i * (W - PX * 2)) / (n - 1);
    const y = (v) => PY + (1 - (v - lo) / (hi - lo)) * (H - PY * 2);
    const pts = vals.map((v, i) => [x(i), y(v)]);
    const line = smoothPath(pts);
    const area = `${line} L ${x(n - 1)} ${H} L ${x(0)} ${H} Z`;
    const gid = `tpmini-${storyId}`;
    body = (
      <div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }} aria-hidden>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.16" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gid})`} />
          <path d={line} fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={x(0)} cy={y(vals[0])} r="3" fill={TP.bg} stroke={accent} strokeWidth="1.8" />
          <circle cx={x(n - 1)} cy={y(vals[n - 1])} r="3.6" fill={accent} />
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: TP.ink3 }}>{labels[0] || ''} · {formatNumber(vals[0])}{trend.unit || ''}</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 500, color: accent }}>{labels[n - 1] || ''} · {formatNumber(vals[n - 1])}{trend.unit || ''}</span>
        </div>
      </div>
    );
  }

  if (!body) return null;
  return (
    <div style={{ marginTop: 16 }}>
      {body}
      {caption ? (
        <div style={{ fontFamily: FONT_MONO, fontSize: 9, lineHeight: 1.5, color: TP.ink3, marginTop: 6 }}>{caption}</div>
      ) : null}
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════════════
// PHOTO PLACEMENT SYSTEM (v4) — placement is a core variety axis. Article cards
// arrange the photo five ways; data cards take a subtle photo accent. Every
// crop honors image_focus {x,y} so the subject is never cut off.
// ════════════════════════════════════════════════════════════════════════════

function posFromFocus(focus) {
  if (!focus || typeof focus.x !== 'number') return '50% 50%';
  return `${Math.round((focus.x ?? 0.5) * 100)}% ${Math.round((focus.y ?? 0.5) * 100)}%`;
}

// focus-cropped <img> with skeleton + fade-in (used by strips / side / inset)
function FocusImg({ src, focus, radius = 18, ar, style }) {
  const [loaded, setLoaded] = useState(false);
  const [pos, setPos] = useState(posFromFocus(focus));
  return (
    <div style={{
      position: 'relative', borderRadius: radius, overflow: 'hidden',
      background: TP.line, ...(ar ? { aspectRatio: ar } : {}), ...style,
    }}>
      <img
        src={src} alt="" loading="lazy" decoding="async"
        onLoad={(e) => { setLoaded(true); setPos(focusObjectPosition(e.currentTarget, focus)); }}
        style={{
          width: '100%', height: '100%', objectFit: 'cover', objectPosition: pos,
          display: 'block', opacity: loaded ? 1 : 0, transition: 'opacity 0.5s ease-out',
        }}
      />
      <span style={{ position: 'absolute', inset: 0, borderRadius: radius, pointerEvents: 'none', boxShadow: 'inset 0 0 0 1px rgba(22,21,15,0.06)' }} />
    </div>
  );
}

// thin photo strip for a data card (position 'above' | 'below' the figure)
export function PhotoStrip({ display, story, position = 'below' }) {
  const img = display.imageURL || story?.urlToImage;
  if (!img) return null;
  return (
    <div style={{ margin: position === 'above' ? '0 0 16px' : '16px 0 0' }}>
      <FocusImg src={img} focus={display.image_focus} ar="16 / 4.6" radius={14} />
    </div>
  );
}

// faint accent-tinted photo wash behind a data card (texture, not competition)
export function WashLayer({ display, story, accent }) {
  const [pos, setPos] = useState(posFromFocus(display.image_focus));
  const img = display.imageURL || story?.urlToImage;
  if (!img) return null;
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 24, overflow: 'hidden', zIndex: 0 }}>
      <img src={img} alt="" loading="lazy" decoding="async"
        onLoad={(e) => setPos(focusObjectPosition(e.currentTarget, display.image_focus))}
        style={{
          width: '100%', height: '100%', objectFit: 'cover', objectPosition: pos,
          opacity: 0.12, filter: 'saturate(0.85)',
        }} />
      <span style={{ position: 'absolute', inset: 0, background: `linear-gradient(155deg, color-mix(in srgb, ${accent} 9%, ${TP.bg}) 0%, color-mix(in srgb, ${accent} 3%, ${TP.bg}) 45%, ${TP.bg} 100%)` }} />
    </div>
  );
}

// round cut-out portrait that the headline / quote wraps around (float)
export function InsetPhoto({ display, story, size = 66 }) {
  const [loaded, setLoaded] = useState(false);
  const [pos, setPos] = useState(posFromFocus(display.image_focus));
  const img = display.imageURL || story?.urlToImage;
  if (!img) return null;
  return (
    <span style={{
      float: 'right', width: size, height: size, borderRadius: '50%', overflow: 'hidden',
      margin: '2px 0 10px 14px', background: TP.line, flexShrink: 0,
      boxShadow: '0 3px 12px rgba(22,21,15,0.14), 0 0 0 3px ' + TP.bg,
    }}>
      <img src={img} alt="" loading="lazy" decoding="async"
        onLoad={(e) => { setLoaded(true); setPos(focusObjectPosition(e.currentTarget, display.image_focus)); }}
        style={{
          width: '100%', height: '100%', objectFit: 'cover', objectPosition: pos,
          opacity: loaded ? 1 : 0, transition: 'opacity 0.5s ease-out',
        }} />
    </span>
  );
}

// shared article text block (kicker → headline → bullets|lede)
function ArticleText({ story, display, accent, shown, animate, compact }) {
  return (
    <>
      <div style={revealStyle(shown, animate, 0.08, 6)}>
        <KickerRow category={display.category} accent={accent} story={story} countdown={display.countdown} />
      </div>
      <div style={{ marginTop: 10, ...revealStyle(shown, animate, 0.14, 10) }}>
        <Headline raw={display.title} accent={accent} size={compact ? 18 : 22.5} />
      </div>
      {compact
        ? (display.lede ? (
            <p style={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.5, color: TP.ink2, margin: '8px 0 0', ...revealStyle(shown, animate, 0.22, 8) }}>{display.lede}</p>
          ) : null)
        : (
            <div style={{ marginTop: 13 }}>
              <Bullets bullets={display.bullets} accent={accent} reveal={{ shown, animate, baseDelay: 0.22 }} />
            </div>
          )}
    </>
  );
}

// ── ARTICLE CARD — five photo placements (full-bleed handled by CoverCard) ───
export function ArticleCard({ story, display, accent, placement = 'top-banner' }) {
  const [ref, shown, animate] = useRevealOnce(`art.${placement}.${story.id}`, 0.25);
  const img = display.imageURL || story.urlToImage;
  const focus = display.image_focus;
  const footer = (
    <div style={{ marginTop: 14, ...revealStyle(shown, animate, 0.42, 8) }}>
      <CardFooter story={story} tags={display.tags} />
    </div>
  );

  // none — text-only article card (no usable photo); headline + bullets
  if (placement === 'none' || !img) {
    return (
      <article ref={ref}>
        <ArticleText story={story} display={display} accent={accent} shown={shown} animate={animate} />
        {footer}
      </article>
    );
  }

  // side-left / side-right — photo beside text
  if (placement === 'side-left' || placement === 'side-right') {
    const left = placement === 'side-left';
    return (
      <article ref={ref}>
        <div style={{ display: 'flex', flexDirection: left ? 'row' : 'row-reverse', gap: 16, alignItems: 'stretch' }}>
          <div style={{ width: '42%', flexShrink: 0, ...revealStyle(shown, animate, 0.05, 8) }}>
            <FocusImg src={img} focus={focus} radius={20} style={{ height: '100%', minHeight: 158 }} />
          </div>
          <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <ArticleText story={story} display={display} accent={accent} shown={shown} animate={animate} compact />
          </div>
        </div>
        {footer}
      </article>
    );
  }

  const photoEl = (
    <div style={revealStyle(shown, animate, 0.05, 8)}>
      <ParallaxImage src={img} aspectRatio="16 / 10" borderRadius={24} focus={focus} />
    </div>
  );

  // inline-window — headline → photo → bullets
  if (placement === 'inline-window') {
    return (
      <article ref={ref}>
        <div style={revealStyle(shown, animate, 0.04, 6)}>
          <KickerRow category={display.category} accent={accent} story={story} countdown={display.countdown} />
        </div>
        <div style={{ margin: '10px 0 0', ...revealStyle(shown, animate, 0.1, 10) }}>
          <Headline raw={display.title} accent={accent} size={22.5} />
        </div>
        <div style={{ margin: '16px 0', ...revealStyle(shown, animate, 0.18, 8) }}>
          <ParallaxImage src={img} aspectRatio="16 / 9" borderRadius={22} focus={focus} />
        </div>
        <Bullets bullets={display.bullets} accent={accent} reveal={{ shown, animate, baseDelay: 0.28 }} />
        {footer}
      </article>
    );
  }

  // bottom-anchor — text first, photo underneath
  if (placement === 'bottom-anchor') {
    return (
      <article ref={ref}>
        <ArticleText story={story} display={display} accent={accent} shown={shown} animate={animate} />
        <div style={{ marginTop: 16, ...revealStyle(shown, animate, 0.3, 8) }}>
          <ParallaxImage src={img} aspectRatio="16 / 9" borderRadius={22} focus={focus} />
        </div>
        {footer}
      </article>
    );
  }

  // top-banner (default) — photo on top, text below (the classic)
  return (
    <article ref={ref}>
      {photoEl}
      <div style={{ marginTop: 16 }}>
        <ArticleText story={story} display={display} accent={accent} shown={shown} animate={animate} />
      </div>
      {footer}
    </article>
  );
}
