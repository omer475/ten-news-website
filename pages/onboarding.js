import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { createClient } from "../lib/supabase";

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
    { code: "turkiye", flag: "\u{1F1F9}\u{1F1F7}", name: "T\u00FCrkiye" },
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
    { id: "politics", name: "Politics", icon: "\u{1F3DB}\uFE0F" },
    { id: "geopolitics", name: "Geopolitics", icon: "\u{1F310}" },
    { id: "conflicts", name: "Conflicts & Wars", icon: "\u2694\uFE0F" },
    { id: "human_rights", name: "Human Rights", icon: "\u{1F4DC}" },
  ]},
  { name: "Sports", topics: [
    { id: "football", name: "Football", icon: "\u26BD" },
    { id: "american_football", name: "American Football", icon: "\u{1F3C8}" },
    { id: "basketball", name: "Basketball", icon: "\u{1F3C0}" },
    { id: "tennis", name: "Tennis", icon: "\u{1F3BE}" },
    { id: "f1", name: "Formula 1", icon: "\u{1F3CE}\uFE0F" },
    { id: "cricket", name: "Cricket", icon: "\u{1F3CF}" },
    { id: "combat_sports", name: "Combat Sports", icon: "\u{1F94A}" },
    { id: "olympics", name: "Olympics", icon: "\u{1F3C5}" },
  ]},
  { name: "Lifestyle", topics: [
    { id: "entertainment", name: "Entertainment", icon: "\u{1F3AC}" },
    { id: "music", name: "Music", icon: "\u{1F3B5}" },
    { id: "gaming", name: "Gaming", icon: "\u{1F3AE}" },
    { id: "travel", name: "Travel", icon: "\u2708\uFE0F" },
  ]},
];

// ============================================
// SUB-INTERESTS — drill-down per topic. `id` is the EXACT lowercase tag string
// that appears in article interest_tags (so feed matching is exact). EVERY chip
// here is grounded in real corpus supply (verified ≥ ~15 articles/14d); thin/
// niche interests (e.g. quantum physics) are intentionally left to the free-text
// AI box, never shown as a dead chip.
// ============================================
const SUBINTERESTS = {
  football: [
    { id: "world cup", label: "World Cup", icon: "\u{1F3C6}" },
    { id: "premier league", label: "Premier League", icon: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}" },
    { id: "champions league", label: "Champions League", icon: "⭐" },
    { id: "real madrid", label: "Real Madrid", icon: "⚪" },
    { id: "barcelona", label: "Barcelona", icon: "\u{1F535}" },
    { id: "manchester united", label: "Man United", icon: "\u{1F534}" },
    { id: "arsenal", label: "Arsenal", icon: "\u{1F9E8}" },
    { id: "la liga", label: "La Liga", icon: "\u{1F1EA}\u{1F1F8}" },
    { id: "serie a", label: "Serie A", icon: "\u{1F1EE}\u{1F1F9}" },
    { id: "bundesliga", label: "Bundesliga", icon: "\u{1F1E9}\u{1F1EA}" },
    { id: "usmnt", label: "USMNT", icon: "\u{1F1FA}\u{1F1F8}" },
  ],
  basketball: [
    { id: "nba", label: "NBA", icon: "\u{1F3C0}" },
    { id: "nba finals", label: "NBA Finals", icon: "\u{1F3C6}" },
    { id: "new york knicks", label: "Knicks", icon: "\u{1F7E0}" },
    { id: "san antonio spurs", label: "Spurs", icon: "⚫" },
    { id: "boston celtics", label: "Celtics", icon: "☘️" },
    { id: "golden state warriors", label: "Warriors", icon: "\u{1F311}" },
    { id: "wnba", label: "WNBA", icon: "\u{1F3C0}" },
  ],
  american_football: [ { id: "nfl", label: "NFL", icon: "\u{1F3C8}" } ],
  f1: [ { id: "formula 1", label: "Formula 1", icon: "\u{1F3CE}️" }, { id: "motorsport", label: "Motorsport", icon: "\u{1F3C1}" }, { id: "nascar", label: "NASCAR", icon: "\u{1F698}" } ],
  tennis: [ { id: "wimbledon", label: "Wimbledon", icon: "\u{1F3BE}" }, { id: "grand slam", label: "Grand Slams", icon: "\u{1F3C6}" } ],
  combat_sports: [ { id: "ufc", label: "UFC", icon: "\u{1F94A}" }, { id: "boxing", label: "Boxing", icon: "\u{1F94A}" } ],
  cricket: [ { id: "cricket", label: "Cricket", icon: "\u{1F3CF}" } ],
  ai: [ { id: "openai", label: "OpenAI", icon: "\u{1F9E0}" }, { id: "chatgpt", label: "ChatGPT", icon: "\u{1F4AC}" }, { id: "nvidia", label: "Nvidia", icon: "\u{1F3AE}" } ],
  tech_industry: [ { id: "apple", label: "Apple", icon: "\u{1F34E}" }, { id: "google", label: "Google", icon: "\u{1F50D}" }, { id: "microsoft", label: "Microsoft", icon: "\u{1FA9F}" }, { id: "meta", label: "Meta", icon: "\u{1F535}" }, { id: "nvidia", label: "Nvidia", icon: "\u{1F3AE}" }, { id: "tesla", label: "Tesla", icon: "⚡" } ],
  consumer_tech: [ { id: "apple", label: "Apple", icon: "\u{1F34E}" }, { id: "google", label: "Google", icon: "\u{1F50D}" } ],
  space: [ { id: "spacex", label: "SpaceX", icon: "\u{1F680}" }, { id: "nasa", label: "NASA", icon: "\u{1F6F0}️" }, { id: "astronomy", label: "Astronomy", icon: "\u{1F52D}" }, { id: "mars", label: "Mars", icon: "\u{1F534}" } ],
  science: [ { id: "astronomy", label: "Astronomy", icon: "\u{1F52D}" }, { id: "physics", label: "Physics", icon: "⚛️" }, { id: "neuroscience", label: "Neuroscience", icon: "\u{1F9E0}" }, { id: "genetics", label: "Genetics", icon: "\u{1F9EC}" } ],
  climate: [ { id: "climate change", label: "Climate Change", icon: "\u{1F30D}" } ],
  startups: [ { id: "openai", label: "OpenAI", icon: "\u{1F9E0}" }, { id: "ipo", label: "IPOs", icon: "\u{1F4C8}" } ],
  stock_markets: [ { id: "bitcoin", label: "Bitcoin", icon: "₿" }, { id: "stock market", label: "Stock Market", icon: "\u{1F4CA}" } ],
  entertainment: [ { id: "netflix", label: "Netflix", icon: "\u{1F3AC}" } ],
};

