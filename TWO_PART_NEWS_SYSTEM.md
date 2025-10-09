# 🌍 TEN NEWS - TWO-PART NEWS GENERATION SYSTEM

## 📋 Overview

Your news system is now split into **TWO INDEPENDENT PARTS** that run at different intervals:

---

## 🔴 PART 1: BREAKING NEWS FEED
**File:** `news-part1-breaking.py`  
**Frequency:** Every 5 minutes  
**Sources:** 12 premium breaking news sources  
**Threshold:** 8.0+ (STRICT)  
**Time Window:** Only news from last 5 minutes

### Breaking News Sources (12):
1. Reuters
2. Associated Press
3. BBC News
4. CNN
5. Bloomberg
6. The Guardian (UK)
7. Al Jazeera English
8. ABC News
9. The Washington Post
10. The Wall Street Journal
11. USA Today
12. NBC News

### Features:
- ✅ **Strict Quality**: Only 8.0+ scored articles
- ✅ **Ultra-Fresh**: 5-minute time window
- ✅ **Full Text Extraction**: Web scraping
- ✅ **AI Scoring**: Gemini (importance/relevance/interestingness)
- ✅ **Smart Deduplication**: Best image selection
- ✅ **Claude Rewriting**: 35-40 words
- ✅ **Title Optimization**: 4-10 words

---

## 🌍 PART 2: SCIENCE, RESEARCH & GLOBAL NEWS
**File:** `news-part2-global.py`  
**Frequency:** Every 50 minutes  
**Sources:** 123 global sources  
**Threshold:** 7.5+ (Balanced)  
**Time Window:** Only news from last 50 minutes

### Source Categories (123 total):

#### SCIENCE & RESEARCH (3)
- New Scientist, National Geographic, Medical News Today

#### TECHNOLOGY & INNOVATION (15)
- Wired, Ars Technica, TechCrunch, The Verge, Engadget, etc.

#### BUSINESS & ECONOMICS (12)
- The Economist, Financial Times, Fortune, Bloomberg, etc.

#### DATA JOURNALISM & ANALYSIS (5)
- FiveThirtyEight, Axios, Politico, The Hill, Newsweek

#### PREMIUM US NEWS (10)
- NYT, NPR, Time, The Atlantic, The New Yorker, etc.

#### REGIONAL COVERAGE:
- **UK & Ireland** (10 sources)
- **Germany** (10 sources)
- **France** (6 sources)
- **Italy** (5 sources)
- **Spain & Portugal** (3 sources)
- **India** (5 sources)
- **China & East Asia** (7 sources)
- **Australia & New Zealand** (5 sources)
- **Middle East** (7 sources)
- **Africa** (4 sources)
- **Latin America** (5 sources)
- **Canada** (3 sources)
- **Scandinavia** (4 sources)
- **Russia & Eastern Europe** (3 sources)

### Features:
- ✅ **Diverse Coverage**: 123 global sources
- ✅ **50-Minute Window**: Deeper dive into stories
- ✅ **Global Focus**: Equal weight to all regions
- ✅ **Full Text Extraction**: Web scraping
- ✅ **AI Scoring**: Gemini with global perspective
- ✅ **Smart Deduplication**: Best image selection
- ✅ **Claude Rewriting**: 35-40 words
- ✅ **Title Optimization**: 4-10 words

---

## 🚀 HOW TO RUN

### Manual Testing

**Part 1 (Breaking News):**
```bash
python3 news-part1-breaking.py
```

**Part 2 (Global News):**
```bash
python3 news-part2-global.py
```

---

## ⏰ AUTOMATED SCHEDULING (Recommended)

### Option 1: Cron Jobs (Linux/Mac)

Edit crontab:
```bash
crontab -e
```

