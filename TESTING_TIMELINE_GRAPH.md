# Testing Timeline & Graph Components on Localhost

## 🚀 Quick Start

### Step 1: Start Your Development Server
```bash
npm run dev
```

### Step 2: Open Test Mode in Browser
```
http://localhost:3000?test=true
```

That's it! You'll now see **3 test articles** with complete Timeline and Graph examples.

---

## 📊 Test Articles Overview

### Article 1: Climate Summit (Timeline Example)
- **Title**: "Climate Summit Reaches Historic Agreement"
- **Components Available**: 
  - ✅ Details (3 items)
  - ✅ Timeline (5 events from 2020 to 2030)
  - ✅ Map (Geneva, Switzerland with 3 markers)

**Timeline Preview**:
1. 2020 - Initial climate discussions
2. 2022 - Preliminary framework established
3. 2024 - Mid-term review
4. Today - Historic agreement signed
5. 2030 - Target deadline

### Article 2: Tech Growth (Graph Example)
- **Title**: "Tech Giant Reports Record-Breaking Quarterly Growth"
- **Components Available**:
  - ✅ Details (3 items)
  - ✅ Timeline (5 quarterly events)
  - ✅ Graph (4 quarters of revenue growth)
  - ✅ Map (Silicon Valley with 3 markers)

**Graph Preview**:
- Q1: 70% growth
- Q2: 80% growth
- Q3: 85% growth
- Q4: 95% growth

**Data Points**:
- Total Revenue: $125B
- Year-over-Year: +35%
- AI Division: $25B
- Stock Increase: +12%
- Profit Margin: 28%
- Employee Count: 175K

### Article 3: Medical Breakthrough (Both Timeline & Graph)
- **Title**: "Breakthrough Cancer Treatment Shows 80% Success Rate"
- **Components Available**:
  - ✅ Details (3 items)
  - ✅ Timeline (7 events from 2018 to 2026)
  - ✅ Graph (4 phases of clinical trials)
  - ✅ Map (Boston with 3 markers)

**Complete example with all components!**

---

## 🎮 How to Test Each Component

### Testing Timeline Component

1. Navigate to **Article 1** (Climate Summit)
2. Look at the bottom navigation dots - you'll see **4 dots**
3. Click the **2nd dot** (Timeline)
4. You should see:
   - A blue vertical line
   - 5 timeline events with dates
   - Blue dots on the timeline
   - The last event has a filled blue dot
5. Click the **↗ arrow** in the top-right to expand
6. Timeline grows from 85px to 300px smoothly

### Testing Graph Component

1. Navigate to **Article 2** (Tech Growth)
2. Click the **3rd dot** (Graph - you may need to scroll through other components)
3. **In collapsed view (85px)**, you should see:
   - 4 mini purple bars
   - Compact representation
4. Click the **↗ arrow** to expand
5. **In expanded view (300px)**, you should see:
   - 4 full-size animated purple bars with labels (Q1, Q2, Q3, Q4)
   - Purple gradient background
   - Horizontal grid lines
   - Below the chart: 6 data points with labels and values
   - Smooth animations

### Testing Map Component

1. Navigate to any article
2. Click the **Map dot** in navigation
3. **In collapsed view (85px)**, you should see:
   - Location pin emoji 📍
   - Green gradient background
   - Grid pattern overlay
4. Click the **↗ arrow** to expand
5. **In expanded view (300px)**, you should see:
   - Large location pin
   - Location name (e.g., "Geneva, Switzerland")
   - GPS coordinates (e.g., "46.2044°, 6.1432°")
   - List of 3 markers with pin emojis
   - Green themed design

### Testing All Components Together

1. Navigate to **Article 3** (Medical Breakthrough)
2. This article has **ALL 4 components**:
   - Details (default view)
   - Timeline (7 events)
   - Graph (Clinical trial success rates)
   - Map (Boston location)
3. Test switching between all components using the navigation dots
4. Test expand/collapse on each component
5. Verify smooth transitions and animations

---

## 🎨 Visual Verification Checklist

