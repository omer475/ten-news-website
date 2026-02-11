import { useState, useEffect, useRef } from "react";

// ============================================
// DATA — uses same codes as onboarding.js
// ============================================
const COUNTRY_GROUPS = [
  { continent: "Americas", countries: [
    { code: "usa", flag: "\u{1F1FA}\u{1F1F8}", name: "United States" },
    { code: "canada", flag: "\u{1F1E8}\u{1F1E6}", name: "Canada" },
    { code: "brazil", flag: "\u{1F1E7}\u{1F1F7}", name: "Brazil" },
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
    { code: "ireland", flag: "\u{1F1EE}\u{1F1EA}", name: "Ireland" },
  ]},
  { continent: "Asia & Pacific", countries: [
    { code: "china", flag: "\u{1F1E8}\u{1F1F3}", name: "China" },
    { code: "india", flag: "\u{1F1EE}\u{1F1F3}", name: "India" },
    { code: "japan", flag: "\u{1F1EF}\u{1F1F5}", name: "Japan" },
    { code: "south_korea", flag: "\u{1F1F0}\u{1F1F7}", name: "South Korea" },
    { code: "pakistan", flag: "\u{1F1F5}\u{1F1F0}", name: "Pakistan" },
    { code: "singapore", flag: "\u{1F1F8}\u{1F1EC}", name: "Singapore" },
    { code: "australia", flag: "\u{1F1E6}\u{1F1FA}", name: "Australia" },
  ]},
  { continent: "Middle East & Africa", countries: [
    { code: "israel", flag: "\u{1F1EE}\u{1F1F1}", name: "Israel" },
    { code: "nigeria", flag: "\u{1F1F3}\u{1F1EC}", name: "Nigeria" },
    { code: "south_africa", flag: "\u{1F1FF}\u{1F1E6}", name: "South Africa" },
  ]},
];
const ALL_COUNTRIES = COUNTRY_GROUPS.flatMap(g => g.countries);

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
const ALL_TOPICS = TOPIC_CATEGORIES.flatMap(c => c.topics);

// Liquid glass box shadow (matching share/event buttons)
const GLASS_SHADOW = `
  inset 0 0 0 0.5px rgba(255, 255, 255, 0.25),
  inset 0.9px 1.5px 0px -1px rgba(255, 255, 255, 0.85),
  inset -1px -1px 0px -1px rgba(255, 255, 255, 0.7),
  inset -1.5px -4px 0.5px -3px rgba(255, 255, 255, 0.55),
  inset -0.15px -0.5px 2px 0px rgba(0, 0, 0, 0.12),
  0px 1px 3px 0px rgba(0, 0, 0, 0.08),
  0px 4px 12px 0px rgba(0, 0, 0, 0.06)
`;