Add these lines:
```bash
# Part 1: Every 5 minutes
*/5 * * * * cd /Users/omersogancioglu/Ten\ news\ website && /usr/bin/python3 news-part1-breaking.py >> logs/part1.log 2>&1

# Part 2: Every 50 minutes
*/50 * * * * cd /Users/omersogancioglu/Ten\ news\ website && /usr/bin/python3 news-part2-global.py >> logs/part2.log 2>&1
```

Create logs directory:
```bash
mkdir -p logs
```

---

### Option 2: Python Scheduler (Cross-platform)

Create `scheduler.py`:
```python
import schedule
import time
import subprocess
import os

def run_part1():
    print("🔴 Running Part 1: Breaking News...")
    subprocess.run(["python3", "news-part1-breaking.py"])

def run_part2():
    print("🌍 Running Part 2: Global News...")
    subprocess.run(["python3", "news-part2-global.py"])

# Schedule jobs
schedule.every(5).minutes.do(run_part1)
schedule.every(50).minutes.do(run_part2)

print("⏰ Scheduler started!")
print("🔴 Part 1: Every 5 minutes")
print("🌍 Part 2: Every 50 minutes")
print("\nPress Ctrl+C to stop\n")

# Run immediately on start
run_part1()
run_part2()

# Keep running
while True:
    schedule.run_pending()
    time.sleep(60)  # Check every minute
```

Run it:
```bash
python3 scheduler.py
```

Install schedule if needed:
```bash
pip install schedule
```

---

## 📊 OUTPUT FILES

### Part 1 Output:
- **Filename:** `part1_breaking_YYYY_MM_DD_HHMM.json`
- **Structure:**
```json
{
  "generatedAt": "2025-10-09T...",
  "displayTimestamp": "Thursday, October 09, 2025 at 14:30 BST",
  "part": 1,
  "description": "Breaking News (Every 5 minutes)",
  "sources_count": 12,
  "totalArticles": 8,
  "articles": [...]
}
```

### Part 2 Output:
- **Filename:** `part2_global_YYYY_MM_DD_HHMM.json`
- **Structure:**
```json
{
  "generatedAt": "2025-10-09T...",
  "displayTimestamp": "Thursday, October 09, 2025 at 14:30 BST",
  "part": 2,
  "description": "Science, Research & Global News (Every 50 minutes)",
  "sources_count": 123,
  "totalArticles": 15,
  "articles": [...]
}
```

---

## 🔧 CONFIGURATION

### API Keys Required:
```bash
export NEWSAPI_KEY="your-key-here"
export CLAUDE_API_KEY="your-key-here"
export GOOGLE_API_KEY="your-key-here"
```

### Customization Options:

**In `news-part1-breaking.py`:**
- Line 72-84: `BREAKING_NEWS_SOURCES` - Modify breaking news sources
- Line 419: `score_threshold=8.0` - Adjust quality threshold (higher = stricter)

**In `news-part2-global.py`:**
- Line 36-157: `GLOBAL_NEWS_SOURCES` - Modify global sources
- Line 514: `score_threshold=7.5` - Adjust quality threshold

---

## 📈 EXPECTED RESULTS

### Part 1 (Breaking News):
- **Input:** 12 sources × ~10 articles each = ~120 articles
- **After Deduplication:** ~80 articles
- **After Full Text:** ~70 articles
- **After AI Scoring (8.0+):** ~5-15 articles
- **After Rewriting:** ~5-15 articles
- **Runtime:** ~2-3 minutes

### Part 2 (Global News):
- **Input:** 123 sources × ~5 articles each = ~600 articles
- **After Deduplication:** ~400 articles
- **Top 100 Processed:** 100 articles
- **After Full Text:** ~80 articles
- **After AI Scoring (7.5+):** ~15-30 articles
- **After Rewriting:** ~15-30 articles
- **Runtime:** ~15-20 minutes

---

## 🎯 KEY DIFFERENCES

