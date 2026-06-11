// TodayPlus Feed — the 9 article card templates (spec §5)
// Every card receives { story, display, accent, onOpen }. Tapping the card
// body opens the detailed article overlay (existing site behavior).

import React, { useState } from 'react';
import {
  TP, FONT_HEAD, FONT_BODY, FONT_MONO,
  formatNumber, ageLabel, Markup, shouldAnimateOnce, hasAnimated,
} from './tokens';
import {
  KickerRow, Bullets, StatsRow, CardFooter, Headline,
  CountUp, ParallaxImage, useVisibleOnce, useReducedMotion,
} from './shared';

const clickable = (onOpen, story) => ({
  onClick: () => onOpen?.(story),
  style: { cursor: 'pointer' },
});

// ── 5.1 COVER — headline inside the photo ───────────────────────────────────

export function CoverCard({ story, display, accent, onOpen }) {
  return (
    <article>
      <div {...clickable(onOpen, story)}>
        <ParallaxImage
          src={display.imageURL || story.urlToImage}
          aspectRatio="4 / 4.8"
          borderRadius={22}
          overlay={
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to bottom, rgba(12,11,8,0.18) 0%, rgba(12,11,8,0) 32%, rgba(12,11,8,0.5) 60%, rgba(12,11,8,0.94) 96%)',
            }} />
          }
        >
          <span style={{
            position: 'absolute', top: 12, right: 12,
            fontFamily: FONT_MONO, fontSize: 9.5, color: '#fff',
            background: 'rgba(12,11,8,0.4)', backdropFilter: 'blur(8px)',
            borderRadius: 99, padding: '5px 9px',
          }}>{ageLabel(story.publishedAt)}</span>

          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
              {display.breaking ? <span className="tp-breaking-dot" /> : null}
              <span style={{
                fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 500,
                letterSpacing: '0.22em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.85)',
              }}>
                {display.breaking ? `BREAKING · ${display.category}` : display.category}
              </span>
            </div>
            <h2 style={{
              fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 27, lineHeight: 1.1,
              letterSpacing: '-0.035em', color: '#fff', margin: 0,
              textShadow: '0 2px 24px rgba(0,0,0,0.4)',
            }}>
              {/* On photos, entity marks use goldSoft — dark gold is illegible */}
              <Markup raw={display.title} emColor={TP.goldSoft} strongColor="#fff" strongWeight={800} />
            </h2>
            {display.lede ? (
              <p style={{
                fontFamily: FONT_BODY, fontSize: 14.7, lineHeight: 1.45,
                color: 'rgba(255,255,255,0.82)', maxWidth: '50ch', margin: '8px 0 0',
              }}>{display.lede}</p>
            ) : null}
          </div>
        </ParallaxImage>
      </div>

      {display.stats?.length ? (
        <div style={{ marginTop: 18 }}>
          <StatsRow stats={display.stats} accent={accent} cardKey={`c${story.id}`} />
        </div>
      ) : null}
      <div style={{ marginTop: 14 }}>
        <CardFooter story={story} tags={display.tags} onOpen={onOpen} />
      </div>
    </article>
  );
}

// ── 5.2 CLASSIC — photo top, text below ─────────────────────────────────────

export function ClassicCard({ story, display, accent, onOpen }) {
  return (
    <article>
      <div {...clickable(onOpen, story)}>
        <ParallaxImage src={display.imageURL || story.urlToImage} aspectRatio="16 / 10" borderRadius={22}>
          <span style={{
            position: 'absolute', top: 12, left: 12,
            fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 500,
            letterSpacing: '0.18em', textTransform: 'uppercase', color: '#fff',
            background: `color-mix(in srgb, ${accent} 85%, black)`,
            borderRadius: 99, padding: '7px 11px',
          }}>{display.category}</span>
        </ParallaxImage>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 16 }}>
          <div style={{ flex: 1 }}>
            <Headline raw={display.title} accent={accent} size={24} />
          </div>
          <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: TP.ink3, flexShrink: 0 }}>
            {ageLabel(story.publishedAt)}
          </span>
        </div>

        <div style={{ marginTop: 14 }}>
          <Bullets bullets={display.bullets} accent={accent} />
        </div>
      </div>

      {display.stats?.length ? (
        <div style={{ marginTop: 18 }}>
          <StatsRow stats={display.stats} accent={accent} cardKey={`c${story.id}`} />
        </div>
      ) : null}
      <div style={{ marginTop: 14 }}>
        <CardFooter story={story} tags={display.tags} onOpen={onOpen} />
      </div>
    </article>
  );
}

// ── 5.3 STAT-HERO — no photo, one giant number ──────────────────────────────