// ============================================
// MAIN COMPONENT
// ============================================
export default function PreferencesSettings({ onClose, darkMode = false }) {
  const [homeCountry, setHomeCountry] = useState(null);
  const [followCountries, setFollowCountries] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [visible, setVisible] = useState(false);
  const [userId, setUserId] = useState(null);

  // Picker states
  const [showHomePicker, setShowHomePicker] = useState(false);
  const [showFollowPicker, setShowFollowPicker] = useState(false);
  const [showTopicPicker, setShowTopicPicker] = useState(false);

  const bodyRef = useRef(null);

  // Load preferences on mount
  useEffect(() => {
    try {
      const prefs = localStorage.getItem('todayplus_preferences');
      if (prefs) {
        const parsed = JSON.parse(prefs);
        if (parsed.home_country) setHomeCountry(parsed.home_country);
        if (parsed.followed_countries) setFollowCountries(parsed.followed_countries);
        if (parsed.followed_topics) setSelectedTopics(parsed.followed_topics);
        if (parsed.user_id) setUserId(parsed.user_id);
      }
    } catch (e) {
      console.warn('Failed to load preferences:', e);
    }

    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
  }, []);

  const markDirty = () => { setDirty(true); setSaveSuccess(false); };

  const changeHome = (code) => {
    setHomeCountry(code);
    setShowHomePicker(false);
    // Remove from follow list if it was there
    setFollowCountries(p => p.filter(c => c !== code));
    markDirty();
  };

  const removeFollow = (code) => {
    setFollowCountries(p => p.filter(c => c !== code));
    markDirty();
  };

  const addFollow = (code) => {
    if (followCountries.length < 5 && code !== homeCountry && !followCountries.includes(code)) {
      setFollowCountries(p => [...p, code]);
      markDirty();
    }
  };

  const toggleFollow = (code) => {
    if (followCountries.includes(code)) {
      removeFollow(code);
    } else {
      addFollow(code);
    }
  };

  const removeTopic = (id) => {
    if (selectedTopics.length > 3) {
      setSelectedTopics(p => p.filter(t => t !== id));
      markDirty();
    }
  };

  const addTopic = (id) => {
    if (selectedTopics.length < 10 && !selectedTopics.includes(id)) {
      setSelectedTopics(p => [...p, id]);
      markDirty();
    }
  };

  const toggleTopic = (id) => {
    if (selectedTopics.includes(id)) {
      removeTopic(id);
    } else {
      addTopic(id);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save to localStorage
      const prefs = {
        home_country: homeCountry,
        followed_countries: followCountries,
        followed_topics: selectedTopics,
        onboarding_completed: true,
        user_id: userId,
      };
      localStorage.setItem('todayplus_preferences', JSON.stringify(prefs));

      // Save to server if we have a user_id
      if (userId) {
        await fetch('/api/user/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            home_country: homeCountry,
            followed_countries: followCountries,
            followed_topics: selectedTopics,
          }),
        });
      }

      setDirty(false);
      setSaveSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 600);
    } catch (e) {
      console.error('Save preferences error:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onClose(), 350);
  };

  const home = ALL_COUNTRIES.find(c => c.code === homeCountry);

  // Dark mode colors
  const bg = darkMode ? '#000000' : '#ffffff';
  const surfaceBg = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)';
  const surfaceBorder = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
  const textPrimary = darkMode ? '#ffffff' : '#1d1d1f';
  const textSecondary = darkMode ? 'rgba(255,255,255,0.5)' : '#8e8e93';
  const textTertiary = darkMode ? 'rgba(255,255,255,0.3)' : '#c7c7cc';
  const accentColor = '#007AFF';
  const dividerColor = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const pickerBg = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';
  const tileBg = darkMode ? 'rgba(255,255,255,0.08)' : '#ffffff';
  const tileSelectedBg = darkMode ? 'rgba(0,122,255,0.15)' : 'rgba(0,122,255,0.06)';
  const removeBtnBg = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 999999,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', sans-serif",
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
    }}>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: darkMode ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(40px) saturate(200%)',
          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: '92vh',
        background: bg,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.15), 0 -2px 10px rgba(0,0,0,0.05)',
      }}>

        {/* Handle bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          paddingTop: 10,
          paddingBottom: 2,
          flexShrink: 0,
        }}>
          <div style={{
            width: 36,
            height: 5,
            borderRadius: 3,
            background: darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)',
          }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 20px 14px',
          flexShrink: 0,
        }}>
          <button
            onClick={handleClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              border: 'none',
              background: surfaceBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: textPrimary,
              flexShrink: 0,
              transition: 'all 0.15s',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18"/><path d="M6 6l12 12"/>
            </svg>
          </button>
          <span style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: -0.4,
            color: textPrimary,
          }}>Preferences</span>
          <div style={{ width: 32, flexShrink: 0 }} />
        </div>

        {/* Scrollable body */}
        <div ref={bodyRef} style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '0 20px 140px',
        }}>

          {/* === HOME COUNTRY === */}
          <div style={{ marginTop: 8 }}>
            <div style={{
              fontSize: 12,
              fontWeight: 600,
              color: textSecondary,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              marginBottom: 10,
              paddingLeft: 2,
            }}>Home Country</div>
            <div
              onClick={() => setShowHomePicker(p => !p)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                background: surfaceBg,
                borderRadius: 16,
                cursor: 'pointer',
                border: `1px solid ${surfaceBorder}`,
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                boxShadow: GLASS_SHADOW,
                transition: 'all 0.2s',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{ fontSize: 24, lineHeight: 1 }}>{home?.flag || '?'}</span>
              <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: textPrimary }}>{home?.name || 'Select country'}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={textSecondary} strokeWidth="2" strokeLinecap="round" style={{ transform: showHomePicker ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)' }}>
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </div>
            {showHomePicker && (
              <PickerGrid
                groups={COUNTRY_GROUPS}
                type="country"
                selected={homeCountry ? [homeCountry] : []}
                onSelect={(code) => changeHome(code)}
                darkMode={darkMode}
                tileBg={tileBg}
                tileSelectedBg={tileSelectedBg}
                pickerBg={pickerBg}
                surfaceBorder={surfaceBorder}
                textSecondary={textSecondary}
                accentColor={accentColor}
              />
            )}
          </div>

          {/* === FOLLOWING COUNTRIES === */}
          <div style={{ marginTop: 28 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
              paddingLeft: 2,
              paddingRight: 2,
            }}>
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: textSecondary,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
              }}>Following Countries</span>
              <span style={{
                fontSize: 11,
                fontWeight: 500,
                color: textTertiary,
              }}>{followCountries.length}/5</span>
            </div>

            {followCountries.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {followCountries.map(code => {
                  const c = ALL_COUNTRIES.find(x => x.code === code);
                  if (!c) return null;
                  return (
                    <div key={c.code} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 12px',
                      background: surfaceBg,
                      borderRadius: 14,
                      border: `1px solid ${surfaceBorder}`,
                      backdropFilter: 'blur(16px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                      boxShadow: GLASS_SHADOW,
                    }}>
                      <span style={{ fontSize: 18 }}>{c.flag}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>{c.name}</span>
                      <button
                        onClick={() => removeFollow(c.code)}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          border: 'none',
                          background: removeBtnBg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: textSecondary,
                          transition: 'all 0.15s',
                          marginLeft: 2,
                          padding: 0,
                          WebkitTapHighlightColor: 'transparent',
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                          <path d="M18 6L6 18"/><path d="M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{
                padding: '16px',
                textAlign: 'center',
                fontSize: 13,
                color: textTertiary,
                background: surfaceBg,
                borderRadius: 14,
                marginBottom: 10,
                border: `1px solid ${surfaceBorder}`,
              }}>No countries followed</div>
            )}

            <button
              onClick={() => setShowFollowPicker(p => !p)}
              disabled={followCountries.length >= 5}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '12px 16px',
                background: 'transparent',
                border: `1.5px dashed ${darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                borderRadius: 14,
                cursor: followCountries.length >= 5 ? 'default' : 'pointer',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 600,
                color: followCountries.length >= 5 ? textTertiary : textSecondary,
                width: '100%',
                opacity: followCountries.length >= 5 ? 0.4 : 1,
                transition: 'all 0.2s',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14"/><path d="M5 12h14"/>
              </svg>
              {showFollowPicker ? 'Done' : 'Add Country'}
            </button>

            {showFollowPicker && (
              <PickerGrid
                groups={COUNTRY_GROUPS}
                type="country"
                selected={followCountries}
                disabledCodes={homeCountry ? [homeCountry] : []}
                maxSelected={5}
                onSelect={toggleFollow}
                darkMode={darkMode}
                tileBg={tileBg}
                tileSelectedBg={tileSelectedBg}
                pickerBg={pickerBg}
                surfaceBorder={surfaceBorder}
                textSecondary={textSecondary}
                accentColor={accentColor}
              />
            )}
          </div>

          {/* === TOPICS === */}
          <div style={{ marginTop: 28 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
              paddingLeft: 2,
              paddingRight: 2,
            }}>
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: textSecondary,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
              }}>Topics</span>
              <span style={{
                fontSize: 11,
                fontWeight: 500,
                color: textTertiary,
              }}>{selectedTopics.length}/10 {selectedTopics.length <= 3 && '(min 3)'}</span>
            </div>

            {selectedTopics.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {selectedTopics.map(id => {
                  const t = ALL_TOPICS.find(x => x.id === id);
                  if (!t) return null;
                  return (
                    <div key={t.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 12px',
                      background: surfaceBg,
                      borderRadius: 14,
                      border: `1px solid ${surfaceBorder}`,
                      backdropFilter: 'blur(16px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                      boxShadow: GLASS_SHADOW,
                    }}>
                      <span style={{ fontSize: 16 }}>{t.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>{t.name}</span>
                      <button
                        onClick={() => removeTopic(t.id)}
                        disabled={selectedTopics.length <= 3}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          border: 'none',
                          background: removeBtnBg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: selectedTopics.length <= 3 ? 'default' : 'pointer',
                          color: textSecondary,
                          transition: 'all 0.15s',
                          marginLeft: 2,
                          padding: 0,
                          opacity: selectedTopics.length <= 3 ? 0.25 : 1,
                          WebkitTapHighlightColor: 'transparent',
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                          <path d="M18 6L6 18"/><path d="M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}

            <button
              onClick={() => setShowTopicPicker(p => !p)}
              disabled={selectedTopics.length >= 10}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '12px 16px',
                background: 'transparent',
                border: `1.5px dashed ${darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                borderRadius: 14,
                cursor: selectedTopics.length >= 10 ? 'default' : 'pointer',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 600,
                color: selectedTopics.length >= 10 ? textTertiary : textSecondary,
                width: '100%',
                opacity: selectedTopics.length >= 10 ? 0.4 : 1,
                transition: 'all 0.2s',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14"/><path d="M5 12h14"/>
              </svg>
              {showTopicPicker ? 'Done' : 'Add Topic'}
            </button>

            {showTopicPicker && (
              <div style={{
                marginTop: 10,
                padding: 16,
                background: pickerBg,
                borderRadius: 18,
                border: `1px solid ${surfaceBorder}`,
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                animation: 'prefPickerIn 0.3s cubic-bezier(0.22,1,0.36,1)',
              }}>
                {TOPIC_CATEGORIES.map(cat => (
                  <div key={cat.name}>
                    <div style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: textTertiary,
                      textTransform: 'uppercase',
                      letterSpacing: 0.8,
                      margin: '14px 0 8px',
                    }}>{cat.name}</div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 8,
                    }}>
                      {cat.topics.map(t => {
                        const isSel = selectedTopics.includes(t.id);
                        const atMax = !isSel && selectedTopics.length >= 10;
                        return (
                          <div
                            key={t.id}
                            onClick={() => !atMax && toggleTopic(t.id)}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 4,
                              padding: '12px 4px',
                              borderRadius: 14,
                              background: isSel ? tileSelectedBg : tileBg,
                              border: `1.5px solid ${isSel ? accentColor : 'transparent'}`,
                              cursor: atMax ? 'default' : 'pointer',
                              transition: 'all 0.2s cubic-bezier(0.22,1,0.36,1)',
                              position: 'relative',
                              minHeight: 64,
                              opacity: atMax ? 0.35 : 1,
                              WebkitTapHighlightColor: 'transparent',
                              boxShadow: isSel ? `0 0 0 3px ${darkMode ? 'rgba(0,122,255,0.15)' : 'rgba(0,122,255,0.08)'}` : 'none',
                            }}
                          >
                            {isSel && (
                              <div style={{
                                position: 'absolute',
                                top: 4,
                                right: 4,
                                width: 16,
                                height: 16,
                                borderRadius: 8,
                                background: accentColor,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}>
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M5 12l5 5L19 7"/>
                                </svg>
                              </div>
                            )}
                            <span style={{ fontSize: 20, lineHeight: 1 }}>{t.icon}</span>
                            <span style={{
                              fontSize: 10,
                              fontWeight: 600,
                              color: isSel ? accentColor : (darkMode ? 'rgba(255,255,255,0.7)' : '#48484a'),
                              textAlign: 'center',
                              lineHeight: 1.2,
                            }}>{t.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          padding: '0 20px',
          background: bg,
        }}>
          <div style={{
            position: 'absolute',
            top: -28,
            left: 0,
            right: 0,
            height: 28,
            background: `linear-gradient(transparent, ${bg})`,
            pointerEvents: 'none',
          }} />
          <div style={{
            maxWidth: 440,
            margin: '0 auto',
            padding: '10px 0 calc(16px + env(safe-area-inset-bottom, 0px))',
          }}>
            {dirty && (
              <div style={{
                fontSize: 12,
                color: accentColor,
                textAlign: 'center',
                marginBottom: 8,
                fontWeight: 600,
                animation: 'prefFadeIn 0.3s ease',
              }}>Unsaved changes</div>
            )}
            {saveSuccess && !dirty && (
              <div style={{
                fontSize: 12,
                color: '#34C759',
                textAlign: 'center',
                marginBottom: 8,
                fontWeight: 600,
                animation: 'prefFadeIn 0.3s ease',
              }}>Preferences saved</div>
            )}
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              style={{
                width: '100%',
                padding: 16,
                borderRadius: 14,
                border: 'none',
                fontFamily: 'inherit',
                fontSize: 16,
                fontWeight: 700,
                cursor: dirty ? 'pointer' : 'default',
                transition: 'all 0.2s',
                letterSpacing: -0.2,
                WebkitTapHighlightColor: 'transparent',
                background: dirty ? (darkMode ? '#ffffff' : '#1d1d1f') : (darkMode ? 'rgba(255,255,255,0.08)' : '#e5e5e5'),
                color: dirty ? (darkMode ? '#000000' : '#ffffff') : textTertiary,
                transform: 'scale(1)',
                boxShadow: dirty ? GLASS_SHADOW : 'none',
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes prefPickerIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes prefFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}


// ============================================
// PICKER GRID SUB-COMPONENT
// ============================================
function PickerGrid({ groups, type, selected, disabledCodes = [], maxSelected, onSelect, darkMode, tileBg, tileSelectedBg, pickerBg, surfaceBorder, textSecondary, accentColor }) {
  const textTertiary = darkMode ? 'rgba(255,255,255,0.3)' : '#c7c7cc';

  return (
    <div style={{
      marginTop: 10,
      padding: 16,
      background: pickerBg,
      borderRadius: 18,
      border: `1px solid ${surfaceBorder}`,
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      animation: 'prefPickerIn 0.3s cubic-bezier(0.22,1,0.36,1)',
    }}>
      {groups.map(g => (
        <div key={g.continent}>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            color: textTertiary,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            margin: '14px 0 8px',
          }}>{g.continent}</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
          }}>
            {g.countries.map(c => {
              const isSel = selected.includes(c.code);
              const isDisabled = disabledCodes.includes(c.code);
              const atMax = maxSelected && !isSel && selected.length >= maxSelected;
              return (
                <div
                  key={c.code}
                  onClick={() => !isDisabled && !atMax && onSelect(c.code)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    padding: '12px 4px',
                    borderRadius: 14,
                    background: isSel ? tileSelectedBg : tileBg,
                    border: `1.5px solid ${isSel ? accentColor : 'transparent'}`,
                    cursor: isDisabled || atMax ? 'default' : 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.22,1,0.36,1)',
                    position: 'relative',
                    minHeight: 68,
                    opacity: isDisabled ? 0.25 : atMax ? 0.35 : 1,
                    WebkitTapHighlightColor: 'transparent',
                    boxShadow: isSel ? `0 0 0 3px ${darkMode ? 'rgba(0,122,255,0.15)' : 'rgba(0,122,255,0.08)'}` : 'none',
                  }}
                >
                  {isSel && (
                    <div style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      background: accentColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12l5 5L19 7"/>
                      </svg>
                    </div>
                  )}
                  <span style={{ fontSize: 24, lineHeight: 1 }}>{c.flag}</span>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: isSel ? accentColor : (darkMode ? 'rgba(255,255,255,0.7)' : '#48484a'),
                    textAlign: 'center',
                    lineHeight: 1.2,
                  }}>{c.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
