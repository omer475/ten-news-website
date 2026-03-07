import { useEffect, useState, useRef } from 'react';

// "You're all caught up" page shown after Must Know articles
export default function MustKnowCompletePage({ isVisible }) {
  const [typed, setTyped] = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const [phase, setPhase] = useState(0);
  const hasAnimated = useRef(false);
  const headline = "You're all caught up";

  useEffect(() => {
    if (!isVisible) {
      hasAnimated.current = false;
      setTyped("");
      setShowCursor(true);
      setPhase(0);
      return;
    }
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    let i = 0;
    const delay = setTimeout(() => {
      const interval = setInterval(() => {
        i++;
        setTyped(headline.slice(0, i));
        if (i >= headline.length) {
          clearInterval(interval);
          setTimeout(() => setShowCursor(false), 500);
          setTimeout(() => setPhase(1), 400);
          setTimeout(() => setPhase(2), 1100);
          setTimeout(() => setPhase(3), 1800);
        }
      }, 55);
      return () => clearInterval(interval);
    }, 400);
    return () => clearTimeout(delay);
  }, [isVisible]);

  return (
    <div className="cr">
      <style>{`
.cr{
  position:absolute;inset:0;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  background:#fdfdfd;
  font-family:'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif;
  -webkit-font-smoothing:antialiased;overflow:hidden;
}

/* ===== SWOOSH TICK ===== */
.cr-swoosh{
  margin-bottom:24px;opacity:0;transform:scale(0.7);
  transition:opacity 0.3s ease,transform 0.5s cubic-bezier(0.22,1,0.36,1);
}
.cr-swoosh.on{opacity:1;transform:scale(1)}
.cr-swoosh-svg{width:44px;height:34px}
.cr-swoosh-path{
  stroke-dasharray:72;stroke-dashoffset:72;
  transition:stroke-dashoffset 0.45s cubic-bezier(0.12,0,0.39,0) 0.05s;
}
.cr-swoosh-path.draw{stroke-dashoffset:0}

/* ===== TEXT ===== */
.cr-text{
  display:flex;flex-direction:column;align-items:center;
  text-align:center;padding:0 36px;
}
.cr-h{
  font-size:clamp(30px,7.5vw,42px);font-weight:800;color:#1d1d1f;
  letter-spacing:-1.2px;line-height:1.1;margin-bottom:16px;
  min-height:1.1em;
}
.cr-cursor{
  display:inline-block;width:2.5px;height:0.85em;
  background:#1d1d1f;margin-left:2px;vertical-align:text-bottom;
  animation:blink 0.6s step-end infinite;
}
.cr-cursor.hide{opacity:0;animation:none}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}

.cr-sub{
  font-size:15px;color:#9ca3af;line-height:1.6;font-weight:400;max-width:250px;
  opacity:0;transform:translateY(10px);
  transition:opacity 0.6s ease,transform 0.6s cubic-bezier(0.22,1,0.36,1);
}
.cr-sub.on{opacity:1;transform:none}
.cr-sub em{font-style:normal;color:#6b7280;font-weight:500}

/* ===== SWIPE ===== */
.cr-swipe{
  position:absolute;bottom:40px;left:0;right:0;
  display:flex;flex-direction:column;align-items:center;
  opacity:0;transition:opacity 0.8s ease;
}
.cr-swipe.on{opacity:1}
.cr-swipe-pill{
  display:flex;align-items:center;gap:6px;
  padding:8px 16px;border-radius:50px;
  background:rgba(0,0,0,0.025);
}
.cr-swipe-arrow{
  display:flex;
  animation:bob 2s cubic-bezier(0.37,0,0.63,1) infinite;
}
@keyframes bob{
  0%,100%{transform:translateY(0);opacity:0.35}
  45%{transform:translateY(-4px);opacity:0.7}
  55%{transform:translateY(-4px);opacity:0.7}
}
.cr-swipe-label{font-size:12px;color:#b0b0b0;font-weight:500;letter-spacing:0.2px}
      `}</style>

      <div className="cr-text">
        {/* Swoosh tick */}
        <div className={`cr-swoosh ${phase >= 1 ? "on" : ""}`}>
          <svg viewBox="0 0 52 40" fill="none" className="cr-swoosh-svg">
            <path
              className={`cr-swoosh-path ${phase >= 1 ? "draw" : ""}`}
              d="M4 22L18 34L48 6"
              stroke="#1d1d1f"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="cr-h">
          {typed}
          <span className={`cr-cursor ${!showCursor ? "hide" : ""}`} />
        </h1>
        <p className={`cr-sub ${phase >= 2 ? "on" : ""}`}>
          Swipe up to discover more<br />stories from <em>around the world</em>
        </p>
      </div>

      <div className={`cr-swipe ${phase >= 3 ? "on" : ""}`}>
        <div className="cr-swipe-pill">
          <span className="cr-swipe-arrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b0b0b0" strokeWidth="2.5" strokeLinecap="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>
          </span>
          <span className="cr-swipe-label">Swipe up</span>
        </div>
      </div>
    </div>
  );
}
