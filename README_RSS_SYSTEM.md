# TEN NEWS - RSS-Based News Aggregation System

## 🚀 Overview

Complete RSS-based news aggregation system with AI filtering. Replaces NewsAPI with 200+ curated RSS feeds.

### Features
- ✅ **200+ RSS Sources** - Breaking news, science, technology, business, environment, politics, and more
- ✅ **Parallel Fetching** - 30 concurrent workers for fast updates
- ✅ **Zero Duplicates** - URL, GUID, and timestamp-based duplicate detection
- ✅ **Smart Image Extraction** - 7-method fallback system
- ✅ **AI Scoring** - Gemini 2.0 Flash for article evaluation (0-100 scale)
- ✅ **Enhanced Content** - Claude AI generates summaries, timelines, and detailed analysis
- ✅ **REST API** - JSON API for frontend integration
- ✅ **Complete Monitoring** - Fetch cycles, source statistics, error tracking

---

## 📁 File Structure

```
tennews/
├── main.py                    # Main orchestrator (runs both systems)
├── rss_fetcher.py            # RSS fetching system (every 10 min)
├── ai_filter.py              # AI scoring & content generation (every 5 min)
├── api.py                    # REST API for frontend
├── rss_sources.py            # 200+ RSS source configurations
├── database_schema.sql       # SQLite database schema
├── requirements.txt          # Python dependencies
├── ten_news.db              # SQLite database (auto-created)
└── README_RSS_SYSTEM.md     # This file
```

---

## 🔧 Installation

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Set Environment Variables

```bash
export CLAUDE_API_KEY='your-claude-key-here'
export GOOGLE_API_KEY='your-google-key-here'
export PERPLEXITY_API_KEY='your-perplexity-key-here'  # Optional
```

### 3. Initialize Database

The database will be created automatically on first run.

---

## ▶️ Running the System

### Option 1: Run Everything (Recommended)

```bash
python3 main.py
```

This starts:
- RSS Fetcher (every 10 minutes)
- AI Filter (every 5 minutes)

### Option 2: Run Components Separately

**RSS Fetcher only:**
```bash
python3 rss_fetcher.py
```

**AI Filter only:**
```bash
python3 ai_filter.py
```

**API Server only:**
```bash
python3 api.py
```

---

## 📊 How It Works

### Step 1: RSS Fetching (Every 10 Minutes)

1. Fetches from 200+ RSS sources in parallel (30 workers)
2. Extracts articles with metadata and images
3. Checks for duplicates (URL, GUID, timestamp)
4. Stores new articles in database

**Expected:** 10,000-15,000 articles/day fetched

### Step 2: AI Filtering (Every 5 Minutes)

1. Gets unprocessed articles from database
2. Scores each article with Gemini AI (0-100 scale)
3. If score ≥ 60:
   - Generates 35-40 word summary (Claude)
   - Optimizes title to 4-10 words (Claude)
   - Creates timeline of key events (Claude)
   - Writes detailed analysis (Claude)
   - Publishes article
4. If score < 60: Rejects article

**Expected:** 500-1,000 articles/day published

### Step 3: Frontend Access

Frontend fetches published articles via REST API:
```
GET /api/news?limit=50&offset=0
```

---

## 🔌 API Endpoints

### Get Articles
```
GET /api/news
Query params:
  - limit (int): Number of articles (default 50)
  - offset (int): Pagination offset (default 0)
  - category (string): Filter by category (optional)

Response:
{
  "status": "ok",
  "totalResults": 1234,
  "articles": [...],
  "generatedAt": "2025-10-09T20:00:00",
  "displayTimestamp": "Thursday, October 09, 2025 at 20:00 BST"
}
```

### Get Single Article
```
GET /api/news/<article_id>

Response:
{
  "id": 123,
  "title": "Article Title",
  "urlToImage": "https://...",
  "summary": "35-40 word summary...",
  "timeline": [...],
  "details": "Detailed analysis...",
  ...
}
```

### Get Categories
```
GET /api/categories

Response:
[
  {"name": "science", "count": 234},
  {"name": "technology", "count": 189},
  ...
]
```

### Get Statistics
```
GET /api/stats

Response:
{
  "published_articles": 1234,
  "total_fetched": 12000,
  "articles_with_images": 1100,
  "image_percentage": 89.1,
  "total_sources": 205,
  "avg_articles_per_source": 2.4,
  "last_fetch": {...}
}
```

### Health Check
```
GET /api/health

Response:
{
  "status": "healthy",
  "database": "connected",
  "articles_count": 12000,
  "timestamp": "2025-10-09T20:00:00"
}
```

---

## 📰 RSS Sources

### Categories (205 total sources)

- **Breaking News** (25): Reuters, BBC, Associated Press, Al Jazeera, CNN, etc.
- **Science** (45): Nature, Science Magazine, arXiv, PLOS, NASA, etc.
- **Technology** (35): TechCrunch, Wired, Ars Technica, MIT Tech Review, etc.
- **Business** (30): Bloomberg, Reuters Business, CNBC, CoinDesk, etc.
- **Environment** (20): Climate Home News, Inside Climate News, WWF, etc.
- **Data Science** (15): Towards Data Science, KDnuggets, FiveThirtyEight, etc.
- **Politics** (20): Politico, The Hill, Foreign Policy, Brookings, etc.
- **General** (15): NY Times, Washington Post, The Guardian, etc.

