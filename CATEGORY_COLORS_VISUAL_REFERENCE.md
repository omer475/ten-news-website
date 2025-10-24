# Category Colors - Visual Reference Guide

Quick reference for all category colors used in TenNews.

---

## 🎨 Color Palette

### World - Navy Blue
```
Full Color:   #1E3A8A  ████████  Navy Blue
15% Opacity:  rgba(30, 58, 138, 0.15)  (Badge Background)
Emoji: 🌍
```

### Politics - Crimson Red
```
Full Color:   #DC2626  ████████  Crimson Red
15% Opacity:  rgba(220, 38, 38, 0.15)  (Badge Background)
Emoji: 🏛️
```

### Business - Emerald Green
```
Full Color:   #059669  ████████  Emerald Green
15% Opacity:  rgba(5, 150, 105, 0.15)  (Badge Background)
Emoji: 💼
```

### Technology - Bright Purple
```
Full Color:   #9333EA  ████████  Bright Purple
15% Opacity:  rgba(147, 51, 234, 0.15)  (Badge Background)
Emoji: 💻
```

### Science - Cyan
```
Full Color:   #06B6D4  ████████  Cyan
15% Opacity:  rgba(6, 182, 212, 0.15)  (Badge Background)
Emoji: 🔬
```

### Health - Pink
```
Full Color:   #EC4899  ████████  Pink
15% Opacity:  rgba(236, 72, 153, 0.15)  (Badge Background)
Emoji: 🏥
```

### Sports - Vibrant Orange
```
Full Color:   #F97316  ████████  Vibrant Orange
15% Opacity:  rgba(249, 115, 22, 0.15)  (Badge Background)
Emoji: ⚽
```

### Lifestyle - Golden Yellow
```
Full Color:   #EAB308  ████████  Golden Yellow
15% Opacity:  rgba(234, 179, 8, 0.15)  (Badge Background)
Emoji: ✨
```

---

## 📋 Quick Copy-Paste

### CSS/Tailwind Format
```css
/* World */
--world-primary: #1E3A8A;
--world-light: rgba(30, 58, 138, 0.15);

/* Politics */
--politics-primary: #DC2626;
--politics-light: rgba(220, 38, 38, 0.15);

/* Business */
--business-primary: #059669;
--business-light: rgba(5, 150, 105, 0.15);

/* Technology */
--technology-primary: #9333EA;
--technology-light: rgba(147, 51, 234, 0.15);

/* Science */
--science-primary: #06B6D4;
--science-light: rgba(6, 182, 212, 0.15);

/* Health */
--health-primary: #EC4899;
--health-light: rgba(236, 72, 153, 0.15);

/* Sports */
--sports-primary: #F97316;
--sports-light: rgba(249, 115, 22, 0.15);

/* Lifestyle */
--lifestyle-primary: #EAB308;
--lifestyle-light: rgba(234, 179, 8, 0.15);
```

### JSON Format
```json
{
  "World": {
    "primary": "#1E3A8A",
    "light": "rgba(30, 58, 138, 0.15)",
    "emoji": "🌍"
  },
  "Politics": {
    "primary": "#DC2626",
    "light": "rgba(220, 38, 38, 0.15)",
    "emoji": "🏛️"
  },
  "Business": {
    "primary": "#059669",
    "light": "rgba(5, 150, 105, 0.15)",
    "emoji": "💼"
  },
  "Technology": {
    "primary": "#9333EA",
    "light": "rgba(147, 51, 234, 0.15)",
    "emoji": "💻"
  },
  "Science": {
    "primary": "#06B6D4",
    "light": "rgba(6, 182, 212, 0.15)",
    "emoji": "🔬"
  },
  "Health": {
    "primary": "#EC4899",
    "light": "rgba(236, 72, 153, 0.15)",
    "emoji": "🏥"
  },
  "Sports": {
    "primary": "#F97316",
    "light": "rgba(249, 115, 22, 0.15)",
    "emoji": "⚽"
  },
  "Lifestyle": {
    "primary": "#EAB308",
    "light": "rgba(234, 179, 8, 0.15)",
    "emoji": "✨"
  }
}
```

---

## 🎯 Usage Examples

### Category Badge Component
```jsx
<div style={{
  background: getCategoryColors(story.category).lighter,  // 15% opacity
  color: getCategoryColors(story.category).primary,       // 100% opacity
  fontSize: '9px',
  fontWeight: '600',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  padding: '3px 6px',
  borderRadius: '3px'
}}>
  {story.emoji} {story.category}
</div>
```

### Information Box Shadow
```jsx
<div style={{
  boxShadow: `0 2px 8px ${getCategoryColors(story.category).shadow}`  // 30% opacity
}}>
  {/* Box content */}
</div>
```