### For Timeline Component ✅
- [ ] Blue color scheme (`#3b82f6`)
- [ ] Vertical line connecting events
- [ ] Timeline dots (hollow + filled for last item)
- [ ] Dates in blue bold text
- [ ] Event descriptions in dark text
- [ ] Smooth expand animation (0.3s)
- [ ] Expand icon rotates 180°

### For Graph Component ✅
- [ ] Purple color scheme (`#8b5cf6`)
- [ ] Bar chart with 4 bars
- [ ] Gradient purple fill on bars
- [ ] Labels below each bar
- [ ] Horizontal grid lines in background
- [ ] Data points list (when expanded)
- [ ] Animated bar heights (0.5s)
- [ ] Smooth expand animation (0.3s)

### For Map Component ✅
- [ ] Green color scheme (`#10b981`)
- [ ] Grid pattern background
- [ ] Location pin emoji
- [ ] Location name in green
- [ ] GPS coordinates in monospace font
- [ ] Marker list with pin emojis
- [ ] Smooth expand animation (0.3s)

### For Navigation System ✅
- [ ] 4 dots visible when all components exist
- [ ] Active dot is darker (`rgba(0, 0, 0, 0.6)`)
- [ ] Inactive dots are lighter (`rgba(0, 0, 0, 0.2)`)
- [ ] Clicking dot switches component smoothly
- [ ] Only one component visible at a time

---

## 🔧 Alternative Testing Methods

### Method 1: Direct API Test
```
http://localhost:3000/api/news?test=true
```
This will show you the raw JSON data with timeline and graph structures.

### Method 2: Dedicated Test Endpoint
```
http://localhost:3000/api/news-test
```
Alternative endpoint that always returns test data.

### Method 3: Copy Test File to Today's Date
```bash
cp public/test_timeline_graph.json public/tennews_data_$(date +%Y_%m_%d).json
```
This makes it load automatically without the `?test=true` parameter.

---

## 📱 Mobile Testing

### On Mobile Browser
1. Open `http://localhost:3000?test=true` on your mobile device
2. **Note**: You may need to use your computer's IP address:
   ```
   http://192.168.1.XXX:3000?test=true
   ```
3. Test touch interactions:
   - Tap navigation dots to switch components
   - Tap expand icon to expand/collapse
   - Swipe up/down to navigate stories
   - Verify all animations work smoothly

### Mobile Viewport Testing (Desktop)
1. Open Chrome DevTools (F12)
2. Click "Toggle Device Toolbar" (Ctrl+Shift+M)
3. Select "iPhone 12 Pro" or similar
4. Visit `http://localhost:3000?test=true`
5. Test all interactions

---

## 🎯 Expected Behavior

### Component Switching
- Clicking a navigation dot should **instantly** switch to that component
- Previous component should disappear
- New component should appear
- No lag or glitches

### Expand/Collapse
- Click expand icon (↗) should toggle expanded state
- Transition should take **0.3 seconds**
- Should be smooth with `ease-in-out` timing
- Content should become scrollable when expanded
- Icon should rotate 180° when expanding

### Visual Consistency
- All components should have the **same box size** (85px collapsed, 300px expanded)
- All components should be at the **same fixed position** (bottom of article)
- All components should have the **same border-radius** (8px)
- All components should have the **same box-shadow**

---

## 🐛 Troubleshooting

### Test Mode Not Working
**Problem**: Regular news showing instead of test data

**Solution**:
```javascript
// Check browser console for:
"🧪 TEST MODE: Loading timeline & graph examples"

// If you see "📰 Loading regular news" instead:
1. Make sure URL has ?test=true
2. Hard refresh (Ctrl+Shift+R)
3. Check that test_timeline_graph.json exists in /public
```

### Timeline Not Showing
**Problem**: Timeline component not visible

**Solution**:
1. Click the 2nd navigation dot (Timeline dot)
2. Check console for any errors
3. Verify timeline data exists in article
4. Make sure you're not on Details view

### Graph Not Rendering
**Problem**: Graph bars not appearing

