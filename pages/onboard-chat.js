// "The Briefing" — AI-native onboarding (replaces the chip survey).
// You TALK to an editor named Ten. As you answer in your own words, your real
// front page assembles live from /api/news, captioned ("because you said
// Arsenal"), cards added/removed as Ten reflects you back. Country auto-detects
// silently. No dropdowns, no topic grid — the AI is the interface.
//
// Signals captured (→ same algorithm path as the old onboarding): home_country
// (geo-IP), followed_topics (parse.topic_codes), followed_subtopics +
// followed_entities (parse.entities/interest_tags → article interest_tags),
// avoid_topics. Everything is best-effort and never blocks landing on a feed.

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';

const ISO_TO_CODE = { US:'usa', CA:'canada', GB:'uk', DE:'germany', FR:'france', ES:'spain', IT:'italy', UA:'ukraine', RU:'russia', TR:'turkiye', CN:'china', IN:'india', JP:'japan', AU:'australia', IL:'israel' };
const COUNTRY = {
  usa:{flag:'🇺🇸',name:'the U.S.'}, canada:{flag:'🇨🇦',name:'Canada'}, uk:{flag:'🇬🇧',name:'the UK'}, germany:{flag:'🇩🇪',name:'Germany'},
  france:{flag:'🇫🇷',name:'France'}, spain:{flag:'🇪🇸',name:'Spain'}, italy:{flag:'🇮🇹',name:'Italy'}, ukraine:{flag:'🇺🇦',name:'Ukraine'},
  russia:{flag:'🇷🇺',name:'Russia'}, turkiye:{flag:'🇹🇷',name:'Türkiye'}, china:{flag:'🇨🇳',name:'China'}, india:{flag:'🇮🇳',name:'India'},
  japan:{flag:'🇯🇵',name:'Japan'}, australia:{flag:'🇦🇺',name:'Australia'}, israel:{flag:'🇮🇱',name:'Israel'},
};
const SERIOUS = new Set(['politics','geopolitics','conflicts','economics','stock_markets','banking','human_rights']);
const FUN = new Set(['entertainment','music','gaming','travel','football','american_football','basketball','tennis','f1','cricket','combat_sports','olympics']);
const PLACEHOLDERS = [
  'I follow Arsenal and OpenAI…',
  'Türkiye politics + F1, skip celebrity gossip…',
  'The Fed, AI chips, and a bit of NBA…',
  'SpaceX, climate, and anything weird in science…',
];

