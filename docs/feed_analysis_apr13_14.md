# Feed Algorithm Analysis Report
**User:** omer (5082a1df) | **Period:** April 13-14, 2026 | **Generated:** April 15, 2026

---

## 1. Executive Summary

Over 2 days, the user consumed **437 articles** across **11 sessions** totaling approximately **67 minutes** of active reading (excluding idle outliers). The overall engagement rate was **32.3%** (141 engaged reads out of 437 impressions). Three critical algorithm bugs were identified that degrade feed quality, and the personal pool collapsed from 58% of impressions (Apr 12) to 7.6% (Apr 14).

---

## 2. User Profile State

| Field | Value |
|---|---|
| Articles read (lifetime) | 1,453 |
| Home country | Turkey |
| Followed topics | [] (empty -- never synced from onboarding) |
| Taste vector last updated | March 5, 2026 (39 days stale) |
| Interest clusters | 0 (clustering pipeline has not generated any) |
| Tag profile entries | 30+ (top: nasa 0.75, AI 0.72, madrid 0.61) |
| Skip profile entries | 2,902 (47 entries at maximum 0.90 weight) |
| Entity signals | 2,468 entries (last batch: April 6, 8 days stale) |

**Critical:** The taste vector is 39 days stale, there are zero interest clusters, and the skip profile is massively saturated. The algorithm falls back to single-vector matching with degraded entity scoring.

---

## 3. Session-by-Session Breakdown

### Session 1 — Apr 13, 10:25-10:35 (10 min)
- **31 articles** | **42% engagement** | Buckets: 58% personal, 26% trending, 16% discovery
- Strong personal pool session. Engaged deeply with Tech (AI bots, Meta AI clone) and Science (quantum entanglement).
- 5 consecutive skips mid-session on Lifestyle/Health content.

### Session 2 — Apr 13, 11:16-11:17 (1 min)
- **3 articles** | **100% engagement** | Quick catch-up session.

### Session 3 — Apr 13, 14:07-14:16 (10 min)
- **24 articles** | **29% engagement** | Buckets: 38% trending, 29% discovery, 25% personal
- 6 consecutive skips. Lifestyle dominated (38% of impressions) despite low engagement.

### Session 4 — Apr 13, 21:11-21:21 (10 min)
- **53 articles** | **28% engagement** | Buckets: 49% trending, 28% discovery, 11% personal
- Personal pool already shrinking. Tech dominated engagement (14 impressions). 6 consecutive skips.

### Session 5 — Apr 14, 09:20-10:04 (44 min) — LONGEST SESSION
- **156 articles** | **39% engagement** | Buckets: 48% trending, 31% discovery, 15% fresh_best, 6% personal
- Personal pool at just 6%. User consumed content aggressively — 7 consecutive skips observed.
- Top engaged categories: Business, Tech, Science (consistent with 30-day profile).

### Session 6 — Apr 14, 15:03-15:04 (2 min)
- **8 articles** | **63% engagement** | Buckets: 63% personal
- Short but high-quality session. Personal pool working well when available.

### Session 7 — Apr 14, 16:12-16:42 (30 min)
- **9 articles** | **56% engagement** | **100% bandit bucket**
- All articles came from the exploration/bandit system. 4 absorbed reads (65+ seconds each).

### Session 8 — Apr 14, 18:42-18:48 (6 min)
- **4 articles** | **75% engagement** | **100% bandit bucket**
- Highest engagement rate of all sessions. 3 absorbed reads.

### Session 9 — Apr 14, 21:02-21:14 (12 min)
- **69 articles** | **32% engagement** | Buckets: 36% trending, 32% personal, 23% discovery
- Personal pool recovered briefly. Strong engagement on Science and Tech.

### Session 10 — Apr 14, 22:13-22:15 (2 min) — MASS SKIP
- **38 articles** | **8% engagement** | Buckets: 53% trending, 32% discovery, 16% fresh_best
- **15 consecutive skips** — worst streak observed. Zero personal articles. User rapidly scrolled through the entire page.

### Session 11 — Apr 14, 22:49-22:52 (3 min) — MASS SKIP
- **42 articles** | **12% engagement** | Buckets: 50% trending, 33% discovery, 17% fresh_best
- 8 consecutive skips. Sports and Politics dominated (8 each) despite being the user's weakest categories.

---

## 4. Engagement Analysis

### 4a. By Category (7-Day)

