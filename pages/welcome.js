// pages/welcome.js — Today+ front door. Clean, editorial, professional.
import { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { createClient } from '../lib/supabase';
import { AuthPanel, EmailConfirmation } from '../components/AuthForms';

function useReveal() {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setShown(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.16 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, shown];
}
function Reveal({ children, delay = 0, as: Tag = 'div', className = '', id }) {
  const [ref, shown] = useReveal();
  return <Tag id={id} ref={ref} className={`rv ${shown ? 'in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</Tag>;
}

const SOURCES = ['Reuters', 'Associated Press', 'Bloomberg', 'The Verge', 'Financial Times', 'Nature', 'Politico', 'The Athletic'];

const FEATURES = [
  { n: '01', kick: 'Tuned to your world', title: 'Your topics. Your region. Your front page.',
    body: 'Choose what you care about and where you call home. Today+ leads with the stories that matter to you and learns a little more with every read.' },
  { n: '02', kick: 'The signal, not the noise', title: 'Thousands of sources in. Ten that matter out.',
    body: 'Our newsroom engine reads, ranks, de-duplicates and summarises the firehose — until only the essential stories remain. No infinite scroll. No outrage bait.' },
  { n: '03', kick: 'Built to be read', title: 'Your whole briefing, in five minutes.',
    body: 'Clean, considered cards with the context built in — timelines, maps and the numbers that matter. Save what you need. Catch up and get on with your day.' },
];

export default function Welcome() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState(null);
  const [authError, setAuthError] = useState('');
  const [emailSent, setEmailSent] = useState(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    try { const p = localStorage.getItem('todayplus_preferences'); if (p && JSON.parse(p).onboarding_completed) router.replace('/'); } catch {}
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [router]);

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
              followed_topics: sp.followed_topics || [], onboarding_completed: true, user_id: sp.id }));
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
  const handleSignup = async (email, password, fullName) => {
    setAuthError('');
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
        <title>Today+ — Ten stories. The ones that matter.</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="theme-color" content="#FBFAF8" />
        <meta name="description" content="Today+ reads thousands of trusted sources each morning and gives you the ten stories that matter — for your topics and your region, in five minutes." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500..700&display=swap" rel="stylesheet" />
        <link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap" rel="stylesheet" />
      </Head>

      <main className="wrap">
        {/* NAV */}
        <header className={`nav ${scrolled ? 'on' : ''}`}>
          <div className="brand">today<span className="plus">+</span></div>
          <nav className="links">
            <a href="#how">How it works</a>
            <a href="#why">Why Today+</a>
          </nav>
          <div className="navcta">
            <button className="ln" onClick={openLogin}>Sign in</button>
            <button className="pill" onClick={openSignup}>Get started</button>
          </div>
        </header>

        {/* HERO */}
        <section className="hero">
          <div className="hero-grid">
            <div className="hero-copy">
              <div className="eyebrow ld" style={{ animationDelay: '40ms' }}>Today’s briefing · Wed, Jun 18</div>
              <h1 className="display ld" style={{ animationDelay: '110ms' }}>Ten stories.<br />The ones that matter.</h1>
              <p className="lead ld" style={{ animationDelay: '200ms' }}>
                Each morning, Today+ reads thousands of trusted sources and gives you the
                ten stories worth your time — for your topics, your region, your five minutes.
              </p>
              <div className="hero-cta ld" style={{ animationDelay: '300ms' }}>
                <button className="btn-primary" onClick={openSignup}>Get started — it’s free</button>
                <button className="btn-ghost" onClick={browse}>Browse the news</button>
              </div>
              <div className="sources ld" style={{ animationDelay: '400ms' }}>
                <span className="src-label">Built from 1,000+ trusted sources</span>
                <div className="src-row">{SOURCES.slice(0, 6).map((s) => <span key={s}>{s}</span>)}</div>
              </div>
            </div>

            {/* PHONE MOCKUP — clean light news app */}
            <div className="phone-stage ld" style={{ animationDelay: '240ms' }}>
              <div className="phone">
                <div className="screen">
                  <div className="app-top">
                    <span className="app-brand">today<span className="plus">+</span></span>
                    <span className="app-date">Wed, Jun 18</span>
                  </div>
                  <div className="app-label"><span className="lab-rule" />TODAY’S TEN</div>

                  <div className="app-lead">
                    <div className="lead-img"><span className="img-cat">MARKETS</span></div>
                    <div className="lead-cat">Economy</div>
                    <div className="lead-head">Central banks signal a pause as inflation cools across major economies</div>
                    <div className="lead-src"><span className="dot" />Reuters · 2h ago</div>
                  </div>

                  <div className="app-list">
                    <div className="li"><span className="li-n">02</span><div><div className="li-src">The Verge</div><div className="li-h">On-device AI model ships to millions of phones overnight</div></div></div>
                    <div className="li"><span className="li-n">03</span><div><div className="li-src">Nature</div><div className="li-h">Fusion experiment sustains record net-energy gain</div></div></div>
                    <div className="li"><span className="li-n">04</span><div><div className="li-src">AP</div><div className="li-h">Diplomats reach framework deal after late-night talks</div></div></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* STATS */}
        <section className="stats">
          {[['10', 'stories a day'], ['5 min', 'to read them all'], ['1,000+', 'trusted sources']].map(([n, l], i) => (
            <Reveal key={l} delay={i * 90} className="stat">
              <div className="stat-n display">{n}</div>
              <div className="stat-l">{l}</div>
            </Reveal>
          ))}
        </section>

        {/* FEATURES */}
        <section id="how" className="rows">
          {FEATURES.map((f, i) => (
            <Reveal key={f.n} className={`row ${i % 2 ? 'rev' : ''}`} id={i === 1 ? 'why' : undefined}>
              <div className="row-copy">
                <div className="kick"><span className="kick-n display">{f.n}</span>{f.kick}</div>
                <h2 className="h2 display">{f.title}</h2>
                <p className="p">{f.body}</p>
                {i === 2 && <button className="btn-primary sm" onClick={openSignup}>Get started</button>}
              </div>
              <div className="row-visual">
                {i === 0 && (
                  <div className="vcard chips">
                    {['Markets', 'AI', 'Geopolitics', 'Climate', 'Football', 'Space', 'Health', 'Elections'].map((t, j) => (
                      <span key={t} className={`chip ${j % 3 === 0 ? 'on' : ''}`}>{t}</span>
                    ))}
                  </div>
                )}
                {i === 1 && (
                  <div className="vcard funnel">
                    <div className="f-top">1,000s of articles</div>
                    <div className="f-bars">{[100, 80, 58, 38, 20, 9].map((w, j) => <span key={j} style={{ width: `${w}%` }} />)}</div>
                    <div className="f-bot"><span className="ten display">10</span> stories for you</div>
                  </div>
                )}
                {i === 2 && (
                  <div className="vcard brief">
                    <div className="brief-ring"><svg viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="32" r="27" fill="none" stroke="#EAE6DD" strokeWidth="6" /><circle cx="32" cy="32" r="27" fill="none" stroke="#CC2E22" strokeWidth="6" strokeLinecap="round" strokeDasharray="170" strokeDashoffset="40" transform="rotate(-90 32 32)" /></svg><span className="brief-min">5<small>min</small></span></div>
                    <div className="brief-txt"><div className="brief-h display">You’re all caught up</div><div className="brief-s">10 of 10 read · back tomorrow</div></div>
                  </div>
                )}
              </div>
            </Reveal>
          ))}
        </section>

        {/* CTA */}
        <Reveal as="section" className="cta">
          <div className="cta-inner">
            <div className="cta-eyebrow">Start today</div>
            <h2 className="cta-h display">Your briefing is ready.</h2>
            <p className="cta-p">Join free and read the ten stories that matter this morning.</p>
            <button className="btn-primary big" onClick={openSignup}>Get started — it’s free</button>
            <div className="cta-trust">No credit card · Sign in with Google or Apple · Cancel anytime</div>
          </div>
        </Reveal>

        {/* FOOTER */}
        <footer className="foot">
          <div className="foot-brand">today<span className="plus">+</span></div>
          <div className="foot-cols">
            <div><span className="fc-h">Product</span><a href="#how">How it works</a><a href="#why">Why Today+</a></div>
            <div><span className="fc-h">Account</span><button className="fl" onClick={openLogin}>Sign in</button><button className="fl" onClick={openSignup}>Get started</button></div>
            <div><span className="fc-h">Legal</span><a href="/privacy">Privacy</a></div>
          </div>
          <div className="foot-c">© {year} Today+ · The day’s ten stories, every morning.</div>
        </footer>
      </main>

      {authMode && (
        <div className="overlay" onClick={() => setAuthMode(null)}>
          <AuthPanel mode={authMode} onModeChange={(m) => { setAuthError(''); setAuthMode(m); }}
            onLogin={handleLogin} onSignup={handleSignup} onOAuthLogin={handleOAuthLogin}
            onMagicLink={handleMagicLink} onForgotPassword={handleForgotPassword}
            error={authError} onClose={() => setAuthMode(null)} />
        </div>
      )}
      {emailSent && (
        <div className="overlay" onClick={() => setEmailSent(null)}>
          <EmailConfirmation email={emailSent.email} onBack={() => setEmailSent(null)} />
        </div>
      )}

      <style jsx>{`
        .wrap {
          --paper: #FBFAF8; --ink: #17150F; --mut: #6B6760; --line: rgba(23,21,15,0.10);
          --soft: #F4F1EB; --accent: #CC2E22;
          font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif;
          background: var(--paper); color: var(--ink); min-height: 100vh; overflow-x: hidden; -webkit-font-smoothing: antialiased;
        }
        .display { font-family: 'Fraunces', Georgia, serif; font-weight: 600; }
        .plus { color: var(--accent); }

        .nav { position: sticky; top: 0; z-index: 60; display: flex; align-items: center; justify-content: space-between;
          padding: 16px clamp(18px,5vw,64px); transition: background .3s, border-color .3s; border-bottom: 1px solid transparent; }
        .nav.on { background: rgba(251,250,248,0.86); backdrop-filter: blur(14px); border-bottom-color: var(--line); }
        .brand { font-family: 'Fraunces', serif; font-size: 23px; font-weight: 600; letter-spacing: -0.3px; }
        .links { display: flex; gap: 28px; }
        .links a { color: var(--mut); font-size: 14.5px; font-weight: 500; text-decoration: none; transition: color .2s; }
        .links a:hover { color: var(--ink); }
        .navcta { display: flex; gap: 6px; align-items: center; }
        .ln { background: none; border: none; color: var(--ink); font: inherit; font-weight: 600; font-size: 14.5px; cursor: pointer; padding: 9px 14px; border-radius: 10px; }
        .ln:hover { background: var(--soft); }
        .pill { background: var(--ink); color: #fff; border: none; font: inherit; font-weight: 600; font-size: 14.5px; cursor: pointer; padding: 10px 20px; border-radius: 999px; transition: transform .14s, background .2s; }
        .pill:hover { transform: translateY(-1px); background: #2a2720; }

        .hero { padding: clamp(36px,6vw,76px) clamp(18px,5vw,64px) clamp(40px,6vw,64px); }
        .hero-grid { max-width: 1160px; margin: 0 auto; display: grid; grid-template-columns: 1.08fr 0.92fr; gap: clamp(28px,5vw,64px); align-items: center; }
        .eyebrow { font-size: 12px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; color: var(--accent); margin-bottom: 20px; }
        h1.display { font-size: clamp(42px,6.6vw,76px); line-height: 1.0; letter-spacing: -2px; margin: 0 0 22px; }
        .lead { font-size: clamp(16px,1.5vw,19px); line-height: 1.6; color: var(--mut); max-width: 480px; margin: 0 0 30px; }
        .hero-cta { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 34px; }
        .btn-primary { background: var(--accent); color: #fff; border: none; font: inherit; font-weight: 700; font-size: 16px; cursor: pointer; padding: 15px 26px; border-radius: 12px; transition: transform .14s, box-shadow .2s, background .2s; box-shadow: 0 12px 28px rgba(204,46,34,0.24); }
        .btn-primary:hover { transform: translateY(-2px); background: #B5281D; box-shadow: 0 18px 38px rgba(204,46,34,0.32); }
        .btn-primary.big { font-size: 18px; padding: 17px 34px; }
        .btn-primary.sm { font-size: 15px; padding: 13px 24px; margin-top: 20px; }
        .btn-ghost { background: #fff; color: var(--ink); border: 1px solid var(--line); font: inherit; font-weight: 600; font-size: 16px; cursor: pointer; padding: 15px 24px; border-radius: 12px; transition: background .2s, transform .14s; }
        .btn-ghost:hover { background: var(--soft); transform: translateY(-2px); }
        .sources { border-top: 1px solid var(--line); padding-top: 18px; }
        .src-label { font-size: 11.5px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: #A8A296; }
        .src-row { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 10px; }
        .src-row span { font-family: 'Fraunces', serif; font-size: 15px; font-weight: 600; color: #8A857B; }

        /* PHONE */
        .phone-stage { display: flex; justify-content: center; }
        .phone { width: min(300px, 80vw); aspect-ratio: 300/620; background: #1C1A14; border-radius: 42px; padding: 9px; box-shadow: 0 40px 90px rgba(23,21,15,0.28), 0 0 0 1px rgba(23,21,15,0.06); }
        .screen { width: 100%; height: 100%; background: var(--paper); border-radius: 34px; overflow: hidden; padding: 20px 15px; display: flex; flex-direction: column; gap: 13px; }
        .app-top { display: flex; align-items: baseline; justify-content: space-between; }
        .app-brand { font-family: 'Fraunces', serif; font-weight: 600; font-size: 19px; color: var(--ink); }
        .app-date { font-size: 11px; color: var(--mut); font-weight: 600; }
        .app-label { display: flex; align-items: center; gap: 8px; font-size: 10.5px; font-weight: 800; letter-spacing: 1.4px; color: var(--accent); }
        .lab-rule { width: 18px; height: 2px; background: var(--accent); }
        .app-lead { display: flex; flex-direction: column; gap: 6px; }
        .lead-img { height: 104px; border-radius: 12px; background: linear-gradient(135deg,#2A2720,#5A2018); position: relative; }
        .img-cat { position: absolute; top: 8px; left: 8px; font-size: 8px; font-weight: 800; letter-spacing: 0.8px; color: #fff; background: rgba(0,0,0,0.4); padding: 3px 7px; border-radius: 5px; }
        .lead-cat { font-size: 9.5px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: var(--accent); margin-top: 2px; }
        .lead-head { font-family: 'Fraunces', serif; font-weight: 600; font-size: 16px; line-height: 1.16; letter-spacing: -0.3px; color: var(--ink); }
        .lead-src { display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--mut); }
        .dot { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); }
        .app-list { display: flex; flex-direction: column; gap: 11px; border-top: 1px solid var(--line); padding-top: 11px; }
        .li { display: flex; gap: 10px; align-items: flex-start; }
        .li-n { font-family: 'Fraunces', serif; font-weight: 600; font-size: 15px; color: #C4BEB2; min-width: 16px; }
        .li-src { font-size: 9px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; color: var(--mut); }
        .li-h { font-size: 12px; font-weight: 600; line-height: 1.25; color: var(--ink); margin-top: 1px; }

        .stats { max-width: 980px; margin: 0 auto; display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; padding: clamp(24px,4vw,44px) clamp(18px,5vw,64px); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
        .stat { text-align: center; }
        .stat-n { font-size: clamp(40px,6vw,66px); letter-spacing: -1.5px; line-height: 1; color: var(--ink); }
        .stat-l { font-size: 14px; color: var(--mut); margin-top: 8px; font-weight: 500; }

        .rows { max-width: 1080px; margin: 0 auto; padding: clamp(44px,7vw,96px) clamp(18px,5vw,64px); display: flex; flex-direction: column; gap: clamp(56px,9vw,116px); }
        .row { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(28px,5vw,72px); align-items: center; }
        .row.rev .row-copy { order: 2; }
        .kick { display: flex; align-items: center; gap: 10px; font-size: 12.5px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--accent); margin-bottom: 16px; }
        .kick-n { font-size: 20px; color: var(--ink); letter-spacing: 0; }
        .h2 { font-size: clamp(28px,3.6vw,44px); line-height: 1.06; letter-spacing: -1.2px; margin: 0 0 16px; }
        .p { font-size: clamp(15px,1.4vw,17px); line-height: 1.66; color: var(--mut); max-width: 440px; margin: 0; }
        .row-visual { display: flex; justify-content: center; }
        .vcard { width: 100%; max-width: 380px; background: #fff; border: 1px solid var(--line); border-radius: 22px; padding: 30px; box-shadow: 0 24px 56px rgba(23,21,15,0.08); }
        .chips { display: flex; flex-wrap: wrap; gap: 10px; }
        .chip { font-size: 14px; font-weight: 600; color: var(--mut); border: 1px solid var(--line); padding: 10px 16px; border-radius: 999px; }
        .chip.on { background: var(--accent); color: #fff; border-color: var(--accent); }
        .funnel { text-align: center; }
        .f-top { font-size: 13px; color: var(--mut); font-weight: 600; margin-bottom: 16px; }
        .f-bars { display: flex; flex-direction: column; align-items: center; gap: 7px; margin-bottom: 18px; }
        .f-bars span { height: 11px; border-radius: 999px; background: var(--accent); opacity: 0.85; }
        .f-bars span:nth-child(1){opacity:.25}.f-bars span:nth-child(2){opacity:.4}.f-bars span:nth-child(3){opacity:.55}.f-bars span:nth-child(4){opacity:.7}.f-bars span:nth-child(5){opacity:.85}.f-bars span:nth-child(6){opacity:1}
        .f-bot { font-size: 15px; color: var(--ink); font-weight: 600; }
        .ten { font-size: 30px; color: var(--accent); margin-right: 6px; vertical-align: -3px; }
        .brief { display: flex; align-items: center; gap: 18px; }
        .brief-ring { position: relative; flex-shrink: 0; }
        .brief-min { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-family: 'Fraunces', serif; font-weight: 600; font-size: 20px; color: var(--ink); }
        .brief-min small { font-size: 9px; margin-left: 1px; color: var(--mut); }
        .brief-h { font-size: 19px; letter-spacing: -0.3px; }
        .brief-s { font-size: 13px; color: var(--mut); margin-top: 3px; }

        .cta { padding: clamp(20px,4vw,40px) clamp(18px,5vw,64px); }
        .cta-inner { max-width: 880px; margin: 0 auto; text-align: center; background: var(--ink); color: var(--paper); border-radius: 28px; padding: clamp(48px,7vw,82px) 28px; }
        .cta-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase; color: #E8917F; margin-bottom: 14px; }
        .cta-h { font-size: clamp(34px,5vw,58px); letter-spacing: -1.5px; margin: 0 0 12px; color: #FBFAF8; }
        .cta-p { font-size: 17px; color: rgba(251,250,248,0.72); margin: 0 0 28px; }
        .cta .btn-primary { box-shadow: 0 14px 34px rgba(204,46,34,0.4); }
        .cta-trust { margin-top: 18px; font-size: 13px; color: rgba(251,250,248,0.5); font-weight: 500; }

        .foot { max-width: 1080px; margin: 0 auto; padding: clamp(40px,6vw,68px) clamp(18px,5vw,64px) 50px; display: grid; grid-template-columns: 1fr auto; gap: 30px; border-top: 1px solid var(--line); }
        .foot-brand { font-family: 'Fraunces', serif; font-weight: 600; font-size: 25px; }
        .foot-cols { display: flex; gap: clamp(28px,5vw,64px); }
        .foot-cols > div { display: flex; flex-direction: column; gap: 9px; }
        .fc-h { font-size: 11px; font-weight: 700; letter-spacing: 1px; color: var(--mut); text-transform: uppercase; margin-bottom: 2px; }
        .foot-cols a, .fl { color: #57534A; font-size: 14px; text-decoration: none; background: none; border: none; cursor: pointer; font-family: inherit; text-align: left; padding: 0; }
        .foot-cols a:hover, .fl:hover { color: var(--ink); }
        .foot-c { grid-column: 1 / -1; font-size: 13px; color: #A8A296; margin-top: 10px; }

        .overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(23,21,15,0.5); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; padding: 20px; overflow-y: auto; }

        :global(.rv) { opacity: 0; transform: translateY(24px); transition: opacity .7s cubic-bezier(0.22,1,0.36,1), transform .7s cubic-bezier(0.22,1,0.36,1); }
        :global(.rv.in) { opacity: 1; transform: none; }
        .ld { opacity: 0; animation: rise .8s cubic-bezier(0.22,1,0.36,1) forwards; }
        @keyframes rise { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }

        @media (max-width: 860px) {
          .hero-grid { grid-template-columns: 1fr; }
          .phone-stage { order: -1; margin-bottom: 8px; }
          .row, .row.rev .row-copy { grid-template-columns: 1fr; order: 0; }
          .links { display: none; }
          .stats { grid-template-columns: 1fr; gap: 22px; }
          .foot { grid-template-columns: 1fr; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ld { animation: none !important; opacity: 1 !important; }
          :global(.rv) { opacity: 1 !important; transform: none !important; }
        }
      `}</style>
    </>
  );
}
