# 🧪 Testing the Enhanced Live News Generator

## ✅ All 6 Requirements Implemented

This guide will help you test the new live news system with all features.

---

## 🔧 Pre-Test Checklist

### 1. Verify API Keys
```bash
python3 test-api-keys.py
```

**Expected output:**
```
✅ Claude AI
✅ Google Gemini  
✅ Perplexity AI
✅ NewsAPI (optional)
```

### 2. Ensure Dependencies
```bash
pip3 install -r requirements.txt
```

Make sure these are installed:
- `requests` - HTTP requests
- `beautifulsoup4` - Web scraping (NEW)
- `lxml` - HTML parsing (NEW)
- `google-generativeai` - Gemini AI
- `newsapi-python` - NewsAPI client
- `openai` - Perplexity API
- `pytz` - Timezone handling
- `schedule` - Task scheduling

---

## 🧪 Test 1: Single Run (All Features)

### Command:
```bash
python3 live-news-generator.py
```

### What to Expect:

#### Phase 1: Fetching (30 seconds)
```
🔴 TEN NEWS - LIVE NEWS GENERATOR (ENHANCED)
============================================================
⏰ Tuesday, October 07, 2025 at 18:52 BST
============================================================
📅 Last run: 2025-10-07 18:37:00
📅 Fetching news from last 15 minutes...
   ✅ Found 12 articles since last run
🚨 Searching for breaking news...
   ✅ Found 8 breaking news articles

📊 Total articles collected: 20
```

#### Phase 2: Deduplication (~5 seconds)
```
🔍 Smart deduplication with image optimization...
   📸 Enhanced image for: Apple announces new AI chip...
   📸 Enhanced image for: Climate summit reaches agreement...
   ✅ Reduced from 20 to 15 articles (kept best images)
```

#### Phase 3: Full Text Extraction (2-4 minutes)
```
📖 Extracting full text from 15 articles...
   [1/15] Apple announces new AI chip at event...
      ✅ Extracted 2,345 characters
   [2/15] Climate summit reaches historic agreement...
      ✅ Extracted 3,124 characters
   [3/15] Local festival draws crowds...
      ❌ Skipping - extraction failed
   [4/15] Major earthquake hits Pacific region...
      ✅ Extracted 1,987 characters
   ...

   ✅ Successfully extracted text from 12/15 articles
```

#### Phase 4: AI Scoring (30-60 seconds)
```
🤖 Scoring 12 articles with Gemini AI...
   ✅ Successfully scored 12 articles
   ✅ 8 articles meet quality threshold (7.0+)

📊 Articles meeting quality threshold: 8
📊 Score range: 7.2 - 9.3
```

#### Phase 5: Claude Rewriting (2-3 minutes)
```
✍️  Rewriting 8 articles with Claude AI (40-50 words)...
   [1/8] Apple announces new AI chip at event...
      ✅ Rewritten (47 words)
   [2/8] Climate summit reaches historic agreement...
      ✅ Rewritten (49 words)
   [3/8] Major earthquake hits Pacific region...
      ⚠️ Word count 38 outside range, skipping
   [4/8] Tech startup raises $500M in funding...
      ✅ Rewritten (45 words)
   ...

   ✅ Successfully rewrote 7/8 articles
```

#### Phase 6: Final Output
```
============================================================
✅ SUCCESS! Saved: livenews_data_2025_10_07_1852.json
📰 Total articles: 7
🖼️  Articles with images: 7
📖 All articles have full text extraction
✍️  All articles rewritten by Claude AI (40-50 words)

📊 Category breakdown:
   Technology: 3 articles
   World News: 2 articles
   Business: 2 articles

📊 Top 5 articles by score:
   1. [9.3] 🚀 Apple announces revolutionary AI chip technology...
   2. [8.7] 🌍 Climate summit reaches historic carbon agreement...
   3. [8.2] 💰 Tech startup raises record $500M funding round...
   4. [7.8] 🏆 Olympic athlete breaks 100m world record...
   5. [7.5] ⚡ Energy crisis sparks European policy shift...

⏰ Next run will fetch news from: 2025-10-07 18:52:00
============================================================
```

### Total Time: **8-10 minutes**

---

## 🧪 Test 2: Verify Output File

### Check the generated file:
```bash
ls -lh livenews_data_*.json
```

### View the file:
```bash
cat livenews_data_2025_10_07_1852.json | python3 -m json.tool | head -n 50
```

### Expected Structure:
```json
{
  "generatedAt": "2025-10-07T18:52:30.123456",
  "generatedAtUK": "2025-10-07T18:52:30.123456+01:00",
  "displayTimestamp": "Tuesday, October 07, 2025 at 18:52 BST",
  "totalArticles": 7,
  "source": "NewsAPI Live Feed (Enhanced)",
  "quality_threshold": 7.0,
  "features": [
    "Full text extraction",
    "Time-based filtering",
    "Smart image selection",
    "AI importance scoring",
    "Unlimited emoji selection",
    "Claude AI rewriting (40-50 words)"
  ],
  "articles": [
    {
      "title": "Apple announces revolutionary AI chip technology",
      "description": "Tech giant unveils new breakthrough in artificial intelligence...",
      "url": "https://...",
      "urlToImage": "https://...",
      "publishedAt": "2025-10-07T18:45:00Z",
      "source": {
        "id": "techcrunch",
        "name": "TechCrunch"
      },
      "author": "John Smith",
      "content": "...",
      "full_text": "Apple today announced...",
      "full_text_length": 2345,
      "importance": 9,
      "world_relevance": 8,
      "interestingness": 10,
      "overall_score": 9.3,
      "emoji": "🚀",
      "category": "Technology",
      "ai_reasoning": "Revolutionary tech announcement with global impact",
      "rewritten_text": "Apple unveiled groundbreaking AI chip technology today, promising 10x performance improvements. The new M4 chip integrates advanced neural engines capable of processing complex AI models on-device. Industry experts predict this will reshape mobile computing landscape.",
      "word_count": 47
    }
  ]
}
```

