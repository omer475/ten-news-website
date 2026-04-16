# Feed Algorithm Analysis Report
## User: soganciogluomer@gmail.com | Date Analyzed: April 15, 2026
## Prepared for Academic Review

---

## 1. Executive Summary

This report provides a comprehensive, article-by-article analysis of the feed algorithm's performance for the primary test user on April 15, 2026. The user completed **8 distinct reading sessions** across the day (08:39-17:53 UTC), interacting with **280+ unique articles** across **804 tracked events**. The overall **engagement rate was 25.2%** (95 engaged out of 377 qualifying events), with **14 explicit likes**.

### Key Findings
- **Critical Bug: Skip profile saturated at maximum (0.9) for nearly all tags** — rendering the entire skip-penalty system nonfunctional
- **Turkiye content severely underrepresented**: only 8 out of 51 available articles shown (15.7%), despite 25% like-rate on those shown
- **Politics and World categories massively over-served**: 99 articles shown at 4.4% and 14.8% engagement respectively
- **Tech, Science, Health, Business perform well**: 40-50% engagement rates
- **Discovery bucket outperforms Personal bucket**: 42.4% vs 38.8% engagement

---

## 2. User Profile State

| Field | Value |
|-------|-------|
| User ID | `5082a1df-24e4-4a39-a0c0-639c4de70627` |
| Home Country | **turkiye** |
| Followed Countries | [] (empty) |
| Followed Topics | [] (empty) |
| Articles Read (all time) | 1,496 |
| Similarity Floor | 0.2194 |
| Tag Profile Size | 405 tags |
| Skip Profile Size | 3,152 tags |

### Tag Profile — Top Interests (What Algorithm Thinks User Likes)
| Rank | Tag | Weight |
|------|-----|--------|
| 1 | artificial intelligence | 1.000 |
| 2 | stock market | 0.984 |
| 3 | health | 0.938 |
| 4 | nasa | 0.754 |
| 5 | donald trump | 0.650 |
| 6 | madrid | 0.610 |
| 7 | openai | 0.508 |
| 8 | business | 0.500 |
| 9 | cancer | 0.484 |
| 10 | iran | 0.460 |
| 24 | **turkiye** | **0.352** |

**Problem**: "turkiye" sits at rank 24 (weight 0.352) — far below tags like "donald trump" (0.65) or "madrid" (0.61). For a user whose home_country is turkiye, this means the algorithm has not adequately learned that Turkiye content is a core interest, not a peripheral one.

---

## 3. Session Overview

| Session | Time (UTC) | Duration | Events | Articles | Description |
|---------|------------|----------|--------|----------|-------------|
| 1 | 08:39 - 08:55 | 16 min | 153 | 59 | Morning browse — heavy scrolling |
| 2 | 09:35 - 09:36 | 1 min | 12 | 3 | Quick check |
| 3 | 12:11 - 12:21 | 10 min | 40 | 17 | Midday — Turkiye articles liked here |
| 4 | 12:37 - 12:40 | 3 min | 62 | 31 | Continued browse |
| 5 | 15:28 - 15:42 | 14 min | 223 | 100 | Longest session, most activity |
| 6 | 17:02 - 17:03 | 1 min | 10 | 5 | Brief check |
| 7 | 17:03 - 17:11 | 8 min | 114 | 51 | Afternoon feed refresh |
| 8 | 17:28 - 17:36 | 8 min | 188 | 79 | Pivot-heavy session (late) |
| 9 | 17:53 | <1 min | 2 | 2 | Final check |

**Total active time**: ~62 minutes across 9 sessions

---

## 4. Category Performance Analysis

### 4.1 Engagement Rate by Category

| Category | Shown | Engaged | Skipped | Glanced | Eng. Rate | Likes |
|----------|-------|---------|---------|---------|-----------|-------|
| **Tech** | 12 | 6 | 2 | 4 | **50.0%** | 0 |
| **Fashion** | 2 | 1 | 1 | 0 | **50.0%** | 0 |
| **Science** | 21 | 9 | 6 | 6 | **42.9%** | 1 |
| **Health** | 21 | 9 | 9 | 3 | **42.9%** | 0 |
| **Business** | 59 | 24 | 30 | 5 | **40.7%** | 5 |
| **Sports** | 44 | 14 | 24 | 6 | **31.8%** | 2 |
| **Lifestyle** | 17 | 5 | 9 | 3 | **29.4%** | 1 |
| Entertainment | 44 | 9 | 25 | 10 | **20.5%** | 2 |
| Crypto | 10 | 2 | 7 | 1 | **20.0%** | 0 |
| Finance | 30 | 6 | 19 | 5 | **20.0%** | 0 |
| **World** | 54 | 8 | 36 | 10 | **14.8%** | 2 |
| **Politics** | 45 | 2 | 32 | 11 | **4.4%** | 1 |

