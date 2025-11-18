# Language Switch Testing Guide

## ✅ Changes Made

### 1. **Very Distinct Example Data**
Now using CLEARLY different text for each language mode:

**ADVANCED VERSION:**
- Title: "**ADVANCED VERSION**: Coral Reefs..."
- Bullets: "**ADVANCED**: Unprecedented developments..." 
- Article: "**ADVANCED PROFESSIONAL VERSION**: This is the sophisticated..."

**B2 EASY VERSION:**
- Title: "**B2 EASY VERSION**: Coral Reefs..."
- Bullets: "**B2 EASY**: New things happening..."
- Article: "**B2 EASY ENGLISH VERSION**: This is the simple..."

### 2. **Console Logging Added**
Now you can see exactly what's happening in the browser console:
- Title selection logs
- Bullets selection logs  
- Article content selection logs

## 🧪 How to Test on Localhost

### Step 1: Open Browser Console
1. Open `localhost:3000`
2. Press `F12` or `Cmd+Option+I` (Mac) to open DevTools
3. Go to the **Console** tab

### Step 2: Navigate to News Article
1. Swipe to a news article (not the opening page)
2. You should see console logs like:
```
Title for article 1: {mode: "advanced", title_b2: "**B2 EASY VERSION**...", title_news: "**ADVANCED VERSION**...", selected: "**ADVANCED VERSION**..."}
Bullets for article 1: {mode: "advanced", bullets_b2: Array(4), bullets_news: Array(4), selected: Array(4)}
Article for 1: {mode: "advanced", content_b2_length: 450, content_news_length: 500, selected_length: 500}
```

### Step 3: Test Language Switching

#### **Initially (Advanced Mode - Default)**
- Title should start with: "**ADVANCED VERSION**:"
- Bullets should start with: "**ADVANCED**:"
- Article should start with: "**ADVANCED PROFESSIONAL VERSION**:"

#### **Click Language Button → Click "Easy"**
Watch the console - you should see:
```
B2/Easy button clicked! 1
Title for article 1: {mode: "b2", ...}
Bullets for article 1: {mode: "b2", ...}
Article for 1: {mode: "b2", ...}
```

And the content should change to:
- Title: "**B2 EASY VERSION**:"
- Bullets: "**B2 EASY**:"
- Article: "**B2 EASY ENGLISH VERSION**:"

#### **Click "Adv"**
Watch the console - you should see:
```
Advanced button clicked! 1
Title for article 1: {mode: "advanced", ...}
```

Content should switch back to ADVANCED version.

## 🐛 If Content Doesn't Change

### Check Console Logs

**Look for these issues:**

1. **Mode not changing:**
```
// Bad - mode stays the same
B2/Easy button clicked! 1
Title for article 1: {mode: "advanced", ...}  ❌

// Good - mode changes
B2/Easy button clicked! 1
Title for article 1: {mode: "b2", ...}  ✅
```

2. **Missing dual-language data:**
```
// If you see this:
{title_b2: undefined, title_news: undefined}  ❌

// It means the API data has the old fields but not the new ones
```

3. **Fallback to old fields:**
```
// If content_b2 and content_news are undefined, it falls back to:
- detailed_text
- article

// These are the same for both modes, so content won't change
```

## 💡 What This Tells Us

### Scenario A: Mode changes, content changes
✅ **Everything works!** The language switcher is functioning perfectly.

### Scenario B: Mode changes, content DOESN'T change
⚠️ **Issue**: The API data has old fields (`article`, `detailed_text`) but not new dual-language fields.
**Solution**: The new AI generation system needs to populate `content_news` and `content_b2` in Supabase.

### Scenario C: Mode doesn't change
❌ **Issue**: The `languageMode` state isn't updating.
**Solution**: Check button click handlers.

## 📊 Expected Console Output

When everything works, you should see this pattern:

```javascript
// Initial load (Advanced)
Title for article 1: {mode: "advanced", title_b2: "**B2 EASY VERSION**...", title_news: "**ADVANCED VERSION**...", selected: "**ADVANCED VERSION**..."}

// Click Easy
B2/Easy button clicked! 1
Title for article 1: {mode: "b2", title_b2: "**B2 EASY VERSION**...", title_news: "**ADVANCED VERSION**...", selected: "**B2 EASY VERSION**..."}

// Click Adv
Advanced button clicked! 1
Title for article 1: {mode: "advanced", title_b2: "**B2 EASY VERSION**...", title_news: "**ADVANCED VERSION**...", selected: "**ADVANCED VERSION**..."}
```

## 🎯 Key Things to Verify

1. ✅ Console shows "B2/Easy button clicked!" when clicking Easy
2. ✅ Console shows "Advanced button clicked!" when clicking Adv
3. ✅ Mode changes from "advanced" to "b2" and back
4. ✅ Title visibly changes (look for "ADVANCED VERSION" vs "B2 EASY VERSION")
5. ✅ Bullets visibly change (look for "ADVANCED:" vs "B2 EASY:")
6. ✅ Article text visibly changes (look for different opening sentences)

---

**Test it now and share what you see in the console!**

