import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { 
  COUNTRIES, TOPICS, PERSONALIZATION_CONFIG,
  getCountriesByRegion, getTopicsByCategory,
  COUNTRY_REGIONS, TOPIC_CATEGORIES 
} from '../lib/personalization';

export default function SettingsPage() {
  const router = useRouter();
  const [homeCountry, setHomeCountry] = useState('');
  const [followedCountries, setFollowedCountries] = useState([]);
  const [followedTopics, setFollowedTopics] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [userId, setUserId] = useState(null);
  const [editingSection, setEditingSection] = useState(null); // 'home', 'countries', 'topics'

  const countriesByRegion = getCountriesByRegion();
  const topicsByCategory = getTopicsByCategory();

  // Load preferences on mount
  useEffect(() => {
    const prefs = localStorage.getItem('todayplus_preferences');
    if (prefs) {
      try {
        const parsed = JSON.parse(prefs);
        setHomeCountry(parsed.home_country || '');
        setFollowedCountries(parsed.followed_countries || []);
        setFollowedTopics(parsed.followed_topics || []);
        setUserId(parsed.user_id || null);
      } catch (e) {
        console.error('Error loading preferences:', e);
      }
    }
  }, []);

  const toggleFollowedCountry = (code) => {
    if (code === homeCountry) return;
    setFollowedCountries(prev => {
      if (prev.includes(code)) return prev.filter(c => c !== code);
      if (prev.length >= PERSONALIZATION_CONFIG.MAX_FOLLOWED_COUNTRIES) return prev;
      return [...prev, code];
    });
  };

  const toggleTopic = (code) => {
    setFollowedTopics(prev => {
      if (prev.includes(code)) return prev.filter(t => t !== code);
      if (prev.length >= PERSONALIZATION_CONFIG.MAX_TOPICS_ALLOWED) return prev;
      return [...prev, code];
    });
  };

  const handleSave = async () => {
    if (followedTopics.length < PERSONALIZATION_CONFIG.MIN_TOPICS_REQUIRED) {
      alert(`Please select at least ${PERSONALIZATION_CONFIG.MIN_TOPICS_REQUIRED} topics`);
      return;
    }

    setSaving(true);
    setSaved(false);

    const preferences = {
      home_country: homeCountry,
      followed_countries: followedCountries,
      followed_topics: followedTopics,
      onboarding_completed: true,
      user_id: userId,
      updated_at: new Date().toISOString(),
    };

    // Try to save to API
    if (userId) {
      try {
        await fetch('/api/user/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            home_country: homeCountry,
            followed_countries: followedCountries,
            followed_topics: followedTopics,
          }),
        });
      } catch (e) {
        console.warn('API save failed:', e);
      }
    }

    // Always save to localStorage
    localStorage.setItem('todayplus_preferences', JSON.stringify(preferences));

    setSaving(false);
    setSaved(true);
    setEditingSection(null);
    setTimeout(() => setSaved(false), 2000);
  };

  const homeCountryData = COUNTRIES.find(c => c.code === homeCountry);

  return (
    <>
      <Head>
        <title>Settings - TodayPlus</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <button style={styles.backBtn} onClick={() => router.push('/')}>
            ← Back
          </button>
          <h1 style={styles.headerTitle}>Preferences</h1>
          <div style={{width: 60}} />
        </div>

        {/* Home Country Section */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>HOME COUNTRY</h2>
            <button 
              style={styles.editBtn}
              onClick={() => setEditingSection(editingSection === 'home' ? null : 'home')}
            >
              {editingSection === 'home' ? 'Done' : 'Edit'}
            </button>
          </div>
          
          {editingSection === 'home' ? (
            <div style={styles.chipGrid}>
              {COUNTRIES.map(country => (
                <button
                  key={country.code}
                  style={{
                    ...styles.chip,
                    ...(homeCountry === country.code ? styles.chipSelected : {}),
                  }}
                  onClick={() => {
                    setHomeCountry(country.code);
                    // Remove from followed if selected as home
                    setFollowedCountries(prev => prev.filter(c => c !== country.code));
                  }}
                >
                  <span style={{fontSize: '18px'}}>{country.flag}</span>
                  <span>{country.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div style={styles.valueDisplay}>
              {homeCountryData ? (
                <span>{homeCountryData.flag} {homeCountryData.name}</span>
              ) : (
                <span style={{color: '#86868b'}}>Not set</span>
              )}
            </div>
          )}
        </div>

        {/* Followed Countries Section */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>
              FOLLOWING COUNTRIES
              <span style={styles.countBadge}>{followedCountries.length}/{PERSONALIZATION_CONFIG.MAX_FOLLOWED_COUNTRIES}</span>
            </h2>
            <button 
              style={styles.editBtn}
              onClick={() => setEditingSection(editingSection === 'countries' ? null : 'countries')}
            >
              {editingSection === 'countries' ? 'Done' : 'Edit'}
            </button>
          </div>
          
          {editingSection === 'countries' ? (
            <div style={styles.chipGrid}>
              {COUNTRIES.filter(c => c.code !== homeCountry).map(country => {
                const isSelected = followedCountries.includes(country.code);
                return (
                  <button
                    key={country.code}
                    style={{
                      ...styles.chip,
                      ...(isSelected ? styles.chipSelected : {}),
                    }}
                    onClick={() => toggleFollowedCountry(country.code)}
                  >
                    <span style={{fontSize: '18px'}}>{country.flag}</span>
                    <span>{country.name}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={styles.valueDisplay}>
              {followedCountries.length > 0 ? (
                <div style={styles.tagList}>
                  {followedCountries.map(code => {
                    const c = COUNTRIES.find(c => c.code === code);
                    return c ? (
                      <span key={code} style={styles.tag}>{c.flag} {c.name}</span>
                    ) : null;
                  })}
                </div>
              ) : (
                <span style={{color: '#86868b'}}>None selected</span>
              )}
            </div>
          )}
        </div>

        {/* Topics Section */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>
              TOPICS
              <span style={styles.countBadge}>{followedTopics.length}</span>
            </h2>
            <button 
              style={styles.editBtn}
              onClick={() => setEditingSection(editingSection === 'topics' ? null : 'topics')}
            >
              {editingSection === 'topics' ? 'Done' : 'Edit'}
            </button>
          </div>
          
          {editingSection === 'topics' ? (
            Object.entries(topicsByCategory).map(([category, topics]) => (
              <div key={category} style={{marginBottom: '16px'}}>
                <p style={styles.categoryLabel}>{TOPIC_CATEGORIES[category]}</p>
                <div style={styles.chipGrid}>
                  {topics.map(topic => {
                    const isSelected = followedTopics.includes(topic.code);
                    return (
                      <button
                        key={topic.code}
                        style={{
                          ...styles.chip,
                          ...(isSelected ? styles.chipSelected : {}),
                        }}
                        onClick={() => toggleTopic(topic.code)}
                      >
                        <span style={{fontSize: '16px'}}>{topic.icon}</span>
                        <span>{topic.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div style={styles.valueDisplay}>
              {followedTopics.length > 0 ? (
                <div style={styles.tagList}>
                  {followedTopics.map(code => {
                    const t = TOPICS.find(t => t.code === code);
                    return t ? (
                      <span key={code} style={styles.tag}>{t.icon} {t.name}</span>
                    ) : null;
                  })}
                </div>
              ) : (
                <span style={{color: '#86868b'}}>None selected</span>
              )}
            </div>
          )}
        </div>

        {/* Save Button */}
        <div style={styles.saveContainer}>
          <button 
            style={{
              ...styles.saveButton,
              ...(saved ? styles.savedButton : {}),
            }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>

        {/* Reset option */}
        <div style={styles.resetContainer}>
          <button 
            style={styles.resetButton}
            onClick={() => {
              if (confirm('This will clear all your preferences. Continue?')) {
                localStorage.removeItem('todayplus_preferences');
                router.push('/onboarding');
              }
            }}
          >
            Reset Preferences
          </button>
        </div>
      </div>
    </>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#f5f5f7',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
    paddingBottom: '40px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    background: 'rgba(245,245,247,0.9)',
    backdropFilter: 'blur(20px)',
    borderBottom: '1px solid #e5e5ea',
    position: 'sticky',
    top: 0,
    zIndex: 50,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    fontSize: '17px',
    color: '#007AFF',
    cursor: 'pointer',
    fontWeight: '500',
    padding: '8px 0',
  },
  headerTitle: {
    fontSize: '17px',
    fontWeight: '600',
    color: '#1d1d1f',
    margin: 0,
  },
  section: {
    background: 'white',
    margin: '16px',
    borderRadius: '16px',
    padding: '16px 20px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#86868b',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  countBadge: {
    fontSize: '12px',
    background: '#f2f2f7',
    padding: '2px 8px',
    borderRadius: '10px',
    color: '#86868b',
    fontWeight: '500',
  },
  editBtn: {
    background: 'none',
    border: 'none',
    color: '#007AFF',
    fontSize: '15px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  valueDisplay: {
    fontSize: '17px',
    color: '#1d1d1f',
    padding: '4px 0',
  },
  chipGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  chip: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    borderRadius: '18px',
    border: '1.5px solid #e5e5ea',
    background: 'white',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.15s ease',
    color: '#1d1d1f',
  },
  chipSelected: {
    border: '1.5px solid #007AFF',
    background: '#EBF3FE',
    color: '#007AFF',
    fontWeight: '600',
  },
  categoryLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#aeaeb2',
    marginBottom: '8px',
    marginTop: '4px',
  },
  tagList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    borderRadius: '14px',
    background: '#f2f2f7',
    fontSize: '14px',
    color: '#1d1d1f',
  },
  saveContainer: {
    padding: '16px 20px',
  },
  saveButton: {
    width: '100%',
    padding: '16px',
    fontSize: '17px',
    fontWeight: '600',
    background: '#007AFF',
    color: 'white',
    border: 'none',
    borderRadius: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  savedButton: {
    background: '#34C759',
  },
  resetContainer: {
    padding: '0 20px',
    textAlign: 'center',
  },
  resetButton: {
    background: 'none',
    border: 'none',
    color: '#FF3B30',
    fontSize: '15px',
    cursor: 'pointer',
    padding: '12px',
  },
};
