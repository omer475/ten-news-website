import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * GET /api/explore/topics?user_id=<uuid>
 *
 * Returns personalized Explore page topics with beautiful display titles.
 * Each topic card has: display_title, category, emoji, and 3 sample articles.
 *
 * Logic:
 * 1. Pull top entities from user's tag_profile (highest weight first)
 * 2. Look up display_title from concept_entities table
 * 3. Fetch 3 recent articles per entity (matching interest_tags)
 * 4. Also include trending/popular entities the user hasn't seen
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { user_id } = req.query

  if (!user_id) {
    return res.status(400).json({ error: 'Missing user_id' })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // 1. Load user's tag_profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('tag_profile, skip_profile')
      .eq('id', user_id)
      .single()

    const tagProfile = profile?.tag_profile || {}
    const skipProfile = profile?.skip_profile || {}

    // Sort tags by weight (highest first), filter out low-weight ones
    const sortedTags = Object.entries(tagProfile)
      .filter(([_, weight]) => weight >= 0.05)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30) // top 30 interests

    // Get entity names to look up
    const entityNames = sortedTags.map(([tag]) => tag)

    // 2. Look up display_titles from concept_entities
    let entityMap = {} // entity_name -> { display_title, category }
    if (entityNames.length > 0) {
      const { data: entities } = await supabase
        .from('concept_entities')
        .select('entity_name, display_title, category')
        .in('entity_name', entityNames)

      if (entities) {
        for (const e of entities) {
          entityMap[e.entity_name] = {
            display_title: e.display_title,
            category: e.category
          }
        }
      }
    }

    // 3. Build topic cards for user's interests (that have concept_entities matches)
    const userTopics = []
    const usedEntityNames = new Set()

    for (const [tag, weight] of sortedTags) {
      if (!entityMap[tag]) continue // skip tags without concept_entity match
      if (usedEntityNames.has(tag)) continue

      usedEntityNames.add(tag)
      userTopics.push({
        entity_name: tag,
        display_title: entityMap[tag].display_title,
        category: entityMap[tag].category,
        weight,
        type: 'personalized'
      })

      if (userTopics.length >= 15) break // cap at 15 personalized topics
    }

    // 4. Add trending/popular entities the user hasn't engaged with
    const { data: trendingEntities } = await supabase
      .from('concept_entities')
      .select('entity_name, display_title, category, popularity_score')
      .order('popularity_score', { ascending: false })
      .limit(50)

    const trendingTopics = []
    if (trendingEntities) {
      for (const e of trendingEntities) {
        if (usedEntityNames.has(e.entity_name)) continue
        if (skipProfile[e.entity_name] && skipProfile[e.entity_name] > 0.3) continue

        trendingTopics.push({
          entity_name: e.entity_name,
          display_title: e.display_title,
          category: e.category,
          weight: 0,
          type: 'trending'
        })

        if (trendingTopics.length >= 10) break
      }
    }

    // 5. Fetch 3 sample articles per topic (batch query)
    const allTopicNames = [...userTopics, ...trendingTopics].map(t => t.entity_name)
    const topicArticles = {} // entity_name -> [articles]

    if (allTopicNames.length > 0) {
      // Get recent articles that have any of these entity names in interest_tags
      const { data: articles } = await supabase
        .from('published_articles')
        .select('id, title_news, image_url, category, interest_tags, published_at, ai_final_score')
        .order('published_at', { ascending: false })
        .limit(1000)

      if (articles) {
        // Match articles to topics
        for (const article of articles) {
          const tags = Array.isArray(article.interest_tags)
            ? article.interest_tags.map(t => t.toLowerCase())
            : []

          for (const topicName of allTopicNames) {
            if (!tags.includes(topicName.toLowerCase())) continue
            if (!topicArticles[topicName]) topicArticles[topicName] = []
            if (topicArticles[topicName].length >= 50) continue

            topicArticles[topicName].push({
              id: article.id,
              title: article.title_news,
              image_url: article.image_url,
              category: article.category,
              published_at: article.published_at
            })
          }
        }
      }
    }

    // 6. Build final response — only include topics with at least 1 article
    const CATEGORY_EMOJIS = {
      'Soccer': '⚽', 'Basketball': '🏀', 'Football': '🏈', 'Baseball': '⚾',
      'Cricket': '🏏', 'Motorsport': '🏎️', 'Combat Sports': '🥊', 'Tennis': '🎾',
      'Golf': '⛳', 'Sports Events': '🏅',
      'AI & Tech': '🤖', 'Finance': '💰', 'Business': '💼',
      'US Politics': '🇺🇸', 'World Politics': '🌍',
      'Entertainment': '🎬', 'K-Pop & Music': '🎵',
      'Science': '🔬', 'Health': '🏥', 'Food': '🍽️',
      'Lifestyle': '✨', 'Automotive': '🚗',
      'Gaming': '🎮', 'Fashion': '👟', 'Skincare': '✨',
      'Beauty': '💄', 'Travel': '✈️'
    }

    const topics = [...userTopics, ...trendingTopics]
      .filter(t => topicArticles[t.entity_name] && topicArticles[t.entity_name].length > 0)
      .map(t => ({
        entity_name: t.entity_name,
        display_title: t.display_title,
        category: t.category,
        emoji: CATEGORY_EMOJIS[t.category] || '📰',
        type: t.type,
        weight: t.weight,
        articles: topicArticles[t.entity_name] || []
      }))

    return res.status(200).json({
      topics,
      personalized_count: topics.filter(t => t.type === 'personalized').length,
      trending_count: topics.filter(t => t.type === 'trending').length,
      total: topics.length
    })

  } catch (e) {
    console.error('Explore topics error:', e)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
