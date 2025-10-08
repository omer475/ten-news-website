# TEN NEWS - LIVE NEWS GENERATOR REQUIREMENTS

## 🎯 Implementation Status: **ALL 6 REQUIREMENTS COMPLETED**

---

## ✅ Requirement 1: Full Text Extraction

**Status:** ✅ **IMPLEMENTED**

### What it does:
- Extracts complete article text from every news URL using web scraping
- Uses BeautifulSoup to parse HTML and extract main article content
- Tries multiple content selectors to find article body
- Validates that extracted text is substantial (minimum 300 characters)

### Technical Details:
- **Function:** `extract_full_text(url, timeout=10)`
- **Library:** BeautifulSoup4 + requests
- **Validation:** Articles without extractable full text are **automatically skipped**
- **Character Limit:** 5000 characters max per article
- **Timeout:** 10 seconds per URL

### Why it matters:
- The Claude AI rewriting (Requirement 6) needs full text to create accurate 40-50 word summaries
- Ensures high-quality content based on complete information, not just headlines

---

## ✅ Requirement 2: Time-Based Filtering

**Status:** ✅ **IMPLEMENTED**

### What it does:
- Tracks the exact timestamp of the last generator run
- Fetches news **only from the time period since last run**
- If it ran 15 minutes ago, it fetches news from the last 15 minutes
- If it ran 2 hours ago, it fetches news from the last 2 hours

### Technical Details:
- **Timestamp File:** `livenews_last_run.json` (stores last run time)
- **Functions:** 
  - `get_last_run_time()` - retrieves last run timestamp
  - `save_last_run_time()` - updates timestamp after each run
  - `fetch_newsapi_since_last_run(last_run_time)` - fetches news since last run
- **Default:** If no previous run found, defaults to last 15 minutes
- **API Parameter:** Uses NewsAPI `from` parameter with exact timestamp

### Why it matters:
- Prevents duplicate content between consecutive runs
- Ensures truly "live" news that's fresh and relevant
- Optimizes API usage by not re-fetching old articles

---

## ✅ Requirement 3: Smart Image Selection

**Status:** ✅ **IMPLEMENTED**

### What it does:
- When duplicate articles are found, it intelligently selects the best one
- **Key Innovation:** If the best article doesn't have an image, it takes the image from other duplicate articles
- Ensures every quality article gets the best available image

### Technical Details:
- **Function:** `smart_deduplicate_with_best_images(articles)`
- **Deduplication Algorithm:**
  1. Groups articles by title similarity (>60% word overlap)
  2. Collects ALL images from duplicate group
  3. Selects best article by content quality
  4. If best article has no image, assigns best available image from group
- **Source Priority:** Reuters, BBC News, Bloomberg ranked higher

### Example Scenario:
```
Article A: "Apple Announces New iPhone" (great content, NO image)
Article B: "Apple's New iPhone Launch" (mediocre content, HAS image)
Article C: "iPhone Released by Apple" (poor content, HAS image)

Result: Article A (best content) + Image from Article B = Perfect Article
```

### Why it matters:
- Visual content is crucial for user engagement
- Combines best writing with best imagery
- Maximizes the quality of both text and visuals

---

## ✅ Requirement 4: AI-Based Importance Scoring

**Status:** ✅ **IMPLEMENTED**

### What it does:
- Uses Gemini AI to score every article on 3 dimensions:
  1. **Importance** (1-10): How significant is this news?
  2. **World Relevance** (1-10): How relevant to global audience?
  3. **Interestingness** (1-10): How engaging is the story?
- Calculates weighted overall score
- **Only articles scoring 7.0+ are included**

### Technical Details:
- **AI Model:** Gemini 1.5 Flash (fast, cost-effective)
- **Function:** `score_articles_with_gemini(articles)`
- **Scoring Formula:** 
  ```
  Overall Score = (Importance × 40%) + (World Relevance × 30%) + (Interestingness × 30%)
  ```
- **Quality Threshold:** 7.0/10.0
- **Processing:** Batch scoring (up to 50 articles at once)

### Article Selection Priority:
- **NOT by recency** (newest first) ❌
- **BY importance, world relevance, and interestingness** ✅
- Articles sorted by overall score (highest first)

### Why it matters:
- Ensures only high-quality, important news makes it to the website
- Filters out minor updates, local news, and uninteresting stories
- Focuses on what matters most to a global audience

---

## ✅ Requirement 5: Unlimited Emoji Selection

**Status:** ✅ **IMPLEMENTED**

### What it does:
- AI selects the **single best emoji** from ALL available emojis
- Not limited to predefined category emojis (🌍 🏢 💻 🔬 etc.)
- Can choose any emoji that perfectly captures the story's essence

### Technical Details:
- **AI Model:** Gemini 1.5 Flash
- **Selection Criteria:** "Choose the SINGLE BEST emoji from ALL available emojis that perfectly captures the essence of the story"
- **Examples from AI:**
  - 🚨 Breaking news / urgent alerts
  - 🏆 Achievements / victories
  - 💰 Financial news / money
  - 🌍 Global events
  - ⚡ Energy / power / speed
  - 🎯 Targeted actions / focus
  - 🔥 Trending / hot topics
  - 🚀 Innovation / launches
  - ⚠️ Warnings / caution
  - 🎭 Entertainment / drama

### Old Way (Limited):
```
Category: Technology → 💻 (always)
Category: World News → 🌍 (always)
```

### New Way (Unlimited):
```
"Apple's Revolutionary AI Chip" → 🚀 (innovation)
"Market Crash Concerns Rise" → ⚠️ (warning)
"Tech Startup Raises $1B" → 💰 (money)
"Viral Video Breaks Records" → 🔥 (trending)
```