// ============================================
// TYPING HOOKS
// ============================================
function useSequentialTyped(title, desc, titleSpeed = 45, descSpeed = 25, onDescDoneCallback) {
  const [titleText, setTitleText] = useState("");
  const [descText, setDescText] = useState("");
  const [descDone, setDescDone] = useState(false);
  const [showTitleCursor, setShowTitleCursor] = useState(true);

  useEffect(() => {
    let ti = 0, di = 0, cancelled = false;
    setTitleText(""); setDescText(""); setDescDone(false); setShowTitleCursor(true);

    const t1 = setTimeout(() => {
      const iv1 = setInterval(() => {
        if (cancelled) return;
        ti++; setTitleText(title.slice(0, ti));
        if (ti >= title.length) {
          clearInterval(iv1);
          setTimeout(() => {
            if (cancelled) return;
            setShowTitleCursor(false);
            const iv2 = setInterval(() => {
              if (cancelled) return;
              di++; setDescText(desc.slice(0, di));
              if (di >= desc.length) { clearInterval(iv2); setDescDone(true); if (onDescDoneCallback) onDescDoneCallback(); }
            }, descSpeed);
          }, 200);
        }
      }, titleSpeed);
    }, 250);
    return () => { cancelled = true; clearTimeout(t1); };
  }, [title, desc, titleSpeed, descSpeed]);

  return { titleText, descText, descDone, showTitleCursor };
}

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
  // Onboarding v2 extra signals (refined question set)
  const [globalBreadth, setGlobalBreadth] = useState('home'); // 'home' | 'some' | 'global'
  const [followedSubtopics, setFollowedSubtopics] = useState([]); // exact tag strings (teams/companies/sub-topics)
  const [freeText, setFreeText] = useState("");
  const [parsed, setParsed] = useState(null);           // LLM result {topic_codes, entities, interest_tags, summary_line}
  const [depthPref, setDepthPref] = useState(3);        // 3-stop: 1 quick-hits / 3 mix / 5 deep dives
  const [seriousnessPref, setSeriousnessPref] = useState(3); // 3-stop: 1 just-serious / 3 mix / 5 fun too
  const TOTAL_STEPS = 5;
  // sign-in (returning users) — self-contained, OAuth + magic link
  const [signIn, setSignIn] = useState(false);
  const [siEmail, setSiEmail] = useState("");
  const [siErr, setSiErr] = useState("");
  const [siSent, setSiSent] = useState(false);
  const [siBusy, setSiBusy] = useState("");
  // adaptive drill-down: AI suggestions per topic + per-topic "add your own" text
  const [suggestions, setSuggestions] = useState({}); // topicCode -> { loading, groups }
  const [customAdds, setCustomAdds] = useState({});   // topicCode -> free text

  const handleOAuth = async (provider) => {
    setSiErr(""); setSiBusy(provider);
    const supabase = createClient();
    if (!supabase) { setSiErr("Sign-in is not configured."); setSiBusy(""); return; }
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/auth/callback`, ...(provider === 'google' && { queryParams: { access_type: 'offline', prompt: 'consent' } }) } });
    if (error) { setSiErr(error.message); setSiBusy(""); }
  };
  const handleMagic = async () => {
    if (!siEmail) return;
    setSiErr(""); setSiBusy("magic");
    const supabase = createClient();
    if (!supabase) { setSiErr("Sign-in is not configured."); setSiBusy(""); return; }
    const { error } = await supabase.auth.signInWithOtp({ email: siEmail, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
    if (error) { setSiErr(error.message); setSiBusy(""); } else { setSiSent(true); setSiBusy(""); }
  };

  // Check if already onboarded
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const prefs = localStorage.getItem('todayplus_preferences');
      if (prefs) {
        const parsed = JSON.parse(prefs);
        if (parsed.onboarding_completed) {
          router.replace('/');
        }
      }
    } catch (e) {}
  }, [router]);

  // Detect user's country via IP geolocation
  useEffect(() => {
    fetch('https://api.country.is/')
      .then(r => r.json())
      .then(data => {
        if (data && data.country) {
          const code = ISO_TO_CODE[data.country];
          if (code) {
            const country = ALL_COUNTRIES.find(c => c.code === code);
            if (country) setDetectedCountry(country);
          }
        }
      })
      .catch(() => {});
  }, []);

  const go = (n) => { setDir(n > screen ? 1 : -1); setScreen(n); };
  const toggleFollow = (code) => setFollowCountries(p => p.includes(code) ? p.filter(c=>c!==code) : p.length<5 ? [...p,code] : p);
  const toggleTopic = (id) => setSelectedTopics(p => p.includes(id) ? p.filter(t=>t!==id) : p.length<10 ? [...p,id] : p);
  const toggleSub = (id) => setFollowedSubtopics(p => p.includes(id) ? p.filter(s=>s!==id) : [...p,id]);

  // ── adaptive drill-down: one page per picked topic (up to 4), then catch-all, then reveal ──
  const drillTopics = selectedTopics.slice(0, 4);
  const DRILL0 = 3;
  const CATCH_INDEX = DRILL0 + drillTopics.length;
  const REVEAL_INDEX = CATCH_INDEX + 1;
  const TOTAL = 2 + drillTopics.length + 1; // country + interests + drills + catch-all (reveal uncounted)

  // Fetch AI drill-down options for one topic (cached in state; never blocks the flow)
  const fetchSuggest = async (topic) => {
    if (!topic) return;
    setSuggestions(prev => ({ ...prev, [topic]: { loading: true, groups: [] } }));
    try {
      const r = await fetch('/api/user/onboarding/suggest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, country: homeCountry || '' }),
      });
      const data = r.ok ? await r.json() : { groups: [] };
      setSuggestions(prev => ({ ...prev, [topic]: { loading: false, groups: Array.isArray(data.groups) ? data.groups : [] } }));
    } catch (_) {
      setSuggestions(prev => ({ ...prev, [topic]: { loading: false, groups: [] } }));
    }
  };

  const handleComplete = async () => {
    setSaving(true);

    // Combine everything the user typed (per-topic "add your own" + final catch-all),
    // parse it once, and merge into the warm-start signals.
    const combinedText = [
      ...Object.values(customAdds).map(s => (s || '').trim()).filter(Boolean),
      (freeText || '').trim(),
    ].filter(Boolean).join(' · ');

    let signals = null;
    if (combinedText.length > 2) {
      try {
        const pr = await fetch('/api/user/onboarding/parse', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: combinedText }),
        });
        if (pr.ok) signals = await pr.json();
      } catch (_) {}
    }
    if (signals) setParsed(signals);

    const mergedTopics = [...new Set([...selectedTopics, ...((signals && signals.topic_codes) || [])])].slice(0, 16);
    const mergedSubs = [...new Set([
      ...followedSubtopics,
      ...(((signals && signals.entities) || []).map(e => (e && e.name) ? String(e.name).toLowerCase() : '').filter(Boolean)),
      ...((signals && signals.interest_tags) || []),
    ])].slice(0, 40);

    const preferences = {
      home_country: homeCountry,
      followed_countries: [],
      followed_topics: mergedTopics,
      followed_subtopics: mergedSubs,
      avoid_topics: (signals && signals.avoid_topics) || [],
      onboarding_completed: true,
      created_at: new Date().toISOString(),
    };

    let authUserId = null, authEmail = null;
    try {
      const storedUser = localStorage.getItem('tennews_user');
      if (storedUser) { const u = JSON.parse(storedUser); authUserId = u?.id || null; authEmail = u?.email || null; }
    } catch (e) {}

    try {
      const body = {
        ...preferences,
        followed_entities: signals ? (signals.entities || null) : null,
        onboarding_freetext: combinedText || null,
      };
      if (authUserId) { body.auth_user_id = authUserId; if (authEmail) body.email = authEmail; }
      const response = await fetch('/api/user/onboarding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (response.ok) { const data = await response.json(); preferences.user_id = data.user?.id; }
    } catch (e) { console.warn('API save error, using localStorage only:', e); }

    localStorage.setItem('todayplus_preferences', JSON.stringify(preferences));
    setSaving(false);
    go(REVEAL_INDEX);
  };

  // Liquid glass box-shadow (matches share/event buttons in news page)
  const glassBoxShadow = `
    inset 0 0 0 0.5px rgba(255, 255, 255, 0.35),
    inset 0.9px 1.5px 0px -1px rgba(255, 255, 255, 0.7),
    inset -1px -1px 0px -1px rgba(255, 255, 255, 0.5),
    inset -1.5px -4px 0.5px -3px rgba(255, 255, 255, 0.4),
    inset -0.15px -0.5px 2px 0px rgba(0, 0, 0, 0.06),
    inset -0.75px 1.25px 0px -1px rgba(0, 0, 0, 0.08),
    inset 0px 1.5px 2px -1px rgba(0, 0, 0, 0.06),
    0px 0.5px 2.5px 0px rgba(0, 0, 0, 0.04),
    0px 2px 6px 0px rgba(0, 0, 0, 0.03)
  `;

  const glassSelectedShadow = `
    inset 0 0 0 0.5px rgba(0, 87, 183, 0.2),
    inset 0.9px 1.5px 0px -1px rgba(255, 255, 255, 0.9),
    inset -1px -1px 0px -1px rgba(255, 255, 255, 0.8),
    inset -1.5px -4px 0.5px -3px rgba(255, 255, 255, 0.6),
    inset -0.15px -0.5px 2px 0px rgba(168, 128, 47, 0.08),
    inset -0.75px 1.25px 0px -1px rgba(168, 128, 47, 0.1),
    inset 0px 1.5px 2px -1px rgba(0, 87, 183, 0.06),
    0px 0.5px 2.5px 0px rgba(168, 128, 47, 0.08),
    0px 3px 10px 0px rgba(168, 128, 47, 0.1)
  `;

  return (
    <div className="ob">
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=Gabarito:wght@500;600;700;800&family=Figtree:wght@400;500;600&display=swap');
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
.ob{position:fixed;inset:0;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text','Helvetica Neue',Arial,sans-serif;background:#000;color:#F5F5F7;-webkit-font-smoothing:antialiased;overflow:hidden}

.sc{position:absolute;inset:0;display:flex;flex-direction:column;animation:0.5s cubic-bezier(0.22,1,0.36,1) both;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch}
.sc.fwd{animation-name:sf}.sc.back{animation-name:sb}
@keyframes sf{from{opacity:0;transform:translateX(46px)}to{opacity:1;transform:none}}
@keyframes sb{from{opacity:0;transform:translateX(-46px)}to{opacity:1;transform:none}}
@keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@keyframes chipIn{from{opacity:0;transform:translateY(12px) scale(.94)}to{opacity:1;transform:none}}
@keyframes bl{0%,100%{opacity:1}50%{opacity:0}}
@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.9}}

/* Header */
.hd{display:flex;align-items:center;padding:18px 22px 0;position:sticky;top:0;z-index:10;background:rgba(0,0,0,0.7);backdrop-filter:blur(20px) saturate(180%);-webkit-backdrop-filter:blur(20px) saturate(180%)}
.hd-back{width:40px;height:40px;border-radius:50%;border:1px solid rgba(245,245,247,0.14);background:rgba(245,245,247,0.05);display:flex;align-items:center;justify-content:center;cursor:pointer;color:#F5F5F7;transition:all 0.15s;flex-shrink:0}
.hd-back:hover{background:rgba(245,245,247,0.12)}.hd-back:active{transform:scale(0.92)}
.hd-step{flex:1;text-align:center;font-size:12px;font-weight:600;color:#86868B;letter-spacing:0.4px}
.hd-sp{width:40px;flex-shrink:0}
.pbar{height:3px;background:rgba(245,245,247,0.12);margin:18px 22px 0;border-radius:999px;overflow:hidden}
.pbar-f{height:100%;background:#F5F5F7;border-radius:999px;transition:width 0.5s cubic-bezier(0.22,1,0.36,1)}

/* Body */
.bd{flex:1;max-width:600px;margin:0 auto;width:100%;padding:30px 22px 0;padding-bottom:130px}
.tt{font-size:clamp(34px,8vw,52px);font-weight:600;color:#F5F5F7;letter-spacing:-0.04em;line-height:1.02;margin-bottom:10px;animation:rise .6s cubic-bezier(0.22,1,0.36,1) both}
.cur{display:none}
.ds{font-size:16px;color:#86868B;line-height:1.45;margin-bottom:30px;max-width:420px;font-weight:400;animation:rise .6s cubic-bezier(0.22,1,0.36,1) .08s both}
.cnt{opacity:0;transform:translateY(10px);transition:opacity 0.4s ease,transform 0.4s cubic-bezier(0.22,1,0.36,1)}
.cnt.on{opacity:1;transform:none}
.cnt-rest{opacity:0;transform:translateY(10px);transition:opacity 0.5s ease,transform 0.5s cubic-bezier(0.22,1,0.36,1)}
.cnt-rest.on{opacity:1;transform:none}

/* Section label */
.con{font-size:11px;font-weight:700;color:#86868B;text-transform:uppercase;letter-spacing:0.08em;margin:22px 0 11px;padding-left:2px}
.con:first-child{margin-top:0}
.cat{margin-bottom:22px}
.cat-t{font-size:11px;font-weight:700;color:#86868B;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:11px;padding-left:2px}

/* Grid */
.gr{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:6px}

/* Footer */
.ft{position:fixed;bottom:0;left:0;right:0;z-index:20;padding:36px 22px 0;pointer-events:none;background:linear-gradient(180deg,rgba(0,0,0,0),#000 42%)}
.ft::before{display:none}
.ft-in{max-width:460px;margin:0 auto;padding:0 0 calc(24px + env(safe-area-inset-bottom,0px));pointer-events:auto}
.sl{display:block;text-align:center;font-size:13.5px;font-weight:500;color:#86868B;margin-bottom:13px;letter-spacing:-0.1px;transition:color 0.2s ease}
.sl.met{color:#F5F5F7}
.sl.max{color:#F5F5F7}
.br{display:flex;gap:10px}
.bt{flex:1;height:54px;display:inline-flex;align-items:center;justify-content:center;border-radius:980px;border:none;font-family:inherit;font-size:16px;font-weight:600;cursor:pointer;transition:transform 0.16s cubic-bezier(0.34,1.56,0.64,1),background 0.18s,opacity 0.2s;letter-spacing:-0.2px;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
.bt:active{transform:scale(0.97)}
.bt.p{background:#F5F5F7;color:#000}
.bt.p:hover:not(:disabled){transform:translateY(-1px)}
.bt.p:disabled{background:rgba(245,245,247,0.12);color:rgba(245,245,247,0.4);cursor:default}
.bt.s{background:transparent;color:#F5F5F7;border:1px solid rgba(245,245,247,0.18)}
.bt.s:hover{background:rgba(245,245,247,0.06)}

/* Welcome */
.wl{display:flex;flex-direction:column;height:100%;position:relative;overflow:hidden;padding:0 28px;
  background:radial-gradient(ellipse 80% 60% at 20% 10%,rgba(168,128,47,0.14) 0%,transparent 55%),radial-gradient(ellipse 60% 50% at 80% 80%,rgba(168,128,47,0.09) 0%,transparent 55%),#FCFBF8}
.wl-top{flex:1;display:flex;align-items:center;justify-content:center}
.wl-center{text-align:left;width:100%;max-width:360px;margin-top:-6vh}
.wl-pre{font-size:clamp(32px,8vw,44px);font-weight:800;color:#16150F;letter-spacing:-1.2px;line-height:1.08;margin-bottom:2px;min-height:1.08em}
.wl-line{font-size:clamp(32px,8vw,44px);font-weight:800;color:#16150F;letter-spacing:-1.2px;line-height:1.08;margin-bottom:2px;min-height:1.08em;white-space:nowrap}
.wl-plus{color:#A8802F}
.wl-line2{font-size:clamp(32px,8vw,44px);font-weight:800;color:#5F5B51;letter-spacing:-1.2px;line-height:1.08;margin-bottom:0;min-height:1.08em}
.wl-cur{display:inline-block;width:2.5px;height:0.78em;background:#A39E92;margin-left:1px;vertical-align:text-bottom;border-radius:1px;animation:bl 0.55s step-end infinite}
.wl-cur.hide{opacity:0;animation:none;transition:opacity 0.25s ease}
.wl-bottom{flex:0 0 auto;padding:0 0 calc(28px + env(safe-area-inset-bottom,0px));width:100%;max-width:360px;align-self:center}
.wl-tagline{font-size:14px;color:#5F5B51;line-height:1.6;text-align:center;margin-bottom:16px;letter-spacing:-0.1px;opacity:0;transform:translateY(10px);transition:opacity 0.65s ease,transform 0.65s cubic-bezier(0.22,1,0.36,1)}
.wl-tagline.on{opacity:1;transform:none}
.wl-btn{width:100%;padding:18px;border-radius:16px;border:none;font-family:inherit;font-size:17px;font-weight:700;letter-spacing:-0.3px;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;
  opacity:0;transform:translateY(12px) scale(0.97);transition:opacity 0.6s cubic-bezier(0.22,1,0.36,1),transform 0.6s cubic-bezier(0.34,1.56,0.64,1);
  background:#16150F;color:#FCFBF8;
  backdrop-filter:blur(16px) saturate(200%);-webkit-backdrop-filter:blur(16px) saturate(200%);
  box-shadow:
    inset 0 0 0 0.5px rgba(22,21,15,0.6),
    inset 0 1.5px 0 0 rgba(255,255,255,0.85),
    inset 0 -1px 2px 0 rgba(0,0,0,0.04),
    inset 1px 0 0 0 rgba(22,21,15,0.3),
    inset -1px 0 0 0 rgba(22,21,15,0.3),
    0 1px 3px 0 rgba(0,0,0,0.06),
    0 4px 12px 0 rgba(0,0,0,0.04),
    0 8px 28px -4px rgba(0,0,0,0.05)}
.wl-btn.on{opacity:1;transform:none}
.wl-btn:active{transform:scale(0.975);transition:transform 0.1s ease;
  box-shadow:
    inset 0 0 0 0.5px rgba(22,21,15,0.4),
    inset 0 1px 0 0 rgba(22,21,15,0.6),
    inset 0 -0.5px 1px 0 rgba(0,0,0,0.05),
    0 1px 2px 0 rgba(0,0,0,0.08),
    0 2px 6px 0 rgba(0,0,0,0.04)}
@media(max-height:680px){.wl-center{margin-top:-3vh}.wl-pre,.wl-line,.wl-line2{font-size:clamp(28px,7vw,36px)}}
@media(min-width:768px){.wl{padding:0 48px}.wl-center,.wl-bottom{max-width:420px}}

/* Complete */
.cp{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 32px;flex:1;background:#000}
.sw{margin-bottom:26px;opacity:0;transform:scale(0.7);transition:opacity 0.3s,transform 0.5s cubic-bezier(0.34,1.56,0.64,1)}
.sw.on{opacity:1;transform:scale(1)}
.sw-p{stroke-dasharray:72;stroke-dashoffset:72;transition:stroke-dashoffset 0.45s cubic-bezier(0.12,0,0.39,0) 0.05s}
.sw-p.draw{stroke-dashoffset:0}
.cp-t{font-size:clamp(40px,9vw,60px);font-weight:600;color:#F5F5F7;letter-spacing:-0.04em;line-height:1.0;margin-bottom:14px;min-height:1.0em}
.cp-c{display:inline-block;width:0.045em;height:0.82em;background:#F5F5F7;margin-left:2px;vertical-align:text-bottom;animation:bl 0.6s step-end infinite}
.cp-c.hide{opacity:0;animation:none}
.cp-s{font-size:15.5px;color:#86868B;line-height:1.55;max-width:280px;opacity:0;transform:translateY(10px);transition:opacity 0.5s,transform 0.5s cubic-bezier(0.22,1,0.36,1)}
.cp-s.on{opacity:1;transform:none}
.cp-b{margin-top:30px;height:54px;padding:0 42px;display:inline-flex;align-items:center;border-radius:980px;border:none;color:#000;font-family:inherit;font-size:16px;font-weight:600;cursor:pointer;letter-spacing:-0.2px;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;opacity:0;transform:translateY(10px);transition:opacity 0.5s ease 0.1s,transform 0.5s cubic-bezier(0.22,1,0.36,1) 0.1s,background .18s;background:#F5F5F7}
.cp-b.on{opacity:1;transform:none}
.cp-b:active{transform:scale(0.96)}

@media(max-width:360px){.gr{grid-template-columns:repeat(2,1fr)}}

/* === Apple-style welcome (screen 0) === */
.wel{position:absolute;inset:0;z-index:1;display:flex;flex-direction:column;cursor:pointer;background:#000;color:#F5F5F7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text','Helvetica Neue',Arial,sans-serif;animation:welFade .6s ease both}
@keyframes welFade{from{opacity:0}to{opacity:1}}
.wel-bar{display:flex;align-items:center;justify-content:space-between;padding:24px clamp(22px,6vw,48px) 0}
.wel-brand{font-size:23px;font-weight:600;letter-spacing:-0.02em;color:#F5F5F7}
.wel-plus{color:#F5F5F7}
.wel-signin{background:rgba(245,245,247,0.08);border:1px solid rgba(245,245,247,0.18);color:#F5F5F7;font-family:inherit;font-weight:500;font-size:14px;cursor:pointer;padding:10px 20px;border-radius:980px;transition:background .15s}
.wel-signin:hover{background:rgba(245,245,247,0.14)}
.wel-mid{flex:1;display:flex;align-items:center;padding:0 clamp(20px,5vw,64px) 6vh}
.wel-type{font-size:clamp(64px,16vw,200px);font-weight:600;letter-spacing:-0.045em;line-height:0.92;max-width:11ch}
.wel-car{display:inline-block;width:0.045em;height:0.9em;background:#F5F5F7;margin-left:0.06em;vertical-align:-0.08em;border-radius:2px;animation:welBlink 1.05s step-end infinite}
@keyframes welBlink{0%,100%{opacity:1}50%{opacity:0}}
.wel-hint{padding:0 clamp(22px,6vw,72px) calc(34px + env(safe-area-inset-bottom,0px));font-size:13.5px;color:#5A5A5E;font-weight:500;opacity:0;animation:welHint .6s ease 2.6s forwards}
@keyframes welHint{to{opacity:1}}

/* === minimal sign-in modal === */
.si-ov{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px}
.si-card{position:relative;width:100%;max-width:380px;background:#1A1A1C;border:1px solid rgba(245,245,247,0.12);border-radius:22px;padding:30px 26px 26px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif;color:#F5F5F7;animation:welFade .35s ease both}
.si-x{position:absolute;top:16px;right:16px;width:30px;height:30px;border-radius:50%;border:1px solid rgba(245,245,247,0.14);background:rgba(245,245,247,0.06);color:#9A9A9E;font-size:18px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}
.si-title{font-size:24px;font-weight:600;letter-spacing:-0.02em;margin-bottom:4px}
.si-sub{font-size:14.5px;color:#9A9A9E;line-height:1.45;margin-bottom:18px}
.si-err{background:rgba(255,69,58,0.12);color:#FF6B5C;font-size:13.5px;font-weight:500;padding:10px 13px;border-radius:10px;margin-bottom:14px}
.si-btn{width:100%;height:48px;display:flex;align-items:center;justify-content:center;gap:10px;border-radius:12px;font-family:inherit;font-size:15px;font-weight:600;cursor:pointer;margin-bottom:9px;border:1px solid rgba(245,245,247,0.14);background:rgba(245,245,247,0.06);color:#F5F5F7;transition:background .15s}
.si-btn:hover:not(:disabled){background:rgba(245,245,247,0.12)}
.si-btn:disabled{opacity:.5;cursor:default}
.si-google{background:#fff;color:#1d1d1f;border-color:#fff}
.si-google:hover:not(:disabled){background:#f1f1f1}
.si-apple{background:#000;border-color:rgba(245,245,247,0.2)}
.si-div{display:flex;align-items:center;gap:12px;margin:14px 0;color:#7A7A7E;font-size:12px;text-transform:uppercase;letter-spacing:0.06em}
.si-div::before,.si-div::after{content:'';flex:1;height:1px;background:rgba(245,245,247,0.12)}
.si-input{width:100%;height:48px;padding:0 14px;border-radius:12px;border:1px solid rgba(245,245,247,0.14);background:rgba(245,245,247,0.05);color:#F5F5F7;font-family:inherit;font-size:16px;outline:none;margin-bottom:9px;transition:border .15s}
.si-input::placeholder{color:#6A6A6E}
.si-input:focus{border-color:rgba(245,245,247,0.4)}
.si-mail{background:#F5F5F7;color:#000;border-color:#F5F5F7}
.si-mail:hover:not(:disabled){background:#fff}
.si-link{background:none;border:none;color:#9A9A9E;font-family:inherit;font-size:14px;font-weight:600;cursor:pointer;margin-top:6px}
      `}</style>

      {screen===0 && <WelcomeScreen onStart={()=>go(1)} onSignIn={()=>{setSiErr('');setSiSent(false);setSignIn(true);}} dir={dir}/>}

      {screen===1 && <TSScreen key="s1" dir={dir} step={1} total={TOTAL}
        title="Where are you?"
        desc={detectedCountry ? `Looks like ${detectedCountry.flag} ${detectedCountry.name} \u2014 tap to confirm, or pick your own.` : "We'll lead your feed with the news closest to you."}
        onBack={()=>go(0)}
        onDescDone={() => { if (detectedCountry && !homeCountry) setHomeCountry(detectedCountry.code); }}
        guessSection={detectedCountry ? <div><div className="con">Our Guess</div><div className="gr">
          <GlassTile key={detectedCountry.code} flag={detectedCountry.flag} label={detectedCountry.name} selected={homeCountry===detectedCountry.code} onClick={()=>setHomeCountry(detectedCountry.code)} />
        </div></div> : null}
        footer={<div className="ft"><div className="ft-in">
          {homeCountry && <div className="sl met">{ALL_COUNTRIES.find(c=>c.code===homeCountry)?.flag} {ALL_COUNTRIES.find(c=>c.code===homeCountry)?.name}</div>}
          <div className="br"><button className="bt p" disabled={!homeCountry} onClick={()=>go(2)}>Continue</button></div>
        </div></div>}>
        {COUNTRY_GROUPS.map(g=><div key={g.continent}><div className="con">{g.continent}</div><div className="gr">
          {g.countries.map((c,i)=>
            <GlassTile key={c.code} i={i} flag={c.flag} label={c.name} selected={homeCountry===c.code} onClick={()=>setHomeCountry(c.code)} />
          )}
        </div></div>)}
      </TSScreen>}

      {screen===2 && <TSScreen key="s2" dir={dir} step={2} total={TOTAL}
        title="What do you keep up with?"
        desc="Tap your obsessions — your first picks weigh heaviest. Pick at least 3."
        onBack={()=>go(1)}
        footer={<div className="ft"><div className="ft-in">
          <div className={`sl ${selectedTopics.length>=10?"max":selectedTopics.length>=3?"met":""}`}>{selectedTopics.length<3?`Pick ${3-selectedTopics.length} more`:selectedTopics.length>=10?`Maximum reached (10 of 10)`:`${selectedTopics.length} picked · #1 weighs most`}</div>
          <div className="br"><button className="bt p" disabled={selectedTopics.length<3} onClick={()=>go(3)}>Continue</button></div>
        </div></div>}>
        {TOPIC_CATEGORIES.map(cat=><div key={cat.name} className="cat"><div className="cat-t">{cat.name}</div><div className="gr">
          {cat.topics.map((t,i)=>{const rank=selectedTopics.indexOf(t.id);return(
            <GlassTile key={t.id} i={i} icon={t.icon} label={t.name} selected={rank>=0} rank={rank>=0?rank+1:0} onClick={()=>toggleTopic(t.id)} />
          );})}
        </div></div>)}
      </TSScreen>}

      {screen>=DRILL0 && screen<CATCH_INDEX && (() => {
        const topic = drillTopics[screen - DRILL0];
        return <DrillScreen key={`drill-${topic}`} dir={dir} step={screen} total={TOTAL}
          topicCode={topic} sug={suggestions[topic]} onFetch={fetchSuggest}
          selected={followedSubtopics} onToggle={toggleSub}
          custom={customAdds[topic] || ''} onCustom={(v)=>setCustomAdds(s=>({...s,[topic]:v}))}
          onBack={()=>go(screen-1)} onContinue={()=>go(screen+1)} />;
      })()}

      {screen===CATCH_INDEX && <FreeTextScreen key="catch" dir={dir} step={CATCH_INDEX} total={TOTAL}
        value={freeText} onChange={setFreeText} parsed={parsed} setParsed={setParsed} finishing={saving}
        onBack={()=>go(CATCH_INDEX-1)} onContinue={handleComplete} onSkip={handleComplete} />}

      {screen===REVEAL_INDEX && <RevealScreen dir={dir}
        profile={{
          country: (ALL_COUNTRIES.find(c=>c.code===homeCountry)||{}).name || homeCountry || '',
          topics: selectedTopics.map(id=>{const t=TOPIC_CATEGORIES.flatMap(c=>c.topics).find(x=>x.id===id);return t?t.name:id;}),
          subtopics: followedSubtopics,
          themes: (parsed && parsed.interest_tags) || [],
        }}
        onStartReading={()=>router.push('/')} onBack={()=>go(CATCH_INDEX)} />}

      {signIn && (
        <div className="si-ov" onClick={()=>setSignIn(false)}>
          <div className="si-card" onClick={(e)=>e.stopPropagation()}>
            <button className="si-x" onClick={()=>setSignIn(false)} aria-label="Close">×</button>
            {siSent ? (
              <div style={{textAlign:'center'}}>
                <div className="si-title">Check your inbox</div>
                <p className="si-sub">We sent a sign-in link to <b style={{color:'#fff'}}>{siEmail}</b>. Tap it to continue.</p>
                <button className="si-link" onClick={()=>setSiSent(false)}>← Back</button>
              </div>
            ) : (
              <>
                <div className="si-title">Welcome back</div>
                <p className="si-sub">Sign in to pick up your briefing.</p>
                {siErr && <div className="si-err">{siErr}</div>}
                <button className="si-btn si-google" onClick={()=>handleOAuth('google')} disabled={!!siBusy}>
                  <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/><path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 3.58z" fill="#EA4335"/></svg>
                  {siBusy==='google'?'Redirecting…':'Continue with Google'}
                </button>
                <button className="si-btn si-apple" onClick={()=>handleOAuth('apple')} disabled={!!siBusy}>
                  <svg width="16" height="19" viewBox="0 0 17 20" fill="#fff"><path d="M14.04 15.49c-.26.6-.57 1.16-.93 1.67-.49.7-.9 1.18-1.21 1.45-.49.45-1.01.68-1.57.69-.4 0-.89-.11-1.45-.35-.57-.23-1.09-.34-1.57-.34-.5 0-1.03.11-1.61.34-.58.24-1.05.36-1.41.37-.54.02-1.07-.22-1.59-.71-.34-.29-.77-.79-1.28-1.49-.55-.75-1-1.62-1.36-2.61C.31 13.86.09 12.83.09 11.83c0-1.14.25-2.13.74-2.95.39-.66.9-1.18 1.55-1.57.64-.38 1.34-.58 2.09-.59.42 0 .98.13 1.68.39.7.26 1.15.39 1.34.39.15 0 .65-.15 1.49-.46.8-.28 1.47-.4 2.02-.35 1.49.12 2.61.71 3.35 1.77-1.33.81-1.99 1.94-1.98 3.39.01 1.13.42 2.07 1.23 2.81.37.34.78.61 1.24.8-.1.29-.21.57-.32.83zM11.32.36c0 .85-.31 1.65-.93 2.39-.74.88-1.64 1.39-2.62 1.31a2.62 2.62 0 01-.02-.32c0-.82.36-1.69.99-2.41.32-.36.72-.66 1.21-.9.49-.23.95-.36 1.38-.39.01.11.01.21.01.32z"/></svg>
                  {siBusy==='apple'?'Redirecting…':'Continue with Apple'}
                </button>
                <div className="si-div"><span>or</span></div>
                <input className="si-input" type="email" value={siEmail} placeholder="you@example.com" onChange={(e)=>setSiEmail(e.target.value)} onKeyDown={(e)=>{e.stopPropagation(); if(e.key==='Enter') handleMagic();}} />
                <button className="si-btn si-mail" onClick={handleMagic} disabled={!siEmail || !!siBusy}>{siBusy==='magic'?'Sending…':'Email me a sign-in link'}</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// DRILL-DOWN SCREEN — AI-suggested specifics for one topic (one page per topic)
// ============================================
function DrillPill({ label, on, onClick }) {
  return (
    <button onClick={onClick} style={{
      display:'inline-flex',alignItems:'center',height:44,padding:'0 16px',borderRadius:980,fontFamily:'inherit',fontSize:14,fontWeight:600,cursor:'pointer',WebkitTapHighlightColor:'transparent',transition:'all .16s cubic-bezier(0.22,1,0.36,1)',
      border:on?'1px solid #F5F5F7':'1px solid rgba(245,245,247,0.14)',
      background:on?'#F5F5F7':'rgba(245,245,247,0.05)', color:on?'#000':'#F5F5F7',
    }}>{label}</button>
  );
}

function DrillScreen({ dir, step, total, topicCode, sug, onFetch, selected, onToggle, custom, onCustom, onBack, onContinue }) {
  useEffect(() => { if (!sug) onFetch(topicCode); }, [topicCode]); // eslint-disable-line react-hooks/exhaustive-deps
  const topic = TOPIC_CATEGORIES.flatMap(c=>c.topics).find(t=>t.id===topicCode);
  const name = topic ? topic.name : topicCode;
  const loading = !sug || sug.loading;
  const groups = (sug && sug.groups) || [];
  return (
    <>
      <div className={`sc ${dir>0?"fwd":"back"}`}>
        <div className="hd">
          <button className="hd-back" onClick={onBack}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg></button>
          <span className="hd-step">Step {step} of {total}</span>
          <div className="hd-sp"/>
        </div>
        <div className="pbar"><div className="pbar-f" style={{width:`${(step/total)*100}%`}}/></div>
        <div className="bd">
          <h1 className="tt">{topic && topic.icon ? topic.icon+' ' : ''}Anything in {name} you follow?</h1>
          <p className="ds">Tap any that are yours — they lead your feed. Or add your own below.</p>
          {loading ? (
            <div>
              <div className="cat-t" style={{marginBottom:13}}>Finding {name.toLowerCase()} options…</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {[96,120,72,108,84,132,90,76].map((w,i)=><span key={i} style={{height:44,width:w,borderRadius:980,background:'rgba(245,245,247,0.07)',animation:'pulse 1.2s ease-in-out infinite',animationDelay:`${i*0.09}s`}}/>)}
              </div>
            </div>
          ) : groups.length===0 ? (
            <p style={{color:'#86868B',fontSize:14.5,lineHeight:1.5}}>Nothing preset for this one — just type what you follow below.</p>
          ) : groups.map((g,gi)=>(
            <div key={gi} className="cat">
              <div className="cat-t">{g.label}</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {(g.items||[]).map((it,ii)=>{ const val=String(it).toLowerCase(); return (
                  <DrillPill key={ii} label={it} on={selected.includes(val)} onClick={()=>onToggle(val)} />
                );})}
              </div>
            </div>
          ))}
          <div className="cat" style={{marginTop:18}}>
            <div className="cat-t">+ Add your own</div>
            <input value={custom} onChange={(e)=>onCustom(e.target.value)} onKeyDown={(e)=>e.stopPropagation()}
              placeholder={`Anything else in ${name.toLowerCase()}…`}
              style={{width:'100%',height:50,padding:'0 16px',borderRadius:14,border:'1px solid rgba(245,245,247,0.14)',background:'rgba(245,245,247,0.05)',color:'#F5F5F7',fontFamily:'inherit',fontSize:16,outline:'none',WebkitTapHighlightColor:'transparent'}} />
          </div>
        </div>
      </div>
      <div className="ft"><div className="ft-in"><div className="br">
        <button className="bt s" onClick={onContinue}>Skip</button>
        <button className="bt p" onClick={onContinue}>Continue</button>
      </div></div></div>
    </>
  );
}

// ============================================
// REVEAL SCREEN — short AI-written personal note, typed in (final page)
// ============================================
function RevealScreen({ dir, profile, onStartReading, onBack }) {
  const [text, setText] = useState('');
  const [typed, setTyped] = useState('');
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let t = '';
      try {
        const r = await fetch('/api/user/onboarding/reveal', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ profile }) });
        if (r.ok) { const d = await r.json(); t = (d && d.text) || ''; }
      } catch (_) {}
      if (!t) t = `You're all set. I'll lead your mornings with ${profile.country || 'your part of the world'} and the things you picked — and slip in the stories around them too. Let's go.`;
      if (cancelled) return;
      setText(t); setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!text) return;
    let i = 0;
    const id = setInterval(() => { i++; setTyped(text.slice(0, i)); if (i >= text.length) { clearInterval(id); setReady(true); } }, 20);
    return () => clearInterval(id);
  }, [text]);
  return (
    <div className={`sc ${dir>0?"fwd":"back"}`}>
      <div className="hd">
        <button className="hd-back" onClick={onBack}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg></button>
        <div className="hd-sp"/><div className="hd-sp"/>
      </div>
      <div className="cp">
        {loading ? (
          <>
            <div style={{fontSize:30,marginBottom:16,animation:'pulse 1.2s ease-in-out infinite'}}>✦</div>
            <p className="cp-s on" style={{opacity:1,transform:'none'}}>Putting your briefing together…</p>
          </>
        ) : (
          <>
            <div style={{fontSize:24,marginBottom:22}}>✦</div>
            <p style={{fontSize:'clamp(20px,4.6vw,27px)',fontWeight:500,lineHeight:1.32,letterSpacing:'-0.02em',color:'#F5F5F7',maxWidth:560,margin:'0 auto'}}>{typed}<span className={`cp-c ${ready?'hide':''}`}/></p>
            <button className={`cp-b ${ready?'on':''}`} onClick={onStartReading}>Start reading</button>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================
// FREE-TEXT (AI-parsed) SCREEN — the catch-all
// ============================================
function FreeTextScreen({ dir, step, total, value, onChange, parsed, setParsed, onBack, onContinue, onSkip, finishing }) {
  const [busy, setBusy] = useState(false);
  // live parse (debounced) → "we heard: …" chips
  useEffect(() => {
    const txt = (value || '').trim();
    if (txt.length < 4) { return; }
    const id = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await fetch('/api/user/onboarding/parse', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: txt }),
        });
        if (r.ok) setParsed(await r.json());
      } catch (_) {} finally { setBusy(false); }
    }, 750);
    return () => clearTimeout(id);
  }, [value, setParsed]);

  const chips = [
    ...((parsed && parsed.topic_codes) || []),
    ...(((parsed && parsed.entities) || []).map((e) => e.name)),
    ...((parsed && parsed.interest_tags) || []),
  ].slice(0, 8);

  return (
    <>
      <div className={`sc ${dir>0?"fwd":"back"}`}>
        <div className="hd">
          <button className="hd-back" onClick={onBack}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg></button>
          <span className="hd-step">Step {step} of {total}</span>
          <div className="hd-sp"/>
        </div>
        <div className="pbar"><div className="pbar-f" style={{width:`${(step/total)*100}%`}}/></div>
        <div className="bd">
          <h1 className="tt" style={{minHeight:0}}>In your own words — who & what do you follow?</h1>
          <p className="ds">Drop names: a team, a company, a founder, a beat. One line is plenty — we'll read it back and tune to it.</p>
          <textarea
            value={value} onChange={(e)=>onChange(e.target.value)} rows={4}
            placeholder={"e.g. Arsenal + the Premier League title race · OpenAI, Nvidia, the AI-chip race · The Fed and interest rates"}
            style={{width:'100%',padding:'16px',borderRadius:16,border:'1px solid rgba(245,245,247,0.14)',background:'rgba(245,245,247,0.05)',fontFamily:'inherit',fontSize:16,lineHeight:1.5,color:'#F5F5F7',resize:'none',outline:'none',WebkitTapHighlightColor:'transparent'}}
          />
          {/* starter chips — tap to drop an example in (and show what "good" looks like) */}
          {(value || '').trim().length === 0 && (
            <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:12}}>
              {["Arsenal + the Premier League title race","OpenAI, Nvidia & the AI-chip race","The Fed and interest rates","SpaceX + anything Mars"].map((s,i)=>(
                <button key={i} onClick={()=>onChange(s)} style={{padding:'8px 13px',borderRadius:980,border:'1px dashed rgba(245,245,247,0.22)',background:'transparent',color:'#86868B',fontSize:12.5,fontWeight:600,fontFamily:'inherit',cursor:'pointer',WebkitTapHighlightColor:'transparent'}}>+ {s}</button>
              ))}
            </div>
          )}
          {(busy || chips.length>0) && (
            <div style={{marginTop:18}}>
              <div className="con" style={{margin:'0 0 9px'}}>{busy && chips.length===0 ? 'Reading…' : 'We heard'}</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {chips.map((c,i)=>(
                  <span key={i} style={{display:'inline-flex',alignItems:'center',gap:4,padding:'8px 13px',borderRadius:980,background:'#F5F5F7',color:'#000',fontSize:13,fontWeight:600,animation:'checkPop 0.25s cubic-bezier(0.34,1.56,0.64,1)'}}>{c}</span>
                ))}
              </div>
              {parsed && parsed.summary_line && <p style={{fontSize:13.5,color:'#86868B',marginTop:13,lineHeight:1.5,fontStyle:'italic'}}>{parsed.summary_line}</p>}
            </div>
          )}
        </div>
      </div>
      <div className="ft"><div className="ft-in"><div className="br">
        <button className="bt s" onClick={onSkip} disabled={finishing}>Skip</button>
        <button className="bt p" onClick={onContinue} disabled={finishing}>{finishing?'Building your feed…':'Finish'}</button>
      </div></div></div>
    </>
  );
}

