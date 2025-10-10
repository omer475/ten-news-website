import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Connect to SQLite database
    const dbPath = path.join(process.cwd(), 'ten_news.db');
    
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // Get published articles with images
    const articles = await db.all(`
      SELECT 
        id, title, url, source, description, content,
        image_url, author, published_date, published_at,
        category, emoji, ai_final_score, summary,
        timeline, details_section, view_count
      FROM articles
      WHERE published = TRUE
      ORDER BY ai_final_score DESC, published_at DESC
      LIMIT 50
    `);

    await db.close();

    if (articles && articles.length > 0) {
      console.log(`✅ Serving ${articles.length} articles from database (ten_news.db)`);
      
      // Format for frontend (compatible with old format)
      const formattedArticles = articles.map((article, index) => ({
        rank: index + 1,
        id: article.id,
        emoji: article.emoji || '📰',
        title: article.title,
        summary: article.summary || article.description,
        details: article.details_section ? [article.details_section] : [],
        timeline: article.timeline ? JSON.parse(article.timeline) : [],
        category: article.category || 'News',
        source: article.source || 'Ten News',
        url: article.url || '#',
        urlToImage: article.image_url,  // ⭐ THIS IS THE KEY FIELD!
        author: article.author,
        publishedAt: article.published_date || article.published_at,
        final_score: article.ai_final_score,
        views: article.view_count
      }));

      return res.status(200).json({
        status: 'ok',
        totalResults: formattedArticles.length,
        articles: formattedArticles,
        digest_date: new Date().toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        dailyGreeting: `📰 ${formattedArticles.length} Top Stories Today`,
        readingTime: `${Math.ceil(formattedArticles.length * 0.5)} minute read`,
        displayDate: new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }).toUpperCase(),
        generatedAt: new Date().toISOString()
      });
    } else {
      console.log('⚠️ No published articles in database yet');
    }
    
    // No news files found - return sample data
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
