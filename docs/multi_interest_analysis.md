# Personalized Feed Analysis: 5-User Multi-Interest Study

## Executive Summary

Single taste vector fails catastrophically for multi-interest users. With strict keyword classification, **precision averages just 25%** (75% of personal feed is irrelevant). K-means multi-cluster with round-robin improves this to **30%** and **doubles interest representation** from 1.0 to 2.0 out of 3 interests. However, the dominant problem is **embedding-space flooding by breaking news** (Iran war articles score 0.85-0.89 similarity against ANY taste vector), which neither approach fully solves.

## Test Setup

- **4,900 articles** with 3072-dim Gemini embeddings in 72h window
- **50 high-score articles (>=850)**, mostly Iran/US war coverage at 950-970
- 5 test users, 140-170 simulated engagements each, shuffled across interests

## Results

### Final Comparison Table

| User | Interests | Eng | K | A (Current) | B (Fix) | Delta | A Irrel | B Irrel |
|------|-----------|-----|---|-------------|---------|-------|---------|---------|
| User 1: F1+NBA+Tennis | 3 | 162 | 3 | 5.0% | 30.0% | **+25.0%** | 19/20 | 14/20 |
| User 2: AI+K-pop+Space | 3 | 171 | 3 | 5.0% | 30.0% | **+25.0%** | 19/20 | 14/20 |
| User 3: TurkPol+MidEast+TurkFB | 3 | 164 | 2 | 85.0% | 55.0% | -30.0% | 3/20 | 9/20 |
| User 4: Crypto+Climate+Gaming | 3 | 139 | 2 | 5.0% | 5.0% | +0.0% | 19/20 | 19/20 |
| User 5: UFC Only (Control) | 1 | 80 | 1 | 0.0% | 0.0% | +0.0% | 20/20 | 17/20 |

### Interest Representation

| User | Interest | A (now) | B (fix) | Delta | Target |
|------|----------|---------|---------|-------|--------|
| User 1 | F1 Racing | 1/20 | 4/20 | +3 | ~8/20 |
| User 1 | NBA | 0/20 | 1/20 | +1 | ~7/20 |
| User 1 | Tennis | 0/20 | 1/20 | +1 | ~5/20 |
| User 2 | AI/ML | 0/20 | 4/20 | +4 | ~8/20 |
| User 2 | K-pop | 0/20 | 0/20 | +0 | ~6/20 |
| User 2 | Space | 1/20 | 2/20 | +1 | ~6/20 |
| User 3 | Turkish Politics | 0/20 | 1/20 | +1 | ~7/20 |
| User 3 | Middle East | 17/20 | 10/20 | -7 | ~7/20 |
| User 3 | Turkish Football | 0/20 | 0/20 | +0 | ~6/20 |
| User 4 | Crypto | 0/20 | 0/20 | +0 | ~7/20 |
| User 4 | Climate | 0/20 | 0/20 | +0 | ~7/20 |
| User 4 | Gaming | 1/20 | 1/20 | +0 | ~6/20 |

**Minority interest recovery:** 4/8 zero-representation interests gained coverage with multi-cluster.

## Root Cause Analysis

### Problem 1: EMA Averaging Destroys Multi-Interest Signal
The EMA formula `new = (1-alpha)*current + alpha*article_embedding` with alpha=0.05-0.15 causes the taste vector to drift toward a generic centroid after 200+ interactions across 3 different interests. The resulting vector sits equidistant from all interests, matching none well.

### Problem 2: Embedding Space Doesn't Discriminate (The Real Killer)
Gemini 3072-dim embeddings produce a narrow similarity band:
- Relevant articles: 0.83-0.89 similarity
- Irrelevant articles: 0.82-0.89 similarity
- **Overlap is near-total**

Iran war articles score **0.85-0.93** against ALL taste vectors including UFC, K-pop, and Gaming users. The embedding space's center of mass is dominated by breaking global news, and all vectors are close to it in 3072 dimensions.

### Problem 3: Niche Content Scarcity
Some interests simply don't have enough articles in the 72h window:
- K-pop: 16 articles found
- Turkish Football: 4 articles found
- Crypto (specific keyword matches): 20 articles found

Even perfect retrieval can't surface content that doesn't exist.

## What Works

1. **K-means clustering** correctly separates interest groups (F1 vs NBA vs Tennis as 3 clusters with 61/41/58 articles respectively)
2. **Round-robin slot allocation** ensures each cluster gets representation (interest diversity: 1.0 → 2.0 out of 3)
3. **Category capping** (max 3-5 per category) prevents "World" articles from monopolizing the feed

## What Doesn't Work

1. **Similarity floor** — the dynamic floor (p25 at 0.79) is too low to filter Iran articles at 0.85+
2. **Category suppression** — categories are too broad (UFC articles categorized as "Sports", same as all other sports)
3. **Multi-cluster alone** — improves diversity but Iran articles still flood each cluster's results

## Implemented Changes

### 1. SQL Migration (019)
- `match_articles_personal()`: added `min_similarity` parameter
- `match_articles_multi_cluster()`: added `min_similarity` parameter
- `users.similarity_floor`: per-user adaptive floor column
- `user_interest_clusters.is_centroid`: flag for k-means centroids

### 2. Python K-Means Clustering Service
- `services/cluster_user_interests.py`
- Replaces SQL category-based grouping with proper embedding-space k-means
- Automatic k selection via silhouette score (k=1..5)
- Stores centroids in `user_interest_clusters` with `is_centroid=true`
- Computes and stores per-user `similarity_floor`
- Run with: `python3 services/cluster_user_interests.py --all`

### 3. Feed Algorithm (main.js)
- **Round-robin interleaving** when clusters exist: picks articles from each cluster in turn instead of sorting all by similarity
- **Similarity floor** passed to RPC calls
- **Category cap** (max 5 per category) in personal bucket to prevent news-event flooding

## Recommendations for Further Improvement

### High Impact, Moderate Effort
1. **World-event deduplication**: Use the `article_world_events` table to cap articles per world event at 2-3. This directly solves the Iran war flooding.
2. **Topic-based hybrid scoring**: Combine embedding similarity (70%) with topic-tag overlap score (30%). Articles whose `topics` JSONB matches user's engaged topics get boosted, others get penalized.

### High Impact, High Effort
3. **Negative signal / skip tracking**: Track articles users scroll past without clicking. Build a "not interested" vector and push taste vectors away from skipped content.
4. **Smaller topic-tuned embeddings**: Replace 3072-dim general Gemini embeddings with 768-dim model fine-tuned on news category/topic discrimination. This would also enable HNSW indexing (current 3072 exceeds the 2000-dim limit).

### Medium Impact, Low Effort
5. **Increase category cap granularity**: Use `interest_tags` instead of broad `category` for capping. "UFC" vs "Soccer" vs "F1" instead of all being "Sports".
6. **Time-weighted clustering**: Weight recent engagements more heavily in k-means to capture evolving interests.
