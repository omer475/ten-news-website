import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Avatar, { AVATAR_COLORS, FACE_COUNT, ACCESSORY_COUNT, avatarFromSeed } from "../components/Avatar";
import { getStoredAvatar, storeAvatar } from "../components/AuthForms";

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

// Map ISO 3166-1 alpha-2 codes (from IP geolocation) to our internal codes
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
    { id: "economics", name: "Economics", icon: "\u{1F4B0}" },
    { id: "stock_markets", name: "Stock Markets", icon: "\u{1F4C8}" },
    { id: "banking", name: "Banking & Finance", icon: "\u{1F3E6}" },
    { id: "startups", name: "Startups", icon: "\u{1F680}" },
  ]},
  { name: "Technology", topics: [
    { id: "ai", name: "AI", icon: "\u{1F916}" },
    { id: "tech_industry", name: "Tech Industry", icon: "\u{1F4BB}" },
    { id: "consumer_tech", name: "Consumer Tech", icon: "\u{1F4F1}" },
    { id: "cybersecurity", name: "Cybersecurity", icon: "\u{1F510}" },
    { id: "space", name: "Space & Aerospace", icon: "\u{1F6F8}" },
  ]},
  { name: "Science & Health", topics: [
    { id: "science", name: "Science", icon: "\u{1F52C}" },
    { id: "climate", name: "Climate", icon: "\u{1F30D}" },
    { id: "health", name: "Health & Medicine", icon: "\u{1FA7A}" },
    { id: "biotech", name: "Biotech", icon: "\u{1F9EC}" },
  ]},
  { name: "Politics & World", topics: [
    { id: "politics", name: "Politics", icon: "\u{1F3DB}️" },
    { id: "geopolitics", name: "Geopolitics", icon: "\u{1F310}" },
    { id: "conflicts", name: "Conflicts & Wars", icon: "⚔️" },
    { id: "human_rights", name: "Human Rights", icon: "\u{1F4DC}" },
  ]},
  { name: "Sports", topics: [
    { id: "football", name: "Football", icon: "⚽" },
    { id: "american_football", name: "American Football", icon: "\u{1F3C8}" },
    { id: "basketball", name: "Basketball", icon: "\u{1F3C0}" },
    { id: "tennis", name: "Tennis", icon: "\u{1F3BE}" },
    { id: "f1", name: "Formula 1", icon: "\u{1F3CE}️" },
    { id: "cricket", name: "Cricket", icon: "\u{1F3CF}" },
    { id: "combat_sports", name: "Combat Sports", icon: "\u{1F94A}" },
    { id: "olympics", name: "Olympics", icon: "\u{1F3C5}" },
  ]},
  { name: "Lifestyle", topics: [
    { id: "entertainment", name: "Entertainment", icon: "\u{1F3AC}" },
    { id: "music", name: "Music", icon: "\u{1F3B5}" },
    { id: "gaming", name: "Gaming", icon: "\u{1F3AE}" },
    { id: "travel", name: "Travel", icon: "✈️" },
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
  const [avatar, setAvatar] = useState(() => avatarFromSeed("today+"));

  // Already onboarded? skip. Also adopt a previously-picked avatar.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const prefs = localStorage.getItem('todayplus_preferences');
      if (prefs && JSON.parse(prefs).onboarding_completed) { router.replace('/'); return; }
    } catch (e) {}
    const stored = getStoredAvatar();
    if (stored) setAvatar(stored);
  }, [router]);

  // Detect user's country via IP geolocation
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

  const handleComplete = async () => {
    setSaving(true);
    storeAvatar(avatar);
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
@import url('https://api.fontshare.com/v2/css?f[]=clash-display@600,700&f[]=satoshi@400,500,700,900&display=swap');
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
.ob{position:fixed;inset:0;--bg:#0B0A09;--surface:#16140F;--surface2:#1C1A14;--ink:#F4EFE6;--mut:#9A9488;--line:rgba(244,239,230,0.11);--accent:#FF5C38;--accent2:#FFB23E;
  font-family:'Satoshi',-apple-system,BlinkMacSystemFont,sans-serif;background:var(--bg);color:var(--ink);-webkit-font-smoothing:antialiased;overflow:hidden}
.disp{font-family:'Clash Display','Satoshi',sans-serif;font-weight:600}

.sc{position:absolute;inset:0;display:flex;flex-direction:column;animation:.42s cubic-bezier(0.22,1,0.36,1) both;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch}
.sc.fwd{animation-name:sf}.sc.back{animation-name:sb}
@keyframes sf{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:none}}
@keyframes sb{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:none}}
@keyframes pop{from{transform:scale(0)}to{transform:scale(1)}}
@keyframes rin{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.rin{opacity:0;animation:rin .55s cubic-bezier(0.22,1,0.36,1) forwards}

/* Header */
.hd{display:flex;align-items:center;gap:12px;padding:16px 20px 0;position:sticky;top:0;z-index:10;background:rgba(11,10,9,0.82);backdrop-filter:blur(16px) saturate(160%);-webkit-backdrop-filter:blur(16px) saturate(160%)}
.hd-back{width:38px;height:38px;border-radius:50%;border:1px solid var(--line);background:rgba(244,239,230,0.05);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--ink);transition:all .15s;flex-shrink:0}
.hd-back:active{transform:scale(0.92);background:rgba(244,239,230,0.12)}
.hd-step{font-size:11px;font-weight:700;color:var(--mut);letter-spacing:1.4px;text-transform:uppercase}
.hd-av{margin-left:auto;flex-shrink:0;filter:drop-shadow(0 6px 12px rgba(0,0,0,0.4))}
.pbar{height:4px;background:rgba(244,239,230,0.09);margin:14px 20px 0;border-radius:999px;overflow:hidden}
.pbar-f{height:100%;background:var(--accent);border-radius:999px;transition:width .45s cubic-bezier(0.22,1,0.36,1);box-shadow:0 0 12px rgba(255,92,56,0.5)}

