import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // FIRST: Try to fetch from Flask API (live RSS news with images!)
    console.log('🔄 Attempting to fetch from Flask API...');
    const flaskApiUrl = 'http://localhost:5001/api/news';
    const flaskResponse = await fetch(flaskApiUrl, { 
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    if (flaskResponse.ok) {
      const flaskData = await flaskResponse.json();
      console.log(`✅ Serving LIVE RSS news from Flask API (${flaskData.articles?.length || 0} articles with images!)`);
      return res.status(200).json(flaskData);
    }
  } catch (fetchError) {
    console.log(`⚠️  Flask API not available: ${fetchError.message}`);
  }

  // FALLBACK 1: Try to read today's news file
  try {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '_');
    
    const newsFileName = `tennews_data_${dateStr}.json`;
    const newsFilePath = path.join(process.cwd(), newsFileName);
    
    if (fs.existsSync(newsFilePath)) {
      const newsData = JSON.parse(fs.readFileSync(newsFilePath, 'utf8'));
      console.log(`✅ Serving news data from file: ${newsFileName}`);
      return res.status(200).json(newsData);
    }
  } catch (error) {
    console.log(`⚠️  Error reading today's file: ${error.message}`);
  }
    
  // FALLBACK 2: Find most recent news file
  try {
    const files = fs.readdirSync(process.cwd());
    const newsFiles = files
      .filter(file => file.startsWith('tennews_data_') && file.endsWith('.json'))
      .sort()
      .reverse();
    
    if (newsFiles.length > 0) {
      const latestNewsFile = newsFiles[0];
      const latestNewsPath = path.join(process.cwd(), latestNewsFile);
      const newsData = JSON.parse(fs.readFileSync(latestNewsPath, 'utf8'));
      console.log(`✅ Serving recent news data from file: ${latestNewsFile}`);
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
