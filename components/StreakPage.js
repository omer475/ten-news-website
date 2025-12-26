import { useEffect, useState, useRef } from 'react';

export default function StreakPage({ streakCount = 1, onAnimationComplete }) {
  const [phase, setPhase] = useState(-1); // Start hidden
  const [displayCount, setDisplayCount] = useState(0);
  const countIntervalRef = useRef(null);

  useEffect(() => {
    // Animation timeline
    const timer0 = setTimeout(() => setPhase(0), 1000);     // Show section 1 after 1s
    const timer1 = setTimeout(() => setPhase(1), 3000);     // Show section 2 after 1s + 2s = 3s
    const timer2 = setTimeout(() => setPhase(2), 5000);     // Show section 3 after 3s + 2s = 5s
    const timer3 = setTimeout(() => {
      if (onAnimationComplete) onAnimationComplete();
    }, 6000);

    return () => {
      clearTimeout(timer0);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      if (countIntervalRef.current) clearInterval(countIntervalRef.current);
    };
  }, [onAnimationComplete]);

  // Count up animation when phase 1 starts
  useEffect(() => {
    if (phase === 1) {
      setDisplayCount(0);
      const targetCount = streakCount;
      let current = 0;
      
      const countUpTimer = setTimeout(() => {
        countIntervalRef.current = setInterval(() => {
          current++;
          setDisplayCount(current);
          if (current >= targetCount) {
            clearInterval(countIntervalRef.current);
          }
        }, 140);
      }, 400);

      return () => {
        clearTimeout(countUpTimer);
        if (countIntervalRef.current) clearInterval(countIntervalRef.current);
      };
    }
  }, [phase, streakCount]);

  const getSectionClass = (sectionPhase) => {
    if (phase === sectionPhase) return 'visible';
    if (phase > sectionPhase) return 'hidden';
    return '';
  };

  return (
    <div className="streak-screen">
      {/* Section 1 - You're all caught up */}
      <div className={`section ${getSectionClass(0)}`}>
        <div className="check-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <p className="s1-title">You're all caught up</p>
        <p className="s1-sub">Today's essential stories, done</p>
      </div>

      {/* Section 2 - Streak Display */}
      <div className={`section ${getSectionClass(1)}`}>
        <div className={`streak-number ${displayCount >= streakCount ? 'pop' : ''}`}>
          {displayCount}
        </div>
        <div className="streak-row">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 23c4.14 0 7.5-3.36 7.5-7.5 0-.87-.23-1.7-.5-2.5 0 0-.5 1-1.5 1s1-3-.5-5.5c0 0-.5 1.5-2 1.5s1.5-2.5 0-6c-1.5 1.5-2 3-2.5 5.5-.33-1-.83-2-1.83-2.5 0 2-.5 4-2.5 6-.5-1.5-1-2-2-2.5 0 0-.5 1.5-.5 3.5 0 0-.5-.5-1-.5 0 1.5 0 2.5 0 2.5 0 4 3.36 7.5 7.5 7.5z"/>
          </svg>
          <span>Day streak</span>
        </div>
        <p className="streak-sub">Come back tomorrow to keep it going</p>
      </div>

      {/* Section 3 - Scroll to explore */}
      <div className={`section ${getSectionClass(2)}`}>
        <p className="s3-title">Scroll to explore more</p>
        <p className="s3-sub">Additional stories below</p>
        <div className="s3-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      <style jsx>{`
        .streak-screen {
          width: 100%;
          height: 100vh;
          min-height: 100vh;
          background: #FFFFFF;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        .section {
          position: absolute;
          width: 100%;
          padding: 0 40px;
          text-align: center;
          opacity: 0;
          transition: opacity 0.6s ease, transform 0.6s ease;
          transform: translateY(20px);
        }

        .section.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .section.hidden {
          opacity: 0;
          transform: translateY(-20px);
        }

        /* Section 1 Styles */
        .check-wrap {
          width: 64px;
          height: 64px;
          margin: 0 auto 24px;
          background: #FFF5F2;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .check-wrap svg {
          width: 28px;
          height: 28px;
          color: #FF5A33;
        }

        .s1-title {
          font-size: 24px;
          font-weight: 600;
          color: #000;
          letter-spacing: -0.5px;
          margin: 0;
        }

        .s1-sub {
          margin-top: 12px;
          font-size: 16px;
          color: #666;
        }

        /* Section 2 Styles */
        .streak-number {
          font-size: 120px;
          font-weight: 700;
          color: #000;
          line-height: 1;
          letter-spacing: -6px;
          transition: transform 0.4s ease;
        }

        .streak-number.pop {
          animation: pop 0.4s ease;
        }

        .streak-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 20px;
        }

        .streak-row svg {
          width: 24px;
          height: 24px;
          color: #FF5A33;
        }

        .streak-row span {
          font-size: 18px;
          font-weight: 600;
          color: #000;
        }

        .streak-sub {
          margin-top: 16px;
          font-size: 15px;
          color: #888;
        }

        /* Section 3 Styles */
        .s3-title {
          font-size: 22px;
          font-weight: 600;
          color: #000;
          letter-spacing: -0.3px;
          margin: 0;
        }

        .s3-sub {
          margin-top: 10px;
          font-size: 15px;
          color: #888;
        }

        .s3-icon {
          margin-top: 32px;
        }

        .s3-icon svg {
          width: 32px;
          height: 32px;
          color: #CCC;
          animation: bounce 2s ease-in-out infinite;
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(8px); }
        }

        @keyframes pop {
          0% { transform: scale(1); }
          50% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

