# 🏗️ Ten News - Complete System Architecture

## Three-Tiered News Generation System

Your Ten News platform now has **THREE POWERFUL SYSTEMS** working together to deliver the best news experience.

---

## 📊 System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    TEN NEWS PLATFORM                             │
│                                                                   │
│  ┌───────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │   SYSTEM 1    │  │  SYSTEM 2    │  │    SYSTEM 3        │  │
│  │ Daily Digest  │  │ Live Feed    │  │ Research Enhancer  │  │
│  │               │  │              │  │                    │  │
│  │ ✓ GDELT API   │  │ ✓ NewsAPI    │  │ ✓ Perplexity API   │  │
│  │ ✓ Claude AI   │  │ ✓ Gemini AI  │  │ ✓ Web Research     │  │
│  │ ✓ 10 articles │  │ ✓ 30-50      │  │ ✓ Verified Facts   │  │
│  │ ✓ Once daily  │  │ ✓ Real-time  │  │ ✓ Citations        │  │
│  │ ✓ Curated     │  │ ✓ Images     │  │ ✓ Timelines        │  │
│  └───────────────┘  └──────────────┘  └────────────────────┘  │
│         │                  │                     │              │
│         └──────────────────┴─────────────────────┘              │
│                            │                                    │
│                            ▼                                    │
│              ┌─────────────────────────┐                       │
│              │   ENHANCED NEWS OUTPUT   │                       │
│              │  • Curated Articles      │                       │
│              │  • Real-time Updates     │                       │
│              │  • Verified Research     │                       │
│              │  • Professional Quality  │                       │
│              └─────────────────────────┘                       │
└───────────────────────────────────────────────────────────────┘
```

---

## 🎯 System 1: Daily Digest

### **Purpose:** Curated morning briefing with the 10 most important global stories

### **Technology Stack:**
```
GDELT API → Claude AI (Selection) → Claude AI (Writing) → 10 Articles
```

### **What It Does:**
1. **Searches GDELT** with 40 specialized queries
2. **Collects 1000+** articles from approved sources
3. **AI selects top 10** most important global stories
4. **Claude rewrites** each story professionally (40-50 words)
5. **Generates timeline** for each article (2-4 events)
6. **Adds historical events** for the day
7. **Creates daily greeting**

### **Output:**
- **File:** `tennews_data_2025_10_06.json`
- **Articles:** Exactly 10
- **Quality:** Highly curated, professionally written
- **Features:** Timeline, historical events, reading time
- **Images:** ❌ No

### **AI Models:**
- **Selection:** Gemini 1.5 Pro ($1.25/$5 per 1M tokens)
- **Writing:** Claude 3.5 Sonnet ($3/$15 per 1M tokens)
- **History:** GPT-4o-mini ($0.15/$0.60 per 1M tokens)

### **Cost:** ~$0.02 per run = **$0.60/month**

### **Best For:**
- ✅ Email newsletters
- ✅ Morning digest
- ✅ Deep, curated content
- ✅ Professional presentation

---

## 🔴 System 2: Live News Feed

### **Purpose:** Real-time breaking news with images for dynamic website updates

### **Technology Stack:**
```
NewsAPI → Raw Articles → Gemini AI (Categorize) → 30-50 Articles
```

### **What It Does:**
1. **Fetches from NewsAPI** (20+ premium sources)
2. **Collects ~115** raw articles (premium sources + categories + trending)
3. **Removes duplicates** (60-80 unique remain)
4. **Selects top 30-50** most recent
5. **AI categorizes** and rates importance
6. **Includes images** for every article

### **Output:**
- **File:** `livenews_data_2025_10_06_1430.json`
- **Articles:** 30-50
- **Quality:** Raw news + light processing
- **Features:** Categories, importance ratings, timestamps
- **Images:** ✅ Yes!

### **AI Models:**
- **Categorization:** Gemini 1.5 Flash ($0.075/$0.30 per 1M tokens)

### **Cost:** ~$0.0005 per run = **$0.024/month** (every 30 min)

### **Best For:**
- ✅ Live website feed
- ✅ Breaking news section
- ✅ Visual displays (images!)
- ✅ High volume updates
- ✅ Real-time content

---

## 🔬 System 3: Research Enhancer (NEW!)

### **Purpose:** Add verified research, citations, and timelines to any news article

### **Technology Stack:**
```
Article → Perplexity API → Web Research → Enhanced Article
```

### **What It Does:**
1. **Takes any article** (from System 1 or 2)
2. **Searches web** with Perplexity API
3. **Verifies facts** across Reuters, AP, BBC, Bloomberg, etc.
4. **Adds bold markup** (3-6 key terms)
5. **Finds 3 details** (numbers, dates, metrics with citations)
6. **Creates timeline** (2-4 events with specific dates)
7. **Provides citations** (2-6 reputable source URLs)

### **Output:**
- **File:** `*_enhanced.json` (adds suffix to input)
- **Enhancement:** Adds research to existing articles
- **Quality:** Web-researched, verified facts
- **Features:** Details, timeline, citations, bold markup

### **AI Models:**
- **Research:** Perplexity API sonar (~$5 per 1M tokens)

### **Cost:** ~$0.15 per run (30 articles) = **$1.50-3/month** (daily)

### **Best For:**
- ✅ Verified fact-checking
- ✅ Adding context to articles
- ✅ Citation transparency
- ✅ Timeline context
- ✅ Professional credibility

---

## 🎯 Complete Workflow Options

### **Option A: Daily Digest Only** (Current)
```
1. Run: news-generator.py
   → Output: tennews_data_2025_10_06.json
   → Cost: $0.02/day = $0.60/month

