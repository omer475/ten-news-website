import { useState, useEffect } from "react";
import { useRouter } from "next/router";

// ============================================
// DATA — uses existing codes from lib/personalization.js
// ============================================
const COUNTRY_GROUPS = [
  { continent: "Americas", countries: [
    { code: "usa", flag: "\u{1F1FA}\u{1F1F8}", name: "United States" },
    { code: "canada", flag: "\u{1F1E8}\u{1F1E6}", name: "Canada" },
    { code: "mexico", flag: "\u{1F1F2}\u{1F1FD}", name: "Mexico" },
    { code: "brazil", flag: "\u{1F1E7}\u{1F1F7}", name: "Brazil" },
  ]},
  { continent: "Europe", countries: [
    { code: "uk", flag: "\u{1F1EC}\u{1F1E7}", name: "United Kingdom" },
    { code: "germany", flag: "\u{1F1E9}\u{1F1EA}", name: "Germany" },
    { code: "france", flag: "\u{1F1EB}\u{1F1F7}", name: "France" },
    { code: "italy", flag: "\u{1F1EE}\u{1F1F9}", name: "Italy" },
    { code: "spain", flag: "\u{1F1EA}\u{1F1F8}", name: "Spain" },
    { code: "ukraine", flag: "\u{1F1FA}\u{1F1E6}", name: "Ukraine" },
    { code: "russia", flag: "\u{1F1F7}\u{1F1FA}", name: "Russia" },
    { code: "turkiye", flag: "\u{1F1F9}\u{1F1F7}", name: "T\u00FCrkiye" },
  ]},
  { continent: "Asia & Pacific", countries: [
    { code: "china", flag: "\u{1F1E8}\u{1F1F3}", name: "China" },
    { code: "japan", flag: "\u{1F1EF}\u{1F1F5}", name: "Japan" },
    { code: "south_korea", flag: "\u{1F1F0}\u{1F1F7}", name: "South Korea" },
    { code: "india", flag: "\u{1F1EE}\u{1F1F3}", name: "India" },
    { code: "taiwan", flag: "\u{1F1F9}\u{1F1FC}", name: "Taiwan" },
    { code: "australia", flag: "\u{1F1E6}\u{1F1FA}", name: "Australia" },
  ]},
  { continent: "Middle East", countries: [
    { code: "israel", flag: "\u{1F1EE}\u{1F1F1}", name: "Israel" },
    { code: "saudi_arabia", flag: "\u{1F1F8}\u{1F1E6}", name: "Saudi Arabia" },
    { code: "iran", flag: "\u{1F1EE}\u{1F1F7}", name: "Iran" },
    { code: "uae", flag: "\u{1F1E6}\u{1F1EA}", name: "UAE" },
  ]},
];
const ALL_COUNTRIES = COUNTRY_GROUPS.flatMap(g => g.countries);

