# 🔢 Article Scoring & Sorting Fixed

## Date: November 20, 2025 - 22:15

---

## 🚨 **Issue Reported**

Articles on tennews.ai were not displayed in order of importance. User expected:
- Highest scored article first
- Next highest scored article second
- And so on...
- When user reads an article, next highest unread article should appear

**What was happening:**
- Articles displayed by creation date (newest first)
- Score was ignored
- Less important recent articles appeared before important older articles

---

## 🔍 **Root Cause**

### **Problem 1: No Score Calculation**
```python
# Published articles had NO score saved
article_data = {
    'cluster_id': cluster_id,
    'url': cluster_sources[0]['url'],
    'title_news': synthesized['title_news'],
    ...
    # ❌ Missing: ai_final_score
}
```

### **Problem 2: Wrong Sort Order in API**
```javascript
// pages/api/news-supabase.js (line 33)
.order('created_at', { ascending: false })  // ❌ Sort by date, not score!
```

---

## ✅ **Solution Applied**

### **1. Calculate Cluster Score (Step 8)**

Added intelligent score calculation based on:
- **Source scores** (from Step 1 Gemini scoring)
- **Number of sources** (more sources = more important)

**Formula:**
```
cluster_score = avg(source_scores) + min(num_sources × 10, 100)
Max: 1000 points
```

**Code Added:**
```python
# Calculate cluster score
source_scores = [s.get('score', 0) for s in cluster_sources if s.get('score')]
if source_scores:
    avg_score = sum(source_scores) / len(source_scores)
    source_bonus = min(len(cluster_sources) * 10, 100)  # Bonus for multiple sources
    cluster_score = min(int(avg_score + source_bonus), 1000)
else:
    cluster_score = min(500 + (len(cluster_sources) * 50), 1000)
```

---

### **2. Save Score to Database**

Added `ai_final_score` field:
```python
article_data = {
    ...
    'ai_final_score': cluster_score,  # ✅ Now saved!
    ...
}
```

---

### **3. Update API Sorting**

Changed API to sort by score:
```javascript
// BEFORE:
.order('created_at', { ascending: false })

// AFTER:
.order('ai_final_score', { ascending: false, nullsFirst: false })  // Primary: Score
.order('created_at', { ascending: false })  // Secondary: Date
```

---

## 📊 **Score Calculation Examples**

### **Example 1: Breaking News (5 sources)**
```
Source 1: 900 points (Reuters)
Source 2: 850 points (BBC)
Source 3: 820 points (Al Jazeera)
Source 4: 800 points (CNN)
Source 5: 780 points (Bloomberg)

Average: (900 + 850 + 820 + 800 + 780) / 5 = 830
Bonus: 5 sources × 10 = +50 points
Final Score: 830 + 50 = 880/1000 ✨
```

### **Example 2: Major Event (10 sources)**
```
Average score: 750
Bonus: 10 sources × 10 = +100 points (capped at 100)
Final Score: 750 + 100 = 850/1000 ✨
```

### **Example 3: Exclusive Story (1 source)**
```
Source 1: 950 points (high-quality exclusive)
Bonus: 1 source × 10 = +10 points
Final Score: 950 + 10 = 960/1000 ✨
```

### **Example 4: Moderate News (3 sources)**
```
Average score: 720
Bonus: 3 sources × 10 = +30 points
Final Score: 720 + 30 = 750/1000
```

---

## 📈 **Scoring Logic**

### **Why This Formula Works:**

**Base Score (Source Average):**
- Reflects content quality (from Step 1 Gemini scoring)
- Higher = more newsworthy, relevant, timely

**Source Count Bonus (+10 per source, max +100):**
- More sources = more important event
- Rewards stories covered by multiple outlets
- Caps at +100 to prevent overwhelming base score

**Combined Result:**
- Single high-quality source: 850 + 10 = 860
- Multiple medium sources: 720 + 50 = 770
- Major breaking news: 750 + 100 = 850

---

## 🎯 **Display Order Now**

### **Before (Sorted by Date):**
```
1. Article from 2 min ago (score: 650) ← Shown first (newest)
2. Article from 5 min ago (score: 850)
3. Article from 10 min ago (score: 920) ← Most important, but last!
```

