// Topic feed: when the user taps a bold entity in a bullet, this
// endpoint returns articles tagged with that entity. Same article
// shape as /api/feed/main so the iOS card renderer is unchanged.
//
// Filter strategy: an entity match means the lower-cased entity
// string appears in the article's `interest_tags` (canonical concept
// entities tagged at publish time) OR `topics` (broader topic
// strings). We OR the two array-contains filters via the `or` clause
// so we catch curated-entity matches AND looser topic-string matches
// without making the client guess which list the entity lives on.
//
// Sort: `ai_final_score` desc, then `created_at` desc — same ordering
// as Today feed. We're not personalizing this list (the entity tap
// is itself the user's strongest signal of intent).

import { createClient } from '@supabase/supabase-js';
import { expectedReadSecondsForArticle } from '../../../lib/readingTime.js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const safeJsonParse = (value, fallback = null) => {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
};

function formatArticle(article) {
  const summaryBulletsNews = safeJsonParse(article.summary_bullets_news, []);
  const fiveWs = safeJsonParse(article.five_ws, null);
  const timeline = safeJsonParse(article.timeline, null);
  const graph = safeJsonParse(article.graph, null);
  const details = safeJsonParse(article.details, []);
  const components = article.components_order || safeJsonParse(article.components, null);
  const countries = safeJsonParse(article.countries, []);
  const topics = safeJsonParse(article.topics, []);
  const interestTags = safeJsonParse(article.interest_tags, []);

  let imageUrl = null;
  const raw = article.image_url;
  if (raw) {
    const s = typeof raw === 'string' ? raw.trim() : String(raw).trim();
    if (s && s !== 'null' && s !== 'undefined' && s !== 'None' && s.length >= 5) {
      imageUrl = s;
    }
  }

  return {
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
    five_ws: fiveWs,
    timeline,
    graph,
    details,
    components,
    countries,
    topics,
    interest_tags: interestTags,
    num_sources: article.num_sources,
    cluster_id: article.cluster_id,
    author_id: article.author_id || null,
    author_name: article.author_name || null,
    expected_read_seconds: expectedReadSecondsForArticle(article),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawEntity = (req.query.entity || '').toString().trim();
  if (!rawEntity) {
    return res.status(400).json({ error: 'entity query param required' });
  }
  // Entity tags are stored lower-cased in `interest_tags` and `topics`.
  const entity = rawEntity.toLowerCase();

  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const limit = Math.min(40, Math.max(1, parseInt(req.query.limit, 10) || 20));

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Postgres `cs` (contains) on a text array — quoted single-element
    // array literal. We OR across `interest_tags` and `topics`.
    const arrLit = `{${JSON.stringify(entity)}}`;
    const { data: articles, error } = await supabase
      .from('published_articles')
      .select(
        'id, title_news, url, source, category, emoji, ai_final_score, ' +
        'countries, topics, interest_tags, image_url, image_source, ' +
        'published_at, created_at, summary_bullets_news, five_ws, ' +
        'timeline, graph, details, map, components_order, num_sources, ' +
        'author_id, author_name, expected_read_seconds, shelf_life_days, ' +
        'freshness_category, word_count, char_count'
      )
      .or(`interest_tags.cs.${arrLit},topics.cs.${arrLit}`)
      .order('ai_final_score', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[feed:topic] supabase error:', error);
      return res.status(500).json({ error: 'Failed to fetch articles', detail: error.message });
    }

    const formatted = (articles || []).map(formatArticle);

    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=60');
    return res.status(200).json({
      entity: rawEntity,
      offset,
      limit,
      count: formatted.length,
      articles: formatted,
    });
  } catch (err) {
    console.error('[feed:topic] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