// Map ISO 3166-1 alpha-2 codes (from IP geolocation) to our internal codes
const ISO_TO_CODE = {
  US: "usa", CA: "canada", MX: "mexico", BR: "brazil",
  GB: "uk", DE: "germany", FR: "france", IT: "italy", ES: "spain",
  UA: "ukraine", RU: "russia", TR: "turkiye",
  CN: "china", JP: "japan", KR: "south_korea", IN: "india", TW: "taiwan", AU: "australia",
  IL: "israel", SA: "saudi_arabia", IR: "iran", AE: "uae",
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

  const handleComplete = async () => {
    setSaving(true);
    const preferences = {
      home_country: homeCountry,
      followed_countries: followCountries,
      followed_topics: selectedTopics,
      onboarding_completed: true,
      created_at: new Date().toISOString(),
    };

    try {
      const response = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });
      if (response.ok) {
        const data = await response.json();
        preferences.user_id = data.user?.id;
      }
    } catch (e) {
      console.warn('API save error, using localStorage only:', e);
    }

    localStorage.setItem('todayplus_preferences', JSON.stringify(preferences));
    setSaving(false);
    go(4);
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
    inset -0.15px -0.5px 2px 0px rgba(0, 87, 183, 0.08),
    inset -0.75px 1.25px 0px -1px rgba(0, 87, 183, 0.1),
    inset 0px 1.5px 2px -1px rgba(0, 87, 183, 0.06),
    0px 0.5px 2.5px 0px rgba(0, 87, 183, 0.08),
    0px 3px 10px 0px rgba(0, 87, 183, 0.1)
  `;

  return (
    <div className="ob">
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
.ob{position:fixed;inset:0;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif;background:#f5f5f7;color:#1d1d1f;-webkit-font-smoothing:antialiased;overflow:hidden}

.sc{position:absolute;inset:0;display:flex;flex-direction:column;animation:0.4s cubic-bezier(0.22,1,0.36,1) both;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch}
.sc.fwd{animation-name:sf}.sc.back{animation-name:sb}
@keyframes sf{from{opacity:0;transform:translateX(50px)}to{opacity:1;transform:none}}
@keyframes sb{from{opacity:0;transform:translateX(-50px)}to{opacity:1;transform:none}}

/* Header */
.hd{display:flex;align-items:center;padding:14px 20px 0;position:sticky;top:0;z-index:10;background:rgba(245,245,247,0.85);backdrop-filter:blur(20px) saturate(180%);-webkit-backdrop-filter:blur(20px) saturate(180%)}
.hd-back{width:36px;height:36px;border-radius:50%;border:none;background:rgba(0,0,0,0.04);backdrop-filter:blur(4px) saturate(150%);-webkit-backdrop-filter:blur(4px) saturate(150%);display:flex;align-items:center;justify-content:center;cursor:pointer;color:#1d1d1f;transition:all 0.15s;flex-shrink:0}
.hd-back:active{transform:scale(0.92);background:rgba(0,0,0,0.08)}
.hd-step{flex:1;text-align:center;font-size:12px;font-weight:600;color:#9ca3af;letter-spacing:0.5px}
.hd-sp{width:36px;flex-shrink:0}
.pbar{height:3px;background:rgba(0,0,0,0.06);margin:14px 20px 0;border-radius:2px;overflow:hidden}
.pbar-f{height:100%;background:#1d1d1f;border-radius:2px;transition:width 0.4s cubic-bezier(0.22,1,0.36,1)}

/* Body */
.bd{flex:1;padding:24px 20px 0;padding-bottom:110px}
.tt{font-size:clamp(26px,6vw,34px);font-weight:800;color:#1d1d1f;letter-spacing:-0.8px;line-height:1.1;margin-bottom:6px;min-height:1.15em}
.cur{display:inline-block;width:2.5px;height:0.78em;background:#1d1d1f;margin-left:1px;vertical-align:text-bottom;animation:bl 0.55s step-end infinite}
.cur.hide{opacity:0;animation:none}
@keyframes bl{0%,100%{opacity:1}50%{opacity:0}}
.ds{font-size:15px;color:#9ca3af;line-height:1.5;margin-bottom:24px;max-width:320px;min-height:1.5em}
.cnt{opacity:0;transform:translateY(10px);transition:opacity 0.4s ease,transform 0.4s cubic-bezier(0.22,1,0.36,1)}
.cnt.on{opacity:1;transform:none}
.cnt-rest{opacity:0;transform:translateY(10px);transition:opacity 0.5s ease,transform 0.5s cubic-bezier(0.22,1,0.36,1)}
.cnt-rest.on{opacity:1;transform:none}

/* Section label */
.con{font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin:20px 0 10px;padding-left:2px}
.con:first-child{margin-top:0}
.cat{margin-bottom:20px}
.cat-t{font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;padding-left:2px}

/* Grid */
.gr{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:6px}

/* Footer */
.ft{position:fixed;bottom:0;left:0;right:0;z-index:20;padding:0 20px;pointer-events:none;background:transparent}
.ft::before{display:none}
.ft-in{max-width:440px;margin:0 auto;padding:0 0 calc(20px + env(safe-area-inset-bottom,0px));pointer-events:auto}
.sl{display:none}
.sl.met{display:none}
.br{display:flex;gap:10px}
.bt{flex:1;padding:16px;border-radius:14px;border:none;font-family:inherit;font-size:16px;font-weight:700;cursor:pointer;transition:all 0.2s cubic-bezier(0.22,1,0.36,1);letter-spacing:-0.2px;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
.bt:active{transform:scale(0.97)}
.bt.p{
  background:rgba(255,255,255,0.72);color:#000000;
  backdrop-filter:blur(12px) saturate(180%);-webkit-backdrop-filter:blur(12px) saturate(180%);
  box-shadow:
    inset 0 0 0 0.5px rgba(255,255,255,0.5),
    inset 0.9px 1.5px 0px -1px rgba(255,255,255,0.9),
    inset -1px -1px 0px -1px rgba(255,255,255,0.8),
    inset -1.5px -4px 0.5px -3px rgba(255,255,255,0.6),
    inset -0.15px -0.5px 2px 0px rgba(0,0,0,0.08),
    inset -0.75px 1.25px 0px -1px rgba(0,0,0,0.1),
    inset 0px 1.5px 2px -1px rgba(0,0,0,0.1),
    inset 1px -3.25px 0.5px -2px rgba(0,0,0,0.06),
    0px 0.5px 2.5px 0px rgba(0,0,0,0.08),
    0px 3px 8px 0px rgba(0,0,0,0.06)}
.bt.p:disabled{
  background:rgba(255,255,255,0.5);color:rgba(0,0,0,0.35);cursor:default;transform:none;
  backdrop-filter:blur(12px) saturate(180%);-webkit-backdrop-filter:blur(12px) saturate(180%);
  box-shadow:
    inset 0 0 0 0.5px rgba(255,255,255,0.3),
    inset 0.9px 1.5px 0px -1px rgba(255,255,255,0.4),
    inset -1px -1px 0px -1px rgba(255,255,255,0.3),
    0px 0.5px 2.5px 0px rgba(0,0,0,0.04)}
.bt.s{
  background:rgba(255,255,255,0.55);color:#48484a;
  backdrop-filter:blur(12px) saturate(180%);-webkit-backdrop-filter:blur(12px) saturate(180%);
  box-shadow:
    inset 0 0 0 0.5px rgba(255,255,255,0.4),
    inset 0.9px 1.5px 0px -1px rgba(255,255,255,0.9),
    inset -1px -1px 0px -1px rgba(255,255,255,0.8),
    inset -1.5px -4px 0.5px -3px rgba(255,255,255,0.6),
    inset -0.15px -0.5px 2px 0px rgba(0,0,0,0.08),
    inset -0.75px 1.25px 0px -1px rgba(0,0,0,0.1),
    inset 0px 1.5px 2px -1px rgba(0,0,0,0.1),
    inset 1px -3.25px 0.5px -2px rgba(0,0,0,0.06),
    0px 0.5px 2.5px 0px rgba(0,0,0,0.08),
    0px 3px 8px 0px rgba(0,0,0,0.06)}

/* Welcome */
.wl{display:flex;flex-direction:column;height:100%;background:#fff;position:relative;overflow:hidden;padding:0 28px}
.wl-top{flex:1;display:flex;align-items:center;justify-content:center}
.wl-center{text-align:center}
.wl-line{font-size:clamp(28px,7vw,38px);font-weight:800;color:#1d1d1f;letter-spacing:-1px;line-height:1.15;margin-bottom:6px;min-height:1.15em}
.wl-line .wl-brand{font-weight:800;color:#1d1d1f;letter-spacing:-1.5px}
.wl-line .wl-brand span{color:#0057B7}
.wl-line2{font-size:clamp(28px,7vw,38px);font-weight:800;color:#9ca3af;letter-spacing:-1px;line-height:1.15;margin-bottom:0;min-height:1.15em}
.wl-cur{display:inline-block;width:2px;height:0.82em;background:#48484a;margin-left:2px;vertical-align:text-bottom;animation:bl 0.55s step-end infinite}
.wl-cur.hide{opacity:0;animation:none}
.wl-bottom{padding:0 0 calc(32px + env(safe-area-inset-bottom,0px))}
.wl-tagline{font-size:14px;color:#b0b0b0;line-height:1.55;text-align:center;margin-bottom:20px;opacity:0;transform:translateY(8px);transition:opacity 0.6s ease,transform 0.6s cubic-bezier(0.22,1,0.36,1)}
.wl-tagline.on{opacity:1;transform:none}
.wl-btn{width:100%;padding:18px;border-radius:16px;border:none;font-family:inherit;font-size:17px;font-weight:700;cursor:pointer;letter-spacing:-0.2px;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;opacity:0;transform:translateY(8px);transition:opacity 0.5s ease,transform 0.5s cubic-bezier(0.22,1,0.36,1);
  background:rgba(255,255,255,0.72);color:#000;
  backdrop-filter:blur(12px) saturate(180%);-webkit-backdrop-filter:blur(12px) saturate(180%);
  box-shadow:
    inset 0 0 0 0.5px rgba(255,255,255,0.5),
    inset 0.9px 1.5px 0px -1px rgba(255,255,255,0.9),
    inset -1px -1px 0px -1px rgba(255,255,255,0.8),
    inset -1.5px -4px 0.5px -3px rgba(255,255,255,0.6),
    inset -0.15px -0.5px 2px 0px rgba(0,0,0,0.08),
    inset -0.75px 1.25px 0px -1px rgba(0,0,0,0.1),
    inset 0px 1.5px 2px -1px rgba(0,0,0,0.1),
    inset 1px -3.25px 0.5px -2px rgba(0,0,0,0.06),
    0px 0.5px 2.5px 0px rgba(0,0,0,0.08),
    0px 3px 8px 0px rgba(0,0,0,0.06)}
.wl-btn.on{opacity:1;transform:none}
.wl-btn:active{transform:scale(0.98)}

/* Complete */
.cp{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 32px;flex:1;background:#fff}
.sw{margin-bottom:24px;opacity:0;transform:scale(0.7);transition:opacity 0.3s,transform 0.5s cubic-bezier(0.22,1,0.36,1)}
.sw.on{opacity:1;transform:scale(1)}
.sw-p{stroke-dasharray:72;stroke-dashoffset:72;transition:stroke-dashoffset 0.45s cubic-bezier(0.12,0,0.39,0) 0.05s}
.sw-p.draw{stroke-dashoffset:0}
.cp-t{font-size:clamp(28px,7vw,38px);font-weight:800;color:#1d1d1f;letter-spacing:-1px;line-height:1.1;margin-bottom:14px;min-height:1.1em}
.cp-c{display:inline-block;width:2.5px;height:0.82em;background:#1d1d1f;margin-left:2px;vertical-align:text-bottom;animation:bl 0.6s step-end infinite}
.cp-c.hide{opacity:0;animation:none}
.cp-s{font-size:15px;color:#9ca3af;line-height:1.6;max-width:250px;opacity:0;transform:translateY(10px);transition:opacity 0.5s,transform 0.5s cubic-bezier(0.22,1,0.36,1)}
.cp-s.on{opacity:1;transform:none}
.cp-b{margin-top:28px;padding:16px 40px;border-radius:50px;border:none;color:#000000;font-family:inherit;font-size:16px;font-weight:700;cursor:pointer;letter-spacing:-0.2px;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;opacity:0;transform:translateY(10px);transition:opacity 0.5s ease 0.1s,transform 0.5s cubic-bezier(0.22,1,0.36,1) 0.1s;
  background:rgba(255,255,255,0.72);
  backdrop-filter:blur(12px) saturate(180%);-webkit-backdrop-filter:blur(12px) saturate(180%);
  box-shadow:
    inset 0 0 0 0.5px rgba(255,255,255,0.1),
    inset 0.9px 1.5px 0px -1px rgba(255,255,255,0.9),
    inset -1px -1px 0px -1px rgba(255,255,255,0.8),
    inset -1.5px -4px 0.5px -3px rgba(255,255,255,0.6),
    inset -0.15px -0.5px 2px 0px rgba(0,0,0,0.12),
    inset -0.75px 1.25px 0px -1px rgba(0,0,0,0.2),
    inset 0px 1.5px 2px -1px rgba(0,0,0,0.2),
    inset 1px -3.25px 0.5px -2px rgba(0,0,0,0.1),
    0px 0.5px 2.5px 0px rgba(0,0,0,0.1),
    0px 3px 8px 0px rgba(0,0,0,0.08)}
.cp-b.on{opacity:1;transform:none}
.cp-b:active{transform:scale(0.96)}

@media(max-width:360px){.gr{grid-template-columns:repeat(2,1fr)}}
      `}</style>

      {screen===0 && <WelcomeScreen onStart={()=>go(1)} dir={dir}/>}

      {screen===1 && <TSScreen key="s1" dir={dir} step={1}
        title="Where are you from?"
        desc={detectedCountry ? `Hmmm let me guess... ${detectedCountry.flag} from ${detectedCountry.name}?` : "You\u2019ll see more news about your home country"}
        onBack={()=>go(0)}
        onDescDone={() => { if (detectedCountry && !homeCountry) setHomeCountry(detectedCountry.code); }}
        guessSection={detectedCountry ? <div><div className="con">Our Guess</div><div className="gr">
          <GlassTile key={detectedCountry.code} selected={homeCountry===detectedCountry.code} onClick={()=>setHomeCountry(detectedCountry.code)}
            glassShadow={glassBoxShadow} selectedShadow={glassSelectedShadow}>
            <span style={{fontSize:28,lineHeight:1}}>{detectedCountry.flag}</span>
            <span style={{fontSize:11,fontWeight:600,color:homeCountry===detectedCountry.code?'#0057B7':'#48484a',textAlign:'center',lineHeight:1.2}}>{detectedCountry.name}</span>
          </GlassTile>
        </div></div> : null}
        footer={<div className="ft"><div className="ft-in">
          {homeCountry && <div className="sl">{ALL_COUNTRIES.find(c=>c.code===homeCountry)?.flag} {ALL_COUNTRIES.find(c=>c.code===homeCountry)?.name}</div>}
          <div className="br"><button className="bt p" disabled={!homeCountry} onClick={()=>go(2)}>Continue</button></div>
        </div></div>}>
        {COUNTRY_GROUPS.map(g=><div key={g.continent}><div className="con">{g.continent}</div><div className="gr">
          {g.countries.map(c=>
            <GlassTile key={c.code} selected={homeCountry===c.code} onClick={()=>setHomeCountry(c.code)}
              glassShadow={glassBoxShadow} selectedShadow={glassSelectedShadow}>
              <span style={{fontSize:28,lineHeight:1}}>{c.flag}</span>
              <span style={{fontSize:11,fontWeight:600,color:homeCountry===c.code?'#0057B7':'#48484a',textAlign:'center',lineHeight:1.2}}>{c.name}</span>
            </GlassTile>
          )}
        </div></div>)}
      </TSScreen>}

      {screen===2 && <TSScreen key="s2" dir={dir} step={2} title="Any other countries you care about?" desc="Stay closer to the places that matter to you" onBack={()=>go(1)}
        footer={<div className="ft"><div className="ft-in">
          <div className="sl">{followCountries.length>0?`${followCountries.length} of 5 selected`:"None selected"}</div>
          <div className="br"><button className="bt s" onClick={()=>go(3)}>Skip</button><button className="bt p" onClick={()=>go(3)}>Continue</button></div>
        </div></div>}>
        {COUNTRY_GROUPS.map(g=><div key={g.continent}><div className="con">{g.continent}</div><div className="gr">
          {g.countries.map(c=>{const isHome=c.code===homeCountry;return(
            <GlassTile key={c.code} selected={followCountries.includes(c.code)} disabled={isHome}
              onClick={()=>!isHome&&toggleFollow(c.code)} glassShadow={glassBoxShadow} selectedShadow={glassSelectedShadow}>
              <span style={{fontSize:28,lineHeight:1}}>{c.flag}</span>
              <span style={{fontSize:11,fontWeight:600,color:followCountries.includes(c.code)?'#0057B7':isHome?'#c4c4c6':'#48484a',textAlign:'center',lineHeight:1.2}}>
                {c.name}{isHome ? ' (home)' : ''}
              </span>
            </GlassTile>);})}
        </div></div>)}
      </TSScreen>}

      {screen===3 && <TSScreen key="s3" dir={dir} step={3} title="What interests you?" desc="Select at least 3 topics" onBack={()=>go(2)}
        footer={<div className="ft"><div className="ft-in">
          <div className={`sl ${selectedTopics.length>=3?"met":""}`}>{selectedTopics.length<3?`Select ${3-selectedTopics.length} more`:`${selectedTopics.length} of 10 selected`}</div>
          <div className="br"><button className="bt p" disabled={selectedTopics.length<3 || saving} onClick={handleComplete}>{saving ? 'Setting up...' : 'Continue'}</button></div>
        </div></div>}>
        {TOPIC_CATEGORIES.map(cat=><div key={cat.name} className="cat"><div className="cat-t">{cat.name}</div><div className="gr">
          {cat.topics.map(t=>
            <GlassTile key={t.id} selected={selectedTopics.includes(t.id)} onClick={()=>toggleTopic(t.id)}
              glassShadow={glassBoxShadow} selectedShadow={glassSelectedShadow}>
              <span style={{fontSize:24,lineHeight:1}}>{t.icon}</span>
              <span style={{fontSize:11,fontWeight:600,color:selectedTopics.includes(t.id)?'#0057B7':'#48484a',textAlign:'center',lineHeight:1.2}}>{t.name}</span>
            </GlassTile>
          )}
        </div></div>)}
      </TSScreen>}

      {screen===4 && <CompScreen dir={dir}
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
// GLASS TILE COMPONENT
// ============================================
function GlassTile({ selected, disabled, onClick, children, glassShadow, selectedShadow }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '14px 6px',
        borderRadius: 16,
        border: selected ? '1.5px solid rgba(0, 87, 183, 0.3)' : '1px solid rgba(255, 255, 255, 0.5)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
        position: 'relative',
        minHeight: 80,
        WebkitTapHighlightColor: 'transparent',
        opacity: disabled ? 0.3 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        // Liquid glass styling
        backgroundColor: selected
          ? 'rgba(0, 87, 183, 0.04)'
          : 'rgba(255, 255, 255, 0.6)',
        backdropFilter: 'blur(12px) saturate(180%)',
        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
        boxShadow: selected ? selectedShadow : glassShadow,
      }}
    >
      {/* Checkmark badge */}
      {selected && (
        <div style={{
          position: 'absolute',
          top: 5,
          right: 5,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#0057B7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'checkPop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7"/></svg>
        </div>
      )}
      {children}
      <style>{`@keyframes checkPop{from{transform:scale(0)}to{transform:scale(1)}}`}</style>
    </div>
  );
}