### **After (Sorted by Score):**
```
1. Article with score 920 ← Most important shown first! ✅
2. Article with score 850
3. Article with score 650
```

---

## 🔄 **User Experience Flow**

### **Feed Display:**
1. User opens tennews.ai
2. **Highest scored article (e.g., 920) appears first**
3. User swipes down
4. **Next highest scored article (e.g., 850) appears**
5. User swipes down
6. **Third highest scored article (e.g., 750) appears**
7. And so on...

### **After Reading:**
When user reads an article, the reading tracker marks it as read, and the next unread article (by score) will appear on next visit.

---

## 📊 **API Response Structure**

### **API Query (Updated):**
```javascript
const { data: articles } = await supabase
  .from('published_articles')
  .select('*')
  .gte('created_at', twentyFourHoursAgo)
  .order('ai_final_score', { ascending: false, nullsFirst: false })  // 1st: Score ✅
  .order('created_at', { ascending: false })  // 2nd: Date
  .limit(500)
```

### **Returned Articles (in order):**
```json
[
  { "id": 1, "title": "...", "ai_final_score": 920, "created_at": "10 min ago" },
  { "id": 2, "title": "...", "ai_final_score": 850, "created_at": "5 min ago" },
  { "id": 3, "title": "...", "ai_final_score": 750, "created_at": "15 min ago" },
  { "id": 4, "title": "...", "ai_final_score": 650, "created_at": "2 min ago" }
]
```

---

## ⚙️ **Technical Details**

### **Handling NULL Scores:**

Old articles (created before this update) might have `ai_final_score = NULL`.

**Solution:**
```javascript
.order('ai_final_score', { ascending: false, nullsFirst: false })
```

- `nullsFirst: false` → NULL scores appear LAST
- These old articles won't clutter the top of the feed
- New articles with calculated scores take priority

### **Secondary Sort (Date):**

For articles with the **same score**:
```javascript
.order('created_at', { ascending: false })
```

- Among equal scores, newest appears first
- Example: Two 850-scored articles → newer one first

---

## 🚀 **Testing**

### **Verify in Next Run:**

Pull and restart the system:
```bash
cd "/Users/omersogancioglu/Ten news website "
git pull origin main

# Stop current system (Ctrl+C), then restart:
./RUN_LIVE_CLUSTERED_SYSTEM.sh
```

### **What to Check:**

1. **In Terminal Output (Step 8):**
```
💾 STEP 8: PUBLISHING TO SUPABASE
   Cluster score: 850/1000 (from 5 sources)  ← Should see this!
   ✅ Published article ID: 123
```

2. **In Supabase (published_articles table):**
- New articles should have `ai_final_score` column filled
- Values should be 500-1000

3. **On tennews.ai:**
- Highest scored article appears first
- Scroll/swipe to see articles in descending score order
- Less important articles appear later

---

## 📝 **Future Improvements**

### **Potential Enhancements:**

1. **Time Decay:**
```python
# Reduce score for older articles
hours_old = (now - created_at).total_seconds() / 3600
decay_factor = max(0.5, 1 - (hours_old / 24) * 0.5)  # 50% decay over 24h
final_score = cluster_score * decay_factor
```

2. **Category Weighting:**
```python
# Boost certain categories
category_multipliers = {
    'International': 1.2,
    'Business': 1.1,
    'Tech': 1.1,
    'Other': 1.0
}
final_score = cluster_score * category_multipliers.get(category, 1.0)
```

3. **User Personalization:**
```javascript
// Boost scores based on user reading history
if (user.preferredCategories.includes(article.category)) {
  article.final_score *= 1.15
}
```

---

## ✅ **Commit Info**

```
commit d1896a3
🔢 Fix: Sort articles by score (highest first) instead of date

Files changed:
- complete_clustered_8step_workflow.py (added score calculation, +13 lines)
- pages/api/news-supabase.js (updated sort order, +2 lines)
```

---

## 🎉 **Result**

✅ **Most important articles appear first**  
✅ **Score-based ranking (not just chronological)**  
✅ **Multi-source stories ranked higher**  
✅ **Breaking news with many sources prioritized**  
✅ **User sees highest quality content first**  

---

**Articles are now displayed by importance, not just recency! The most important news always appears first! 🎯**

