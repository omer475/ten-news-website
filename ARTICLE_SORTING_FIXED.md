# 🔧 Article Sorting Fixed - Sort by Score (Highest First)

## Date: November 20, 2025 - 22:15

---

## 🚨 **Issue Reported**

User: "Articles are not sorted by score anymore. The highest scored article should be first, but currently it's sorted by time. This was working previously."

**Example of broken behavior:**
- Article with **700 score** published 1 hour ago → Shows first ❌
- Article with **950 score** published 4 hours ago → Shows second ❌

**Expected behavior:**
- Article with **950 score** published 4 hours ago → Shows first ✅
- Article with **700 score** published 1 hour ago → Shows second ✅

---

## 🔍 **Root Causes Found**

### **Problem 1: Score Calculation Removed**

In recent changes, the user removed the score calculation from Step 8:

**Removed code:**
```python
# Calculate article importance score (0-1000)
source_scores = [s.get('score', 0) for s in cluster_sources if s.get('score')]
avg_score = sum(source_scores) / len(source_scores) if source_scores else 500

# Bonus for multi-source articles (up to +100 points)
source_bonus = min(len(cluster_sources) * 10, 100)

article_score = int(min(avg_score + source_bonus, 1000))

# In article_data:
'ai_final_score': article_score  # ← This was removed
```

**Result:** Articles published without `ai_final_score` field → Can't be sorted by score!

---

### **Problem 2: API Sorting by Time Instead of Score**

**File:** `pages/api/news-supabase.js` (line 33)

**Wrong code:**
```javascript
const { data: articles, error } = await supabase
  .from('published_articles')
  .select('*')
  .gte('created_at', twentyFourHoursAgo)
  .order('created_at', { ascending: false })  // ❌ Sorting by time!
  .limit(500)
```

**Result:** Articles ordered by newest first, ignoring score!

---

## ✅ **Fixes Applied**

### **Fix 1: Restored Score Calculation (Step 8)**

**File:** `complete_clustered_8step_workflow.py`

**Added back:**
```python
# STEP 8: Publishing to Supabase
print(f"\n💾 STEP 8: PUBLISHING TO SUPABASE")

# Calculate article importance score (0-1000)
# Based on average source score + bonus for multi-source coverage
source_scores = [s.get('score', 0) for s in cluster_sources if s.get('score')]
avg_score = sum(source_scores) / len(source_scores) if source_scores else 500

# Bonus for multi-source articles (up to +100 points)
source_bonus = min(len(cluster_sources) * 10, 100)

article_score = int(min(avg_score + source_bonus, 1000))
print(f"   📊 Article score: {article_score}/1000 (avg: {int(avg_score)}, sources: {len(cluster_sources)})")

article_data = {
    # ... other fields ...
    'ai_final_score': article_score,  # ← Restored!
    # ...
}
```

---

### **Fix 2: Changed API to Sort by Score**

**File:** `pages/api/news-supabase.js`

**Fixed code:**
```javascript
const { data: articles, error } = await supabase
  .from('published_articles')
  .select('*')
  .gte('created_at', twentyFourHoursAgo)
  .order('ai_final_score', { ascending: false })  // ✅ PRIMARY: Sort by score (highest first)
  .order('created_at', { ascending: false })      // ✅ SECONDARY: Then by time
  .limit(500)
```

**Sorting logic:**
1. **Primary sort:** `ai_final_score` descending (highest first)
2. **Secondary sort:** `created_at` descending (newest first for same scores)

---

## 📊 **How Score Calculation Works**

### **Formula:**
```
ai_final_score = min(avg_source_score + multi_source_bonus, 1000)
```

### **Components:**

1. **Average Source Score:**
   - Each source article gets a score from Gemini in Step 1 (0-1000)
   - Average all source scores in a cluster
   - Example: Sources with scores [850, 820, 900] → avg = 857

2. **Multi-Source Bonus:**
   - +10 points per source article
   - Maximum bonus: +100 points
   - Example: 3 sources → +30 points

3. **Final Score:**
   - Add average + bonus
   - Cap at 1000
   - Example: 857 + 30 = 887/1000