/* Body */
.bd{flex:1;max-width:480px;margin:0 auto;width:100%;padding:26px 20px 130px}
.eyebrow{font-size:11px;font-weight:700;letter-spacing:1.6px;color:var(--accent);margin-bottom:12px}
.tt{font-size:clamp(28px,6.5vw,38px);font-weight:600;color:var(--ink);letter-spacing:-1.2px;line-height:1.04;margin-bottom:8px}
.ds{font-size:15.5px;color:var(--mut);line-height:1.55;margin-bottom:26px;max-width:360px}

/* Section labels + grid */
.con{font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:1.2px;margin:22px 0 11px;padding-left:2px}
.con:first-child{margin-top:0}
.cat{margin-bottom:22px}
.cat-t{font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:11px;padding-left:2px}
.gr{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}

/* Tile */
.tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:15px 6px;min-height:82px;border-radius:16px;border:1px solid var(--line);background:rgba(244,239,230,0.04);color:var(--ink);cursor:pointer;font-family:inherit;position:relative;transition:background .16s,border-color .16s,transform .12s;-webkit-tap-highlight-color:transparent}
.tile:hover:not(:disabled){background:rgba(244,239,230,0.08)}
.tile:active:not(:disabled){transform:scale(.96)}
.tile:disabled{opacity:.3;cursor:not-allowed}
.tile.sel{border-color:var(--accent);background:rgba(255,92,56,0.13);box-shadow:0 8px 22px rgba(255,92,56,0.16)}
.tile-ic{font-size:25px;line-height:1}
.tile-lb{font-size:11px;font-weight:600;color:var(--mut);text-align:center;line-height:1.2}
.tile.sel .tile-lb{color:var(--accent)}
.tile-ck{position:absolute;top:6px;right:6px;width:18px;height:18px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;animation:pop .25s cubic-bezier(0.34,1.56,0.64,1)}

