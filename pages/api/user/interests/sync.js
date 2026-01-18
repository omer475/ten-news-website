import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createAdminClient(url, serviceKey, { auth: { persistSession: false } })
}

// Common countries for detection
const COUNTRIES = new Set([
  'usa', 'united states', 'america', 'china', 'russia', 'germany', 'france', 'uk', 
  'united kingdom', 'britain', 'japan', 'india', 'brazil', 'canada', 'australia',
  'italy', 'spain', 'mexico', 'south korea', 'korea', 'indonesia', 'turkey',
  'saudi arabia', 'netherlands', 'switzerland', 'poland', 'sweden', 'belgium',
  'argentina', 'austria', 'norway', 'israel', 'iran', 'egypt', 'south africa',
  'nigeria', 'pakistan', 'bangladesh', 'vietnam', 'thailand', 'philippines',
  'malaysia', 'singapore', 'taiwan', 'hong kong', 'ukraine', 'greece', 'portugal',
  'ireland', 'denmark', 'finland', 'czech republic', 'romania', 'chile', 'colombia',
  'peru', 'venezuela', 'iraq', 'syria', 'afghanistan', 'north korea', 'cuba',
  'hungary', 'new zealand', 'qatar', 'uae', 'dubai', 'greenland', 'iceland'
])

// Topic categories for detection
const TOPICS = new Set([
  'tech', 'technology', 'ai', 'artificial intelligence', 'politics', 'finance',
  'business', 'economy', 'health', 'science', 'world', 'sports', 'entertainment',
  'climate', 'environment', 'energy', 'military', 'defense', 'security',
  'cryptocurrency', 'crypto', 'blockchain', 'space', 'education', 'law',
  'trade', 'markets', 'stocks', 'banking', 'medicine', 'research'
])

// News categories for primary_category detection
const CATEGORIES = {
  'TECH': ['tech', 'technology', 'ai', 'artificial intelligence', 'software', 'hardware', 'startup', 'silicon valley', 'google', 'apple', 'microsoft', 'meta', 'amazon', 'nvidia', 'openai'],
  'POLITICS': ['politics', 'election', 'congress', 'senate', 'parliament', 'government', 'president', 'minister', 'trump', 'biden', 'democracy', 'vote', 'law', 'legislation'],
  'FINANCE': ['finance', 'stock', 'market', 'bank', 'investment', 'economy', 'gdp', 'inflation', 'interest rate', 'fed', 'cryptocurrency', 'bitcoin'],
  'HEALTH': ['health', 'medical', 'hospital', 'doctor', 'vaccine', 'disease', 'cancer', 'treatment', 'drug', 'fda', 'who', 'pandemic'],
  'SCIENCE': ['science', 'research', 'study', 'discovery', 'nasa', 'space', 'physics', 'biology', 'chemistry', 'climate', 'environment'],
  'WORLD': ['war', 'conflict', 'military', 'attack', 'peace', 'treaty', 'diplomacy', 'un', 'nato', 'refugee', 'crisis'],
  'BUSINESS': ['business', 'company', 'ceo', 'revenue', 'profit', 'merger', 'acquisition', 'ipo', 'earnings']
}

function computeMajorInterests(interests) {
  const KEYWORD_THRESHOLD = 2.0
  const COUNTRY_THRESHOLD = 1.5
  const TOPIC_THRESHOLD = 1.5
  
  const majorKeywords = []
  const majorCountries = []
  const majorTopics = []
  const categoryScores = {}
  
  let totalWeight = 0
  let keywordCount = 0
  
  for (const [keyword, weight] of Object.entries(interests)) {
    keywordCount++
    totalWeight += weight
    
    // Check if it's a major keyword
    if (weight >= KEYWORD_THRESHOLD) {
      majorKeywords.push(keyword)
    }
    
    // Check if it's a country
    if (COUNTRIES.has(keyword.toLowerCase()) && weight >= COUNTRY_THRESHOLD) {
      majorCountries.push(keyword)
    }
    
    // Check if it's a topic
    if (TOPICS.has(keyword.toLowerCase()) && weight >= TOPIC_THRESHOLD) {
      majorTopics.push(keyword)
    }
    
    // Accumulate category scores
    for (const [category, keywords] of Object.entries(CATEGORIES)) {
      if (keywords.some(k => keyword.toLowerCase().includes(k))) {
        categoryScores[category] = (categoryScores[category] || 0) + weight
      }
    }
  }
  
  // Sort by weight (we need to keep the order)
  majorKeywords.sort((a, b) => interests[b] - interests[a])
  majorCountries.sort((a, b) => interests[b] - interests[a])
  majorTopics.sort((a, b) => interests[b] - interests[a])
  
  // Determine primary category
  let primaryCategory = null
  let maxCategoryScore = 0
  for (const [category, score] of Object.entries(categoryScores)) {
    if (score > maxCategoryScore) {
      maxCategoryScore = score
      primaryCategory = category
    }
  }
  
  return {
    major_keywords: majorKeywords,
    major_countries: majorCountries,
    major_topics: majorTopics,
    primary_category: primaryCategory,
    interest_count: keywordCount,
    engagement_score: Math.round(totalWeight * 100) / 100
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const admin = getAdminSupabase()
    if (!admin) {
      return res.status(500).json({ error: 'Server not configured' })
    }

    // Get user from token
    const authHeader = req.headers?.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
    
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const { data: { user }, error: authError } = await admin.auth.getUser(token)
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const { interests } = req.body || {}
    if (!interests || typeof interests !== 'object') {
      return res.status(400).json({ error: 'interests object required' })
    }

    // Clean and normalize the interests object
    const cleanedInterests = {}
    for (const [keyword, weight] of Object.entries(interests)) {
      const cleanKey = keyword.toLowerCase().trim()
      if (cleanKey && typeof weight === 'number') {
        cleanedInterests[cleanKey] = Math.round(Math.min(100, Math.max(0, weight)) * 100) / 100
      }
    }

    if (Object.keys(cleanedInterests).length === 0) {
      return res.status(200).json({ ok: true, keywords: 0 })
    }

    // Compute major interests and stats
    const computed = computeMajorInterests(cleanedInterests)

    // Upsert single row per user
    const { error: upsertError } = await admin
      .from('user_interests')
      .upsert({
        user_id: user.id,
        interests: cleanedInterests,
        major_keywords: computed.major_keywords,
        major_countries: computed.major_countries,
        major_topics: computed.major_topics,
        primary_category: computed.primary_category,
        interest_count: computed.interest_count,
        engagement_score: computed.engagement_score,
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'user_id'
      })

    if (upsertError) {
      console.error('Interests sync error:', upsertError)
      return res.status(500).json({ error: 'Failed to sync interests' })
    }

    return res.status(200).json({ 
      ok: true, 
      keywords: computed.interest_count,
      major_keywords: computed.major_keywords.length,
      major_countries: computed.major_countries.length,
      primary_category: computed.primary_category
    })
  } catch (e) {
    console.error('Interests sync error:', e)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