export function StatHeroCard({ story, display, accent, onOpen }) {
  const big = display.big || [0, '', '', ''];
  const [value, prefix, unit, caption] = big;
  return (
    <article style={{ borderTop: `3px solid ${accent}`, paddingTop: 18 }}>
      <div {...clickable(onOpen, story)}>
        <KickerRow category={display.category} accent={accent} story={story} />
        <div style={{ marginTop: 10 }}>
          <Headline raw={display.title} accent={accent} size={30} />
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 56, lineHeight: 0.95,
            letterSpacing: '-0.05em', color: accent,
          }}>
            <CountUp
              value={Number(value) || 0}
              prefix={prefix || ''}
              unit={unit || ''}
              unitStyle={{ fontSize: '0.42em' }}
              animKey={`big.${story.id}`}
            />
          </span>
          {caption ? (
            <span style={{ fontFamily: FONT_BODY, fontSize: 13.6, color: TP.ink2, maxWidth: '24ch', lineHeight: 1.4 }}>
              {caption}
            </span>
          ) : null}
        </div>

        <div style={{ marginTop: 16 }}>
          <Bullets bullets={display.bullets} accent={accent} max={2} />
        </div>
      </div>
      {/* NO stats row — the big number replaces it (§5.3) */}
      <div style={{ marginTop: 14 }}>
        <CardFooter story={story} tags={display.tags} onOpen={onOpen} />
      </div>
    </article>
  );
}

// ── 5.4 QUOTE — pull-quote led ──────────────────────────────────────────────

export function QuoteCard({ story, display, accent, onOpen }) {
  const quote = display.quote || { text: '', who: '' };
  const [name, ...roleParts] = (quote.who || '').split(' · ');
  return (
    <article>
      <div {...clickable(onOpen, story)}>
        <KickerRow category={display.category} accent={accent} story={story} />

        <div aria-hidden style={{
          fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 86, lineHeight: 1,
          color: accent, height: 34, overflow: 'hidden', marginTop: 14,
        }}>“</div>

        <blockquote style={{
          fontFamily: FONT_HEAD, fontWeight: 700, fontStyle: 'italic',
          fontSize: 26, lineHeight: 1.2, letterSpacing: '-0.03em',
          color: TP.ink, margin: '6px 0 0',
        }}>
          <Markup raw={quote.text} emColor={accent} strongColor={TP.ink} strongWeight={700} />
        </blockquote>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
          <span style={{ width: 26, height: 1.5, background: accent, flexShrink: 0 }} />
          <span style={{
            fontFamily: FONT_MONO, fontSize: 10, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: TP.ink3,
          }}>
            <span style={{ color: TP.ink2 }}>{name}</span>
            {roleParts.length ? ` · ${roleParts.join(' · ')}` : ''}
          </span>
        </div>

        {/* Headline as subhead — quote owns the color, emphasis inverts (§5.4) */}
        <h3 style={{
          fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 17, lineHeight: 1.3,
          letterSpacing: '-0.02em', color: TP.ink2, margin: '18px 0 0',
        }}>
          <Markup raw={display.title} emColor={TP.ink} strongColor={TP.ink} strongWeight={700} />
        </h3>

        <div style={{ marginTop: 14 }}>
          <Bullets bullets={display.bullets} accent={accent} max={2} />
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <CardFooter story={story} tags={display.tags} onOpen={onOpen} />
      </div>
    </article>
  );
}

// ── 5.5 VERSUS — two sides face off ─────────────────────────────────────────

