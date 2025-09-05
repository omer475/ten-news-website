// API route for loading news data
// This provides better caching and error handling for Vercel deployment

import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // Set CORS headers for cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Set cache headers for Vercel Edge Network
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Get today's date in the format used by the generator
    const today = new Date();
    const dateStr = `${today.getFullYear()}_${(today.getMonth() + 1).toString().padStart(2, '0')}_${today.getDate().toString().padStart(2, '0')}`;
    const dataFilename = `tennews_data_${dateStr}.json`;
    
    // Try to read today's generated data
    const dataPath = path.join(process.cwd(), dataFilename);
    
    let newsData = null;
    
    try {
      if (fs.existsSync(dataPath)) {
        const fileContent = fs.readFileSync(dataPath, 'utf8');
        newsData = JSON.parse(fileContent);
        console.log('✅ Loaded today\'s generated news data from API');
      }
    } catch (error) {
      console.log('📰 Generated data not found, using sample data');
    }
    
    // Sample/fallback data structure
    const sampleData = {
      displayDate: 'FRIDAY, JANUARY 26, 2025',
      dailyGreeting: 'Good morning, here are today\'s most important stories',
      readingTime: '3 minute read',
      historicalEvents: [
        { year: '1788', description: 'First Fleet arrives in Australia' },
        { year: '1950', description: 'India becomes a republic' },
        { year: '1996', description: 'Java programming language released' },
        { year: '2001', description: 'Wikipedia launches to the public' }
      ],
      articles: [
        {
          rank: 1,
          emoji: '🌍',
          title: 'Global Markets Show Strong Recovery',
          summary: 'International markets demonstrate resilience amid economic uncertainties, with technology sectors leading gains across major exchanges in coordinated response.',
          details: ['Market cap: $2.1 trillion', 'Growth rate: 15%', 'Sectors: Tech, Energy'],
          category: 'Business',
          source: 'Reuters',
          url: 'https://reuters.com'
        },
        {
          rank: 2,
          emoji: '🚀',
          title: 'Space Exploration Milestone Achieved',
          summary: 'Major breakthrough in space technology opens new possibilities for deep space missions, marking significant advancement in human exploration capabilities.',
          details: ['Mission duration: 6 months', 'Distance: 40M km', 'Crew: 4 astronauts'],
          category: 'Science',
          source: 'NASA',
          url: 'https://nasa.gov'
        }
      ]
    };
    
    // Return either generated data or sample data
    const responseData = newsData || sampleData;
    
    // Add metadata for caching
    responseData.generatedAt = newsData?.generatedAt || new Date().toISOString();
    responseData.source = newsData ? 'generated' : 'sample';
    
    res.status(200).json(responseData);
    
  } catch (error) {
    console.error('Error in news API:', error);
    res.status(500).json({ 
      message: 'Internal server error', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Failed to load news data'
    });
  }
}