export default function OnboardChat() {
  const router = useRouter();
  const [country, setCountry] = useState(null);
  const [pool, setPool] = useState([]);
  const [msgs, setMsgs] = useState([]);              // {who:'ten'|'me', text}
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState('open');         // open → fun → avoid → done
  const [thinking, setThinking] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [ph, setPh] = useState(0);
  const sig = useRef({ topics: new Set(), tags: new Set(), avoid: new Set(), summary: null });
  const [rail, setRail] = useState([]);
  const scrollRef = useRef(null);
  const railRef = useRef(null);

  // ── geo-IP country (silent) ──
  useEffect(() => {
    fetch('https://api.country.is/').then(r=>r.json()).then(d=>{
      const c = ISO_TO_CODE[d?.country]; if (c && COUNTRY[c]) setCountry(c);
    }).catch(()=>{});
  }, []);

  // ── cache one big pool to build the live rail from ──
  useEffect(() => {
    fetch('/api/news?page=1&pageSize=300&t='+Date.now()).then(r=>r.json()).then(d=>{
      setPool((d.articles||[]).filter(a=>a&&a.id&&a.type!=='news'?true:true).filter(a=>a&&a.id));
    }).catch(()=>{});
  }, []);

  // ── rotating ghost placeholder ──
  useEffect(() => { const id=setInterval(()=>setPh(p=>(p+1)%PLACEHOLDERS.length), 3200); return ()=>clearInterval(id); }, []);

  // ── opener ──
  useEffect(() => {
    const t = setTimeout(()=> setMsgs([{ who:'ten', text:"Hey — I'm Ten, and I'm building your front page right now. Skip the checkboxes: just tell me what you actually want to keep up with. Huge or dumb, go." }]), 350);
    return ()=>clearTimeout(t);
  }, []);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs, thinking]);

  // ── rank the cached pool against current signals → live rail ──
  const rerank = useCallback(() => {
    const { topics, tags, avoid } = sig.current;
    if (!pool.length || (!topics.size && !tags.size && !country)) { setRail([]); return; }
    const scored = [];
    const seen = new Set();
    for (const a of pool) {
      const at = (a.topics||[]).map(x=>String(x).toLowerCase());
      const ag = (a.interest_tags||[]).map(x=>String(x).toLowerCase());
      const ac = (a.countries||[]);
      if (avoid.size && (at.some(x=>avoid.has(x)) || ag.some(x=>avoid.has(x)))) continue;
      let score = 0, why = null;
      for (const g of ag) if (tags.has(g)) { score += 6; why = why || g; }       // entity/sub-interest = strongest
      for (const t of at) if (topics.has(t)) { score += 3; why = why || t; }       // broad topic
      if (country && ac.includes(country)) { score += 2; why = why || COUNTRY[country].name; }
      if (score <= 0) continue;
      const cid = a.cluster_id ?? a.id;
      if (seen.has(cid)) continue; seen.add(cid);
      scored.push({ a, score, why });
    }
    scored.sort((x,y)=> y.score - x.score || (Number(y.a.final_score)||0)-(Number(x.a.final_score)||0));
    // never-empty: if nothing matched but we know country, show top country/fresh
    let top = scored.slice(0, 14);
    if (!top.length && pool.length) {
      top = pool.filter(a=>!country || (a.countries||[]).includes(country)).slice(0,8).map(a=>({a,score:0,why:country?COUNTRY[country].name:'today'}));
      if (!top.length) top = pool.slice(0,8).map(a=>({a,score:0,why:'today'}));
    }
    setRail(top);
  }, [pool, country]);

  useEffect(()=>{ rerank(); }, [rerank]);

  // ── parse a user message via the LLM, merge signals ──
  const ingest = async (text) => {
    // instant keyword pre-fill (works even if LLM is slow/down)
    const toks = text.toLowerCase().split(/[^a-z0-9+]+/).filter(w=>w.length>2);
    for (const a of pool) for (const g of (a.interest_tags||[])) {
      const gl = String(g).toLowerCase(); if (toks.includes(gl)) sig.current.tags.add(gl);
    }
    rerank();
    try {
      const r = await fetch('/api/user/onboarding/parse', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text }) });
      if (r.ok) {
        const p = await r.json();
        (p.topic_codes||[]).forEach(c=> sig.current.topics.add(c));
        (p.interest_tags||[]).forEach(t=> sig.current.tags.add(String(t).toLowerCase()));
        (p.entities||[]).forEach(e=> e&&e.name && sig.current.tags.add(String(e.name).toLowerCase()));
        (p.avoid_topics||[]).forEach(t=> sig.current.avoid.add(String(t).toLowerCase()));
        if (p.summary_line) sig.current.summary = p.summary_line;
        rerank();
        return p;
      }
    } catch (_) {}
    return null;
  };

  const tenSay = (text) => setMsgs(m=>[...m, { who:'ten', text }]);

  const onSend = async () => {
    const text = input.trim();
    if (!text || thinking || finishing) return;
    setMsgs(m=>[...m, { who:'me', text }]);
    setInput('');
    setThinking(true);
    const p = await ingest(text);
    setThinking(false);

    if (phase === 'open') {
      tenSay(p?.summary_line || "Got it — pulling these in. React below to shape it.");
      // adaptive: if they only gave serious stuff, open the fun lane; else go to avoid
      const onlySerious = [...sig.current.topics].length > 0 && [...sig.current.topics].every(t=>SERIOUS.has(t)) && ![...sig.current.topics].some(t=>FUN.has(t));
      setTimeout(()=> tenSay(onlySerious
        ? "You've handed me the serious stuff. Anything you read just for fun — a team, a show, a game, food?"
        : "Love it. Anything you'd rather I NEVER put in front of you?"), 650);
      setPhase(onlySerious ? 'fun' : 'avoid');
    } else if (phase === 'fun') {
      tenSay(p?.summary_line || "Nice — that's the fun lane sorted.");
      setTimeout(()=> tenSay("Last thing — anything you'd rather I never show you?"), 650);
      setPhase('avoid');
    } else if (phase === 'avoid') {
      tenSay("Okay — I think I get you. Here's your front page.");
      setPhase('done');
      setTimeout(()=> finish(), 900);
    }
  };

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    const topics = [...sig.current.topics];
    const subtopics = [...sig.current.tags];
    const prefs = {
      home_country: country || 'usa',
      followed_countries: [],
      followed_topics: topics,
      followed_subtopics: subtopics,
      avoid_topics: [...sig.current.avoid],
      onboarding_completed: true,
      created_at: new Date().toISOString(),
    };
    // auth user?
    let authId=null, authEmail=null;
    try { const u=JSON.parse(localStorage.getItem('tennews_user')||'null'); authId=u?.id||null; authEmail=u?.email||null; } catch(_){}
    try {
      const body = { ...prefs, onboarding_freetext: msgs.filter(m=>m.who==='me').map(m=>m.text).join(' · ') };
      if (authId) { body.auth_user_id = authId; if (authEmail) body.email = authEmail; }
      // endpoint needs >=3 topics; only POST when we have them, else localStorage only
      if (topics.length >= 3) await fetch('/api/user/onboarding', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    } catch(_){}
    try { localStorage.setItem('todayplus_preferences', JSON.stringify(prefs)); } catch(_){}
    setTimeout(()=> router.push('/'), 700);
  };

  const skip = () => { setPhase('done'); finish(); };

  const cName = country ? COUNTRY[country] : null;

  return (
    <div className="bf">
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=Gabarito:wght@600;700;800&family=Figtree:wght@400;500;600&display=swap');
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
.bf{position:fixed;inset:0;font-family:'Gabarito','Figtree',-apple-system,sans-serif;color:#16150F;display:flex;flex-direction:column;
  background:radial-gradient(ellipse 90% 50% at 15% 0%,rgba(168,128,47,0.12),transparent 55%),radial-gradient(ellipse 70% 50% at 90% 100%,rgba(168,128,47,0.08),transparent 55%),#FCFBF8;-webkit-font-smoothing:antialiased}
.top{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;gap:10}
.chip{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:#5F5B51;background:rgba(255,255,255,0.6);border:1px solid rgba(22,21,15,0.08);border-radius:99px;padding:6px 12px}
.chip select{border:none;background:transparent;font-family:inherit;font-size:12.5px;font-weight:700;color:#16150F;cursor:pointer;outline:none}
.skip{font-size:13px;font-weight:600;color:#A39E92;background:none;border:none;cursor:pointer;font-family:inherit}
.wrap{flex:1;display:flex;min-height:0}
@media(min-width:760px){.wrap{max-width:1000px;margin:0 auto;width:100%}}
.chatcol{flex:1;display:flex;flex-direction:column;min-width:0}
.railcol{width:0;overflow:hidden;transition:width 0.5s cubic-bezier(.22,1,.36,1)}
.railcol.on{width:44%;max-width:380px}
@media(max-width:759px){.wrap{flex-direction:column}.railcol.on{width:100%;max-width:none;height:42%;order:-1;border-bottom:1px solid rgba(22,21,15,0.06)}.chatcol{flex:1}}
.stream{flex:1;overflow-y:auto;padding:18px;display:flex;flex-direction:column;gap:12px;scrollbar-width:none}
.stream::-webkit-scrollbar{display:none}
.row{display:flex;animation:rise .4s cubic-bezier(.22,1,.36,1) both}
.row.me{justify-content:flex-end}
@keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.bub{max-width:78%;padding:12px 15px;border-radius:18px;font-size:15.5px;line-height:1.45;font-weight:450}
.bub.ten{background:#fff;border:1px solid rgba(22,21,15,0.07);border-bottom-left-radius:5px;box-shadow:0 2px 10px rgba(22,21,15,0.04)}
.bub.me{background:#16150F;color:#FCFBF8;border-bottom-right-radius:5px;font-weight:500}
.dots{display:inline-flex;gap:4px;padding:14px 16px}
.dots span{width:7px;height:7px;border-radius:50%;background:#C9C3B5;animation:hop 1s ease-in-out infinite}
.dots span:nth-child(2){animation-delay:.15s}.dots span:nth-child(3){animation-delay:.3s}
@keyframes hop{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(-5px);opacity:1}}
.inwrap{padding:12px 16px calc(14px + env(safe-area-inset-bottom,0));display:flex;gap:9px;align-items:flex-end}
.ta{flex:1;resize:none;border:1px solid rgba(22,21,15,0.12);background:rgba(255,255,255,0.75);border-radius:18px;padding:13px 16px;font-family:inherit;font-size:16px;line-height:1.4;color:#16150F;outline:none;max-height:120px}
.send{flex-shrink:0;width:46px;height:46px;border-radius:50%;border:none;background:#16150F;color:#FCFBF8;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .15s}
.send:active{transform:scale(.92)}.send:disabled{opacity:.35;cursor:default}
.rhead{font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#A8802F;padding:16px 16px 8px}
.rscroll{height:100%;overflow-y:auto;padding:0 14px 20px;scrollbar-width:none}.rscroll::-webkit-scrollbar{display:none}
.rcard{display:flex;gap:11px;align-items:center;padding:9px 0;border-bottom:1px solid rgba(22,21,15,0.05);animation:rise .45s cubic-bezier(.22,1,.36,1) both}
.rthumb{width:58px;height:58px;border-radius:12px;flex-shrink:0;object-fit:cover;background:linear-gradient(135deg,#EDE8DD,#F7F3EA)}
.rtxt{min-width:0}
.rtitle{font-size:13px;font-weight:700;line-height:1.25;color:#16150F;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rwhy{font-family:'IBM Plex Mono',monospace;font-size:9px;color:#A8802F;margin-top:3px;text-transform:uppercase;letter-spacing:.05em}
.cnt{font-family:'IBM Plex Mono',monospace;font-size:9.5px;color:#5F5B51;padding:0 16px 10px;letter-spacing:.06em}
.ghost{position:absolute;left:17px;top:13px;font-size:16px;color:#B8B2A4;pointer-events:none;transition:opacity .3s}
      `}</style>

      <div className="top">
        <span className="chip">📍 Reading from {cName ? cName.flag : '🌍'}
          <select value={country||''} onChange={e=>setCountry(e.target.value||null)}>
            {!country && <option value="">…</option>}
            {Object.entries(COUNTRY).map(([code,c])=> <option key={code} value={code}>{c.name.replace(/^the /,'')}</option>)}
          </select>
        </span>
        {phase!=='done' && <button className="skip" onClick={skip}>just build it →</button>}
      </div>

      <div className="wrap">
        <div className={`railcol ${rail.length?'on':''}`}>
          <div className="rhead">Your Front Page</div>
          {rail.length>0 && <div className="cnt">{rail.length} stories lined up</div>}
          <div className="rscroll" ref={railRef}>
            {rail.map(({a,why},i)=>(
              <div className="rcard" key={a.id} style={{animationDelay:`${Math.min(i,8)*0.05}s`}}>
                {a.urlToImage
                  ? <img className="rthumb" src={a.urlToImage} alt="" loading="lazy" />
                  : <div className="rthumb" style={{display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>{a.emoji||'📰'}</div>}
                <div className="rtxt">
                  <div className="rtitle">{(a.title||'').replace(/\*\*/g,'')}</div>
                  {why && <div className="rwhy">because you said {why}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="chatcol">
          <div className="stream" ref={scrollRef}>
            {msgs.map((m,i)=> <div className={`row ${m.who}`} key={i}><div className={`bub ${m.who}`}>{m.text}</div></div>)}
            {thinking && <div className="row ten"><div className="bub ten"><span className="dots"><span/><span/><span/></span></div></div>}
          </div>
          {phase!=='done' && (
            <div className="inwrap">
              <div style={{flex:1,position:'relative'}}>
                {!input && <span className="ghost">{PLACEHOLDERS[ph]}</span>}
                <textarea className="ta" rows={1} value={input}
                  onChange={e=>setInput(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();onSend();} }} />
              </div>
              <button className="send" onClick={onSend} disabled={!input.trim()||thinking}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </button>
            </div>
          )}
          {finishing && <div className="cnt" style={{textAlign:'center',padding:'16px'}}>Printing your edition…</div>}
        </div>
      </div>
    </div>
  );
}