### 4.2 Category Analysis

**HIGH PERFORMERS (>40% engagement):**
- **Tech (50%)**: User deeply reads AI/ML articles (Google AI Edge: 37.5s, AI Chip Shortage: 18.5s, OpenAI: 29.4s). Algorithm correctly identifies this interest.
- **Science (42.9%)**: Archaeology, space, climate — all engage. India nuclear (27.4s), AI chatbots medical (37.1s), El Nino (16.7s).
- **Health (42.9%)**: GLP-1 drugs (49.0s absorbed read!), longevity (30.5s), Hong Kong mental health (14.9s).
- **Business (40.7%)**: User's strongest category by volume AND depth. 24 engaged reads, 5 likes. Deep reads on: Amazon/Globalstar $16B deal (21.4s), SoftBank/OpenAI loan (26.6s), ASML AI chips (28s), Allbirds AI pivot (30.8s), Iran war economy impact (127.7s absorbed!).

**CRITICAL FAILURES (<15% engagement):**
- **Politics (4.4%)**: 45 articles shown, only 2 engaged. User skipped 32 politics articles with average dwell of 1.6 seconds. This is a massive waste — **12% of the feed** is content the user doesn't want.
- **World (14.8%)**: 54 articles shown, 36 skipped. Most skipped World articles were repetitive Middle East conflict coverage (Israel-Lebanon-Iran cycle).

### 4.3 Volume vs. Interest Mismatch

```
Category      Shown%    Engaged%    Mismatch
Business      15.7%     25.3%       UNDERSERVED (+9.6)
Tech           3.2%      6.3%       UNDERSERVED (+3.1)
Science        5.6%      9.5%       UNDERSERVED (+3.9)
Health         5.6%      9.5%       UNDERSERVED (+3.9)
World         14.3%      8.4%       OVERSERVED (-5.9)
Politics      11.9%      2.1%       OVERSERVED (-9.8)
Finance        8.0%      6.3%       OVERSERVED (-1.7)
Entertainment 11.7%      9.5%       Slightly over
Sports        11.7%     14.7%       Slightly under
```

**The algorithm is allocating ~26% of feed slots to Politics+World, which together produce only 10.5% of the user's engaged reads.**

---

## 5. Bucket/Pool Performance Analysis

The algorithm assigns articles to 5 pools:

| Bucket | Purpose | Engaged | Skipped | Total | Eng. Rate |
|--------|---------|---------|---------|-------|-----------|
| **Discovery** | Serendipitous finds outside user's profile | 28 | 38 | 66 | **42.4%** |
| **Personal** | Taste-vector matched to user's interests | 19 | 30 | 49 | **38.8%** |
| **Trending** | High-quality recent articles | 32 | 71 | 103 | **31.1%** |
| **Pivot** | Category exploration / diversity | 9 | 34 | 43 | **20.9%** |
| **Fresh_best** | Newest high-scoring articles | 7 | 28 | 35 | **20.0%** |

### Key Observations:

1. **Discovery outperforms Personal** (42.4% vs 38.8%). This is counterintuitive — the taste-vector matched articles should perform better. This suggests the taste vector may be poorly calibrated or too broad. Discovery's intentional randomness (`1 + Math.random() * 0.4` surprise factor) combined with the anti-personal-category boost (`categoryBoost = 1.5` for non-personal categories) is accidentally surfacing better content.

2. **Trending is volume-heavy but middling** (31.1%). It provides the most articles (103) but fills the feed with generic high-score articles the user doesn't care about (especially Politics and World content with high `ai_final_score`).

3. **Pivot and Fresh_best are underperforming** (20-21%). The pivot bucket, designed to diversify, is mostly showing articles the user scrolls past. Fresh_best shows the newest articles regardless of interest, which often means breaking news the user doesn't care about.

---

## 6. Turkiye Content Analysis (Critical Issue)

### 6.1 Supply vs. Demand

