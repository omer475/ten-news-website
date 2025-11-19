# Step 5 Dual-Language Architecture

## 📅 Date: November 19, 2024

## 🎯 Major Change: Moved Dual-Language Generation to Step 5

### **Why This Change Was Made**

**Problem with Previous Architecture:**
- **Step 2.5**: Generated `title_news`, `title_b2`, `content_news`, `content_b2`, `summary_bullets_news`, `summary_bullets_b2` using ONLY raw article text
- **Step 5**: Generated separate `title`, `detailed_text`, `summary_bullets` + `timeline`, `details`, `graph` using Perplexity context
- This created **duplicate content** and wasted API calls
- Step 5 had better context from Perplexity but couldn't use it for the main content

**New Architecture:**
- **Step 5 ONLY**: Generates ALL content in one comprehensive Claude call
- Uses Perplexity context data for better quality
- No more duplicate content generation
- Simpler workflow

---

## 🔄 What Changed

### **Removed:**
- ❌ Step 2.5 from `live_news_system.py` (dual-language generation)
- ❌ Step 3.5 from `live_news_system.py` (filtering for dual-language completeness)
- ❌ Import of `claude_write_title_summary` from `step1_claude_title_summary.py`
- ❌ Old fields: `title`, `detailed_text`, `summary_bullets`

### **Added/Modified:**
- ✅ Step 5 now generates 6 dual-language fields:
  - `title_news` (Advanced, ≤12 words)
  - `title_b2` (B2 English, ≤12 words)
  - `content_news` (Advanced, 300-400 words)
  - `content_b2` (B2 English, 300-400 words)
  - `summary_bullets_news` (Advanced, 4 bullets, 10-15 words each)
  - `summary_bullets_b2` (B2 English, 4 bullets, 10-15 words each)
- ✅ Plus existing components: `timeline`, `details`, `graph`
- ✅ Increased `max_tokens` to 4096 (was 2048)
- ✅ Updated validation to check for dual-language fields

---

## 📋 Step 5 Prompt Rules

### **TITLE_NEWS (Advanced)**
- Maximum 12 words
- Professional journalism tone (BBC, Reuters, NYT)
- **Bold markup**: 1-3 key terms
- Example: "**European Central Bank** raises interest rates to **4.5 percent**"

### **TITLE_B2 (B2 English)**
- Maximum 12 words
- Simpler language, same information
- **Bold markup**: 1-3 key terms
- Example: "**European Central Bank** increases **interest rates** to **4.5 percent**"

### **CONTENT_NEWS (Advanced)**
- **300-400 words** (was 200)
- Professional journalism tone
- Complex vocabulary allowed
- **Bold markup** throughout for important terms

### **CONTENT_B2 (B2 English)**
- **300-400 words** (same length as Advanced)
- Simpler sentence structures
- More common vocabulary (but NOT "too easy")
- Words like "interest", "inflation" are fine
- **Bold markup** throughout for important terms

### **SUMMARY_BULLETS_NEWS (Advanced)**
- Exactly 4 bullets
- **10-15 words per bullet** (was 10-17)
- Professional news language
- **Bold markup**: 1-2 key terms per bullet

### **SUMMARY_BULLETS_B2 (B2 English)**
- Exactly 4 bullets
- **10-15 words per bullet**
- Simpler language, same information
- **Bold markup**: 1-2 key terms per bullet

### **Timeline, Details, Graph** (unchanged)
- Generated if selected by Gemini in Step 3
- Uses Perplexity context data

---

## 🔍 Validation

Step 5 now validates:
- ✅ All 6 dual-language fields present
- ✅ Titles: ≤12 words each
- ✅ Content: 300-400 words each (with 10% buffer = 450 max)
- ✅ Bullets: Exactly 4 each, 10-15 words per bullet
- ✅ Timeline: 2-4 events (if selected)
- ✅ Details: Exactly 3 with numbers (if selected)
- ✅ Graph: At least 4 data points (if selected)

---

## 📊 Workflow Summary

### **OLD Workflow:**
```
Step 1: Gemini Scoring
Step 2: ScrapingBee Fetching
Step 2.5: Claude Dual-Language Generation ← REMOVED
Step 3: Gemini Component Selection
Step 4: Perplexity Context Search
Step 5: Claude Final Writing (single language)
Step 3.5: Filter for Dual-Language Completeness ← REMOVED
Step 4: Publish to Supabase
```

### **NEW Workflow:**
```
Step 1: Gemini Scoring
Step 2: ScrapingBee Fetching
Step 3: Gemini Component Selection
Step 4: Perplexity Context Search
Step 5: Claude Final Writing (DUAL-LANGUAGE + Components) ← EXPANDED
Step 4: Publish to Supabase
```

---

## 🎨 Benefits

1. **Better Quality**: Step 5 has Perplexity context data for all content
2. **Simpler Architecture**: One writing step instead of two
3. **No Duplicate Content**: No more separate `title`/`detailed_text`/`summary_bullets` fields
4. **Lower Cost**: One API call per article instead of two
5. **More Reliable**: No filtering needed - either article is fully generated or fails completely

---

## 🚀 Testing

To test the new system:

```bash
cd "/Users/omersogancioglu/Ten news website "
./RUN_LIVE_CONTINUOUS_SYSTEM.sh
```

Expected output:
```
Step 1: Gemini scoring & filtering...
Step 2: ScrapingBee full article fetching...
Step 3: Gemini component selection...
Step 4: Perplexity context search...
Step 5: Claude final writing...  ← Now generates dual-language content
Publishing to Supabase...
```

Each article should have:
- `title_news` and `title_b2`
- `content_news` (300-400 words) and `content_b2` (300-400 words)
- `summary_bullets_news` and `summary_bullets_b2` (4 bullets each)
- `timeline`, `details`, or `graph` (if selected)

---

## 📝 Files Modified

1. **`step5_claude_final_writing_formatting.py`**
   - Updated prompt to include dual-language rules
   - Changed output JSON format
   - Updated validation
   - Increased max_tokens to 4096
   - Removed code that "preserved" dual-language fields from Step 2.5

2. **`live_news_system.py`**
   - Removed Step 2.5 (dual-language generation)
   - Removed Step 3.5 (filtering)
   - Removed import of `claude_write_title_summary`
   - Updated cycle summary

---

## ✅ Status

- ✅ Architecture updated
- ✅ Prompt updated with dual-language rules
- ✅ Validation updated
- ✅ Workflow simplified
- ✅ Changes deployed to GitHub
- 🔄 Ready for testing

---

**Next:** Run live news system and verify that all articles get dual-language content in Step 5.

