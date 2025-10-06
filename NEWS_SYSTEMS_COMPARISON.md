# TEN NEWS - DUAL NEWS SYSTEM COMPARISON

## Overview

Your Ten News platform now has **TWO COMPLEMENTARY SYSTEMS** working together:

1. 🗞️ **Daily Digest** - 10 curated articles (existing)
2. 🔴 **Live News Feed** - Real-time updates with images (NEW)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    TEN NEWS PLATFORM                     │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────┐        ┌───────────────────┐     │
│  │  DAILY DIGEST    │        │  LIVE NEWS FEED   │     │
│  │  ============    │        │  ==============   │     │
│  │                  │        │                   │     │
│  │  📅 Once daily   │        │  🔄 Continuous    │     │
│  │  ⏰ 7 AM UK      │        │  ⚡ Real-time     │     │
│  │  📊 10 articles  │        │  📱 30-50 articles│     │
│  │  🎨 AI written   │        │  🖼️  With images  │     │
│  │  📜 Timeline     │        │  🏷️  Categorized  │     │
│  │  📚 History      │        │  🔥 Breaking news │     │
│  │                  │        │                   │     │
│  └──────────────────┘        └───────────────────┘     │
│           │                            │                │
│           ▼                            ▼                │
│  ┌─────────────────┐        ┌───────────────────┐     │
│  │ tennews_data_   │        │ livenews_data_    │     │
│  │ 2025_10_06.json │        │ 2025_10_06_1430   │     │
│  └─────────────────┘        │        .json      │     │
│                              └───────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

---

## Detailed Comparison

### 1. Daily Digest System (`news-generator.py`)

**Purpose:** Curated morning briefing with the 10 most important global stories

**Technology Stack:**
- **GDELT API** - Global news database
- **Claude Opus 4.1** - Premium AI for article rewriting
- **40 search queries** - Comprehensive coverage
- **Approved sources only** - Quality filtering

**What It Does:**
1. Searches GDELT with 40 specialized queries
2. Collects 1000+ articles from approved sources
3. AI selects top 10 most important stories
4. Claude rewrites each story professionally
5. Generates timeline for each article
6. Adds historical events for the day
7. Creates daily greeting

**Output Structure:**
```json
{
  "dailyGreeting": "Good morning, today brings important updates",
  "readingTime": "3 minute read",
  "displayDate": "MONDAY, OCTOBER 6, 2025",
  "articles": [
    {
      "rank": 1,
      "emoji": "🌍",
      "title": "Professional headline (8-12 words)",
      "summary": "40-50 words with **bold** markup",
      "details": ["Stat: Value", "Info: Data", "Key: Detail"],
      "category": "World News",
      "source": "Reuters",
      "url": "https://...",
      "timeline": [
        {"date": "Background", "event": "Historical context"},
        {"date": "Today", "event": "Current development"}
      ]
    }
  ],
  "historicalEvents": [
    {"year": "1969", "description": "Moon landing"}
  ]
}
```

**Best For:**
- ✅ Daily email newsletters
- ✅ Morning digest
- ✅ Deep, curated content
- ✅ Professional presentation
- ✅ Historical context

**Limitations:**
- ❌ No images
- ❌ Once per day only
- ❌ Not real-time
- ❌ Limited to 10 articles

---

### 2. Live News Feed System (`live-news-generator.py`)

**Purpose:** Real-time breaking news with images for dynamic website updates

**Technology Stack:**
- **NewsAPI** - Real-time news aggregator
- **Premium sources** - BBC, Reuters, CNN, Bloomberg, etc.
- **Claude Sonnet** - Fast AI categorization
- **Image support** - Every article has image URL

**What It Does:**
1. Fetches breaking news from NewsAPI
2. Pulls from 20+ premium sources
3. Searches trending topics
4. Removes duplicates
5. AI categorizes and rates importance
6. Includes images for every article
7. Can run continuously

**Output Structure:**
```json
{
  "generatedAt": "2025-10-06T14:30:00",
  "displayTimestamp": "Sunday, October 6, 2025 at 14:30 BST",
  "totalArticles": 30,
  "source": "NewsAPI Live Feed",
  "articles": [
    {
      "title": "Breaking news headline",
      "description": "NewsAPI description (140 chars)",
      "url": "https://...",
      "image": "https://cdn.example.com/image.jpg",
      "publishedAt": "2025-10-06T14:25:00Z",
      "source": "TechCrunch",
      "author": "Jane Smith",
      "content": "Truncated article content...",
      "category": "Technology",
      "importance": 8,
      "emoji": "💻"
    }
  ]
}
```

**Best For:**
- ✅ Live website feed
- ✅ Breaking news section
- ✅ Visual displays (images!)
- ✅ High volume updates
- ✅ Real-time content

**Limitations:**
- ❌ No timeline feature
- ❌ No historical events
- ❌ NewsAPI rate limits (100/day free)
- ❌ Less editorial curation

---

## Use Cases

### Use Case 1: Morning Newsletter + Live Website

**Setup:**
```bash
# Daily at 7 AM (automated)
news-generator.py runs → generates 10 curated stories

# Continuous throughout day
live-news-generator.py runs → updates every 15 minutes
```

**User Experience:**
- **7 AM:** Users receive email with 10 curated stories
- **Throughout day:** Website shows 30+ live articles with images
- **Next 7 AM:** New curated digest

**Files Generated:**
- `tennews_data_2025_10_06.json` (once daily)
- `livenews_data_2025_10_06_0700.json` (every 15 min)
- `livenews_data_2025_10_06_0715.json`
- `livenews_data_2025_10_06_0730.json`
- ...

