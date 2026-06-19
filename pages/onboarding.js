import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { createClient } from "../lib/supabase";
import { AuthPanel, EmailConfirmation } from "../components/AuthForms";

// ============================================
// DATA — uses existing codes from lib/personalization.js
// ============================================
const COUNTRY_GROUPS = [
  { continent: "Americas", countries: [
    { code: "usa", flag: "\u{1F1FA}\u{1F1F8}", name: "United States" },
    { code: "canada", flag: "\u{1F1E8}\u{1F1E6}", name: "Canada" },
  ]},
  { continent: "Europe", countries: [
    { code: "uk", flag: "\u{1F1EC}\u{1F1E7}", name: "United Kingdom" },
    { code: "germany", flag: "\u{1F1E9}\u{1F1EA}", name: "Germany" },
    { code: "france", flag: "\u{1F1EB}\u{1F1F7}", name: "France" },
    { code: "spain", flag: "\u{1F1EA}\u{1F1F8}", name: "Spain" },
    { code: "italy", flag: "\u{1F1EE}\u{1F1F9}", name: "Italy" },
    { code: "ukraine", flag: "\u{1F1FA}\u{1F1E6}", name: "Ukraine" },
    { code: "russia", flag: "\u{1F1F7}\u{1F1FA}", name: "Russia" },
    { code: "turkiye", flag: "\u{1F1F9}\u{1F1F7}", name: "Türkiye" },
  ]},
  { continent: "Asia & Pacific", countries: [
    { code: "china", flag: "\u{1F1E8}\u{1F1F3}", name: "China" },
    { code: "india", flag: "\u{1F1EE}\u{1F1F3}", name: "India" },
    { code: "japan", flag: "\u{1F1EF}\u{1F1F5}", name: "Japan" },
    { code: "australia", flag: "\u{1F1E6}\u{1F1FA}", name: "Australia" },
  ]},
  { continent: "Middle East", countries: [
    { code: "israel", flag: "\u{1F1EE}\u{1F1F1}", name: "Israel" },
  ]},
];
const ALL_COUNTRIES = COUNTRY_GROUPS.flatMap(g => g.countries);

const ISO_TO_CODE = {
  US: "usa", CA: "canada",
  GB: "uk", DE: "germany", FR: "france", ES: "spain", IT: "italy",
  UA: "ukraine", RU: "russia", TR: "turkiye",
  CN: "china", IN: "india", JP: "japan",
  AU: "australia",
  IL: "israel",
};

const TOPIC_CATEGORIES = [
  { name: "Business & Finance", topics: [
    { id: "economics", name: "Economics" }, { id: "stock_markets", name: "Stock Markets" },
    { id: "banking", name: "Banking & Finance" }, { id: "startups", name: "Startups" },
  ]},
  { name: "Technology", topics: [
    { id: "ai", name: "AI" }, { id: "tech_industry", name: "Tech Industry" },
    { id: "consumer_tech", name: "Consumer Tech" }, { id: "cybersecurity", name: "Cybersecurity" },
    { id: "space", name: "Space & Aerospace" },
  ]},
  { name: "Science & Health", topics: [
    { id: "science", name: "Science" }, { id: "climate", name: "Climate" },
    { id: "health", name: "Health & Medicine" }, { id: "biotech", name: "Biotech" },
  ]},
  { name: "Politics & World", topics: [
    { id: "politics", name: "Politics" }, { id: "geopolitics", name: "Geopolitics" },
    { id: "conflicts", name: "Conflicts & Wars" }, { id: "human_rights", name: "Human Rights" },
  ]},
  { name: "Sports", topics: [
    { id: "football", name: "Football" }, { id: "american_football", name: "American Football" },
    { id: "basketball", name: "Basketball" }, { id: "tennis", name: "Tennis" },
    { id: "f1", name: "Formula 1" }, { id: "cricket", name: "Cricket" },
    { id: "combat_sports", name: "Combat Sports" }, { id: "olympics", name: "Olympics" },
  ]},
  { name: "Lifestyle", topics: [
    { id: "entertainment", name: "Entertainment" }, { id: "music", name: "Music" },
    { id: "gaming", name: "Gaming" }, { id: "travel", name: "Travel" },
  ]},
];