All sources configured in `rss_sources.py`

---

## 🎯 AI Scoring System

### Scoring Criteria (0-100 points)

1. **Global Impact** (0-35): How many people affected? International significance?
2. **Scientific Significance** (0-30): Breakthrough or incremental?
3. **Novelty & Urgency** (0-20): Breaking now? Time-critical?
4. **Source Credibility** (0-8): Source quality adjustment
5. **Engagement** (0-7): Fascinating to intelligent readers?

**Minimum Score to Publish:** 60 points

### Source Credibility Tiers

- **Tier 1** (9-10): Reuters, BBC, Nature, Science Magazine
- **Tier 2** (7-8): CNN, Guardian, Scientific American, MIT Tech Review
- **Tier 3** (5-6): Most sources (default)
- **Tier 4** (3-4): Lower credibility sources

---

## 🖼️ Image Extraction

7-method fallback system ensures 95%+ articles have images:

1. **RSS Enclosure** - Most common
2. **Media Content Tag** - Common in feeds
3. **Media Thumbnail** - Fallback
4. **Description HTML** - Extract from description
5. **Content HTML** - Extract from content
6. **og:image** - Fetch from article page (disabled by default for speed)
7. **None** - No image available

---

## 📝 Database Schema

### Tables

**articles** - Main article storage
- Basic fields: url, source, title, description, content, image_url
- AI fields: ai_score, category, emoji, summary, timeline, details
- Publishing: published, published_at
- Stats: view_count

**fetch_cycles** - Track RSS fetch cycles
- Timing, status, articles found, errors

**source_stats** - Monitor source performance
- Success rate, average articles, consecutive failures

---

## 🔍 Monitoring

### Check Logs

```bash
tail -f rss_fetcher.log
tail -f ai_filter.log
```

### Query Database

```bash
sqlite3 ten_news.db

-- Published articles count
SELECT COUNT(*) FROM articles WHERE published = TRUE;

-- Articles by category
SELECT category, COUNT(*) FROM articles WHERE published = TRUE GROUP BY category;

-- Top sources
SELECT source, COUNT(*) FROM articles WHERE published = TRUE GROUP BY source ORDER BY COUNT(*) DESC LIMIT 10;

-- Recent fetch cycles
SELECT * FROM fetch_cycles ORDER BY started_at DESC LIMIT 5;

-- Source performance
SELECT source, successful_fetches, failed_fetches, average_articles_per_fetch 
FROM source_stats 
ORDER BY successful_fetches DESC 
LIMIT 20;
```

---

## 🚀 Deployment

### Local Development

```bash
python3 main.py
```

### Production (Railway/Heroku/Cloud)

1. Add to Procfile:
```
worker: python3 main.py
web: python3 api.py
```

2. Set environment variables on platform
3. Deploy

---

## 🔧 Configuration

### Adjust Fetch Interval

In `rss_fetcher.py`:
```python
self.fetch_interval = 600  # 10 minutes (change as needed)
```

### Adjust AI Filter Interval

In `ai_filter.py`:
```python
self.filter_interval = 300  # 5 minutes (change as needed)
```

### Adjust Minimum Score

In `ai_filter.py`:
```python
self.min_score = 60  # Minimum score to publish (change as needed)
```

### Adjust Parallel Workers

In `rss_fetcher.py`:
```python
self.max_workers = 30  # Number of parallel workers (change as needed)
```

---

## 📊 Expected Performance

- **Fetch Time:** <30 seconds per cycle (with 30 workers)
- **Articles Fetched:** 10,000-15,000/day
- **Articles Published:** 500-1,000/day (60+ score)
- **Images:** 95%+ articles have images
- **AI Processing Lag:** <10 minutes
- **Duplicates:** 0 (guaranteed by database constraints)

---

## ❓ Troubleshooting

### No Articles Being Fetched?

1. Check RSS source URLs are accessible
2. Check logs: `tail -f rss_fetcher.log`
3. Query database: `SELECT * FROM fetch_cycles ORDER BY started_at DESC LIMIT 1;`

### No Articles Being Published?

1. Check AI API keys are set
2. Check logs: `tail -f ai_filter.log`
3. Lower minimum score temporarily: `self.min_score = 40`

### Database Errors?

1. Delete database: `rm ten_news.db`
2. Restart system: `python3 main.py`

### High Memory Usage?

1. Reduce parallel workers: `self.max_workers = 15`
2. Reduce batch size: `self.batch_size = 15`

---

## 🎉 Success Metrics

✅ **200+ RSS sources** monitored  
✅ **10 minute** fetch intervals  
✅ **Zero duplicates** guaranteed  
✅ **95%+ articles** have images  
✅ **AI scoring** with 60+ threshold  
✅ **Complete monitoring** and statistics  
✅ **REST API** for frontend  
✅ **Full compatibility** with existing frontend  

---

## 📞 Support

Check logs first, then query database for diagnostics.

For issues, provide:
1. Error message
2. Relevant log lines
3. Database query results
4. System configuration

