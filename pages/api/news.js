import fs from 'fs';
import path from 'path';
import { createClient } from '../../lib/supabase-server';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Pagination support
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 20;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;

   // Check for test mode (for testing Timeline & Graph components)
  if (req.query.test === 'true') {
    try {
      const testFilePath = path.join(process.cwd(), 'public', 'test_timeline_graph.json');
      if (fs.existsSync(testFilePath)) {
        const testData = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));
        console.log('✅ Serving TEST data with Timeline & Graph examples');
        return res.status(200).json(testData);
      }
    } catch (error) {
      console.log(`⚠️  Error loading test data: ${error.message}`);
    }
  }

  // Check if user wants only unread articles
  const onlyUnread = req.query.unread === 'true';
  
  // If user wants unread articles and is authenticated, use Supabase
  if (onlyUnread) {
    try {
      const supabase = createClient({ req, res });
      
      // Check authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return res.status(401).json({ error: 'Authentication required for unread filter' });
      }

      const limit = parseInt(req.query.limit) || 50;
      
      // Get unread articles using the database function
      const { data: articles, error } = await supabase.rpc('get_unread_articles', {
        limit_count: limit
      });

      if (error) {
        console.error('Error fetching unread articles:', error);
        // Fall back to regular news if Supabase fails
      } else if (articles && articles.length > 0) {
        // Format articles for frontend
        const formattedArticles = articles.map((article, index) => {
          // Parse summary_bullets if it's a string
          let summaryBullets = [];
          if (article.summary_bullets) {
            try {
              summaryBullets = typeof article.summary_bullets === 'string'
                ? JSON.parse(article.summary_bullets)
                : article.summary_bullets;
            } catch (e) {
              console.error('Error parsing summary_bullets:', e);
              summaryBullets = [];
            }
          }

          return {
          rank: index + 1,
          id: article.id,
          title: article.title,
            detailed_text: article.article || article.ai_detailed_text || article.summary,
            summary_bullets: summaryBullets,
          url: article.url,
          urlToImage: article.image_url,
          source: article.source,
          category: article.category,
          emoji: article.emoji,
          details: article.details || [],
          timeline: article.timeline || [],
          graph: article.graph || null,
          components: article.components || null,
          citations: article.citations || [],
          published_at: article.published_at,
          added_at: article.added_at,
          final_score: article.final_score
          };
        });

        return res.status(200).json({
          status: 'ok',
          totalResults: formattedArticles.length,
          articles: formattedArticles,
          generatedAt: new Date().toISOString(),
          displayTimestamp: new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          digest_date: new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          dailyGreeting: 'Your Unread News',
          readingTime: `${formattedArticles.length} unread articles`,
          displayDate: new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }).toUpperCase(),
          generatedAtUK: new Date().toISOString()
        });
      }
    } catch (error) {
      console.log('⚠️ Supabase unread filter failed, falling back to regular news:', error.message);
    }
  }

  // Try Supabase first (for production)
  try {
    console.log('🔄 Attempting to fetch from Supabase...');
    const supabaseResponse = await fetch(`${req.headers.host ? `https://${req.headers.host}` : 'http://localhost:3000'}/api/news-supabase`, {
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    if (supabaseResponse.ok) {
      const supabaseData = await supabaseResponse.json();
      console.log(`✅ Serving LIVE RSS news from Supabase (${supabaseData.articles?.length || 0} articles with images!)`);
      
      // Apply pagination if articles exist
      if (supabaseData.articles && Array.isArray(supabaseData.articles)) {
        const paginatedArticles = supabaseData.articles.slice(startIndex, endIndex);
        const hasMore = endIndex < supabaseData.articles.length;
        
        return res.status(200).json({
          ...supabaseData,
          articles: paginatedArticles,
          pagination: {
            page,
            pageSize,
            total: supabaseData.articles.length,
            hasMore
          }
        });
      }
      
      return res.status(200).json(supabaseData);
    }
  } catch (fetchError) {
    console.log(`⚠️  Supabase not available: ${fetchError.message}`);
  }

  // FALLBACK 1: Try test example news (for development/testing only)
  try {
    const testFilePath = path.join(process.cwd(), 'public', 'test_example_news.json');
    if (fs.existsSync(testFilePath)) {
      const testData = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));
      console.log('✅ Serving TEST EXAMPLE news with photos and content');
      
      // Apply pagination if articles exist
      if (testData.articles && Array.isArray(testData.articles)) {
        const paginatedArticles = testData.articles.slice(startIndex, endIndex);
        const hasMore = endIndex < testData.articles.length;
        
        return res.status(200).json({
          ...testData,
          articles: paginatedArticles,
          pagination: {
            page,
            pageSize,
            total: testData.articles.length,
            hasMore
          }
        });
      }
      
      return res.status(200).json(testData);
    }
  } catch (error) {
    console.log(`⚠️  Error loading test example: ${error.message}`);
  }

  // FALLBACK 2: Try to read today's news file from public directory
  try {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '_');
    
    const newsFileName = `tennews_data_${dateStr}.json`;
    const newsFilePath = path.join(process.cwd(), 'public', newsFileName);
    
    if (fs.existsSync(newsFilePath)) {
      const newsData = JSON.parse(fs.readFileSync(newsFilePath, 'utf8'));
      console.log(`✅ Serving news data from file: ${newsFileName}`);
      
      // Apply pagination if articles exist
      if (newsData.articles && Array.isArray(newsData.articles)) {
        const paginatedArticles = newsData.articles.slice(startIndex, endIndex);
        const hasMore = endIndex < newsData.articles.length;
        
        return res.status(200).json({
          ...newsData,
          articles: paginatedArticles,
          pagination: {
            page,
            pageSize,
            total: newsData.articles.length,
            hasMore
          }
        });
      }
      
      return res.status(200).json(newsData);
    }
  } catch (error) {
    console.log(`⚠️  Error reading today's file: ${error.message}`);
  }
    
  // FALLBACK 2: Find most recent news file in public directory
  try {
    const publicDir = path.join(process.cwd(), 'public');
    const files = fs.readdirSync(publicDir);
    const newsFiles = files
      .filter(file => file.startsWith('tennews_data_') && file.endsWith('.json'))
      .sort()
      .reverse();
    
    if (newsFiles.length > 0) {
      const latestNewsFile = newsFiles[0];
      const latestNewsPath = path.join(publicDir, latestNewsFile);
      const newsData = JSON.parse(fs.readFileSync(latestNewsPath, 'utf8'));
      console.log(`✅ Serving recent news data from file: ${latestNewsFile}`);
      
      // Apply pagination if articles exist
      if (newsData.articles && Array.isArray(newsData.articles)) {
        const paginatedArticles = newsData.articles.slice(startIndex, endIndex);
        const hasMore = endIndex < newsData.articles.length;
        
        return res.status(200).json({
          ...newsData,
          articles: paginatedArticles,
          pagination: {
            page,
            pageSize,
            total: newsData.articles.length,
            hasMore
          }
        });
      }
      
      return res.status(200).json(newsData);
    }
  } catch (error) {
    console.log(`⚠️  Error finding recent files: ${error.message}`);
  }
    
  // FALLBACK 3: No news files found - return sample data
  const sampleData = {
    "digest_date": new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }),
    "articles": [{
      "rank": 1,
      "emoji": "📰",
      "title": "Ten News System Active",
      "summary": "Your automated news system is running. Fresh articles will appear here soon!",
      "details": ["RSS Fetcher Active", "AI Filter Running", "Live Updates"],
      "category": "System",
      "source": "Ten News",
      "url": "#"
    }],
    "dailyGreeting": "Welcome to Ten News!",
    "readingTime": "1 minute read",
    "displayDate": new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).toUpperCase(),
    "generatedAt": new Date().toISOString(),
    "generatedAtUK": new Date().toISOString()
  };
  
  return res.status(200).json(sampleData);
}