### Why it matters:
- More expressive and engaging for users
- Better captures the nuance of each story
- Makes the news feed more visually interesting

---

## ✅ Requirement 6: Claude AI Rewriting (Phase A.5)

**Status:** ✅ **IMPLEMENTED**

### What it does:
- After all filtering and scoring, Claude AI rewrites each article
- **Strict requirement:** 40-50 words exactly
- AI reads the **full extracted text** (not just headlines)
- Produces professional, engaging news summaries

### Technical Details:
- **AI Model:** Claude 3.5 Sonnet (latest version)
- **Function:** `rewrite_article_with_claude(article)`
- **Input:** Full article text (up to 3000 characters)
- **Output:** 40-50 word summary
- **Validation:** Word count strictly checked (40 ≤ words ≤ 50)
- **Rate Limiting:** 1 second delay between requests
- **Filtering:** Articles with failed rewrites are automatically removed

### Process Flow:
```
1. Article has full text (Requirement 1) ✓
2. Article scored 7.0+ (Requirement 4) ✓
3. Claude reads full text
4. Claude writes 40-50 word summary
5. Word count validated
6. Article kept only if rewrite successful
```

### Why it matters:
- Ensures consistent, high-quality writing across all articles
- Summaries based on full content, not just headlines
- Professional tone suitable for news website
- Perfect length for quick reading

---

## 🔄 Complete Pipeline Flow

```
📥 STEP 1: Fetch News
   └─ Get articles since last run (Requirement 2)
   └─ Include breaking news from last 2 hours

📝 STEP 2: Process Articles
   └─ Clean and validate data
   └─ Remove invalid articles

🔍 STEP 3: Smart Deduplication
   └─ Group similar articles (Requirement 3)
   └─ Select best content + best image

📖 STEP 4: Full Text Extraction
   └─ Scrape article content from URLs (Requirement 1)
   └─ Skip articles without extractable text

🤖 STEP 5: AI Scoring
   └─ Score on importance + world relevance + interestingness (Requirement 4)
   └─ Select best emoji from all available (Requirement 5)
   └─ Filter: only keep articles with score ≥ 7.0

✍️ STEP 6: Claude AI Rewriting
   └─ Rewrite each article: 40-50 words (Requirement 6)
   └─ Skip articles with failed rewrites

💾 STEP 7: Save & Update
   └─ Save JSON file with all articles
   └─ Update last run timestamp
```

---

## 📊 Expected Results

### Quality Metrics:
- ✅ **All articles** have full extracted text
- ✅ **All articles** score 7.0+ on quality
- ✅ **All articles** have AI-rewritten 40-50 word summaries
- ✅ **All articles** have custom-selected emojis
- ✅ **All articles** are from time period since last run
- ✅ **Maximum possible articles** have high-quality images

### Possible Outcomes:
- **Best case:** 20-50 high-quality articles per run
- **Normal case:** 5-20 high-quality articles per run
- **Low activity case:** 0-5 articles (or even 0 if no quality news)
- **Zero articles case:** Empty JSON file generated (valid outcome)

### Time & Cost:
- **Estimated time:** 8-10 minutes per run
- **Estimated cost:** ~$8/month
- **Bottlenecks:**
  - Web scraping (0.5s per article)
  - Claude rewriting (1s per article)
  - Rate limiting for API calls

---

## 🎯 Key Differences from Daily Digest

| Feature | Daily Digest | Live News (Enhanced) |
|---------|-------------|---------------------|
| **Source** | GDELT (free) | NewsAPI (paid) |
| **Schedule** | Once daily | On-demand / continuous |
| **Article Count** | Exactly 10 | Variable (0-50+) based on quality |
| **Selection** | AI picks top 10 | AI filters by 7.0+ threshold |
| **Full Text** | Optional scraping | **Required** - articles without text skipped |
| **Images** | Rarely available | **Smart selection** from duplicates |
| **Time Filtering** | Last 24 hours | **Since last run** (15 min to hours) |
| **Scoring** | Implicit | **Explicit** (3 dimensions + weighted) |
| **Emoji** | Category-based | **Unlimited** - best from all |
| **Rewriting** | Built into main process | **Separate Phase A.5** before enhancement |

---

## 🚀 Usage

### Single Run:
```bash
python3 live-news-generator.py
```

### With Research Enhancement (Complete Pipeline):
```bash
# Step 1: Generate live news
python3 live-news-generator.py

# Step 2: Enhance with research (bold, details, timeline, citations)
python3 news-research-enhancer.py livenews_data_2025_10_07_1234.json
```

### Output Files:
- **Main Output:** `livenews_data_YYYY_MM_DD_HHMM.json`
- **Timestamp Tracker:** `livenews_last_run.json`
- **Enhanced Output:** `livenews_data_YYYY_MM_DD_HHMM_enhanced.json`

---

## ✨ Summary

All 6 requirements have been fully implemented and integrated into a seamless pipeline:

1. ✅ **Full Text Extraction** - Web scraping ensures complete article content
2. ✅ **Time-Based Filtering** - Only fetch news since last run
3. ✅ **Smart Image Selection** - Best content + best image from duplicates
4. ✅ **AI Importance Scoring** - 3-dimensional scoring with 7.0+ threshold
5. ✅ **Unlimited Emoji Selection** - AI picks best emoji from all available
6. ✅ **Claude AI Rewriting** - Professional 40-50 word summaries

The system prioritizes **quality over quantity** - if no articles meet the high standards, it will output zero articles (empty JSON file) rather than publish low-quality content.

