# 📊 COMPLETE SYSTEM COMPARISON: OLD vs NEW (WITH CLUSTERING)

---

## 🔵 OLD SYSTEM (Without Clustering)
**Command**: `./RUN_LIVE_CONTINUOUS_SYSTEM.sh`

### Pipeline Flow (6 Steps):

```
📰 RSS (171 sources)
    ↓
🎯 Gemini Score (each article individually)
    ↓
📡 ScrapingBee Fetch (each article individually)
    ↓
✍️  Claude Write (each article individually)
    ↓
🔍 Perplexity Search (for components)
    ↓
📊 Claude Components (timeline/details/graph)
    ↓
💾 Publish to Supabase
```

---

### 📝 DETAILED STEPS - OLD SYSTEM

---

#### **STEP 0: RSS Fetch**
- **What happens**: Fetches from 171 RSS sources
- **API calls**: None (just HTTP requests to RSS feeds)
- **Processing**: Each article saved individually
- **Output**: 100-200 articles per cycle

---

#### **STEP 1: Gemini Scoring** ⚡ **API CALL #1**
**API**: Google Gemini 2.0 Flash
**Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`

**System Prompt Sent**:
```
# TEN NEWS - AI ARTICLE SCORING SYSTEM V6.0 - BUSINESS/TECH/SCIENCE PRIORITY

## YOUR ROLE
You are an expert news editor for Ten News, a PREMIUM news platform. Your job is to score articles on a scale of 0-1000 points. Stories scoring 700+ are automatically published.

## TARGET AUDIENCE
- Primary: Educated professionals wanting daily global briefings AND learning about business/tech/science developments
- Secondary: Curious generalists seeking interesting, shareable stories
- Goal: Inform about global developments AND educate about business/tech/science breakthroughs
- Standard: PREMIUM news - substantial events, major deals, breakthrough discoveries

## CRITICAL: BUSINESS/TECH/SCIENCE ARE ACTUAL EVENTS
These are NOT filler - these are ACTUAL EVENTS:
✅ Stock buybacks announced ($5B+) = Financial event
✅ M&A deals announced/completed ($2B+) = Business event
✅ Funding rounds ($500M+) = Investment event
✅ Earnings reports (Fortune 500, market-moving) = Financial event
✅ CEO resignations (major companies) = Leadership event
✅ AI model releases (breakthrough performance) = Tech event
✅ Product launches (significant features) = Innovation event
✅ Space discoveries (exoplanets, missions) = Science event
✅ Medical breakthroughs (new treatments) = Science event
✅ Consumer health studies (chocolate, coffee) = Science event

## CORE SCORING CRITERIA

### 1. GLOBAL REACH & IMPACT - 400 POINTS MAX
350-400 points: Affects/interests BILLIONS globally
250-300 points: Affects/interests 500M-2B people
150-200 points: Affects/interests 100M-500M people
100-150 points: Affects/interests 10M-100M people
50-90 points: Affects/interests 1M-10M people
0-40 points: Affects/interests under 1M people

### 2. TIMELINESS & URGENCY - 300 POINTS MAX
250-300 points: BREAKING - happening now, developing situation
150-200 points: Very recent (past 24 hours), still unfolding
100-150 points: Recent (past 48 hours), newsworthy
50-90 points: Few days old but still relevant
0-40 points: Old news or planned event

### 3. SHAREABILITY & INTEREST - 300 POINTS MAX
250-300 points: Extraordinary, shocking, unprecedented
150-200 points: Highly interesting, surprising, significant
100-150 points: Notable, worth discussing
50-90 points: Mildly interesting
0-40 points: Dry, technical, niche

