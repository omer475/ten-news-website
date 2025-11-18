# 🌐 Language Toggle Feature - Implementation Guide

**Added**: November 18, 2025  
**File**: `pages/news.js`  
**Feature**: Advanced vs B2 English Reading Mode Toggle

---

## 🎯 **What Was Added**

A beautiful language toggle button that allows users to switch between two reading modes:
- **Advanced**: Professional news English (summary_news)
- **Easy Read**: Simple B2 English (summary_b2)

---

## 📍 **Location**

The toggle button is located in the **header actions** section, right next to the Timeline and Details buttons.

---

## ✨ **Features**

### **Main Toggle Button**
- Displays current mode: "Advanced" or "Easy Read"
- Same size and style as Timeline/Details buttons
- Smooth hover effects
- Click to expand options

### **Dropdown Options**
- **Easy Read** button (blue when active)
- **Normal News** button (dark when active)
- Animated slide-down effect
- Auto-closes when clicking outside
- Icons for visual clarity

### **Dynamic Summary Display**
- Shows `summary_b2` when in Easy Read mode
- Shows `summary_news` when in Advanced mode
- Falls back to regular summary if specific versions unavailable

---

## 🔧 **Technical Implementation**

### **State Management**
```javascript
const [languageMode, setLanguageMode] = useState('advanced');
const [showLanguageOptions, setShowLanguageOptions] = useState(false);
```

### **Handler Functions**
```javascript
// Toggle dropdown visibility
const toggleLanguageOptions = () => {
  setShowLanguageOptions(!showLanguageOptions);
};

// Set language mode and close dropdown
const setLanguage = (mode) => {
  setLanguageMode(mode);
  setShowLanguageOptions(false);
};
```

### **Click Outside Detection**
```javascript
useEffect(() => {
  const handleClickOutside = (event) => {
    if (showLanguageOptions && !event.target.closest('.reading-mode-wrapper')) {
      setShowLanguageOptions(false);
    }
  };

  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, [showLanguageOptions]);
```

### **Summary Display Logic**
```javascript
<p className="article-summary">
  {languageMode === 'b2' 
    ? (article.summary_b2 || article.summary || 'Article summary will appear here...')
    : (article.summary_news || article.summary || 'Article summary will appear here...')}
</p>
```

---

## 🎨 **Design Specifications**

### **Toggle Button**
- Matches Timeline/Details button style
- Same border-radius: `980px` (pill shape)
- Same padding: `7px 14px`
- Same font-size: `14px`
- Same hover effects

### **Dropdown Container**
- Position: `absolute`, below button
- Background: `white`
- Border-radius: `12px`
- Box-shadow: `0 10px 15px -3px rgba(0, 0, 0, 0.1)`
- Min-width: `180px`
- Animation: `slideDown 0.3s ease-out`

### **Option Buttons**
- Padding: `0.75rem 1rem`
- Border-radius: `8px`
- Font-size: `14px`
- Icons: `1rem x 1rem`

### **Active States**
- **Easy Mode Active**: `background: #3b82f6`, `color: white`
- **Normal Mode Active**: `background: #334155`, `color: white`

### **Hover Effects**
- Option buttons: `transform: scale(1.02)`
- Easy mode hover: `background: #eff6ff`
- Normal mode hover: `background: #f8fafc`

---

## 📱 **Responsive Design**

### **Mobile (max-width: 768px)**
```css
.reading-mode-wrapper {
  width: 100%;
}

.toggle-button {
  width: 100%;
  justify-content: center;
}

.options-container {
  left: 50%;
  right: auto;
  transform: translateX(-50%);
}
```

---

## 🎭 **Animations**

### **Slide Down**
```css
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

## 📊 **User Experience Flow**

1. **Initial State**: Button shows current mode ("Advanced" by default)
2. **Click Toggle**: Dropdown appears with animated slide
3. **Select Mode**: Click "Easy Read" or "Normal News"
4. **Summary Updates**: Article summary changes instantly
5. **Dropdown Closes**: Auto-closes after selection
6. **Outside Click**: Closes when clicking anywhere else

---

## 🔗 **Integration with AI System**

The feature integrates seamlessly with the updated AI system that generates two summary versions:

### **Data Flow**
```
AI generates article
  ├── summary_news (30-36 words, professional)
  └── summary_b2 (30-36 words, B2 English)
         ↓
User selects mode
         ↓
Appropriate summary displayed
```

### **Fallback Logic**
```
If languageMode === 'b2':
  Display: article.summary_b2 || article.summary || fallback
  
If languageMode === 'advanced':
  Display: article.summary_news || article.summary || fallback
```

---

## 🎯 **Benefits**

1. **Accessibility**: Makes news accessible to English learners
2. **User Choice**: Readers control their experience
3. **Professional Design**: Matches existing UI perfectly
4. **Smooth Experience**: Instant switching, no page reload
5. **Mobile Friendly**: Fully responsive on all devices

---

## 🚀 **Testing the Feature**

1. Open any article page
2. Look for the language toggle button in the header (next to Timeline/Details)
3. Click to see dropdown options
4. Select "Easy Read" - summary changes to simpler English
5. Select "Normal News" - summary changes to professional English
6. Try on mobile - button should be full width

---

## 📝 **Code Structure**

### **Components Added**
- `reading-mode-wrapper` - Container div
- `toggle-button` - Main button with icon
- `options-container` - Dropdown menu
- `option-button` - Individual option buttons
- `option-icon` - SVG icons
- `option-text` - Button labels

### **CSS Classes**
- `.reading-mode-wrapper`
- `.toggle-button`
- `.toggle-button-icon`
- `.options-container`
- `.option-button`
- `.option-button.easy-mode`
- `.option-button.normal-mode`
- `.option-button.active`
- `.option-icon`
- `.option-text`

---

## 🎨 **Icons Used**

### **Toggle Button Icon**
- Book/reading icon (layered design)

### **Easy Read Icon**
- Open book icon

### **Normal News Icon**
- Document/newspaper icon

---

## ✅ **Implementation Checklist**

- [x] Add state variables for language mode
- [x] Add toggle and selection handler functions
- [x] Add click-outside detection
- [x] Add toggle button in header
- [x] Add dropdown options container
- [x] Update summary display logic
- [x] Add CSS styles for all components
- [x] Add hover and active states
- [x] Add animations
- [x] Add responsive mobile styles
- [x] Test on desktop
- [x] Test on mobile
- [x] No linting errors

---

## 🔮 **Future Enhancements**

Potential improvements:
- Remember user preference in localStorage
- Add keyboard navigation (arrow keys)
- Add transition animation when summary changes
- Add tooltip explaining each mode
- Add analytics to track which mode is more popular

---

**Ready to use!** The language toggle feature is fully functional and integrated with your news page.

