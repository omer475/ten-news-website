// API route for individual news articles
export default async function handler(req, res) {
  const { id } = req.query;

  try {
    // Fetch news data from the same server's news API
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;
    const response = await fetch(`${baseUrl}/api/news`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch news data');
    }

    const newsData = await response.json();
    
    if (!newsData.articles || newsData.articles.length === 0) {
      return res.status(404).json({ error: 'No articles found' });
    }

    // If specific ID requested, find that article
    if (id) {
      // Compare as strings to handle both number and string IDs
      const article = newsData.articles.find(a => String(a.id) === String(id));
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }
      return res.status(200).json(article);
    }

    // Return first article if no ID specified
    return res.status(200).json(newsData.articles[0]);

  } catch (error) {
    console.error('Error fetching article:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