[... more scoring rules ...]
```

**User Prompt Sent** (for batch of 30 articles):
```json
[
  {
    "title": "Nvidia's upbeat forecast for future demand calms 'AI bubble' fears",
    "description": "Chipmaker expects another record quarter as CEO Jensen Huang says 'there is no evidence' of slowdown",
    "url": "https://www.telegraph.co.uk/...",
    "source": "The Telegraph"
  },
  {
    "title": "Israel strikes kill 32 Palestinians in Gaza",
    "description": "...",
    "url": "...",
    "source": "BBC News"
  }
  // ... 28 more articles
]
```

**Output Received**:
```json
[
  {
    "title": "Nvidia's upbeat forecast...",
    "score": 820,
    "status": "APPROVED",
    "category": "Technology",
    "reasoning": "Major AI chip company affecting billions..."
  },
  {
    "title": "Israel strikes...",
    "score": 750,
    "status": "APPROVED",
    "category": "International"
  }
  // ... results for all 30
]
```

**Processing**: 
- Batches of 30 articles
- Each article scored individually
- Total API calls: ~4-7 calls for 100-200 articles

---

#### **STEP 2: ScrapingBee Full Text Fetch** ⚡ **API CALL #2**
**API**: ScrapingBee
**Endpoint**: `https://app.scrapingbee.com/api/v1/`

**Request per article**:
```
GET https://app.scrapingbee.com/api/v1/?api_key=XXX&url=https://www.bbc.com/news/article-123&render_js=false
```

**Response**:
```html
<html>
  <article>
    Full article text here...
    [~1000-3000 words]
  </article>
</html>
```

**Processing**:
- One API call per approved article
- Extracts full text from HTML
- Timeout: 10s per article
- Total API calls: 100-150 calls (one per approved article)

---

#### **STEP 3: Claude Article Writing** ⚡ **API CALL #3**
**API**: Anthropic Claude Sonnet 4.5
**Endpoint**: `https://api.anthropic.com/v1/messages`

**System Prompt Sent**:
```
You are a professional news writer for Ten News. Write comprehensive articles based on the source article provided.

CRITICAL RULES:
1. Write as if you're reporting firsthand - NEVER mention "according to sources"
2. Use objective, journalistic tone
3. Generate content in TWO languages: Advanced (news) and Simplified (B2)

OUTPUT STRUCTURE:
1. Title (news version) - Advanced language, journalistic
2. Title (B2 version) - Simplified language
3. Summary bullets (news) - 3-5 key points, advanced language
4. Summary bullets (B2) - 3-5 key points, simplified language
5. Article content (news) - 200 words, advanced language
6. Article content (B2) - 200 words, simplified language

Return ONLY valid JSON with these exact keys.
```

**User Prompt Sent** (per article):
```
Write a news article based on this source:

TITLE: Nvidia's upbeat forecast for future demand calms 'AI bubble' fears

FULL TEXT: [Full article content from ScrapingBee, ~1000-3000 words]

INSTRUCTIONS:
- Write ONE comprehensive article synthesizing the key information
- Generate dual-language versions (news + B2)
- 200 words per version
- Follow inverted pyramid structure

OUTPUT FORMAT (JSON):
{
  "title_news": "Advanced journalistic title with **bold** key terms",
  "title_b2": "Simplified title with **bold** key terms",
  "summary_bullets_news": ["Key point 1", "Key point 2", "Key point 3"],
  "summary_bullets_b2": ["Simpler point 1", "Simpler point 2", "Simpler point 3"],
  "content_news": "200-word article in advanced language...",
  "content_b2": "200-word article in simplified language..."
}
```

**Output Received**:
```json
{
  "title_news": "**Nvidia** Projects Record Revenue as AI Demand Surges to **$57 Billion**",
  "title_b2": "**Nvidia** Says AI Business Will Reach **$57 Billion**",
  "summary_bullets_news": [
    "Nvidia forecasts $57B quarterly revenue, exceeding analyst expectations",
    "CEO Jensen Huang dismisses AI bubble concerns citing strong demand",
    "Stock rises 5% in after-hours trading on earnings beat"
  ],
  "summary_bullets_b2": [
    "Nvidia expects to make $57 billion next quarter from AI chips",
    "Company boss says there is no AI bubble problem",
    "Stock price went up 5% after the news"
  ],
  "content_news": "Nvidia Corporation announced...",
  "content_b2": "Nvidia, the AI chip company, said..."
}
```

**Processing**:
- One API call per approved article
- Each article written independently
- Total API calls: 100-150 calls (one per article)

---

#### **STEP 4: Gemini Component Selection** ⚡ **API CALL #4**
**API**: Google Gemini 2.0 Flash
**Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`

**System Prompt Sent**:
```
You are analyzing news article TITLES to select the MOST RELEVANT visual components.

