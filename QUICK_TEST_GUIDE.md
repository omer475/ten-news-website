# ⚡ Quick Test Guide - Timeline & Graph

## 🚀 One Command Test

```bash
# 1. Start server
npm run dev

# 2. Open in browser
http://localhost:3000?test=true
```

---

## 📊 What You'll See

### **3 Test Articles:**

1. **🌍 Climate Summit** → Focus on Timeline
2. **📈 Tech Growth** → Focus on Graph  
3. **🏥 Medical Breakthrough** → Has All Components

---

## 🎯 Quick Testing Checklist

### Article 1: Climate Summit
- [ ] See 4 navigation dots at bottom
- [ ] Click 2nd dot → Timeline appears
- [ ] Click ↗ arrow → Expands to show 5 events
- [ ] Blue themed design
- [ ] Smooth 0.3s animation

### Article 2: Tech Growth
- [ ] Click Graph dot → Graph appears
- [ ] See 4 purple bars (collapsed)
- [ ] Click ↗ arrow → Shows full chart
- [ ] See data points: $125B, +35%, etc.
- [ ] Animated bar heights

### Article 3: Medical Breakthrough
- [ ] Has 4 dots (Details, Timeline, Graph, Map)
- [ ] Switch between all components
- [ ] Each expands independently
- [ ] All animations smooth

---

## 🎨 Color Check

| Component | Color | Code |
|-----------|-------|------|
| Timeline | Blue | `#3b82f6` |
| Graph | Purple | `#8b5cf6` |
| Map | Green | `#10b981` |
| Details | White | `#ffffff` |

---

## ✅ Success = All These Work:

1. ✅ `?test=true` loads test data
2. ✅ Navigation dots switch components
3. ✅ Expand icon works (↗)
4. ✅ Timeline shows 5+ events
5. ✅ Graph shows animated bars
6. ✅ Map shows location + coordinates
7. ✅ Smooth 0.3s transitions
8. ✅ Same size (85px → 300px)
9. ✅ Same position (bottom fixed)
10. ✅ No console errors

---

## 🐛 Quick Fixes

**Not loading test data?**
```bash
# Hard refresh
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)
```

**Timeline not visible?**
- Click the 2nd navigation dot
- Look for blue timeline design

**Graph not showing bars?**
- Click Graph dot (3rd or 4th)
- Look for purple bar chart

**Components not switching?**
- Check console for errors
- Verify all dots are clickable

---

## 📱 Mobile Test

```
http://YOUR_IP:3000?test=true
```

Example: `http://192.168.1.100:3000?test=true`

---

## 🎬 Perfect Test Run

1. Load → `localhost:3000?test=true`
2. Article 1 → Click Timeline dot → Expand
3. Article 2 → Click Graph dot → See bars
4. Article 3 → Cycle through all 4 components
5. Mobile → Test on phone
6. Done! 🎉

---

## 📊 Expected Results

### Timeline (Collapsed - 85px)
```
┌─────────────────────────┐
│ 📅 TIMELINE            ↗│
├─────────────────────────┤
│ ● 2020 - First event    │
│ ● Today - Latest event  │
└─────────────────────────┘
```

### Timeline (Expanded - 300px)
```
┌─────────────────────────┐
│ 📅 TIMELINE            ↗│
├─────────────────────────┤
│ ● 2020 - First event    │
│ ○ 2022 - Second event   │
│ ○ 2024 - Third event    │
│ ● Today - Current       │
│ ○ 2030 - Future         │
│                         │
└─────────────────────────┘
```

### Graph (Collapsed - 85px)
```
┌─────────────────────────┐
│ 📊 DATA VISUALIZATION  ↗│
├─────────────────────────┤
│     ▄ ▄ ▄ ▄            │
│     █ █ █ █            │
└─────────────────────────┘
```

### Graph (Expanded - 300px)
```
┌─────────────────────────┐
│ 📊 DATA VISUALIZATION  ↗│
├─────────────────────────┤
│         ▄▄▄▄            │
│         ████            │
│     ▄▄▄▄████        ▄▄▄▄│
│ ▄▄▄▄████████    ▄▄▄▄████│
│ ████████████    ████████│
│  Q1   Q2   Q3     Q4    │
├─────────────────────────┤
│ Revenue: $125B          │
│ Growth: +35%            │
│ AI Division: $25B       │
└─────────────────────────┘
```

---

## 🎯 Key Features to Verify

### Navigation Dots
- ⚪ Inactive: Light gray
- ⚫ Active: Dark gray
- 4 dots when all components exist
- Clicking switches instantly

### Expand Icon (↗)
- Top-right corner
- Rotates 180° when expanded
- Click or touch to toggle
- Prevents story navigation

### Animations
- Height: 0.3s ease-in-out
- Rotation: 0.2s ease
- Bar heights: 0.5s ease
- No janky animations

### Sizing
- Collapsed: 85px height
- Expanded: 300px height
- Width: 100% (with padding)
- Fixed at bottom

---

## 🎉 Done!

If all checks pass, you have:
- ✅ Working Timeline component
- ✅ Working Graph component
- ✅ Working Map component
- ✅ Working Details component
- ✅ Navigation system
- ✅ Expand/collapse
- ✅ Smooth animations
- ✅ Production-ready

Now integrate with real news data! 🚀

