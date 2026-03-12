import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// ============================================================
// SUBTOPIC → CONCEPT_ENTITY CATEGORY MAPPING
// Only used for cold-start users. Once tag_profile is rich
// enough (>= MATURITY_THRESHOLD direct entity matches),
// we stop using this and trust pure behavior signals.
// ============================================================

const SUBTOPIC_CATEGORY_MAP = {
  'Soccer/Football': ['Soccer'],
  'NFL': ['Football'],
  'NBA': ['Basketball'],
  'MLB/Baseball': ['Baseball'],
  'Cricket': ['Cricket'],
  'F1 & Motorsport': ['Motorsport'],
  'Boxing & MMA/UFC': ['Combat Sports'],
  'Olympics & Paralympics': ['Sports Events'],
  'War & Conflict': ['World Politics'],
  'US Politics': ['US Politics'],
  'European Politics': ['World Politics'],
  'Asian Politics': ['World Politics'],
  'Middle East': ['World Politics'],
  'Latin America': ['World Politics'],
  'Africa & Oceania': ['World Politics'],
  'Human Rights & Civil Liberties': ['World Politics'],
  'Oil & Energy': ['Finance', 'Business'],
  'Automotive': ['Automotive'],
  'Retail & Consumer': ['Business'],
  'Corporate Deals': ['Business'],
  'Trade & Tariffs': ['Business', 'World Politics'],
  'Corporate Earnings': ['Business', 'Finance'],
  'Startups & Venture Capital': ['Business', 'Finance'],
  'Real Estate': ['Business', 'Finance'],
  'Movies & Film': ['Entertainment'],
  'TV & Streaming': ['Entertainment'],
  'Music': ['K-Pop & Music', 'Entertainment'],
  'Gaming': ['Gaming'],
  'Celebrity News': ['Entertainment', 'Lifestyle'],
  'K-Pop & K-Drama': ['K-Pop & Music', 'Entertainment'],
  'AI & Machine Learning': ['AI & Tech'],
  'Smartphones & Gadgets': ['AI & Tech'],
  'Social Media': ['AI & Tech'],
  'Cybersecurity': ['AI & Tech'],
  'Space Tech': ['AI & Tech', 'Science'],
  'Robotics & Hardware': ['AI & Tech'],
  'Space & Astronomy': ['Science'],
  'Climate & Environment': ['Science'],
  'Biology & Nature': ['Science'],
  'Earth Science': ['Science'],
  'Medical Breakthroughs': ['Health'],
  'Public Health': ['Health'],
  'Mental Health': ['Health'],
  'Pharma & Drug Industry': ['Health', 'Business'],
  'Stock Markets': ['Finance'],
  'Banking & Lending': ['Finance'],
  'Commodities': ['Finance'],
  'Bitcoin': ['Finance', 'AI & Tech'],
  'DeFi & Web3': ['Finance', 'AI & Tech'],
  'Crypto Regulation & Legal': ['Finance'],
  'Pets & Animals': ['Lifestyle'],
  'Home & Garden': ['Lifestyle'],
  'Shopping & Product Reviews': ['Lifestyle'],
  'Sneakers & Streetwear': ['Fashion', 'Lifestyle'],
  'Celebrity Style & Red Carpet': ['Fashion', 'Entertainment'],
}

// When user has >= this many direct tag→entity matches,
// we consider them "mature" and ONLY use their tag_profile.
// No more category/country fallbacks. Like TikTok/Pinterest after ~50 interactions.
const MATURITY_THRESHOLD = 8

const CATEGORY_EMOJIS = {
  'Soccer': '⚽', 'Basketball': '🏀', 'Football': '🏈', 'Baseball': '⚾',
  'Cricket': '🏏', 'Motorsport': '🏎️', 'Combat Sports': '🥊', 'Tennis': '🎾',
  'Golf': '⛳', 'Sports Events': '🏅',
  'AI & Tech': '🤖', 'Finance': '💰', 'Business': '💼', 'Crypto': '🪙',
  'US Politics': '🇺🇸', 'World Politics': '🌍',
  'Entertainment': '🎬', 'K-Pop & Music': '🎵',
  'Science': '🔬', 'Health': '🏥', 'Food': '🍽️',
  'Lifestyle': '✨', 'Automotive': '🚗',
  'Gaming': '🎮', 'Fashion': '👟', 'Skincare': '✨',
  'Beauty': '💄', 'Travel': '✈️'
}