AVAILABLE COMPONENTS (select 1-3 of these, ONLY if truly relevant):
1. timeline - Historical events and chronology
2. details - Key facts, numbers, statistics
3. graph - Data visualization and trends

SELECTION GUIDE:
📊 GRAPH - Choose for data/trend/comparison stories
📅 TIMELINE - Choose for evolving/historical stories
📋 DETAILS - Choose for fact-heavy stories

OUTPUT FORMAT:
{
  "components": ["graph", "details"],
  "emoji": "📈",
  "graph_type": "line",
  "graph_data_needed": "historical trend data"
}
```

**User Prompt Sent** (batch of 20):
```json
[
  {"title": "Nvidia Projects Record Revenue as AI Demand Surges to $57 Billion"},
  {"title": "Israel Strikes Kill 32 Palestinians in Gaza Despite Ceasefire"}
  // ... 18 more
]
```

**Output Received**:
```json
[
  {
    "components": ["graph", "details"],
    "emoji": "📈",
    "graph_type": "line",
    "graph_data_needed": "Nvidia revenue history"
  },
  {
    "components": ["details"],
    "emoji": "⚔️",
    "graph_type": null,
    "graph_data_needed": null
  }
]
```

**Processing**:
- Batches of 20 articles
- Total API calls: 5-8 calls for 100-150 articles

---

#### **STEP 5: Perplexity Context Search** ⚡ **API CALL #5**
**API**: Perplexity Sonar
**Endpoint**: `https://api.perplexity.ai/chat/completions`
**Note**: Currently using mock data due to API issues

**Prompt Sent** (per article):
```
Search for related contextual information about this news article. Find facts that are NOT already mentioned in the article below.

ARTICLE WRITTEN BY CLAUDE:
Title: Nvidia Projects Record Revenue as AI Demand Surges to $57 Billion
Summary: Nvidia forecasts $57B quarterly revenue...

SEARCH INSTRUCTIONS:

1. TIMELINE EVENTS (Background & Context):
Find 2-4 historical or related events that provide context to this news.
- Search for PREVIOUS events that led to this situation
- Search for RELATED developments in this topic area
- DO NOT include the main event from the title/summary
- Return: exact dates/times and what happened

2. KEY DATA POINTS (Related Statistics & Context):
Find 3 pieces of data that provide CONTEXT to this story.
- Search for BACKGROUND statistics and numbers
- Search for COMPARATIVE data (previous rates, historical benchmarks)
- DO NOT return data that is already mentioned in the title or summary
- Return: the most relevant contextual data

3. GRAPH DATA (If graph selected):
Find historical data points for visualization.
- At least 4-6 data points with dates
- Focus on trends over time
```

**Output Received**:
```
TIMELINE CONTEXT:
1. March 2023: Nvidia begins AI chip surge, revenue hits $10B
2. July 2023: First $20B revenue quarter announced
3. October 2023: Stock splits 10-for-1 amid demand
4. Q4 2024 forecast: Analysts expect continued growth

CONTEXTUAL DATA POINTS:
1. Previous Q3 revenue: $35.1B (up 62% YoY)
2. AI chip market share: 85% of data center GPUs
3. Stock price YTD: +180% gain

GRAPH DATA:
Q1 2023: $10B
Q2 2023: $18B
Q3 2023: $35B
Q4 2023: $57B (forecast)
```

**Processing**:
- One API call per article WITH components
- Total API calls: 80-120 calls (not all articles have components)

---

#### **STEP 6: Claude Component Generation** ⚡ **API CALL #6**
**API**: Anthropic Claude Sonnet 4.5
**Endpoint**: `https://api.anthropic.com/v1/messages`

**System Prompt Sent**:
```
You are generating supplementary components for a news article using web search context data.

Generate ONLY the selected components based on the provided context data.

=== TIMELINE ===
- 2-4 events in chronological order (oldest first)
- Each event: date + description (≤14 words)

Format:
[
  {"date": "Mar 2023", "event": "Nvidia begins AI chip surge with $10B revenue"},
  {"date": "Jul 2023", "event": "First $20B revenue quarter announced"}
]

=== DETAILS ===
- EXACTLY 3 data points
- Format: "Label: Value"
- EVERY detail MUST contain a NUMBER

Examples:
✓ "Previous revenue: $35.1B"
✓ "Market share: 85%"
✓ "Stock gain: +180%"

=== GRAPH ===
{
  "type": "line",
  "title": "Nvidia Revenue 2023-2024",
  "data": [
    {"date": "2023-03", "value": 10.0},
    {"date": "2023-07", "value": 18.0},
    {"date": "2023-10", "value": 35.0},
    {"date": "2024-01", "value": 57.0}
  ],
  "y_label": "Revenue ($B)",
  "x_label": "Quarter"
}

Return ONLY valid JSON with the selected components.
```

