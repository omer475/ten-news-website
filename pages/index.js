import { useCallback, useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { TYPE, inkFor, accentFor, bandIsDark, exportPoster, paintFallback } from '../lib/poster';

/**
 * TODAY — the daily edition.
 *
 * Ten stories, one screen each. Every screen is a commissioned illustration
 * with the cover type set over it. Tap a poster to read the story.
 *
 * The type ratios come from lib/poster.js so the page and the saved PNG agree.
 * Each poster frame publishes its own pixel width as --pw, and every type size
 * is a fraction of it — exactly as the export canvas measures them.
 */

const LONG_DATE = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { ...LONG_DATE, timeZone: 'UTC' });
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function ago(hours) {
  if (hours == null) return '';
  if (hours < 1) return 'less than an hour ago';
  const h = Math.round(hours);
  return h === 1 ? '1 hour ago' : `${h} hours ago`;
}

function spaced(text) {
  return String(text || '').toUpperCase().split('').join(' ');
}

export default function Today() {
  const [edition, setEdition] = useState(null);
  const [status, setStatus] = useState('loading');
  const [openIndex, setOpenIndex] = useState(null);
  const [saved, setSaved] = useState({});
  const [active, setActive] = useState(0);

  const frameRefs = useRef([]);
  const fallbackRefs = useRef([]);
  const sectionRefs = useRef([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/edition')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (cancelled) return;
        setEdition(data);
        setStatus('ready');
      })
      .catch(() => !cancelled && setStatus('empty'));
    return () => { cancelled = true; };
  }, []);

  const stories = edition?.stories || [];

  /* Publish each frame's own width, so type scales off the poster, not the page. */
  const measure = useCallback(() => {
    frameRefs.current.forEach((frame) => {
      if (!frame) return;
      const rect = frame.getBoundingClientRect();
      frame.style.setProperty('--pw', `${rect.width}px`);
      frame.style.setProperty('--ph', `${rect.height}px`);
      // The paragraph hangs off the bottom of a headline whose height depends
      // on how many lines it wrapped to, so it has to be measured, not assumed.
      const title = frame.querySelector('.title');
      const standfirst = frame.querySelector('.standfirst');
      if (title && standfirst) {
        const t = title.getBoundingClientRect();
        standfirst.style.top = `${t.bottom - rect.top + rect.width * 0.026}px`;
      }
    });
    stories.forEach((story, i) => {
      if (!story.art?.image_url) paintFallback(fallbackRefs.current[i], story, edition);
    });
  }, [stories, edition]);

  useEffect(() => {
    if (status !== 'ready') return undefined;
    measure();
    let raf = null;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [status, measure]);

  useEffect(() => {
    if (status !== 'ready') return undefined;
    const nodes = sectionRefs.current.filter(Boolean);
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(nodes.indexOf(e.target))),
      { threshold: 0.6 },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [status, stories.length]);

  const savePoster = async (i) => {
    setSaved((s) => ({ ...s, [i]: 'working' }));
    try {
      await exportPoster(
        stories[i],
        edition,
        `today-${edition.date}-${String(i + 1).padStart(2, '0')}.png`,
      );
      setSaved((s) => ({ ...s, [i]: 'done' }));
    } catch {
      setSaved((s) => ({ ...s, [i]: null }));
    }
  };

  const saveAll = async () => {
    for (let i = 0; i < stories.length; i += 1) {
      await savePoster(i);
    }
  };

  const jumpTo = (i) => sectionRefs.current[i + 1]?.scrollIntoView({ behavior: 'smooth' });

  const head = (
    <Head>
      <title>{edition ? `Today — ${formatDate(edition.date)}` : 'Today'}</title>
      <meta
        name="viewport"
        content="width=device-width,initial-scale=1,viewport-fit=cover,maximum-scale=1"
      />
      <meta
        name="description"
        content="Ten stories, ten commissioned illustrations. Set once a day from the last 24 hours."
      />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Anton&family=Inter+Tight:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,700;0,900;1,700&display=swap"
        rel="stylesheet"
      />
    </Head>
  );

  if (status !== 'ready') {
    return (
      <>
        {head}
        <div className="splash">
          <h1>TODAY</h1>
          <p>
            {status === 'loading'
              ? 'Setting the edition…'
              : "Today's edition hasn't been set yet. It goes up once a day."}
          </p>
        </div>
        <style jsx global>{`html,body{margin:0;background:#111}`}</style>
        <style jsx>{`
          .splash {
            min-height: 100svh; display: flex; flex-direction: column; align-items: center;
            justify-content: center; gap: 14px; background: #111; color: #fff; padding: 32px;
            text-align: center; font-family: 'Inter Tight', system-ui, sans-serif;
          }
          h1 { font-family: Anton, Impact, sans-serif; font-size: 15vw; margin: 0; }
          p { color: #999; max-width: 30ch; line-height: 1.45; margin: 0; }
        `}</style>
      </>
    );
  }

  const footer = `TODAY · ${edition.date}${edition.issue ? ` · NO. ${edition.issue}` : ''}`;

  return (
    <>
      {head}

      <nav className={`dots ${openIndex != null ? 'hidden' : ''}`} aria-hidden="true">
        {Array.from({ length: stories.length + 2 }).map((_, i) => (
          <i key={i} className={i === active ? 'on' : ''} />
        ))}
      </nav>

      {/* ---------------------------------------------------------- front */}
      <section
        className="front"
        style={{ '--accent': accentFor(stories[0] || {}) }}
        ref={(el) => { sectionRefs.current[0] = el; }}
      >
        <header className="mast">
          <h1>Today</h1>
          <div className="mastMeta">
            <span className="mastDate">{formatDate(edition.date)}</span>
            <span className="mastIssue">No. {edition.issue}</span>
          </div>
        </header>

        <div className="strap">
          <span>Ten stories, ten illustrations</span>
          <span>{edition.window_hours || 24}h of the wire</span>
        </div>

        {edition.sample ? (
          <div className="sample">
            Sample edition — placeholder copy, not news.
          </div>
        ) : null}

        <div className="mosaic">
          {stories.map((story, i) => (
            <button
              key={story.id || i}
              className={`tile ${i === 0 ? 'hero' : ''}`}
              onClick={() => jumpTo(i)}
              aria-label={story.cover?.title || story.headline}
            >
              {story.art?.image_url ? (
                <img src={story.art.image_url} alt="" loading={i < 4 ? 'eager' : 'lazy'} />
              ) : (
                <span className="tileFallback" />
              )}
              <span className="num">{String(i + 1).padStart(2, '0')}</span>
              {story.art?.video_url ? <span className="moves" aria-hidden="true" /> : null}
              {i === 0 ? (
                <span className="heroCap">
                  <em>{story.tag}</em>
                  <b>{story.cover?.title || story.headline}</b>
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="frontFoot">
          <span className="cue">Tap a cover, or swipe up ↑</span>
        </div>
      </section>

      {/* --------------------------------------------------------- posters */}
      {stories.map((story, i) => {
        // Inks are measured off each illustration, so no two pages read alike.
        const topInk = inkFor(story, 'top');
        const bottomInk = inkFor(story, 'bottom');
        const frameVars = {
          '--ink-top': topInk,
          '--ink-bottom': bottomInk,
          '--accent': accentFor(story),
          '--scrim-top': bandIsDark(story, 'top') ? '0,0,0' : '255,255,255',
          '--scrim-bottom': bandIsDark(story, 'bottom') ? '0,0,0' : '255,255,255',
        };
        return (
          <section
            key={story.id || i}
            className={`poster ${openIndex === i ? 'open' : ''}`}
            style={{ background: story.art?.tint || '#111' }}
            ref={(el) => { sectionRefs.current[i + 1] = el; }}
          >
            <div
              className="frame"
              style={frameVars}
              ref={(el) => { frameRefs.current[i] = el; }}
              role="button"
              tabIndex={0}
              onClick={(e) => { if (!e.target.closest('.save')) setOpenIndex(i); }}
              onKeyDown={(e) => e.key === 'Enter' && setOpenIndex(i)}
            >
              {story.art?.video_url ? (
                <video
                  className="artwork"
                  src={story.art.video_url}
                  poster={story.art.image_url}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload={i < 3 ? 'auto' : 'metadata'}
                />
              ) : story.art?.image_url ? (
                <img className="artwork drift" src={story.art.image_url} alt={story.art?.concept || ''} />
              ) : (
                <canvas className="artwork" ref={(el) => { fallbackRefs.current[i] = el; }} />
              )}

              <div className="scrimTop" />
              <div className="scrimBottom" />

              <div className="kicker">{spaced(story.tag)}</div>
              <h2 className="title">{story.cover?.title || story.headline}</h2>
              <p className="standfirst">{story.cover?.standfirst || story.dek}</p>
              <div className="colophon">{footer}</div>

              <button
                className={`save ${saved[i] === 'done' ? 'done' : ''}`}
                onClick={() => savePoster(i)}
              >
                {saved[i] === 'done' ? 'Saved' : saved[i] === 'working' ? 'Saving…' : 'Save poster'}
              </button>
              <div className="read">Read ↑</div>
            </div>

            <article
              className="story"
              role="button"
              tabIndex={-1}
              onClick={(e) => { if (!e.target.closest('a')) setOpenIndex(null); }}
            >
              <div className="storyKicker">{story.tag}</div>
              <h2>{story.headline}</h2>

              <div className="by">
                {story.dateline}
                {story.age_hours != null ? ` · ${ago(story.age_hours)}` : ''}
                {story.source_count > 1 ? ` · ${story.source_count} outlets` : ''}
              </div>

              {story.photo?.url ? (
                <figure className="photo">
                  <img src={story.photo.url} alt="" loading="lazy" />
                  {story.url ? (
                    <figcaption>
                      <a href={story.url} target="_blank" rel="noreferrer">
                        {hostOf(story.url)}
                      </a>
                    </figcaption>
                  ) : null}
                </figure>
              ) : null}

              {(story.paragraphs || []).map((para, k) => (
                <p key={k}>{para}</p>
              ))}

              {story.url ? (
                <a className="readAt" href={story.url} target="_blank" rel="noreferrer">
                  Read it at {hostOf(story.url)} →
                </a>
              ) : null}

              <div className="close">Tap anywhere to close</div>
            </article>
          </section>
        );
      })}

      {/* ------------------------------------------------------------ end */}
      <section className="end" ref={(el) => { sectionRefs.current[stories.length + 1] = el; }}>
        <h2>That&apos;s today.</h2>
        <p>
          Nothing below this. Ten new illustrations tomorrow morning — today&apos;s
          aren&apos;t printed again.
        </p>
        <button className="btn" onClick={saveAll}>Save all {stories.length} posters</button>
        <div className="colophon">
          {edition.articles_seen} stories read from {edition.feeds_read} feeds in the
          last {edition.window_hours}h · ten kept
          {edition.illustrated != null ? ` · ${edition.illustrated} illustrated` : ''}
        </div>
      </section>

      <style jsx global>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
          background: #111; color: #fff;
          font-family: 'Inter Tight', -apple-system, system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        html { scroll-snap-type: y mandatory; scroll-behavior: smooth; }
        button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer;
                 -webkit-tap-highlight-color: transparent; }
        a { color: inherit; }
      `}</style>

      <style jsx>{`
        section { height: 100svh; scroll-snap-align: start; position: relative; overflow: hidden; }

        .dots {
          position: fixed; right: 12px; top: 50%; transform: translateY(-50%);
          display: flex; flex-direction: column; gap: 6px; z-index: 9;
        }
        .dots i {
          width: 4px; height: 16px; border-radius: 3px; background: #fff; opacity: .25;
          transition: opacity .3s; mix-blend-mode: difference;
        }
        .dots i.on { opacity: 1; }
        .dots.hidden { opacity: 0; pointer-events: none; }

        /* ---------------------------------------------------------- front */
        .front {
          background: #f4f0e6; color: #14140f;
          padding: max(18px, env(safe-area-inset-top)) 18px calc(14px + env(safe-area-inset-bottom));
          display: flex; flex-direction: column; gap: 8px;
        }
        .mast {
          display: flex; justify-content: space-between; align-items: flex-end;
          border-bottom: 4px solid #14140f; padding-bottom: 2px;
        }
        .mast h1 {
          font-family: 'Playfair Display', Georgia, serif; font-weight: 900;
          font-size: clamp(52px, 19vw, 132px); line-height: .84;
          letter-spacing: -.045em; margin: 0;
        }
        .mastMeta { text-align: right; line-height: 1.15; padding-bottom: 6px; }
        .mastDate { display: block; font-size: 11px; font-weight: 600; letter-spacing: .01em; }
        .mastIssue {
          display: block; font-size: 11px; font-weight: 700; color: var(--accent);
          letter-spacing: .08em;
        }
        .strap {
          display: flex; justify-content: space-between; font-size: 10.5px;
          font-weight: 600; text-transform: uppercase; letter-spacing: .09em;
          padding-bottom: 2px; border-bottom: 1px solid rgba(20,20,15,.25);
        }
        .sample {
          padding: 6px 8px; border: 1px solid #14140f; background: #ffe9a8;
          font-size: 10.5px; font-weight: 700; line-height: 1.3;
        }

        .mosaic {
          flex: 1; min-height: 0; display: grid; gap: 5px;
          grid-template-columns: repeat(3, 1fr);
          grid-template-rows: 1.35fr 1.35fr repeat(3, 1fr);
        }
        .tile {
          position: relative; overflow: hidden; padding: 0; background: #ddd8cc;
          border-radius: 10px;
        }
        .tile.hero { grid-column: 1 / -1; grid-row: 1 / 3; border-radius: 14px; }
        .tile img, .tileFallback {
          position: absolute; inset: 0; width: 100%; height: 100%;
          object-fit: cover; display: block;
        }
        .tile.hero img { object-position: center 28%; }
        .tileFallback { background: #1b1b1b; }
        .num {
          position: absolute; left: 5px; top: 3px; z-index: 2;
          font-size: 10px; font-weight: 800; letter-spacing: .04em;
          color: #fff; mix-blend-mode: difference;
        }
        .moves {
          position: absolute; right: 6px; top: 6px; z-index: 2;
          width: 6px; height: 6px; border-radius: 50%; background: #fff;
          box-shadow: 0 0 0 2px rgba(0,0,0,.25);
          animation: pulse 2.4s ease-in-out infinite;
        }
        @keyframes pulse { 0%,100% { opacity: .35 } 50% { opacity: 1 } }
        .heroCap {
          position: absolute; left: 0; right: 0; bottom: 0; z-index: 2;
          padding: 26px 12px 10px; text-align: left;
          background: linear-gradient(rgba(0,0,0,0), rgba(0,0,0,.72));
          color: #fff;
        }
        .heroCap em {
          display: block; font-style: normal; font-weight: 800; font-size: 9.5px;
          letter-spacing: .14em; color: var(--accent); margin-bottom: 3px;
        }
        .heroCap b {
          display: block; font-family: 'Playfair Display', Georgia, serif;
          font-weight: 900; font-size: clamp(17px, 5.2vw, 26px); line-height: 1.08;
          letter-spacing: -.01em;
        }
        .frontFoot { display: flex; justify-content: center; padding-top: 2px; }
        .cue {
          font-size: 10.5px; font-weight: 600; letter-spacing: .09em;
          text-transform: uppercase; opacity: .55;
        }

        /* --------------------------------------------------------- poster */
        .frame {
          position: relative; height: 100%; width: 100%; max-width: calc(100svh * 9 / 16);
          margin: 0 auto; overflow: hidden; cursor: pointer;
        }
        .artwork { position: absolute; inset: 0; width: 100%; height: 100%;
                   object-fit: cover; display: block; }
        /* Stills breathe rather than sit dead. Slow enough to read as a print
           being looked at, not as an effect. */
        .drift { animation: drift 26s ease-in-out infinite alternate; will-change: transform; }
        @keyframes drift {
          from { transform: scale(1) translate3d(0, 0, 0); }
          to   { transform: scale(1.045) translate3d(0, -0.6%, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .drift { animation: none; }
        }
        .scrimTop {
          position: absolute; left: 0; right: 0; top: 0; height: ${TYPE.scrimTop * 100}%;
          background: linear-gradient(rgba(var(--scrim-top), ${TYPE.scrimTopAlpha}),
                                      rgba(var(--scrim-top), 0));
        }
        .scrimBottom {
          position: absolute; left: 0; right: 0; bottom: 0; height: ${TYPE.scrim * 100}%;
          background: linear-gradient(rgba(var(--scrim-bottom), 0),
                                      rgba(var(--scrim-bottom), ${TYPE.scrimAlpha}));
        }

        .kicker, .title, .standfirst, .colophon {
          position: absolute; left: ${TYPE.margin * 100}%;
          width: ${(1 - TYPE.margin * 2) * 100}%;
          pointer-events: none; margin: 0;
        }
        .kicker {
          top: calc(var(--ph) * ${TYPE.kickerY}); transform: translateY(-100%);
          color: var(--accent);
          font-weight: 700; font-size: calc(var(--pw) * 0.028); letter-spacing: .02em;
        }
        .title {
          top: calc(var(--ph) * ${TYPE.titleTop}); transform: translateY(-0.78em);
          color: var(--ink-bottom);
          font-family: Anton, Impact, 'Arial Narrow', sans-serif; font-weight: 400;
          font-size: calc(var(--pw) * ${TYPE.titleSize});
          line-height: ${TYPE.titleLead}; letter-spacing: .002em;
          text-transform: uppercase; text-wrap: balance;
        }
        .standfirst {
          top: calc(var(--ph) * ${TYPE.titleTop} + var(--pw) * ${TYPE.footGap} + 1.05em);
          color: var(--ink-bottom); opacity: .9;
          font-weight: 500; font-size: calc(var(--pw) * ${TYPE.footSize});
          line-height: ${TYPE.footLead};
        }
        .colophon {
          top: calc(var(--ph) * ${TYPE.colophonY}); transform: translateY(-100%);
          color: var(--ink-bottom); opacity: .55;
          font-weight: 500; font-size: calc(var(--pw) * ${TYPE.colophonSize});
          letter-spacing: .06em;
        }

        .save {
          position: absolute; top: calc(14px + env(safe-area-inset-top)); right: 14px; z-index: 3;
          padding: 9px 14px; border-radius: 999px; font-size: 12px; font-weight: 600;
          background: rgba(0,0,0,.32); color: #fff; backdrop-filter: blur(8px);
        }
        .save.done { background: #fff; color: #000; }
        .read {
          position: absolute; bottom: calc(18px + env(safe-area-inset-bottom)); right: 16px; z-index: 3;
          padding: 10px 16px; border-radius: 999px; font-size: 13px; font-weight: 700;
          background: rgba(255,255,255,.92); color: #000; pointer-events: none;
          box-shadow: 0 6px 20px rgba(0,0,0,.25);
        }

        /* ---------------------------------------------------------- story */
        .story {
          position: absolute; inset: 0; z-index: 4;
          transform: translateY(100%); transition: transform .45s cubic-bezier(.2,.8,.2,1);
          background: #faf8f3; color: #14140f;
          overflow-y: auto; -webkit-overflow-scrolling: touch; cursor: pointer;
          padding: max(28px, env(safe-area-inset-top)) 22px calc(40px + env(safe-area-inset-bottom));
          font-family: 'Inter Tight', system-ui, sans-serif;
        }
        .poster.open .story { transform: none; }
        .storyKicker {
          font-size: 11px; font-weight: 700; letter-spacing: .14em;
          text-transform: uppercase; color: #9a9689;
        }
        .story h2 {
          font-family: Anton, Impact, 'Arial Narrow', sans-serif; font-weight: 400;
          font-size: clamp(28px, 8vw, 44px); line-height: .98; margin-top: 10px;
          text-transform: uppercase; letter-spacing: .004em;
        }
        .by {
          margin-top: 12px; font-size: 11px; color: #9a9689;
          text-transform: uppercase; letter-spacing: .07em;
        }
        .photo { margin: 22px 0 4px; }
        .photo img {
          width: 100%; display: block; border-radius: 14px; background: #eeebe3;
        }
        .photo figcaption {
          margin-top: 7px; font-size: 11px; color: #9a9689;
          text-transform: uppercase; letter-spacing: .06em;
        }
        .photo figcaption a { color: #9a9689; text-decoration: underline; }
        .story p {
          margin-top: 18px; font-size: 17px; line-height: 1.62; color: #232019;
          max-width: 34em;
        }
        .readAt {
          display: inline-block; margin-top: 26px; font-size: 13px; font-weight: 700;
          letter-spacing: .02em; color: #14140f;
          border-bottom: 2px solid var(--accent, #14140f); padding-bottom: 2px;
        }
        .close {
          margin-top: 34px; font-size: 10.5px; letter-spacing: .12em;
          text-transform: uppercase; color: #bdb8ab;
        }

        /* ------------------------------------------------------------ end */
        .end { background: #111; display: flex; flex-direction: column; justify-content: center; padding: 28px; }
        .end h2 {
          font-family: Anton, Impact, sans-serif; font-weight: 400;
          font-size: clamp(44px, 14vw, 130px); text-transform: uppercase; line-height: .92;
        }
        .end p { margin-top: 16px; color: #aaa; font-size: 16px; line-height: 1.45; max-width: 34ch; }
        .btn {
          margin-top: 26px; padding: 16px 22px; border-radius: 999px; background: #fff;
          color: #000; font-weight: 700; font-size: 15px; align-self: flex-start;
        }
        .colophon { margin-top: 22px; color: #555; font-size: 11.5px; line-height: 1.5; }

        /* The news page covers the whole screen — the poster behind it and the
           letterboxing beside it both disappear. Text still measures sensibly. */
        .story > * { max-width: 640px; margin-left: auto; margin-right: auto; }
        .story h2, .story .storyKicker, .story .by { max-width: 640px; }
      `}</style>
    </>
  );
}
