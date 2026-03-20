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

// APP_TOPIC_ALIAS: maps iOS app topic IDs to SUBTOPIC_CATEGORY_MAP keys
// Includes both parent category IDs and underscore-format subtopic IDs from onboarding
const APP_TOPIC_ALIAS = {
  // Parent category IDs (broad)
  'politics': ['US Politics', 'European Politics', 'Asian Politics', 'Middle East', 'Latin America', 'Africa & Oceania'],
  'ai': ['AI & Machine Learning'],
  'science': ['Space & Astronomy', 'Climate & Environment', 'Biology & Nature', 'Earth Science'],
  'sports': ['NFL', 'NBA', 'Soccer/Football', 'MLB/Baseball', 'Cricket', 'F1 & Motorsport', 'Boxing & MMA/UFC', 'Olympics & Paralympics'],
  'technology': ['AI & Machine Learning', 'Smartphones & Gadgets', 'Social Media', 'Cybersecurity', 'Space Tech', 'Robotics & Hardware'],
  'tech': ['AI & Machine Learning', 'Smartphones & Gadgets', 'Social Media', 'Cybersecurity', 'Space Tech', 'Robotics & Hardware'],
  'entertainment': ['Movies & Film', 'TV & Streaming', 'Music', 'Gaming', 'Celebrity News', 'K-Pop & K-Drama'],
  'health': ['Medical Breakthroughs', 'Public Health', 'Mental Health', 'Pharma & Drug Industry'],
  'business': ['Oil & Energy', 'Retail & Consumer', 'Corporate Deals', 'Trade & Tariffs', 'Corporate Earnings', 'Real Estate'],
  'finance': ['Stock Markets', 'Banking & Lending', 'Commodities'],
  'crypto': ['Bitcoin', 'DeFi & Web3', 'Crypto Regulation & Legal'],
  'lifestyle': ['Pets & Animals', 'Home & Garden', 'Shopping & Product Reviews'],
  'fashion': ['Sneakers & Streetwear', 'Celebrity Style & Red Carpet'],
  // Subtopic IDs (specific) — short form
  'gaming': ['Gaming'],
  'soccer': ['Soccer/Football'],
  'nfl': ['NFL'],
  'nba': ['NBA'],
  'baseball': ['MLB/Baseball'],
  'cricket': ['Cricket'],
  'boxing': ['Boxing & MMA/UFC'],
  'olympics': ['Olympics & Paralympics'],
  'movies': ['Movies & Film'],
  'music': ['Music'],
  'kpop': ['K-Pop & K-Drama'],
  'space': ['Space & Astronomy', 'Space Tech'],
  'climate': ['Climate & Environment'],
  'automotive': ['Automotive'],
  'cybersecurity': ['Cybersecurity'],
  'realestate': ['Real Estate'],
  'bitcoin': ['Bitcoin'],
  'startups': ['Startups & Venture Capital'],
  // Subtopic IDs (specific) — underscore format from onboarding
  'war_conflict': ['War & Conflict'],
  'us_politics': ['US Politics'],
  'european_politics': ['European Politics'],
  'asian_politics': ['Asian Politics'],
  'middle_east': ['Middle East'],
  'latin_america': ['Latin America'],
  'africa_oceania': ['Africa & Oceania'],
  'human_rights': ['Human Rights & Civil Liberties'],
  'f1': ['F1 & Motorsport'],
  'f1_motorsport': ['F1 & Motorsport'],
  'boxing_mma': ['Boxing & MMA/UFC'],
  'oil_energy': ['Oil & Energy'],
  'retail_consumer': ['Retail & Consumer'],
  'corporate_deals': ['Corporate Deals'],
  'trade_tariffs': ['Trade & Tariffs'],
  'corporate_earnings': ['Corporate Earnings'],
  'startups_vc': ['Startups & Venture Capital'],
  'real_estate': ['Real Estate'],
  'movies_film': ['Movies & Film'],
  'tv_streaming': ['TV & Streaming'],
  'celebrity_news': ['Celebrity News'],
  'kpop_kdrama': ['K-Pop & K-Drama'],
  'ai_ml': ['AI & Machine Learning'],
  'smartphones_gadgets': ['Smartphones & Gadgets'],
  'social_media': ['Social Media'],
  'space_tech': ['Space Tech'],
  'robotics_hardware': ['Robotics & Hardware'],
  'space_astronomy': ['Space & Astronomy'],
  'climate_environment': ['Climate & Environment'],
  'biology_nature': ['Biology & Nature'],
  'earth_science': ['Earth Science'],
  'medical_breakthroughs': ['Medical Breakthroughs'],
  'public_health': ['Public Health'],
  'mental_health': ['Mental Health'],
  'pharma_drugs': ['Pharma & Drug Industry'],
  'stock_markets': ['Stock Markets'],
  'banking_lending': ['Banking & Lending'],
  'commodities': ['Commodities'],
  'defi_web3': ['DeFi & Web3'],
  'crypto_regulation': ['Crypto Regulation & Legal'],
  'pets_animals': ['Pets & Animals'],
  'home_garden': ['Home & Garden'],
  'shopping_reviews': ['Shopping & Product Reviews'],
  'sneakers_streetwear': ['Sneakers & Streetwear'],
  'celebrity_style': ['Celebrity Style & Red Carpet'],
}

