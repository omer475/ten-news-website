// pages/welcome.js — Today+ front door. Premium, product-led, fintech-grade.
import { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { createClient } from '../lib/supabase';
import Avatar, {
  AVATAR_COLORS, FACE_COUNT, ACCESSORY_COUNT, avatarFromSeed,
} from '../components/Avatar';
import { AuthPanel, EmailConfirmation, storeAvatar } from '../components/AuthForms';

/* tiny scroll-reveal hook */
function useReveal() {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setShown(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.18 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, shown];
}

function Reveal({ children, delay = 0, as: Tag = 'div', className = '', style = {} }) {
  const [ref, shown] = useReveal();
  return (
    <Tag ref={ref} className={`rv ${shown ? 'in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms`, ...style }}>
      {children}
    </Tag>
  );
}

const STREAK_AVATARS = [
  { color: 5, face: 5, accessory: 4 },
  { color: 0, face: 1, accessory: 2 },
  { color: 7, face: 3, accessory: 5 },
  { color: 3, face: 0, accessory: 3 },
  { color: 8, face: 2, accessory: 1 },
];

export default function Welcome() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState(null);
  const [authError, setAuthError] = useState('');
  const [emailSent, setEmailSent] = useState(null);
  const [hero, setHero] = useState(() => avatarFromSeed('reader'));
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try { const p = localStorage.getItem('todayplus_preferences'); if (p && JSON.parse(p).onboarding_completed) router.replace('/'); } catch {}
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [router]);

  const remix = () => setHero({
    color: (hero.color + 3) % AVATAR_COLORS.length,
    face: (hero.face + 1) % FACE_COUNT,
    accessory: (hero.accessory + 1) % ACCESSORY_COUNT,
  });

  /* ---- auth ---- */
  const routeAfterAuth = async (user) => {
    try {
      const p = localStorage.getItem('todayplus_preferences');
      if (p && JSON.parse(p).onboarding_completed) { router.push('/'); return; }
      if (user?.id) {
        const r = await fetch(`/api/user/preferences?auth_user_id=${user.id}`);
        if (r.ok) { const sp = await r.json();
          if (sp && sp.onboarding_completed) {
            localStorage.setItem('todayplus_preferences', JSON.stringify({
              home_country: sp.home_country, followed_countries: sp.followed_countries || [],
              followed_topics: sp.followed_topics || [], onboarding_completed: true, user_id: sp.id,
            }));
            router.push('/'); return;
          }
        }
      }
    } catch {}
    router.push('/onboarding');
  };
  const handleLogin = async (email, password) => {
    setAuthError('');
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('tennews_user', JSON.stringify(data.user));
        if (data.session) localStorage.setItem('tennews_session', JSON.stringify(data.session));
        await routeAfterAuth(data.user);
      } else setAuthError(data.message || 'Login failed. Please try again.');
    } catch { setAuthError('Login failed. Please check your connection.'); }
  };
  const handleSignup = async (email, password, fullName, avatar) => {
    setAuthError(''); if (avatar) storeAvatar(avatar);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const res = await fetch('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, fullName, timezone }) });
      const text = await res.text(); let data; try { data = JSON.parse(text); } catch { setAuthError('Server error. Please try again.'); return; }
      if (res.ok && data.success) { setAuthMode(null); setEmailSent({ email }); }
      else setAuthError(data.message || data.error || 'Signup failed. Please try again.');
    } catch { setAuthError('Signup failed. Please check your connection.'); }
  };
  const handleOAuthLogin = async (provider) => {
    setAuthError(''); const supabase = createClient(); if (!supabase) { setAuthError('Sign-in is not configured.'); return; }
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/auth/callback`, ...(provider === 'google' && { queryParams: { access_type: 'offline', prompt: 'consent' } }) } });
    if (error) setAuthError(error.message);
  };
  const handleMagicLink = async (email) => {
    setAuthError(''); const supabase = createClient(); if (!supabase) { setAuthError('Sign-in is not configured.'); throw new Error('no client'); }
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
    if (error) { setAuthError(error.message); throw error; }
  };
  const handleForgotPassword = async (email) => {
    setAuthError('');
    try { await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }); } catch {}
  };

  const openSignup = () => { setAuthError(''); setAuthMode('signup'); };
  const openLogin = () => { setAuthError(''); setAuthMode('login'); };
  const browse = () => router.push('/onboarding');
  const year = useMemo(() => 2026, []);

  return (
    <>
      <Head>
        <title>Today+ — Ten stories. Zero noise.</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="theme-color" content="#0B0A09" />
        <meta name="description" content="Today+ reads thousands of sources each morning and hands you the ten stories that matter — for your topics, your region, your five minutes." />
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
        <link href="https://api.fontshare.com/v2/css?f[]=clash-display@600,700&f[]=satoshi@400,500,700,900&display=swap" rel="stylesheet" />
      </Head>

      <main className="wrap">
        {/* NAV */}
        <header className={`nav ${scrolled ? 'on' : ''}`}>
          <div className="brand">today<span className="plus">+</span></div>
          <nav className="links">
            <a href="#how">How it works</a>
            <a href="#reader">Your reader</a>
          </nav>
          <div className="navcta">
            <button className="ln" onClick={openLogin}>Log in</button>
            <button className="pill" onClick={openSignup}>Get started</button>
          </div>
        </header>

        {/* HERO */}
        <section className="hero">
          <div className="glow g1" /><div className="glow g2" />
          <div className="hero-grid">
            <div className="hero-copy">
              <div className="eyebrow ld" style={{ animationDelay: '40ms' }}>● PERSONAL NEWS BRIEFING</div>
              <h1 className="display ld" style={{ animationDelay: '120ms' }}>
                Ten stories.<br /><span className="accent">Zero noise.</span>
              </h1>
              <p className="lead ld" style={{ animationDelay: '220ms' }}>
                Every morning, Today+ reads thousands of sources and hands you the ten that
                actually matter — for your topics, your region, your five minutes. With a reader
                that’s unmistakably yours.
              </p>
              <div className="hero-cta ld" style={{ animationDelay: '320ms' }}>
                <button className="btn-primary" onClick={openSignup}>Get started — free</button>
                <button className="btn-ghost" onClick={browse}>Browse the news</button>
              </div>
              <div className="hero-remix ld" style={{ animationDelay: '420ms' }}>
                <span className="rmx-label">Your reader</span>
                <button className="rmx-shuffle" onClick={remix} aria-label="Remix avatar">⟳ Remix</button>
                <div className="rmx-dots">
                  {AVATAR_COLORS.slice(0, 8).map((c, i) => (
                    <span key={c.id} className="rmx-dot" data-on={hero.color === i ? '1' : '0'}
                      style={{ background: `linear-gradient(135deg,${c.from},${c.to})` }}
                      onClick={() => setHero({ ...hero, color: i })} />
                  ))}
                </div>
              </div>
            </div>

            {/* PHONE MOCKUP */}
            <div className="phone-stage ld" style={{ animationDelay: '260ms' }}>
              <div className="phone">
                <div className="notch" />
                <div className="screen">
                  <div className="app-top">
                    <span className="app-brand">today<span className="plus">+</span></span>
                    <div className="app-top-right">
                      <span className="streakchip">🔥 7</span>
                      {mounted && <Avatar config={hero} size={30} />}
                    </div>
                  </div>

                  <div className="mustknow">
                    <span className="mk-dot" /> MUST KNOW
                  </div>

                  <div className="app-card">
                    <div className="card-img">
                      <span className="cat-pill">WORLD</span>
                    </div>
                    <div className="src"><span className="fav" /> Reuters · 2h ago</div>
                    <div className="head">Global markets steady as central banks signal a pause</div>
                    <div className="bul"><span className="bd" style={{ background: '#FF5C38' }} />Rate decision lands in line with forecasts</div>
                    <div className="bul"><span className="bd" style={{ background: '#3CC8B4' }} />Asian indices open higher on the news</div>
                    <div className="pills"><span>Markets</span><span>Economy</span></div>
                  </div>

                  <div className="app-card mini">
                    <div className="src"><span className="fav alt" /> The Verge · 4h ago</div>
                    <div className="head sm">New on-device AI model ships to millions of phones</div>
                  </div>
                </div>
              </div>
              <div className="phone-shadow" />
            </div>
          </div>
        </section>

        {/* STAT BAND */}
        <section className="stats">
          {[['10', 'stories a day'], ['5 min', 'to read them all'], ['0', 'doomscroll']].map(([n, l], i) => (
            <Reveal key={l} delay={i * 90} className="stat">
              <div className="stat-n display">{n}</div>
              <div className="stat-l">{l}</div>
            </Reveal>
          ))}
        </section>

        {/* HOW / FEATURES */}
        <section id="how" className="rows">
          <Reveal className="row">
            <div className="row-copy">
              <div className="kick">01 — TUNED TO YOU</div>
              <h2 className="h2 display">Set it up once. Sharper every day.</h2>
              <p className="p">Pick the topics and the places you care about. Today+ learns from what you read and quietly tunes your front page — no settings to babysit.</p>
            </div>
            <div className="row-visual">
              <div className="chips-card">
                {['Markets', 'AI', 'Geopolitics', 'Climate', 'Football', 'Space', 'Health', 'Tech'].map((t, i) => (
                  <span key={t} className={`chip ${i % 3 === 0 ? 'on' : ''}`}>{t}</span>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal className="row rev">
            <div className="row-copy">
              <div className="kick">02 — THE SIGNAL</div>
              <h2 className="h2 display">Thousands of sources in. Ten that matter out.</h2>
              <p className="p">Our pipeline reads the firehose so you don’t have to — ranking, de-duplicating and summarising until only the essential stories remain. No infinite scroll. No rage-bait.</p>
            </div>
            <div className="row-visual">
              <div className="funnel">
                <div className="f-top">1,000s of articles</div>
                <div className="f-bars">{[100, 78, 55, 34, 18, 8].map((w, i) => <span key={i} style={{ width: `${w}%`, opacity: 0.35 + i * 0.12 }} />)}</div>
                <div className="f-bot"><span className="ten">10</span> for you</div>
              </div>
            </div>
          </Reveal>

          <Reveal id="reader" className="row">
            <div className="row-copy">
              <div className="kick">03 — MAKE IT YOURS</div>
              <h2 className="h2 display">A reader that’s unmistakably you.</h2>
              <p className="p">Build a little avatar, keep a daily reading streak, save what matters. Small touches that turn “I should follow the news” into a habit you actually keep.</p>
              <button className="btn-primary sm" onClick={openSignup}>Create your reader</button>
            </div>
            <div className="row-visual">
              <div className="reader-card">
                <div className="reader-hero"><Avatar config={hero} size={108} ring /></div>
                <div className="reader-controls">
                  <button className="mini-btn" onClick={remix}>⟳ Remix</button>
                  <button className="mini-btn" onClick={() => setHero({ ...hero, accessory: (hero.accessory + 1) % ACCESSORY_COUNT })}>Style</button>
                </div>
                <div className="reader-row">
                  {STREAK_AVATARS.map((c, i) => <Avatar key={i} config={c} size={34} />)}
                </div>
                <div className="reader-streak">🔥 7-day streak</div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* CTA BAND */}
        <Reveal as="section" className="cta-band">
          <div className="cta-avs">
            {STREAK_AVATARS.map((c, i) => <div key={i} className="cta-av" style={{ marginLeft: i ? -16 : 0, zIndex: 9 - i }}><Avatar config={c} size={54} ring /></div>)}
          </div>
          <h2 className="cta-h display">Start your briefing.</h2>
          <p className="cta-p">Your front page is one tap away. Free, forever.</p>
          <button className="btn-primary big" onClick={openSignup}>Get started — free</button>
          <div className="cta-trust">No credit card · Sign in with Google or Apple · 5-minute mornings</div>
        </Reveal>

        {/* FOOTER */}
        <footer className="foot">
          <div className="foot-brand">today<span className="plus">+</span></div>
          <div className="foot-cols">
            <div><span className="fc-h">Product</span><a href="#how">How it works</a><a href="#reader">Your reader</a></div>
            <div><span className="fc-h">Account</span><button className="fl" onClick={openLogin}>Log in</button><button className="fl" onClick={openSignup}>Get started</button></div>
            <div><span className="fc-h">Legal</span><a href="/privacy">Privacy</a></div>
          </div>
          <div className="foot-c">© {year} Today+ · Printed fresh, every morning.</div>
        </footer>
      </main>

      {authMode && (
        <div className="overlay" onClick={() => setAuthMode(null)}>
          <AuthPanel mode={authMode} onModeChange={(m) => { setAuthError(''); setAuthMode(m); }}
            onLogin={handleLogin} onSignup={handleSignup} onOAuthLogin={handleOAuthLogin}
            onMagicLink={handleMagicLink} onForgotPassword={handleForgotPassword}
            error={authError} onClose={() => setAuthMode(null)} initialAvatar={hero} />
        </div>
      )}
      {emailSent && (
        <div className="overlay" onClick={() => setEmailSent(null)}>
          <EmailConfirmation email={emailSent.email} onBack={() => setEmailSent(null)} />
        </div>
      )}

      <style jsx>{`
        .wrap {
          --bg: #0B0A09; --surface: #16140F; --surface2: #1C1A14;
          --ink: #F4EFE6; --mut: #9A9488; --line: rgba(244,239,230,0.09);
          --accent: #FF5C38; --accent2: #FFB23E;
          font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif;
          background: var(--bg); color: var(--ink); min-height: 100vh; overflow-x: hidden;
          -webkit-font-smoothing: antialiased;
        }
        .display { font-family: 'Clash Display', 'Satoshi', sans-serif; font-weight: 600; }
        .plus { color: var(--accent); }
        .accent { color: var(--accent); }

        /* NAV */
        .nav { position: sticky; top: 0; z-index: 60; display: flex; align-items: center; justify-content: space-between;
          padding: 16px clamp(18px,5vw,64px); transition: background .3s, border-color .3s, backdrop-filter .3s; border-bottom: 1px solid transparent; }
        .nav.on { background: rgba(11,10,9,0.72); backdrop-filter: blur(16px) saturate(160%); border-bottom-color: var(--line); }
        .brand { font-family: 'Clash Display'; font-size: 23px; font-weight: 700; letter-spacing: -0.5px; }
        .links { display: flex; gap: 28px; }
        .links a { color: var(--mut); font-size: 14.5px; font-weight: 500; text-decoration: none; transition: color .2s; }
        .links a:hover { color: var(--ink); }
        .navcta { display: flex; gap: 8px; align-items: center; }
        .ln { background: none; border: none; color: var(--ink); font: inherit; font-weight: 600; font-size: 14.5px; cursor: pointer; padding: 9px 14px; border-radius: 12px; }
        .ln:hover { background: rgba(244,239,230,0.06); }
        .pill { background: var(--ink); color: #0B0A09; border: none; font: inherit; font-weight: 700; font-size: 14.5px; cursor: pointer; padding: 10px 20px; border-radius: 999px; transition: transform .14s, box-shadow .2s; }
        .pill:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(244,239,230,0.18); }

        /* HERO */
        .hero { position: relative; padding: clamp(40px,7vw,86px) clamp(18px,5vw,64px) clamp(40px,6vw,70px); overflow: hidden; }
        .glow { position: absolute; border-radius: 50%; filter: blur(110px); z-index: 0; pointer-events: none; }
        .g1 { width: 540px; height: 540px; background: rgba(255,92,56,0.20); top: -160px; right: -120px; }
        .g2 { width: 460px; height: 460px; background: rgba(255,178,62,0.10); bottom: -200px; left: -120px; }
        .hero-grid { position: relative; z-index: 2; max-width: 1180px; margin: 0 auto; display: grid; grid-template-columns: 1.05fr 0.95fr; gap: clamp(24px,5vw,60px); align-items: center; }
        .eyebrow { font-size: 12.5px; font-weight: 700; letter-spacing: 1.5px; color: var(--accent); margin-bottom: 20px; }
        .display.ld, h1.display { font-size: clamp(46px,7vw,84px); line-height: 0.98; letter-spacing: -2.5px; margin: 0 0 22px; }
        .lead { font-size: clamp(16px,1.5vw,18.5px); line-height: 1.62; color: var(--mut); max-width: 480px; margin: 0 0 30px; }
        .hero-cta { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 26px; }
        .btn-primary { background: var(--accent); color: #1A0E08; border: none; font: inherit; font-weight: 700; font-size: 16px; cursor: pointer; padding: 15px 26px; border-radius: 14px; transition: transform .14s, box-shadow .2s, background .2s; box-shadow: 0 14px 34px rgba(255,92,56,0.34); }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 20px 44px rgba(255,92,56,0.46); background: #FF6B49; }
        .btn-primary.big { font-size: 18px; padding: 18px 36px; }
        .btn-primary.sm { font-size: 15px; padding: 12px 22px; margin-top: 18px; box-shadow: 0 10px 24px rgba(255,92,56,0.3); }
        .btn-ghost { background: rgba(244,239,230,0.04); color: var(--ink); border: 1px solid var(--line); font: inherit; font-weight: 600; font-size: 16px; cursor: pointer; padding: 15px 24px; border-radius: 14px; transition: background .2s, transform .14s; }
        .btn-ghost:hover { background: rgba(244,239,230,0.09); transform: translateY(-2px); }
        .hero-remix { display: inline-flex; align-items: center; gap: 14px; padding: 10px 14px 10px 16px; border: 1px solid var(--line); border-radius: 999px; background: rgba(244,239,230,0.03); }
        .rmx-label { font-size: 13px; font-weight: 600; color: var(--mut); }
        .rmx-shuffle { background: var(--surface2); border: 1px solid var(--line); color: var(--ink); font: inherit; font-weight: 700; font-size: 12.5px; cursor: pointer; padding: 7px 13px; border-radius: 999px; transition: background .15s, transform .12s; }
        .rmx-shuffle:hover { background: #26231b; } .rmx-shuffle:active { transform: scale(.95); }
        .rmx-dots { display: flex; gap: 5px; }
        .rmx-dot { width: 18px; height: 18px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; transition: transform .12s; }
        .rmx-dot:hover { transform: scale(1.2); } .rmx-dot[data-on="1"] { border-color: var(--ink); transform: scale(1.12); }

        /* PHONE */
        .phone-stage { position: relative; display: flex; justify-content: center; }
        .phone { position: relative; z-index: 2; width: min(300px, 78vw); aspect-ratio: 300/610; background: #050505; border-radius: 44px; padding: 11px; box-shadow: 0 2px 0 rgba(255,255,255,0.06) inset, 0 40px 90px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06); animation: float 6s ease-in-out infinite; }
        @keyframes float { 0%,100% { transform: translateY(0) rotate(-0.6deg); } 50% { transform: translateY(-14px) rotate(0.6deg); } }
        .notch { position: absolute; top: 18px; left: 50%; transform: translateX(-50%); width: 86px; height: 22px; background: #050505; border-radius: 0 0 14px 14px; z-index: 5; }
        .screen { width: 100%; height: 100%; background: linear-gradient(180deg,#0E0D0C,#121009); border-radius: 34px; overflow: hidden; padding: 30px 14px 16px; display: flex; flex-direction: column; gap: 11px; }
        .app-top { display: flex; align-items: center; justify-content: space-between; }
        .app-brand { font-family: 'Clash Display'; font-weight: 700; font-size: 18px; color: var(--ink); }
        .app-top-right { display: flex; align-items: center; gap: 8px; }
        .streakchip { font-size: 11px; font-weight: 700; color: var(--accent2); background: rgba(255,178,62,0.12); padding: 4px 8px; border-radius: 999px; }
        .mustknow { display: flex; align-items: center; gap: 7px; font-size: 10px; font-weight: 800; letter-spacing: 1.2px; color: #FF453A; }
        .mk-dot { width: 7px; height: 7px; border-radius: 50%; background: #FF453A; box-shadow: 0 0 8px #FF453A; }
        .app-card { background: rgba(255,255,255,0.045); border: 1px solid rgba(255,255,255,0.06); border-radius: 18px; padding: 11px; display: flex; flex-direction: column; gap: 7px; }
        .card-img { height: 96px; border-radius: 12px; background: linear-gradient(135deg,#2A2620,#3A2A1E 60%,#FF5C38 200%); position: relative; }
        .cat-pill { position: absolute; top: 8px; left: 8px; font-size: 8.5px; font-weight: 800; letter-spacing: 0.8px; color: #fff; background: rgba(0,0,0,0.42); backdrop-filter: blur(6px); padding: 3px 7px; border-radius: 6px; }
        .src { display: flex; align-items: center; gap: 6px; font-size: 9.5px; color: var(--mut); }
        .fav { width: 11px; height: 11px; border-radius: 3px; background: linear-gradient(135deg,#FF8A65,#FF5C38); }
        .fav.alt { background: linear-gradient(135deg,#5BB8FF,#0EA5E9); }
        .head { font-family: 'Clash Display'; font-weight: 600; font-size: 14px; line-height: 1.18; letter-spacing: -0.3px; color: var(--ink); }
        .head.sm { font-size: 12.5px; }
        .bul { display: flex; align-items: flex-start; gap: 6px; font-size: 10px; line-height: 1.35; color: #C9C3B6; }
        .bd { width: 5px; height: 5px; border-radius: 50%; margin-top: 4px; flex-shrink: 0; }
        .pills { display: flex; gap: 5px; margin-top: 2px; }
        .pills span { font-size: 8.5px; font-weight: 600; color: var(--mut); border: 1px solid rgba(255,255,255,0.1); padding: 3px 8px; border-radius: 999px; }
        .app-card.mini { gap: 5px; }
        .phone-shadow { position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%); width: 70%; height: 40px; background: rgba(255,92,56,0.18); filter: blur(34px); z-index: 1; }

        /* STATS */
        .stats { max-width: 1000px; margin: 0 auto; display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; padding: clamp(20px,4vw,40px) clamp(18px,5vw,64px); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
        .stat { text-align: center; }
        .stat-n { font-size: clamp(40px,6vw,68px); letter-spacing: -2px; color: var(--ink); line-height: 1; }
        .stat-l { font-size: 14px; color: var(--mut); margin-top: 8px; font-weight: 500; }

        /* ROWS */
        .rows { max-width: 1120px; margin: 0 auto; padding: clamp(40px,7vw,90px) clamp(18px,5vw,64px); display: flex; flex-direction: column; gap: clamp(56px,9vw,120px); }
        .row { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(28px,5vw,70px); align-items: center; }
        .row.rev .row-copy { order: 2; }
        .kick { font-size: 12px; font-weight: 700; letter-spacing: 1.5px; color: var(--accent); margin-bottom: 16px; }
        .h2 { font-size: clamp(28px,3.6vw,46px); line-height: 1.04; letter-spacing: -1.4px; margin: 0 0 16px; }
        .p { font-size: clamp(15px,1.4vw,17px); line-height: 1.64; color: var(--mut); max-width: 420px; margin: 0; }
        .row-visual { display: flex; justify-content: center; }

        .chips-card, .funnel, .reader-card { width: 100%; max-width: 380px; background: linear-gradient(180deg,var(--surface),#100E0A); border: 1px solid var(--line); border-radius: 26px; padding: 28px; box-shadow: 0 30px 70px rgba(0,0,0,0.4); }
        .chips-card { display: flex; flex-wrap: wrap; gap: 10px; }
        .chip { font-size: 14px; font-weight: 600; color: var(--mut); border: 1px solid var(--line); padding: 10px 16px; border-radius: 999px; transition: all .2s; }
        .chip.on { background: var(--accent); color: #1A0E08; border-color: var(--accent); box-shadow: 0 8px 20px rgba(255,92,56,0.3); }

        .funnel { text-align: center; }
        .f-top { font-size: 13px; color: var(--mut); font-weight: 600; margin-bottom: 16px; }
        .f-bars { display: flex; flex-direction: column; align-items: center; gap: 7px; margin-bottom: 18px; }
        .f-bars span { height: 12px; border-radius: 999px; background: var(--accent); }
        .f-bot { font-size: 15px; color: var(--ink); font-weight: 600; }
        .ten { font-family: 'Clash Display'; font-size: 30px; color: var(--accent); margin-right: 6px; vertical-align: -3px; }

        .reader-card { text-align: center; display: flex; flex-direction: column; align-items: center; }
        .reader-hero { filter: drop-shadow(0 16px 30px rgba(0,0,0,0.5)); margin-bottom: 16px; }
        .reader-controls { display: flex; gap: 8px; margin-bottom: 18px; }
        .mini-btn { background: var(--surface2); border: 1px solid var(--line); color: var(--ink); font: inherit; font-weight: 700; font-size: 13px; cursor: pointer; padding: 9px 16px; border-radius: 999px; transition: background .15s, transform .12s; }
        .mini-btn:hover { background: #26231b; } .mini-btn:active { transform: scale(.95); }
        .reader-row { display: flex; gap: 8px; margin-bottom: 14px; }
        .reader-streak { font-size: 13px; font-weight: 700; color: var(--accent2); background: rgba(255,178,62,0.1); padding: 7px 14px; border-radius: 999px; }

        /* CTA BAND */
        .cta-band { max-width: 920px; margin: clamp(20px,4vw,40px) auto; text-align: center; padding: clamp(48px,7vw,84px) 28px; border-radius: 34px; position: relative; overflow: hidden;
          background: radial-gradient(120% 140% at 50% 0%, rgba(255,92,56,0.16), transparent 60%), linear-gradient(180deg,var(--surface),#0C0B09); border: 1px solid var(--line); }
        .cta-avs { display: flex; justify-content: center; margin-bottom: 24px; }
        .cta-av { border-radius: 50%; filter: drop-shadow(0 10px 18px rgba(0,0,0,0.5)); }
        .cta-h { font-size: clamp(34px,5vw,58px); letter-spacing: -1.8px; margin: 0 0 12px; }
        .cta-p { font-size: 17px; color: var(--mut); margin: 0 0 28px; }
        .cta-trust { margin-top: 18px; font-size: 13px; color: #6f6a60; font-weight: 500; }

        /* FOOTER */
        .foot { max-width: 1120px; margin: 0 auto; padding: clamp(40px,6vw,70px) clamp(18px,5vw,64px) 50px; display: grid; grid-template-columns: 1fr auto; gap: 30px; border-top: 1px solid var(--line); }
        .foot-brand { font-family: 'Clash Display'; font-weight: 700; font-size: 26px; }
        .foot-cols { display: flex; gap: clamp(28px,5vw,64px); }
        .foot-cols > div { display: flex; flex-direction: column; gap: 10px; }
        .fc-h { font-size: 12px; font-weight: 700; letter-spacing: 1px; color: var(--mut); text-transform: uppercase; margin-bottom: 2px; }
        .foot-cols a, .fl { color: #C9C3B6; font-size: 14px; text-decoration: none; background: none; border: none; cursor: pointer; font-family: inherit; text-align: left; padding: 0; }
        .foot-cols a:hover, .fl:hover { color: var(--ink); }
        .foot-c { grid-column: 1 / -1; font-size: 13px; color: #6f6a60; margin-top: 10px; }

        .overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(6,5,4,0.66); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 20px; overflow-y: auto; }

        /* reveal + load */
        :global(.rv) { opacity: 0; transform: translateY(26px); transition: opacity .7s cubic-bezier(0.22,1,0.36,1), transform .7s cubic-bezier(0.22,1,0.36,1); }
        :global(.rv.in) { opacity: 1; transform: none; }
        .ld { opacity: 0; animation: rise .8s cubic-bezier(0.22,1,0.36,1) forwards; }
        @keyframes rise { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: none; } }

        @media (max-width: 860px) {
          .hero-grid { grid-template-columns: 1fr; }
          .phone-stage { order: -1; margin-bottom: 10px; }
          .row, .row.rev .row-copy { grid-template-columns: 1fr; order: 0; }
          .links { display: none; }
          .stats { grid-template-columns: 1fr; gap: 24px; }
          .foot { grid-template-columns: 1fr; }
        }
        @media (prefers-reduced-motion: reduce) {
          .phone, .ld { animation: none !important; opacity: 1 !important; }
          :global(.rv) { opacity: 1 !important; transform: none !important; }
        }
      `}</style>
    </>
  );
}
