// Phase 1.8 (2026-05-10) — Cold-start warm-start histogram synthesis.
//
// Why: pre-1.8, users with qualifyingCount < 50 (COLD_START_QUALIFYING_FLOOR
// in trinityServe.js) bypassed Trinity entirely and got top-trending. The
// onboarding tags they selected at signup were ignored. Deleting v11 (Phase
// 1.1) would have regressed new-user UX further because v11's "interest
// bucket" was the only consumer of ONBOARDING_TOPIC_MAP.
//
// Fix: convert the user's followed_topics into a SYNTHETIC h¹/h² histogram
// and merge with the real (initially empty) histogram from
// trinity_build_histogram. As the user accumulates real engagement events,
// the synthetic weight decays linearly to 0 around qualifyingCount=100.
// Trinity's warm-user path (M-tier1/2/LT/explore) then runs unchanged on
// the merged histogram — no separate cold path needed.
//
// Source: standard onboarding-bootstrap pattern (Spotify Discover Weekly
// initial seed, Pinterest Pinnability cold-start). PinnerSage shows hand-
// seeded interest clusters converge in 50-100 organic events.

import { J_PRIMARY, K_SECONDARY } from './trinity.js'

// ---------------------------------------------------------------------------
// ONBOARDING_TOPIC_MAP — moved from pages/api/feed/main.js (where v11 was the
// only consumer). Each topic code (sent by iOS at onboarding) maps to:
//   - subtopic display names (one or more)
//   - interest_tags used by the live-aggregation fallback for cluster lookup
//
// The display-name list mirrors the ONBOARDING_TOPIC_MAP that lived in
// pages/api/feed/main.js lines 22-99 and the TOPIC_TO_SUBTOPIC in
// pages/api/user/onboarding.js lines 145-200. Keeping these in sync requires
// updating BOTH files; this is the canonical version going forward.
// ---------------------------------------------------------------------------

