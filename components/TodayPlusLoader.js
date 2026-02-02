import { useState, useEffect } from 'react';

export default function TodayPlusLoader() {
  const [phase, setPhase] = useState(0); // 0: initial, 1: logo visible, 2: plus animating
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Phase 1: Show logo after brief delay
    const phase1 = setTimeout(() => setPhase(1), 100);
    
    // Phase 2: Start plus animation
    const phase2 = setTimeout(() => setPhase(2), 600);
    
    return () => {
      clearTimeout(phase1);
      clearTimeout(phase2);
    };
  }, []);

  useEffect(() => {
    if (phase < 2) return;
    
    // Smooth progress animation
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        // Ease out - slower as it approaches 100
        const increment = Math.max(0.5, (100 - prev) / 15);
        return Math.min(100, prev + increment);
      });
    }, 30);
    
    return () => clearInterval(interval);
  }, [phase]);

  return (
    <div className="loader-container">
      {/* Subtle gradient background */}
      <div className="bg-gradient" />
      
      <div className="loader-content">
        {/* Logo */}
        <div className={`logo ${phase >= 1 ? 'visible' : ''}`}>
          <span className="logo-today">today</span>
          <span className={`logo-plus ${phase >= 2 ? 'animate' : ''}`}>+</span>
        </div>
        
        {/* Minimal progress line */}
        <div className={`progress-container ${phase >= 2 ? 'visible' : ''}`}>
          <div 
            className="progress-bar" 
            style={{ transform: `scaleX(${progress / 100})` }}
          />
        </div>
      </div>
      
      <style jsx>{`
        .loader-container {
          position: fixed;
          inset: 0;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          overflow: hidden;
        }
        
        .bg-gradient {
          position: absolute;
          inset: 0;
          background: radial-gradient(
            ellipse 80% 50% at 50% -20%,
            rgba(120, 119, 198, 0.03),
            transparent
          );
          pointer-events: none;
        }
        
        .loader-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 40px;
        }
        
        .logo {
          display: flex;
          align-items: baseline;
          opacity: 0;
          transform: translateY(20px);
          transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        
        .logo.visible {
          opacity: 1;
          transform: translateY(0);
        }
        
        .logo-today {
          font-size: 36px;
          font-weight: 600;
          letter-spacing: -1.5px;
          color: #000000;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
          user-select: none;
        }
        
        .logo-plus {
          font-size: 36px;
          font-weight: 600;
          color: #000000;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
          user-select: none;
          margin-left: 1px;
          display: inline-block;
          transition: color 0.3s ease;
        }
        
        .logo-plus.animate {
          animation: pulse-color 2s ease-in-out infinite;
        }
        
        @keyframes pulse-color {
          0%, 100% {
            color: #000000;
          }
          50% {
            color: #0066FF;
          }
        }
        
        .progress-container {
          width: 120px;
          height: 2px;
          background: rgba(0, 0, 0, 0.06);
          border-radius: 2px;
          overflow: hidden;
          opacity: 0;
          transform: scaleX(0.8);
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        
        .progress-container.visible {
          opacity: 1;
          transform: scaleX(1);
        }
        
        .progress-bar {
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, #000000 0%, #0066FF 100%);
          border-radius: 2px;
          transform-origin: left center;
          transition: transform 0.1s ease-out;
        }
        
        @media (max-width: 480px) {
          .logo-today,
          .logo-plus {
            font-size: 32px;
            letter-spacing: -1px;
          }
          
          .progress-container {
            width: 90px;
          }
        }
        
        @media (prefers-reduced-motion: reduce) {
          .logo,
          .progress-container {
            transition: opacity 0.3s ease;
            transform: none;
          }
          
          .logo.visible,
          .progress-container.visible {
            transform: none;
          }
          
          .logo-plus.animate {
            animation: none;
            color: #0066FF;
          }
        }
      `}</style>
    </div>
  );
}
