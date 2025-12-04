import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase not configured')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get hours parameter (default 24, max 24)
    const hours = Math.min(24, Math.max(1, parseInt(req.query.hours) || 24))
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

    // Fetch ALL articles within time window (just title and description for country extraction)
    const { data: articles, error } = await supabase
      .from('published_articles')
      .select('title, title_news, description, category, created_at')
      .gte('created_at', cutoffTime)

    if (error) {
      console.error('Supabase error:', error)
      throw error
    }

    // Country keywords for extraction
    const countryKeywords = {
      'united states': ['us', 'usa', 'america', 'american', 'biden', 'trump', 'washington', 'congress', 'pentagon', 'white house'],
      'united kingdom': ['uk', 'britain', 'british', 'england', 'london', 'parliament', 'downing'],
      'china': ['chinese', 'beijing', 'xi jinping', 'shanghai'],
      'russia': ['russian', 'moscow', 'putin', 'kremlin'],
      'ukraine': ['ukrainian', 'kyiv', 'kiev', 'zelensky'],
      'israel': ['israeli', 'tel aviv', 'jerusalem', 'netanyahu', 'idf'],
      'palestine': ['palestinian', 'gaza', 'west bank', 'hamas'],
      'iran': ['iranian', 'tehran'],
      'india': ['indian', 'delhi', 'mumbai', 'modi'],
      'japan': ['japanese', 'tokyo'],
      'germany': ['german', 'berlin', 'scholz'],
      'france': ['french', 'paris', 'macron'],
      'canada': ['canadian', 'ottawa', 'trudeau'],
      'australia': ['australian', 'sydney', 'canberra'],
      'brazil': ['brazilian', 'brasilia', 'lula'],
      'mexico': ['mexican', 'mexico city'],
      'south korea': ['korean', 'seoul', 'korea'],
      'north korea': ['pyongyang', 'kim jong'],
      'turkey': ['turkish', 'ankara', 'erdogan'],
      'saudi arabia': ['saudi', 'riyadh'],
      'egypt': ['egyptian', 'cairo'],
      'south africa': ['johannesburg', 'pretoria'],
      'nigeria': ['nigerian', 'lagos', 'abuja'],
      'indonesia': ['indonesian', 'jakarta'],
      'pakistan': ['pakistani', 'islamabad', 'karachi'],
      'argentina': ['argentine', 'buenos aires', 'milei'],
      'italy': ['italian', 'rome', 'milan'],
      'spain': ['spanish', 'madrid', 'barcelona'],
      'poland': ['polish', 'warsaw'],
      'netherlands': ['dutch', 'amsterdam', 'hague'],
      'belgium': ['belgian', 'brussels'],
      'sweden': ['swedish', 'stockholm'],
      'norway': ['norwegian', 'oslo'],
      'denmark': ['danish', 'copenhagen'],
      'finland': ['finnish', 'helsinki'],
      'switzerland': ['swiss', 'zurich', 'geneva'],
      'austria': ['austrian', 'vienna'],
      'greece': ['greek', 'athens'],
      'portugal': ['portuguese', 'lisbon'],
      'ireland': ['irish', 'dublin'],
      'syria': ['syrian', 'damascus', 'assad'],
      'iraq': ['iraqi', 'baghdad'],
      'afghanistan': ['afghan', 'kabul', 'taliban'],
      'vietnam': ['vietnamese', 'hanoi'],
      'thailand': ['thai', 'bangkok'],
      'malaysia': ['malaysian', 'kuala lumpur'],
      'singapore': ['singaporean'],
      'philippines': ['filipino', 'manila'],
      'new zealand': ['kiwi', 'wellington', 'auckland'],
      'chile': ['chilean', 'santiago'],
      'colombia': ['colombian', 'bogota'],
      'venezuela': ['venezuelan', 'caracas', 'maduro'],
      'cuba': ['cuban', 'havana'],
      'hungary': ['hungarian', 'budapest', 'orban'],
      'czech republic': ['czech', 'prague'],
      'romania': ['romanian', 'bucharest'],
      'bulgaria': ['bulgarian', 'sofia'],
      'serbia': ['serbian', 'belgrade'],
      'croatia': ['croatian', 'zagreb'],
      'lebanon': ['lebanese', 'beirut', 'hezbollah'],
      'jordan': ['jordanian', 'amman'],
      'morocco': ['moroccan', 'rabat'],
      'algeria': ['algerian', 'algiers'],
      'tunisia': ['tunisian', 'tunis'],
      'libya': ['libyan', 'tripoli'],
      'ethiopia': ['ethiopian', 'addis ababa'],
      'kenya': ['kenyan', 'nairobi'],
      'sudan': ['sudanese', 'khartoum'],
      'myanmar': ['burmese', 'yangon', 'burma'],
      'bangladesh': ['bangladeshi', 'dhaka'],
      'sri lanka': ['sri lankan', 'colombo'],
      'nepal': ['nepalese', 'kathmandu'],
      'kazakhstan': ['kazakh', 'astana'],
      'uzbekistan': ['uzbek', 'tashkent'],
      'azerbaijan': ['azerbaijani', 'baku'],
      'georgia': ['georgian', 'tbilisi'],
      'armenia': ['armenian', 'yerevan'],
    }

    // Extract countries from text
    const extractCountries = (text) => {
      if (!text) return []
      const lowerText = text.toLowerCase()
      const found = new Set()

      for (const [country, keywords] of Object.entries(countryKeywords)) {
        // Check country name itself
        if (lowerText.includes(country)) {
          found.add(country)
          continue
        }
        // Check keywords
        for (const keyword of keywords) {
          if (lowerText.includes(keyword)) {
            found.add(country)
            break
          }
        }
      }

      return Array.from(found)
    }

    // Count by country
    const countryCounts = {}
    
    articles.forEach(article => {
      const textToSearch = [
        article.title,
        article.title_news,
        article.description,
        article.category
      ].filter(Boolean).join(' ')

      const countries = extractCountries(textToSearch)
      
      countries.forEach(country => {
        // Capitalize for display
        const displayName = country.split(' ').map(w => 
          w.charAt(0).toUpperCase() + w.slice(1)
        ).join(' ')
        
        countryCounts[displayName] = (countryCounts[displayName] || 0) + 1
      })
    })

    return res.status(200).json({
      status: 'ok',
      hours,
      totalArticles: articles.length,
      countryCounts,
      generatedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Map countries API error:', error)
    return res.status(500).json({ 
      status: 'error',
      error: error.message 
    })
  }
}