// ============================================
// SCREENS
// ============================================
function WelcomeScreen({ onStart, dir }) {
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState(0);
  // 0=typing full line, 1=done typing+show line2, 2=cursor hidden, 3=tagline, 4=btn
  const [showCursor, setShowCursor] = useState(true);
  const [line2, setLine2] = useState("");

  useEffect(() => {
    let cancelled = false;
    const fullText = "Welcome to Today+.";
    const text2 = "News, reimagined.";
    let i = 0, i2 = 0;

    const t1 = setTimeout(() => {
      const iv = setInterval(() => {
        if (cancelled) return;
        i++;
        setTyped(fullText.slice(0, i));
        if (i >= fullText.length) {
          clearInterval(iv);
          setTimeout(() => {
            if (cancelled) return;
            setPhase(1);
            setTimeout(() => {
              if (cancelled) return;
              const iv2 = setInterval(() => {
                if (cancelled) return;
                i2++;
                setLine2(text2.slice(0, i2));
                if (i2 >= text2.length) {
                  clearInterval(iv2);
                  setTimeout(() => { if (!cancelled) { setShowCursor(false); setPhase(2); } }, 350);
                  setTimeout(() => { if (!cancelled) setPhase(3); }, 900);
                  setTimeout(() => { if (!cancelled) setPhase(4); }, 1400);
                }
              }, 35);
            }, 400);
          }, 300);
        }
      }, 45);
    }, 500);

    return () => { cancelled = true; clearTimeout(t1); };
  }, []);

  return (
    <div className={`sc ${dir > 0 ? "fwd" : "back"}`}>
      <div className="wl">
        <div className="wl-top">
          <div className="wl-center">
            <p className="wl-line">
              {(() => {
                const pre = "Welcome to ";
                if (typed.length <= pre.length) return typed;
                const rest = typed.slice(pre.length);
                const brandFull = "Today+";
                const brandPart = rest.slice(0, Math.min(rest.length, brandFull.length));
                const after = rest.length > brandFull.length ? rest.slice(brandFull.length) : "";
                const hasPlus = brandPart.endsWith("+");
                const todayPart = hasPlus ? brandPart.slice(0, -1) : brandPart;
                return <>{pre}<span className="wl-brand">{todayPart}{hasPlus && <span>+</span>}</span>{after}</>;
              })()}
              {phase < 1 && <span className={`wl-cur ${!showCursor ? "hide" : ""}`} />}
            </p>
            <p className="wl-line2">
              {phase >= 1 && line2}
              {phase >= 1 && phase < 2 && <span className={`wl-cur ${!showCursor ? "hide" : ""}`} />}
            </p>
          </div>
        </div>
        <div className="wl-bottom">
          <p className={`wl-tagline ${phase >= 3 ? "on" : ""}`}>
            We bet you haven&apos;t seen a news platform like this.
          </p>
          <button className={`wl-btn ${phase >= 4 ? "on" : ""}`} onClick={onStart}>
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}

function TSScreen({ dir, step, title, desc, onBack, onDescDone, guessSection, footer, children }) {
  const { titleText, descText, descDone, showTitleCursor } = useSequentialTyped(title, desc, 45, 25, onDescDone);
  const [showRest, setShowRest] = useState(!guessSection);

  useEffect(() => {
    if (descDone && guessSection) {
      const t = setTimeout(() => setShowRest(true), 1000);
      return () => clearTimeout(t);
    }
  }, [descDone, guessSection]);

  return (
    <>
      <div className={`sc ${dir>0?"fwd":"back"}`}>
        <div className="hd">
          <button className="hd-back" onClick={onBack}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <span className="hd-step">Step {step} of 3</span>
          <div className="hd-sp"/>
        </div>
        <div className="pbar"><div className="pbar-f" style={{width:`${(step/3)*100}%`}}/></div>
        <div className="bd">
          <h1 className="tt">{titleText}<span className={`cur ${!showTitleCursor?"hide":""}`}/></h1>
          <p className="ds">{descText}</p>
          {guessSection && <div className={`cnt ${descDone?"on":""}`}>{guessSection}</div>}
          <div className={guessSection ? `cnt-rest ${showRest?"on":""}` : `cnt ${descDone?"on":""}`}>{children}</div>
        </div>
      </div>
      {footer}
    </>
  );
}

function CompScreen({ dir, homeCountry, followCountries, topics, onStartReading, onBack }) {
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
        <path className={`sw-p ${phase>=1?"draw":""}`} d="M4 22L18 34L48 6" stroke="#1d1d1f" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
    <h1 className="cp-t">{typed}<span className={`cp-c ${!showCursor?"hide":""}`}/></h1>
    <p className={`cp-s ${phase>=2?"on":""}`}>Your personalized feed is ready</p>

    {/* Summary card — liquid glass */}
    <div style={{
      marginTop: 22,
      padding: '16px 18px',
      borderRadius: 16,
      border: '1px solid rgba(255,255,255,0.5)',
      textAlign: 'left',
      width: '100%',
      maxWidth: 300,
      opacity: phase>=3 ? 1 : 0,
      transform: phase>=3 ? 'none' : 'translateY(10px)',
      transition: 'opacity 0.5s, transform 0.5s cubic-bezier(0.22,1,0.36,1)',
      backgroundColor: 'rgba(255,255,255,0.6)',
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
      borderBottom: last ? 'none' : '1px solid rgba(0,0,0,0.04)',
    }}>
      <span style={{fontSize:10,fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:0.5,minWidth:52,paddingTop:4}}>{label}</span>
      <span style={{display:'flex',flexWrap:'wrap',gap:4,fontSize:13,fontWeight:600,color:'#1d1d1f'}}>{value}</span>
    </div>
  );
}

const chipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  padding: '3px 8px',
  borderRadius: 6,
  background: 'rgba(0, 87, 183, 0.06)',
  fontSize: 11,
  fontWeight: 600,
  color: '#0057B7',
};
