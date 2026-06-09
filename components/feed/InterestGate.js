'use client';

import React, { useState } from 'react';
import { SignupForm } from '../AuthForms';

const APPLE_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, "Helvetica Neue", sans-serif';

// Compact, popular interest set (ids match the onboarding topic ids).
const TOPIC_OPTIONS = [
  { id: 'ai', name: 'AI', icon: '🤖' },
  { id: 'tech_industry', name: 'Tech', icon: '💻' },
  { id: 'economics', name: 'Economy', icon: '💰' },
  { id: 'stock_markets', name: 'Markets', icon: '📈' },
  { id: 'politics', name: 'Politics', icon: '🏛️' },
  { id: 'geopolitics', name: 'World', icon: '🌍' },
  { id: 'conflicts', name: 'Conflicts', icon: '⚔️' },
  { id: 'science', name: 'Science', icon: '🔬' },
  { id: 'space', name: 'Space', icon: '🛰️' },
  { id: 'health', name: 'Health', icon: '🩺' },
  { id: 'climate', name: 'Climate', icon: '🌍' },
  { id: 'startups', name: 'Startups', icon: '🚀' },
  { id: 'football', name: 'Football', icon: '⚽' },
  { id: 'basketball', name: 'Basketball', icon: '🏀' },
  { id: 'f1', name: 'Formula 1', icon: '🏎️' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬' },
  { id: 'music', name: 'Music', icon: '🎵' },
  { id: 'gaming', name: 'Gaming', icon: '🎮' },
];

/*
 * InterestGate — shown after the 8th article for guests. Pick interests, then
 * create a free account. Holds its own selection state so toggling chips doesn't
 * rebuild the feed. On signup it hands the chosen topics back to the parent.
 */
export default function InterestGate({ isDark = false, authError, onSignup, onOAuthLogin, onLogin }) {
  const [selected, setSelected] = useState([]);
  const accent = isDark ? '#0A84FF' : '#007AFF';
  const colors = {
    text: isDark ? '#F5F5F7' : '#1d1d1f',
    secondary: isDark ? 'rgba(235,235,245,0.6)' : '#6e6e73',
    chipBg: isDark ? 'rgba(255,255,255,0.08)' : '#F2F2F4',
    chipText: isDark ? 'rgba(255,255,255,0.72)' : '#3a3a3c',
    card: isDark ? '#161618' : '#FFFFFF',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
  };

  const toggle = (id) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div style={{
      maxWidth: 560, margin: '20px auto', padding: '28px 20px 26px',
      background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 22,
      fontFamily: APPLE_FONT, WebkitFontSmoothing: 'antialiased', textAlign: 'center',
    }}>
      <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15, color: colors.text }}>
        Make Today+ yours
      </h2>
      <p style={{ margin: '10px auto 0', maxWidth: 380, fontSize: 15.5, lineHeight: 1.5, color: colors.secondary }}>
        Tap what you’re into, then create your free account to keep reading.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', margin: '20px 0 8px' }}>
        {TOPIC_OPTIONS.map((t) => {
          const on = selected.includes(t.id);
          return (
            <button key={t.id} onClick={() => toggle(t.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                border: `1px solid ${on ? accent : 'transparent'}`,
                background: on ? (isDark ? 'rgba(10,132,255,0.18)' : 'rgba(0,122,255,0.10)') : colors.chipBg,
                color: on ? accent : colors.chipText,
                fontSize: 14, fontWeight: 600, padding: '9px 14px', borderRadius: 999,
                transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
                WebkitTapHighlightColor: 'transparent',
              }}>
              <span style={{ fontSize: 15 }}>{t.icon}</span>{t.name}
            </button>
          );
        })}
      </div>
      <p style={{ margin: '4px 0 20px', fontSize: 12.5, color: colors.secondary, minHeight: 16 }}>
        {selected.length > 0 ? `${selected.length} selected` : 'Optional — pick a few to personalize your feed'}
      </p>

      {authError && <div className="auth-error" style={{ marginBottom: 14 }}>{authError}</div>}

      <SignupForm
        onSubmit={(email, password, fullName) => onSignup(email, password, fullName, selected)}
        onOAuthLogin={(provider) => onOAuthLogin(provider, selected)}
      />

      <p style={{ marginTop: 14, fontSize: 14, color: colors.secondary }}>
        Already have an account?{' '}
        <button onClick={onLogin} style={{ border: 'none', background: 'none', cursor: 'pointer', color: accent, fontWeight: 600, fontSize: 14, padding: 0 }}>
          Log in
        </button>
      </p>
    </div>
  );
}
