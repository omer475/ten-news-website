# Event Clustering & AI Synthesis System

## Overview

Transform Ten News from displaying individual articles to synthesizing multiple sources about the same event into one comprehensive AI-written article. Articles automatically update when new sources arrive.

---

## 🚀 Quick Start

### 1. Database Setup

Run the migration in Supabase SQL Editor:

```bash
# Run this file in Supabase SQL Editor
supabase_clustering_schema.sql
```

This creates 4 new tables:
- `source_articles` - Original RSS articles
- `clusters` - Groups of articles about same event
- `published_articles` - AI-synthesized articles
- `article_updates_log` - Update history

### 2. Environment Variables

Ensure these are set in your `.env`:

```bash
# Existing
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
GOOGLE_API_KEY=your_gemini_key
ANTHROPIC_API_KEY=your_claude_key
PERPLEXITY_API_KEY=your_perplexity_key

# New (optional)
API_PORT=5000  # For feed ranking API
```

### 3. Test the System

```bash
# Test clustering engine
python step1_5_event_clustering.py

# Test multi-source synthesis
python step3_multi_source_synthesis.py

# Test complete workflow
python complete_clustered_news_workflow.py
```

---

## 📋 Complete Workflow

### Pipeline Flow

```
1. RSS Fetch (existing rss_fetcher.py)
   ↓
2. Step 1: Gemini Scoring (1000 → ~150 articles)
   ↓
3. Step 1.5: Event Clustering (150 → ~30 clusters)
   ↓
4. Step 2: Jina Fetching (full text for ALL sources)
   ↓
5. Step 3: Multi-Source Synthesis (ONE article per cluster)
   ↓
6. Steps 4-6: Context search & components
   ↓
7. Publish to Supabase
   ↓
8. Real-time monitoring for updates
```

### Example Run

```bash
# Fetch RSS articles
python rss_fetcher.py

# Process with clustering
python complete_clustered_news_workflow.py

# Publish to main articles table
python publish_clustered_articles.py

# Start monitoring daemon (runs continuously)
python cluster_monitor_daemon.py
```

---

## 🔧 Components

### Core Modules

**1. `step1_5_event_clustering.py`**
- URL normalization (removes tracking params)
- Keyword/entity extraction
- Title similarity matching (75% threshold)
- Cluster creation and management

**2. `step3_multi_source_synthesis.py`**
- Synthesizes information from N sources
- Generates dual-language content (news + B2)
- Resolves conflicting information
- 200-word articles

**3. `article_update_manager.py`**
- Monitors clusters for new sources
- Triggers: High score (≥850) or Volume (4+ sources)
- 30-minute cooldown between updates
- Update logging

**4. `cluster_lifecycle_manager.py`**
- Closes clusters after 24h inactivity
- Closes clusters after 48h max lifetime
- Detects and merges duplicate clusters

**5. `cluster_monitor_daemon.py`**
- Runs continuously in background
- Checks for new articles every 15 minutes
- Manages lifecycle every hour
- Detects duplicates every 6 hours

**6. `complete_clustered_news_workflow.py`**
- Complete pipeline integration
- Replaces old single-article workflow
- Processes clusters instead of individual articles

**7. `api_feed_ranking.py`**
- Feed API for frontend
- Article detail with sources
- System statistics
- Health check

**8. `publish_clustered_articles.py`**
- Publishes to main `articles` table
- Includes source attribution
- Handles updates

---

## 🧪 Testing Guide

### Test 1: Clustering Accuracy

```python
# Create test articles about same event
test_articles = [
    {
        "title": "Turkey Earthquake Death Toll Rises to 50",
        "source": "BBC News",
        "url": "https://bbc.com/turkey-quake-1",
        "score": 920
    },
    {
        "title": "Earthquake Strikes Turkey, Dozens Dead",
        "source": "CNN", 
        "url": "https://cnn.com/turkey-earthquake-1",
        "score": 880
    },
    {
        "title": "Turkey Quake Leaves 50 Dead",
        "source": "Reuters",
        "url": "https://reuters.com/turkey-quake-1",
        "score": 850
    }
]

# Should cluster into ONE event
from step1_5_event_clustering import EventClusteringEngine
engine = EventClusteringEngine()
result = engine.cluster_articles(test_articles)

# Expected: 1 cluster with 3 sources
assert result['new_clusters_created'] == 1
assert result['saved_articles'] == 3
```