// ============================================
// MAIN ONBOARDING FLOW
// ============================================
export default function OnboardingPage() {
  const router = useRouter();
  const [screen, setScreen] = useState(0);
  const [dir, setDir] = useState(1);
  const [homeCountry, setHomeCountry] = useState(null);
  const [followCountries, setFollowCountries] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [saving, setSaving] = useState(false);
  const [detectedCountry, setDetectedCountry] = useState(null);
  const [authMode, setAuthMode] = useState(null);
  const [authError, setAuthError] = useState('');
  const [emailSent, setEmailSent] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const prefs = localStorage.getItem('todayplus_preferences');
      if (prefs && JSON.parse(prefs).onboarding_completed) router.replace('/');
    } catch (e) {}
  }, [router]);

  useEffect(() => {
    fetch('https://api.country.is/')
      .then(r => r.json())
      .then(data => {
        if (data && data.country) {
          const code = ISO_TO_CODE[data.country];
          if (code) { const country = ALL_COUNTRIES.find(c => c.code === code); if (country) setDetectedCountry(country); }
        }
      })
      .catch(() => {});
  }, []);

  const go = (n) => { setDir(n > screen ? 1 : -1); setScreen(n); };
  const toggleFollow = (code) => setFollowCountries(p => p.includes(code) ? p.filter(c=>c!==code) : p.length<5 ? [...p,code] : p);
  const toggleTopic = (id) => setSelectedTopics(p => p.includes(id) ? p.filter(t=>t!==id) : p.length<10 ? [...p,id] : p);

  // ---- auth (sign in for returning users) ----
  const routeAfterAuth = async (user) => {
    try {
      if (user?.id) {
        const r = await fetch(`/api/user/preferences?auth_user_id=${user.id}`);
        if (r.ok) {
          const sp = await r.json();
          if (sp && sp.onboarding_completed) {
            localStorage.setItem('todayplus_preferences', JSON.stringify({
              home_country: sp.home_country, followed_countries: sp.followed_countries || [],
              followed_topics: sp.followed_topics || [], onboarding_completed: true, user_id: sp.id }));
            router.push('/'); return;
          }
        }
      }
    } catch {}
    setAuthMode(null);
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

  const handleComplete = async () => {
    setSaving(true);
    const preferences = {
      home_country: homeCountry,
      followed_countries: followCountries,
      followed_topics: selectedTopics,
      onboarding_completed: true,
      created_at: new Date().toISOString(),
    };
    let authUserId = null;
    try {
      const storedUser = localStorage.getItem('tennews_user');
      if (storedUser) { const userData = JSON.parse(storedUser); authUserId = userData?.id || null; }
    } catch (e) {}
    try {
      const body = { ...preferences };
      if (authUserId) body.auth_user_id = authUserId;
      const response = await fetch('/api/user/onboarding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (response.ok) { const data = await response.json(); preferences.user_id = data.user?.id; }
    } catch (e) { console.warn('API save error, using localStorage only:', e); }
    localStorage.setItem('todayplus_preferences', JSON.stringify(preferences));
    setSaving(false);
    go(4);
  };

  return (
    <div className="ob">
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:ital,wght@0,400;0,500;0,600;0,700;0,800;1,500&family=Instrument+Serif:ital@0;1&display=swap');
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
.ob{position:fixed;inset:0;--paper:#F3ECDD;--ink:#1A1510;--mut:#736B5C;--line:rgba(26,21,16,0.12);--soft:#EAE1CF;--accent:#DA3A24;
  font-family:'Hanken Grotesk',-apple-system,BlinkMacSystemFont,sans-serif;background:var(--paper);color:var(--ink);-webkit-font-smoothing:antialiased;overflow:hidden}
.serif{font-family:'Instrument Serif',Georgia,serif;font-weight:400}

/* living gradient mesh + grain */
.bg{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0}
.mesh{position:absolute;border-radius:50%;filter:blur(60px);will-change:transform}
.m1{width:62vw;height:62vw;max-width:620px;max-height:620px;background:radial-gradient(circle,rgba(255,128,92,0.55),transparent 66%);top:-20vw;right:-14vw;animation:fl1 26s ease-in-out infinite}
.m2{width:54vw;height:54vw;max-width:540px;max-height:540px;background:radial-gradient(circle,rgba(255,196,120,0.5),transparent 66%);bottom:-22vw;left:-16vw;animation:fl2 30s ease-in-out infinite}
.m3{width:46vw;height:46vw;max-width:460px;max-height:460px;background:radial-gradient(circle,rgba(238,150,170,0.42),transparent 68%);top:34%;left:30%;animation:fl3 34s ease-in-out infinite}
.m4{width:40vw;height:40vw;max-width:420px;max-height:420px;background:radial-gradient(circle,rgba(214,58,36,0.18),transparent 70%);bottom:8%;right:-8vw;animation:fl1 38s ease-in-out infinite reverse}
@keyframes fl1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-5vw,4vw) scale(1.08)}}
@keyframes fl2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(6vw,-4vw) scale(1.12)}}
@keyframes fl3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-4vw,-5vw) scale(0.92)}}
.grain{position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.06;mix-blend-mode:multiply;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}