**User Prompt Sent** (per article):
```
Generate components for this article:

TITLE: Nvidia Projects Record Revenue as AI Demand Surges to $57 Billion

SELECTED COMPONENTS: ["graph", "details"]

PERPLEXITY CONTEXT DATA:
[The full context data from Step 5]

Generate the requested components using this context data.
```

**Output Received**:
```json
{
  "details": [
    "Previous revenue: $35.1B",
    "Market share: 85%",
    "Stock gain: +180%"
  ],
  "graph": {
    "type": "line",
    "title": "Nvidia Quarterly Revenue 2023-2024",
    "data": [
      {"date": "2023-03", "value": 10.0},
      {"date": "2023-07", "value": 18.0},
      {"date": "2023-10", "value": 35.0},
      {"date": "2024-01", "value": 57.0}
    ],
    "y_label": "Revenue ($B)",
    "x_label": "Quarter"
  }
}
```

**Processing**:
- One API call per article WITH components
- Total API calls: 80-120 calls

---

#### **STEP 7: Publish to Supabase**
- **What happens**: Saves completed article to database
- **API calls**: None (just database INSERT)
- **Data saved**: title, summary, content, components, emoji, etc.

---

### 📊 OLD SYSTEM SUMMARY

**Total API Calls Per 100 Articles**:
- Gemini Scoring: 4 calls (batches of 30)
- ScrapingBee: 100 calls (1 per article)
- Claude Writing: 100 calls (1 per article)
- Gemini Components: 5 calls (batches of 20)
- Perplexity: 80 calls (for articles with components)
- Claude Components: 80 calls (for articles with components)

**TOTAL: ~369 API calls for 100 articles**

**Cost Per 100 Articles**: ~$15-20

**Time Per Cycle**: ~15-20 minutes

**Problem**: Each article is processed independently, even if they're about the same event!

---
---

## 🟢 NEW SYSTEM (With Clustering)
**Command**: `./RUN_LIVE_CLUSTERED_SYSTEM.sh`

### Pipeline Flow (7 Steps):

```
📰 RSS (171 sources)
    ↓
🎯 Gemini Score (each article individually)
    ↓
🔗 CLUSTER (group similar articles) ← NEW!
    ↓
📡 ScrapingBee Fetch (all sources in cluster)
    ↓
✍️  Claude Synthesize (from ALL sources) ← CHANGED!
    ↓
🔍 Perplexity Search (for components)
    ↓
📊 Claude Components (timeline/details/graph)
    ↓
💾 Publish to Supabase
```

---

### 📝 DETAILED STEPS - NEW SYSTEM

---

#### **STEP 0: RSS Fetch**
**SAME AS OLD SYSTEM**
- Fetches from 171 RSS sources
- No API calls
- Output: 100-200 articles per cycle

---

#### **STEP 1: Gemini Scoring** ⚡ **API CALL #1**
**SAME AS OLD SYSTEM**
- Same prompts
- Same processing
- Output: 30-50 approved articles

---

#### **STEP 1.5: Event Clustering** 🆕 **NO API CALLS**
**What happens**: Groups similar articles about the same event

**Algorithm**:
1. **URL Normalization**:
   ```python
   normalize_url("https://www.bbc.com/news/tech-123?utm_source=rss")
   → "bbc.com/news/tech-123"
   ```

2. **Keyword/Entity Extraction**:
   ```python
   extract_keywords("Nvidia's upbeat forecast for AI demand")
   → ["nvidia", "forecast", "ai", "demand"]
   
   extract_entities("Nvidia's upbeat forecast...")
   → ["Nvidia", "AI"]
   ```

