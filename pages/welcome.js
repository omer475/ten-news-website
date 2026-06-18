// pages/welcome.js — Today+ landing / front door (playful + avatars)
import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { createClient } from '../lib/supabase';
import Avatar, {
  AVATAR_COLORS, FACE_COUNT, ACCESSORY_COUNT, avatarFromSeed, normalizeAvatar,
} from '../components/Avatar';
import { AuthPanel, EmailConfirmation, storeAvatar } from '../components/AuthForms';

// floating avatars for the hero backdrop
const FLOATERS = [
  { c: { color: 0, face: 1, accessory: 2 }, top: '8%',  left: '6%',  size: 64, delay: 0 },
  { c: { color: 5, face: 5, accessory: 4 }, top: '16%', left: '84%', size: 78, delay: 0.6 },
  { c: { color: 7, face: 3, accessory: 5 }, top: '62%', left: '4%',  size: 70, delay: 1.1 },
  { c: { color: 3, face: 0, accessory: 3 }, top: '70%', left: '88%', size: 58, delay: 0.3 },
  { c: { color: 8, face: 2, accessory: 1 }, top: '40%', left: '92%', size: 48, delay: 1.4 },
  { c: { color: 1, face: 4, accessory: 0 }, top: '46%', left: '2%',  size: 52, delay: 0.9 },
];

const FEATURES = [
  { emoji: '🎯', grad: 'linear-gradient(135deg,#8B5CF6,#6366F1)', title: 'Tuned to you', body: 'Pick your topics and home country. The feed reads your taste and gets sharper every morning.' },
  { emoji: '⚡', grad: 'linear-gradient(135deg,#F97316,#EC4899)', title: 'Ten that matter', body: 'Our AI reads the whole firehose so you get the signal — the ten stories worth your time, not 200.' },
  { emoji: '🔥', grad: 'linear-gradient(135deg,#F43F5E,#F97316)', title: 'Keep your streak', body: 'Five-minute mornings that actually stick. Build a reading streak and watch it grow.' },
  { emoji: '💎', grad: 'linear-gradient(135deg,#0EA5E9,#14B8A6)', title: 'Beautiful by default', body: 'Liquid-glass cards with maps, timelines, and charts built right in. News that’s a joy to read.' },
];