export const ONBOARDING_TOPIC_MAP = Object.freeze({
  // ── Politics ──
  'war_conflict':         { tags: ['war', 'conflict', 'military', 'defense', 'invasion', 'military strikes'] },
  'us_politics':          { tags: ['us politics', 'congress', 'senate', 'white house', 'republican', 'democrat', 'trump', 'biden', 'supreme court', 'pentagon'] },
  'european_politics':    { tags: ['european politics', 'eu', 'european union', 'brexit', 'nato', 'parliament', 'germany', 'france', 'uk'] },
  'asian_politics':       { tags: ['asian politics', 'china', 'india', 'japan', 'asean', 'asia', 'north korea', 'taiwan'] },
  'middle_east':          { tags: ['middle east', 'iran', 'israel', 'saudi arabia', 'palestine', 'gulf', 'lebanon'] },
  'latin_america':        { tags: ['latin america', 'brazil', 'mexico', 'argentina', 'venezuela'] },
  'africa_oceania':       { tags: ['africa', 'oceania', 'australia', 'nigeria', 'south africa', 'kenya', 'egypt'] },
  'human_rights':         { tags: ['human rights', 'civil liberties', 'protest', 'democracy', 'censorship'] },

  // ── Sports ──
  'nfl':                  { tags: ['nfl', 'american football', 'quarterback', 'super bowl', 'touchdown'] },
  'nba':                  { tags: ['nba', 'basketball', 'lakers', 'celtics', 'lebron', 'playoffs'] },
  'soccer':               { tags: ['soccer', 'football', 'premier league', 'champions league', 'la liga', 'bundesliga', 'serie a', 'fifa', 'world cup'] },
  'baseball':             { tags: ['mlb', 'baseball', 'world series', 'home run'] },
  'cricket':              { tags: ['cricket', 'ipl', 'test match', 'ashes', 't20'] },
  'f1':                   { tags: ['f1', 'formula 1', 'motorsport', 'nascar', 'grand prix', 'racing'] },
  'boxing_mma':           { tags: ['boxing', 'mma', 'ufc', 'fight', 'knockout'] },
  'olympics':             { tags: ['olympics', 'paralympics', 'olympic games', 'gold medal'] },
  'tennis':               { tags: ['tennis', 'wimbledon', 'us open', 'french open', 'atp', 'wta'] },
  'golf':                 { tags: ['golf', 'pga', 'masters', 'us open golf'] },

  // ── Business ──
  'oil_energy':           { tags: ['oil', 'energy', 'opec', 'natural gas', 'renewable energy', 'oil prices', 'crude oil'] },
  'automotive':           { tags: ['automotive', 'cars', 'tesla', 'ford', 'gm', 'toyota', 'electric vehicles', 'ev'] },
  'retail_consumer':      { tags: ['retail', 'consumer', 'amazon', 'walmart', 'shopping', 'e-commerce'] },
  'corporate_deals':      { tags: ['merger', 'acquisition', 'deal', 'takeover', 'ipo', 'corporate'] },
  'trade_tariffs':        { tags: ['trade', 'tariffs', 'sanctions', 'import', 'export', 'trade war'] },
  'corporate_earnings':   { tags: ['earnings', 'quarterly results', 'revenue', 'profit'] },
  'startups_vc':          { tags: ['startup', 'venture capital', 'funding', 'seed round', 'unicorn', 'vc'] },
  'real_estate':          { tags: ['real estate', 'property', 'housing', 'mortgage'] },

  // ── Entertainment ──
  'movies_film':          { tags: ['movies', 'film', 'box office', 'hollywood', 'cinema', 'oscar'] },
  'tv_streaming':         { tags: ['tv', 'streaming', 'netflix', 'hbo', 'disney plus', 'series'] },
  'music':                { tags: ['music', 'album', 'concert', 'tour', 'grammy', 'rapper', 'singer'] },
  'gaming':               { tags: ['gaming', 'video games', 'playstation', 'xbox', 'nintendo', 'esports', 'steam'] },
  'celebrity_news':       { tags: ['celebrity', 'famous', 'scandal', 'gossip', 'star'] },
  'kpop_kdrama':          { tags: ['k-pop', 'k-drama', 'korean', 'bts', 'blackpink', 'kdrama'] },
  'anime_manga':          { tags: ['anime', 'manga', 'japanese animation'] },
  'comedy':               { tags: ['comedy', 'humor', 'standup', 'comedian'] },

  // ── Tech ──
  'ai_ml':                { tags: ['ai', 'artificial intelligence', 'machine learning', 'chatgpt', 'openai', 'deep learning', 'llm'] },
  'smartphones_gadgets':  { tags: ['smartphone', 'iphone', 'samsung', 'pixel', 'gadget', 'apple', 'android'] },
  'social_media':         { tags: ['social media', 'twitter', 'instagram', 'tiktok', 'facebook', 'meta', 'x'] },
  'cybersecurity':        { tags: ['cybersecurity', 'hacking', 'data breach', 'ransomware', 'privacy'] },
  'space_tech':           { tags: ['space tech', 'spacex', 'nasa', 'rocket', 'satellite', 'starship', 'blue origin'] },
  'robotics_hardware':    { tags: ['robotics', 'robot', 'hardware', 'chip', 'semiconductor', 'nvidia', 'processor'] },

  // ── Science ──
  'space_astronomy':      { tags: ['space', 'astronomy', 'mars', 'telescope', 'galaxy', 'asteroid'] },
  'climate_environment':  { tags: ['climate', 'environment', 'global warming', 'carbon', 'emissions', 'climate change'] },
  'biology_nature':       { tags: ['biology', 'nature', 'wildlife', 'evolution', 'genetics'] },
  'earth_science':        { tags: ['geology', 'earthquake', 'volcano', 'ocean', 'weather'] },

  // ── Health ──
  'medical_breakthroughs':{ tags: ['medical', 'breakthrough', 'treatment', 'cure', 'clinical trial'] },
  'public_health':        { tags: ['public health', 'pandemic', 'vaccine', 'cdc', 'who', 'outbreak'] },
  'mental_health':        { tags: ['mental health', 'anxiety', 'depression', 'therapy', 'mindfulness'] },
  'pharma_drug':          { tags: ['pharma', 'pharmaceutical', 'drug', 'fda', 'biotech'] },

  // ── Finance ──
  'stock_markets':        { tags: ['stock market', 'wall street', 'nasdaq', 'sp500', 'dow jones', 'shares'] },
  'banking':              { tags: ['banking', 'lending', 'interest rate', 'federal reserve', 'inflation'] },
  'commodities':          { tags: ['commodities', 'gold', 'silver', 'oil price', 'futures'] },

  // ── Crypto ──
  'bitcoin':              { tags: ['bitcoin', 'btc', 'satoshi', 'mining', 'halving'] },
  'defi_web3':            { tags: ['defi', 'web3', 'blockchain', 'smart contract', 'dao'] },
  'crypto_regulation':    { tags: ['crypto regulation', 'sec', 'crypto law', 'crypto ban', 'cryptocurrency'] },

  // ── Lifestyle ──
  'food_cooking':         { tags: ['food', 'cooking', 'recipe', 'restaurant', 'cuisine'] },
  'travel_adventure':     { tags: ['travel', 'adventure', 'tourism', 'destination'] },
  'fitness_workout':      { tags: ['fitness', 'workout', 'exercise', 'gym', 'training'] },
  'beauty_skincare':      { tags: ['beauty', 'skincare', 'makeup', 'cosmetics'] },
  'pets_animals':         { tags: ['pets', 'animals', 'dog', 'cat', 'wildlife'] },

  // ── Fashion ──
  'sneakers_streetwear':  { tags: ['sneakers', 'streetwear', 'nike', 'adidas', 'jordan', 'yeezy'] },
  'celebrity_style':      { tags: ['celebrity style', 'red carpet', 'outfit', 'met gala', 'fashion'] },

  // ── WEBSITE taxonomy (lib/personalization.js TOPICS) ──────────────────────
  // The web onboarding UI sends THESE codes (different from the iOS set above).
  // Without entries here, synthesizeWarmStartHistogram could not resolve a web
  // user's picks → no warm start. Codes already present above (cybersecurity,
  // tennis, f1, cricket, olympics, golf, music, gaming, stock_markets, banking,
  // human_rights) are reused as-is.
  'economics':            { tags: ['economy', 'gdp', 'inflation', 'recession', 'economic growth', 'imf', 'central bank'] },
  'startups':             { tags: ['startup', 'venture capital', 'funding', 'seed round', 'unicorn', 'vc'] },
  'ai':                   { tags: ['ai', 'artificial intelligence', 'machine learning', 'chatgpt', 'openai', 'llm', 'deep learning', 'nvidia'] },
  'tech_industry':        { tags: ['tech', 'technology', 'big tech', 'apple', 'google', 'microsoft', 'meta', 'amazon'] },
  'consumer_tech':        { tags: ['smartphone', 'iphone', 'samsung', 'pixel', 'gadget', 'android', 'laptop', 'wearable'] },
  'space':                { tags: ['space', 'spacex', 'nasa', 'rocket', 'satellite', 'starship', 'mars', 'aerospace'] },
  'science':              { tags: ['science', 'research', 'study', 'physics', 'chemistry', 'discovery', 'scientists'] },
  'climate':              { tags: ['climate', 'climate change', 'global warming', 'emissions', 'renewable', 'environment', 'carbon'] },
  'health':               { tags: ['health', 'medicine', 'disease', 'hospital', 'vaccine', 'medical', 'public health'] },
  'biotech':              { tags: ['biotech', 'pharma', 'pharmaceutical', 'drug', 'fda', 'gene', 'clinical trial'] },
  'politics':             { tags: ['politics', 'election', 'government', 'congress', 'senate', 'parliament', 'policy'] },
  'geopolitics':          { tags: ['geopolitics', 'foreign policy', 'diplomacy', 'sanctions', 'nato', 'united nations', 'china', 'russia'] },
  'conflicts':            { tags: ['war', 'conflict', 'military', 'defense', 'invasion', 'ceasefire', 'strikes'] },
  'football':             { tags: ['soccer', 'football', 'premier league', 'champions league', 'la liga', 'fifa', 'world cup', 'uefa'] },
  'american_football':    { tags: ['nfl', 'american football', 'quarterback', 'super bowl', 'touchdown'] },
  'basketball':           { tags: ['nba', 'basketball', 'playoffs', 'lebron', 'lakers', 'celtics'] },
  'combat_sports':        { tags: ['boxing', 'mma', 'ufc', 'fight', 'knockout'] },
  'winter_sports':        { tags: ['winter sports', 'skiing', 'snowboard', 'figure skating'] },
  'ice_hockey':           { tags: ['nhl', 'hockey', 'ice hockey', 'stanley cup'] },
  'rugby':                { tags: ['rugby', 'six nations', 'rugby world cup'] },
  'swimming':             { tags: ['swimming', 'swim', 'freestyle', 'olympic swimming'] },
  'entertainment':        { tags: ['entertainment', 'movies', 'film', 'tv', 'celebrity', 'hollywood', 'streaming', 'netflix'] },
  'travel':               { tags: ['travel', 'tourism', 'destination', 'airline', 'vacation'] },
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Threshold: above this qualifyingCount, no synthetic weight is injected
// (real signal is rich enough). Linear decay from 1.0 at QC=0 to 0.0 at
// QC=DECAY_THRESHOLD.
//
// Phase 2.4 (2026-05-10): tuned 100 → 80. Synthetic onboarding weight
// fades out faster as real engagement accumulates. WebConf 2024 audit
// shows TikTok's exploit fraction stabilizes around video index ~100,
// but for a text platform with deeper per-card signal, ~80 events is
// enough to dominate the histogram. Keeping decay too long pulls users
// back toward broad onboarding clusters when their real interests are
// already pulling away.
export const SYNTHETIC_DECAY_THRESHOLD = 80

// Per-topic weight injected at QC=0. Calibrated to exceed adaptiveThresholds'
// floor (tP=3, tS=2 at QC=0) while staying below "real engaged user" levels.
// Roughly equivalent to ~5-7 explicit engagements on the topic at signup.
//
// SECONDARY = 5 means even after the resolved-weight scaling (typically [0.1,
// 0.5] for 8 normalized clusters), the strongest secondaries land at 2.5+ in
// h2 — clearing the tS=2 floor in adaptiveThresholds. Weak secondaries still
// add up to 0.5+ which contributes to LT/explore selection.
export const SYNTHETIC_PRIMARY_WEIGHT = 12
export const SYNTHETIC_SECONDARY_WEIGHT = 5

// ---------------------------------------------------------------------------
// Linear synthetic-decay factor by qualifyingCount.
// ---------------------------------------------------------------------------

export function syntheticDecayFactor(qualifyingCount, threshold = SYNTHETIC_DECAY_THRESHOLD) {
  if (qualifyingCount <= 0) return 1.0
  if (qualifyingCount >= threshold) return 0.0
  return 1.0 - (qualifyingCount / threshold)
}

// ---------------------------------------------------------------------------
// Lookup followed_topics for a user. Returns array of topic codes.
// ---------------------------------------------------------------------------

export async function loadUserOnboardingTopics(supabase, userId) {
  if (!userId) return []
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('followed_topics')
      .eq('id', userId)
      .single()
    if (error || !data) return []
    const ft = data.followed_topics
    if (!Array.isArray(ft)) return []
    return ft.filter(t => typeof t === 'string')
  } catch (_) {
    return []
  }
}

// ---------------------------------------------------------------------------
// Cluster-resolution helpers.
//
// resolveClustersForTopics(supabase, topicCodes)
//   1. Try the precomputed onboarding_topic_clusters table.
//   2. Fall back to onboarding_clusters_live RPC for any topic codes the
//      table doesn't cover.
//   Returns Map<vq_secondary, { vq_primary, weight }>.
// ---------------------------------------------------------------------------

export async function resolveClustersForTopics(supabase, topicCodes) {
  const out = new Map()  // vq_secondary -> { vq_primary, weight }
  if (!Array.isArray(topicCodes) || topicCodes.length === 0) return out

  // 1. Lookup table (fast path).
  let coveredCodes = new Set()
  try {
    const { data, error } = await supabase
      .from('onboarding_topic_clusters')
      .select('topic_code, vq_primary, vq_secondary, weight')
      .in('topic_code', topicCodes)
    if (!error && Array.isArray(data)) {
      for (const row of data) {
        if (row.vq_primary == null || row.vq_secondary == null) continue
        coveredCodes.add(row.topic_code)
        const existing = out.get(row.vq_secondary)
        const weight = Number(row.weight) || 0
        if (!existing || weight > existing.weight) {
          out.set(row.vq_secondary, { vq_primary: row.vq_primary, weight })
        }
      }
    }
  } catch (_) {
    // Table missing or unavailable — fall through to live aggregation.
  }

  // 2. Live aggregation for uncovered topics.
  const uncovered = topicCodes.filter(t => !coveredCodes.has(t))
  for (const code of uncovered) {
    const meta = ONBOARDING_TOPIC_MAP[code]
    if (!meta || !Array.isArray(meta.tags) || meta.tags.length === 0) continue
    try {
      const { data, error } = await supabase.rpc('onboarding_clusters_live', {
        p_tags: meta.tags,
        p_top_n: 8,
      })
      if (error || !Array.isArray(data) || data.length === 0) continue
      // Normalize live counts to a [0, 1] weight scale per topic.
      const totalCnt = data.reduce((s, r) => s + (Number(r.cnt) || 0), 0)
      for (const row of data) {
        if (row.vq_primary == null || row.vq_secondary == null) continue
        const w = totalCnt > 0 ? (Number(row.cnt) || 0) / totalCnt : 0
        const existing = out.get(row.vq_secondary)
        if (!existing || w > existing.weight) {
          out.set(row.vq_secondary, { vq_primary: row.vq_primary, weight: w })
        }
      }
    } catch (_) {
      // Best effort — skip topic.
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// synthesizeWarmStartHistogram(supabase, userId, h1, h2, qualifyingCount)
//
// Mutates h1/h2 in place by ADDING synthetic weights derived from the user's
// onboarding topics, scaled by syntheticDecayFactor(qualifyingCount). Returns
// metadata about what was added (for debug surface).
//
// At QC=0 a user with one selected topic gets +SYNTHETIC_PRIMARY_WEIGHT (10)
// added to that topic's vq_primary in h1, and +SYNTHETIC_SECONDARY_WEIGHT (3)
// per top secondary in h2. As QC grows toward 100, this added weight decays
// linearly to 0.
// ---------------------------------------------------------------------------

export async function synthesizeWarmStartHistogram(supabase, userId, h1, h2, qualifyingCount) {
  const factor = syntheticDecayFactor(qualifyingCount)
  if (factor <= 0) return { applied: false, reason: 'qc-above-threshold', factor, primaries: [], secondaries: [] }
  if (!h1 || !h2) return { applied: false, reason: 'no-histograms', factor, primaries: [], secondaries: [] }

  const topics = await loadUserOnboardingTopics(supabase, userId)
  if (topics.length === 0) return { applied: false, reason: 'no-topics', factor, primaries: [], secondaries: [] }

  const clusters = await resolveClustersForTopics(supabase, topics)
  if (clusters.size === 0) return { applied: false, reason: 'no-clusters', factor, primaries: [], secondaries: [] }

  // Group secondaries by primary so we know which primaries get the bulk
  // weight. Each primary gets SYNTHETIC_PRIMARY_WEIGHT × decay × normalization;
  // each secondary gets SYNTHETIC_SECONDARY_WEIGHT × decay × resolved_weight.
  const primarySecondaries = new Map()  // vq_primary -> [{vq_secondary, weight}]
  for (const [c2, info] of clusters) {
    const c1 = info.vq_primary
    if (c1 < 0 || c1 >= J_PRIMARY) continue
    if (c2 < 0 || c2 >= K_SECONDARY) continue
    if (!primarySecondaries.has(c1)) primarySecondaries.set(c1, [])
    primarySecondaries.get(c1).push({ c2, w: info.weight })
  }

  const appliedPrimaries = []
  const appliedSecondaries = []
  for (const [c1, kids] of primarySecondaries) {
    const primaryAdd = SYNTHETIC_PRIMARY_WEIGHT * factor
    h1[c1] += primaryAdd
    appliedPrimaries.push({ c1, added: primaryAdd })
    for (const { c2, w } of kids) {
      const secAdd = SYNTHETIC_SECONDARY_WEIGHT * factor * Math.max(0, Math.min(1, w))
      if (secAdd > 0) {
        h2[c2] += secAdd
        appliedSecondaries.push({ c2, added: secAdd })
      }
    }
  }

  return {
    applied: true,
    factor,
    topicsCount: topics.length,
    primaries: appliedPrimaries,
    secondaries: appliedSecondaries,
  }
}