3. **Title Similarity Check**:
   ```python
   calculate_similarity(
     "Nvidia's upbeat forecast calms AI bubble fears",
     "Nvidia shrugs off AI bubble concerns with bumper forecast"
   )
   → 0.82 (82% similar) → MATCH!
   ```

4. **Keyword Overlap Check**:
   ```python
   article1_terms = ["nvidia", "ai", "bubble", "forecast"]
   article2_terms = ["nvidia", "ai", "bubble", "earnings"]
   shared = ["nvidia", "ai", "bubble"]  # 3 shared terms
   → MATCH! (threshold: 3+)
   ```

5. **Time Proximity Check**:
   ```python
   if abs(article1.published_at - cluster.created_at) < 24 hours:
       → MATCH!
   ```

**Example Clustering Result**:
```
CLUSTER 1: "Nvidia Revenue Soars"
  Source 1: Telegraph - "Nvidia's upbeat forecast calms AI bubble fears"
  Source 2: Financial Times - "Nvidia shrugs off AI bubble concerns"
  Source 3: TechCrunch - "Nvidia's record $57B revenue quiets AI bubble talk"
  Source 4: Wired - "Nvidia CEO Dismisses AI Bubble Concerns"
  → 4 articles clustered into 1 event

CLUSTER 2: "Israel Gaza Strikes"
  Source 1: BBC - "Israeli strikes kill at least 32 in Gaza"
  Source 2: Al Jazeera - "Israeli strikes across Gaza kill 25"
  Source 3: Reuters - "Israel strikes Gaza despite ceasefire"
  → 3 articles clustered into 1 event
```

**Processing**:
- No API calls (pure algorithm)
- Saves to database: `clusters` and `source_articles` tables
- Output: 10-20 clusters from 30-50 approved articles

---

#### **STEP 2: ScrapingBee Full Text Fetch** ⚡ **API CALL #2**
**CHANGED**: Fetches ALL sources in each cluster

**Request per cluster** (with 4 sources):
```
GET https://app.scrapingbee.com/api/v1/?url=https://www.telegraph.co.uk/...
GET https://app.scrapingbee.com/api/v1/?url=https://www.ft.com/...
GET https://app.scrapingbee.com/api/v1/?url=https://techcrunch.com/...
GET https://app.scrapingbee.com/api/v1/?url=https://www.wired.com/...
```

**Processing**:
- Fetches full text for ALL sources in cluster
- Total API calls: 30-50 calls (same as approved articles)

---

#### **STEP 3: Multi-Source Synthesis** ⚡ **API CALL #3**
**COMPLETELY NEW**: Synthesizes ONE article from MULTIPLE sources

**API**: Anthropic Claude Sonnet 4.5
**Endpoint**: `https://api.anthropic.com/v1/messages`

**System Prompt Sent**:
```
You are a professional news writer for Today+, a news platform that synthesizes information from multiple sources into comprehensive, original articles.

Your task is to write ONE news article by combining information from multiple source articles about the same event. You will be given N source articles from different news outlets (BBC, CNN, Reuters, etc.) covering the same story.

CRITICAL RULES:
1. Synthesize information from ALL sources - don't just rewrite one source
2. Write as if you're reporting firsthand - NEVER mention "according to sources"
3. When sources conflict (e.g., different death tolls), use the most recent/authoritative source or say "at least X"
4. Combine unique facts from each source to create the most complete picture
5. Weight information by source credibility and article score
6. Use objective, journalistic tone (inverted pyramid: most important first)
7. Generate content in TWO languages: Advanced (news) and Simplified (B2)

OUTPUT STRUCTURE:
1. Title (news version) - Advanced language, journalistic
2. Title (B2 version) - Simplified language
3. Summary bullets (news) - 3-5 key points, advanced language
4. Summary bullets (B2) - 3-5 key points, simplified language
5. Article content (news) - 200 words, advanced language
6. Article content (B2) - 200 words, simplified language

Return ONLY valid JSON with these exact keys.
```