Use case: Email newsletter only
```

### **Option B: Live Feed Only**
```
1. Run: live-news-generator.py (continuous, every 30 min)
   → Output: livenews_data_2025_10_06_HHMM.json
   → Cost: $0.0005/run × 48/day = $0.024/month

Use case: Website only, no email
```

### **Option C: Daily + Live (No Enhancement)**
```
1. Daily: news-generator.py (7 AM)
   → tennews_data_2025_10_06.json

2. Live: live-news-generator.py (every 30 min)
   → livenews_data_2025_10_06_HHMM.json

Cost: $0.60 + $0.024 = $0.624/month

Use case: Email + website, basic quality
```

### **Option D: Daily + Enhancement** (Recommended)
```
1. Generate: news-generator.py
   → tennews_data_2025_10_06.json

2. Enhance: news-research-enhancer.py
   → tennews_data_2025_10_06_enhanced.json

Cost: $0.02 + $0.05 = $0.07/day = $2.10/month

Use case: Premium email newsletter with research
```

### **Option E: Live + Enhancement**
```
1. Generate: live-news-generator.py (every 6 hours)
   → livenews_data_2025_10_06_HHMM.json

2. Enhance: news-research-enhancer.py
   → livenews_data_2025_10_06_HHMM_enhanced.json

Cost (4x/day): ($0.0005 + $0.15) × 4 = $0.60/day = $18/month

Use case: Premium website with verified research
```

### **Option F: Complete System** (Maximum Quality)
```
1. Daily Digest: news-generator.py (7 AM)
   → tennews_data_2025_10_06.json
   
2. Enhance Digest: news-research-enhancer.py
   → tennews_data_2025_10_06_enhanced.json

3. Live Feed: live-news-generator.py (every 6 hours)
   → livenews_data_2025_10_06_HHMM.json

4. Enhance Live: news-research-enhancer.py (optional)
   → livenews_data_2025_10_06_HHMM_enhanced.json

Cost: 
- Daily enhanced: $0.07/day = $2.10/month
- Live (no enhance): $0.002/day = $0.06/month
- Live (enhanced): $2.40/day = $72/month

Recommended: Daily enhanced + Live basic = $2.16/month

