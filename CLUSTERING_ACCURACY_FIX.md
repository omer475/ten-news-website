# Clustering Accuracy Fix

## 🚨 Problem Identified

The clustering algorithm was matching **completely unrelated articles** together:

### Examples of BAD Matches:
1. ❌ **"Ukraine-Russia war"** → matched to **"Asus Router Flaws"**
2. ❌ **"US hands Ukraine peace plan"** → matched to **"Asus Router Flaws"**  
3. ❌ **"Biotech Stock 96% gain"** → matched to **"Walmart Earnings"**

**Root Cause:** The algorithm only required **3 shared keywords** to match articles, even if titles were 0% similar.

---

## ✅ Solution Implemented

### Changes to `step1_5_event_clustering.py`:

### 1. **Stricter Thresholds**

**Before:**
```python
TITLE_SIMILARITY_THRESHOLD = 0.75  # 75% title similarity = same event
KEYWORD_MATCH_THRESHOLD = 3        # 3+ shared keywords = same event
```

**After:**
```python
TITLE_SIMILARITY_THRESHOLD = 0.75  # 75% title similarity = same event (strong match)
MIN_TITLE_SIMILARITY = 0.35        # Minimum 35% title similarity even with keyword match (NEW)
KEYWORD_MATCH_THRESHOLD = 5        # 5+ shared keywords = same event (increased from 3)
ENTITY_MATCH_THRESHOLD = 2         # 2+ shared entities adds confidence (NEW)
```

### 2. **Improved Matching Logic**

**New 3-tier matching system:**

#### Tier 1: **STRONG MATCH** (Title similarity ≥ 75%)
- Articles with very similar titles → always match
- Example: "Biden announces climate plan" vs "Biden unveils climate initiative"

#### Tier 2: **MODERATE MATCH** (Title ≥ 35% + 5+ shared keywords)
- Articles with somewhat similar titles AND significant keyword overlap
- Example: "Tesla stock surges 15%" vs "Tesla shares jump on earnings beat"  
- **CRITICAL:** Now requires minimum 35% title similarity (prevents "Ukraine war" matching "Router flaws")

#### Tier 3: **ENTITY MATCH** (Title ≥ 35% + 2+ shared entities)
- Articles mentioning the same people/places/organizations
- Example: "Elon Musk announces new project" vs "Musk unveils Tesla innovation"
- **CRITICAL:** Also requires 35% minimum title similarity

### 3. **Debug Logging**

The algorithm now prints **why** articles match:

**Output Examples:**

✅ **Strong Match:**
```
✅ STRONG MATCH: Title similarity 82% >= 75%
✓ Added to cluster: Tesla Stock Surge
```

✅ **Moderate Match:**
```
✅ MODERATE MATCH: Title 48%, Keywords: 5/5 (stock, surges, earnings, tesla, shares...)
✓ Added to cluster: Tesla Stock Surge
```

❌ **Rejected (too different):**
```
❌ REJECTED: Title similarity 12% < minimum 35%
✨ Created new cluster: Ukraine Peace Plan
```

❌ **Rejected (insufficient overlap):**
```
❌ NO MATCH: Title 25%, Keywords: 2, Entities: 0
✨ Created new cluster: Router Security Flaw
```

---

## 📊 Expected Impact

### Before Fix:
- Articles with **0-20% title similarity** could match if they shared 3 common words
- Many false positives (unrelated articles clustered together)
- User reported: "percentage of topic keyword similarity is so low"

### After Fix:
- **Minimum 35% title similarity** required for ANY match
- **5+ keywords** (up from 3) required for keyword-based matching
- **2+ entities** can trigger a match (captures person/place/org-based stories)
- Debug output shows exact matching criteria

### Impact on Clustering:
- ✅ Fewer false positives (unrelated articles won't match)
- ✅ More new clusters created (as intended)
- ✅ Better quality synthesized articles (sources are actually related)
- ⚠️  Slightly more clusters overall (acceptable tradeoff for accuracy)

---

## 🧪 How to Test

### Step 1: Run the system again

```bash
cd "/Users/omersogancioglu/Ten news website " && ./RUN_LIVE_CLUSTERED_SYSTEM.sh
```

### Step 2: Watch the clustering output

Look for the new debug messages in **Step 1.5: Event Clustering**:

```
[1/10] Processing: Ukraine-Russia war latest...
  ❌ REJECTED: Title similarity 12% < minimum 35%
  ✨ Created new cluster: Ukraine-Russia War Latest

[2/10] Processing: Ukraine peace plan announced...
  ✅ STRONG MATCH: Title similarity 78% >= 75%
  ✓ Added to cluster: Ukraine-Russia War Latest
```

### Step 3: Verify NO bad matches

You should **NOT** see:
- Ukraine articles matching tech articles
- Finance articles matching science articles
- Completely unrelated topics being clustered

---

## 📈 Technical Details

### Matching Algorithm Pseudocode:

```python
def is_same_event(article, cluster):
    # Step 1: Check time (within 24 hours)
    if time_difference > 24_hours:
        return False
    
    # Step 2: Calculate title similarity
    title_sim = calculate_similarity(article.title, cluster.title)
    
    # Strong match: High title similarity
    if title_sim >= 75%:
        return True  # ✅ STRONG MATCH
    
    # Minimum title similarity required
    if title_sim < 35%:
        return False  # ❌ TOO DIFFERENT
    
    # Step 3: Check keyword/entity overlap
    shared_keywords = article.keywords ∩ cluster.keywords
    shared_entities = article.entities ∩ cluster.entities
    
    # Moderate match: Good keyword overlap
    if len(shared_keywords) >= 5:
        return True  # ✅ MODERATE MATCH
    
    # Entity match: Shared named entities
    if len(shared_entities) >= 2:
        return True  # ✅ ENTITY MATCH
    
    return False  # ❌ NO MATCH
```

---

## 🔧 Files Changed

1. `step1_5_event_clustering.py`
   - Updated `ClusteringConfig` thresholds (lines 27-36)
   - Rewrote `is_same_event()` function (lines 215-281)
   - Added debug logging to clustering loop (lines 589-603)

---

## 🚀 Next Steps

1. **Monitor the next cycle** - The debug output will show WHY articles match/don't match
2. **Adjust thresholds if needed**:
   - If too many new clusters → lower `MIN_TITLE_SIMILARITY` to 30%
   - If still seeing bad matches → increase `KEYWORD_MATCH_THRESHOLD` to 6
3. **Check published articles** - Quality should improve significantly

---

## 💡 Key Improvements

| Metric | Before | After | Impact |
|--------|--------|-------|--------|
| **Minimum Title Similarity** | 0% (none) | **35%** | ✅ Prevents unrelated matches |
| **Keyword Threshold** | 3 keywords | **5 keywords** | ✅ More overlap required |
| **Entity Matching** | Not used | **2+ entities** | ✅ Better person/place/org clustering |
| **Debug Visibility** | None | **Full logging** | ✅ Can diagnose issues |

---

**The clustering should now be MUCH more accurate! 🎯**

