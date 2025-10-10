/**
 * TEN NEWS - Next.js API Proxy
 * Fetches news from Flask API (SQLite database) or falls back to local JSON
 */

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // TRY 1: Fetch from Flask API (RSS System with images)
    try {
      const flaskApiUrl = process.env.FLASK_API_URL || 'http://localhost:5000/api/news';
      const response = await fetch(flaskApiUrl);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Serving RSS news from Flask API: ${data.articles.length} articles`);
        
        // Transform to match frontend format
        const transformed = {
          digest_date: data.displayTimestamp || new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          articles: data.articles.map((article, index) => ({
            rank: index + 1,
            emoji: article.emoji || '📰',
            title: article.title || 'News Story',
            summary: article.summary || article.description || 'News summary will appear here.',
            details: article.details ? [article.details] : (article.timeline || []),
            category: (article.category || 'WORLD NEWS').toUpperCase(),
            source: article.source || 'Ten News',
            url: article.url || '#',
            urlToImage: article.urlToImage || article.image_url || null, // ✅ IMAGE!
            image_url: article.urlToImage || article.image_url || null, // ✅ IMAGE!
            timeline: article.timeline || null,
            rewritten_text: article.summary || article.description,
            published_at: article.publishedAt || article.published_at,
            final_score: article.final_score
          })),
          dailyGreeting: "Today's Essential Global News",
          readingTime: `${Math.ceil(data.articles.length * 1.5)} minute read`,
          displayDate: new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }).toUpperCase(),
          generatedAt: data.generatedAt || new Date().toISOString(),
          totalArticles: data.totalResults || data.articles.length
        };
        
        return res.status(200).json(transformed);
      }
    } catch (flaskError) {
      console.log('⚠️ Flask API not available:', flaskError.message);
    }
    
    // TRY 2: Fall back to local JSON files (old system)
    const sampleData = {
      "digest_date": new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      "articles": [
        {
          "rank": 1,
          "emoji": "🌍",
          "title": "Global News Updates Coming Soon",
          "summary": "Your Ten News automation is working! Fresh AI-curated news from GDELT and Claude AI will appear here daily at 7 AM UK time.",
          "details": ["Automated via GitHub Actions", "Powered by Claude AI", "Updated daily"],
          "category": "System",
          "source": "Ten News",
          "url": "#"
        },
        {
          "rank": 2,
          "emoji": "🤖",
          "title": "AI-Powered News Curation Active",
          "summary": "Your news generator fetches global stories from GDELT API and uses Claude AI to select and rewrite the top 10 most important stories each day.",
          "details": ["GDELT API integration", "Claude AI curation", "Daily automation"],
          "category": "Technology",
          "source": "Ten News",
          "url": "#"
        },
        {
          "rank": 3,
          "emoji": "⏰",
          "title": "Daily Updates at 7 AM UK Time",
          "summary": "GitHub Actions runs automatically every morning to generate fresh content. The system processes hundreds of articles to bring you the most important global news.",
          "details": ["7 AM UK schedule", "GitHub Actions", "Automatic processing"],
          "category": "System",
          "source": "Ten News",
          "url": "#"
        }
      ],
      "dailyGreeting": "Welcome to Ten News! Your automation is working perfectly.",
      "readingTime": "2 minute read",
      "displayDate": new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }).toUpperCase(),
      "historicalEvents": [
        { "year": "1969", "description": "Apollo 11 lands on the moon" },
        { "year": "1989", "description": "Fall of the Berlin Wall begins" },
        { "year": "2007", "description": "First iPhone is released" },
        { "year": "1776", "description": "Declaration of Independence signed" }
      ],
      "generatedAt": new Date().toISOString(),
      "generatedAtUK": new Date().toISOString()
    };
    
    return res.status(200).json(sampleData);
    
  } catch (error) {
    console.error('Error reading news data:', error);
    
    // Fallback sample data even on error
    const fallbackData = {
      "articles": [{
        "rank": 1,
        "emoji": "📰",
        "title": "Ten News System Active",
        "summary": "Your automated news system is running. Check back at 7 AM UK time for fresh content!",
        "details": ["GitHub Actions", "Claude AI", "GDELT API"],
        "category": "System",
        "source": "Ten News",
        "url": "#"
      }],
      "dailyGreeting": "Welcome to Ten News!",
      "readingTime": "1 minute read"
    };
    
    return res.status(200).json(fallbackData);
  }
}