### Test 2: Multi-Source Synthesis

```python
# Given cluster with 3 sources, should produce ONE article
from step3_multi_source_synthesis import MultiSourceSynthesizer

synthesizer = MultiSourceSynthesizer(claude_api_key)
result = synthesizer.synthesize_cluster(test_cluster, sources)

# Expected: Dual-language content
assert 'title_news' in result
assert 'title_b2' in result
assert 'content_news' in result
assert 'content_b2' in result
assert len(result['content_news'].split()) <= 250
```

### Test 3: Update Triggers

```python
# Test high-score trigger
from article_update_manager import ArticleUpdateManager

manager = ArticleUpdateManager(claude_api_key)

# Add high-score article to cluster
new_article = {"score": 920, "title": "Turkey Quake Updates"}
trigger = manager.check_update_triggers(cluster_id, new_article)

# Expected: Should trigger 'high_score' update
assert trigger == 'high_score'
```

### Test 4: End-to-End

```bash
# Run complete test
python -c "
from complete_clustered_news_workflow import ClusteredNewsWorkflow
from rss_sources import ALL_SOURCES
import feedparser

# Fetch sample articles
articles = []
for source_name, url in ALL_SOURCES[:5]:
    feed = feedparser.parse(url)
    for entry in feed.entries[:2]:
        articles.append({
            'title': entry.title,
            'source': source_name,
            'text': entry.summary,
            'url': entry.link
        })

# Process
workflow = ClusteredNewsWorkflow()
results = workflow.process_rss_feed(articles)

# Check results
print(f'Clusters: {len(results[\"clustering_results\"][\"clusters\"])}')
print(f'Articles: {len(results[\"final_articles\"])}')
"
```

---

## 📊 Monitoring

### View Cluster Statistics

```python
from step1_5_event_clustering import EventClusteringEngine

engine = EventClusteringEngine()
clusters = engine.get_clusters_for_processing()

for cluster in clusters:
    print(f"{cluster['event_name']}: {cluster['source_count']} sources")
```

### Check Update History

```sql
-- In Supabase SQL Editor
SELECT 
    pa.title_news,
    aul.trigger_type,
    aul.sources_added_count,
    aul.updated_at
FROM article_updates_log aul
JOIN published_articles pa ON pa.id = aul.article_id
ORDER BY aul.updated_at DESC
LIMIT 10;
```

### Monitor Daemon Status

```bash
# Check daemon logs
tail -f cluster_monitor.log

# View statistics
curl http://localhost:5000/api/stats
```

---

## 🔥 Production Deployment

### Step 1: Deploy Database

```bash
# Run migration in Supabase
# File: supabase_clustering_schema.sql
```

### Step 2: Update Environment

```bash
# Production .env
SUPABASE_URL=https://your-prod-supabase.com
SUPABASE_SERVICE_KEY=your-prod-service-key
# ... other keys
```

### Step 3: Start Services

```bash
# Terminal 1: RSS Fetcher (existing)
python rss_fetcher.py

# Terminal 2: Cluster Monitor Daemon (NEW)
python cluster_monitor_daemon.py

# Terminal 3: Feed API (NEW)
python api_feed_ranking.py

# Or use systemd/supervisor for production
```

### Step 4: Deploy Frontend Updates

The API at `/api/feed` now returns articles with:
- `source_count`: Number of sources
- `sources`: List of all source articles
- `version`: Version number
- `updated_at`: Last update timestamp

Display these in your UI:
- "📰 X sources" badge
- "✨ Updated Xm ago" badge (if version > 1)
- Source list in article detail
- Update history timeline

---

## 💰 Cost Savings

### Before (Individual Articles)

```
500 RSS articles
→ 100 approved (Step 1)
→ 100 articles processed (Steps 2-6)
= 100 × $0.02 = $2.00/day
```

### After (Clustered)