---

## 📈 **Example Calculations**

### **Example 1: Single Source Article**
- Source score: 850
- Number of sources: 1
- Average score: 850
- Multi-source bonus: 1 × 10 = +10
- **Final score: 850 + 10 = 860/1000**

### **Example 2: Three Source Article**
- Source scores: [850, 820, 900]
- Number of sources: 3
- Average score: (850 + 820 + 900) / 3 = 857
- Multi-source bonus: 3 × 10 = +30
- **Final score: 857 + 30 = 887/1000**

### **Example 3: High Quality, Many Sources**
- Source scores: [950, 920, 940, 930, 960, 940, 950]
- Number of sources: 7
- Average score: 941
- Multi-source bonus: 7 × 10 = +70
- **Final score: 941 + 70 = 1000/1000** (capped at max)

### **Example 4: Low Quality Article**
- Source scores: [400, 450]
- Number of sources: 2
- Average score: 425
- Multi-source bonus: 2 × 10 = +20
- **Final score: 425 + 20 = 445/1000**

---

## 🎯 **Expected Sorting Behavior**

### **Scenario 1: Different Scores, Different Times**

| Article | Score | Published | Display Order |
|---------|-------|-----------|---------------|
| A | 950 | 4 hours ago | **1st** ✅ |
| B | 880 | 1 hour ago | **2nd** ✅ |
| C | 820 | 2 hours ago | **3rd** ✅ |
| D | 700 | 30 min ago | **4th** ✅ |

**Logic:** Highest score always wins, regardless of age.

---

### **Scenario 2: Same Score, Different Times**

| Article | Score | Published | Display Order |
|---------|-------|-----------|---------------|
| A | 820 | 1 hour ago | **1st** ✅ |
| B | 820 | 3 hours ago | **2nd** ✅ |

**Logic:** For same scores, newest article shows first.

---

### **Scenario 3: Mixed Scores and Times**

| Article | Score | Published | Display Order |
|---------|-------|-----------|---------------|
| Breaking News | 950 | 30 min ago | **1st** ✅ |
| Major Event | 900 | 5 hours ago | **2nd** ✅ |
| Important Update | 850 | 1 hour ago | **3rd** ✅ |
| Regular Story | 750 | 2 hours ago | **4th** ✅ |
| Minor News | 650 | 15 min ago | **5th** ✅ |

**Logic:** Score determines position, not recency. A 5-hour-old 900-score article beats a 15-minute-old 650-score article.

---

## 🚀 **Apply the Fix**

Pull the latest code and restart:

```bash
cd "/Users/omersogancioglu/Ten news website "
git pull origin main

# Stop current system (Ctrl+C), then restart:
./RUN_LIVE_CLUSTERED_SYSTEM.sh
```

---

## 📝 **What You'll See**

### **During Publishing (Step 8):**
```
💾 STEP 8: PUBLISHING TO SUPABASE
   📊 Article score: 887/1000 (avg: 857, sources: 3)
   ✅ Published article ID: 545
```

### **On Website (tennews.ai):**
- Articles now sorted by score (highest first)
- Best content always at top
- Even old but high-quality articles rank above new but lower-quality ones

---

## 🔍 **Verification Steps**

After restarting the system:

1. **Check published articles in Supabase:**
   - Go to `published_articles` table
   - Look for `ai_final_score` column
   - Verify it has values (e.g., 850, 920, 780)

2. **Check website sorting:**
   - Go to `tennews.ai`
   - First article should have highest score
   - Verify with Supabase data

3. **Check console logs:**
   - Look for "📊 Article score: X/1000" in Step 8 output
   - Verify scores are being calculated

---

## ✅ **Commit Info**

```
commit bd95892
🔧 Fix: Restore article scoring and sort by score (highest first)

Files changed:
- complete_clustered_8step_workflow.py (restored score calculation)
- pages/api/news-supabase.js (fixed sorting to use ai_final_score)
```

---

**Articles are now properly sorted by importance score! Highest quality content always appears first! 🎯**