// Sliding blend: behavior_weight = min(directMatches / BLEND_FULL_AT, MAX_BEHAVIOR_WEIGHT)
// At 25 matches: 50/50 blend. At 50+: 85% behavior, 15% cold_start.
// Cold_start never fully disappears — onboarding always has residual influence.
const BLEND_FULL_AT = 50    // interactions needed to reach max behavior weight
const MAX_BEHAVIOR_WEIGHT = 0.85  // cold_start always keeps 15% influence
const BLEND_START_AT = 5    // minimum matches before any behavior influence

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

  const { user_id, followed_topics: qFollowed, home_country: qHome } = req.query
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

    // Fall back to query params when DB profile is missing (guest users)
    const dbFollowed = Array.isArray(profile?.followed_topics)
      ? profile.followed_topics
      : (typeof profile?.followed_topics === 'string'
        ? JSON.parse(profile.followed_topics || '[]')
        : [])
    const followedTopics = dbFollowed.length > 0
      ? dbFollowed
      : (qFollowed ? qFollowed.split(',').map(t => t.trim()).filter(Boolean) : [])
    const homeCountry = profile?.home_country || qHome || null

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

    // ──────────────────────────────────────────────
    // 3. BUILD PERSONALIZED TOPICS — SLIDING BLEND
    //    behavior_weight slides from 0% to 85% as user accumulates
    //    entity matches. Cold_start always keeps ≥15% influence.
    // ──────────────────────────────────────────────

    const matchCount = directMatches.length
    const behaviorWeight = matchCount < BLEND_START_AT
      ? 0
      : Math.min((matchCount - BLEND_START_AT) / (BLEND_FULL_AT - BLEND_START_AT), 1.0) * MAX_BEHAVIOR_WEIGHT
    const coldStartWeight = 1.0 - behaviorWeight

    const TARGET_TOPICS = 20
    const behaviorSlots = Math.round(TARGET_TOPICS * behaviorWeight)
    const coldStartSlots = TARGET_TOPICS - behaviorSlots

    const userTopics = []
    const usedEntityNames = new Set()

    // ═══════════════════════════════════════════
    // BEHAVIOR PORTION — entities from tag_profile
    // ═══════════════════════════════════════════

    if (behaviorSlots > 0 && directMatches.length > 0) {
      const entityMap = {}
      for (const e of directMatches) {
        entityMap[e.entity_name] = { display_title: e.display_title, category: e.category }
      }

      for (const [tag, weight] of sortedTags) {
        if (userTopics.length >= behaviorSlots) break
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
    }

    // ═══════════════════════════════════════════
    // COLD START PORTION — onboarding + country + category
    // Always runs (even for mature users at 15% minimum)
    // ═══════════════════════════════════════════

    if (coldStartSlots > 0) {
      const interestCategories = new Set()
      for (const topic of followedTopics) {
        // Resolve topic: exact match → app alias → skip
        const resolvedSubtopics = SUBTOPIC_CATEGORY_MAP[topic]
          ? [topic]
          : (APP_TOPIC_ALIAS[topic.toLowerCase()] || [])
        for (const resolved of resolvedSubtopics) {
          const cats = SUBTOPIC_CATEGORY_MAP[resolved]
          if (cats) cats.forEach(c => interestCategories.add(c))
        }
      }

      if (interestCategories.size > 0) {
        const { data: catEntities } = await supabase
          .from('concept_entities')
          .select('entity_name, display_title, category, popularity_score')
          .in('category', [...interestCategories])
          .order('popularity_score', { ascending: false })
          .limit(200)

        if (catEntities && catEntities.length > 0) {
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

          const sorted = catEntities.sort((a, b) => {
            const aCountry = countryEntityNames.has(a.entity_name.toLowerCase()) ? 1 : 0
            const bCountry = countryEntityNames.has(b.entity_name.toLowerCase()) ? 1 : 0
            if (aCountry !== bCountry) return bCountry - aCountry
            return (b.popularity_score || 0) - (a.popularity_score || 0)
          })

          const catCounts = {}
          for (const t of userTopics) {
            catCounts[t.category] = (catCounts[t.category] || 0) + 1
          }

          for (const e of sorted) {
            if (userTopics.length >= TARGET_TOPICS) break
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
    // 4. TRENDING — computed from real article volume in last 48h
    //    An entity with 15 articles this week is objectively more
    //    trending than one with 2. Max 1 per category for diversity.
    // ──────────────────────────────────────────────

    // Step 1: Count articles per entity tag in last 48h
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const { data: recentArticles } = await supabase
      .from('published_articles')
      .select('interest_tags')
      .gte('published_at', fortyEightHoursAgo)
      .lte('published_at', new Date().toISOString())
      .not('interest_tags', 'is', null)

    const entityArticleCount = {}
    if (recentArticles) {
      for (const article of recentArticles) {
        const tags = Array.isArray(article.interest_tags)
          ? article.interest_tags.slice(0, 6).map(t => t.toLowerCase())
          : []
        for (const tag of tags) {
          entityArticleCount[tag] = (entityArticleCount[tag] || 0) + 1
        }
      }
    }

    // Step 2: Load all entities, rank by real article volume
    const { data: allEntities } = await supabase
      .from('concept_entities')
      .select('entity_name, display_title, category')

    const trendingTopics = []
    const trendingCatCounts = {}

    if (allEntities) {
      // Score each entity by how many recent articles mention it
      const scored = allEntities
        .map(e => ({
          ...e,
          articleCount: entityArticleCount[e.entity_name] || 0
        }))
        .filter(e => e.articleCount > 0) // only entities with actual recent coverage
        .sort((a, b) => b.articleCount - a.articleCount)

      for (const e of scored) {
        if (usedEntityNames.has(e.entity_name)) continue
        if (skipProfile[e.entity_name] && skipProfile[e.entity_name] > 0.3) continue

        const cat = e.category || 'Other'
        if ((trendingCatCounts[cat] || 0) >= 1) continue // max 1 per category

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

    // Build search terms per topic: entity_name + aliases ONLY.
    // NO title word splitting — "Manchester United" split into ["manchester","united"]
    // would match United Airlines, United Nations, etc.
    // NO substring matching — "art" inside "artificial intelligence" is not a match.
    const topicSearchTerms = {}
    for (const topic of allTopics) {
      const terms = new Set()
      terms.add(topic.entity_name.toLowerCase())
      if (aliasMap[topic.entity_name]) {
        aliasMap[topic.entity_name].forEach(a => terms.add(a))
      }
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
        .lte('published_at', new Date().toISOString())
        .not('interest_tags', 'is', null)
        .order('published_at', { ascending: false })
        .limit(1500)

      if (articles) {
        for (const article of articles) {
          const rawTags = Array.isArray(article.interest_tags)
            ? article.interest_tags.map(t => t.toLowerCase())
            : []

          // Only use the first 6 primary tags — tail tags are noise
          // (related entities mentioned in passing, not what the article is about)
          const tags = rawTags.slice(0, 6)
          // Also build a title set for high-confidence matching
          const titleLower = (article.title_news || '').toLowerCase()

          for (const topicName of allTopicNames) {
            if (!topicArticles[topicName]) topicArticles[topicName] = []
            if (topicArticles[topicName].length >= 50) continue

            const searchTerms = topicSearchTerms[topicName]
            // Two-tier matching:
            // 1. Entity name/alias in article title = always match (high salience)
            // 2. Entity name/alias in first 6 tags = match (primary topic)
            let matched = false
            for (const term of searchTerms) {
              if (titleLower.includes(term)) { matched = true; break }
            }
            if (!matched) {
              matched = tags.some(tag => searchTerms.has(tag))
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
      mode: behaviorWeight > 0.5 ? 'behavior' : behaviorWeight > 0 ? 'blended' : 'cold_start',
      behavior_weight: Math.round(behaviorWeight * 100),
      entity_matches: matchCount
    })

  } catch (e) {
    console.error('Explore topics error:', e)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
