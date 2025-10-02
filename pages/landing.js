import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Landing() {
  const router = useRouter();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <style jsx>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .container {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          position: relative;
          overflow: hidden;
        }

        /* Animated background gradient */
        .gradient-bg {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, 
            #667eea 0%, 
            #764ba2 25%,
            #f093fb 50%,
            #4facfe 75%,
            #00f2fe 100%
          );
          background-size: 400% 400%;
          animation: gradientShift 15s ease infinite;
          z-index: -1;
        }

        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        /* Glassmorphism overlay */
        .glass-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          backdrop-filter: blur(100px);
          -webkit-backdrop-filter: blur(100px);
          background: rgba(255, 255, 255, 0.1);
        }

        /* Header */
        .header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          padding: 24px 40px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 1000;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
          transition: all 0.3s ease;
        }

        .logo {
          font-size: 28px;
          font-weight: 900;
          color: #ffffff;
          letter-spacing: -1px;
        }

        .logo span {
          background: linear-gradient(90deg, #fbbf24, #f59e0b);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .nav-buttons {
          display: flex;
          gap: 16px;
        }

        .btn {
          padding: 12px 28px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.3s ease;
          border: none;
          outline: none;
        }

        .btn-ghost {
          background: transparent;
          color: #ffffff;
          border: 2px solid rgba(255, 255, 255, 0.3);
        }

        .btn-ghost:hover {
          background: rgba(255, 255, 255, 0.2);
          border-color: rgba(255, 255, 255, 0.5);
          transform: translateY(-2px);
        }

        .btn-primary {
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          color: #1f2937;
          box-shadow: 0 8px 24px rgba(251, 191, 36, 0.3);
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(251, 191, 36, 0.4);
        }

        /* Hero Section */
        .hero {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          padding: 120px 24px 80px;
          position: relative;
        }

        .hero-badge {
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.3);
          padding: 8px 20px;
          border-radius: 24px;
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 32px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          animation: fadeInUp 0.6s ease;
        }

        .live-indicator {
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.2);
          }
        }

        .hero-title {
          font-size: 72px;
          font-weight: 900;
          color: #ffffff;
          line-height: 1.1;
          margin-bottom: 24px;
          letter-spacing: -2px;
          animation: fadeInUp 0.8s ease;
        }

        .hero-gradient-text {
          background: linear-gradient(90deg, #fbbf24, #ffffff, #fbbf24);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 3s linear infinite;
        }

        @keyframes shimmer {
          to {
            background-position: 200% center;
          }
        }

        .hero-subtitle {
          font-size: 20px;
          color: rgba(255, 255, 255, 0.9);
          max-width: 600px;
          line-height: 1.6;
          margin-bottom: 48px;
          animation: fadeInUp 1s ease;
        }

        .hero-cta {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          justify-content: center;
          animation: fadeInUp 1.2s ease;
        }

        .btn-large {
          padding: 18px 40px;
          font-size: 17px;
          border-radius: 14px;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Features Section */
        .features {
          background: #ffffff;
          padding: 100px 24px;
          position: relative;
        }

        .section-title {
          text-align: center;
          font-size: 48px;
          font-weight: 800;
          color: #1f2937;
          margin-bottom: 16px;
          letter-spacing: -1px;
        }

        .section-subtitle {
          text-align: center;
          font-size: 18px;
          color: #6b7280;
          margin-bottom: 64px;
          max-width: 600px;
          margin-left: auto;
          margin-right: auto;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 32px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .feature-card {
          background: #ffffff;
          border-radius: 20px;
          padding: 40px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid rgba(0, 0, 0, 0.05);
          position: relative;
          overflow: hidden;
        }

        .feature-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 4px;
          background: linear-gradient(90deg, #667eea, #764ba2);
          transform: scaleX(0);
          transition: transform 0.3s ease;
        }

        .feature-card:hover::before {
          transform: scaleX(1);
        }

        .feature-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.12);
        }

        .feature-icon {
          font-size: 48px;
          margin-bottom: 24px;
          display: block;
        }

        .feature-title {
          font-size: 24px;
          font-weight: 700;
          color: #1f2937;
          margin-bottom: 12px;
        }

        .feature-description {
          font-size: 16px;
          color: #6b7280;
          line-height: 1.6;
        }

        /* Stats Section */
        .stats {
          background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
          padding: 100px 24px;
          color: #ffffff;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 48px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .stat-item {
          text-align: center;
        }

        .stat-number {
          font-size: 56px;
          font-weight: 900;
          background: linear-gradient(90deg, #fbbf24, #f59e0b);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 8px;
        }

        .stat-label {
          font-size: 16px;
          color: rgba(255, 255, 255, 0.7);
          font-weight: 500;
        }

        /* CTA Section */
        .cta-section {
          background: #ffffff;
          padding: 120px 24px;
          text-align: center;
        }

        .cta-box {
          max-width: 700px;
          margin: 0 auto;
          padding: 60px 40px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 24px;
          box-shadow: 0 20px 60px rgba(102, 126, 234, 0.3);
          color: #ffffff;
        }

        .cta-title {
          font-size: 40px;
          font-weight: 800;
          margin-bottom: 16px;
          letter-spacing: -1px;
        }

        .cta-description {
          font-size: 18px;
          margin-bottom: 32px;
          opacity: 0.95;
        }

        /* Footer */
        .footer {
          background: #1f2937;
          padding: 60px 24px 32px;
          color: rgba(255, 255, 255, 0.7);
        }

        .footer-content {
          max-width: 1200px;
          margin: 0 auto;
          text-align: center;
        }

        .footer-logo {
          font-size: 32px;
          font-weight: 900;
          color: #ffffff;
          margin-bottom: 16px;
        }

        .footer-text {
          font-size: 15px;
          margin-bottom: 32px;
        }

        .footer-links {
          display: flex;
          gap: 32px;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 32px;
        }

        .footer-link {
          color: rgba(255, 255, 255, 0.7);
          text-decoration: none;
          transition: color 0.2s;
          font-size: 15px;
        }

        .footer-link:hover {
          color: #ffffff;
        }

        .footer-copyright {
          font-size: 14px;
          opacity: 0.5;
          margin-top: 32px;
          padding-top: 32px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        /* Floating elements */
        .floating-shape {
          position: absolute;
          border-radius: 50%;
          filter: blur(40px);
          opacity: 0.3;
          animation: float 20s ease-in-out infinite;
        }

        .shape-1 {
          width: 300px;
          height: 300px;
          background: #fbbf24;
          top: 10%;
          left: 10%;
          animation-delay: 0s;
        }

        .shape-2 {
          width: 200px;
          height: 200px;
          background: #ec4899;
          top: 60%;
          right: 15%;
          animation-delay: 5s;
        }

        .shape-3 {
          width: 250px;
          height: 250px;
          background: #06b6d4;
          bottom: 10%;
          left: 20%;
          animation-delay: 10s;
        }

        @keyframes float {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
          }
          33% {
            transform: translate(30px, -30px) rotate(120deg);
          }
          66% {
            transform: translate(-20px, 20px) rotate(240deg);
          }
        }

        /* Responsive */
        @media (max-width: 768px) {
          .hero-title {
            font-size: 48px;
          }

          .section-title {
            font-size: 36px;
          }

          .header {
            padding: 20px 24px;
          }

          .btn-large {
            width: 100%;
          }

          .hero-cta {
            width: 100%;
            flex-direction: column;
          }

          .features-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="container">
        <div className="gradient-bg"></div>
        <div className="glass-overlay"></div>

        {/* Floating shapes */}
        <div className="floating-shape shape-1"></div>
        <div className="floating-shape shape-2"></div>
        <div className="floating-shape shape-3"></div>

        {/* Header */}
        <header className="header">
          <div className="logo">
            <span>TEN</span> NEWS
          </div>
          <nav className="nav-buttons">
            <button className="btn btn-ghost" onClick={() => router.push('/')}>
              Open App
            </button>
          </nav>
        </header>

        {/* Hero Section */}
        <section className="hero">
          <div className="hero-badge">
            <div className="live-indicator"></div>
            <span>AI-Powered Global News</span>
          </div>

          <h1 className="hero-title">
            Your Daily Dose of<br />
            <span className="hero-gradient-text">Global Intelligence</span>
          </h1>

          <p className="hero-subtitle">
            10 essential stories. 2 minutes to read. AI-curated from 80+ trusted sources worldwide. 
            Start your day informed.
          </p>

          <div className="hero-cta">
            <button className="btn btn-primary btn-large" onClick={() => router.push('/')}>
              Start Reading Free →
            </button>
            <button className="btn btn-ghost btn-large">
              See Today's Stories
            </button>
          </div>
        </section>
      </div>

      {/* Features Section */}
      <section className="features">
        <h2 className="section-title">Why Readers Love Ten News</h2>
        <p className="section-subtitle">
          Everything you need to stay informed, nothing you don't
        </p>

        <div className="features-grid">
          <div className="feature-card">
            <span className="feature-icon">🤖</span>
            <h3 className="feature-title">AI-Curated</h3>
            <p className="feature-description">
              Claude AI selects the 10 most globally relevant stories from thousands of articles daily
            </p>
          </div>

          <div className="feature-card">
            <span className="feature-icon">⚡</span>
            <h3 className="feature-title">2-Minute Read</h3>
            <p className="feature-description">
              40-50 word summaries with key details. Get informed fast without information overload
            </p>
          </div>

          <div className="feature-card">
            <span className="feature-icon">🌍</span>
            <h3 className="feature-title">Global Perspective</h3>
            <p className="feature-description">
              80+ trusted sources worldwide. From Reuters to BBC, only credible journalism
            </p>
          </div>

          <div className="feature-card">
            <span className="feature-icon">📅</span>
            <h3 className="feature-title">Timeline Context</h3>
            <p className="feature-description">
              Understand the background with AI-generated timelines for every major story
            </p>
          </div>

          <div className="feature-card">
            <span className="feature-icon">🌙</span>
            <h3 className="feature-title">Dark Mode</h3>
            <p className="feature-description">
              Beautiful reading experience day or night with seamless theme switching
            </p>
          </div>

          <div className="feature-card">
            <span className="feature-icon">📱</span>
            <h3 className="feature-title">Mobile First</h3>
            <p className="feature-description">
              Swipe-based navigation optimized for your phone. Read anywhere, anytime
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats">
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-number">10</div>
            <div className="stat-label">Stories Daily</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">80+</div>
            <div className="stat-label">Trusted Sources</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">2min</div>
            <div className="stat-label">Reading Time</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">7AM</div>
            <div className="stat-label">Daily Updates</div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-box">
          <h2 className="cta-title">Ready to Stay Informed?</h2>
          <p className="cta-description">
            Join thousands of readers who start their day with Ten News
          </p>
          <button className="btn btn-ghost btn-large" onClick={() => router.push('/')}>
            Get Started Free →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-logo">
            <span style={{ color: '#fbbf24' }}>TEN</span> NEWS
          </div>
          <p className="footer-text">
            AI-powered global news delivered daily
          </p>
          <div className="footer-links">
            <a href="#" className="footer-link">About</a>
            <a href="#" className="footer-link">Privacy</a>
            <a href="#" className="footer-link">Terms</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
          <div className="footer-copyright">
            © {new Date().getFullYear()} Ten News. All rights reserved.
          </div>
        </div>
      </footer>
    </>
  );
}