---

### Use Case 2: Email Only (Current Setup)

**Setup:**
```bash
# Only daily digest
news-generator.py runs → 10 stories for email
```

**User Experience:**
- Receive curated email every morning
- No website updates

---

### Use Case 3: Live Website Only (New Option)

**Setup:**
```bash
# Only live feed
live-news-generator.py runs → continuous updates
```

**User Experience:**
- Website always shows latest news
- No email newsletter
- Images for every article

---

### Use Case 4: Hybrid (Recommended)

**Setup:**
```bash
# Both systems running
1. Daily digest for email (7 AM)
2. Live feed for website (every 30 min)
```

**User Experience:**
- **Email:** Professional, curated morning briefing
- **Website:** Always fresh, breaking news with images
- **Best of both worlds!**

---

## Technical Specifications

| Feature | Daily Digest | Live Feed |
|---------|--------------|-----------|
| **Script** | `news-generator.py` | `live-news-generator.py` |
| **API** | GDELT (free) | NewsAPI (free tier 100/day) |
| **AI** | Claude Opus (premium) | Claude Sonnet (optional) |
| **Execution** | Scheduled (7 AM) | On-demand or continuous |
| **Generation Time** | ~10-15 minutes | ~30-60 seconds |
| **Output File** | `tennews_data_*.json` | `livenews_data_*.json` |
| **Articles** | 10 | 30-50+ |
| **Images** | No | Yes |
| **Timeline** | Yes | No |
| **Historical** | Yes | No |
| **Word Count** | 40-50 (strict) | Varies |
| **Bold Markup** | Yes | No |
| **Details Array** | Yes | No |

---

## API Costs & Limits

### GDELT API (Daily Digest)
- **Cost:** FREE
- **Limits:** No official limits
- **Reliability:** Very high
- **Data:** Global news database

### NewsAPI (Live Feed)
- **Free Tier:**
  - 100 requests/day
  - Last 24 hours only
  - Developer key
  
- **Paid Tier ($449/month):**
  - Unlimited requests
  - Full article archive
  - Commercial license
  - Premium support

### Claude API (Both Systems)
- **Daily Digest:** ~$0.03-0.05 per run
- **Live Feed:** ~$0.01 per run (optional)
- **Total:** ~$2-3/month for both systems

---

## File Management

### Daily Digest Files
```
tennews_data_2025_10_01.json
tennews_data_2025_10_02.json
tennews_data_2025_10_03.json
...
tennews_data_2025_10_06.json ← Today
```

**Retention:** Keep last 7 days for duplicate checking

### Live Feed Files
```
livenews_data_2025_10_06_0700.json
livenews_data_2025_10_06_0730.json
livenews_data_2025_10_06_0800.json
...
livenews_data_2025_10_06_1430.json ← Latest
```

**Retention:** 
- Keep only latest for website display
- Archive or delete older ones
- Can generate 96+ files per day (every 15 min)

---

## Integration Plan (Phase 2)

Once you update the website, you'll have:

### Homepage Structure
```
┌────────────────────────────────────┐
│  TEN NEWS WEBSITE                  │
├────────────────────────────────────┤
│                                    │
│  📰 DAILY DIGEST (Top Section)    │
│  ================================   │
│  10 curated stories               │
│  With timeline & historical events │
│  Generated: 7 AM today            │
│                                    │
│  ──────────────────────────────   │
│                                    │
│  🔴 LIVE NEWS (Bottom Section)    │
│  ================================   │
│  [Image] Breaking: Tech company... │
│  [Image] Market update...          │
│  [Image] Sports results...         │
│  30+ live articles with images     │
│  Updated: 2 minutes ago           │
│                                    │
└────────────────────────────────────┘
```

---

## Getting Started

### Step 1: Test Daily Digest (Already Working)
```bash
python news-generator.py
```

### Step 2: Get NewsAPI Key
1. Visit https://newsapi.org/register
2. Sign up (free)
3. Copy your API key

### Step 3: Set Environment Variable
```bash
export NEWSAPI_KEY="your-key-here"
```

### Step 4: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 5: Test Live Feed
```bash
python live-news-generator.py
```

### Step 6: Review Output
```bash
# Daily digest
cat tennews_data_2025_10_06.json

# Live feed  
cat livenews_data_2025_10_06_1430.json
```

---

## Recommended Setup

### For Testing
- **Daily Digest:** Run manually when needed
- **Live Feed:** Run once, generate 30 articles
- **Cost:** FREE (within limits)

### For Production
- **Daily Digest:** Automated at 7 AM
- **Live Feed:** Continuous every 30 minutes
- **Cost:** ~$2-3/month Claude + NewsAPI free tier

### For High-Traffic Site
- **Daily Digest:** Automated at 7 AM  
- **Live Feed:** Continuous every 10-15 minutes
- **Cost:** ~$2-3/month Claude + $449/month NewsAPI

---

## Summary

| Aspect | Daily Digest | Live Feed |
|--------|-------------|-----------|
| **Purpose** | Morning briefing | Real-time updates |
| **Frequency** | Once daily | Continuous |
| **Quality** | Highly curated | Raw + categorized |
| **Presentation** | Professional | News-style |
| **Images** | No | Yes |
| **Cost** | Minimal | NewsAPI dependent |
| **Best For** | Email newsletter | Website feed |

---

## Next Steps

1. ✅ Get NewsAPI key
2. ✅ Test live news generator
3. 🔄 Update website to display both feeds
4. 🎯 Choose your preferred setup
5. 🚀 Launch!

---

**Both systems are ready to go. Get your NewsAPI key and let's test the live news generator!** 🚀