// ============================================
// SEGMENTED ROW — 3-stop selector (faster than a slider on mobile)
// ============================================
function SegRow({ label, value, onChange, options }) {
  return (
    <div style={{marginBottom:24}}>
      <div className="cat-t" style={{marginBottom:10}}>{label}</div>
      <div style={{display:'flex',gap:8}}>
        {options.map(([lbl,val])=>{
          const on = value===val;
          return (
            <button key={val} onClick={()=>onChange(val)} style={{
              flex:1, padding:'13px 6px', borderRadius:12, fontFamily:'inherit', fontSize:13, fontWeight:700, cursor:'pointer',
              WebkitTapHighlightColor:'transparent', transition:'all 0.16s cubic-bezier(0.22,1,0.36,1)',
              border: on?'1.5px solid rgba(168,128,47,0.5)':'1px solid rgba(22,21,15,0.1)',
              background: on?'rgba(168,128,47,0.12)':'rgba(255,255,255,0.55)',
              color: on?'#A8802F':'#5F5B51',
            }}>{lbl}</button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// GLASS TILE COMPONENT
// ============================================
function GlassTile({ selected, disabled, onClick, icon, flag, label, rank, i = 0 }) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 7, padding: '14px 6px', borderRadius: 16, minHeight: 80, position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        WebkitTapHighlightColor: 'transparent',
        opacity: disabled ? 0.32 : 1, pointerEvents: disabled ? 'none' : 'auto',
        border: selected ? '1px solid rgba(245,245,247,0.55)' : '1px solid rgba(245,245,247,0.12)',
        background: selected ? 'rgba(245,245,247,0.14)' : 'rgba(245,245,247,0.05)',
        transition: 'background 0.18s, border-color 0.18s, transform 0.16s cubic-bezier(0.34,1.56,0.64,1)',
        animation: 'chipIn 0.5s cubic-bezier(0.22,1,0.36,1) both',
        animationDelay: `${Math.min(i, 14) * 22}ms`,
      }}
    >
      {selected && (
        <div style={{
          position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: '50%',
          background: '#F5F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'checkPop 0.24s cubic-bezier(0.34,1.7,0.5,1)',
        }}>
          {rank > 0
            ? <span style={{ color: '#000', fontSize: 11, fontWeight: 800, lineHeight: 1 }}>{rank}</span>
            : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7"/></svg>}
        </div>
      )}
      <span style={{ fontSize: flag ? 28 : 24, lineHeight: 1 }}>{flag || icon}</span>
      <span style={{ fontSize: 11, fontWeight: 600, textAlign: 'center', lineHeight: 1.2, color: selected ? '#F5F5F7' : 'rgba(245,245,247,0.62)' }}>{label}</span>
      <style>{`@keyframes checkPop{from{transform:scale(0)}to{transform:scale(1)}}`}</style>
    </div>
  );
}

// ============================================
// SCREENS
// ============================================
function WelcomeScreen({ onStart, onSignIn, dir }) {
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
    <div className={`sc ${dir > 0 ? "fwd" : "back"}`}>
      <div className="wel" onClick={tap}>
        <div className="wel-bar">
          <span className="wel-brand">today<span className="wel-plus">+</span></span>
          <button className="wel-signin" onClick={(e)=>{e.stopPropagation(); onSignIn();}}>Sign in</button>
        </div>
        <div className="wel-mid">
          <h1 className="wel-type">{typed}<span className="wel-car" /></h1>
        </div>
        <div className="wel-hint">Tap anywhere to begin</div>
      </div>
    </div>
  );
}

function TSScreen({ dir, step, total = 3, title, desc, onBack, onDescDone, guessSection, footer, children }) {
  useEffect(() => {
    if (onDescDone) { const t = setTimeout(onDescDone, 420); return () => clearTimeout(t); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className={`sc ${dir>0?"fwd":"back"}`}>
        <div className="hd">
          <button className="hd-back" onClick={onBack}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <span className="hd-step">Step {step} of {total}</span>
          <div className="hd-sp"/>
        </div>
        <div className="pbar"><div className="pbar-f" style={{width:`${(step/total)*100}%`}}/></div>
        <div className="bd">
          <h1 className="tt">{title}</h1>
          <p className="ds">{desc}</p>
          {guessSection && <div className="cnt on">{guessSection}</div>}
          <div className="cnt on">{children}</div>
        </div>
      </div>
      {footer}
    </>
  );
}

function CompScreen({ dir, summaryLine, homeCountry, followCountries, topics, onStartReading, onBack }) {
  const [typed, setTyped] = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    let i=0; const h="You\u2019re all set!";
    const t = setTimeout(()=>{const iv=setInterval(()=>{i++;setTyped(h.slice(0,i));if(i>=h.length){clearInterval(iv);setTimeout(()=>setShowCursor(false),400);setTimeout(()=>setPhase(1),350);setTimeout(()=>setPhase(2),850);setTimeout(()=>setPhase(3),1250);setTimeout(()=>setPhase(4),1650);}},55);},300);
    return ()=>clearTimeout(t);
  }, []);

  return <div className={`sc ${dir>0?"fwd":"back"}`}>
    {/* Back button header - same as other pages */}
    <div className="hd">
      <button className="hd-back" onClick={onBack}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <div className="hd-sp"/>
      <div className="hd-sp"/>
    </div>
    <div className="cp">
    {/* Swoosh checkmark */}
    <div className={`sw ${phase>=1?"on":""}`}>
      <svg viewBox="0 0 52 40" fill="none" width="44" height="34">
        <path className={`sw-p ${phase>=1?"draw":""}`} d="M4 22L18 34L48 6" stroke="#F5F5F7" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
    <h1 className="cp-t">{typed}<span className={`cp-c ${!showCursor?"hide":""}`}/></h1>
    <p className={`cp-s ${phase>=2?"on":""}`}>{summaryLine || 'Your personalized feed is ready'}</p>

    {/* Summary card — liquid glass */}
    <div style={{
      marginTop: 22,
      padding: '16px 18px',
      borderRadius: 16,
      border: '1px solid rgba(255,255,255,0.12)',
      textAlign: 'left',
      width: '100%',
      maxWidth: 300,
      opacity: phase>=3 ? 1 : 0,
      transform: phase>=3 ? 'none' : 'translateY(10px)',
      transition: 'opacity 0.5s, transform 0.5s cubic-bezier(0.22,1,0.36,1)',
      backgroundColor: 'rgba(255,255,255,0.06)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      boxShadow: `
        inset 0 0 0 0.5px rgba(255,255,255,0.35),
        inset 0.9px 1.5px 0px -1px rgba(255,255,255,0.7),
        0px 2px 8px rgba(0,0,0,0.04),
        0px 4px 16px rgba(0,0,0,0.03)
      `,
    }}>
      {homeCountry && <SummaryRow label="Home" value={`${homeCountry.flag} ${homeCountry.name}`} />}
      {followCountries.length>0 && <SummaryRow label="Following" value={
        <span style={{display:'flex',flexWrap:'wrap',gap:4}}>
          {followCountries.map(c=><span key={c.code} style={chipStyle}>{c.flag} {c.name}</span>)}
        </span>
      } />}
      {topics.length>0 && <SummaryRow label="Topics" value={
        <span style={{display:'flex',flexWrap:'wrap',gap:4}}>
          {topics.map(t=><span key={t.id} style={chipStyle}>{t.icon} {t.name}</span>)}
        </span>
      } last />}
    </div>

    <button className={`cp-b ${phase>=4?"on":""}`} onClick={onStartReading}>Start Reading</button>
  </div></div>;
}

function SummaryRow({ label, value, last }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      marginBottom: last ? 0 : 10,
      paddingBottom: last ? 0 : 10,
      borderBottom: last ? 'none' : '1px solid rgba(245,245,247,0.1)',
    }}>
      <span style={{fontSize:10,fontWeight:700,color:'#86868B',textTransform:'uppercase',letterSpacing:0.5,minWidth:52,paddingTop:4}}>{label}</span>
      <span style={{display:'flex',flexWrap:'wrap',gap:4,fontSize:13,fontWeight:600,color:'#F5F5F7'}}>{value}</span>
    </div>
  );
}

const chipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  padding: '4px 9px',
  borderRadius: 999,
  background: 'rgba(245,245,247,0.1)',
  fontSize: 11,
  fontWeight: 600,
  color: '#F5F5F7',
};
