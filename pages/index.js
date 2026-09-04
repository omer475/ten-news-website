import { useCallback, useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { TYPE, exportPoster, paintFallback } from '../lib/poster';

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

      <nav className="dots" aria-hidden="true">
        {Array.from({ length: stories.length + 2 }).map((_, i) => (
          <i key={i} className={i === active ? 'on' : ''} />
        ))}
      </nav>

      {/* ---------------------------------------------------------- front */}
      <section className="front" ref={(el) => { sectionRefs.current[0] = el; }}>
        <header className="mast">
          <h1>Today</h1>
          <span>{formatDate(edition.date)}<br />No. {edition.issue}</span>
        </header>

        <div className="rule">
          <span>Ten stories, ten illustrations</span>
          <span>{edition.window_hours || 24}h of the wire</span>
        </div>

        {edition.sample ? (
          <div className="sample">
            Sample edition — placeholder copy, not news. The first real edition is
            set on the next daily run.
          </div>
        ) : null}

        <div className="grid">
          {stories.map((story, i) => (
            <button key={story.id || i} className="cell" onClick={() => jumpTo(i)} aria-label={story.headline}>
              {story.art?.image_url ? (
                <img src={story.art.image_url} alt="" loading="lazy" />
              ) : (
                <span className="cellFallback" />
              )}
              <b>{i + 1}</b>
            </button>
          ))}
        </div>

        <ol className="contents">
          {stories.map((story, i) => (
            <li key={story.id || i}>
              <button onClick={() => jumpTo(i)}>
                <em>{story.tag}</em>
                {story.headline}
              </button>
            </li>
          ))}
        </ol>
      </section>

      {/* --------------------------------------------------------- posters */}
      {stories.map((story, i) => {
        // No illustration means the dark fallback ground, which always takes light type.
        const light = !story.art?.image_url || story.art.overlay !== 'dark';
        return (
          <section
            key={story.id || i}
            className={`poster ${openIndex === i ? 'open' : ''}`}
            style={{ background: story.art?.tint || '#111' }}
            ref={(el) => { sectionRefs.current[i + 1] = el; }}
          >
            <div
              className={`frame ${light ? 'light' : 'dark'}`}
              ref={(el) => { frameRefs.current[i] = el; }}
              role="button"
              tabIndex={0}
              onClick={(e) => { if (!e.target.closest('.save')) setOpenIndex(i); }}
              onKeyDown={(e) => e.key === 'Enter' && setOpenIndex(i)}
            >
              {story.art?.image_url ? (
                <img className="artwork" src={story.art.image_url} alt={story.art?.concept || ''} />
              ) : (
                <canvas className="artwork" ref={(el) => { fallbackRefs.current[i] = el; }} />
              )}

              <div className="scrimTop" />
              <div className="scrimBottom" />

              <div className="tag">{spaced(story.tag)}</div>
              {story.cover?.big ? (
                <>
                  <div className="big">{story.cover.big}</div>
                  <div className="bigLabel">{story.cover.bigLabel}</div>
                </>
              ) : null}
              <div className="hook">{story.cover?.hook || story.dek}</div>
              <div className="foot">{footer}</div>

              <button
                className={`save ${saved[i] === 'done' ? 'done' : ''}`}
                onClick={() => savePoster(i)}
              >
                {saved[i] === 'done' ? 'Saved' : saved[i] === 'working' ? 'Saving…' : 'Save poster'}
              </button>
              <div className="read">Read ↑</div>
            </div>

            <article className="story">
              <div className="top">
                <button className="back" onClick={() => setOpenIndex(null)}>← Poster</button>
                <span>{i + 1} of {stories.length}</span>
              </div>

              <div className="kicker">{story.tag}</div>
              <h2>{story.headline}</h2>
              {story.dek ? <p className="dek">{story.dek}</p> : null}

              <div className="by">
                {story.dateline}
                {story.age_hours != null ? ` · ${ago(story.age_hours)}` : ''}
                {story.source_count > 1 ? ` · ${story.source_count} outlets` : ''}
              </div>

              {(story.paragraphs || []).map((para, k) => (
                <p key={k} className={k === 0 ? 'drop' : ''}>{para}</p>
              ))}

              <div className="box">
                <div>
                  <b>What it changes</b>
                  <span>{story.changes}</span>
                </div>
                <div>
                  <b>What it doesn&apos;t</b>
                  <span>{story.unchanged}</span>
                </div>
              </div>

              <div className="src">
                {(story.sources || []).join(' · ')}
                {story.url ? (
                  <>
                    <br />
                    <a href={story.url} target="_blank" rel="noreferrer">
                      Read it at {hostOf(story.url)} →
                    </a>
                  </>
                ) : null}
                {story.art?.label ? <><br />Illustration: {story.art.label}</> : null}
              </div>
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

        /* ---------------------------------------------------------- front */
        .front {
          background: #f4f0e6; color: #111;
          padding: 22px 20px calc(20px + env(safe-area-inset-bottom));
          display: flex; flex-direction: column;
        }
        .mast { display: flex; justify-content: space-between; align-items: baseline;
                border-bottom: 3px solid #111; padding-bottom: 8px; }
        .mast h1 {
          font-family: 'Playfair Display', Georgia, serif; font-weight: 900;
          font-size: clamp(40px, 13vw, 92px); line-height: 1; letter-spacing: -.02em;
        }
        .mast span { font-size: 12px; font-weight: 600; text-align: right; line-height: 1.35; }
        .rule {
          display: flex; justify-content: space-between; font-size: 12px; font-weight: 500;
          border-bottom: 1px solid #111; padding: 6px 0;
        }
        .sample {
          margin-top: 8px; padding: 7px 9px; border: 1px solid #111; background: #ffe9a8;
          font-size: 11px; font-weight: 600; line-height: 1.35;
        }
        .grid {
          flex: 1; min-height: 0; display: grid; gap: 6px; margin-top: 10px;
          grid-template-columns: repeat(5, 1fr); grid-template-rows: repeat(2, 1fr);
        }
        .cell { position: relative; overflow: hidden; border-radius: 3px; padding: 0; background: #ddd; }
        .cell img, .cellFallback { position: absolute; inset: 0; width: 100%; height: 100%;
                                   object-fit: cover; display: block; }
        .cellFallback { background: #1b1b1b; }
        .cell b {
          position: absolute; left: 5px; top: 3px; font-size: 10px; font-weight: 700;
          color: #fff; mix-blend-mode: difference;
        }
        .contents { margin-top: 12px; list-style: none; font-size: 13px; line-height: 1.3;
                    max-height: 32svh; overflow-y: auto; }
        .contents li { border-bottom: 1px solid rgba(0,0,0,.12); }
        .contents button { display: block; width: 100%; text-align: left; padding: 7px 0; }
        .contents em {
          display: inline-block; font-style: normal; font-weight: 700; font-size: 10px;
          letter-spacing: .07em; margin-right: 7px; opacity: .55; min-width: 62px;
        }

        /* --------------------------------------------------------- poster */
        .frame {
          position: relative; height: 100%; width: 100%; max-width: calc(100svh * 9 / 16);
          margin: 0 auto; overflow: hidden; cursor: pointer;
          --ink: #fff; --scrim: 0,0,0;
        }
        .frame.dark { --ink: #111; --scrim: 255,255,255; }
        .artwork { position: absolute; inset: 0; width: 100%; height: 100%;
                   object-fit: cover; display: block; }
        .scrimTop {
          position: absolute; left: 0; right: 0; top: 0; height: ${TYPE.scrimTop * 100}%;
          background: linear-gradient(rgba(var(--scrim), ${TYPE.scrimTopAlpha}), rgba(var(--scrim), 0));
        }
        .scrimBottom {
          position: absolute; left: 0; right: 0; bottom: 0; height: ${TYPE.scrim * 100}%;
          background: linear-gradient(rgba(var(--scrim), 0), rgba(var(--scrim), ${TYPE.scrimAlpha}));
        }

        .tag, .big, .bigLabel, .hook, .foot {
          position: absolute; left: ${TYPE.margin * 100}%;
          width: ${(1 - TYPE.margin * 2) * 100}%;
          color: var(--ink); pointer-events: none;
        }
        .tag {
          top: calc(var(--ph) * ${TYPE.tagY}); transform: translateY(-100%);
          font-weight: 700; font-size: calc(var(--pw) * 0.03); letter-spacing: .02em;
        }
        .big {
          top: calc(var(--ph) * ${TYPE.bigY}); transform: translateY(-100%);
          font-family: Anton, Impact, sans-serif; line-height: .82;
          font-size: calc(var(--pw) * ${TYPE.bigSize});
          white-space: nowrap; overflow: hidden;
        }
        .bigLabel {
          top: calc(var(--ph) * ${TYPE.bigY} + var(--pw) * ${TYPE.labelGap});
          font-weight: 600; font-size: calc(var(--pw) * ${TYPE.labelSize});
          text-transform: uppercase; letter-spacing: .02em; opacity: .88;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .hook {
          bottom: calc(var(--ph) * ${TYPE.hookBottom} - var(--pw) * ${TYPE.hookSize} * 0.28);
          font-family: 'Playfair Display', Georgia, serif; font-weight: 700;
          font-size: calc(var(--pw) * ${TYPE.hookSize}); line-height: ${TYPE.hookLead};
          text-wrap: balance;
        }
        .foot {
          top: calc(var(--ph) * ${TYPE.footY}); transform: translateY(-100%);
          font-weight: 500; font-size: calc(var(--pw) * ${TYPE.footSize});
          letter-spacing: .06em; opacity: .7;
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
          transform: translateY(100%); transition: transform .5s cubic-bezier(.2,.8,.2,1);
          background: #f4f0e6; color: #111; border-radius: 20px 20px 0 0;
          overflow-y: auto; -webkit-overflow-scrolling: touch;
          padding: 20px 20px calc(48px + env(safe-area-inset-bottom));
          font-family: Georgia, 'Times New Roman', serif;
          box-shadow: 0 -20px 60px rgba(0,0,0,.35);
        }
        .poster.open .story { transform: none; }
        .story .top {
          display: flex; justify-content: space-between; align-items: center;
          font-family: 'Inter Tight', system-ui, sans-serif; font-size: 12px; font-weight: 600;
          border-bottom: 2px solid #111; padding-bottom: 8px;
        }
        .kicker {
          margin-top: 16px; font-family: 'Inter Tight', system-ui, sans-serif;
          font-size: 11px; font-weight: 700; letter-spacing: .09em;
        }
        .story h2 {
          font-family: 'Playfair Display', Georgia, serif; font-weight: 900;
          font-size: clamp(26px, 7vw, 42px); line-height: 1.05; margin-top: 8px;
          letter-spacing: -.01em;
        }
        .dek { margin-top: 12px; font-size: 16px; line-height: 1.4; color: #444; font-style: italic; }
        .by {
          margin-top: 14px; font-family: 'Inter Tight', system-ui, sans-serif; font-size: 11px;
          color: #777; border-top: 1px solid #ccc; border-bottom: 1px solid #ccc;
          padding: 8px 0; text-transform: uppercase; letter-spacing: .04em;
        }
        .story p { margin-top: 15px; font-size: 16.5px; line-height: 1.55; }
        .story p.drop::first-letter {
          font-family: 'Playfair Display', Georgia, serif; font-weight: 900;
          font-size: 3.1em; float: left; line-height: .85; padding: 4px 8px 0 0;
        }
        .box {
          margin-top: 22px; display: grid; gap: 12px; background: #fff; border: 1px solid #ddd;
          padding: 15px; border-radius: 4px; font-family: 'Inter Tight', system-ui, sans-serif;
        }
        .box b { display: block; font-size: 11px; letter-spacing: .07em;
                 text-transform: uppercase; margin-bottom: 4px; }
        .box span { font-size: 14.5px; line-height: 1.45; color: #333; }
        .src {
          margin-top: 18px; font-family: 'Inter Tight', system-ui, sans-serif;
          font-size: 11.5px; color: #888; line-height: 1.7;
        }
        .src a { color: #111; font-weight: 600; }

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

        @media (min-width: 700px) {
          .story { max-width: 720px; left: 50%; transform: translate(-50%, 100%); }
          .poster.open .story { transform: translate(-50%, 0); }
        }
      `}</style>
    </>
  );
}