| Category | Impressions | Engaged | Rate | Feed Allocation |
|---|---|---|---|---|
| **Tech** | 228 | 86 | **37.7%** | 13.7% |
| **Business** | 261 | 85 | **32.6%** | 12.8% |
| **Science** | 249 | 77 | **30.9%** | 13.5% |
| Food | 4 | 3 | 75.0% | 0.2% |
| Lifestyle | 156 | 37 | 23.7% | **18.5%** |
| World | 75 | 15 | 20.0% | 4.1% |
| Crypto | 22 | 4 | 18.2% | 3.2% |
| Sports | 105 | 18 | 17.1% | 6.6% |
| Entertainment | 130 | 22 | 16.9% | 7.3% |
| Politics | 95 | 16 | 16.8% | 6.2% |
| Health | 159 | 30 | 18.9% | 8.9% |
| Finance | 83 | 11 | **13.3%** | 3.4% |

**Key finding:** Lifestyle receives **18.5% of impressions** (highest) but only has **23.7% engagement** — the algorithm is over-serving it. Tech gets 13.7% allocation but has the highest engagement at 37.7%. The algorithm should serve more Tech/Business/Science and less Lifestyle/Entertainment/Politics.

### 4b. By Bucket

| Bucket | Impressions | Engaged | Rate | Avg Dwell (engaged) |
|---|---|---|---|---|
| **Bandit** | 13 | 8 | **61.5%** | 115s |
| **Personal** | 67 | 31 | **46.3%** | 672s* |
| Fresh Best | 50 | 17 | 34.0% | 10s |
| Trending | 188 | 55 | 29.3% | 15s |
| Discovery | 119 | 30 | 25.2% | 9s |

*Personal avg dwell inflated by idle outliers. Median is 7.6s.

**Key finding:** Personal and Bandit buckets dramatically outperform Trending and Discovery. Yet personal pool allocation collapsed from **58.2% (Apr 12) to 7.6% (Apr 14)**. The algorithm is increasingly relying on its worst-performing pools.

### 4c. Top 10 Engaged Articles (by dwell)

| Article | Dwell | Category | Source |
|---|---|---|---|
| Amazon Buys Globalstar for $11.5B | 2,804s | Business | MacRumors |
| IEA Warns Iran War Fuels Energy Crisis | 489s | Business | Euronews |
| McIlroy Secures Masters Win | 418s | Sports | Newsweek |
| Trump's Blockade Hits Iran's Oil | 369s | World | FAZ |
| Tesla Adds 'Streaks' to FSD | 253s | Tech | TechCrunch |
| AI Bot Activity Surges 300% | 237s | Tech | ANSA |
| Iran Faces Economic Ruin | 137s | World | FAZ |
| Dexter: Resurrection, Brian Cox | 117s | Entertainment | Collider |
| India Women's Reservation Bill | 102s | Politics | The Hindu |
| Solar Cell Exceeds 100% Efficiency | 102s | Science | New Atlas |

**Pattern:** The user deeply engages with **consequential business/tech stories** (acquisitions, market disruptions, AI developments), **geopolitical analysis** (Iran crisis), and **specific science breakthroughs**. They skip generic health, routine sports scores, and political procedural news.

### 4d. Skip Profile Paradox

Many entities appear in BOTH tag_profile (positive signal) and skip_profile (negative signal) at high weights:

| Entity | Tag Profile | Skip Profile |
|---|---|---|
| nasa | 0.754 | 0.900 |
| health | 0.586 | 0.900 |
| moon | 0.410 | 0.900 |
| artemis ii | 0.352 | 0.900 |
| soccer | 0.270 | 0.900 |

This occurs because the skip profile accumulates across ALL articles in a topic — the user engages with 1 in 3 NASA articles but skips the other 2, pushing both profiles to high values. The net effect is ambiguity: the algorithm receives contradictory signals and defaults to neutral scoring.

---

## 5. Algorithm Architecture

### 5a. Overview

The feed algorithm (`pages/api/feed/main.js`, 3,926 lines) processes each request in 8 phases:

1. **User Resolution** — Parallel loading of user profile, entity signals, taste vectors, seen history (6 concurrent branches).
2. **Pool Construction** — Four article pools are fetched in parallel:
   - **Personal**: pgvector cosine similarity search using taste vector (multi-cluster or single-vector)
   - **Trending**: Top articles by AI quality score per category (last 7 days)
   - **Discovery**: Lower-threshold articles per category for exploration
   - **Fresh Best**: Highest quality from last 48 hours, no personalization
3. **Scoring** — Each article is scored by its pool-specific function incorporating entity signals, tag profile, category suppression, freshness, and AI quality.
4. **Slot-Based Selection** — A repeating pattern (e.g., `P,T,D,T,P,D,T,D,T,F`) determines which pool fills each position, with MMR diversity enforcement.
5. **Response** — Selected articles are formatted and returned with pagination cursor.

### 5b. Scoring Functions

