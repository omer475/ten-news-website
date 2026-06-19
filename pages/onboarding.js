import { useState, useEffect, useRef } from "react";
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
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
.ob{position:fixed;inset:0;--ink:#F5F5F7;--mut:#86868B;--line:rgba(245,245,247,0.16);--soft:rgba(245,245,247,0.06);
  font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text','Helvetica Neue',Arial,sans-serif;
  background:#000;color:var(--ink);-webkit-font-smoothing:antialiased;overflow:hidden}

.sc{position:absolute;inset:0;z-index:1;display:flex;flex-direction:column;animation:.55s cubic-bezier(0.22,1,0.36,1) both;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch}
.sc.fwd{animation-name:sf}.sc.back{animation-name:sb}
@keyframes sf{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}
@keyframes sb{from{opacity:0;transform:translateY(-28px)}to{opacity:1;transform:none}}

.ww{display:inline-block;overflow:hidden;vertical-align:bottom;padding:0 .04em .12em;margin-bottom:-.12em}
.word{display:inline-block;animation:wordUp .85s cubic-bezier(0.2,1,0.3,1) both}
@keyframes wordUp{from{transform:translateY(110%);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes riseIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@keyframes chipIn{from{opacity:0;transform:translateY(12px) scale(.94)}to{opacity:1;transform:none}}
@keyframes pop{from{transform:scale(0)}to{transform:scale(1)}}
@keyframes draw{to{stroke-dashoffset:0}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
.rise{opacity:0;animation:riseIn .65s cubic-bezier(0.22,1,0.36,1) forwards}

/* ===== Welcome — logo + sign in + typed line, tap/scroll anywhere ===== */
.wel{position:absolute;inset:0;z-index:1;display:flex;flex-direction:column;cursor:pointer;animation:fadeIn .6s ease both}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.wel-bar{display:flex;align-items:center;justify-content:space-between;padding:24px clamp(22px,6vw,48px) 0}
.wel-brand{font-size:23px;font-weight:600;letter-spacing:-0.02em}
.wel-plus{color:var(--ink)}
.wel-signin{background:var(--soft);border:1px solid var(--line);color:var(--ink);font-family:inherit;font-weight:500;font-size:14px;cursor:pointer;padding:10px 20px;border-radius:980px;transition:background .15s}
.wel-signin:hover{background:rgba(245,245,247,0.12)}
.wel-mid{flex:1;display:flex;align-items:center;padding:0 clamp(22px,6vw,72px) 8vh}
.wel-type{font-size:clamp(44px,9.5vw,104px);font-weight:600;letter-spacing:-0.035em;line-height:1.04;max-width:14ch}
.car{display:inline-block;width:.045em;height:.92em;background:var(--ink);margin-left:.06em;vertical-align:-0.08em;border-radius:2px;animation:blink 1.05s step-end infinite}
.wel-hint{padding:0 clamp(22px,6vw,72px) calc(34px + env(safe-area-inset-bottom,0px));font-size:13.5px;color:#5A5A5E;font-weight:500;opacity:0;animation:riseIn .6s ease 2.6s forwards;letter-spacing:.01em}

/* ===== Step pages (same minimal language) ===== */
.hd{display:flex;align-items:center;gap:14px;padding:20px clamp(22px,6vw,48px) 0;position:relative;z-index:2}
.hd-back{width:42px;height:42px;border-radius:50%;border:1px solid var(--line);background:var(--soft);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--ink);transition:all .15s;flex-shrink:0}
.hd-back:hover{background:rgba(245,245,247,0.12)}.hd-back:active{transform:scale(0.92)}
.hd-step{font-size:12px;font-weight:600;color:var(--mut);letter-spacing:.06em;text-transform:uppercase}
.hd-brand{margin-left:auto;font-size:19px;font-weight:600;letter-spacing:-0.02em}
.pbar{height:3px;background:rgba(245,245,247,0.1);margin:18px clamp(22px,6vw,48px) 0;border-radius:999px;overflow:hidden;position:relative;z-index:2}
.pbar-f{height:100%;background:var(--ink);border-radius:999px;transition:width .7s cubic-bezier(0.22,1,0.36,1)}

.bd{flex:1;max-width:600px;margin:0 auto;width:100%;padding:34px clamp(22px,6vw,30px) 150px}
.tt{font-size:clamp(38px,8.5vw,64px);font-weight:600;color:var(--ink);letter-spacing:-0.035em;line-height:1.0;margin-bottom:16px}
.ds{font-size:17px;color:var(--mut);line-height:1.5;margin-bottom:32px;max-width:440px;font-weight:400}

.search{position:relative;margin-bottom:28px}
.search > svg{position:absolute;left:17px;top:50%;transform:translateY(-50%);color:var(--mut);pointer-events:none}
.search input{width:100%;height:54px;padding:0 46px;border-radius:14px;border:1px solid var(--line);background:var(--soft);font-family:inherit;font-size:16px;color:var(--ink);outline:none;transition:border .15s,box-shadow .15s,background .15s}
.search input::placeholder{color:#6A6A6E}
.search input:focus{border-color:rgba(245,245,247,0.4);background:rgba(245,245,247,0.09)}
.search-x{position:absolute;right:12px;top:50%;transform:translateY(-50%);width:28px;height:28px;border-radius:50%;border:none;background:rgba(245,245,247,0.1);color:var(--mut);font-size:18px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}

.grp{margin-bottom:30px}.grp:last-child{margin-bottom:0}
.grp-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:11px;border-bottom:1px solid var(--line)}
.grp-t{font-size:12px;font-weight:600;color:var(--ink);letter-spacing:.06em;text-transform:uppercase}
.grp-c{font-size:11px;font-weight:600;color:#5A5A5E}
.chips{display:flex;flex-wrap:wrap;gap:10px}
.chip{display:inline-flex;align-items:center;gap:8px;height:50px;padding:0 19px;border-radius:980px;border:1px solid var(--line);background:var(--soft);color:var(--ink);font-family:inherit;font-size:15px;font-weight:500;cursor:pointer;position:relative;opacity:0;animation:chipIn .5s cubic-bezier(0.22,1,0.36,1) forwards;transition:background .18s,border-color .18s,transform .16s cubic-bezier(0.34,1.56,0.64,1),color .18s;-webkit-tap-highlight-color:transparent}
.chip:hover:not(:disabled){background:rgba(245,245,247,0.12);border-color:rgba(245,245,247,0.3);transform:translateY(-2px)}
.chip:active:not(:disabled){transform:scale(.94)}
.chip:disabled{opacity:.36;cursor:not-allowed;animation-fill-mode:forwards}
.chip.sel{background:var(--ink);border-color:var(--ink);color:#000;font-weight:600;transform:translateY(-1px)}
.chip.sel .chip-ck{background:#000}
.chip-fl{font-size:19px;line-height:1}
.chip-ck{display:flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;color:#F5F5F7;margin-right:-5px;animation:pop .24s cubic-bezier(0.34,1.7,0.5,1)}
.empty{text-align:center;color:var(--mut);font-size:15px;padding:30px 0}

.ft{position:fixed;bottom:0;left:0;right:0;z-index:20;padding:36px 22px 0;background:linear-gradient(180deg,rgba(0,0,0,0),#000 42%);pointer-events:none}
.ft-in{max-width:480px;margin:0 auto;padding-bottom:calc(24px + env(safe-area-inset-bottom,0px));pointer-events:auto;display:flex;flex-direction:column;align-items:center;gap:14px}
.sl{font-size:13.5px;font-weight:500;color:var(--mut);transition:color .2s;text-align:center}
.sl .met{color:var(--ink)}.sl .max{color:var(--ink)}
.br{display:flex;gap:10px;justify-content:center}
.bt{height:54px;padding:0 34px;display:inline-flex;align-items:center;justify-content:center;gap:9px;border-radius:980px;border:none;font-family:inherit;font-size:16px;font-weight:600;cursor:pointer;transition:transform .16s cubic-bezier(0.34,1.56,0.64,1),background .18s,opacity .2s;-webkit-tap-highlight-color:transparent;user-select:none}
.bt .arr{display:inline-block;transition:transform .28s cubic-bezier(0.22,1,0.36,1)}
.bt:active{transform:scale(0.97)}
.bt.p{background:var(--ink);color:#000}
.bt.p:hover:not(:disabled){transform:translateY(-1px)}
.bt.p:hover:not(:disabled) .arr{transform:translateX(4px)}
.bt.p:disabled{background:rgba(245,245,247,0.12);color:rgba(245,245,247,0.4);cursor:default}
.bt.s{background:transparent;color:var(--ink);border:1px solid var(--line)}
.bt.s:hover{background:var(--soft)}

/* ===== Complete ===== */
.cp{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 32px;position:relative;z-index:1}
.cp-t{font-size:clamp(44px,10vw,72px);font-weight:600;letter-spacing:-0.04em;line-height:0.98;margin-bottom:16px;max-width:13ch}
.cp-s{font-size:17px;color:var(--mut);line-height:1.5;max-width:360px;font-weight:400;opacity:0;animation:riseIn .65s ease .3s forwards}
.cp-b{margin-top:34px;height:56px;padding:0 40px;display:inline-flex;align-items:center;gap:9px;border-radius:980px;border:none;background:var(--ink);color:#000;font-family:inherit;font-size:16px;font-weight:600;cursor:pointer;transition:transform .16s;opacity:0;animation:riseIn .65s ease .5s forwards}
.cp-b .arr{display:inline-block;transition:transform .28s cubic-bezier(0.22,1,0.36,1)}
.cp-b:hover{transform:translateY(-1px)}.cp-b:hover .arr{transform:translateX(4px)}.cp-b:active{transform:scale(.97)}

.ov{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto}

@media (prefers-reduced-motion: reduce){
  .word,.rise,.chip,.wel,.wel-hint,.cp-s,.cp-b,.car{animation:none !important;opacity:1 !important;transform:none !important}
}
      `}</style>

      {screen===0 && <WelcomeScreen onStart={()=>go(1)} onSignIn={()=>{setAuthError('');setAuthMode('login');}} />}

      {screen===1 && <Step key="s1" dir={dir} step={1} kick="Your place"
        title={<><Words text="Where's" base={120}/> <Words text="home?" base={300}/></>}
        desc={detectedCountry ? `Looks like ${detectedCountry.flag} ${detectedCountry.name} — tap to confirm, or pick your own.` : "We'll open your front page with the news closest to you."}
        onBack={()=>go(0)}
        footer={<Bar
          status={homeCountry ? <span className="met">{ALL_COUNTRIES.find(c=>c.code===homeCountry)?.flag} {ALL_COUNTRIES.find(c=>c.code===homeCountry)?.name}</span> : 'Choose your home country'}
          actions={<button className="bt p" disabled={!homeCountry} onClick={()=>go(2)}>Continue<Arrow/></button>} />}>
        {detectedCountry && <Group title="Best guess" base={0}>
          <Chip i={0} flag={detectedCountry.flag} label={detectedCountry.name} selected={homeCountry===detectedCountry.code} onClick={()=>setHomeCountry(detectedCountry.code)} />
        </Group>}
        {COUNTRY_GROUPS.map((g,gi)=><Group key={g.continent} title={g.continent} base={gi*60}>
          {g.countries.map((c,i)=><Chip key={c.code} i={i} flag={c.flag} label={c.name} selected={homeCountry===c.code} onClick={()=>setHomeCountry(c.code)} />)}
        </Group>)}
      </Step>}

      {screen===2 && <Step key="s2" dir={dir} step={2} kick="Your world"
        title={<><Words text="What else is on your" base={120}/> <Words text="radar?" base={460}/></>}
        desc="Add the places you can't look away from. Up to five."
        onBack={()=>go(1)}
        footer={<Bar
          status={<span className={followCountries.length>=5?"max":followCountries.length>0?"met":""}>{followCountries.length>=5?`That's the max — five places`:followCountries.length>0?`${followCountries.length} on your radar`:"Optional — skip if you like"}</span>}
          actions={<><button className="bt s" onClick={()=>go(3)}>Skip</button><button className="bt p" onClick={()=>go(3)}>Continue<Arrow/></button></>} />}>
        {COUNTRY_GROUPS.map((g,gi)=><Group key={g.continent} title={g.continent} base={gi*60}>
          {g.countries.map((c,i)=>{const isHome=c.code===homeCountry;return(
            <Chip key={c.code} i={i} flag={c.flag} label={isHome?`${c.name} · home`:c.name} selected={followCountries.includes(c.code)} disabled={isHome} onClick={()=>!isHome&&toggleFollow(c.code)} />
          );})}
        </Group>)}
      </Step>}

      {screen===3 && <Step key="s3" dir={dir} step={3} kick="Your interests"
        title={<><Words text="What do you" base={120}/> <Words text="care about?" base={360}/></>}
        desc="Pick your obsessions. We'll bring the stories that matter."
        onBack={()=>go(2)}
        search={<Search value={query} onChange={setQuery} placeholder="Search topics…" />}
        footer={<Bar
          status={<span className={selectedTopics.length>=10?"max":selectedTopics.length>=3?"met":""}>{selectedTopics.length<3?`Pick ${3-selectedTopics.length} more to continue`:selectedTopics.length>=10?`Ten is the max — nicely curated`:`${selectedTopics.length} in your briefing`}</span>}
          actions={<button className="bt p" disabled={selectedTopics.length<3 || saving} onClick={handleComplete}>{saving ? 'Building…' : <>Build my briefing<Arrow/></>}</button>} />}>
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
function Arrow() {
  return (
    <svg className="arr" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h13"/><path d="M12 5l7 7-7 7"/></svg>
  );
}

function Words({ text, base = 0, step = 58 }) {
  const words = text.split(' ');
  return words.map((w, i) => (
    <span className="ww" key={i}>
      <span className="word" style={{ animationDelay: `${base + i * step}ms` }}>{w}</span>
      {i < words.length - 1 ? ' ' : ''}
    </span>
  ));
}

function Chip({ i = 0, flag, label, selected, disabled, onClick }) {
  return (
    <button type="button" className={`chip ${selected ? 'sel' : ''}`} disabled={disabled} onClick={onClick}
      style={{ animationDelay: `${380 + Math.min(i, 12) * 28}ms` }}>
      {flag && <span className="chip-fl">{flag}</span>}
      <span className="chip-lb">{label}</span>
      {selected && (
        <span className="chip-ck">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7"/></svg>
        </span>
      )}
    </button>
  );
}

function Group({ title, base = 0, children }) {
  const count = Array.isArray(children) ? children.length : 1;
  return (
    <div className="grp">
      <div className="grp-h rise" style={{ animationDelay: `${340 + base}ms` }}><span className="grp-t">{title}</span><span className="grp-c">{count}</span></div>
      <div className="chips">{children}</div>
    </div>
  );
}

function Search({ value, onChange, placeholder }) {
  return (
    <div className="search rise" style={{ animationDelay: '400ms' }}>
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
          <span className="hd-step">{String(step).padStart(2,'0')} / 03 · {kick}</span>
          <span className="hd-brand">today<span style={{color:'var(--ink)'}}>+</span></span>
        </div>
        <div className="pbar"><div className="pbar-f" style={{width:`${(step/3)*100}%`}}/></div>
        <div className="bd">
          <h1 className="tt">{title}</h1>
          <p className="ds rise" style={{animationDelay:'300ms'}}>{desc}</p>
          {search}
          {children}
        </div>
      </div>
      {footer}
    </>
  );
}

function WelcomeScreen({ onStart, onSignIn }) {
  const full = "Let’s start your briefing.";
  const [typed, setTyped] = useState('');
  const fired = useRef(false);

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => { i++; setTyped(full.slice(0, i)); if (i >= full.length) clearInterval(id); }, 62);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const advance = () => { if (fired.current) return; fired.current = true; onStart(); };
    const onWheel = (e) => { if (e.deltaY > 2) advance(); };
    let sy = 0;
    const onTS = (e) => { sy = e.touches[0].clientY; };
    const onTM = (e) => { if (sy - e.touches[0].clientY > 26) advance(); };
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTS, { passive: true });
    window.addEventListener('touchmove', onTM, { passive: true });
    return () => { window.removeEventListener('wheel', onWheel); window.removeEventListener('touchstart', onTS); window.removeEventListener('touchmove', onTM); };
  }, [onStart]);

  const tap = (e) => {
    if (e.target.closest('.wel-signin')) return;
    if (fired.current) return; fired.current = true; onStart();
  };

  return (
    <div className="wel" onClick={tap}>
      <div className="wel-bar">
        <span className="wel-brand">today<span className="wel-plus">+</span></span>
        <button className="wel-signin" onClick={(e)=>{e.stopPropagation();onSignIn();}}>Sign in</button>
      </div>
      <div className="wel-mid">
        <h1 className="wel-type">{typed}<span className="car" /></h1>
      </div>
      <div className="wel-hint">Tap anywhere to begin</div>
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
        <h1 className="cp-t"><Words text="Your briefing is" base={200} step={60}/> <Words text="ready." base={460} step={60}/></h1>
        <p className="cp-s">Ten stories{homeCountry ? `, led from ${homeCountry.flag} ${homeCountry.name}` : ''}{topics.length ? `, tuned to ${topics.length} thing${topics.length>1?'s':''} you love` : ''}. Chosen for you, every morning.</p>
        <button className="cp-b" onClick={onStartReading}>Read today’s briefing<Arrow/></button>
      </div>
    </div>
  );
}