/* Footer */
.ft{position:fixed;bottom:0;left:0;right:0;z-index:20;padding:18px 20px 0;background:linear-gradient(180deg,transparent,var(--bg) 38%);pointer-events:none}
.ft-in{max-width:440px;margin:0 auto;padding-bottom:calc(20px + env(safe-area-inset-bottom,0px));pointer-events:auto}
.sl{display:block;text-align:center;font-size:13px;font-weight:600;color:var(--mut);margin-bottom:11px;transition:color .2s}
.sl.met{color:var(--ink)}.sl.max{color:var(--accent2)}
.br{display:flex;gap:10px}
.bt{flex:1;padding:16px;border-radius:14px;border:none;font-family:inherit;font-size:16px;font-weight:700;cursor:pointer;transition:transform .12s,background .18s,box-shadow .2s;-webkit-tap-highlight-color:transparent;user-select:none}
.bt:active{transform:scale(0.975)}
.bt.p{background:var(--accent);color:#1A0E08;box-shadow:0 12px 28px rgba(255,92,56,0.32)}
.bt.p:hover:not(:disabled){background:#FF6B49}
.bt.p:disabled{background:rgba(244,239,230,0.08);color:rgba(244,239,230,0.3);cursor:default;box-shadow:none}
.bt.s{background:rgba(244,239,230,0.06);color:var(--ink);border:1px solid var(--line)}
.bt.s:hover{background:rgba(244,239,230,0.11)}

/* Welcome */
.wl{min-height:100%;display:flex;flex-direction:column;padding:0 28px;position:relative;overflow:hidden;
  background:radial-gradient(120% 80% at 80% 0%,rgba(255,92,56,0.16),transparent 55%),radial-gradient(90% 70% at 0% 100%,rgba(255,178,62,0.08),transparent 55%)}
.wl-brand{font-family:'Clash Display';font-weight:700;font-size:22px;letter-spacing:-0.4px;padding:22px 0 0}
.wl-plus{color:var(--accent)}
.wl-mid{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;max-width:380px;width:100%;margin:0 auto;padding:30px 0}
.wl-av{filter:drop-shadow(0 18px 34px rgba(0,0,0,0.55));margin-bottom:22px}
.wl-remix{display:inline-flex;align-items:center;gap:12px;padding:8px 8px 8px 14px;border:1px solid var(--line);border-radius:999px;background:rgba(244,239,230,0.04);margin-bottom:26px}
.wl-remix b{font-size:12.5px;font-weight:600;color:var(--mut)}
.wl-rbtn{background:var(--surface2);border:1px solid var(--line);color:var(--ink);font:inherit;font-weight:700;font-size:12px;cursor:pointer;padding:6px 12px;border-radius:999px}
.wl-rbtn:active{transform:scale(.94)}
.wl-rdots{display:flex;gap:5px}
.wl-rdot{width:17px;height:17px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:transform .12s}
.wl-rdot:hover{transform:scale(1.2)}.wl-rdot[data-on="1"]{border-color:var(--ink);transform:scale(1.1)}
.wl-h{font-family:'Clash Display';font-weight:600;font-size:clamp(34px,9vw,46px);letter-spacing:-1.6px;line-height:1.02;margin-bottom:14px}
.wl-tag{font-size:15px;color:var(--mut);line-height:1.55;margin-bottom:0;max-width:330px}
.wl-bot{max-width:380px;width:100%;margin:0 auto;padding:0 0 calc(28px + env(safe-area-inset-bottom,0px))}
.wl-btn{width:100%;padding:18px;border-radius:16px;border:none;font-family:inherit;font-size:17px;font-weight:700;cursor:pointer;background:var(--accent);color:#1A0E08;box-shadow:0 14px 34px rgba(255,92,56,0.34);transition:transform .12s,background .2s}
.wl-btn:hover{background:#FF6B49}.wl-btn:active{transform:scale(.985)}

/* Complete */
.cp{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 32px}
.cp-av{filter:drop-shadow(0 16px 30px rgba(0,0,0,0.5));margin-bottom:22px}
.sw{margin-bottom:18px}
.sw-p{stroke-dasharray:72;stroke-dashoffset:72;animation:draw .5s cubic-bezier(0.12,0,0.39,0) .1s forwards}
@keyframes draw{to{stroke-dashoffset:0}}
.cp-t{font-family:'Clash Display';font-weight:600;font-size:clamp(30px,7vw,40px);letter-spacing:-1.2px;line-height:1.05;margin-bottom:12px}
.cp-s{font-size:15.5px;color:var(--mut);line-height:1.6;max-width:280px}
.cp-b{margin-top:28px;padding:17px 42px;border-radius:16px;border:none;background:var(--accent);color:#1A0E08;font-family:inherit;font-size:16px;font-weight:700;cursor:pointer;box-shadow:0 14px 32px rgba(255,92,56,0.34);transition:transform .12s,background .2s}
.cp-b:hover{background:#FF6B49}.cp-b:active{transform:scale(.97)}

@media(max-width:360px){.gr{grid-template-columns:repeat(2,1fr)}}
      `}</style>

      {screen===0 && <WelcomeScreen dir={dir} avatar={avatar} setAvatar={setAvatar} onStart={()=>go(1)} />}

      {screen===1 && <Step key="s1" dir={dir} step={1} avatar={avatar}
        eyebrow="● WHERE YOU'RE BASED"
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

      {screen===2 && <Step key="s2" dir={dir} step={2} avatar={avatar}
        eyebrow="● ON YOUR RADAR"
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

      {screen===3 && <Step key="s3" dir={dir} step={3} avatar={avatar}
        eyebrow="● YOUR INTERESTS"
        title="What are you into?"
        desc="Pick 3 to 10 topics. You can change these anytime."
        onBack={()=>go(2)}
        footer={<div className="ft"><div className="ft-in">
          <div className={`sl ${selectedTopics.length>=10?"max":selectedTopics.length>=3?"met":""}`}>{selectedTopics.length<3?`Select ${3-selectedTopics.length} more`:selectedTopics.length>=10?`Maximum reached (10 of 10)`:`${selectedTopics.length} of 10 selected`}</div>
          <div className="br"><button className="bt p" disabled={selectedTopics.length<3 || saving} onClick={handleComplete}>{saving ? 'Setting up…' : 'Continue'}</button></div>
        </div></div>}>
        {TOPIC_CATEGORIES.map(cat=><div key={cat.name} className="cat"><div className="cat-t">{cat.name}</div><div className="gr">
          {cat.topics.map(t=><Tile key={t.id} icon={t.icon} label={t.name} selected={selectedTopics.includes(t.id)} onClick={()=>toggleTopic(t.id)} />)}
        </div></div>)}
      </Step>}

      {screen===4 && <CompScreen dir={dir} avatar={avatar}
        homeCountry={ALL_COUNTRIES.find(c=>c.code===homeCountry)}
        followCountries={followCountries.map(code=>ALL_COUNTRIES.find(c=>c.code===code))}
        topics={selectedTopics.map(id=>{for(const cat of TOPIC_CATEGORIES){const t=cat.topics.find(t=>t.id===id);if(t)return t}return null}).filter(Boolean)}
        onStartReading={()=>router.push('/')}
        onBack={()=>go(3)}
      />}
    </div>
  );
}

// ============================================
// COMPONENTS
// ============================================
function Tile({ icon, label, selected, disabled, onClick }) {
  return (
    <button type="button" className={`tile ${selected ? 'sel' : ''}`} disabled={disabled} onClick={onClick}>
      {selected && (
        <span className="tile-ck">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1A0E08" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7"/></svg>
        </span>
      )}
      <span className="tile-ic">{icon}</span>
      <span className="tile-lb">{label}</span>
    </button>
  );
}

function Step({ dir, step, avatar, eyebrow, title, desc, onBack, footer, children }) {
  return (
    <>
      <div className={`sc ${dir>0?"fwd":"back"}`}>
        <div className="hd">
          <button className="hd-back" onClick={onBack} aria-label="Back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <span className="hd-step">Step {step} of 3</span>
          <span className="hd-av"><Avatar config={avatar} size={32} /></span>
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

function WelcomeScreen({ dir, avatar, setAvatar, onStart }) {
  const remix = () => setAvatar({
    color: (avatar.color + 3) % AVATAR_COLORS.length,
    face: (avatar.face + 1) % FACE_COUNT,
    accessory: (avatar.accessory + 1) % ACCESSORY_COUNT,
  });
  return (
    <div className={`sc ${dir>0?"fwd":"back"}`}>
      <div className="wl">
        <div className="wl-brand rin">today<span className="wl-plus">+</span></div>
        <div className="wl-mid">
          <div className="wl-av rin"><Avatar config={avatar} size={104} ring /></div>
          <div className="wl-remix rin" style={{animationDelay:'60ms'}}>
            <b>Your reader</b>
            <button className="wl-rbtn" onClick={remix}>⟳ Remix</button>
            <div className="wl-rdots">
              {AVATAR_COLORS.slice(0,6).map((c,i)=>(
                <span key={c.id} className="wl-rdot" data-on={avatar.color===i?'1':'0'}
                  style={{background:`linear-gradient(135deg,${c.from},${c.to})`}}
                  onClick={()=>setAvatar({...avatar,color:i})} />
              ))}
            </div>
          </div>
          <h1 className="wl-h disp rin" style={{animationDelay:'120ms'}}>Let’s build<br/>your briefing.</h1>
          <p className="wl-tag rin" style={{animationDelay:'200ms'}}>Three quick taps and your front page is yours. Under a minute — promise.</p>
        </div>
        <div className="wl-bot rin" style={{animationDelay:'280ms'}}>
          <button className="wl-btn" onClick={onStart}>Get started</button>
        </div>
      </div>
    </div>
  );
}

function CompScreen({ dir, avatar, homeCountry, followCountries, topics, onStartReading, onBack }) {
  return (
    <div className={`sc ${dir>0?"fwd":"back"}`}>
      <div className="hd">
        <button className="hd-back" onClick={onBack} aria-label="Back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
      </div>
      <div className="cp">
        <div className="cp-av rin"><Avatar config={avatar} size={92} ring /></div>
        <div className="sw rin" style={{animationDelay:'60ms'}}>
          <svg viewBox="0 0 52 40" fill="none" width="40" height="30">
            <path className="sw-p" d="M4 22L18 34L48 6" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="cp-t rin" style={{animationDelay:'100ms'}}>You’re all set.</h1>
        <p className="cp-s rin" style={{animationDelay:'160ms'}}>Your front page is ready{homeCountry ? ` — leading with ${homeCountry.flag} ${homeCountry.name}` : ''}{topics.length ? ` and ${topics.length} topic${topics.length>1?'s':''} you love` : ''}.</p>
        <button className="cp-b rin" style={{animationDelay:'240ms'}} onClick={onStartReading}>Start reading</button>
      </div>
    </div>
  );
}