**`scorePersonalV3()`** — For personal pool articles:
```
score = (tagScore * 350 + momentum * 150 + vectorSimilarity * 250 + aiQuality * 250) * freshness * (1 - skipPenalty)
```

**`scoreTrendingV3()` / `scoreDiscoveryV3()`** — For trending/discovery:
```
score = aiQuality * freshness * categorySuppression * entityMult * underfedBoost * followedPublisherBoost
```

**Entity Signal Multiplier (3-layer matching):**
- Layer 1: Exact match of article tag to user entity signal (confidence 1.0)
- Layer 2: Fuzzy word-overlap match (Jaccard > 0.40, boost-only, never suppresses)
- Layer 3: Embedding similarity (cosine > 0.65, disabled in production)
- Output range: 0.15x to 1.85x

**Entity Affinity Computation:**
```
blendedRate = recentRate(7d) * 0.8 + allTimeRate * 0.2
confidence = 1 - 1/(1 + totalInteractions * 0.2) + interestCount * 0.05
affinity = tanh((blendedRate - 0.5) * 4) * confidence
```

### 5c. SLOTS Pattern

The personal pool availability determines the slot pattern:

| Personal Unseen Count | Pattern | Personal % |
|---|---|---|
| >= 15 articles | P,P,T,P,P,D,P,P,T,D | 60% |
| >= 5 articles | P,T,D,T,P,D,T,D,T,F | 20% |
| < 5 articles | T,D,T,D,T,F,T,D,T,F | **0%** |

**This is the root cause of the personal pool collapse.** With zero interest clusters and a 39-day-stale taste vector, the multi-cluster pgvector search returns few matches. The personal pool drops below 5 unseen articles, triggering the 0% personal pattern. The feed falls back entirely to trending + discovery, which have 29% and 25% engagement rates respectively (vs. 46% for personal).

### 5d. Pivot Mode

When 6+ consecutive interactions are skips, pivot mode activates. It filters ALL candidates to require:
- At least 1 positive entity signal match (affinity > 0.2)
- Zero negative matches (affinity < -0.2)
- Net affinity sum > 0.3

With stale entity signals (8 days old), this filter may exclude good articles whose signals haven't been updated.

---

## 6. Identified Bugs

### Bug 1: `scoreArticleV3` Called with Wrong Arguments (Line 2364)

The function expects 9 parameters but receives 7, with 3 of them being the wrong type:

| Position | Expected | Actually Passed |
|---|---|---|
| 6th | `entitySignals` (object with pos/neg counts) | `skipProfile` (object with float weights) |
| 7th | `recentEntityCounts` (frequency map) | `sessionInteractionCount` (integer) |
| 8th | `onboardingEntities` (Set) | `undefined` |
| 9th | `sessionInteractionCount` (integer) | `undefined` |

**Impact:** Entity affinity scoring silently returns 1.0 (neutral) for all personal articles. Topic saturation penalty returns 1.0 (disabled). Adaptive session weighting is stuck at 0.30 regardless of session length. The personal pool scoring is essentially running without entity awareness.

### Bug 2: `entitySignals` Variable Overwritten (Line 2313)

Line 1772 computes fresh entity signals from the user's raw events (last 30 days). Line 2313 then overwrites this variable with data from `user_entity_signals` table (last batch: April 6). The fresh computation is discarded.

**Impact:** The algorithm uses 8-day-stale entity data instead of real-time signals. The 24h/7d decay windows in the stale data are inaccurate.

### Bug 3: Double Freshness Penalty

`splitTwoTiers()` applies `freshnessMultiplier()` on top of scores that already include `getRecencyDecay()`. These use different decay curves, so older articles receive a compounding penalty:
- A 3-day-old breaking article: `getRecencyDecay` gives ~0.30, then `freshnessMultiplier` gives ~0.30 → effective: **0.09x** (should be ~0.30x)

### Bug 4: Entity Name Mismatch (Fixed Apr 15)

Article tags use "turkiye" but entity signals store "turkey". Without normalization, these don't match — the user's positive Turkey signal is invisible to article scoring. **Fixed** with the `ENTITY_ALIASES` normalization map.

### Bug 5: `interest_count` Race Condition (Fixed Apr 15)

The explore swipe handler used a read-then-write pattern:
```
existing = SELECT interest_count WHERE entity = 'turkey'  → returns 0
UPDATE interest_count = 0 + 0.5 WHERE entity = 'turkey'
```
Two concurrent requests both read 0 and write 0.5, losing one increment. **Fixed** with atomic upsert.

---

## 7. Root Cause Analysis: Why the Feed Degraded

### Primary: Personal Pool Collapse

