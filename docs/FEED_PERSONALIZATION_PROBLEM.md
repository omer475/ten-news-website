# Ten News — Feed Personalization Problem Brief

## What We Are

A personalized news app (iOS, TikTok-style vertical swipe feed). Users onboard by selecting their home country, followed countries, and followed topics (from 40+ subtopics across 8 categories: Politics & World, Business & Finance, Technology, Science & Space, Health, Sports, Entertainment, Lifestyle).

## How the System Works

### Content Pipeline (runs every 10 minutes on Cloud Run)
1. **RSS Collection**: 445 RSS feeds across 24 categories (news, sports, gaming, tech, entertainment, food, fashion, etc.)
2. **AI Scoring & Filtering** (Gemini): Each article scored 0-1000 for global newsworthiness. Articles below threshold filtered out.
3. **Event Clustering**: Groups related articles about the same event
4. **Full Article Fetching**: Fetches full text via BrightData
5. **Multi-Source Synthesis**: Merges multiple source articles into one balanced piece (Gemini 2.0 Flash)
6. **Component Generation**: Creates timeline, 5Ws, map, graph, details components
7. **Final Scoring** (step10): AI scores the synthesized article 0-1000 with category-aware guidelines
8. **Tagging**: Assigns interest_tags, categories, countries, topics
9. **Publishing**: Publishes to Supabase (PostgreSQL + pgvector)

### Feed Algorithm (Next.js API, `pages/api/feed/main.js`)

The feed serves personalized article selections. Key mechanisms:

#### For users WITH engagement history (taste vector exists):
- **Personal pool**: pgvector similarity search against user's taste vector (embedding of engaged articles)
- **Trending pool**: High-scoring recent articles (score >= 750, last 24h)
- **Discovery pool**: Everything else (score >= 200, last 48-72h)
- **Slot pattern**: ~60-70% Personal, 20% Trending, 10-20% Surprise/Discovery
- **MMR diversity**: Maximal Marginal Relevance prevents topic flooding
- **Tag saturation**: Limits same-tag articles, caps categories at 5 per page
- **World event dedup**: Max 4 articles per world event/cluster

#### For cold-start users (no taste vector, just onboarding):
- **No personal pool** (no engagement data yet)
- **Combined pool**: Fetched by `ORDER BY ai_final_score DESC LIMIT 2000` with score >= 200
- **Thompson Sampling bandit**: Groups articles by category, samples categories proportional to Beta priors
- **Onboarding warm-start**: Adds alpha to bandit priors for selected categories (e.g., selecting "basketball" boosts Sports category prior)
- **Session momentum**: Adapts in real-time based on engaged/skipped articles within a session

#### Onboarding Topic Mapping:
Each onboarding topic maps to interest tags and a category:
```
basketball → tags: ['basketball', 'nba', 'lebron', 'lakers'], category: 'Sports'
gaming → tags: ['gaming', 'video games', 'esports', 'playstation', 'xbox', 'nintendo'], category: 'Gaming'
ai → tags: ['artificial intelligence', 'machine learning', 'ai', 'chatgpt', 'openai'], category: 'Tech'
football → tags: ['football', 'soccer', 'premier league', 'champions league'], category: 'Sports'
```

## The Problem

### User Testing Results: 33/100 satisfaction, 1/20 would return

We tested with 20 diverse personas. The feed is essentially a politics/world news app regardless of what users select.

### Score Distribution (the root cause)

| Category | Median Score | 750+ articles (48h) | 900+ articles (48h) |
|----------|-------------|---------------------|---------------------|
| Politics | 780 | 373 | 24 |
| World | 780 | 247 | 61 |
| Business | 680 | 108 | 3 |
| Tech | 700 | 54 | 0 |
| Sports | **580** | **56** | **0** |
| Entertainment | **480** | **7** | **0** |
| Lifestyle | **350** | **0** | **0** |
| Food | **580** | **2** | **0** |
| Gaming | **350** | **0** | **0** |

Politics/World median is 780. Sports is 580. Entertainment is 480. Gaming is 350. The scoring system inherently values "global impact" which favors geopolitical events over a Premier League match or a game release.

### Published Article Distribution (48h snapshot)
- Politics + World = **37%** of all published articles
- Sports = 20%, Entertainment = 13%, Tech = 4%
- Gaming = **0.2%** (101 articles EVER despite 23 gaming RSS feeds)
- Food = 0.6%, Fashion = 0.3%, Lifestyle = 0.1%

### How This Kills the Feed