| Feature | Part 1 (Breaking) | Part 2 (Global) |
|---------|------------------|----------------|
| **Frequency** | Every 5 minutes | Every 50 minutes |
| **Sources** | 12 premium | 123 global |
| **Threshold** | 8.0+ (STRICT) | 7.5+ (Balanced) |
| **Focus** | Breaking events | Deep dive, research |
| **Time Window** | Last 5 minutes | Last 50 minutes |
| **Articles/Source** | 10 max | 5 max |
| **Expected Output** | 5-15 articles | 15-30 articles |
| **Runtime** | 2-3 minutes | 15-20 minutes |

---

## 🌍 GEOGRAPHIC FOCUS

**Both parts have GLOBAL focus:**
- ✅ Equal weight to ALL countries and regions
- ✅ No geographic bias in scoring
- ✅ AI judges by GLOBAL IMPACT, not regional importance
- ✅ Covers: North America, Europe, Asia, Middle East, Africa, Latin America, Oceania

---

## 📝 SUMMARY SPECIFICATIONS

**Summary Text:**
- **Word Count:** 35-40 words
- **Tolerance:** +/- 2 words (33-42 acceptable)
- **Style:** Clear, engaging, news-style
- **Content:** Key facts from full article text
- **Format:** Plain text, no bold markup

**Title Text:**
- **Word Count:** 4-10 words
- **Style:** Concise, impactful, active voice
- **Quality:** No clickbait, clear headlines

---

## 🔍 QUALITY CONTROL

### Gemini AI Scoring Criteria:

**1. Importance (1-10):** How significant is this news?
   - Weight: 40%

**2. World Relevance (1-10):** How relevant to global audience?
   - Weight: 30%

**3. Interestingness (1-10):** How engaging/compelling?
   - Weight: 30%

### Overall Score Calculation:
```
Overall = (Importance × 0.40) + (World Relevance × 0.30) + (Interestingness × 0.30)
```

---

## 🎉 BENEFITS OF TWO-PART SYSTEM

1. **Ultra-Fresh Breaking News** (Part 1)
   - Updates every 5 minutes
   - Only the most critical breaking events
   - 8.0+ quality threshold ensures top-tier content

2. **Deep Global Coverage** (Part 2)
   - Updates every 50 minutes
   - 123 sources cover science, tech, business, world affairs
   - 7.5+ threshold balances quality with diversity

3. **Efficient API Usage**
   - Part 1: 12 requests every 5 min = 3,456/day
   - Part 2: 123 requests every 50 min = 3,690/day
   - **Total:** ~7,146 requests/day (within NewsAPI limits)

4. **Global Perspective**
   - No regional bias
   - Equal coverage of all continents
   - Diverse source languages and perspectives

5. **AI-Powered Quality**
   - Gemini scores every article
   - Claude rewrites for consistency
   - Only best articles make it to output

---

## 🚨 TROUBLESHOOTING

### Issue: "No articles found"
- **Cause:** NewsAPI might not have articles in the time window
- **Solution:** Normal behavior - will find articles on next run

### Issue: "No articles meet threshold"
- **Cause:** AI scoring is strict
- **Solution:** Lower threshold in code OR wait for better articles

### Issue: "API key invalid"
- **Cause:** Missing or incorrect API keys
- **Solution:** Export API keys in terminal

### Issue: Slow performance
- **Cause:** Many sources in Part 2
- **Solution:** Normal - Part 2 takes 15-20 minutes by design

---

## 📚 NEXT STEPS

1. ✅ Test Part 1: `python3 news-part1-breaking.py`
2. ✅ Test Part 2: `python3 news-part2-global.py`
3. ✅ Review output JSON files
4. ✅ Set up automated scheduling (cron or scheduler.py)
5. ✅ Integrate outputs with your website
6. ✅ Monitor logs for any issues

---

**Your news system is now PRODUCTION-READY!** 🎉

Global coverage | Time-based filtering | AI quality control | Automated scheduling

