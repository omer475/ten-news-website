# Today+ Feed Algorithm: Deep Analysis Report
### Real User Session — April 15, 2026
### Prepared for Academic Review

---

## Table of Contents
1. [Platform Context](#1-platform-context)
2. [Algorithm Architecture](#2-algorithm-architecture)
3. [User Profile Under Analysis](#3-user-profile-under-analysis)
4. [Session Overview: April 15, 2026](#4-session-overview)
5. [Category-Level Performance](#5-category-level-performance)
6. [Pool/Bucket Performance](#6-pool-bucket-performance)
7. [Article-by-Article Deep Dive](#7-article-by-article-deep-dive)
8. [Home Country (Turkiye) Analysis](#8-turkiye-analysis)
9. [Skip Profile System Bug](#9-skip-profile-bug)
10. [Interest Detection Accuracy](#10-interest-detection)
11. [Recommendations](#11-recommendations)
12. [Appendix: Raw Data Tables](#appendix)

---

## 1. Platform Context

**Today+** is a mobile content platform (iOS) that delivers personalized news and content across all topics — politics, sports, tech, cooking, fashion, etc. It competes with TikTok and Instagram's content discovery model: a vertical-swipe feed where users scroll through article cards. Users see a title and image first (tap-to-reveal model), then decide whether to engage.

The feed algorithm runs server-side (Node.js on Vercel, Supabase/PostgreSQL backend) and must select ~25 articles per feed load from a pool of ~10,000+ active articles. The goal is to maximize user engagement (time spent reading, likes, bookmarks) while maintaining content diversity and discovery.

**Current version**: V23 (embedding-first architecture with 11 algorithm fixes)

---

## 2. Algorithm Architecture

### 2.1 Overview

The feed uses a **multi-pool architecture** with 5 content sources that are independently scored and then interleaved:

```
                    ┌─────────────────────────────────────────┐
                    │           USER REQUEST                   │
                    │  (userId, seenIds, sessionState)         │
                    └────────────────┬────────────────────────┘
                                     │
                    ┌────────────────▼────────────────────────┐
                    │      PHASE 1: PARALLEL DATA LOADING      │
                    │                                          │
                    │  ┌──────────┐ ┌──────────┐ ┌──────────┐│
                    │  │ PERSONAL │ │ TRENDING │ │DISCOVERY ││
                    │  │ pgvector │ │ top score│ │  7-day   ││
                    │  │ ANN→500  │ │ 48h→200  │ │ pool→500 ││
                    │  └──────────┘ └──────────┘ └──────────┘│
                    └────────────────┬────────────────────────┘
                                     │
                    ┌────────────────▼────────────────────────┐
                    │      PHASE 2: SESSION MOMENTUM           │
                    │  Tag boosts from engaged articles         │
                    │  Skip penalties from skipped articles     │
                    │  Session taste vector (adaptive blend)    │
                    └────────────────┬────────────────────────┘
                                     │
                    ┌────────────────▼────────────────────────┐
                    │      PHASE 3: CLUSTER ALLOCATION         │
                    │  Multi-interest proportional slots        │
                    │  (e.g. 80% Galatasaray + 20% AI)         │
                    └────────────────┬────────────────────────┘
                                     │
                    ┌────────────────▼────────────────────────┐
                    │      PHASE 5: SCORING                    │
                    │                                          │
                    │  Personal: vector×500 + entity×200       │
                    │           + quality×200 + fresh×100      │
                    │           + momentum×150 − skip_penalty  │
                    │                                          │
                    │  Trending: ai_score × recency_decay      │
                    │           × skip_multiplier              │
                    │                                          │
                    │  Discovery: ai_score × recency           │
                    │            × category_boost × surprise   │
                    │            × skip_multiplier             │
                    │                                          │
                    │  All pools: × category_suppression       │
                    └────────────────┬────────────────────────┘
                                     │
                    ┌────────────────▼────────────────────────┐
                    │  PHASE 5.5: ENTITY BLOCKLIST + DEDUP     │
                    │  World event cap (4 per event)            │
                    │  Cluster cap (4 per story cluster)        │
                    │  Global entity blocklist (skip≥3)         │
                    └────────────────┬────────────────────────┘
                                     │
                    ┌────────────────▼────────────────────────┐
                    │  PHASE 6: INTERLEAVING + MMR             │
                    │  Slot pattern: P,T,D,T,P,D,T,P...       │
                    │  MMR (λ=0.7): score vs. diversity        │
                    │  Max 2 consecutive same-category          │
                    │  Duplicate ceiling: cosine > 0.82         │
                    └────────────────┬────────────────────────┘
                                     │
                    ┌────────────────▼────────────────────────┐
                    │  FINAL: 25 articles returned to client    │
                    │  + impression logging                     │
                    └─────────────────────────────────────────┘
```

### 2.2 Five Content Pools Explained

| Pool | Source | Time Window | Purpose | Selection Method |
|------|--------|-------------|---------|-----------------|
| **Personal** | pgvector ANN search against user's taste vector | Tiered: 48h → 7d → 14d | Content matching user's learned embedding preferences | Cosine similarity to taste_vector (384-dim MiniLM) |
| **Trending** | Top `ai_final_score` articles | 48 hours | High editorial quality, recent articles | Editorial score (AI-assigned 0-1000) × recency decay |
| **Discovery** | Quality articles from wider pool | 7 days | Serendipitous finds outside user's comfort zone | Score × anti-personal-category boost (1.5×) × random surprise |
| **Fresh_best** | Newest high-scoring articles | 24 hours | Breaking/important news | Recency-weighted score |
| **Pivot** | Exploration/diversity articles | Variable | Force exposure to new categories | Assigned when the interleaver detects monotony |

### 2.3 Scoring Formula (Personal Pool — Most Important)

```
scoreArticleV3(article):
    vectorScore = longTermSimilarity × (1 - sessionWeight) + sessionSimilarity × sessionWeight
        where sessionWeight = min(0.85, 0.30 + sessionInteractions × 0.03)

    entityBonus = Σ(entity_affinity × 0.10) for matching tags, capped at 0.30
    quality = ai_final_score / 1000
    freshness = max(0, 0.10 × (1 - ageHours / maxShelfLifeHours))
    momentum = session_boost (from recently engaged tags)

    baseScore = vectorScore×500 + entityBonus×200 + quality×200 + freshness×100 + momentum×150

    skipPenalty = Σ(skip_profile[tag]) for article tags, capped at 0.80
    skipMultiplier = max(0.10, 1.0 - skipPenalty)

    FINAL = baseScore × skipMultiplier × categorySuppression
```

### 2.4 Interaction Tracking

The app tracks every user interaction as events in `user_article_events`:

| Event Type | Meaning | Dwell Tiers |
|------------|---------|-------------|
| `article_view` | User saw the card (3-6 seconds) | `glance` (3-6s) |
| `article_engaged` | User read the article | `light_read` (6-10s), `engaged_read` (10-20s), `deep_read` (20-45s), `absorbed` (45s+) |
| `article_skipped` | User scrolled past quickly | `instant_skip` (<1s), `quick_skip` (1-3s) |
| `article_liked` | User tapped the heart button | — |
| `article_saved` | User bookmarked the article | — |
| `article_exit` | User left the article view | Records total_active_seconds |
| `article_revisit` | User scrolled back to re-read | — |

---

## 3. User Profile Under Analysis

| Field | Value | Significance |
|-------|-------|-------------|
| **Email** | soganciogluomer@gmail.com | Primary test user (app creator) |
| **User ID** | `5082a1df-24e4-4a39-a0c0-639c4de70627` | — |
| **Home Country** | `turkiye` | Should influence personal pool and scoring |
| **Followed Countries** | `[]` (empty) | No additional country boosts |
| **Followed Topics** | `[]` (empty) | No onboarding topic selections used |
| **Articles Read (all time)** | 1,496 | Heavy user — mature taste profile expected |
| **Account Created** | Nov 12, 2025 | 5+ months of history |
| **Last Activity** | Apr 15, 2026 17:53 UTC | The session under analysis |
| **Similarity Floor** | 0.2194 | Minimum cosine similarity for personal pool articles |

### 3.1 Tag Profile (What the Algorithm Thinks the User Likes)

The `tag_profile` is a dictionary of tag-to-weight mappings, learned incrementally from engagement history. Here are the top 30:

| Rank | Tag | Weight | Correct? |
|------|-----|--------|----------|
| 1 | artificial intelligence | 1.000 | **Yes** — user deeply reads AI articles |
| 2 | stock market | 0.984 | **Yes** — user engages with market analysis |
| 3 | health | 0.938 | **Yes** — user reads health breakthroughs |
| 4 | nasa | 0.754 | **Partially** — user likes space through NASA but not all space content |
| 5 | donald trump | 0.650 | **Questionable** — user only engaged 1 Trump article (absurd claim), skips most |
| 6 | madrid | 0.610 | **Partially** — user liked vertical gardens in Madrid, not persistent interest |
| 7 | openai | 0.508 | **Yes** — sub-interest of AI |
| 8 | business | 0.500 | **Yes** — user's strongest category |
| 9 | cancer | 0.484 | **Partially** — reads cancer breakthroughs, not cancer news generally |
| 10 | iran | 0.460 | **Wrong** — user skips most Iran war content; only reads when economic angle |
| ... | ... | ... | ... |
| 24 | **turkiye** | **0.352** | **SEVERELY UNDERWEIGHTED** — 25% like rate on Turkiye articles |
| 25 | artemis ii | 0.352 | One-time engagement, not persistent |
| 30 | uber technologies | 0.350 | One-time engagement |

**Key Problems**:
- `turkiye` at rank 24 with weight 0.352 — despite being the user's home country and getting the highest like-rate (25%)
- `iran` at rank 10 with weight 0.46 — the user actively avoids Iran war content but the tag keeps growing because Iran appears in business/economy articles the user does read
- `donald trump` at rank 5 — inflated by association, not genuine interest
- One-time engagements (madrid, artemis ii, uber) have disproportionate weight

### 3.2 Skip Profile (What Should Suppress Content)

The skip profile has **3,152 tags**. Here is the problem:

```
Tag               Skip Weight
─────────────────────────────
film              0.9000 (MAX)
iran              0.9000 (MAX)
moon              0.9000 (MAX)
nasa              0.9000 (MAX)
tech              0.9000 (MAX)
apple             0.9000 (MAX)
china             0.9000 (MAX)
crime             0.9000 (MAX)
energy            0.9000 (MAX)
health            0.9000 (MAX)
israel            0.9000 (MAX)
soccer            0.9000 (MAX)
bitcoin           0.9000 (MAX)
economy           0.9000 (MAX)
finance           0.9000 (MAX)
germany           0.9000 (MAX)
science           0.9000 (MAX)
business          0.9000 (MAX)
iran war          0.9000 (MAX)
politics          0.9000 (MAX)
astronomy         0.9000 (MAX)
economics         0.9000 (MAX)
elon musk         0.9000 (MAX)
```

**Every major tag has hit the ceiling of 0.9.** This is the most critical bug in the system. Details in Section 9.

---

## 4. Session Overview: April 15, 2026

The user had **9 distinct sessions** across the day:

| # | Time (UTC) | Duration | Events | Unique Articles | Key Activity |
|---|------------|----------|--------|-----------------|-------------|
| 1 | 08:39–08:55 | 16 min | 153 | 59 | Morning browse — scrolled through initial feed |
| 2 | 09:35–09:36 | 1 min | 12 | 3 | Quick check — saw 3 articles |
| 3 | 12:11–12:21 | 10 min | 40 | 17 | **Liked 2 Turkiye articles**, engaged with Science |
| 4 | 12:37–12:40 | 3 min | 62 | 31 | Continued scrolling, heavy skip rate |
| 5 | 15:28–15:42 | 14 min | 223 | 100 | **Longest session** — diverse engagement |
| 6 | 17:02–17:03 | 1 min | 10 | 5 | Brief check |
| 7 | 17:03–17:11 | 8 min | 114 | 51 | Feed refresh — business-heavy engagement |
| 8 | 17:28–17:36 | 8 min | 188 | 79 | **Pivot-heavy session** — algorithm exploring |
| 9 | 17:53 | <1 min | 2 | 2 | Final check (2 exit events) |

### Day-Level Summary

| Metric | Value |
|--------|-------|
| Total events | **804** |
| Total unique articles interacted | **280+** |
| Engaged reads | **95** (articles dwelled on 6+ seconds) |
| Skipped | **201** (articles scrolled past in <3 seconds) |
| Glanced | **65** (articles seen for 3-6 seconds) |
| Liked | **14** |
| Saved | **2** |
| **Overall Engagement Rate** | **25.2%** (95 engaged / 377 qualifying events) |
| Active reading time | ~62 minutes |
| Event types breakdown | 70 engaged, 235 exit, 45 view, 15 revisit, 102 skipped, 13 liked, 13 explore_swipe, 3 explore_scroll, 1 explore_tap, 1 search, 2 saved |

---

## 5. Category-Level Performance

### 5.1 Complete Category Breakdown

| Category | Articles Shown | Engaged | Skipped | Glanced | Engagement Rate | Likes | Avg Dwell (engaged) |
|----------|---------------|---------|---------|---------|-----------------|-------|-------------------|
| **Tech** | 12 | 6 | 2 | 4 | **50.0%** | 0 | 22.9s |
| Fashion | 2 | 1 | 1 | 0 | 50.0% | 0 | 12.7s |
| **Science** | 21 | 9 | 6 | 6 | **42.9%** | 1 | 17.3s |
| **Health** | 21 | 9 | 9 | 3 | **42.9%** | 0 | 19.3s |
| **Business** | 59 | 24 | 30 | 5 | **40.7%** | 5 | 28.4s |
| Sports | 44 | 14 | 24 | 6 | 31.8% | 2 | 24.7s |
| Lifestyle | 17 | 5 | 9 | 3 | 29.4% | 1 | 15.2s |
| Entertainment | 44 | 9 | 25 | 10 | 20.5% | 2 | 24.1s* |
| Crypto | 10 | 2 | 7 | 1 | 20.0% | 0 | 13.5s |
| Finance | 30 | 6 | 19 | 5 | 20.0% | 0 | 12.3s |
| **World** | **54** | **8** | **36** | **10** | **14.8%** | 2 | 23.1s |
| **Politics** | **45** | **2** | **32** | **11** | **4.4%** | 1 | 29.1s* |
| U.S. | 1 | 0 | 1 | 0 | 0% | 0 | — |
| Food | 1 | 0 | 0 | 1 | 0% | 0 | — |

*High average dwell for Politics/Entertainment is skewed by 1-2 outlier articles (left open in background)

### 5.2 Volume vs. Interest Mismatch

This is the core problem. The algorithm is allocating feed slots **inversely** to the user's actual interest:

```
                    SHOWN in feed          ENGAGED by user
                    ─────────────          ────────────────
    Business  ███████████████░░  (15.7%)   █████████████████████████  (25.3%)
    World     ██████████████░░░  (14.3%)   ████████░░░░░░░░░░░░░░░░  (8.4%)
    Politics  ████████████░░░░░  (11.9%)   ██░░░░░░░░░░░░░░░░░░░░░░  (2.1%)
    Sports    ████████████░░░░░  (11.7%)   ███████████████░░░░░░░░░  (14.7%)
    Entertain ████████████░░░░░  (11.7%)   ██████████░░░░░░░░░░░░░░  (9.5%)
    Finance   ████████░░░░░░░░░  (8.0%)    ██████░░░░░░░░░░░░░░░░░░  (6.3%)
    Science   ██████░░░░░░░░░░░  (5.6%)    ██████████░░░░░░░░░░░░░░  (9.5%)
    Health    ██████░░░░░░░░░░░  (5.6%)    ██████████░░░░░░░░░░░░░░  (9.5%)
    Lifestyle █████░░░░░░░░░░░░  (4.5%)    █████░░░░░░░░░░░░░░░░░░░  (5.3%)
    Tech      ███░░░░░░░░░░░░░░  (3.2%)    ██████░░░░░░░░░░░░░░░░░░  (6.3%)
    Crypto    ███░░░░░░░░░░░░░░  (2.7%)    ██░░░░░░░░░░░░░░░░░░░░░░  (2.1%)
```

**The algorithm gives 26.2% of feed slots to Politics + World — categories where the user has 4.4% and 14.8% engagement respectively.**

**Why this happens**: Trending pool selects by `ai_final_score × recency`, and Politics/World articles consistently have the highest editorial scores (900-950 for major conflicts). The algorithm has no user-specific weighting in the trending pool — it just grabs the "best" articles globally, which are always war/politics.

### 5.3 Category-Level Deep Analysis

#### BUSINESS (59 shown, 40.7% engagement, 5 likes)
The algorithm's **best-performing category by volume**. The user deeply engages with:
- AI industry deals (SoftBank/OpenAI 26.6s, Allbirds AI pivot 30.8s)
- Economic impact analysis (Iran war economy 127.7s absorbed)
- M&A and stock movements (Kering/Gucci 26.3s, Uber plunge 36.0s)
- Defense/startup intersection (Start-ups vs weapon giants 73.3s absorbed)

**What gets skipped**: Generic business news without analytical depth (company reports, routine market updates).

#### POLITICS (45 shown, 4.4% engagement, 1 like)
The algorithm's **worst-performing category**. Only 2 out of 45 articles engaged:
1. "Trump Claims Diet Soda Prevents Cancer" (46.3s) — engaged because of absurdity, not political interest
2. "Maine Bans Large Data Centers Over Energy Concerns" (11.9s) — engaged because of tech angle, not politics

**32 articles skipped** with average dwell of 1.6 seconds. The user recognizes Politics headlines in under 2 seconds and scrolls past. Examples of skipped articles:
- "Trump's Blockade Risks China Detente" (0.6s)
- "Vance Defends Bombing, Slams Pope" (1.0s)
- "House Faces GOP Revolt Over Surveillance" (1.7s)
- "High Court Strikes Down Donation Laws" (1.8s)

#### WORLD (54 shown, 14.8% engagement, 2 likes)
The second-worst category. The user engages ONLY when:
1. **There's an economic/business angle**: "US Blockade Traps Japan Ships in Gulf" (36.3s) — trade impact
2. **It's historical, not breaking news**: "Black Death Kills 60% of Europe" (43.4s LIKED)
3. **It involves Turkiye**: "Turkiye Secures Smyrna Artifact" (LIKED)
4. **It has a specific entity of interest**: "Israel Hacks Iran Traffic Cams" (27.9s) — cyber warfare angle

**What gets skipped**: Repetitive conflict updates. The user saw ~15 Iran/Israel/Lebanon conflict articles and skipped almost all of them (avg 1.3s dwell).

#### TECH (12 shown, 50.0% engagement)
The **highest engagement rate**. Every AI-related Tech article was engaged:
- "Google AI Edge Runs LLMs Offline" (37.5s deep_read)
- "AI Boom Fuels Chip Shortage" (18.5s engaged_read)
- "OpenAI Limits Access Like Anthropic" (29.4s deep_read)
- "Apple Readies Smart Glasses" (14.6s engaged_read)
- "GoPro Mission 1 Lineup" (25.4s deep_read)
- "Ray-Ban Meta Glasses" (skipped — not AI-related)

**Only 12 articles shown despite 50% engagement** — this category is severely underrepresented.

#### SPORTS (44 shown, 31.8% engagement, 2 likes)
The user has **specific sub-interests**, not broad sports interest:

| Sub-interest | Engaged Articles | Dwell Range | Pattern |
|-------------|-----------------|-------------|---------|
| **Tennis (Sinner)** | 3 articles | 10.5-114.2s | Deep interest in Jannik Sinner specifically |
| **Soccer/Football** | 4 articles | 6.9-44.6s | World Cup, Champions League, FIFA |
| **Golf (Tiger Woods)** | 2 articles | 11.2-36.5s | Celebrity athlete story |
| **Swimming** | 1 article | 18.8s | Adam Peaty Olympics |
| **Other** | 4 articles | 12.7-20.5s | Chess, NASCAR, Ukraine veterans |

**24 sports articles were skipped** — mostly from leagues/sports the user doesn't follow (darts, generic transfers, rugby).

---

## 6. Pool/Bucket Performance

### 6.1 Engagement by Pool

| Pool | Total Interactions | Engaged | Skipped | Glanced | Eng. Rate | Purpose Match? |
|------|-------------------|---------|---------|---------|-----------|---------------|
| **Discovery** | 66 | 28 | 38 | — | **42.4%** | Exceeds expectation |
| **Personal** | 49 | 19 | 30 | — | **38.8%** | Below expectation |
| **Trending** | 103 | 32 | 71 | — | **31.1%** | Mediocre |
| **Pivot** | 43 | 9 | 34 | — | **20.9%** | Poor |
| **Fresh_best** | 35 | 7 | 28 | — | **20.0%** | Poor |

### 6.2 Analysis

**Discovery outperforming Personal is a red flag.** The Personal pool uses pgvector cosine similarity against the user's taste vector — it should be the best-performing pool. Two reasons it isn't:

1. **Skip profile saturation** (Section 9) applies equally to all Personal articles, reducing all scores by the same factor. This neutralizes the personal signal.

2. **Taste vector is too broad.** With 1,496 articles read, the taste vector has become a weighted average of everything the user has ever read. It no longer has strong directional preference — it's a "centroid of everything" rather than a "pointer to what the user wants."

**Discovery works because its `categoryBoost = 1.5` for non-personal categories** accidentally surfaces good content the Personal pool misses. When the algorithm intentionally shows the user something different, it sometimes finds categories (Business, Tech) that the Personal pool underweights.

**Trending is volume-heavy but mediocre** because it selects purely by editorial score. A Politics article scored 930 and a Business article scored 780 — the Politics article wins in Trending even though the user will skip it. There's no user-specific weighting.

**Pivot performs worst (20.9%)** — it's designed to force diversity, but diversity for its own sake produces articles the user doesn't want.

---

## 7. Article-by-Article Deep Dive

### 7.1 Most-Engaged Articles (Absorbed/Deep Reads, 30+ seconds)

These articles reveal the user's true interests better than any profile can:

#### #1: "Iran War Impacts US Economy Across Sectors" — 127.7s (ABSORBED)
- **Category**: Business | **Bucket**: Trending | **Score**: 870
- **Why engaged**: This is a BUSINESS article about Iran's economic impact — NOT a politics/war article. The user cares about the economy, not the conflict itself. Tags: `iran war, u.s. economy, economic impact, cnbc, geopolitics`
- **Insight**: The user reads Iran content ONLY through an economic lens. Pure Iran war coverage (casualties, military operations) gets instant-skipped.

#### #2: "Sinner Dominates, Reaches Monte-Carlo Final" — 114.2s (ABSORBED)
- **Category**: Sports | **Bucket**: Personal | **Score**: 780
- **Why engaged**: Jannik Sinner is a specific entity of interest. The user also read two other Sinner articles (10.5s, 20.5s). This is entity-level affinity, not category-level.
- **Insight**: The algorithm needs entity-level tracking. "Sports" is too coarse — "Tennis: Jannik Sinner" is the actual interest.

#### #3: "Start-ups Challenge Weapon Giants in Arms Race" — 73.3s (ABSORBED)
- **Category**: Business | **Bucket**: Discovery
- **Why engaged**: Defense industry disruption by startups — intersects business + tech + geopolitics through an analytical lens.
- **Insight**: The Discovery pool correctly surfaced this. It wouldn't have appeared in Personal because the taste vector doesn't have strong defense-industry signal.

#### #4: "SpaceX, OpenAI, Anthropic Eye Mega-IPOs in 2026" — 52.8s (ABSORBED)
- **Category**: Business | **Bucket**: Pivot
- **Why engaged**: AI companies going public — core interest intersection of AI + stock market + tech industry.
- **Insight**: Even the Pivot pool can surface good content when it hits the right intersection.

#### #5: "Why GLP-1 Drugs Don't Work for 10% of People" — 49.0s (ABSORBED)
- **Category**: Health | **Bucket**: Discovery
- **Why engaged**: Medical science breakthrough with specific data. Tags: `glp-1, diabetes, weight loss, pharmaceuticals`
- **Insight**: The user reads health content when it's scientifically detailed, not general wellness tips.

#### #6: "Trump Claims Diet Soda Prevents Cancer" — 46.3s (ABSORBED)
- **Category**: Politics | **Bucket**: Fresh_best
- **Why engaged**: This is the ONLY Politics article the user deeply read (out of 45). Engaged because of absurdity/entertainment value, not political interest.
- **Insight**: The tag_profile should NOT increase "donald trump" weight from this. It's an outlier.

#### #7: "World Cup 2026 Stadiums Face Sponsor Name Changes" — 44.6s (DEEP READ, LIKED)
- **Category**: Sports | **Bucket**: Personal
- **Tags**: `world cup 2026, fifa, soccer, naming rights, sponsorship`
- **Insight**: Soccer/World Cup is a genuine interest. The "soccer" tag at 0.9 in skip profile is clearly wrong.

#### #8: "Athleticwear Giant Probed for PFAS Chemicals" — 44.0s (DEEP READ)
- **Category**: Business | **Bucket**: Personal
- **Insight**: Consumer health + business intersection. The user reads business through multiple lenses.

#### #9: "Black Death Kills 60% of Europe's Population" — 43.4s (DEEP READ, LIKED)
- **Category**: World | **Bucket**: Fresh_best
- **Tags**: `black death, bubonic plague, disease outbreak, europe, history`
- **Insight**: The user likes HISTORICAL content, not current events. This is categorized as "World" but it's actually a history article. The World category conflates current events with historical content.

#### #10: "Google AI Edge Runs LLMs Offline on Phone" — 37.5s (DEEP READ)
- **Category**: Tech | **Bucket**: Trending
- **Tags**: `google, ai edge gallery, gemma, artificial intelligence, large language models`
- **Insight**: Core AI interest. Every AI tech article gets deep engagement.

### 7.2 Liked Articles — Complete Detail

These 14 articles represent the strongest positive signal the user can give:

| # | Title | Category | Bucket | Dwell | Key Tags |
|---|-------|----------|--------|-------|----------|
| 1 | SoftBank Seeks $40B OpenAI Loan | Business | trending | 26.6s | softbank, openai, jpmorgan, ai |
| 2 | World Cup 2026 Stadiums Name Changes | Sports | personal | 44.6s | world cup, fifa, soccer |
| 3 | Madrid Vertical Gardens as Urban Art | Lifestyle | personal | 28.6s | madrid, vertical gardens, architecture |
| 4 | Eagles Super Bowl Confetti on Artemis II | Sports | discovery | 26.7s | eagles, artemis ii, nasa, nfl, space |
| 5 | Kering Stock Plunges / Gucci Sales Drop | Business | discovery | 26.3s | kering, gucci, luxury, stock market |
| 6 | Ocean's Eleven Prequel (Cooper/Robbie) | Entertainment | trending | 9581s* | ocean's eleven, bradley cooper, margot robbie |
| 7 | **NASA to Study Salda Lake in Turkiye** | Science | — | — | **nasa, salda lake, turkiye, mars** |
| 8 | **Turkiye Secures Ancient Smyrna Artifact** | World | — | — | **turkiye, smyrna, cultural heritage** |
| 9 | Spider-Man 3 Leaked by Model | Entertainment | trending | 34.6s | spider-man 3, insomniac games, video games |
| 10 | Allbirds Pivots to AI, Stock Jumps 175% | Business | trending | 30.8s | allbirds, ai, stock market |
| 11 | Trump Claims Diet Soda Prevents Cancer | Politics | fresh_best | 46.3s | donald trump, cancer, diet soda |
| 12 | Black Death Kills 60% of Europe | World | fresh_best | 43.4s | black death, bubonic plague, history |
| 13 | Uber Shares Plunge 25% | Business | discovery | 36.0s | uber, stock market, earnings |
| 14 | (Business article from late session) | Business | pivot | 28.4s | — |

*Left open in background

**Like Distribution**:
- Business: **5** (36% of likes) — clearly the #1 interest
- Turkiye: **2 from 8 shown** (25% like rate — highest of any segment)
- Sports: **2** (specific: World Cup, Eagles/Space crossover)
- Entertainment: **2** (franchises only: Ocean's, Spider-Man)
- World: **2** (historical + Turkiye cultural — NOT current events)
- Lifestyle: **1** (architecture/urban design)
- Politics: **1** (absurd claim only)

### 7.3 Most-Skipped Articles (Examples of Algorithm Failure)

These articles were scrolled past in under 2 seconds. Each one represents a wasted feed slot:

| Title | Category | Bucket | Dwell | Why Wasted |
|-------|----------|--------|-------|-----------|
| Real Madrid Legend Dies at 96 | Sports | trending | 0.6s | User follows soccer but not obituaries |
| Trump's Blockade Risks China Detente | Politics | trending | 0.6s | Generic politics |
| Israel Strikes Lebanon, 300 Deaths | World | trending | 0.6s | Repetitive conflict update |
| Vance Defends Bombing | Politics | trending | 1.0s | US politics |
| Brevard SPCA Fosters Dogs | Lifestyle | discovery | 0.5s | Pet content — zero interest |
| BOJ Holds Rates Amid Tensions | Finance | trending | 0.8s | Generic central bank news |
| Israel Strikes Lebanon Again | World | trending | 1.0s | Same story, different source |
| Pakistan Hosts US-Iran Talks | World | trending | 1.4s | Repetitive diplomacy |
| Health Secretary Slams NHS | Health | trending | 0.5s | UK-specific health politics |
| Star Wars: Maul Fixes Solo | Entertainment | personal | 0.9s | Star Wars sub-franchise user doesn't follow |

**Pattern**: The fastest skips (<1s) are for content the user recognizes as irrelevant from the headline alone. The algorithm should learn from these instant-skip signals much more aggressively.

---

## 8. Turkiye Content Analysis

### 8.1 Supply vs. Delivery

| Metric | Count | Percentage |
|--------|-------|-----------|
| Turkiye articles available (Apr 10-15) | **51** | 100% |
| Articles shown in user's feed | **8** | **15.7%** |
| Articles liked | **2** | 25% of shown |
| Articles engaged | **3** | 37.5% of shown |
| Articles skipped | **1** | 12.5% of shown |
| Articles with exit-only events | **4** | 50% of shown |
| **Articles never shown** | **43** | **84.3%** |

### 8.2 Turkiye Articles That Were Shown

| # | Title | Category | Reaction | Dwell | Notes |
|---|-------|----------|----------|-------|-------|
| 1 | NASA to Study Mars-Like Salda Lake in Turkiye | Science | **LIKED** | Extended | Turkiye + NASA + Science = perfect match |
| 2 | Turkiye Secures Return of Smyrna Artifact | World | **LIKED** | Extended | Cultural pride, Turkiye + heritage |
| 3 | Turkey Updates Family Health Service Standards | Health | Engaged | 7.9s | Turkiye + Health |
| 4 | Turkiye Lands $1.5B in FDI | Business | Exit only | — | No clear engagement signal captured |
| 5 | Turkiye FM Fidan Discusses Iran w/ Russia | World | Exit only | — | Diplomacy article |
| 6 | Turkiye Mediates US-Iran Talks | World | Exit only | — | Diplomacy article |
| 7 | Turkiye Reveals Most Populous Villages | World | Exit only | — | Demographics, low score (350) |
| 8 | Turkey Hit by Minor Earthquakes | World | **Skipped** | 2.1s | Low-impact story, score 350 |

### 8.3 High-Value Turkiye Articles That Were NEVER Shown

These articles were available in the database but the algorithm did not select them:

| Title | Category | Score | Why It Should Have Been Shown |
|-------|----------|-------|------------------------------|
| **School Shooting in Turkey Kills 4, Injures 20** | World | 880 | Major breaking news in user's home country |
| **Turkey Reels After Second School Shooting** | World | 780 | Follow-up to major event |
| **Erdogan Pushes to Extend Iran Ceasefire** | World | 780 | Turkiye's role in global diplomacy |
| **Turkish Court Acquits Man Who Decried Economy** | World | 760 | Economic free speech — intersects business interest |
| **Turkish-Canadian Leaders Discuss Ties** | World | 720 | International relations |
| **Turkish FM Discusses Ties with Iraqi Counterpart** | World | 720 | Regional diplomacy |
| **Besiktas Eyes Man United's Bayindir** | Sports | 580 | Turkish football transfer |
| **Inter Milan Eyes Calhanoglu Reduced Salary** | Sports | 580 | Turkish footballer |
| **Imamoglu Defends Yavas Amid Investigation** | Politics | 780 | Major Turkish politics |
| **Turkey Fines Deceptive Ads 49.8M TL** | Business | 680 | Business regulation in Turkiye |
| **Truffle Market Booms, Kilo Rivals Gold** | Business | 580 | Turkish agriculture/business |
| **Fishing Ban Begins in Turkey** | Business | 580 | Seasonal industry news |

**A school shooting that killed 4 people in the user's home country was not shown in their feed.** This is a fundamental failure of the personalization system.

### 8.4 Why Turkiye Content Is Lost

**Root Cause 1: No dedicated home-country pool.**
The algorithm has 5 pools (Personal, Trending, Discovery, Fresh_best, Pivot) — none of them prioritize home-country content. Turkiye articles must compete against global articles in every pool.

**Root Cause 2: `home_country` boost is only +150 points (in tag-based fallback only).**
The `calculateTagScore()` function adds +150 for home_country match. But this function is only used for users WITHOUT a taste vector. Our user HAS a taste vector (1,496 articles read), so the home_country boost doesn't apply at all. Turkiye articles are scored purely on embedding similarity — and since the user reads mostly English-language global content, the taste vector doesn't have strong affinity for Turkiye-specific content.

**Root Cause 3: Turkiye articles are mostly "World" or "Politics" — the two most over-served categories.**
Even if a Turkiye article enters the Trending pool, it competes against Iran war articles (score 930+), Israel-Lebanon conflict (score 930+), and other global stories. A Turkiye school shooting (score 880) loses to a repeated Iran conflict update (score 930).

**Root Cause 4: Tag profile underweights "turkiye" at 0.352.**
Despite 25% like rate on shown Turkiye content, the tag profile hasn't learned this signal fast enough. After 1,496 total articles, the few Turkiye articles the user liked are drowned out by the volume of other engagements.

---

## 9. Skip Profile System Bug

### 9.1 The Problem

The skip profile is a dictionary mapping `tag → weight` where higher weight means the user has skipped articles with that tag more frequently. This weight is used to penalize articles in scoring:

```javascript
// In computeSkipPenalty():
for (const tag of article.interest_tags) {
    penalty += skipProfile[tag.toLowerCase()];
}
return Math.min(penalty, 0.80);  // cap at 80% reduction
```

**The problem**: 100+ of the most common tags (including "health", "science", "business", "soccer", "ai") are ALL at the maximum value of 0.9. This means:

- An article about "artificial intelligence" (user's #1 interest, tag_profile = 1.0) gets skip_penalty from tags like "tech" (0.9), "artificial intelligence" (0.9), etc.
- An article about "US politics" (user's least interest, engagement 4.4%) gets skip_penalty from tags like "politics" (0.9), "donald trump" (0.9), etc.
- **Both articles get approximately the same skip penalty** because ALL major tags are at 0.9.

The skip penalty system is therefore **completely unable to differentiate between liked and disliked content**.

### 9.2 Mathematical Impact

Consider two articles:
- Article A: "OpenAI Launches New Model" — tags: [openai, artificial intelligence, tech, business]
- Article B: "Senate Votes on Trade Bill" — tags: [politics, congress, trade, united states]

```
Skip penalty for Article A:
  openai(0.9) + artificial_intelligence(0.9) + tech(0.9) + business(0.9)
  = 3.6, capped at 0.80
  Score multiplier = max(0.10, 1.0 - 0.80) = 0.20

Skip penalty for Article B:
  politics(0.9) + congress(0.9) + trade(0.9) + united_states(0.9)
  = 3.6, capped at 0.80
  Score multiplier = max(0.10, 1.0 - 0.80) = 0.20
```

**Both articles get the exact same 80% score reduction.** The skip profile cannot distinguish between the user's #1 interest (AI) and their least interest (Politics).

### 9.3 Root Cause

The skip profile grows monotonically based on absolute skip counts. Since this user has read 1,496 articles and scrolls through an average of 50-100 articles per session, the skip counts accumulate rapidly for ALL tags. The system has:

1. **No normalization**: skip_weight should be `skips / (skips + engagements)` — a relative measure. Instead, it appears to be based on absolute counts.
2. **No decay**: Old skips count the same as recent ones. A tag skipped 6 months ago still contributes full weight.
3. **No cap recovery**: Once a tag hits 0.9, it can never come back down, even if the user starts engaging with that tag again.

### 9.4 What the Skip Profile SHOULD Look Like

If the skip profile correctly measured relative skip rate:

| Tag | Skip Rate | Should Be | Current |
|-----|-----------|-----------|---------|
| politics | 95.6% skipped | 0.90 (max) | 0.90 (correct by accident) |
| world events | 85.2% skipped | 0.75 | 0.90 (too high) |
| finance | 80.0% skipped | 0.65 | 0.90 (too high) |
| entertainment | 79.5% skipped | 0.60 | 0.90 (too high) |
| sports | 68.2% skipped | 0.50 | 0.90 (too high) |
| lifestyle | 70.6% skipped | 0.55 | 0.90 (too high) |
| business | 59.3% skipped | 0.40 | 0.90 (WAY too high) |
| health | 57.1% skipped | 0.35 | 0.90 (WAY too high) |
| science | 57.1% skipped | 0.35 | 0.90 (WAY too high) |
| tech | 50.0% skipped | 0.25 | 0.90 (WAY too high) |
| artificial intelligence | ~20% skipped | 0.10 | 0.90 (BROKEN) |

### 9.5 Impact on Feed Quality

Without a functioning skip profile:
- The algorithm **cannot suppress low-engagement categories** (Politics stays at 45 articles/day instead of being reduced to ~5)
- The algorithm **penalizes high-engagement categories equally** (Tech articles get the same penalty as Politics articles)
- The **only remaining differentiation** comes from the Personal pool's taste vector similarity, which is why the feed works at all — but at a severely degraded level
- Estimated engagement improvement if skip profile were fixed: **+10-15 percentage points** (from 25.2% to ~35-40%)

---

## 10. Interest Detection Accuracy

### 10.1 Interests Correctly Identified

| Interest | Evidence | Tag Profile Weight | Detection |
|----------|----------|-------------------|-----------|
| AI/Machine Learning | 6/12 Tech engaged, all AI-related | 1.000 | Correct |
| Stock Market / Market Analysis | Deep reads on Uber, ASML, Allbirds | 0.984 | Correct |
| Health Breakthroughs | 49s on GLP-1, 30.5s longevity, 29s alcohol/cancer | 0.938 | Correct |
| Business Deals / M&A | 5 business likes, 127.7s on Iran economy | 0.500 | Correct but underweighted |

### 10.2 Interests Detected But Wrong Level

| Interest | What Algorithm Thinks | What User Actually Wants |
|----------|----------------------|-------------------------|
| `iran` (0.46) | User interested in Iran | User interested in Iran's ECONOMIC impact only |
| `donald trump` (0.65) | User follows Trump news | User engaged with ONE absurd Trump article |
| `nasa` (0.75) | Broad space interest | Interested in NASA + Turkiye (Salda Lake) and space-sports crossover |
| `sports` (0.36) | General sports interest | Specific: Sinner (tennis), World Cup, Tiger Woods |
| `soccer` (in skip: 0.9) | User doesn't like soccer | User LIKED World Cup stadium article (44.6s, LIKED) |

### 10.3 Interests NOT Detected

| Interest | Evidence | In Tag Profile? |
|----------|----------|----------------|
| **Turkiye (home country)** | 25% like rate (2 of 8 shown) | Only 0.352 — rank 24 |
| **Tennis / Jannik Sinner** | 114.2s absorbed read | Not visible in profile |
| **Movie franchises** | Liked Ocean's, Spider-Man, deep-read Godzilla, Star Wars | Not tracked as entity |
| **Architecture / urban design** | Liked Madrid gardens, 27.9s on HK bar design | Not tracked |
| **History / historical content** | Liked Black Death article (43.4s) | Not tracked |
| **Business through geopolitics lens** | 127.7s on Iran economy, 73.3s on defense startups | Conflated with generic business |

---

## 11. Recommendations

### 11.1 Critical Fixes (Must-Do)

#### Fix 1: Reset and Rebuild Skip Profile
**Problem**: All major tags saturated at 0.9
**Solution**: 
```
new_skip_weight = skips / (skips + engagements + glances)
```
Apply exponential decay: recent skips weighted more than old ones. Cap at 0.8 with floor at 0.05. This single fix would likely improve engagement rate from 25% to 35-40%.

#### Fix 2: Dedicated Home-Country Pool
**Problem**: Only 8 of 51 Turkiye articles shown (15.7%)
**Solution**: Reserve 3-4 slots per feed load for articles where `countries` contains `home_country`. Create a 6th pool: `home_country` pool with its own scoring function that prioritizes local relevance.

#### Fix 3: User-Weighted Trending Pool
**Problem**: Trending uses global editorial scores, flooding feed with Politics/World
**Solution**: Apply per-user category multiplier to trending scores:
```
trending_score = ai_score × recency × user_category_engagement_rate
```
For this user: Politics (0.044) would reduce a 930-score Politics article to 40.9, while Business (0.407) keeps a 780-score Business article at 317.5.

### 11.2 Important Improvements

#### Fix 4: Entity-Level Interest Tracking
Track engagement at the entity level (specific people, teams, franchises):
- "Jannik Sinner" → tennis interest, NOT broad sports
- "Spider-Man" → gaming franchise, NOT all entertainment
- "World Cup 2026" → soccer events, NOT all soccer news
- "Tiger Woods" → celebrity athlete story

#### Fix 5: Sub-Category Routing
Split broad categories into sub-interests:
- Sports → Tennis, Soccer/World Cup, Golf, Other
- Entertainment → Movie Franchises, Gaming, TV, Music
- World → Current Events, History, Home Country, Diplomacy

#### Fix 6: Tag Profile Decay for One-Time Engagements
Tags like "madrid" (0.61), "artemis ii" (0.35), "uber technologies" (0.35) are from single reads. They should decay to near-zero if not reinforced within 7-14 days. Current system has no decay.

#### Fix 7: Separate "Iran Economic Impact" from "Iran War Coverage"
The user's behavior clearly shows:
- "Iran War Impacts US Economy" → 127.7s absorbed read
- "Israel Strikes Lebanon" → 0.6s instant skip
These are completely different interests that share the "iran" tag. Entity-level or sub-tag distinction needed.

### 11.3 Metrics to Track

| Metric | Current | Target After Fixes |
|--------|---------|-------------------|
| Overall engagement rate | 25.2% | 35-40% |
| Politics engagement rate | 4.4% | 15%+ (by showing fewer but better-matched) |
| Turkiye articles shown/available | 15.7% | 60%+ |
| Turkiye like rate | 25% | Maintain or improve |
| Tech/Science/Health representation | 14.4% of feed | 25-30% of feed |
| Skip rate (articles skipped in <2s) | 53.3% | <35% |
| Deep reads (30+ seconds) | 40 per day | 60+ per day |

---

## Appendix: Raw Data Tables

### A.1 Complete Engagement Events by Category and Bucket

```
                    personal  trending  discovery  fresh_best  pivot   TOTAL
ENGAGED:
  Business            4         8         8          1          3      24
  Sports              5         2         2          0          5      14
  Science             2         3         3          1          0       9
  Health              3         3         2          0          1       9
  Entertainment       2         3         1          0          3       9
  World               1         2         1          3          1       8
  Tech                0         3         3          0          0       6
  Finance             0         0         3          0          3       6
  Lifestyle           2         1         1          0          1       5
  Politics            0         0         0          2          0       2
  Crypto              0         1         1          0          0       2
  Fashion             1         0         0          0          0       1

SKIPPED:
  World               3         9         0         10         14      36
  Politics            0         5         4         10         13      32
  Business            2         7         4          0          5      30
  Entertainment       5         5         2          0          3      25
  Sports              6         4         1          0         13      24
  Finance             0         3         3          0          7      19
  Health              2         3         0          0          4       9
  Lifestyle           3         2         2          0          2       9
  Crypto              0         4         1          0          2       7
  Science             0         0         0          3          3       6
  Tech                0         1         0          0          1       2
  Fashion             0         0         0          0          1       1
```

### A.2 All 14 Liked Articles with Full Metadata

| # | ID | Title | Category | Bucket | Score | Tags | Countries |
|---|-----|-------|----------|--------|-------|------|-----------|
| 1 | 122820 | SoftBank Seeks Banks for $40B OpenAI Loan | Business | trending | 840 | softbank, openai, jpmorgan chase, goldman sachs | usa, japan |
| 2 | 122850 | World Cup 2026 Stadiums Face Name Changes | Sports | personal | 580 | world cup 2026, fifa, soccer, naming rights | usa, canada |
| 3 | 122358 | Madrid Embraces Vertical Gardens as Urban Art | Lifestyle | personal | 480 | madrid, vertical gardens, patrick blanc, urban art | spain |
| 4 | 122635 | Eagles Super Bowl Confetti Flies on Artemis II | Sports | discovery | 780 | philadelphia eagles, artemis ii, nasa, nfl, space | usa |
| 5 | 122945 | Kering Stock Plunges / Gucci Sales Drop | Business | discovery | 780 | kering, gucci, hermes, luxury goods, stock market | france |
| 6 | 122631 | Ocean's Eleven Prequel (Cooper/Robbie) | Entertainment | trending | 680 | ocean's eleven, bradley cooper, margot robbie | usa |
| 7 | 123074 | NASA to Study Salda Lake in Turkiye | Science | — | 760 | nasa, salda lake, turkiye, mars, astrobiology | turkiye, usa |
| 8 | 123083 | Turkiye Secures Return of Smyrna Artifact | World | — | 680 | turkiye, smyrna, artifact repatriation, cultural heritage | turkiye, usa |
| 9 | 120992 | Spider-Man 3 Leaked by Peter Parker Model | Entertainment | trending | 680 | spider-man 3, insomniac games, video games | usa |
| 10 | 123651 | Allbirds Pivots to AI, Stock Jumps 175% | Business | trending | 780 | allbirds, artificial intelligence, stock market | usa |
| 11 | 123734 | Trump Claims Diet Soda Prevents Cancer | Politics | fresh_best | 780 | donald trump, cancer, diet soda, robert f. kennedy jr. | usa |
| 12 | 123837 | Black Death Kills 60% of Europe | World | fresh_best | 880 | black death, bubonic plague, disease outbreak, europe, history | — |
| 13 | 124063 | Uber Shares Plunge 25%, Analysts Still Bullish | Business | discovery | 780 | uber technologies, stock market, earnings | usa |
| 14 | 124219 | (Business article — late session) | Business | pivot | — | — | — |

### A.3 Available Turkiye Articles vs. Shown (April 10-15)

| ID | Title | Score | Category | Shown? | Reaction |
|----|-------|-------|----------|--------|----------|
| 123074 | NASA Studies Salda Lake in Turkiye | 760 | Science | Yes | **LIKED** |
| 123083 | Turkiye Secures Smyrna Artifact | 680 | World | Yes | **LIKED** |
| 109173 | Turkey Updates Health Standards | 580 | Health | Yes | Engaged 7.9s |
| 118238 | Turkiye Lands $1.5B FDI | 780 | Business | Yes | Exit only |
| 119172 | Turkiye FM Discusses Iran w/ Russia | 780 | World | Yes | Exit only |
| 121686 | Turkiye Mediates US-Iran Talks | 740 | World | Yes | Exit only |
| 123335 | Turkiye Most Populous Villages | 350 | World | Yes | Exit only |
| 113618 | Turkey Minor Earthquakes | 350 | World | Yes | Skipped 2.1s |
| **123514** | **School Shooting Kills 4** | **880** | **World** | **NO** | — |
| **124549** | **Turkey Reels After 2nd Shooting** | **780** | **World** | **NO** | — |
| **123562** | **Erdogan Pushes Iran Ceasefire** | **780** | **World** | **NO** | — |
| **123859** | **Court Acquits Man (Economy)** | **760** | **World** | **NO** | — |
| **124307** | **Turkish-Canadian Leaders Meet** | **720** | **World** | **NO** | — |
| **123603** | **Turkish FM Meets Iraqi FM** | **720** | **World** | **NO** | — |
| **123705** | **Truffle Market Booms** | **580** | **Business** | **NO** | — |
| **123516** | **Fishing Ban Begins** | **580** | **Business** | **NO** | — |
| **123580** | **Serik Mayor Joins AKP** | **780** | **Politics** | **NO** | — |
| **123125** | **Imamoglu Defends Yavas** | **780** | **Politics** | **NO** | — |
| **123135** | **Besiktas Eyes Bayindir** | **580** | **Sports** | **NO** | — |
| **123284** | **Inter Eyes Calhanoglu** | **580** | **Sports** | **NO** | — |
| 122892 | Turkey Fines Deceptive Ads | 680 | Business | NO | — |
| 122921 | Turkey Aronia Production Hub | 580 | Business | NO | — |
| 123885 | MHP Blames Digitalization | 580 | Politics | NO | — |
| 123860 | Turkey Addresses School Safety | 580 | World | NO | — |
| 124452 | Imamoglu Condemns Attack | 580 | Politics | NO | — |
| ...and 26 more articles | | | | NO | — |

---

*End of Report*

*Data source: Production Supabase database. Tables queried: `user_article_events`, `published_articles`, `profiles`. Algorithm source: `pages/api/feed/main.js` (V23, 2,750+ lines). All timestamps in UTC.*