Use case: Everything! Premium email + live website
```

---

## 💰 Cost Comparison

| Option | Components | Cost/Month | Best For |
|--------|-----------|-----------|----------|
| **A: Daily Only** | System 1 | $0.60 | Email only |
| **B: Live Only** | System 2 | $0.024 | Website only |
| **C: Daily + Live** | Systems 1+2 | $0.62 | Email + Website |
| **D: Daily Enhanced** | Systems 1+3 | $2.10 | Premium email |
| **E: Live Enhanced** | Systems 2+3 (4x/day) | $18 | Premium website |
| **F: Complete** | All 3 (daily enhanced + live basic) | $2.16 | Best of both |

---

## 🎨 Output Structure Comparison

### **Daily Digest Article:**
```json
{
  "rank": 1,
  "emoji": "🌍",
  "title": "Professional headline (8-12 words)",
  "summary": "Exactly 40-50 words with **bold** markup",
  "details": ["Label: Value", "Label: Value", "Label: Value"],
  "timeline": [
    {"date": "Past", "event": "Historical context"},
    {"date": "Today", "event": "Current development"}
  ],
  "category": "World News",
  "source": "Reuters",
  "url": "https://..."
}
```

### **Live Feed Article:**
```json
{
  "title": "Breaking headline from NewsAPI",
  "description": "NewsAPI description (~140 chars)",
  "url": "https://...",
  "image": "https://cdn.example.com/image.jpg",
  "publishedAt": "2025-10-06T14:25:00Z",
  "source": "TechCrunch",
  "author": "Jane Smith",
  "category": "Technology",
  "importance": 8,
  "emoji": "💻"
}
```

### **Enhanced Article (Either System):**
```json
{
  // ... all original fields ...
  "summary": "Summary with **bold** markup added",
  "details": [
    "Launch date: September 2025",
    "Revenue: $89.5B quarterly",
    "Market share: 28 percent"
  ],
  "timeline": [
    {"date": "2023-09-12", "event": "Previous version released worldwide"},
    {"date": "2025-09-12", "event": "New version announced at event"},
    {"date": "2025-10-01", "event": "Begins shipping to retailers"}
  ],
  "citations": [
    {"url": "https://reuters.com/...", "publisher": "Reuters"},
    {"url": "https://bloomberg.com/...", "publisher": "Bloomberg"}
  ],
  "research_status": "ok"
}
```

---

## 🚀 Recommended Setup

### **For Most Users:**

**Phase 1: Start Simple** (Month 1)
```
✓ System 1: Daily Digest
✓ System 2: Live Feed (every 30 min)
Cost: $0.62/month
```

**Phase 2: Add Quality** (Month 2)
```
✓ System 1: Daily Digest
✓ System 3: Enhance daily digest
✓ System 2: Live Feed (every 30 min, no enhance)
Cost: $2.16/month
```

**Phase 3: Full Power** (Month 3+)
```
✓ System 1: Daily Digest
✓ System 3: Enhance daily digest
✓ System 2: Live Feed (every 2 hours)
✓ System 3: Enhance live feed (2-3 times/day)
Cost: $5-10/month
```

---

## 📋 Quick Command Reference

### **Generate Daily Digest:**
```bash
python news-generator.py
# Output: tennews_data_2025_10_06.json
```

### **Generate Live Feed:**
```bash
python live-news-generator.py
# Output: livenews_data_2025_10_06_1430.json
```

### **Enhance Any File:**
```bash
python news-research-enhancer.py <input.json>
# Output: <input>_enhanced.json
```

### **Complete Daily Pipeline:**
```bash
# Generate
python news-generator.py

# Enhance
TODAY=$(date +%Y_%m_%d)
python news-research-enhancer.py tennews_data_${TODAY}.json

# Result: tennews_data_2025_10_06_enhanced.json
```

### **Complete Live Pipeline:**
```bash
# Generate
python live-news-generator.py

# Get latest file
LATEST=$(ls -t livenews_data_*.json | head -1)

# Enhance
python news-research-enhancer.py $LATEST

# Result: *_enhanced.json
```

---

## 🎯 Key Decisions Matrix

| If You Want... | Use System | Cost | Setup Time |
|----------------|-----------|------|------------|
| Email newsletter | 1 | $0.60/mo | 5 min |
| Live website | 2 | $0.02/mo | 10 min |
| Both basic | 1+2 | $0.62/mo | 15 min |
| Verified facts | +3 | +$2-18/mo | 5 min |
| Images | 2 | Included | 10 min |
| Timelines | 1 or 3 | Included | 0-5 min |
| Citations | 3 | +$2-18/mo | 5 min |
| Best quality | 1+3 | $2.10/mo | 20 min |
| Best value | 1+2 | $0.62/mo | 15 min |

---

## ✅ Setup Checklist

### **System 1: Daily Digest** (Ready!)
- [x] Script created: `news-generator.py`
- [x] Claude API key configured
- [x] Tested and working
- [ ] Automated (optional: cron job)

### **System 2: Live Feed**
- [x] Script created: `live-news-generator.py`
- [ ] Get NewsAPI key (https://newsapi.org)
- [ ] Set `NEWSAPI_KEY` environment variable
- [ ] Test: `python live-news-generator.py`
- [ ] Automate (optional: continuous mode)

### **System 3: Research Enhancer**
- [x] Script created: `news-research-enhancer.py`
- [ ] Get Perplexity API key (https://perplexity.ai/settings/api)
- [ ] Set `PERPLEXITY_API_KEY` environment variable
- [ ] Test: `python news-research-enhancer.py <file>`
- [ ] Integrate with pipeline

---

## 🎉 Summary

You now have:

✅ **System 1** - Daily curated digest (10 articles)
✅ **System 2** - Live real-time feed (30-50 articles with images)
✅ **System 3** - Research enhancement (verified facts, citations, timelines)

All working together to create the most comprehensive news platform!

**Next Steps:**
1. Get NewsAPI key → Test System 2
2. Get Perplexity key → Test System 3
3. Choose your preferred workflow (Option A-F)
4. Update website to display enhanced articles

---

**Ready to complete the setup? Let me know which systems you want to activate!** 🚀