**User Prompt Sent** (per cluster with 4 sources):
```
You are writing a news article by synthesizing information from 4 sources about the same event.

EVENT: Nvidia Revenue Soars Despite 'Disappointment' In China

SOURCE 1 (The Telegraph, Score: 850/1000):
Title: Nvidia's upbeat forecast for future demand calms 'AI bubble' fears
Content: Nvidia Corporation reported third-quarter revenue of $57 billion on Wednesday, surpassing analyst expectations... [full 1500-word article]

SOURCE 2 (Financial Times, Score: 820/1000):
Title: Nvidia shrugs off 'AI bubble' concerns with bumper chip demand
Content: The AI chipmaker posted quarterly sales that beat Wall Street forecasts, with CEO Jensen Huang dismissing concerns... [full 1200-word article]

SOURCE 3 (TechCrunch, Score: 780/1000):
Title: Nvidia's record $57B revenue and upbeat forecast quiets AI bubble talk
Content: Nvidia reported blockbuster earnings after the bell Wednesday, with revenue climbing 94% year-over-year... [full 1000-word article]

SOURCE 4 (Wired, Score: 750/1000):
Title: Nvidia CEO Dismisses Concerns of an AI Bubble
Content: Despite growing skepticism about artificial intelligence investments, Nvidia's latest earnings report... [full 900-word article]

INSTRUCTIONS:
1. Write ONE comprehensive article that synthesizes information from ALL 4 sources above
2. Combine the most important facts from each source
3. If sources disagree on facts, use the most recent source or say "at least X"
4. DO NOT quote sources or say "according to" - write as if you're reporting firsthand
5. Use clear, objective, journalistic style
6. Generate content in TWO language versions: NEWS (Advanced) and B2 (Simplified)

OUTPUT FORMAT (JSON):
{
  "title_news": "Advanced title with **bold** terms",
  "title_b2": "Simplified title with **bold** terms",
  "summary_bullets_news": [...],
  "summary_bullets_b2": [...],
  "content_news": "200-word synthesized article...",
  "content_b2": "200-word simplified version..."
}
```

**Output Received**:
```json
{
  "title_news": "**Nvidia** Reports Record **$57 Billion** Revenue as CEO Dismisses **AI Bubble** Concerns",
  "title_b2": "**Nvidia** Makes **$57 Billion**, Says No **AI Bubble** Problem",
  "summary_bullets_news": [
    "Nvidia posted $57B quarterly revenue, beating analyst forecasts by 8%",
    "CEO Jensen Huang dismissed AI bubble concerns citing strong enterprise demand",
    "Revenue grew 94% year-over-year despite China headwinds",
    "Stock surged 5% in after-hours trading following earnings beat"
  ],
  "summary_bullets_b2": [
    "Nvidia made $57 billion last quarter, more than expected",
    "Company boss says AI is not a bubble",
    "Sales grew 94% compared to last year",
    "Stock price went up 5% after the news"
  ],
  "content_news": "Nvidia Corporation reported record third-quarter revenue of $57 billion Wednesday, exceeding Wall Street expectations and demonstrating continued robust demand for artificial intelligence chips. The chipmaker's revenue surged 94% year-over-year, with CEO Jensen Huang dismissing growing skepticism about an AI bubble. 'There is no evidence of a slowdown,' Huang told investors during the earnings call, pointing to strong enterprise adoption and expanding data center infrastructure. The results showed particularly impressive growth in cloud computing and autonomous vehicle segments, offsetting some weakness in Chinese markets. Nvidia's data center business, which includes AI chips, generated $45 billion in revenue, representing nearly 80% of total sales. The company's forecast for the current quarter also exceeded analyst estimates, projecting $62 billion in revenue. Following the announcement, Nvidia shares rose 5% in extended trading, adding approximately $150 billion to its market capitalization. The strong performance reinforces Nvidia's position as the primary beneficiary of the AI infrastructure buildout, with customers including Microsoft, Amazon, and Google continuing to place substantial orders for its flagship H100 and upcoming H200 AI accelerators.",
  "content_b2": "Nvidia, the AI chip company, announced it made $57 billion last quarter. This is much more money than experts expected. The company sold 94% more products than the same time last year. Many people worry that AI companies are spending too much money and creating a 'bubble' that will pop. But Nvidia's CEO Jensen Huang said there is no bubble. He says companies still want to buy many AI chips. Nvidia's biggest business is selling chips to data centers. These are large buildings with many computers. Companies like Microsoft and Google buy Nvidia chips for their AI systems. Data center sales made $45 billion, which is 80% of all Nvidia's money. The company thinks it will make even more money next quarter - about $62 billion. After Nvidia shared this news, its stock price went up 5%. This means the company is now worth $150 billion more. Nvidia is the most important company making chips for AI. Big tech companies keep buying its products to build better AI systems."
}
```