.sc{position:absolute;inset:0;z-index:1;display:flex;flex-direction:column;animation:.55s cubic-bezier(0.22,1,0.36,1) both;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch}
.sc.fwd{animation-name:sf}.sc.back{animation-name:sb}
@keyframes sf{from{opacity:0;transform:translateX(46px) scale(.99)}to{opacity:1;transform:none}}
@keyframes sb{from{opacity:0;transform:translateX(-46px) scale(.99)}to{opacity:1;transform:none}}

/* word-by-word headline reveal (mask rise + blur in) */
.ww{display:inline-block;overflow:hidden;vertical-align:bottom;padding:0 .04em .12em;margin-bottom:-.12em}
.word{display:inline-block;animation:wordUp .9s cubic-bezier(0.2,1,0.3,1) both}
@keyframes wordUp{from{transform:translateY(110%);filter:blur(7px)}to{transform:translateY(0);filter:blur(0)}}
@keyframes riseIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@keyframes chipIn{from{opacity:0;transform:translateY(14px) scale(.9)}to{opacity:1;transform:none}}
@keyframes pop{from{transform:scale(0)}to{transform:scale(1)}}
@keyframes draw{to{stroke-dashoffset:0}}
@keyframes ring{0%{transform:scale(.55);opacity:.85}100%{transform:scale(1.6);opacity:0}}
@keyframes shine{from{transform:translateX(-120%)}to{transform:translateX(320%)}}
.rise{opacity:0;animation:riseIn .65s cubic-bezier(0.22,1,0.36,1) forwards}

/* header */
.hd{display:flex;align-items:center;gap:14px;padding:18px 22px 0;position:relative;z-index:2}
.hd-back{width:42px;height:42px;border-radius:50%;border:1px solid var(--line);background:rgba(255,253,248,0.6);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--ink);transition:all .15s;flex-shrink:0}
.hd-back:hover{background:rgba(255,253,248,0.95)}.hd-back:active{transform:scale(0.92)}
.hd-step{font-size:12px;font-weight:700;color:var(--mut);letter-spacing:1px;text-transform:uppercase}
.hd-step b{color:var(--accent)}
.hd-brand{margin-left:auto;font-family:'Instrument Serif',serif;font-weight:400;font-size:24px;letter-spacing:.2px}
.hd-brand .pl{color:var(--accent)}
.pbar{height:5px;background:rgba(26,21,16,0.08);margin:16px 22px 0;border-radius:999px;overflow:hidden;position:relative;z-index:2}
.pbar-f{height:100%;background:var(--accent);border-radius:999px;transition:width .7s cubic-bezier(0.22,1,0.36,1);position:relative;overflow:hidden}
.pbar-f::after{content:'';position:absolute;top:0;left:0;width:40%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent);animation:shine 2.4s ease-in-out infinite}