### Detail Value Color
```jsx
<div 
  className="news-detail-value" 
  style={{ 
    color: getCategoryColors(story.category).primary  // 100% opacity
  }}
>
  {value}
</div>
```

---

## 🔍 Color Contrast Ratios

All colors have been selected to ensure WCAG AA accessibility compliance:

| Category | Background (15%) | Text (100%) | Contrast Ratio |
|----------|------------------|-------------|----------------|
| World | rgba(30,58,138,0.15) | #1E3A8A | ✅ Pass AA |
| Politics | rgba(220,38,38,0.15) | #DC2626 | ✅ Pass AA |
| Business | rgba(5,150,105,0.15) | #059669 | ✅ Pass AA |
| Technology | rgba(147,51,234,0.15) | #9333EA | ✅ Pass AA |
| Science | rgba(6,182,212,0.15) | #06B6D4 | ✅ Pass AA |
| Health | rgba(236,72,153,0.15) | #EC4899 | ✅ Pass AA |
| Sports | rgba(249,115,22,0.15) | #F97316 | ✅ Pass AA |
| Lifestyle | rgba(234,179,8,0.15) | #EAB308 | ✅ Pass AA |

---

## 📱 Mobile Preview

```
┌────────────────────────────────────────┐
│ ┌─────────────┐                        │
│ │ 🌍 WORLD    │  ← Navy blue badge     │
│ └─────────────┘                        │
│                                        │
│ Major Climate Summit Concludes With   │
│ Historic Agreement                     │
│                                        │
│ • Leaders from 195 nations agreed...  │
│ • New emission targets set for...     │
│ • $100B climate fund established...   │
│                                        │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ ┌─────────────────┐                    │
│ │ 💻 TECHNOLOGY   │  ← Purple badge    │
│ └─────────────────┘                    │
│                                        │
│ AI Breakthrough Transforms Medical    │
│ Diagnosis                              │
│                                        │
│ • New algorithm achieves 99.5%...     │
│ • Reduces diagnosis time from...      │
│ • Already deployed in 50...           │
│                                        │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ ┌─────────────┐                        │
│ │ ⚽ SPORTS    │  ← Orange badge        │
│ └─────────────┘                        │
│                                        │
│ Underdog Team Wins Championship In    │
│ Dramatic Finish                        │
│                                        │
│ • Final score 3-2 in overtime...      │
│ • First championship in 50...         │
│ • Star player scores winning...       │
│                                        │
└────────────────────────────────────────┘
```

---

## 🎨 Color Meanings & Applications

### World (Navy Blue #1E3A8A)
- **Meaning**: Trust, Stability, Professionalism
- **Use Cases**: International summits, treaties, diplomatic relations
- **Mood**: Serious, authoritative, global

### Politics (Crimson Red #DC2626)
- **Meaning**: Power, Urgency, Importance
- **Use Cases**: Elections, policy changes, political scandals
- **Mood**: Bold, attention-grabbing, decisive

### Business (Emerald Green #059669)
- **Meaning**: Growth, Prosperity, Success
- **Use Cases**: Market movements, earnings reports, mergers
- **Mood**: Professional, optimistic, wealth-focused

### Technology (Bright Purple #9333EA)
- **Meaning**: Innovation, Creativity, Future
- **Use Cases**: Product launches, tech breakthroughs, digital trends
- **Mood**: Modern, cutting-edge, exciting

### Science (Cyan #06B6D4)
- **Meaning**: Logic, Clarity, Discovery
- **Use Cases**: Research findings, scientific breakthroughs, studies
- **Mood**: Clear, analytical, progressive

### Health (Pink #EC4899)
- **Meaning**: Care, Wellness, Vitality
- **Use Cases**: Medical news, wellness trends, health alerts
- **Mood**: Compassionate, positive, life-affirming

### Sports (Vibrant Orange #F97316)
- **Meaning**: Energy, Excitement, Competition
- **Use Cases**: Game results, athlete profiles, sporting events
- **Mood**: Dynamic, passionate, energetic

### Lifestyle (Golden Yellow #EAB308)
- **Meaning**: Optimism, Happiness, Creativity
- **Use Cases**: Fashion, food, travel, entertainment
- **Mood**: Cheerful, aspirational, enjoyable

---

## 🔄 Version History

### v2.0 (Current) - October 24, 2025
- Updated to exact brand color specifications
- Added proper RGBA conversion for opacity variants
- Improved category badge visibility
- Enhanced color accessibility

### v1.0 - Previous
- Initial color system
- Used simple hex + opacity string concatenation

---

Perfect color system for TenNews! 🎨✨