**Key Differences from Old System**:
- ✅ ONE article created from 4 sources (vs 4 separate articles)
- ✅ More comprehensive (combines unique facts from each source)
- ✅ Resolves conflicts (e.g., "at least 32" vs "25" casualties)
- ✅ Higher quality (synthesizes best information)
- ✅ Reduces API calls (1 call vs 4 calls)

**Processing**:
- One API call per cluster (not per article!)
- Total API calls: 10-20 calls (one per cluster)
- **HUGE SAVINGS**: 10-20 calls vs 100 calls in old system!

---

#### **STEP 4: Gemini Component Selection** ⚡ **API CALL #4**
**SAME AS OLD SYSTEM**
- Same prompts
- Same processing
- Total API calls: 1-2 calls

---

#### **STEP 5: Perplexity Context Search** ⚡ **API CALL #5**
**SAME AS OLD SYSTEM**
- Same prompts
- Same processing
- Total API calls: 8-15 calls

---

#### **STEP 6: Claude Component Generation** ⚡ **API CALL #6**
**SAME AS OLD SYSTEM**
- Same prompts
- Same processing
- Total API calls: 8-15 calls

---

#### **STEP 7: Publish to Supabase**
**CHANGED**: Now includes clustering metadata

**Data saved**:
- `published_articles` table: The synthesized article
- `clusters` table: Cluster metadata
- `source_articles` table: Links to original sources
- `article_updates_log` table: Version history (when new sources added)

---

### 📊 NEW SYSTEM SUMMARY

**Total API Calls Per 100 RSS Articles** (clustered into ~20 final articles):
- Gemini Scoring: 4 calls (batches of 30)
- ScrapingBee: 100 calls (1 per original article)
- **Claude Synthesis: 20 calls** (1 per cluster) ← **80% REDUCTION!**
- Gemini Components: 1 call (batch of 20 clusters)
- Perplexity: 15 calls (for clusters with components)
- Claude Components: 15 calls (for clusters with components)

**TOTAL: ~155 API calls** (vs 369 in old system)

**Cost Per 100 Articles**: ~$8-10 (vs $15-20)

**Time Per Cycle**: ~12-15 minutes (vs 15-20 minutes)

**Quality**: MUCH HIGHER - synthesizes multiple sources!

---
---

## 🎯 KEY DIFFERENCES SUMMARY

| Feature | OLD System | NEW System |
|---------|-----------|------------|
| **Articles per event** | 4 separate articles | 1 synthesized article |
| **Claude API calls** | 100 | 20 (80% reduction) |
| **Total API calls** | 369 | 155 (58% reduction) |
| **Cost** | $15-20 | $8-10 (50% reduction) |
| **Quality** | Single source | Multi-source synthesis |
| **Duplicate coverage** | Yes (same event 4x) | No (1 comprehensive article) |
| **Conflict resolution** | No | Yes (combines sources) |
| **Source tracking** | No | Yes (links to all sources) |
| **Updates** | No | Yes (can add new sources) |

---

## 🔥 MAIN ADVANTAGE

**OLD**: 
```
Nvidia article #1 (Telegraph) → Published
Nvidia article #2 (FT) → Published  
Nvidia article #3 (TechCrunch) → Published
Nvidia article #4 (Wired) → Published

Result: 4 articles about the same event! Users see duplicates.
```

**NEW**:
```
Nvidia sources: Telegraph + FT + TechCrunch + Wired
    ↓ Claude synthesizes
ONE comprehensive article combining all sources!

Result: 1 article with complete coverage from 4 sources.
Users see unique, high-quality synthesis.
```

---

## 💡 CONCLUSION

The **NEW clustered system**:
- ✅ Saves 58% on API calls
- ✅ Saves 50% on costs
- ✅ Eliminates duplicate articles
- ✅ Creates higher quality multi-source synthesis
- ✅ Tracks source lineage
- ✅ Enables real-time updates when new sources arrive

**The prompts sent to APIs are IDENTICAL for Steps 4-6, but NEW synthesis prompts in Step 3 enable multi-source intelligence!**