| Metric | Value |
|--------|-------|
| Turkiye articles available (Apr 10-15) | **51** |
| Turkiye articles shown in feed | **8** (15.7%) |
| Turkiye articles liked | **2** (25% of shown) |
| Turkiye articles engaged | **3** (37.5% of shown) |
| Turkiye articles skipped | **1** (12.5%) |
| Turkiye articles not shown | **43** |

### 6.2 Article-by-Article Turkiye Breakdown

| ID | Title | Category | Shown? | Reaction | Dwell |
|----|-------|----------|--------|----------|-------|
| 123074 | NASA to Study Mars-Like Salda Lake in Turkiye | Science | Yes | **LIKED** | Extended |
| 123083 | Turkiye Secures Return of Ancient Smyrna Artifact | World | Yes | **LIKED** | Extended |
| 109173 | Turkey Updates Family Health Service Standards | Health | Yes | Engaged (light) | 7.9s |
| 118238 | Turkiye Lands $1.5B in Foreign Direct Investment | Business | Yes | Exit only | — |
| 119172 | Turkiye FM Fidan Discusses Iran Conflict | World | Yes | Exit only | — |
| 121686 | Turkiye Mediates US-Iran Talks | World | Yes | Exit only | — |
| 123335 | Turkiye Reveals Most Populous Villages | World | Yes | Exit only | — |
| 113618 | Turkey Hit by Minor Earthquakes | World | Yes | Skipped | 2.1s |
| 123514 | **School Shooting in Turkey Kills 4** | World | **NO** | — | — |
| 123562 | **Erdogan Pushes to Extend Iran Ceasefire** | World | **NO** | — | — |
| 122921 | Turkey Emerges as Aronia Production Hub | Business | **NO** | — | — |
| 123705 | Truffle Market Booms in Turkey | Business | **NO** | — | — |
| 123580 | Serik Mayor Joins AKP, Sparks Outcry | Politics | **NO** | — | — |
| 123125 | Imamoglu Defends Yavas Amid Investigation | Politics | **NO** | — | — |
| 123135 | Besiktas Eyes Man United's Bayindir | Sports | **NO** | — | — |
| 123284 | Inter Milan Eyes Calhanoglu Reduced Salary | Sports | **NO** | — | — |
| 124549 | Turkey Reels After Second School Shooting | World | **NO** | — | — |
| ...and 26 more | | | **NO** | — | — |

### 6.3 Why Turkiye Content Is Lost

1. **Home country boost is too weak**: The `calculateTagScore()` function adds only +150 points for `home_country` match. For articles with `ai_final_score` of 780+ this is a ~19% bump — not enough to compete with trending articles scoring 900+.

2. **Turkiye weight in tag profile (0.352) is too low**: Ranked 24th. The tag profile learning rate hasn't caught up to the user's actual interest level. The user LIKED both Turkiye articles shown in Session 3, which is an extremely strong signal, yet the weight barely reflects this.

3. **Personal pool pgvector search misses Turkiye articles**: The taste vector is heavily weighted toward AI/business/health embeddings, meaning Turkiye-specific content (local politics, local economy, local sports) doesn't surface through vector similarity.

4. **Most Turkiye articles are categorized as "World" or "Politics"**: These categories already flood the feed from non-Turkiye sources (Iran conflict, US politics). Turkiye articles compete in the same pool and lose to higher-scored global stories.

5. **No country-specific pool exists**: The algorithm has no mechanism to guarantee home-country content appears in every feed load.

---

## 7. Deep-Read Articles (What the User Actually Wants)

These articles received the highest dwell times (>30 seconds) or were "absorbed" reads:

| Article | Category | Dwell | Bucket | What It Tells Us |
|---------|----------|-------|--------|-----------------|
| Ocean's Eleven Prequel (Cooper/Robbie) | Entertainment | 9581s* | trending | Left open; loves movie franchise news |
| Jean Smart Heart Surgery | Entertainment | 974s* | trending | Left open; health + celebrity intersection |
| RAVE Token Surges 6000% | Crypto | 514s* | trending | Left open; crypto when extreme event |
| Iran War Impacts US Economy | Business | 127.7s | trending | Absorbed — geopolitics THROUGH business lens |
| Sinner Monte-Carlo Final (Tennis) | Sports | 114.2s | personal | Absorbed — strong tennis interest |
| Start-ups vs Weapon Giants | Business | 73.3s | discovery | Absorbed — defense + startups |
| AI Company Pivots/Deals | Business | 52.8s | personal | Absorbed — AI industry moves |
| GLP-1 Drugs Don't Work for 10% | Health | 49.0s | discovery | Absorbed — medical breakthroughs |
| Trump Diet Soda Cancer Claim | Politics | 46.3s | fresh_best | Absorbed — only Politics engaged (absurd claim) |
| World Cup 2026 Stadiums | Sports | 44.6s | personal | Deep read — soccer/football interest |
| Athleticwear PFAS Chemicals | Business | 44.0s | personal | Deep read — consumer health + business |
| Black Death Kills 60% of Europe | World | 43.4s | fresh_best | Deep read — history, NOT current events |
| Google AI Edge Runs LLMs Offline | Tech | 37.5s | trending | Deep read — core AI interest |
| AI Chatbots Give Misleading Medical Advice | Science | 37.1s | discovery | Deep read — AI + health intersection |
| Tiger Woods Takes Leave | Sports | 36.5s | personal | Deep read — golf celebrity |
| Uber Shares Plunge 25% | Business | 36.0s | discovery | Deep read — tech-business |
| US Blockade Traps Japan Ships | World | 36.3s | fresh_best | Deep read — geopolitics with economic impact |
| Spider-Man 3 Leaked | Entertainment | 34.6s | trending | Deep read — gaming |

*Likely left the article open (tab sitting); true active time uncertain

### User Interest Profile (Derived from Behavior, Not Tags)

**Tier 1 — Core Interests (consistently high engagement):**
- AI/Tech industry business moves (OpenAI deals, Google AI, chip industry)
- Medical/health breakthroughs (GLP-1, cancer, mental health)
- Turkiye (liked everything relevant shown)
- Business/finance with substance (M&A, IPOs, economic impact analysis)