1. **Pool construction**: `ORDER BY ai_final_score DESC LIMIT 2000` fills the pool with politics (scoring 780+) before sports (580) or gaming (350) even appear
2. **Thompson Sampling can't help**: Even when the bandit selects "Sports" as a category, the sports pool has very few articles because they scored too low to make the global pool
3. **Trending threshold**: `trendingScoreFloor = 750` means zero sports/entertainment/gaming articles qualify as "trending"
4. **The onboarding boost is cosmetic**: Adding 2 to alpha (from 1→3) in a Beta distribution doesn't overcome empty pools

### What Users Actually Said

**Marco (sports editor, 19/100)**: "I selected 5 sports topics. In 3 sessions I saw almost zero sports content. I got Iran politics, oil prices, and tech news."

**Taemin (esports player, 21/100)**: "Zero gaming news. Zero esports. Zero hardware reviews. I selected gaming as #1 interest. Ignored completely."

**Lena (AI researcher, 29/100)**: "In 3 sessions I found maybe 2-3 AI articles. Hacker News gives me a better AI/tech feed with zero personalization."

**Priya (film journalist, 23/100)**: "I expected movie trailers, streaming news. Got wall-to-wall politics. Instagram Reels gives me better entertainment news from the algorithm watching what I like."

**Diego (crypto analyst, 21/100)**: "Almost nothing crypto. The app has 10 crypto RSS feeds. Sources exist but the algorithm does not surface them."

**Carlos (environmental reporter, 34/100)**: "Guardian Wildlife, Climate Home News, Carbon Brief are literally in this app's source list. The algorithm just does not surface them for me."

**Devon (college linebacker, 25/100)**: "This app showed me like one sports article. I am a linebacker. I live and breathe NFL. Show me draft picks and trade rumors."

**Robert (retired, HIGHEST at 55/100)**: "It is okay. Reminds me of Apple News. But Apple News already does this. This app would need to do something special to make me switch."

### Pattern: Only users who wanted politics were somewhat satisfied
- Nadia (geopolitics professor): 54/100
- Henrik (diplomat): 45/100
- Mike (military/politics): 42/100
- Everyone else (sports, tech, gaming, entertainment, lifestyle): 19-38/100

## What We've Already Done (Not Yet Deployed)

### Fix 1: Interest Category Enrichment
For cold-start users with onboarding preferences, we now run per-category database queries to fetch articles for each interest category. Previously, Sports/Gaming/Lifestyle articles were excluded from the pool because they scored too low to make the global top-2000.

### Fix 2: Quota-Based Pre-Fill
Before Thompson Sampling runs, 70% of feed slots are now reserved for interest categories, allocated proportionally to the user's onboarding selections. A sports fan selecting 5 sports topics gets ~14/20 sports articles + 6 diversity/trending. Thompson Sampling fills the remaining 30% for diversity.

## What We Need Help With

These fixes address pool composition and slot allocation, but deeper problems remain:

1. **Scoring bias**: The AI scoring prompt inherently gives politics 780+ and sports 580. Should we normalize scores by category? Or change the scoring prompt to score categories on their own scale?

2. **Content gap**: Gaming has 23 RSS feeds but only 101 published articles ever. Food/Fashion/Lifestyle barely exist. Is the filtering step too aggressive for niche content? Or do these RSS feeds not produce enough volume?

3. **Category granularity**: Users say "politics" but mean different things — Fatima wants Supreme Court decisions, Henrik wants NATO policy, Mike wants Pentagon budgets. The current category system is too coarse. How should we handle sub-category personalization?

4. **Cold start speed**: TikTok learns in 30 minutes. Our app has 3 sessions and still gets it wrong. Even with onboarding, the first page needs to be highly relevant. What's the fastest path to personalization?

5. **Depth vs breadth**: Nadia (professor) wants Foreign Affairs-level analysis. Robert (retiree) wants Apple News breadth. How do we detect and serve different depth preferences?

6. **The "so what" problem**: Even if we fix personalization, Robert's comment is damning — "Apple News already does this." What's the unique value proposition beyond personalization? Multi-source synthesis? Interactive components (timeline, map, graph)? Something else?

## Key Files
- `pages/api/feed/main.js` — Feed algorithm (1500+ lines)
- `step10_article_scoring.py` — AI scoring prompt (score 0-1000)
- `step1_gemini_news_scoring_filtering.py` — Initial article filtering
- `step11_article_tagging.py` — Interest tag assignment
- `rss_sources.py` — 445 RSS feeds
- `complete_clustered_8step_workflow.py` — Full pipeline orchestrator

## Constraints
- Pipeline runs every 10 minutes, processes ~3000-4000 articles per run
- Gemini 2.0 Flash for AI processing (cost-efficient)
- Supabase PostgreSQL + pgvector for storage and similarity search
- iOS app with SwiftUI, TikTok-style vertical swipe feed
- Single developer, needs to be maintainable