/**
 * GET /api/explore/topics?user_id=<uuid>
 *
 * Pinterest-style progressive personalization:
 *
 * MODE 1 — COLD START (new user, few tag matches):
 *   Use onboarding topics + country → find entities by category
 *   Turkish soccer fan → Galatasaray, Fenerbahce, Super Lig
 *
 * MODE 2 — MATURE USER (tag_profile has >= 8 entity matches):
 *   ONLY use tag_profile. No category limits, no country bias.
 *   If they have 12 soccer entities in their profile, show all 12.
 *   Pure behavior-driven, like TikTok after learning your taste.
 *
 * Trending: Always max 2 per category for diversity.
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
    // ──────────────────────────────────────────────
    // 1. LOAD USER PROFILE
    // ──────────────────────────────────────────────

    const { data: profile } = await supabase
      .from('profiles')
      .select('tag_profile, skip_profile, followed_topics, home_country')
      .eq('id', user_id)
      .single()

    const tagProfile = profile?.tag_profile || {}
    const skipProfile = profile?.skip_profile || {}
    const homeCountry = profile?.home_country || null
    const followedTopics = Array.isArray(profile?.followed_topics)
      ? profile.followed_topics
      : (typeof profile?.followed_topics === 'string'
        ? JSON.parse(profile.followed_topics || '[]')
        : [])

    // Sort tags by weight, filter noise
    const sortedTags = Object.entries(tagProfile)
      .filter(([_, weight]) => weight >= 0.05)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)

    const entityNames = sortedTags.map(([tag]) => tag)

    // ──────────────────────────────────────────────
    // 2. CHECK HOW MANY TAG_PROFILE ENTRIES MATCH CONCEPT_ENTITIES
    //    This determines cold-start vs mature mode.
    // ──────────────────────────────────────────────

    let directMatches = [] // concept_entities that match tag_profile keys
    if (entityNames.length > 0) {
      const { data: entities } = await supabase
        .from('concept_entities')
        .select('entity_name, display_title, category')
        .in('entity_name', entityNames)

      directMatches = entities || []
    }

    const isMatureUser = directMatches.length >= MATURITY_THRESHOLD

    // ──────────────────────────────────────────────
    // 3. BUILD PERSONALIZED TOPICS
    // ──────────────────────────────────────────────

    const userTopics = []
    const usedEntityNames = new Set()

    if (isMatureUser) {
      // ═══════════════════════════════════════════
      // MODE 2: MATURE USER — pure tag_profile
      // No category caps. No country bias. Just behavior.
      // If user has 12 soccer entities, show all 12.
      // ═══════════════════════════════════════════

      // Build lookup map
      const entityMap = {}
      for (const e of directMatches) {
        entityMap[e.entity_name] = { display_title: e.display_title, category: e.category }
      }

      for (const [tag, weight] of sortedTags) {
        if (!entityMap[tag]) continue
        if (usedEntityNames.has(tag)) continue

        usedEntityNames.add(tag)
        userTopics.push({
          entity_name: tag,
          display_title: entityMap[tag].display_title,
          category: entityMap[tag].category,
          weight,
          type: 'personalized'
        })

        if (userTopics.length >= 20) break // higher cap for mature users
      }

    } else {
      // ═══════════════════════════════════════════
      // MODE 1: COLD START — onboarding + country + category
      // Turkish soccer fan → show Turkish football entities first
      // ═══════════════════════════════════════════

      // First: add any direct tag matches we DO have
      const entityMap = {}
      for (const e of directMatches) {
        entityMap[e.entity_name] = { display_title: e.display_title, category: e.category }
      }

      for (const [tag, weight] of sortedTags) {
        if (!entityMap[tag]) continue
        if (usedEntityNames.has(tag)) continue

        usedEntityNames.add(tag)
        userTopics.push({
          entity_name: tag,
          display_title: entityMap[tag].display_title,
          category: entityMap[tag].category,
          weight,
          type: 'personalized'
        })
      }

      // Then: fill gaps using category-based lookup from onboarding topics
      const interestCategories = new Set()
      for (const topic of followedTopics) {
        const cats = SUBTOPIC_CATEGORY_MAP[topic]
        if (cats) cats.forEach(c => interestCategories.add(c))
      }

      if (interestCategories.size > 0 && userTopics.length < 15) {
        // Fetch entities from the user's interest categories
        const { data: catEntities } = await supabase
          .from('concept_entities')
          .select('entity_name, display_title, category, popularity_score')
          .in('category', [...interestCategories])
          .order('popularity_score', { ascending: false })
          .limit(200)

        if (catEntities && catEntities.length > 0) {
          // If we know the user's country, prioritize country-relevant entities
          // by checking entity_seeds for country-specific tags
          let countryEntityNames = new Set()
          if (homeCountry) {
            const { data: countrySeeds } = await supabase
              .from('entity_seeds')
              .select('entity_tag')
              .eq('country_code', homeCountry.toUpperCase())

            if (countrySeeds) {
              countryEntityNames = new Set(countrySeeds.map(s => s.entity_tag.toLowerCase()))
            }
          }

          // Sort: country-relevant first, then by popularity
          const sorted = catEntities.sort((a, b) => {
            const aCountry = countryEntityNames.has(a.entity_name.toLowerCase()) ? 1 : 0
            const bCountry = countryEntityNames.has(b.entity_name.toLowerCase()) ? 1 : 0
            if (aCountry !== bCountry) return bCountry - aCountry
            return (b.popularity_score || 0) - (a.popularity_score || 0)
          })

          // Track per-category count to ensure diversity (max 4 per category for cold-start)
          const catCounts = {}
          for (const t of userTopics) {
            catCounts[t.category] = (catCounts[t.category] || 0) + 1
          }

          for (const e of sorted) {
            if (userTopics.length >= 15) break
            if (usedEntityNames.has(e.entity_name)) continue
            if (skipProfile[e.entity_name] && skipProfile[e.entity_name] > 0.3) continue
            if ((catCounts[e.category] || 0) >= 4) continue

            usedEntityNames.add(e.entity_name)
            catCounts[e.category] = (catCounts[e.category] || 0) + 1

            userTopics.push({
              entity_name: e.entity_name,
              display_title: e.display_title,
              category: e.category,
              weight: 0.1,
              type: 'personalized'
            })
          }
        }
      }
    }

    // ──────────────────────────────────────────────
    // 4. TRENDING — always diverse (max 2 per category)
    // ──────────────────────────────────────────────

    const { data: trendingEntities } = await supabase
      .from('concept_entities')
      .select('entity_name, display_title, category, popularity_score')
      .order('popularity_score', { ascending: false })
      .limit(100)

    const trendingTopics = []
    const trendingCatCounts = {}

    if (trendingEntities) {
      for (const e of trendingEntities) {
        if (usedEntityNames.has(e.entity_name)) continue
        if (skipProfile[e.entity_name] && skipProfile[e.entity_name] > 0.3) continue

        const cat = e.category || 'Other'
        if ((trendingCatCounts[cat] || 0) >= 2) continue

        trendingCatCounts[cat] = (trendingCatCounts[cat] || 0) + 1
        usedEntityNames.add(e.entity_name)

        trendingTopics.push({
          entity_name: e.entity_name,
          display_title: e.display_title,
          category: cat,
          weight: 0,
          type: 'trending'
        })

        if (trendingTopics.length >= 10) break
      }
    }

    // ──────────────────────────────────────────────
    // 5. FETCH ARTICLES PER TOPIC
    // ──────────────────────────────────────────────

    const allTopics = [...userTopics, ...trendingTopics]
    const allTopicNames = allTopics.map(t => t.entity_name)

    // Load aliases for better article matching
    let aliasMap = {}
    if (allTopicNames.length > 0) {
      const { data: aliasData } = await supabase
        .from('concept_entities')
        .select('entity_name, aliases')
        .in('entity_name', allTopicNames)

      if (aliasData) {
        for (const row of aliasData) {
          if (row.aliases && row.aliases.length > 0) {
            aliasMap[row.entity_name] = row.aliases.map(a => a.toLowerCase())
          }
        }
      }
    }

    // Build search terms per topic (entity_name + aliases + title words)
    const topicSearchTerms = {}
    for (const topic of allTopics) {
      const terms = new Set()
      terms.add(topic.entity_name.toLowerCase())
      if (aliasMap[topic.entity_name]) {
        aliasMap[topic.entity_name].forEach(a => terms.add(a))
      }
      const titleWords = topic.display_title.toLowerCase().split(/[&,\s]+/).filter(w => w.length > 2)
      titleWords.forEach(w => terms.add(w))
      topicSearchTerms[topic.entity_name] = terms
    }

    // Fetch recent articles and match to topics
    // Only articles from last 7 days — older articles lack interest_tags
    const topicArticles = {}
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    if (allTopicNames.length > 0) {
      const { data: articles } = await supabase
        .from('published_articles')
        .select('id, title_news, image_url, category, interest_tags, published_at, ai_final_score')
        .gte('published_at', sevenDaysAgo)
        .not('interest_tags', 'is', null)
        .order('published_at', { ascending: false })
        .limit(1500)

      if (articles) {
        for (const article of articles) {
          const tags = Array.isArray(article.interest_tags)
            ? article.interest_tags.map(t => t.toLowerCase())
            : []

          for (const topicName of allTopicNames) {
            if (!topicArticles[topicName]) topicArticles[topicName] = []
            if (topicArticles[topicName].length >= 50) continue

            const searchTerms = topicSearchTerms[topicName]
            let matched = false
            for (const tag of tags) {
              if (searchTerms.has(tag)) { matched = true; break }
              // Partial match for compound entities (e.g. "manchester united" in tag "manchester united fc")
              if (tag.length >= 3 && (tag.includes(topicName.toLowerCase()) || topicName.toLowerCase().includes(tag))) {
                matched = true; break
              }
            }

            if (matched) {
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
    }

    // ──────────────────────────────────────────────
    // 6. RESPONSE — only topics with articles
    // ──────────────────────────────────────────────

    const topics = allTopics
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
      total: topics.length,
      mode: isMatureUser ? 'behavior' : 'cold_start'
    })

  } catch (e) {
    console.error('Explore topics error:', e)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