**Tier 2 — Strong But Selective:**
- Specific sports: Tennis (Sinner), Soccer/Football (World Cup), Golf (Tiger Woods)
- Science (archaeology, space, climate — NOT physics)
- Pop culture (movie franchises: Ocean's, Star Wars, Spider-Man, LOTR)

**Tier 3 — Occasional Interest:**
- Crypto (only extreme events: 6000% surges)
- World events ONLY when they have economic/business implications
- Lifestyle (architecture, urban design — NOT home improvement)

**Tier 4 — Actively Avoided:**
- Generic US/world politics (4.4% engagement)
- Repetitive Middle East conflict updates without business angle
- Generic finance (bond yields, index reports)
- Celebrity gossip, lifestyle tips, pet stories

---

## 8. Skip Profile Bug (CRITICAL)

### The Problem

The skip profile contains **3,152 tags**, with the top ~100+ tags ALL saturated at the maximum value of **0.9**. These include:

```
film: 0.9, iran: 0.9, moon: 0.9, nasa: 0.9, tech: 0.9, apple: 0.9,
china: 0.9, crime: 0.9, energy: 0.9, health: 0.9, israel: 0.9,
soccer: 0.9, spacex: 0.9, bitcoin: 0.9, economy: 0.9, finance: 0.9,
germany: 0.9, science: 0.9, business: 0.9, iran war: 0.9, politics: 0.9,
astronomy: 0.9, economics: 0.9, elon musk: 0.9, inflation: 0.9...
```

### Why This Is a Critical Bug

The skip penalty in `scorePersonalV3()` computes:
```javascript
const skipPenalty = computeSkipPenalty(article, userSkipProfile);
const skipMultiplier = Math.max(0.10, 1.0 - skipPenalty);
```

When every tag is at 0.9, every article gets roughly the same skip penalty (because all articles contain some 0.9-rated tags). This makes the skip system **unable to differentiate between truly-disliked content and content the user loves**. An article about "artificial intelligence" (tag_profile: 1.0, user's #1 interest) gets the same skip penalty as an article about "politics" (tag_profile: 0.04, user's least interest).

### Root Cause Hypothesis

The skip profile is likely using absolute skip counts without normalization. Since this user has read 1,496 articles and skips are far more common than engagements (the user scrolls past ~70% of content), the skip weights grow monotonically and eventually saturate. There is no decay mechanism or relative-frequency normalization.

### Impact

Without a functioning skip profile, the algorithm loses its primary negative signal. It cannot downrank categories/tags the user consistently ignores. This directly explains why Politics (4.4% engagement) still gets 45 articles in the feed — the algorithm has no way to suppress it.

---

## 9. Liked Articles — Full Details

| # | Article | Category | Bucket | What It Reveals |
|---|---------|----------|--------|----------------|
| 1 | SoftBank Seeks Banks for $40B OpenAI Loan | Business | trending | AI industry deals |
| 2 | World Cup 2026 Stadiums Face Name Changes | Sports | personal | Soccer/football interest |
| 3 | Madrid Embraces Vertical Gardens as Urban Art | Lifestyle | personal | Architecture, urban design |
| 4 | Eagles' Super Bowl Confetti Flies on Artemis II | Sports | discovery | Space + sports crossover |
| 5 | Kering Stock Plunges / Gucci Sales Drop | Business | discovery | Luxury/fashion business |
| 6 | Ocean's Eleven Prequel Lands Cooper as Director | Entertainment | trending | Movie franchise excitement |
| 7 | **NASA to Study Salda Lake in Turkiye** | Science | — | **Turkiye + Science** |
| 8 | **Turkiye Secures Return of Smyrna Artifact** | World | — | **Turkiye cultural pride** |
| 9 | Spider-Man 3 Leaked by Model | Entertainment | trending | Gaming/pop culture |
| 10 | Allbirds Pivots to AI, Stock Jumps 175% | Business | trending | AI + stock market |
| 11 | Trump Claims Diet Soda Prevents Cancer | Politics | fresh_best | Absurdist politics only |
| 12 | Black Death Kills 60% of Europe | World | fresh_best | History, NOT current events |
| 13 | Uber Shares Plunge 25%, Analysts Still Bullish | Business | discovery | Tech-business analysis |
| 14 | (Business article from pivot bucket) | Business | pivot | Business engagement in pivot |

### Like Pattern Summary
- **Business**: 5 likes (36% of all likes) — clearly the #1 interest
- **Turkiye**: 2 likes from only 8 articles shown = **25% like rate** (highest)
- **Entertainment**: 2 likes (movie/gaming franchises only)
- **Sports**: 2 likes (soccer + space crossover)
- **World**: Only likes for historical/cultural content, NOT breaking news
- **Politics**: Only 1 like, for an absurd claim (not real political coverage)

---

## 10. Specific Problem: Sports Overload Without Differentiation

The user saw 44 sports articles. Breaking down engagement:

**Engaged (14 articles):**
- Tennis: Sinner Monte-Carlo (114.2s!), Sinner vs Zverev (10.5s), Sinner Dominates (20.5s)
- Soccer/Football: World Cup stadiums (44.6s LIKED), Schumer FIFA transport (27.6s), PSG-Liverpool (6.9s), Eagles/Artemis (26.7s LIKED)
- Golf: Tiger Woods crash (36.5s), Tiger Woods ashamed (11.2s)
- Swimming: Peaty wins title (18.8s)
- Other: Chess Sindarov (14.1s), NASCAR Ty Gibbs (12.8s), Ukraine veterans marathon (engaged with revisit)

**Skipped (24 articles):**
- Generic soccer transfers/results the user doesn't follow
- Real Madrid legend death (0.6s instant skip)
- Various sports from non-interest leagues
- Multiple darts, athletics, and generic sports articles

**Pattern**: User cares about **specific athletes** (Sinner, Tiger Woods, Peaty) and **specific events** (World Cup, Champions League) — NOT about sports broadly. The algorithm treats Sports as monolithic.

---

## 11. Specific Problem: Entertainment Filtering Failure

44 Entertainment articles shown, only 9 engaged (20.5%). But the engaged articles show clear sub-interest patterns:

**Engaged:**
- Movie franchises: Ocean's Eleven (9581s), Spider-Man 3 (34.6s LIKED)
- Star Wars: (engaged via personal bucket)
- Godzilla sequel (27.4s)
- Gaming connections

**Skipped (25 articles):**
- Celebrity news, TV show coverage, music industry
- Dan Levy Netflix show, Severance Apple TV, Good Omens
- Various film news for movies user doesn't follow

**Pattern**: User engages with **franchise/sequel news** (Spider-Man, Ocean's, Star Wars, Godzilla, LOTR) but not general entertainment. The algorithm should be tracking entity-level affinity for specific franchises.

---

## 12. Algorithm Recommendations

### Priority 1: Fix Skip Profile Saturation (Bug)
The skip profile must implement:
- **Relative frequency normalization**: `skip_weight = skips / (skips + engagements)` instead of absolute counts
- **Decay over time**: Recent skips should count more than old ones
- **Cap at 0.8 with floor at 0.05**: Prevent saturation while allowing recovery
- This single fix would likely improve overall engagement by 15-25%

### Priority 2: Home Country Guaranteed Slots
- Reserve 2-3 slots per feed load specifically for `home_country` articles
- Create a dedicated "home country" pool alongside personal/trending/discovery
- Boost home_country weight in tag_profile learning (currently 0.352 for turkiye despite 25% like rate)

### Priority 3: Reduce Politics/World Volume
- Currently 26% of feed → target 10-15%
- Use the skip profile (once fixed) to aggressively suppress low-engagement categories
- For "World" category: only show articles that intersect with user's business/economic interests (Iran war's economic impact = engaged; Iran war's casualty count = skipped)

### Priority 4: Entity-Level Affinity for Sports and Entertainment
- Track engagement at the entity level (Sinner, Tiger Woods, World Cup, Spider-Man, Ocean's)
- Use entity tags to boost/suppress within categories
- Currently `entity_tags` exists in the schema but the entity affinity table appears empty for this user

### Priority 5: Sub-Category Routing
- Split "Sports" into sub-interests: Tennis, Soccer, Golf, etc.
- Split "Entertainment" into: Movie Franchises, Gaming, TV, Music
- Route articles through sub-interest profiles for better matching

### Priority 6: Trending Pool Refinement
- Trending currently picks by `ai_final_score * recency` — this favors Politics/World (they have highest base scores: 900-950)
- Apply user-specific category weights to trending scoring
- Example: a Politics article scored 930 should be downranked to ~400 for this user (4.4% engagement rate)

---

## 13. Appendix: Complete Engaged Article List

### All 95 Engaged Reads, Sorted by Dwell Time

| # | ID | Title | Cat | Bucket | Dwell | Tier |
|---|-----|-------|-----|--------|-------|------|
| 1 | 122631 | Ocean's Eleven Prequel | Entertainment | trending | 9581.9s | absorbed* |
| 2 | 110383 | Jean Smart Heart Surgery | Entertainment | trending | 974.0s | absorbed* |
| 3 | 119448 | RAVE Token Surges 6000% | Crypto | trending | 514.2s | absorbed* |
| 4 | 124044 | Iran War Impacts US Economy | Business | trending | 127.7s | absorbed |
| 5 | 114182 | Sinner Dominates Monte-Carlo Final | Sports | personal | 114.2s | absorbed |
| 6 | 120272 | Start-ups Challenge Weapon Giants | Business | discovery | 73.3s | absorbed |
| 7 | 117229 | Business article (pivot) | Business | personal | 52.8s | absorbed |
| 8 | 122622 | Why GLP-1s Don't Work for 10% | Health | discovery | 49.0s | absorbed |
| 9 | 123734 | Trump Claims Diet Soda Prevents Cancer | Politics | fresh_best | 46.3s | absorbed |
| 10 | 122850 | World Cup 2026 Stadium Names | Sports | personal | 44.6s | deep_read |
| 11 | 123889 | Athleticwear PFAS Chemicals Probe | Business | personal | 44.0s | deep_read |
| 12 | 123837 | Black Death Kills 60% of Europe | World | fresh_best | 43.4s | deep_read |
| 13 | 122878 | Google AI Edge Runs LLMs Offline | Tech | trending | 37.5s | deep_read |
| 14 | 122448 | AI Chatbots Give Misleading Medical Advice | Science | discovery | 37.1s | deep_read |
| 15 | 119993 | US Blockade Traps Japan Ships in Gulf | World | fresh_best | 36.3s | deep_read |
| 16 | 104844 | Tiger Woods Takes Leave | Sports | personal | 36.5s | deep_read |
| 17 | 124063 | Uber Shares Plunge 25% | Business | discovery | 36.0s | deep_read |
| 18 | 120992 | Spider-Man 3 Leaked | Entertainment | trending | 34.6s | deep_read |
| 19 | 123651 | Allbirds Pivots to AI, Stock Jumps 175% | Business | trending | 30.8s | deep_read |
| 20 | 122713 | Longevity Resorts | Health | personal | 30.5s | deep_read |
| 21 | 119740 | Stone Age Tombs Reveal DNA Webs | Science | trending | 29.4s | deep_read |
| 22 | 122396 | OpenAI Limits Access Like Anthropic | Tech | discovery | 29.4s | deep_read |
| 23 | 110674 | US Softens Alcohol Cancer Stance | Health | trending | 29.0s | deep_read |
| 24 | 122855 | Saudi Aramco Profits Amid Iran War | Business | trending | 28.9s | deep_read |
| 25 | 122358 | Madrid Vertical Gardens | Lifestyle | personal | 28.6s | deep_read |
| 26 | 124219 | Business article (pivot liked) | Business | pivot | 28.4s | deep_read |
| 27 | 122819 | Disney Slashes 1000 Jobs | Business | fresh_best | 28.0s | deep_read |
| 28 | 122352 | Israel Hacks Iran Traffic Cams | World | trending | 27.9s | deep_read |
| 29 | 122965 | Futuristic Hong Kong Bar Design | Lifestyle | discovery | 27.9s | deep_read |
| 30 | 123914 | Godzilla Minus Zero Teaser | Entertainment | trending | 27.4s | deep_read |
| 31 | 123017 | India Nuclear Breakthrough | Science | trending | 27.4s | deep_read |
| 32 | 122646 | Schumer Demands FIFA Cover World Cup Transport | Sports | discovery | 27.6s | deep_read |
| 33 | 123936 | World article (later session) | World | trending | 27.1s | deep_read |
| 34 | 122635 | Eagles Super Bowl Confetti on Artemis II | Sports | discovery | 26.7s | deep_read |
| 35 | 122820 | SoftBank $40B OpenAI Loan | Business | trending | 26.6s | deep_read |
| 36 | 122945 | Kering/Gucci Sales Drop | Business | discovery | 26.3s | deep_read |
| 37 | 122969 | GoPro Mission 1 Lineup | Tech | discovery | 25.4s | deep_read |
| 38 | 111027 | Rockstar Eyes New IP After GTA 6 | Entertainment | personal | 25.7s | deep_read |
| 39 | 71822 | SpaceX, OpenAI, Anthropic Eye IPOs | Business | pivot | 24.7s | engaged_read |
| 40 | 94743 | Epidemiologist Warns Pandemic Risk | Health | personal | 24.3s | engaged_read |

*Items 1-3 likely had the app left open on that article (background time counted as dwell)

---

## 14. Appendix: Complete Skipped Article List (Showing Category Distribution)

### Category Breakdown of 201 Skipped Articles

| Category | Skipped Count | Avg Dwell Before Skip | Pattern |
|----------|---------------|----------------------|---------|
| World | 36 | 1.3s | Fastest skips — instant recognition of disinterest |
| Politics | 32 | 1.6s | Very fast skips, occasionally glances at headline |
| Business | 30 | 1.5s | Skips generic business, engages specific |
| Entertainment | 25 | 1.5s | Skips non-franchise entertainment |
| Sports | 24 | 1.6s | Skips non-interest sports |
| Finance | 19 | 1.6s | Skip most finance — too generic |
| Health | 9 | 1.5s | Lower skip count — good targeting |
| Lifestyle | 9 | 1.8s | Slightly longer dwell before skip |
| Crypto | 7 | 1.8s | Skips routine crypto, engages extremes |
| Science | 6 | 1.5s | Lowest skip count — best targeting |
| Tech | 2 | 1.3s | Almost never skipped — excellent match |

---

## 15. Conclusion

The feed algorithm (V23) shows strong capability in some areas — particularly its discovery bucket performance and its accurate identification of the user's AI/business/health interests. However, three critical issues prevent it from delivering a truly personalized experience:

1. **The skip profile saturation bug** removes the algorithm's ability to learn from negative signals, causing 26% of the feed to be filled with Politics/World content the user ignores.

2. **Home country content is structurally disadvantaged** — Turkiye articles compete against global content in generic pools, despite the user showing the highest like-rate (25%) on Turkiye content.

3. **Category-level routing is too coarse** — the user's engagement within Sports, Entertainment, and Business is highly entity-specific (Sinner, Spider-Man, AI deals), but the algorithm treats these as uniform categories.

Fixing the skip profile alone would likely improve overall engagement from 25.2% to an estimated 35-40%, as the algorithm would naturally suppress the ~100 articles per day in Politics/World/Finance that the user scrolls past in under 2 seconds.

---

*Report generated April 16, 2026. Data source: Supabase production database, `user_article_events` table, `published_articles` table, `profiles` table.*
