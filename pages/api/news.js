// API route for loading news data on Vercel
import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Get today's date
    const today = new Date();
    const dateStr = `${today.getFullYear()}_${(today.getMonth() + 1).toString().padStart(2, '0')}_${today.getDate().toString().padStart(2, '0')}`;
    
    // Try to load today's news data
    const dataFilename = `tennews_data_${dateStr}.json`;
    const filePath = path.join(process.cwd(), dataFilename);
    
    if (fs.existsSync(filePath)) {
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const newsData = JSON.parse(fileContents);
      
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
      return res.status(200).json({
        success: true,
        data: newsData,
        source: 'generated'
      });
    } else {
      // Return sample data if no generated data found
      return res.status(200).json({
        success: false,
        message: 'No generated data found for today',
        source: 'fallback'
      });
    }
  } catch (error) {
    console.error('Error loading news data:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
}