**Solution**:
1. Click the 3rd or 4th navigation dot (Graph may be 3rd or 4th depending on components)
2. Check if `expandedGraph` state is working
3. Look for Graph dot in navigation
4. Verify graph data in test file

### Components Not Switching
**Problem**: Navigation dots don't switch components

**Solution**:
1. Check browser console for click events
2. Verify all state functions are defined
3. Make sure `showDetails`, `showTimeline`, `showMap`, `showGraph` states exist
4. Clear browser cache and reload

### Expand Icon Not Working
**Problem**: Arrow doesn't expand component

**Solution**:
1. Check `data-expand-icon="true"` attribute exists
2. Verify click handlers have `stopPropagation()`
3. Test both click and touch events
4. Look for console logs when clicking

---

## 📊 Test Data Structure

### Timeline Data Format
```javascript
"timeline": [
  {
    "date": "2020",
    "event": "Event description here"
  },
  {
    "date": "Today",
    "event": "Current event description"
  }
]
```

### Graph Data Format
```javascript
"graph": {
  "title": "Chart Title",
  "data": [
    { "label": "Q1", "value": 65 }
  ],
  "dataPoints": [
    { "label": "Metric", "value": "100K" }
  ]
}
```

### Map Data Format
```javascript
"map": {
  "location": "City Name",
  "center": {
    "lat": 40.7128,
    "lon": -74.0060,
    "name": "Location Name"
  },
  "markers": [
    { "name": "Point of Interest" }
  ]
}
```

---

## 🎉 Success Criteria

You'll know everything is working correctly when:

1. ✅ Test mode loads with `?test=true` parameter
2. ✅ 3 articles appear with realistic news content
3. ✅ Navigation dots show at bottom of each article
4. ✅ All 4 components are accessible via dots
5. ✅ Timeline shows blue design with events
6. ✅ Graph shows purple animated bars
7. ✅ Map shows green location with coordinates
8. ✅ Expand icons work on all components
9. ✅ Components smoothly expand from 85px to 300px
10. ✅ Only one component visible at a time
11. ✅ All animations are smooth
12. ✅ No console errors
13. ✅ Mobile-responsive design works
14. ✅ Touch interactions work on mobile

---

## 🎬 Video Demo Script

Record a quick video following these steps:

1. **Show URL**: `http://localhost:3000?test=true`
2. **Article 1**: Show timeline with expand/collapse
3. **Article 2**: Show graph with bar chart animation
4. **Article 3**: Switch between all 4 components
5. **Navigation**: Demonstrate dot navigation
6. **Expand**: Show expand/collapse on each component
7. **Mobile**: Show on mobile viewport
8. **Conclusion**: Show all components working together

---

## 📞 Need Help?

If you encounter any issues:

1. Check the browser console for errors
2. Verify all files are saved
3. Restart the dev server (`npm run dev`)
4. Clear browser cache (Ctrl+Shift+R)
5. Check that all state variables are defined
6. Verify test_timeline_graph.json is valid JSON

---

## 🎯 Next Steps

After confirming everything works:

1. **Integrate with Production Data**
   - Add timeline, graph, and map fields to your news pipeline
   - Update step 3 (component selection) to generate these structures
   - Test with real news articles

2. **Enhance Visualizations**
   - Add real map integration (Google Maps, Mapbox)
   - Create more chart types (line, pie, area)
   - Add interactive features

3. **Performance Testing**
   - Test with 10+ articles
   - Verify smooth animations
   - Check memory usage

4. **User Testing**
   - Get feedback on component switching
   - Test expand/collapse UX
   - Verify mobile usability

---

## ✨ Features Demonstrated

This test showcases:
- ✅ Timeline component with event history
- ✅ Graph component with animated bar charts
- ✅ Map component with location markers
- ✅ Component navigation with dots
- ✅ Expand/collapse functionality
- ✅ Smooth animations and transitions
- ✅ Consistent design system
- ✅ Mobile-responsive layout
- ✅ Touch-friendly interactions
- ✅ Production-ready code quality

Enjoy testing! 🎉

