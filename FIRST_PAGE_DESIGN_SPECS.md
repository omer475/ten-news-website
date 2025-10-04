# 🎨 First Page Complete Design Specifications

## 📋 Overview
Complete design code for the Ten News first page with all features, animations, and interactions.

---

## ✨ Features

### 1. **Ultra-Smooth Blue Blur Animation**
- Continuous traveling blur spotlight on headline
- Duration: 10 seconds per cycle
- Covers all rows seamlessly
- Blue glow: `rgba(59, 130, 246, 0.4)`
- Animation: `travel-multi-row` (linear, infinite)

### 2. **Swipeable Carousel**
- **Touch Swipe**: Left/right gestures (min 50px)
- **Click/Tap**: Toggle between cards
- **Auto-Rotation**: Every 4 seconds
- **Manual Control**: Stops auto-rotation on interaction
- **Smooth Transition**: 0.4s cubic-bezier easing

### 3. **Glassmorphism Design**
- **Backdrop Blur**: 13px
- **Border**: 1px solid rgba(255, 255, 255, 0.3)
- **Border Radius**: 20px
- **Background**: rgba(255, 255, 255, 0.12)
- **Shadow Effects**: Multiple inset shadows for depth

### 4. **Animated Background**
- Three floating blur orbs (red, blue, purple)
- Soft pastel colors with 25% opacity
- Float animation: 25-35 seconds
- 80px blur radius

### 5. **Time-Based Greeting**
- **Morning** (5:00-11:59): "Goood morning!"
- **Afternoon** (12:00-17:59): "Goood afternoon!"
- **Evening** (18:00-4:59): "Goood evening!"
- Gradient: #3B82F6 → #A855F7

### 6. **Live Indicator**
- Pulsing green dot
- "Live" label
- Color: #10B981
- Pulse: 2s infinite

---

## 🎨 Color Palette

### Primary Colors
- **Blue**: `#3B82F6`
- **Purple**: `#A855F7`
- **Green**: `#10B981`
- **Red**: `#EF4444`
- **Dark Gray**: `#111827`
- **Black**: `#000000`

### Glassmorphism
- **Background**: `rgba(255, 255, 255, 0.12)`
- **Border**: `rgba(255, 255, 255, 0.3)`
- **Inset Highlights**: `rgba(255, 255, 255, 0.5)`

### Background Blurs
- **Red/Pink**: `rgba(254, 202, 202, 0.25)`
- **Blue**: `rgba(191, 219, 254, 0.25)`
- **Purple**: `rgba(221, 214, 254, 0.25)`

---

## 📝 Typography

### Font Sizes
- **Greeting**: 28px (weight 700)
- **Headline**: 36px (weight 800)
- **Section Title**: 18px (weight 700)
- **Card Title**: 10px (weight 700, uppercase)
- **News Text**: 13px (weight 500)
- **Year Label**: 11px (weight 700)
- **Live Badge**: 11px (weight 600)
- **Scroll Hint**: 10px (opacity 0.5)

### Font Weights
- **700**: Bold (titles, labels)
- **800**: Extra Bold (main headline)
- **600**: Semi-Bold (live badge)
- **500**: Medium (body text)

---

## 🎬 Animations