.bd{flex:1;max-width:560px;margin:0 auto;width:100%;padding:30px 22px 150px}
.tt{font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:clamp(46px,12vw,76px);color:var(--ink);letter-spacing:-1px;line-height:0.96;margin-bottom:16px}
.tt .ac{color:var(--accent);font-style:italic}
.ds{font-size:17px;color:var(--mut);line-height:1.5;margin-bottom:30px;max-width:420px;font-weight:500}

/* search */
.search{position:relative;margin-bottom:26px}
.search > svg{position:absolute;left:17px;top:50%;transform:translateY(-50%);color:var(--mut);pointer-events:none}
.search input{width:100%;height:54px;padding:0 46px;border-radius:15px;border:1px solid var(--line);background:rgba(255,253,248,0.7);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);font-family:inherit;font-size:16px;color:var(--ink);outline:none;transition:border .15s,box-shadow .15s,background .15s}
.search input::placeholder{color:#A39A88}
.search input:focus{border-color:var(--accent);background:#fffdf8;box-shadow:0 0 0 4px rgba(218,58,36,0.13)}
.search-x{position:absolute;right:12px;top:50%;transform:translateY(-50%);width:28px;height:28px;border-radius:50%;border:none;background:var(--soft);color:var(--mut);font-size:18px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}

/* groups + chips */
.grp{margin-bottom:28px}.grp:last-child{margin-bottom:0}
.grp-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--line)}
.grp-t{font-size:12px;font-weight:700;color:var(--ink);letter-spacing:1px;text-transform:uppercase}
.grp-c{font-size:11px;font-weight:700;color:#B3A992}
.chips{display:flex;flex-wrap:wrap;gap:10px}
.chip{display:inline-flex;align-items:center;gap:8px;height:50px;padding:0 19px;border-radius:999px;border:1px solid var(--line);background:rgba(255,253,248,0.66);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);color:var(--ink);font-family:inherit;font-size:15px;font-weight:600;cursor:pointer;position:relative;opacity:0;animation:chipIn .55s cubic-bezier(0.34,1.4,0.5,1) forwards;transition:background .18s,border-color .18s,transform .18s cubic-bezier(0.34,1.56,0.64,1),box-shadow .24s,color .18s;-webkit-tap-highlight-color:transparent}
.chip:hover:not(:disabled){background:rgba(255,253,248,0.95);border-color:rgba(26,21,16,0.22);transform:translateY(-2px);box-shadow:0 8px 18px rgba(26,21,16,0.08)}
.chip:active:not(:disabled){transform:scale(.93)}
.chip:disabled{opacity:.42;cursor:not-allowed;animation-fill-mode:forwards}
.chip.sel{background:var(--ink);border-color:var(--ink);color:#FBF6EC;transform:translateY(-1px);box-shadow:0 12px 26px rgba(26,21,16,0.26)}
.chip.sel .chip-ck{background:var(--accent)}
.chip-fl{font-size:19px;line-height:1}
.chip-ck{display:flex;align-items:center;justify-content:center;width:19px;height:19px;border-radius:50%;color:#fff;margin-right:-5px;animation:pop .26s cubic-bezier(0.34,1.7,0.5,1)}
.empty{text-align:center;color:var(--mut);font-size:15px;padding:30px 0}

/* footer */
.ft{position:fixed;bottom:0;left:0;right:0;z-index:20;padding:30px 22px 0;background:linear-gradient(180deg,rgba(243,236,221,0),var(--paper) 36%);pointer-events:none}
.ft-in{max-width:460px;margin:0 auto;padding-bottom:calc(22px + env(safe-area-inset-bottom,0px));pointer-events:auto}
.sl{display:block;text-align:center;font-size:13.5px;font-weight:600;color:var(--mut);margin-bottom:13px;transition:color .2s}
.sl .met{color:var(--ink)}.sl .max{color:var(--accent)}
.br{display:flex;gap:10px}
.bt{flex:1;padding:18px;border-radius:15px;border:none;font-family:'Hanken Grotesk',sans-serif;font-size:16.5px;font-weight:700;cursor:pointer;transition:transform .14s,background .18s,box-shadow .2s;-webkit-tap-highlight-color:transparent;user-select:none}
.bt:active{transform:scale(0.975)}
.bt.p{background:var(--accent);color:#fff;box-shadow:0 12px 30px rgba(218,58,36,0.32)}
.bt.p:hover:not(:disabled){background:#C32E1A;transform:translateY(-2px);box-shadow:0 18px 38px rgba(218,58,36,0.4)}
.bt.p:disabled{background:#E4DCCB;color:#ADA48F;cursor:default;box-shadow:none}
.bt.s{background:rgba(255,253,248,0.8);color:var(--ink);border:1px solid var(--line)}
.bt.s:hover{background:#fffdf8}

/* welcome */
.wl{min-height:100%;display:flex;flex-direction:column;padding:0 28px;position:relative;z-index:1}
.wl-bar{display:flex;align-items:center;justify-content:space-between;max-width:480px;width:100%;margin:0 auto;padding:24px 0 0}
.wl-brand{font-family:'Instrument Serif',serif;font-weight:400;font-size:27px;letter-spacing:.2px}
.wl-plus{color:var(--accent)}
.wl-signin{background:rgba(255,253,248,0.55);border:1px solid var(--line);color:var(--ink);font-family:inherit;font-weight:600;font-size:13.5px;cursor:pointer;padding:10px 19px;border-radius:999px;transition:background .15s}
.wl-signin:hover{background:#fffdf8}
.ov{position:fixed;inset:0;z-index:9999;background:rgba(26,21,16,0.5);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto}
.wl-mid{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;max-width:480px;width:100%;margin:0 auto;padding:30px 0}
.wl-kick{font-size:12.5px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:var(--accent);margin-bottom:22px;opacity:0;animation:riseIn .65s ease forwards}
.wl-h{font-family:'Instrument Serif',serif;font-weight:400;font-size:clamp(56px,16vw,92px);letter-spacing:-1.5px;line-height:0.9;margin-bottom:22px}
.wl-h .ac{color:var(--accent);font-style:italic}
.wl-tag{font-size:18px;color:var(--mut);line-height:1.5;max-width:400px;font-weight:500;opacity:0;animation:riseIn .65s ease forwards}
.wl-bot{max-width:480px;width:100%;margin:0 auto;padding:0 0 calc(30px + env(safe-area-inset-bottom,0px))}
.wl-btn{width:100%;padding:20px;border-radius:16px;border:none;font-family:'Hanken Grotesk',sans-serif;font-size:18px;font-weight:700;cursor:pointer;background:var(--accent);color:#fff;box-shadow:0 16px 38px rgba(218,58,36,0.34);transition:transform .14s,background .2s,box-shadow .2s;opacity:0;animation:riseIn .65s ease forwards}
.wl-btn:hover{background:#C32E1A;transform:translateY(-2px);box-shadow:0 22px 46px rgba(218,58,36,0.42)}.wl-btn:active{transform:scale(.985)}
.wl-note{text-align:center;font-size:13px;color:#A39A88;margin-top:14px;font-weight:600;opacity:0;animation:riseIn .65s ease forwards}

/* complete */
.cp{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 32px;position:relative;z-index:1}
.cp-badge{position:relative;width:88px;height:88px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;margin-bottom:30px;opacity:0;animation:pop .55s cubic-bezier(0.34,1.6,0.5,1) forwards;box-shadow:0 18px 40px rgba(218,58,36,0.36)}
.cp-badge::after{content:'';position:absolute;inset:0;border-radius:50%;border:2px solid var(--accent);animation:ring 1.1s ease-out .4s forwards}
.sw-p{stroke-dasharray:60;stroke-dashoffset:60;animation:draw .55s cubic-bezier(0.2,0,0.4,0) .4s forwards}
.cp-t{font-family:'Instrument Serif',serif;font-weight:400;font-size:clamp(48px,12vw,76px);letter-spacing:-1px;line-height:0.94;margin-bottom:14px}
.cp-t .ac{color:var(--accent);font-style:italic}
.cp-s{font-size:17px;color:var(--mut);line-height:1.55;max-width:340px;font-weight:500;opacity:0;animation:riseIn .65s ease .25s forwards}
.cp-b{margin-top:32px;padding:19px 46px;border-radius:16px;border:none;background:var(--accent);color:#fff;font-family:'Hanken Grotesk',sans-serif;font-size:17px;font-weight:700;cursor:pointer;box-shadow:0 16px 36px rgba(218,58,36,0.32);transition:transform .14s,background .2s;opacity:0;animation:riseIn .65s ease .4s forwards}
.cp-b:hover{background:#C32E1A;transform:translateY(-2px)}.cp-b:active{transform:scale(.97)}

@media (prefers-reduced-motion: reduce){
  .word,.rise,.chip,.wl-kick,.wl-tag,.wl-btn,.wl-note,.cp-badge,.cp-s,.cp-b,.sw-p,.mesh,.pbar-f::after{animation:none !important;opacity:1 !important;transform:none !important;stroke-dashoffset:0 !important;filter:none !important}
}
      `}</style>

      <div className="bg" aria-hidden>
        <span className="mesh m1"/><span className="mesh m2"/><span className="mesh m3"/><span className="mesh m4"/>
      </div>
      <div className="grain" aria-hidden/>

      {screen===0 && <WelcomeScreen dir={dir} onStart={()=>go(1)} onSignIn={()=>{setAuthError('');setAuthMode('login');}} />}

      {screen===1 && <Step key="s1" dir={dir} step={1} kick="Your place"
        title={<><Words text="Where's" base={120}/> <Words text="home?" base={300} accent/></>}
        desc={detectedCountry ? `Looks like ${detectedCountry.flag} ${detectedCountry.name} — tap to confirm, or pick your own.` : "We'll open your front page with the news closest to you."}
        onBack={()=>go(0)}
        footer={<Bar
          status={homeCountry ? <span className="met">{ALL_COUNTRIES.find(c=>c.code===homeCountry)?.flag} {ALL_COUNTRIES.find(c=>c.code===homeCountry)?.name}</span> : 'Choose your home country'}
          actions={<button className="bt p" disabled={!homeCountry} onClick={()=>go(2)}>Continue</button>} />}>
        {detectedCountry && <Group title="Best guess" base={0}>
          <Chip i={0} flag={detectedCountry.flag} label={detectedCountry.name} selected={homeCountry===detectedCountry.code} onClick={()=>setHomeCountry(detectedCountry.code)} />
        </Group>}
        {COUNTRY_GROUPS.map((g,gi)=><Group key={g.continent} title={g.continent} base={gi*60}>
          {g.countries.map((c,i)=><Chip key={c.code} i={i} flag={c.flag} label={c.name} selected={homeCountry===c.code} onClick={()=>setHomeCountry(c.code)} />)}
        </Group>)}
      </Step>}

      {screen===2 && <Step key="s2" dir={dir} step={2} kick="Your world"
        title={<><Words text="What else is on your" base={120}/> <Words text="radar?" base={460} accent/></>}
        desc="Add the places you can't look away from. Up to five."
        onBack={()=>go(1)}
        footer={<Bar
          status={<span className={followCountries.length>=5?"max":followCountries.length>0?"met":""}>{followCountries.length>=5?`That's the max — five places`:followCountries.length>0?`${followCountries.length} on your radar`:"Optional — skip if you like"}</span>}
          actions={<><button className="bt s" onClick={()=>go(3)}>Skip</button><button className="bt p" onClick={()=>go(3)}>Continue</button></>} />}>
        {COUNTRY_GROUPS.map((g,gi)=><Group key={g.continent} title={g.continent} base={gi*60}>
          {g.countries.map((c,i)=>{const isHome=c.code===homeCountry;return(
            <Chip key={c.code} i={i} flag={c.flag} label={isHome?`${c.name} · home`:c.name} selected={followCountries.includes(c.code)} disabled={isHome} onClick={()=>!isHome&&toggleFollow(c.code)} />
          );})}
        </Group>)}
      </Step>}

      {screen===3 && <Step key="s3" dir={dir} step={3} kick="Your interests"
        title={<><Words text="What do you" base={120}/> <Words text="care" base={360} accent/> <Words text="about?" base={460}/></>}
        desc="Pick your obsessions. We'll bring the stories that matter."
        onBack={()=>go(2)}
        search={<Search value={query} onChange={setQuery} placeholder="Search topics…" />}
        footer={<Bar
          status={<span className={selectedTopics.length>=10?"max":selectedTopics.length>=3?"met":""}>{selectedTopics.length<3?`Pick ${3-selectedTopics.length} more to continue`:selectedTopics.length>=10?`Ten is the max — nicely curated`:`${selectedTopics.length} in your briefing`}</span>}
          actions={<button className="bt p" disabled={selectedTopics.length<3 || saving} onClick={handleComplete}>{saving ? 'Building…' : 'Build my briefing'}</button>} />}>
        {(() => {
          const q = query.trim().toLowerCase();
          const cats = TOPIC_CATEGORIES.map(cat => ({ ...cat, topics: q ? cat.topics.filter(t => t.name.toLowerCase().includes(q)) : cat.topics })).filter(cat => cat.topics.length);
          if (!cats.length) return <div className="empty">No topics match “{query}”.</div>;
          return cats.map((cat,gi) => <Group key={cat.name} title={cat.name} base={gi*40}>
            {cat.topics.map((t,i) => <Chip key={t.id} i={i} label={t.name} selected={selectedTopics.includes(t.id)} onClick={()=>toggleTopic(t.id)} />)}
          </Group>);
        })()}
      </Step>}

      {screen===4 && <CompScreen dir={dir}
        homeCountry={ALL_COUNTRIES.find(c=>c.code===homeCountry)}
        topics={selectedTopics.map(id=>{for(const cat of TOPIC_CATEGORIES){const t=cat.topics.find(t=>t.id===id);if(t)return t}return null}).filter(Boolean)}
        onStartReading={()=>router.push('/')}
        onBack={()=>go(3)}
      />}

      {authMode && (
        <div className="ov" onClick={()=>setAuthMode(null)}>
          <AuthPanel mode={authMode} onModeChange={(m)=>{setAuthError('');setAuthMode(m);}}
            onLogin={handleLogin} onSignup={handleSignup} onOAuthLogin={handleOAuthLogin}
            onMagicLink={handleMagicLink} onForgotPassword={handleForgotPassword}
            error={authError} onClose={()=>setAuthMode(null)} />
        </div>
      )}
      {emailSent && (
        <div className="ov" onClick={()=>setEmailSent(null)}>
          <EmailConfirmation email={emailSent.email} onBack={()=>setEmailSent(null)} />
        </div>
      )}
    </div>
  );
}

// ============================================
// COMPONENTS
// ============================================
function Words({ text, base = 0, step = 58, accent }) {
  const words = text.split(' ');
  return words.map((w, i) => (
    <span className="ww" key={i}>
      <span className={`word ${accent ? 'ac' : ''}`} style={{ animationDelay: `${base + i * step}ms` }}>{w}</span>
      {i < words.length - 1 ? ' ' : ''}
    </span>
  ));
}

function Chip({ i = 0, flag, label, selected, disabled, onClick }) {
  return (
    <button type="button" className={`chip ${selected ? 'sel' : ''}`} disabled={disabled} onClick={onClick}
      style={{ animationDelay: `${420 + Math.min(i, 12) * 30}ms` }}>
      {flag && <span className="chip-fl">{flag}</span>}
      <span className="chip-lb">{label}</span>
      {selected && (
        <span className="chip-ck">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7"/></svg>
        </span>
      )}
    </button>
  );
}

function Group({ title, base = 0, children }) {
  const count = Array.isArray(children) ? children.length : 1;
  return (
    <div className="grp">
      <div className="grp-h rise" style={{ animationDelay: `${360 + base}ms` }}><span className="grp-t">{title}</span><span className="grp-c">{count}</span></div>
      <div className="chips">{children}</div>
    </div>
  );
}

function Search({ value, onChange, placeholder }) {
  return (
    <div className="search rise" style={{ animationDelay: '420ms' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/></svg>
      <input value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} onKeyDown={(e)=>e.stopPropagation()} />
      {value && <button className="search-x" onClick={()=>onChange('')} aria-label="Clear">×</button>}
    </div>
  );
}

function Bar({ status, actions }) {
  return (
    <div className="ft"><div className="ft-in">
      <div className="sl">{status}</div>
      <div className="br">{actions}</div>
    </div></div>
  );
}

function Step({ dir, step, kick, title, desc, onBack, search, footer, children }) {
  return (
    <>
      <div className={`sc ${dir>0?"fwd":"back"}`}>
        <div className="hd">
          <button className="hd-back" onClick={onBack} aria-label="Back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <span className="hd-step"><b>{String(step).padStart(2,'0')}</b> / 03 · {kick}</span>
          <span className="hd-brand">today<span className="pl">+</span></span>
        </div>
        <div className="pbar"><div className="pbar-f" style={{width:`${(step/3)*100}%`}}/></div>
        <div className="bd">
          <h1 className="tt">{title}</h1>
          <p className="ds rise" style={{animationDelay:'320ms'}}>{desc}</p>
          {search}
          {children}
        </div>
      </div>
      {footer}
    </>
  );
}

function WelcomeScreen({ dir, onStart, onSignIn }) {
  return (
    <div className={`sc ${dir>0?"fwd":"back"}`}>
      <div className="wl">
        <div className="wl-bar" style={{opacity:0,animation:'riseIn .6s ease forwards'}}>
          <span className="wl-brand">today<span className="wl-plus">+</span></span>
          <button className="wl-signin" onClick={onSignIn}>Sign in</button>
        </div>
        <div className="wl-mid">
          <div className="wl-kick" style={{animationDelay:'120ms'}}>The world, made for you</div>
          <h1 className="wl-h">
            <Words text="Let's build your" base={220} step={64}/> <Words text="briefing." base={460} step={64} accent/>
          </h1>
          <p className="wl-tag" style={{animationDelay:'620ms'}}>Three questions. One front page. Ten stories that are entirely, unmistakably yours.</p>
        </div>
        <div className="wl-bot">
          <button className="wl-btn" style={{animationDelay:'760ms'}} onClick={onStart}>Start building</button>
          <div className="wl-note" style={{animationDelay:'860ms'}}>Takes under a minute · No account needed</div>
        </div>
      </div>
    </div>
  );
}

function CompScreen({ dir, homeCountry, topics, onStartReading, onBack }) {
  return (
    <div className={`sc ${dir>0?"fwd":"back"}`}>
      <div className="hd">
        <button className="hd-back" onClick={onBack} aria-label="Back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
      </div>
      <div className="cp">
        <div className="cp-badge">
          <svg viewBox="0 0 52 40" fill="none" width="40" height="32">
            <path className="sw-p" d="M5 22L18 34L47 6" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="cp-t"><Words text="Your briefing is" base={250} step={62}/> <Words text="ready." base={520} step={62} accent/></h1>
        <p className="cp-s">Ten stories{homeCountry ? `, led from ${homeCountry.flag} ${homeCountry.name}` : ''}{topics.length ? `, tuned to ${topics.length} thing${topics.length>1?'s':''} you love` : ''}. Chosen for you, every morning.</p>
        <button className="cp-b" onClick={onStartReading}>Read today’s briefing</button>
      </div>
    </div>
  );
}