| Date | Personal Pool % | Engagement Rate |
|---|---|---|
| April 12 | **58.2%** | ~45% |
| April 13 | **17.9%** | ~42% |
| April 14 | **7.6%** | ~46% |

The personal pool shrank because:
1. **Zero interest clusters** → multi-cluster search returns nothing → falls back to single-vector search
2. **Taste vector is 39 days stale** → single-vector search returns increasingly irrelevant articles
3. **Bug 1 disables entity scoring** → personal articles aren't properly ranked → many good ones get low scores and are filtered out
4. **Bug 3 double freshness penalty** → older personal articles get crushed → pool shrinks faster

With < 5 personal articles available, the SLOTS pattern switches to 0% personal, creating a self-reinforcing cycle: less personal content → worse engagement → skip signals accumulate → skip profile grows → even less content passes filters.

### Secondary: Skip Profile Saturation

The skip profile grew to 2,902 entries with 47 at maximum weight (0.90). Broad categories like "tech", "health", "science", "politics" — which the user actually engages with — are at max skip weight because the user skips 60-70% of articles in those categories. The skip profile doesn't distinguish between "hates the topic" and "selective within the topic."

### Tertiary: Stale Signals

- Taste vector: 39 days stale
- Entity signals: 8 days stale
- Interest clusters: nonexistent
- The algorithm progressively loses touch with the user's evolving interests.

---

## 8. Recommendations

### Immediate (Before Launch)

1. **Fix Bug 1** — Correct `scoreArticleV3` argument order. This single fix restores entity-aware scoring to the personal pool.
2. **Fix Bug 2** — Merge locally-computed entity signals with DB signals instead of overwriting.
3. **Fix Bug 3** — Remove the double freshness penalty in `splitTwoTiers`.
4. **Run the clustering pipeline** for this user to generate interest clusters and update the taste vector.
5. **Run entity signal batch update** to refresh the 8-day-stale data.

### Short-Term (Post-Launch)

6. **Skip profile decay** — Implement time-based decay so entries older than 14 days lose weight. Cap total entries at 500 with LRU eviction.
7. **Split skip signals** — Distinguish "topic-level skip" from "article-level skip." A user who skips 2/3 health articles is selective, not anti-health.
8. **Schedule clustering pipeline** — Run weekly (or on significant engagement milestones) to keep taste vectors and clusters fresh.

### Expected Impact

Fixing bugs 1-3 alone should:
- Restore personal pool to 30-50% of impressions (from 7.6%)
- Improve engagement rate from ~32% to ~40%+ (based on personal pool's 46% rate)
- Reduce consecutive-skip streaks (pivot mode will have proper entity data to filter with)

---

## Appendix A: Dwell Tier Definitions

| Tier | Dwell Range | Interpretation |
|---|---|---|
| instant_skip | < 1s | Rejected on sight (title/image) |
| quick_skip | 1-3s | Scanned headline, not interested |
| glance | 3-5s | Brief look, moved on |
| light_read | 5-15s | Skimmed bullets |
| engaged_read | 15-45s | Read full content |
| deep_read | 45-90s | Read thoroughly, possibly re-read |
| absorbed | > 90s | Extended engagement (or idle screen) |

## Appendix B: Entity Signal Formula

```
totalAll = positive_count + negative_count
recentRate = positive_7d / (positive_7d + negative_7d)    [if total7d >= 2]
allTimeRate = positive_count / totalAll
blendedRate = recentRate * 0.8 + allTimeRate * 0.2

confidence = 1 - 1/(1 + totalAll * 0.2)
confidence += min(interest_count, 5) * 0.05               [explore boost]
confidence = min(0.95, confidence)

centered = blendedRate - 0.5
decisive = tanh(centered * 4)                              [S-curve]
affinity = decisive * confidence                           [range: -0.95 to +0.95]

multiplier = max(0.15, min(1.85, 1.0 + avgAffinity * 0.8))
```

## Appendix C: Scoring Weights

| Component | Personal V3 | Trending V3 | Discovery V3 |
|---|---|---|---|
| Tag profile match | 350 | — | — |
| Vector similarity | 250 / 500* | — | — |
| AI quality score | 250 | direct | direct |
| Session momentum | 150 | — | — |
| Entity multiplier | via affinity | 0.15x-1.85x | 0.15x-1.85x |
| Category suppression | — | 0.10x-1.30x | 0.10x-1.30x |
| Freshness | decay curve | decay curve | decay curve |
| Skip penalty | 0-0.90 | 0-0.80 (capped) | 0-0.80 (capped) |

*500 when using `scoreArticleV3` (personalization_id path), 250 when using `scorePersonalV3` (legacy path).
