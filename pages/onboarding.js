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
    setAuthMode(null); // signed in but not onboarded — continue here
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
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500..700&display=swap');
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap');
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
.ob{position:fixed;inset:0;--paper:#FBFAF8;--ink:#17150F;--mut:#6B6760;--line:rgba(23,21,15,0.10);--soft:#F4F1EB;--accent:#CC2E22;
  font-family:'Satoshi',-apple-system,BlinkMacSystemFont,sans-serif;background:var(--paper);color:var(--ink);-webkit-font-smoothing:antialiased;overflow:hidden}
.disp{font-family:'Fraunces',Georgia,serif;font-weight:600}

.sc{position:absolute;inset:0;display:flex;flex-direction:column;animation:.42s cubic-bezier(0.22,1,0.36,1) both;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch}
.sc.fwd{animation-name:sf}.sc.back{animation-name:sb}
@keyframes sf{from{opacity:0;transform:translateX(36px)}to{opacity:1;transform:none}}
@keyframes sb{from{opacity:0;transform:translateX(-36px)}to{opacity:1;transform:none}}
@keyframes pop{from{transform:scale(0)}to{transform:scale(1)}}
@keyframes rin{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes draw{to{stroke-dashoffset:0}}
.rin{opacity:0;animation:rin .55s cubic-bezier(0.22,1,0.36,1) forwards}

.hd{display:flex;align-items:center;gap:12px;padding:16px 20px 0;position:sticky;top:0;z-index:10;background:rgba(251,250,248,0.86);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
.hd-back{width:38px;height:38px;border-radius:50%;border:1px solid var(--line);background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--ink);transition:all .15s;flex-shrink:0}
.hd-back:active{transform:scale(0.92);background:var(--soft)}
.hd-step{font-size:11px;font-weight:700;color:var(--mut);letter-spacing:1.4px;text-transform:uppercase}
.hd-brand{margin-left:auto;font-family:'Fraunces',serif;font-weight:600;font-size:18px}
.hd-brand .pl{color:var(--accent)}
.pbar{height:4px;background:rgba(23,21,15,0.08);margin:14px 20px 0;border-radius:999px;overflow:hidden}
.pbar-f{height:100%;background:var(--accent);border-radius:999px;transition:width .45s cubic-bezier(0.22,1,0.36,1)}

.bd{flex:1;max-width:480px;margin:0 auto;width:100%;padding:26px 20px 130px}
.eyebrow{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:var(--accent);margin-bottom:12px}
.eyebrow::before{content:'';width:16px;height:2px;background:var(--accent)}
.tt{font-family:'Fraunces',serif;font-size:clamp(28px,6.4vw,38px);font-weight:600;color:var(--ink);letter-spacing:-0.6px;line-height:1.05;margin-bottom:8px}
.ds{font-size:15.5px;color:var(--mut);line-height:1.55;margin-bottom:26px;max-width:360px}

.con{font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:1.2px;margin:22px 0 11px;padding-left:2px}
.con:first-child{margin-top:0}
.cat{margin-bottom:22px}
.cat-t{font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:11px;padding-left:2px}
.gr{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}

.tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:15px 6px;min-height:80px;border-radius:14px;border:1px solid var(--line);background:#fff;color:var(--ink);cursor:pointer;font-family:inherit;position:relative;transition:background .16s,border-color .16s,transform .12s,box-shadow .18s;-webkit-tap-highlight-color:transparent}
.tile:hover:not(:disabled){background:var(--soft)}
.tile:active:not(:disabled){transform:scale(.96)}
.tile:disabled{opacity:.4;cursor:not-allowed}
.tile.sel{border-color:var(--accent);background:#FBF0EE;box-shadow:0 8px 20px rgba(204,46,34,0.12)}
.tile-ic{font-size:25px;line-height:1}
.tile-lb{font-size:11.5px;font-weight:600;color:var(--mut);text-align:center;line-height:1.25}
.tile.txt .tile-lb{font-size:13.5px;color:var(--ink)}
.tile.sel .tile-lb{color:var(--accent)}
.tile-ck{position:absolute;top:6px;right:6px;width:18px;height:18px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;animation:pop .25s cubic-bezier(0.34,1.56,0.64,1)}

.ft{position:fixed;bottom:0;left:0;right:0;z-index:20;padding:18px 20px 0;background:linear-gradient(180deg,rgba(251,250,248,0),var(--paper) 38%);pointer-events:none}
.ft-in{max-width:440px;margin:0 auto;padding-bottom:calc(20px + env(safe-area-inset-bottom,0px));pointer-events:auto}
.sl{display:block;text-align:center;font-size:13px;font-weight:600;color:var(--mut);margin-bottom:11px;transition:color .2s}
.sl.met{color:var(--ink)}.sl.max{color:var(--accent)}
.br{display:flex;gap:10px}
.bt{flex:1;padding:16px;border-radius:13px;border:none;font-family:inherit;font-size:16px;font-weight:700;cursor:pointer;transition:transform .12s,background .18s,box-shadow .2s;-webkit-tap-highlight-color:transparent;user-select:none}
.bt:active{transform:scale(0.975)}
.bt.p{background:var(--accent);color:#fff;box-shadow:0 10px 24px rgba(204,46,34,0.24)}
.bt.p:hover:not(:disabled){background:#B5281D}
.bt.p:disabled{background:#E7E3DB;color:#AFA99E;cursor:default;box-shadow:none}
.bt.s{background:#fff;color:var(--ink);border:1px solid var(--line)}
.bt.s:hover{background:var(--soft)}

/* Welcome */
.wl{min-height:100%;display:flex;flex-direction:column;padding:0 28px;position:relative;overflow:hidden}
.wl-bar{display:flex;align-items:center;justify-content:space-between;max-width:400px;width:100%;margin:0 auto;padding:24px 0 0}
.wl-brand{font-family:'Fraunces',serif;font-weight:600;font-size:22px;letter-spacing:-0.3px}
.wl-plus{color:var(--accent)}
.wl-signin{background:none;border:1px solid var(--line);color:var(--ink);font-family:inherit;font-weight:600;font-size:13.5px;cursor:pointer;padding:9px 18px;border-radius:999px;transition:background .15s}
.wl-signin:hover{background:var(--soft)}
.ov{position:fixed;inset:0;z-index:9999;background:rgba(23,21,15,0.5);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto}
.wl-mid{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;max-width:400px;width:100%;margin:0 auto;padding:30px 0}
.wl-eyebrow{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--accent);margin-bottom:18px}
.wl-eyebrow::before{content:'';width:18px;height:2px;background:var(--accent)}
.wl-h{font-family:'Fraunces',serif;font-weight:600;font-size:clamp(36px,9.5vw,50px);letter-spacing:-1.4px;line-height:1.0;margin-bottom:16px}
.wl-tag{font-size:15.5px;color:var(--mut);line-height:1.55;max-width:340px}
.wl-bot{max-width:400px;width:100%;margin:0 auto;padding:0 0 calc(28px + env(safe-area-inset-bottom,0px))}
.wl-btn{width:100%;padding:18px;border-radius:14px;border:none;font-family:inherit;font-size:17px;font-weight:700;cursor:pointer;background:var(--accent);color:#fff;box-shadow:0 12px 30px rgba(204,46,34,0.26);transition:transform .12s,background .2s}
.wl-btn:hover{background:#B5281D}.wl-btn:active{transform:scale(.985)}
.wl-note{text-align:center;font-size:12.5px;color:#A8A296;margin-top:12px;font-weight:600}

/* Complete */
.cp{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 32px}
.cp-badge{width:72px;height:72px;border-radius:50%;background:#FBF0EE;border:1px solid rgba(204,46,34,0.2);display:flex;align-items:center;justify-content:center;margin-bottom:22px}
.sw-p{stroke-dasharray:72;stroke-dashoffset:72;animation:draw .5s cubic-bezier(0.12,0,0.39,0) .15s forwards}
.cp-t{font-family:'Fraunces',serif;font-weight:600;font-size:clamp(30px,7vw,40px);letter-spacing:-0.8px;line-height:1.05;margin-bottom:12px}
.cp-s{font-size:15.5px;color:var(--mut);line-height:1.6;max-width:300px}
.cp-b{margin-top:28px;padding:17px 42px;border-radius:14px;border:none;background:var(--accent);color:#fff;font-family:inherit;font-size:16px;font-weight:700;cursor:pointer;box-shadow:0 12px 28px rgba(204,46,34,0.26);transition:transform .12s,background .2s}
.cp-b:hover{background:#B5281D}.cp-b:active{transform:scale(.97)}

@media(max-width:360px){.gr{grid-template-columns:repeat(2,1fr)}}
      `}</style>

      {screen===0 && <WelcomeScreen dir={dir} onStart={()=>go(1)} onSignIn={()=>{setAuthError('');setAuthMode('login');}} />}

      {screen===1 && <Step key="s1" dir={dir} step={1}
        eyebrow="Where you're based"
        title="Where are you based?"
        desc={detectedCountry ? `Looks like you're in ${detectedCountry.flag} ${detectedCountry.name} — tap to confirm.` : "We'll lead your feed with news from home."}
        onBack={()=>go(0)}
        footer={<div className="ft"><div className="ft-in">
          {homeCountry && <div className="sl met">{ALL_COUNTRIES.find(c=>c.code===homeCountry)?.flag} {ALL_COUNTRIES.find(c=>c.code===homeCountry)?.name}</div>}
          <div className="br"><button className="bt p" disabled={!homeCountry} onClick={()=>go(2)}>Continue</button></div>
        </div></div>}>
        {detectedCountry && <div><div className="con">Our guess</div><div className="gr">
          <Tile icon={detectedCountry.flag} label={detectedCountry.name} selected={homeCountry===detectedCountry.code} onClick={()=>setHomeCountry(detectedCountry.code)} />
        </div></div>}
        {COUNTRY_GROUPS.map(g=><div key={g.continent}><div className="con">{g.continent}</div><div className="gr">
          {g.countries.map(c=><Tile key={c.code} icon={c.flag} label={c.name} selected={homeCountry===c.code} onClick={()=>setHomeCountry(c.code)} />)}
        </div></div>)}
      </Step>}

      {screen===2 && <Step key="s2" dir={dir} step={2}
        eyebrow="On your radar"
        title="Anywhere else on your radar?"
        desc="Add up to five more places you want to keep an eye on."
        onBack={()=>go(1)}
        footer={<div className="ft"><div className="ft-in">
          <div className={`sl ${followCountries.length>=5?"max":followCountries.length>0?"met":""}`}>{followCountries.length>=5?`Maximum reached (5 of 5)`:followCountries.length>0?`${followCountries.length} of 5 selected`:"None selected — that's fine too"}</div>
          <div className="br"><button className="bt s" onClick={()=>go(3)}>Skip</button><button className="bt p" onClick={()=>go(3)}>Continue</button></div>
        </div></div>}>
        {COUNTRY_GROUPS.map(g=><div key={g.continent}><div className="con">{g.continent}</div><div className="gr">
          {g.countries.map(c=>{const isHome=c.code===homeCountry;return(
            <Tile key={c.code} icon={c.flag} label={isHome?`${c.name} (home)`:c.name} selected={followCountries.includes(c.code)} disabled={isHome} onClick={()=>!isHome&&toggleFollow(c.code)} />
          );})}
        </div></div>)}
      </Step>}

      {screen===3 && <Step key="s3" dir={dir} step={3}
        eyebrow="Your interests"
        title="What are you into?"
        desc="Pick 3 to 10 topics. You can change these anytime."
        onBack={()=>go(2)}
        footer={<div className="ft"><div className="ft-in">
          <div className={`sl ${selectedTopics.length>=10?"max":selectedTopics.length>=3?"met":""}`}>{selectedTopics.length<3?`Select ${3-selectedTopics.length} more`:selectedTopics.length>=10?`Maximum reached (10 of 10)`:`${selectedTopics.length} of 10 selected`}</div>
          <div className="br"><button className="bt p" disabled={selectedTopics.length<3 || saving} onClick={handleComplete}>{saving ? 'Setting up…' : 'Continue'}</button></div>
        </div></div>}>
        {TOPIC_CATEGORIES.map(cat=><div key={cat.name} className="cat"><div className="cat-t">{cat.name}</div><div className="gr">
          {cat.topics.map(t=><Tile key={t.id} text label={t.name} selected={selectedTopics.includes(t.id)} onClick={()=>toggleTopic(t.id)} />)}
        </div></div>)}
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
function Tile({ icon, label, text, selected, disabled, onClick }) {
  return (
    <button type="button" className={`tile ${text ? 'txt' : ''} ${selected ? 'sel' : ''}`} disabled={disabled} onClick={onClick}>
      {selected && (
        <span className="tile-ck">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7"/></svg>
        </span>
      )}
      {icon && <span className="tile-ic">{icon}</span>}
      <span className="tile-lb">{label}</span>
    </button>
  );
}

function Step({ dir, step, eyebrow, title, desc, onBack, footer, children }) {
  return (
    <>
      <div className={`sc ${dir>0?"fwd":"back"}`}>
        <div className="hd">
          <button className="hd-back" onClick={onBack} aria-label="Back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <span className="hd-step">Step {step} of 3</span>
          <span className="hd-brand">today<span className="pl">+</span></span>
        </div>
        <div className="pbar"><div className="pbar-f" style={{width:`${(step/3)*100}%`}}/></div>
        <div className="bd">
          <div className="eyebrow rin">{eyebrow}</div>
          <h1 className="tt rin" style={{animationDelay:'40ms'}}>{title}</h1>
          <p className="ds rin" style={{animationDelay:'90ms'}}>{desc}</p>
          <div className="rin" style={{animationDelay:'150ms'}}>{children}</div>
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
        <div className="wl-bar rin">
          <span className="wl-brand">today<span className="wl-plus">+</span></span>
          <button className="wl-signin" onClick={onSignIn}>Sign in</button>
        </div>
        <div className="wl-mid">
          <div className="wl-eyebrow rin">Let’s set you up</div>
          <h1 className="wl-h rin" style={{animationDelay:'70ms'}}>Let’s build<br/>your briefing.</h1>
          <p className="wl-tag rin" style={{animationDelay:'150ms'}}>Three quick steps — your home, the places on your radar, and the topics you care about. Then your front page is yours.</p>
        </div>
        <div className="wl-bot rin" style={{animationDelay:'230ms'}}>
          <button className="wl-btn" onClick={onStart}>Get started</button>
          <div className="wl-note">Takes under a minute</div>
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
        <span className="hd-step" style={{marginLeft:'auto',visibility:'hidden'}}>·</span>
      </div>
      <div className="cp">
        <div className="cp-badge rin">
          <svg viewBox="0 0 52 40" fill="none" width="38" height="30">
            <path className="sw-p" d="M4 22L18 34L48 6" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="cp-t rin" style={{animationDelay:'80ms'}}>You’re all set.</h1>
        <p className="cp-s rin" style={{animationDelay:'150ms'}}>Your front page is ready{homeCountry ? ` — leading with ${homeCountry.flag} ${homeCountry.name}` : ''}{topics.length ? ` and ${topics.length} topic${topics.length>1?'s':''} you chose` : ''}.</p>
        <button className="cp-b rin" style={{animationDelay:'230ms'}} onClick={onStartReading}>Start reading</button>
      </div>
    </div>
  );
}