### Verify Each Article Has:
- ✅ `full_text` (300+ characters)
- ✅ `full_text_length` (number)
- ✅ `importance` (1-10)
- ✅ `world_relevance` (1-10)
- ✅ `interestingness` (1-10)
- ✅ `overall_score` (7.0+)
- ✅ `emoji` (could be any emoji, not just category-based)
- ✅ `category` (AI-assigned)
- ✅ `rewritten_text` (40-50 words)
- ✅ `word_count` (40-50)

---

## 🧪 Test 3: Time-Based Filtering

### Run #1:
```bash
python3 live-news-generator.py
```
**Expected:** Fetches news from last 15 minutes (default)

### Wait 10 minutes, then Run #2:
```bash
python3 live-news-generator.py
```
**Expected:** "Fetching news from last 10 minutes..."

### Check timestamp file:
```bash
cat livenews_last_run.json
```

**Should show:**
```json
{"last_run": "2025-10-07T18:52:30.123456"}
```

---

## 🧪 Test 4: Zero Articles Case

If no quality articles are found (score < 7.0), the system should:

1. ✅ Output an empty JSON file
2. ✅ Still update the timestamp
3. ✅ Show clear message

**Expected output:**
```
📊 Articles meeting quality threshold: 0
❌ No articles meet quality threshold!
📄 Saving empty result file...
✅ SUCCESS! Saved: livenews_data_2025_10_07_1900.json
```

**Empty file contents:**
```json
{
  "generatedAt": "2025-10-07T19:00:00.123456",
  "displayTimestamp": "Tuesday, October 07, 2025 at 19:00 BST",
  "totalArticles": 0,
  "articles": []
}
```

---

## 🧪 Test 5: Complete Pipeline with Research Enhancement

### Step 1: Generate live news
```bash
python3 live-news-generator.py
```
**Output:** `livenews_data_2025_10_07_1852.json`

### Step 2: Enhance with research
```bash
python3 news-research-enhancer.py livenews_data_2025_10_07_1852.json
```
**Output:** `livenews_data_2025_10_07_1852_enhanced.json`

### Expected Enhancement:
- ✅ Bold markup on key terms
- ✅ 3 verified details with numbers/dates
- ✅ Timeline with 2-4 events
- ✅ Citations from reputable sources

---

## 🐛 Troubleshooting

### Issue: "No articles with full text!"
**Cause:** Web scraping failed for all articles
**Solutions:**
1. Check internet connection
2. Some websites block scrapers - normal to skip some
3. If ALL fail, websites might have changed their HTML structure

### Issue: "No articles meet quality threshold!"
**Cause:** All articles scored below 7.0
**Expected:** This is normal - system prioritizes quality over quantity
**Action:** Empty file is valid output

### Issue: "Gemini API error"
**Cause:** Google API key issue
**Solutions:**
1. Verify `GOOGLE_API_KEY` is exported
2. Check Gemini API quota/limits
3. Verify billing is enabled (if required)

### Issue: "NewsAPI error 429"
**Cause:** Rate limit reached
**Solutions:**
1. Free tier: 100 requests/day
2. Wait for rate limit reset
3. Upgrade to paid plan

### Issue: Rewriting takes too long
**Expected:** 1 second per article for rate limiting
**Normal:** 7-10 articles = 7-10 minutes total
**Action:** This is intentional to respect API limits

---

## ✅ Success Criteria

Your test is successful if:

1. ✅ All 6 requirements execute without errors
2. ✅ Output JSON file is generated
3. ✅ All articles have scores ≥ 7.0
4. ✅ All articles have `full_text` field
5. ✅ All articles have `rewritten_text` (40-50 words)
6. ✅ All articles have custom emojis
7. ✅ Timestamp file is updated
8. ✅ Next run fetches only new articles

---

## 📊 Performance Benchmarks

| Metric | Expected Value |
|--------|---------------|
| **Total Time** | 8-10 minutes |
| **Articles Fetched** | 10-100 (variable) |
| **After Deduplication** | 5-50 |
| **After Text Extraction** | 3-30 (some fail) |
| **After AI Scoring** | 1-20 (only 7.0+) |
| **Final Output** | 0-20 articles |
| **Success Rate** | Full text: 60-80%, Rewrite: 90-95% |

---

## 🎯 Next Steps

After successful testing:

1. ✅ Run `news-research-enhancer.py` to add bold, details, timeline, citations
2. ✅ Integrate output JSON with your website (pages/index.js)
3. ✅ Set up automated scheduling (cron job / schedule library)
4. ✅ Monitor costs and adjust frequency as needed

---

## 💡 Tips

- **First run:** Might take longer as it builds the pipeline
- **Subsequent runs:** Faster as it only processes new articles
- **Empty results:** Normal during slow news periods
- **Quality over quantity:** 5 amazing articles > 50 mediocre ones
- **Cost optimization:** Run every 15-30 minutes during peak hours, hourly during off-peak

---

Ready to test? Run:
```bash
python3 live-news-generator.py
```

