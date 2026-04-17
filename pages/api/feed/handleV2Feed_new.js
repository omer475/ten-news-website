// ═══════════════════════════════════════════════════════════════
// EMBEDDING-FIRST FEED ALGORITHM (v22)
//
// Core architecture per MEGA_RAPOR (TikTok, Pinterest, Instagram):
// 1. pgvector ANN search is the PRIMARY matching mechanism
// 2. Tags are metadata only (search, explore labels, skip penalty)
// 3. Learning happens via EMA taste_vector updates
// 4. Diversity via embedding cosine similarity (not tag Jaccard)
// ═══════════════════════════════════════════════════════════════

// Imported from main file: cosineSim, safeJsonParse, getRecencyDecay,
// formatArticle, titleSimilarity, getTitleWords, enforceConsecutiveLimit

// ═══════════════════════════════════════════════════════════════
// EMBEDDING-BASED SESSION MOMENTUM
// Replaces tag-based computeSessionMomentum
// ═══════════════════════════════════════════════════════════════

async function computeSessionVector(supabase, engagedIds, skippedIds) {
  const DIM = 384;
  let sessionVector = null;

  if (engagedIds.length > 0) {
    const { data: engaged } = await supabase
      .from('published_articles')
      .select('embedding_minilm')
      .in('id', engagedIds.slice(0, 20));

    if (engaged && engaged.length > 0) {
      const avg = new Array(DIM).fill(0);
      let count = 0;
      for (const a of engaged) {
        if (!a.embedding_minilm || !Array.isArray(a.embedding_minilm)) continue;
        for (let i = 0; i < DIM; i++) avg[i] += a.embedding_minilm[i];
        count++;
      }
      if (count > 0) {
        for (let i = 0; i < DIM; i++) avg[i] /= count;
        sessionVector = avg;
      }
    }
  }

  // Subtract skipped direction (light push-away)
  if (skippedIds.length > 0 && sessionVector) {
    const { data: skipped } = await supabase
      .from('published_articles')
      .select('embedding_minilm')
      .in('id', skippedIds.slice(0, 20));

    if (skipped && skipped.length > 0) {
      const skipAvg = new Array(DIM).fill(0);
      let count = 0;
      for (const a of skipped) {
        if (!a.embedding_minilm || !Array.isArray(a.embedding_minilm)) continue;
        for (let i = 0; i < DIM; i++) skipAvg[i] += a.embedding_minilm[i];
        count++;
      }
      if (count > 0) {
        for (let i = 0; i < DIM; i++) sessionVector[i] -= 0.3 * skipAvg[i] / count;
      }
    }
  }

  return sessionVector;
}

// ═══════════════════════════════════════════════════════════════
// EMBEDDING-BASED SCORING
// ═══════════════════════════════════════════════════════════════

function scoreEmbedding(article, pgvecSimilarity, sessionVector, skipProfile, cosineSim, safeJsonParse, getRecencyDecay) {
  const recency = getRecencyDecay(article.created_at, article.category, article.shelf_life_days);
  const quality = ((article.ai_final_score || 0) / 1000) * recency;

  // Session boost: how similar is this article to what user engaged with THIS session
  let sessionBoost = 0;
  if (sessionVector && article.embedding_minilm && Array.isArray(article.embedding_minilm)) {
    sessionBoost = Math.max(0, cosineSim(sessionVector, article.embedding_minilm));
  }

  // Skip penalty (lightweight tag-based, kept because it's simple and works)
  let skipPenalty = 0;
  if (skipProfile) {
    const tags = safeJsonParse(article.interest_tags, []);
    const n = Math.max(tags.length, 1);
    let skipScore = 0;
    const now = Date.now();
    const SKIP_HALF_LIFE_MS = 7 * 24 * 3600000;
    for (const tag of tags) {
      const entry = skipProfile[tag.toLowerCase()];
      if (typeof entry === 'object' && entry?.w) {
        const age = now - new Date(entry.t || 0).getTime();
        skipScore += entry.w * Math.exp(-0.693 * age / SKIP_HALF_LIFE_MS);
      } else if (typeof entry === 'number') {
        skipScore += entry;
      }
    }
    skipPenalty = Math.min(skipScore / n * 0.3, 0.4);
  }

  // Scoring: pgvector similarity is KING (per MEGA_RAPOR)
  const base = pgvecSimilarity * 500 + quality * 200 + sessionBoost * 200;
  return base * (1 - skipPenalty);
}

// ═══════════════════════════════════════════════════════════════
// EMBEDDING-BASED MMR DIVERSITY
// Uses cosine similarity between article embeddings (not tag overlap)
// ═══════════════════════════════════════════════════════════════

function buildEmbeddingCache(articles) {
  const cache = new Map();
  for (const a of articles) {
    if (a.embedding_minilm && Array.isArray(a.embedding_minilm)) {
      cache.set(a.id, a.embedding_minilm);
    }
  }
  return cache;
}

function mmrSelectEmbedding(candidates, selected, embCache, lambda, cosineSim, titleSimilarity) {
  if (candidates.length === 0) return null;
  if (selected.length === 0) return candidates.shift();

  const maxScore = Math.max(...candidates.map(c => c._score), 1);
  let bestIdx = 0;
  let bestMMR = -Infinity;

  const recent = selected.slice(-8);

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const normScore = c._score / maxScore;

    let maxSim = 0;
    const cEmb = embCache.get(c.id);
    const cTitle = c.title_news || '';

    for (const s of recent) {
      let sim = 0;

      // Embedding similarity (primary diversity signal)
      const sEmb = embCache.get(s.id);
      if (cEmb && sEmb) {
        sim = Math.max(0, cosineSim(cEmb, sEmb));
      }

      // Title dedup (catches near-duplicate stories)
      const titleSim = titleSimilarity(cTitle, s.title_news || '');
      if (titleSim >= 0.4) sim = Math.max(sim, 0.85);
      else if (titleSim >= 0.25) sim = Math.max(sim, 0.6);

      // Same category penalty
      if (c.category === s.category) sim = Math.max(sim, 0.2);

      // Same cluster penalty
      if (c.cluster_id && c.cluster_id === s.cluster_id) sim = Math.max(sim, 0.5);

      maxSim = Math.max(maxSim, sim);
    }

    const mmr = lambda * normScore - (1 - lambda) * maxSim;
    if (mmr > bestMMR) {
      bestMMR = mmr;
      bestIdx = i;
    }
  }

  return candidates.splice(bestIdx, 1)[0];
}

// ═══════════════════════════════════════════════════════════════
// MAIN FEED FUNCTION
// ═══════════════════════════════════════════════════════════════

module.exports = { computeSessionVector, scoreEmbedding, buildEmbeddingCache, mmrSelectEmbedding };
