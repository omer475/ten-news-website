import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Read the test file
    const testFilePath = path.join(process.cwd(), 'public', 'test_timeline_graph.json');
    
    if (!fs.existsSync(testFilePath)) {
      return res.status(404).json({ error: 'Test file not found' });
    }

    const testData = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));
    console.log(`✅ Serving TEST data with Timeline & Graph examples`);
    
    return res.status(200).json(testData);
  } catch (error) {
    console.error('Error loading test data:', error);
    return res.status(500).json({ error: 'Failed to load test data' });
  }
}