### 1. Pulse (Live Indicator & Urgent Items)
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```
- Duration: 2s
- Iteration: infinite

### 2. Float Soft (Background Blurs)
```css
@keyframes float-soft {
  0%, 100% { transform: translate(0, 0); }
  33% { transform: translate(30px, -30px); }
  66% { transform: translate(-30px, 30px); }
}
```
- Duration: 25-35s
- Easing: ease-in-out
- Iteration: infinite

### 3. Travel Multi-Row (Blue Blur)
```css
@keyframes travel-multi-row {
  0% { left: -100px; top: 0; opacity: 0; }
  2% { opacity: 1; }
  0%, 35% { top: 0; }
  35%, 70% { top: 43px; }
  70%, 95% { top: 86px; }
  98% { opacity: 1; }
  100% { left: calc(100% + 100px); opacity: 0; }
}
```
- Duration: 10s
- Easing: linear
- Iteration: infinite

---

## 📦 Component Structure

```
NewFirstPage
├── Styles & Animations
├── Background Blur Effects (3)
│   ├── Red/Pink (top-right)
│   ├── Blue (middle-left)
│   └── Purple (bottom-right)
├── Main Container
│   ├── Greeting Section
│   │   ├── Time-based greeting
│   │   └── Headline with blue blur
│   ├── Today's Briefing Header
│   │   ├── Title
│   │   └── Live indicator
│   ├── Swipeable Carousel
│   │   ├── Card 1: What's Happening
│   │   │   ├── Title
│   │   │   └── 3 News items with dots
│   │   └── Card 2: Today in History
│   │       ├── Title
│   │       └── 3 Historical events
│   ├── Card Indicators (2 dots)
│   └── Scroll Hint
```

---

## 🎯 Interaction Specifications

### Touch Swipe
- **Direction**: Horizontal (left/right)
- **Minimum Distance**: 50px
- **Action**: Switch cards
- **Effect**: Stops auto-rotation

### Click/Tap
- **Target**: Anywhere on carousel
- **Action**: Toggle to next card
- **Effect**: Stops auto-rotation

### Indicator Dots
- **Action**: Click to jump to specific card
- **Effect**: Stops auto-rotation
- **Visual**: Active dot elongates (20px vs 6px)

### Auto-Rotation
- **Interval**: 4 seconds
- **Behavior**: Cycles between 2 cards
- **Stop Trigger**: Any manual interaction

---

## 📐 Layout Measurements

### Spacing
- **Container Padding**: 0 20px 32px
- **Section Margins**: 20-30px
- **Card Padding**: 16px
- **Gap Between Items**: 8-12px

### Border Radius
- **Cards**: 20px
- **Dots (inactive)**: 50% (circle)
- **Dots (active)**: 3px (pill shape)
- **Colored Dots**: 50% (circle)

### Sizes
- **Card Indicators**: 6px × 6px (inactive), 20px × 6px (active)
- **Colored Dots**: 5px × 5px
- **Live Dot**: 6px × 6px
- **Background Blurs**: 380-450px

---

## 🔧 Technical Details

### State Management
```javascript
const [currentCardIndex, setCurrentCardIndex] = useState(0);
const [autoRotationEnabled, setAutoRotationEnabled] = useState(true);
const [touchStart, setTouchStart] = useState(0);
const [touchEnd, setTouchEnd] = useState(0);
```

### Card Data
- **Stories**: 3 headlines (cycling)
- **What's Happening**: 3 news items with colors
- **Today in History**: 3 historical events

### Touch Detection
```javascript
const distance = touchStart - touchEnd;
const isLeftSwipe = distance > 50;
const isRightSwipe = distance < -50;
```

---

## 🎨 Glassmorphism Formula

```css
background: rgba(255, 255, 255, 0.12);
backdrop-filter: blur(13px);
-webkit-backdrop-filter: blur(13px);
border: 1px solid rgba(255, 255, 255, 0.3);
border-radius: 20px;
box-shadow: 
  0 8px 32px rgba(0, 0, 0, 0.1),
  inset 0 1px 0 rgba(255, 255, 255, 0.5),
  inset 0 -1px 0 rgba(255, 255, 255, 0.1),
  inset 0 0 22px 11px rgba(255, 255, 255, 0.11);
```

---

## 📱 Responsive Design

- **Touch Action**: `pan-x` (horizontal swipe priority)
- **Cursor**: `pointer` on interactive elements
- **Will-Change**: `transform` for smooth animations
- **Box-Sizing**: `border-box` for consistent sizing
- **Flex-Shrink**: `0` to prevent card compression

---

## 🚀 Performance Optimizations

1. **Will-Change**: Applied to carousel for GPU acceleration
2. **Transform**: Hardware-accelerated animations
3. **Backdrop-Filter**: Webkit prefixes for compatibility
4. **Pointer Events**: `none` on background elements
5. **Touch Action**: Optimized for touch devices

---

## 📄 File Locations

- **Component**: `components/NewFirstPage.js`
- **Complete Code**: `COMPLETE_FIRST_PAGE_CODE.jsx`
- **Specs Document**: `FIRST_PAGE_DESIGN_SPECS.md`

---

## 🎯 Usage

```javascript
import NewFirstPage from './components/NewFirstPage';

// In your app
<NewFirstPage onContinue={() => {/* scroll handler */}} />
```

---

**Created**: October 4, 2025  
**Version**: 1.0.0  
**Status**: Production Ready ✅