```
500 RSS articles
→ 100 approved (Step 1)
→ 30 clusters created (Step 1.5)
→ 30 articles processed (Steps 2-6)
= 30 × $0.02 = $0.60/day

Savings: 70% cost reduction!
```

Plus:
- Better article quality (multi-source)
- Real-time updates
- Source attribution
- Update history

---

## 🐛 Troubleshooting

### Issue: Articles not clustering

**Check:**
1. Keywords extracted? `print(article['keywords'])`
2. Title similarity? Test with `calculate_title_similarity()`
3. Active clusters exist? Check `get_active_clusters()`

**Fix:**
- Lower `TITLE_SIMILARITY_THRESHOLD` (default 0.75)
- Lower `KEYWORD_MATCH_THRESHOLD` (default 3)

### Issue: Updates not triggering

**Check:**
1. Cooldown period? (30 minutes minimum)
2. Score threshold? (850 for high-score trigger)
3. Volume threshold? (4 sources for volume trigger)

**Fix:**
- Check `article_updates_log` table
- Verify `last_updated_at` timestamps
- Run `scan_for_updates()` manually

### Issue: Daemon not running

**Check:**
1. Process running? `ps aux | grep cluster_monitor`
2. Errors in logs? `tail -f cluster_monitor.log`
3. Environment variables set?

**Fix:**
```bash
# Kill old process
pkill -f cluster_monitor_daemon

# Restart
python cluster_monitor_daemon.py
```

---

## 📈 Success Metrics

Target metrics (from plan):
- ✅ **Clustering accuracy**: >90%
- ✅ **Article freshness**: <2 hours
- ✅ **Update responsiveness**: High-score updates within 5 minutes
- ✅ **Source diversity**: Average 5+ sources per article
- ✅ **Cost efficiency**: 50-70% reduction

Track with:
```python
from api_feed_ranking import get_statistics
stats = get_statistics()
```

---

## 🔄 Migration from Old System

### Phase 1: Run Both Systems in Parallel (Week 1)
- Keep old pipeline running
- Run new clustered pipeline separately
- Compare output quality

### Phase 2: Gradual Cutover (Week 2)
- Process 50% articles with new system
- Monitor clustering accuracy
- Adjust thresholds if needed

### Phase 3: Full Migration (Week 3)
- Stop old pipeline
- Full clustering for all articles
- Enable real-time updates

### Phase 4: Cleanup (Week 4)
- Archive old articles
- Optimize database
- Monitor performance

---

## 📚 API Reference

### GET /api/feed

Returns ranked news feed.

**Query Params:**
- `limit`: Number of articles (default: 50)
- `offset`: Pagination offset (default: 0)
- `category`: Filter by category (optional)

**Response:**
```json
{
  "articles": [
    {
      "id": 1,
      "title_news": "European Central Bank raises rates to 4.5%",
      "source_count": 5,
      "version": 2,
      "sources": [...]
    }
  ],
  "count": 50,
  "updated_at": "2025-11-19T10:00:00Z"
}
```

### GET /api/article/{id}

Returns full article with update history.

**Response:**
```json
{
  "id": 1,
  "title_news": "...",
  "content_news": "...",
  "sources": [...],
  "update_history": [
    {
      "updated_at": "2025-11-19T09:00:00Z",
      "trigger_type": "high_score",
      "sources_added": 2
    }
  ]
}
```

---

## 🎯 Next Steps

1. **Run database migration** → `supabase_clustering_schema.sql`
2. **Test clustering** → `python step1_5_event_clustering.py`
3. **Test synthesis** → `python step3_multi_source_synthesis.py`
4. **Run full pipeline** → `python complete_clustered_news_workflow.py`
5. **Start daemon** → `python cluster_monitor_daemon.py`
6. **Deploy API** → `python api_feed_ranking.py`
7. **Monitor and optimize** → Check logs and adjust thresholds

---

## 📞 Support

For issues or questions:
1. Check troubleshooting section above
2. Review error logs
3. Test individual components
4. Adjust configuration in each module

---

**System is ready! 🎉**

Start with database migration, then test each component before deploying to production.