export function VersusCard({ story, display, accent, onOpen }) {
  const versus = display.versus || { a: {}, b: {}, ratio: 0.5 };
  const reduced = useReducedMotion();
  const already = hasAnimated(`vsbar.${story.id}`);
  const [filled, setFilled] = useState(already || reduced);
  const barRef = useVisibleOnce(0.5, () => {
    shouldAnimateOnce(`vsbar.${story.id}`);
    setTimeout(() => setFilled(true), 150);
  });

  const side = (s, key) => (
    <div key={key} style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
      <div style={{
        fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 38, lineHeight: 1,
        letterSpacing: '-0.04em', color: TP.ink,
      }}>
        <CountUp
          value={Number(s?.val) || 0}
          unit={s?.unit || ''}
          unitStyle={{ fontSize: '0.45em', color: accent }}
          animKey={`vs.${story.id}.${key}`}
        />
      </div>
      <div style={{
        fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: TP.ink3, marginTop: 6,
      }}>{s?.who || ''}</div>
    </div>
  );

  const ratio = Math.min(0.95, Math.max(0.05, Number(versus.ratio) || 0.5));

  return (
    <article>
      <div {...clickable(onOpen, story)}>
        <KickerRow category={display.category} accent={accent} story={story} />
        <div style={{ marginTop: 10 }}>
          <Headline raw={display.title} accent={accent} size={24} />
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 20 }}>
          {side(versus.a, 'a')}
          <div style={{
            width: 40, height: 40, borderRadius: '50%', border: `1.5px solid ${accent}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 12.5, color: accent,
          }}>VS</div>
          {side(versus.b, 'b')}
        </div>

        <div ref={barRef} style={{
          height: 6, borderRadius: 99, background: TP.line,
          marginTop: 18, overflow: 'hidden', display: 'flex',
        }}>
          <div style={{
            width: `${ratio * 100}%`,
            transform: filled ? 'scaleX(1)' : 'scaleX(0)',
            transformOrigin: 'left',
            transition: reduced ? 'none' : 'transform 1s cubic-bezier(.2,.7,.2,1)',
            background: accent, borderRadius: 99,
          }} />
          <div style={{ flex: 1, background: `color-mix(in srgb, ${accent} 30%, white)`, borderRadius: 99 }} />
        </div>

        {versus.note ? (
          <div style={{ marginTop: 14 }}>
            <Bullets bullets={[versus.note]} accent={accent} max={1} />
          </div>
        ) : null}
      </div>
      <div style={{ marginTop: 14 }}>
        <CardFooter story={story} tags={display.tags} onOpen={onOpen} />
      </div>
    </article>
  );
}

// ── 5.6 TIMELINE — developing story ─────────────────────────────────────────

export function TimelineCard({ story, display, accent, onOpen }) {
  const entries = display.timeline || [];
  return (
    <article>
      <div {...clickable(onOpen, story)}>
        <KickerRow category={display.category} accent={accent} story={story} prefix="DEVELOPING" />
        <div style={{ marginTop: 10 }}>
          <Headline raw={display.title} accent={accent} size={24} />
        </div>

        <div style={{ position: 'relative', marginTop: 20 }}>
          <span style={{ position: 'absolute', left: 5, top: 6, bottom: 6, width: 1.5, background: TP.line }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {entries.map((entry, i) => {
              const [date, text] = Array.isArray(entry) ? entry : [entry?.date, entry?.text];
              return (
                <div key={i} style={{ position: 'relative', paddingLeft: 24 }}>
                  <span style={{
                    position: 'absolute', left: 0, top: 2, width: 11, height: 11,
                    borderRadius: '50%', border: `2px solid ${accent}`,
                    background: i === 0 ? accent : TP.bg, boxSizing: 'border-box',
                  }} />
                  <div style={{
                    fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 500,
                    letterSpacing: '0.12em', textTransform: 'uppercase', color: accent,
                  }}>{date}</div>
                  <div style={{ fontFamily: FONT_BODY, fontSize: 14.7, lineHeight: 1.5, color: TP.ink2, marginTop: 4 }}>
                    <Markup raw={text || ''} emColor={accent} strongColor={TP.ink} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <CardFooter story={story} tags={display.tags} onOpen={onOpen} />
      </div>
    </article>
  );
}

// ── 5.7 SPLIT — compact, square thumb left ──────────────────────────────────

export function SplitCard({ story, display, accent, onOpen }) {
  const firstBullet = display.bullets?.[0];
  return (
    <article>
      <div {...clickable(onOpen, story)} style={{ display: 'flex', gap: 16, cursor: 'pointer' }}>
        <img
          src={display.imageURL || story.urlToImage}
          alt=""
          loading="lazy"
          style={{
            width: 116, height: 116, objectFit: 'cover', borderRadius: 16,
            flexShrink: 0, background: TP.line,
          }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <KickerRow category={display.category} accent={accent} story={story} />
          <h2 style={{
            fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 18, lineHeight: 1.2,
            letterSpacing: '-0.03em', color: TP.ink, margin: '7px 0 0',
          }}>
            <Markup raw={display.title} emColor={accent} strongColor={TP.ink} strongWeight={800} />
          </h2>
          {firstBullet ? (
            <p style={{
              fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.5, color: TP.ink2,
              margin: '7px 0 0', display: '-webkit-box', WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              <Markup raw={firstBullet} emColor={accent} strongColor={TP.ink} />
            </p>
          ) : null}
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
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
  const chartRef = useVisibleOnce(0.5, () => {
    shouldAnimateOnce(`chart.${story.id}`);
    setGrown(true);
  });

  const vals = trend.vals || [];
  const maxVal = Math.max(...vals, 0.0001);
  const lastIdx = vals.length - 1;

  return (
    <article>
      <div {...clickable(onOpen, story)}>
        <KickerRow category={display.category} accent={accent} story={story} />
        <div style={{ marginTop: 10 }}>
          <Headline raw={display.title} accent={accent} size={24} />
        </div>

        <div ref={chartRef} style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 142 }}>
            {vals.map((v, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'stretch', height: '100%' }}>
                <div style={{
                  textAlign: 'center', fontFamily: FONT_MONO, fontSize: 9,
                  fontWeight: i === lastIdx ? 500 : 400,
                  color: i === lastIdx ? accent : TP.ink3, marginBottom: 4,
                }}>{formatNumber(v)}</div>
                <div style={{
                  height: Math.max(6, (120 * v) / maxVal),
                  borderRadius: '6px 6px 2px 2px',
                  background: i === lastIdx ? accent : `color-mix(in srgb, ${accent} 22%, white)`,
                  transform: grown ? 'scaleY(1)' : 'scaleY(0.001)',
                  transformOrigin: 'bottom',
                  transition: reduced || already ? 'none' : `transform 0.8s ease-out ${i * 0.08}s`,
                }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            {(trend.labels || []).map((label, i) => (
              <div key={i} style={{
                flex: 1, textAlign: 'center', fontFamily: FONT_MONO, fontSize: 9, color: TP.ink3,
              }}>{label}</div>
            ))}
          </div>
        </div>

        {trend.caption ? (
          <p style={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.5, color: TP.ink2, margin: '14px 0 0' }}>
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