export default function Welcome() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState(null); // null | 'login' | 'signup'
  const [authError, setAuthError] = useState('');
  const [emailSent, setEmailSent] = useState(null); // { email }
  const [heroAvatar, setHeroAvatar] = useState(() => avatarFromSeed('reader'));
  const [mounted, setMounted] = useState(false);

  // If the visitor already finished onboarding, don't show the front door.
  useEffect(() => {
    setMounted(true);
    try {
      const prefs = localStorage.getItem('todayplus_preferences');
      if (prefs && JSON.parse(prefs).onboarding_completed) router.replace('/');
    } catch {}
  }, [router]);

  const shuffleHero = () => setHeroAvatar({
    color: Math.floor((heroAvatar.color + 3) % AVATAR_COLORS.length),
    face: (heroAvatar.face + 1) % FACE_COUNT,
    accessory: (heroAvatar.accessory + 1) % ACCESSORY_COUNT,
  });

  /* ---------- routing after a successful auth ---------- */
  const routeAfterAuth = async (user) => {
    try {
      const prefs = localStorage.getItem('todayplus_preferences');
      if (prefs && JSON.parse(prefs).onboarding_completed) { router.push('/'); return; }
      if (user?.id) {
        const r = await fetch(`/api/user/preferences?auth_user_id=${user.id}`);
        if (r.ok) {
          const sp = await r.json();
          if (sp && sp.onboarding_completed) {
            localStorage.setItem('todayplus_preferences', JSON.stringify({
              home_country: sp.home_country,
              followed_countries: sp.followed_countries || [],
              followed_topics: sp.followed_topics || [],
              onboarding_completed: true,
              user_id: sp.id,
            }));
            router.push('/'); return;
          }
        }
      }
    } catch {}
    router.push('/onboarding');
  };

  /* ---------- auth handlers ---------- */
  const handleLogin = async (email, password) => {
    setAuthError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('tennews_user', JSON.stringify(data.user));
        if (data.session) localStorage.setItem('tennews_session', JSON.stringify(data.session));
        await routeAfterAuth(data.user);
      } else setAuthError(data.message || 'Login failed. Please try again.');
    } catch { setAuthError('Login failed. Please check your connection.'); }
  };

  const handleSignup = async (email, password, fullName, avatar) => {
    setAuthError('');
    if (avatar) storeAvatar(avatar);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const res = await fetch('/api/auth/signup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName, timezone }),
      });
      const text = await res.text();
      let data; try { data = JSON.parse(text); } catch { setAuthError('Server error. Please try again.'); return; }
      if (res.ok && data.success) { setAuthMode(null); setEmailSent({ email }); }
      else setAuthError(data.message || data.error || 'Signup failed. Please try again.');
    } catch { setAuthError('Signup failed. Please check your connection.'); }
  };

  const handleOAuthLogin = async (provider) => {
    setAuthError('');
    const supabase = createClient();
    if (!supabase) { setAuthError('Sign-in is not configured.'); return; }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        ...(provider === 'google' && { queryParams: { access_type: 'offline', prompt: 'consent' } }),
      },
    });
    if (error) setAuthError(error.message);
  };

  const handleMagicLink = async (email) => {
    setAuthError('');
    const supabase = createClient();
    if (!supabase) { setAuthError('Sign-in is not configured.'); throw new Error('no client'); }
    const { error } = await supabase.auth.signInWithOtp({
      email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setAuthError(error.message); throw error; }
  };

  const handleForgotPassword = async (email) => {
    setAuthError('');
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch { /* enumeration-safe: always succeeds */ }
  };

  const openSignup = () => { setAuthError(''); setAuthMode('signup'); };
  const openLogin = () => { setAuthError(''); setAuthMode('login'); };
  const browseFirst = () => router.push('/onboarding');

  const year = useMemo(() => 2026, []);

  return (
    <>
      <Head>
        <title>Today+ — Ten stories a day, made for you</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="theme-color" content="#FBFAFF" />
        <meta name="description" content="Today+ gives you the ten stories that actually matter — tuned to your topics and your part of the world. Build your reader, keep a streak, skip the doomscroll." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..800&display=swap" rel="stylesheet" />
      </Head>

      <main className="wrap">
        {/* nav */}
        <nav className="nav">
          <div className="brand">today<span className="plus">+</span></div>
          <div className="navbtns">
            <button className="ghost" onClick={openLogin}>Log in</button>
            <button className="solid" onClick={openSignup}>Get started</button>
          </div>
        </nav>

        {/* hero */}
        <section className="hero">
          <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
          {mounted && FLOATERS.map((f, i) => (
            <div key={i} className="floater" style={{ top: f.top, left: f.left, animationDelay: `${f.delay}s` }}>
              <Avatar config={f.c} size={f.size} />
            </div>
          ))}

          <div className="hero-inner">
            <div className="pill">📰 Ten stories. Zero doomscroll.</div>
            <h1 className="h1">Make your reader.<br /><span className="grad">Meet your news.</span></h1>
            <p className="lead">
              Today+ reads the whole firehose and hands you the ten stories that actually matter —
              tuned to your topics and your corner of the world. Pick a face, keep a streak, and
              start your morning in five minutes.
            </p>

            {/* interactive reader builder */}
            <div className="builder">
              <div className="builder-av"><Avatar config={heroAvatar} size={96} ring /></div>
              <div className="builder-text">
                <div className="builder-title">This is your reader.</div>
                <div className="builder-sub">Tap to remix — then make it yours.</div>
                <div className="builder-controls">
                  <button className="chip" onClick={shuffleHero}>🎲 Remix</button>
                  <div className="dots">
                    {AVATAR_COLORS.slice(0, 8).map((c, i) => (
                      <span key={c.id} className="dot" data-on={heroAvatar.color === i ? '1' : '0'}
                        style={{ background: `linear-gradient(135deg,${c.from},${c.to})` }}
                        onClick={() => setHeroAvatar({ ...heroAvatar, color: i })} />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="cta-row">
              <button className="cta-primary" onClick={openSignup}>Create your reader →</button>
              <button className="cta-ghost" onClick={browseFirst}>Just show me the news</button>
            </div>
            <div className="trust">Free to start · No credit card · Google &amp; Apple sign-in</div>
          </div>
        </section>

        {/* features */}
        <section className="features">
          <h2 className="sec-title">A news habit you’ll actually keep</h2>
          <div className="grid">
            {FEATURES.map((f) => (
              <div className="card" key={f.title}>
                <div className="ic" style={{ background: f.grad }}>{f.emoji}</div>
                <div className="card-title">{f.title}</div>
                <p className="card-body">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* streak teaser */}
        <section className="streak">
          <div className="streak-inner">
            <div className="streak-flames">
              {[1,2,3,4,5,6,7].map((d) => (
                <div key={d} className="flame" style={{ animationDelay: `${d * 0.12}s`, opacity: d <= 5 ? 1 : 0.35 }}>🔥</div>
              ))}
            </div>
            <h2 className="streak-h">Show up. Watch it grow.</h2>
            <p className="streak-p">Every day you read, your streak climbs. It’s a tiny, satisfying nudge that turns “I should follow the news” into something you just… do.</p>
            <button className="cta-primary" onClick={openSignup}>Start my streak</button>
          </div>
        </section>

        {/* final cta */}
        <section className="final">
          <div className="final-avs">
            {[{color:0,face:1,accessory:2},{color:5,face:3,accessory:5},{color:7,face:0,accessory:3},{color:3,face:5,accessory:4}].map((c,i)=>(
              <div key={i} className="final-av" style={{ marginLeft: i ? -14 : 0, zIndex: 10 - i }}><Avatar config={c} size={52} ring /></div>
            ))}
          </div>
          <h2 className="final-h">Your news is waiting.</h2>
          <p className="final-p">Build your reader in under a minute.</p>
          <button className="cta-primary big" onClick={openSignup}>Create your reader →</button>
        </section>

        <footer className="foot">
          <div className="brand small">today<span className="plus">+</span></div>
          <div className="foot-links">
            <a href="/privacy">Privacy</a>
            <button className="linkbtn" onClick={openLogin}>Log in</button>
          </div>
          <div className="foot-c">© {year} Today+</div>
        </footer>
      </main>

      {/* auth overlay */}
      {authMode && (
        <div className="overlay" onClick={() => setAuthMode(null)}>
          <AuthPanel
            mode={authMode}
            onModeChange={(m) => { setAuthError(''); setAuthMode(m); }}
            onLogin={handleLogin}
            onSignup={handleSignup}
            onOAuthLogin={handleOAuthLogin}
            onMagicLink={handleMagicLink}
            onForgotPassword={handleForgotPassword}
            error={authError}
            onClose={() => setAuthMode(null)}
            initialAvatar={heroAvatar}
          />
        </div>
      )}
      {emailSent && (
        <div className="overlay" onClick={() => setEmailSent(null)}>
          <EmailConfirmation email={emailSent.email} onBack={() => setEmailSent(null)} />
        </div>
      )}

      <style jsx>{`
        .wrap {
          font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
          background: #FBFAFF; color: #18161f; min-height: 100vh; overflow-x: hidden;
        }
        .nav {
          position: sticky; top: 0; z-index: 50;
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px clamp(18px, 5vw, 56px);
          background: rgba(251,250,255,0.78); backdrop-filter: blur(14px);
          border-bottom: 1px solid rgba(24,22,31,0.06);
        }
        .brand { font-size: 24px; font-weight: 800; letter-spacing: -0.6px; }
        .brand.small { font-size: 20px; }
        .plus { background: linear-gradient(120deg,#8B5CF6,#EC4899,#F97316); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
        .navbtns { display: flex; gap: 10px; }
        .ghost { background: none; border: none; font: inherit; font-weight: 700; font-size: 15px; color: #57536a; cursor: pointer; padding: 10px 12px; border-radius: 12px; }
        .ghost:hover { background: rgba(24,22,31,0.05); }
        .solid { background: #18161f; color: #fff; border: none; font: inherit; font-weight: 700; font-size: 15px; cursor: pointer; padding: 10px 20px; border-radius: 999px; transition: transform .12s; }
        .solid:hover { transform: translateY(-1px); }

        .hero { position: relative; padding: clamp(40px, 8vw, 90px) 20px clamp(50px, 7vw, 80px); overflow: hidden; }
        .hero-inner { position: relative; z-index: 5; max-width: 760px; margin: 0 auto; text-align: center; }
        .blob { position: absolute; border-radius: 50%; filter: blur(70px); opacity: 0.5; z-index: 0; }
        .b1 { width: 420px; height: 420px; background: #C4B5FD; top: -120px; left: -80px; }
        .b2 { width: 380px; height: 380px; background: #FBCFE8; top: -40px; right: -100px; }
        .b3 { width: 360px; height: 360px; background: #BAE6FD; bottom: -160px; left: 30%; }
        .floater { position: absolute; z-index: 1; animation: bob 5s ease-in-out infinite; filter: drop-shadow(0 12px 22px rgba(20,16,40,0.16)); }
        @keyframes bob { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-16px) rotate(2deg); } }

        .pill { display: inline-block; background: #fff; border: 1px solid rgba(24,22,31,0.08); box-shadow: 0 6px 18px rgba(20,16,40,0.07); border-radius: 999px; padding: 8px 16px; font-size: 13.5px; font-weight: 700; color: #57536a; margin-bottom: 22px; }
        .h1 { font-size: clamp(38px, 7vw, 68px); font-weight: 800; line-height: 1.04; letter-spacing: -2px; margin: 0 0 18px; }
        .grad { background: linear-gradient(120deg,#8B5CF6,#EC4899 55%,#F97316); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
        .lead { font-size: clamp(16px, 2.4vw, 19px); line-height: 1.6; color: #57536a; max-width: 560px; margin: 0 auto 26px; }

        .builder { display: inline-flex; align-items: center; gap: 16px; background: #fff; border: 1px solid rgba(24,22,31,0.07); border-radius: 24px; padding: 14px 20px 14px 14px; box-shadow: 0 18px 50px rgba(20,16,40,0.12); margin-bottom: 28px; text-align: left; }
        .builder-av { filter: drop-shadow(0 8px 16px rgba(20,16,40,0.2)); }
        .builder-title { font-size: 16px; font-weight: 800; }
        .builder-sub { font-size: 13px; color: #8b8798; margin-bottom: 10px; }
        .builder-controls { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .chip { background: #f3f0fb; border: none; font: inherit; font-weight: 700; font-size: 13px; color: #57536a; cursor: pointer; padding: 8px 13px; border-radius: 999px; transition: transform .12s, background .15s; }
        .chip:hover { background: #ece6f9; } .chip:active { transform: scale(.95); }
        .dots { display: flex; gap: 6px; }
        .dot { width: 20px; height: 20px; border-radius: 50%; cursor: pointer; border: 2.5px solid transparent; transition: transform .12s; }
        .dot:hover { transform: scale(1.18); }
        .dot[data-on="1"] { border-color: #18161f; transform: scale(1.12); }

        .cta-row { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .cta-primary { background: linear-gradient(120deg,#8B5CF6,#EC4899 60%,#F97316); background-size: 160% 100%; color: #fff; border: none; font: inherit; font-weight: 700; font-size: 16px; cursor: pointer; padding: 15px 26px; border-radius: 999px; box-shadow: 0 12px 30px rgba(139,92,246,0.34); transition: background-position .4s, transform .12s; }
        .cta-primary:hover { background-position: 100% 0; transform: translateY(-2px); }
        .cta-primary.big { font-size: 18px; padding: 17px 34px; }
        .cta-ghost { background: #fff; color: #18161f; border: 1.5px solid rgba(24,22,31,0.12); font: inherit; font-weight: 700; font-size: 16px; cursor: pointer; padding: 15px 24px; border-radius: 999px; transition: transform .12s, box-shadow .15s; }
        .cta-ghost:hover { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(20,16,40,0.1); }
        .trust { margin-top: 16px; font-size: 13px; color: #9d99ab; font-weight: 600; }

        .features { max-width: 1040px; margin: 0 auto; padding: clamp(30px,6vw,70px) 20px; }
        .sec-title { text-align: center; font-size: clamp(26px,4vw,40px); font-weight: 800; letter-spacing: -1px; margin: 0 0 36px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 18px; }
        .card { background: #fff; border: 1px solid rgba(24,22,31,0.06); border-radius: 24px; padding: 26px 22px; box-shadow: 0 10px 30px rgba(20,16,40,0.06); transition: transform .18s, box-shadow .18s; }
        .card:hover { transform: translateY(-4px); box-shadow: 0 20px 44px rgba(20,16,40,0.12); }
        .ic { width: 52px; height: 52px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 26px; margin-bottom: 16px; box-shadow: 0 8px 20px rgba(20,16,40,0.18); }
        .card-title { font-size: 19px; font-weight: 800; margin-bottom: 8px; letter-spacing: -0.3px; }
        .card-body { font-size: 14.5px; line-height: 1.6; color: #6b6680; margin: 0; }

        .streak { padding: clamp(20px,5vw,40px) 20px; }
        .streak-inner { max-width: 720px; margin: 0 auto; text-align: center; background: linear-gradient(135deg,#1b1430,#2a1840); border-radius: 32px; padding: clamp(36px,6vw,56px) 28px; color: #fff; box-shadow: 0 30px 70px rgba(27,20,48,0.35); }
        .streak-flames { display: flex; gap: 6px; justify-content: center; margin-bottom: 18px; font-size: 30px; }
        .flame { animation: pop 1.6s ease-in-out infinite; }
        @keyframes pop { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-7px) scale(1.12); } }
        .streak-h { font-size: clamp(26px,4vw,38px); font-weight: 800; letter-spacing: -1px; margin: 0 0 12px; }
        .streak-p { font-size: 16px; line-height: 1.6; color: rgba(255,255,255,0.72); max-width: 480px; margin: 0 auto 24px; }

        .final { text-align: center; padding: clamp(50px,8vw,90px) 20px; }
        .final-avs { display: flex; justify-content: center; margin-bottom: 22px; }
        .final-av { filter: drop-shadow(0 8px 16px rgba(20,16,40,0.18)); border-radius: 50%; }
        .final-h { font-size: clamp(30px,5vw,48px); font-weight: 800; letter-spacing: -1.4px; margin: 0 0 10px; }
        .final-p { font-size: 17px; color: #6b6680; margin: 0 0 26px; }

        .foot { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; padding: 28px clamp(18px,5vw,56px); border-top: 1px solid rgba(24,22,31,0.07); }
        .foot-links { display: flex; gap: 18px; align-items: center; }
        .foot-links a, .linkbtn { color: #6b6680; font-size: 14px; font-weight: 600; text-decoration: none; background: none; border: none; cursor: pointer; font-family: inherit; }
        .foot-links a:hover, .linkbtn:hover { color: #18161f; }
        .foot-c { font-size: 13px; color: #a8a4b6; }

        .overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(20,16,40,0.45); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; padding: 20px; overflow-y: auto; }

        @media (max-width: 560px) {
          .floater { display: none; }
          .builder { flex-direction: column; text-align: center; }
          .builder-controls { justify-content: center; }
          .cta-row { flex-direction: column; } .cta-row button { width: 100%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .floater, .flame, .cta-primary { animation: none !important; }
        }
      `}</style>
    </>
  );
}
