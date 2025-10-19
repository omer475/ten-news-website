# 📱 NEWS PAGE - COMPLETE DESIGN CODE
## Full Next.js/React Implementation with Embedded CSS

**File:** `pages/index.js`  
**Total Lines:** 2,303 lines  
**Framework:** Next.js with React Hooks  
**Styling:** Embedded CSS-in-JS  
**Features:** Full-page story carousel, authentication, paywall, timeline/details toggle

---

## 📋 TABLE OF CONTENTS

1. [Key Features](#key-features)
2. [Component Structure](#component-structure)
3. [Design System](#design-system)
4. [Complete Source Code](#complete-source-code)
5. [CSS Breakdown](#css-breakdown)
6. [Responsive Design](#responsive-design)
7. [Interactive Features](#interactive-features)

---

## 🎯 KEY FEATURES

### Navigation
- **Full-page story carousel** - One story per screen
- **Swipe/scroll navigation** - Up/down to navigate stories
- **Keyboard support** - Arrow keys for navigation
- **Progress indicator** - Dots on right side showing position

### Story Display
- **Edge-to-edge images** - 30vh hero image (or emoji fallback)
- **Large typography** - 48px title, 17px summary
- **Glassmorphism cards** - Frosted glass effect for details/timeline
- **Toggle system** - Swipe horizontally to switch between details/timeline

### Authentication
- **Paywall at story 6** - Free users see first 5 stories
- **Modal login/signup** - Beautiful auth forms
- **Session persistence** - LocalStorage for stay logged in
- **Email verification** - Confirmation flow

### Time-Based Design
- **Dynamic greetings** - "Good morning/evening/night" based on time
- **Color gradients** - Different colors for morning/afternoon/evening
- **Auto-updating time** - Live clock in header

---

## 🏗️ COMPONENT STRUCTURE

```
Home Component
├── State Management
│   ├── stories (news data)
│   ├── currentIndex (current story)
│   ├── menuOpen, showTimeline, darkMode
│   └── Authentication (user, authModal, formData)
│
├── Data Loading
│   ├── API fetch (/api/news)
│   ├── Direct file fetch (tennews_data_*.json)
│   └── Fallback stories
│
├── Navigation System
│   ├── Touch events (swipe up/down)
│   ├── Wheel events (scroll)
│   ├── Keyboard events (arrow keys)
│   └── Paywall blocking
│
└── Render Structure
    ├── Header (logo, time, auth buttons)
    ├── Story Carousel (multiple story containers)
    │   ├── Opening Page (NewFirstPage component)
    │   └── News Stories
    │       ├── Hero Image (30vh fixed)
    │       ├── Title (48px)
    │       ├── Summary (17px with bold markup)
    │       └── Fixed Bottom Section
    │           ├── Details/Timeline Card (glassmorphism)
    │           └── Toggle Dots
    ├── Paywall Modal (stories 6+)
    ├── Auth Modal (login/signup)
    └── Email Confirmation Modal

Sub-Components
├── LoginForm
├── SignupForm
└── EmailConfirmation
```

---

## 🎨 DESIGN SYSTEM

### Colors

**Light Mode:**
- Background: `#ffffff`
- Text: `#000000` (titles), `#4a4a4a` (body)
- Accents: `#dc2626` (red), `#3b82f6` (blue)

**Dark Mode:**
- Background: `#000000`
- Text: `#ffffff` (titles), `#d1d5db` (body)
- Accents: Same as light mode

**Time-Based Gradients:**
```css
/* Morning (5am-12pm) */
Greeting: linear-gradient(90deg, #f97316, #fbbf24) /* Orange → Yellow */
Headline: linear-gradient(90deg, #7c3aed, #ec4899) /* Purple → Pink */

/* Afternoon (12pm-6pm) */
Greeting: linear-gradient(90deg, #3b82f6, #06b6d4) /* Blue → Cyan */
Headline: linear-gradient(90deg, #dc2626, #f97316) /* Red → Orange */

/* Evening/Night (6pm-5am) */
Greeting: linear-gradient(90deg, #4f46e5, #7c3aed) /* Indigo → Purple */
Headline: linear-gradient(90deg, #f59e0b, #f87171) /* Gold → Coral */
```

### Typography

**Font Stack:**
```css
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
```

**Sizes (Desktop):**
- Opening Headline: `60px`, weight `900`, line-height `1.12`
- News Title: `48px`, weight `800`, line-height `1.2`
- Summary: `17px`, weight `400`, line-height `1.6`
- Detail Label: `10px`, weight `600`, uppercase, letter-spacing `1px`
- Detail Value: `20px`, weight `800`
- Timeline Date: `11px`, weight `600`
- Timeline Event: `14px`, line-height `1.4`

**Sizes (Mobile):**
- Opening Headline: `38px`
- News Title: `30px`
- Detail Label: `9px`
- Detail Value: `16px`

### Glassmorphism

**Details Card:**
```css
background: rgba(255, 255, 255, 0.15);
backdrop-filter: blur(20px);
-webkit-backdrop-filter: blur(20px);
border: 1px solid rgba(255, 255, 255, 0.2);
border-radius: 16px;
box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
```

**Timeline Card (when toggled):**
```css
background: rgba(255, 255, 255, 0.75);
backdrop-filter: blur(10px);
-webkit-backdrop-filter: blur(10px);
border: 1px solid rgba(255, 255, 255, 0.3);
border-radius: 16px;
```

### Layout

**Story Container:**
- Full viewport height/width
- Fixed positioning
- Transform-based transitions
- Z-index stacking for carousel effect

**Content Max-Width:**
- Desktop: `1000px` (stories), `800px` (opening)
- Details Card: `950px`
- Mobile: `100%`

**Spacing:**
- Container padding: `0 24px 40px` (desktop), `0 0 40px` (mobile)
- Details card padding: `12px 20px`
- Element gaps: `16px`, `20px`, `24px`

---

## 📄 COMPLETE SOURCE CODE

### Main Component (pages/index.js)

```jsx
import { useEffect, useState } from 'react';
import { createClient } from '../lib/supabase';
import NewFirstPage from '../components/NewFirstPage';

export default function Home() {
  // ==================== STATE MANAGEMENT ====================
  const [stories, setStories] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTimeline, setShowTimeline] = useState({});
  const [darkMode, setDarkMode] = useState(false);

  // Authentication state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authModal, setAuthModal] = useState(null); // 'login', 'signup', or null
  const [authError, setAuthError] = useState('');
  const [emailConfirmation, setEmailConfirmation] = useState(null);

  // Form data persistence
  const [formData, setFormData] = useState({
    loginEmail: '',
    loginPassword: '',
    signupEmail: '',
    signupPassword: '',
    signupFullName: ''
  });
  const [supabase] = useState(() => createClient());

  // ==================== DATA LOADING ====================
  useEffect(() => {
    const loadNewsData = async () => {
      try {
        let newsData = null;
        
        // Try API endpoint first
        try {
          const response = await fetch('/api/news');
          if (response.ok) {
            newsData = await response.json();
            console.log('✅ Loaded news from API');
          }
        } catch (error) {
          console.log('📰 API not available, using fallback');
        }
        
        // Fallback: Direct file access
        if (!newsData) {
          try {
            const today = new Date();
            const dateStr = `${today.getFullYear()}_${(today.getMonth() + 1).toString().padStart(2, '0')}_${today.getDate().toString().padStart(2, '0')}`;
            const response = await fetch(`/tennews_data_${dateStr}.json`);
            if (response.ok) {
              newsData = await response.json();
              console.log('✅ Loaded news from direct file');
            }
          } catch (error) {
            console.log('📰 Direct file access failed:', error);
          }
        }
        
        let processedStories = [];
        
        if (newsData && newsData.articles && newsData.articles.length > 0) {
          // Create opening story
          const openingStory = {
            type: 'opening',
            date: newsData.displayDate || new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long', 
              day: 'numeric',
              year: 'numeric'
            }).toUpperCase(),
            headline: newsData.dailyGreeting || 'Today Essential Global News'
          };
          
          processedStories.push(openingStory);
          
          // Convert articles to story format
          newsData.articles.forEach((article, index) => {
            const imageUrl = article.urlToImage || article.image || null;
            
            const storyData = {
              type: 'news',
              number: article.rank || (index + 1),
              category: (article.category || 'WORLD NEWS').toUpperCase(),
              emoji: article.emoji || '📰',
              title: article.title || 'News Story',
              summary: article.rewritten_text || article.summary || 'News summary will appear here.',
              details: article.details || [],
              source: article.source || 'Today+',
              url: article.url || '#',
              urlToImage: imageUrl
            };
            
            // Add timeline
            if (article.timeline) {
              storyData.timeline = article.timeline;
            } else {
              // Fallback timeline
              const timelineVariations = [
                [
                  {"date": "Background", "event": "Initial situation develops"},
                  {"date": "Today", "event": "Major developments break"},
                  {"date": "Next week", "event": "Follow-up expected"}
                ],
                [
                  {"date": "Recently", "event": "Key events unfold"},
                  {"date": "Yesterday", "event": "Critical point reached"},
                  {"date": "Today", "event": "Story breaks"},
                  {"date": "Coming days", "event": "Developments continue"}
                ],
                [
                  {"date": "Last month", "event": "Initial reports emerge"},
                  {"date": "Today", "event": "Major announcement made"}
                ]
              ];
              storyData.timeline = timelineVariations[index % timelineVariations.length];
            }
            
            processedStories.push(storyData);
          });
        } else {
          // Fallback stories
          processedStories = [/* ... fallback data ... */];
        }
        
        setStories(processedStories);
        setLoading(false);
      } catch (error) {
        console.error('Error loading news:', error);
        setLoading(false);
      }
    };

    loadNewsData();
  }, []);

  // ==================== NAVIGATION FUNCTIONS ====================
  const goToStory = (index) => {
    if (index >= 0 && index < stories.length) {
      setCurrentIndex(index);
      setMenuOpen(false);
    }
  };

  const nextStory = () => goToStory(currentIndex + 1);
  const prevStory = () => goToStory(currentIndex - 1);

  const toggleTimeline = (storyIndex) => {
    setShowTimeline(prev => ({
      ...prev,
      [storyIndex]: !prev[storyIndex]
    }));
  };

  const toggleDarkMode = () => {
    setDarkMode(prev => !prev);
  };

  // ==================== TIME-BASED FUNCTIONS ====================
  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    return 'evening';
  };

  const getGreetingGradient = () => {
    const t = getTimeOfDay();
    if (t === 'morning') return 'linear-gradient(90deg, #f97316 0%, #fbbf24 100%)';
    if (t === 'afternoon') return 'linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)';
    return 'linear-gradient(90deg, #4f46e5 0%, #7c3aed 100%)';
  };

  const getHeadlineRestGradient = () => {
    const t = getTimeOfDay();
    if (t === 'morning') return 'linear-gradient(90deg, #7c3aed 0%, #ec4899 100%)';
    if (t === 'afternoon') return 'linear-gradient(90deg, #dc2626 0%, #f97316 100%)';
    return 'linear-gradient(90deg, #f59e0b 0%, #f87171 100%)';
  };

  const getGreetingText = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Goood morning';
    else if (hour >= 12 && hour < 18) return 'Goood evening';
    else return 'Goood night';
  };

  // ==================== TEXT RENDERING ====================
  const renderBoldText = (text, category) => {
    if (!text) return '';
    
    const getCategoryBoldStyle = (category) => {
      const styles = {
        'WORLD NEWS': { background: '#fee2e2', color: '#000000', padding: '2px 6px', borderRadius: '4px' },
        'BUSINESS': { background: '#fff7ed', color: '#000000', padding: '2px 6px', borderRadius: '4px' },
        'TECH & AI': { background: '#eef2ff', color: '#000000', padding: '2px 6px', borderRadius: '4px' },
        'SCIENCE': { background: '#e0f2fe', color: '#000000', padding: '2px 6px', borderRadius: '4px' },
        // ... more category styles
      };
      return styles[category] || { background: '#f8fafc', color: '#000000', padding: '2px 6px', borderRadius: '4px' };
    };
    
    return text.split(/(\*\*.*?\*\*)/).map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} style={getCategoryBoldStyle(category)}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const renderGreeting = (headline) => {
    const correctGreeting = getGreetingText();
    const gradient = getGreetingGradient();
    const restGradient = getHeadlineRestGradient();
    
    const greetingPatterns = ['good morning', 'good evening', 'good night', 'good afternoon'];
    const lowerHeadline = headline.toLowerCase();
    let foundGreeting = null;
    
    for (const pattern of greetingPatterns) {
      if (lowerHeadline.startsWith(pattern)) {
        foundGreeting = pattern;
        break;
      }
    }
    
    if (foundGreeting) {
      const restOfText = headline.substring(foundGreeting.length);
      return (
        <>
          <span style={{ 
            background: gradient,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>{correctGreeting}</span>
          <span style={{ color: darkMode ? '#ffffff' : '#0f172a' }}>{restOfText}</span>
        </>
      );
    }
    return headline;
  };

  // ==================== EVENT HANDLERS ====================
  useEffect(() => {
    let startY = 0;
    let isTransitioning = false;

    const handleTouchStart = (e) => {
      if (!isTransitioning) {
        startY = e.touches[0].clientY;
      }
    };

    const handleTouchEnd = (e) => {
      if (isTransitioning) return;
      
      const endY = e.changedTouches[0].clientY;
      const diff = startY - endY;
      
      if (Math.abs(diff) > 30) {
        isTransitioning = true;

        const isPaywallActive = !user && currentIndex >= 5;
        const isForwardNavigation = diff > 0;

        if (isPaywallActive && isForwardNavigation) {
          isTransitioning = false;
          return;
        }

        if (diff > 0) nextStory();
        else prevStory();
        
        setTimeout(() => {
          isTransitioning = false;
        }, 500);
      }
    };

    const handleWheel = (e) => {
      if (isTransitioning) return;
      
      if (Math.abs(e.deltaY) > 30) {
        const isPaywallActive = !user && currentIndex >= 5;
        const isForwardNavigation = e.deltaY > 0;

        if (isPaywallActive && isForwardNavigation) return;

        e.preventDefault();
        isTransitioning = true;
        if (e.deltaY > 0) nextStory();
        else prevStory();
        
        setTimeout(() => {
          isTransitioning = false;
        }, 500);
      }
    };

    const handleKeyDown = (e) => {
      if (isTransitioning) return;

      const isPaywallActive = !user && currentIndex >= 5;
      
      if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'ArrowRight') {
        if (isPaywallActive) return;
        e.preventDefault();
        isTransitioning = true;
        nextStory();
        setTimeout(() => { isTransitioning = false; }, 500);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        isTransitioning = true;
        prevStory();
        setTimeout(() => { isTransitioning = false; }, 500);
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('wheel', handleWheel);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentIndex, stories.length, user]);

  // ... (Auth functions, loading state, render JSX)
  // See full code in pages/index.js
}
```

---

## 🎨 CSS BREAKDOWN

### Global Styles

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  -webkit-font-smoothing: antialiased;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
  background: ${darkMode ? '#000000' : '#ffffff'};
  color: ${darkMode ? '#ffffff' : '#1d1d1f'};
  overflow: hidden;
  position: fixed;
  width: 100%;
  height: 100%;
  touch-action: none;
  transition: background-color 0.3s ease, color 0.3s ease;
}
```

### Header

```css
.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: ${darkMode ? 'rgba(0,0,0,0.97)' : 'rgba(255,255,255,0.97)'};
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(148, 163, 184, 0.1)'};
}

.logo {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.5px;
  cursor: pointer;
}
```

### Story Container

```css
.story-container {
  position: absolute;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 0 24px 40px;
  background: ${darkMode ? '#000000' : '#fff'};
  transition: all 0.5s cubic-bezier(0.4, 0.0, 0.2, 1);
  overflow-y: auto;
}

.story-content {
  max-width: 1000px;
  width: 100%;
  margin: 0 auto;
}
```

### Opening Page

```css
.opening-container {
  text-align: center;
  max-width: 800px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: calc(100vh - 140px);
}

.main-headline {
  font-size: 60px;
  font-weight: 900;
  line-height: 1.12;
  letter-spacing: -1px;
  margin-bottom: 40px;
  color: ${darkMode ? '#ffffff' : '#0f172a'};
}

.date-header {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 2px;
  color: #dc2626;
  text-transform: uppercase;
  margin-bottom: 40px;
}
```

### News Item

```css
.news-item {
  display: block;
  padding: 0 15px 24px 15px;
  border-bottom: 1px solid #e5e5e7;
  cursor: pointer;
  transition: all 0.2s;
  border-radius: 8px;
  position: relative;
  margin: 0 auto;
  max-width: 950px;
}

.news-item:hover {
  background: linear-gradient(to right, rgba(59, 130, 246, 0.03), transparent);
}

.news-title {
  font-size: 48px;
  font-weight: 800;
  line-height: 1.2;
  margin-bottom: 20px;
  color: ${darkMode ? '#ffffff' : '#000000'};
}

.news-summary {
  font-size: 17px;
  color: ${darkMode ? '#d1d5db' : '#4a4a4a'};
  line-height: 1.6;
  margin-bottom: 16px;
  text-align: left;
}
```

### Details/Timeline Card (Glassmorphism)

```css
.news-meta {
  display: flex;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px;
  padding: 12px 20px;
  margin-top: 20px;
  gap: 0;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
}

.news-detail-item {
  flex: 1;
  text-align: center;
  padding: 0 15px;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 38px;
}

.news-detail-label {
  font-size: 10px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 600;
  margin-bottom: 1px;
}

.news-detail-value {
  font-size: 20px;
  font-weight: 800;
  color: ${darkMode ? '#f9fafb' : '#111827'};
  line-height: 1.2;
  margin: 0;
}

.news-detail-subtitle {
  font-size: 11px;
  color: #6b7280;
  font-weight: 500;
  margin-top: 0;
}
```

### Timeline

```css
.timeline {
  position: relative;
  padding-left: 20px;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 6px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  background: linear-gradient(180deg, #3b82f6, #e2e8f0);
}

.timeline-item {
  position: relative;
  margin-bottom: 20px;
  padding-left: 20px;
  opacity: 0;
  animation: timelineSlideIn 0.5s ease forwards;
}

.timeline-item::before {
  content: '';
  position: absolute;
  left: -14px;
  top: 6px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: white;
  border: 2px solid #3b82f6;
  z-index: 1;
}

.timeline-item:last-child::before {
  background: #3b82f6;
}

@keyframes timelineSlideIn {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

### Progress Indicator

```css
.progress-indicator {
  position: fixed;
  right: 24px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 100;
}

.progress-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #e2e8f0;
  cursor: pointer;
  transition: all 0.3s;
}

.progress-dot.active {
  width: 6px;
  height: 20px;
  border-radius: 3px;
  background: linear-gradient(180deg, #1f2937, #000000);
}
```

### Authentication Modals

```css
.auth-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(4px);
}

.auth-modal {
  background: ${darkMode ? '#1f2937' : '#ffffff'};
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 400px;
  max-height: 90vh;
  overflow-y: auto;
}

.auth-submit {
  padding: 14px 24px;
  background: linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 8px;
}

.auth-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
}
```

### Paywall

```css
.paywall-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(5px);
  pointer-events: auto;
}

.paywall-modal {
  background: ${darkMode ? '#1f2937' : '#ffffff'};
  border-radius: 16px;
  padding: 32px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  border: 1px solid ${darkMode ? '#374151' : '#e5e7eb'};
}
```

---

## 📱 RESPONSIVE DESIGN

### Mobile Breakpoint (@media max-width: 768px)

**Typography Adjustments:**
```css
.main-headline {
  font-size: 38px; /* Down from 60px */
  margin-bottom: 30px;
}

.news-title {
  font-size: 30px; /* Down from 48px */
}

.date-header {
  font-size: 11px; /* Down from 12px */
}
```

**Layout Adjustments:**
```css
.story-container {
  padding: 0 0 40px; /* Remove side padding */
}

.news-item {
  padding: 0 10px 20px 10px;
  max-width: 100%;
}

.news-content {
  margin: 0 8px;
  padding-right: 20px;
}
```

**Details Card:**
```css
.news-meta {
  padding: 10px 15px; /* Smaller padding */
}

.news-detail-item {
  padding: 0 10px; /* Less horizontal padding */
}

.news-detail-label {
  font-size: 9px; /* Down from 10px */
}

.news-detail-value {
  font-size: 16px; /* Down from 20px */
}

.news-detail-subtitle {
  font-size: 10px; /* Down from 11px */
}
```

**Progress Indicator:**
```css
.progress-indicator {
  right: 12px; /* Closer to edge */
  gap: 6px; /* Smaller gap */
}

.progress-dot {
  width: 5px; /* Down from 6px */
  height: 5px;
}

.progress-dot.active {
  width: 5px;
  height: 18px; /* Down from 20px */
}
```

---

## 🎮 INTERACTIVE FEATURES

### Story Navigation

**Touch Events:**
- Swipe up: Next story
- Swipe down: Previous story
- Minimum distance: 30px

**Wheel Events:**
- Scroll down: Next story
- Scroll up: Previous story
- Minimum deltaY: 30

**Keyboard Events:**
- ↓/Space/→: Next story
- ↑/←: Previous story

### Timeline Toggle

**Touch Events:**
- Tap on details card: Toggle
- Horizontal swipe on card: Toggle
- Vertical swipe: Pass through (for story navigation)

**Visual Feedback:**
- Dots at bottom indicate current view
- Smooth transition animation
- Background changes from transparent to frosted glass

### Paywall Behavior

**Blocking:**
- Stories 1-5: Free access
- Story 6+: Requires authentication
- Backward navigation: Always allowed
- Forward navigation: Blocked at paywall

**Visual Effects:**
- Content blur: `filter: blur(5px)`
- Pointer events: Disabled
- Overlay modal: Semi-transparent black with blur

---

## 🚀 PERFORMANCE OPTIMIZATIONS

### Loading Strategy
1. Try API endpoint (`/api/news`)
2. Fallback to direct file (`/tennews_data_*.json`)
3. Final fallback to hardcoded stories

### Session Persistence
- LocalStorage for auth state
- Prevents unnecessary API calls
- Instant authentication on reload

### Transition Performance
- CSS transforms (not position changes)
- Hardware-accelerated animations
- Debounced scroll/wheel events
- `cubic-bezier(0.4, 0.0, 0.2, 1)` for smooth easing

### Image Handling
- Graceful fallback to emoji
- Error handling with console logging
- Object-fit for proper sizing
- Loading detection

---

## 📊 CODE STATISTICS

- **Total Lines:** 2,303
- **React Components:** 4 (Home, LoginForm, SignupForm, EmailConfirmation)
- **CSS Rules:** ~150+
- **Event Handlers:** 8 (touch, wheel, keyboard, etc.)
- **State Variables:** 11
- **useEffect Hooks:** 4
- **Time-Based Functions:** 5
- **Auth Functions:** 4

---

## 🔗 DEPENDENCIES

```json
{
  "react": "latest",
  "next": "latest",
  "../lib/supabase": "createClient function",
  "../components/NewFirstPage": "Opening page component"
}
```

---

## 📝 NOTES

### Glassmorphism Implementation
The glassmorphism effect uses:
- Semi-transparent white backgrounds
- Backdrop blur filters (10-20px)
- Subtle borders with low opacity
- Soft box shadows for depth

### Bold Text Rendering
Summary text supports `**bold**` markdown:
- Split by regex pattern `/(\*\*.*?\*\*)/`
- Wrap in `<strong>` with category-colored backgrounds
- Different color for each category

### Time-Based Design
- Gradients change based on hour of day
- Greetings auto-update ("Good morning/evening/night")
- Opening page background adapts to time

### Mobile Considerations
- Touch-friendly sizes (minimum 44x44px)
- Larger tap targets
- Simplified navigation
- Reduced font sizes but maintained hierarchy

---

**This is the complete design system powering the Ten News website!** 🎉


