import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get today's date
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '_');
    
    // Try to read today's news file
    const newsFileName = `tennews_data_${dateStr}.json`;
    const newsFilePath = path.join(process.cwd(), newsFileName);
    
    // Check if today's file exists
    if (fs.existsSync(newsFilePath)) {
      const newsData = JSON.parse(fs.readFileSync(newsFilePath, 'utf8'));
      console.log(`✅ Serving real news data from: ${newsFileName}`);
      return res.status(200).json(newsData);
    } else {
      console.log(`⚠️ Today's file not found: ${newsFileName}`);
    }
    
    // If today's file doesn't exist, find the most recent one
    const files = fs.readdirSync(process.cwd());
    const newsFiles = files
      .filter(file => file.startsWith('tennews_data_') && file.endsWith('.json'))
      .sort()
      .reverse();
    
    if (newsFiles.length > 0) {
      const latestNewsFile = newsFiles[0];
      const latestNewsPath = path.join(process.cwd(), latestNewsFile);
      const newsData = JSON.parse(fs.readFileSync(latestNewsPath, 'utf8'));
      console.log(`✅ Serving recent news data from: ${latestNewsFile}`);
      return res.status(200).json(newsData);
    } else {
      console.log('⚠️ No news data files found, using sample data');
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
