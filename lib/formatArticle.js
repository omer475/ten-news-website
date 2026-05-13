// Shared JSON-shaping helpers for feed endpoints.
//
// Extracted (2026-05-12) from pages/api/feed/main.js so /api/feed/following
// and any future feed endpoint can ship the same contract to iOS without
// duplicating the formatter. Behavior preserved verbatim — see git blame
// on the prior main.js for change history.

import { expectedReadSecondsForArticle } from './readingTime.js'

export function safeJsonParse(value, fallback = null) {
  if (!value) return fallback
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) } catch { return fallback }
}

// formatArticle — shapes a published_articles row to the JSON contract the
// iOS Article model expects. eventMap is optional cross-session world-event
// attribution stamped by serveTrinityFeed; chronological feeds pass {}.
export function formatArticle(article, eventMap = {}) {
  const summaryBulletsNews = safeJsonParse(article.summary_bullets_news, [])
  const fiveWs = safeJsonParse(article.five_ws, null)
  const timeline = safeJsonParse(article.timeline, null)
  const graph = safeJsonParse(article.graph, null)
  const details = safeJsonParse(article.details, [])
  const components = article.components_order || safeJsonParse(article.components, null)
  const countries = safeJsonParse(article.countries, [])
  const topics = safeJsonParse(article.topics, [])
  const countryRelevance = safeJsonParse(article.country_relevance, null)
  const topicRelevance = safeJsonParse(article.topic_relevance, null)
  const interestTags = safeJsonParse(article.interest_tags, [])

  let map = null
  const rawMap = safeJsonParse(article.map, null)
  if (rawMap) {
    if (Array.isArray(rawMap) && rawMap.length > 0) {
      const primary = rawMap[0]
      map = {
        center: { lat: primary.coordinates?.lat || 0, lon: primary.coordinates?.lng || primary.coordinates?.lon || 0 },
        markers: rawMap.slice(1).map(loc => ({ lat: loc.coordinates?.lat || 0, lon: loc.coordinates?.lng || loc.coordinates?.lon || 0 })),
        name: primary.name,
        location: [primary.name, primary.city, primary.country].filter(Boolean).join(', '),
        city: primary.city,
        country: primary.country,
        region: primary.country,
        description: primary.description,
      }
    } else if (!Array.isArray(rawMap)) {
      map = {
        center: { lat: rawMap.coordinates?.lat || rawMap.lat || 0, lon: rawMap.coordinates?.lng || rawMap.coordinates?.lon || rawMap.lon || 0 },
        markers: [],
        name: rawMap.name,
        location: [rawMap.name, rawMap.city, rawMap.country].filter(Boolean).join(', ') || rawMap.name,
        city: rawMap.city,
        country: rawMap.country,
        region: rawMap.country,
        description: rawMap.description,
      }
    }
  }

  let imageUrl = null
  const raw = article.image_url
  if (raw) {
    const s = typeof raw === 'string' ? raw.trim() : String(raw).trim()
    if (s && s !== 'null' && s !== 'undefined' && s !== 'None' && s.length >= 5) {
      imageUrl = s
    }
  }

  const formatted = {
    id: article.id,
    title: article.title_news,
    title_news: article.title_news || null,
    url: article.url,
    source: article.source || 'Ten News',
    category: article.category,
    emoji: article.emoji || '📰',
    image_url: imageUrl,
    urlToImage: imageUrl,
    image_source: article.image_source || null,
    publishedAt: article.published_at,
    created_at: article.created_at,
    ai_final_score: article.ai_final_score || 0,
    final_score: article.ai_final_score || 0,
    base_score: article.ai_final_score || 0,
    summary_bullets_news: summaryBulletsNews,
    summary_bullets: summaryBulletsNews,
    summary_bullets_detailed: summaryBulletsNews,
    content_news: null,
    detailed_text: '',
    five_ws: fiveWs,
    timeline,
    graph,
    map,
    details,
    components,
    countries,
    topics,
    country_relevance: countryRelevance,
    topic_relevance: topicRelevance,
    interest_tags: interestTags,
    num_sources: article.num_sources,
    cluster_id: article.cluster_id,
    version_number: article.version_number,
    views: article.view_count || 0,
    author_id: article.author_id || null,
    author_name: article.author_name || null,
    expected_read_seconds: expectedReadSecondsForArticle(article),
  }

  if (eventMap[article.id]) formatted.world_event = eventMap[article.id]
  return formatted
}

// Columns selected from published_articles for the iOS-facing feed shape.
// Used by /api/feed/main (via the Trinity retrievers) and /api/feed/following.
export const FEED_ARTICLE_COLUMNS = [
  'id', 'title_news', 'summary_bullets_news', 'category', 'ai_final_score',
  'vq_primary', 'vq_secondary', 'embedding_minilm_vec', 'image_url',
  'image_source', 'source', 'url', 'expected_read_seconds', 'created_at',
  'published_at', 'components_order', 'components', 'details', 'timeline',
  'graph', 'map', 'five_ws', 'countries', 'topics', 'interest_tags',
  'country_relevance', 'topic_relevance', 'cluster_id', 'emoji', 'num_sources',
  'freshness_category', 'shelf_life_days', 'author_id', 'author_name',
].join(', ')
