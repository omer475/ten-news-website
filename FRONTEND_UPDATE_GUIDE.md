# 🎨 FRONTEND UPDATE GUIDE

## Overview

Your Next.js frontend currently loads news from local JSON files. It needs to fetch from the new REST API instead.

---

## 🔧 REQUIRED CHANGES

### Current (Old):
```javascript
// pages/index.js
const [newsData, setNewsData] = useState(null);

useEffect(() => {
  fetch('/tennews_data_live.json')
    .then(res => res.json())
    .then(data => setNewsData(data));
}, []);
```

### New (REST API):
```javascript
// pages/index.js
const [newsData, setNewsData] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetchArticles();
  // Auto-refresh every 5 minutes
  const interval = setInterval(fetchArticles, 300000);
  return () => clearInterval(interval);
}, []);

async function fetchArticles() {
  try {
    setLoading(true);
    const response = await fetch('http://localhost:5000/api/articles?limit=100&hours=24');
    const data = await response.json();
    
    // Transform to match old format
    const transformed = {
      generatedAt: new Date().toISOString(),
      totalArticles: data.total,
      articles: data.articles.map(article => ({
        url: article.url,
        source: article.source,
        title: article.title,
        summary: article.description,
        emoji: article.ai_emoji || '📰',
        category: article.category,
        image: article.image_url,
        final_score: article.ai_final_score,
        // Add any other fields your frontend uses
      }))
    };
    
    setNewsData(transformed);
    setLoading(false);
  } catch (error) {
    console.error('Error fetching articles:', error);
    setLoading(false);
  }
}
```

---

## 📊 API RESPONSE FORMAT

### `/api/articles` Response:
```json
{
  "articles": [
    {
      "id": 123,
      "url": "https://...",
      "source": "Reuters World",
      "title": "Article Title",
      "description": "Article description...",
      "image_url": "https://...",
      "author": "John Doe",
      "published_date": "2025-10-10T12:00:00",
      "category": "science",
      "ai_final_score": 75.5,
      "ai_emoji": "🔬",
      "published_at": "2025-10-10T12:15:00",
      "view_count": 42
    }
  ],
  "total": 150,
  "limit": 100,
  "offset": 0,
  "has_more": true
}
```

---

## 🎯 CATEGORY FILTERING

### Add category tabs:
```javascript
const categories = [
  { id: 'all', name: 'All' },
  { id: 'breaking', name: '🔴 Breaking' },
  { id: 'science', name: '🔬 Science' },
  { id: 'technology', name: '💻 Technology' },
  { id: 'business', name: '💼 Business' },
  { id: 'environment', name: '🌍 Environment' },
  { id: 'data', name: '📊 Data' },
  { id: 'politics', name: '🏛️ Politics' },
];

const [selectedCategory, setSelectedCategory] = useState('all');

// Fetch with category
const url = selectedCategory === 'all' 
  ? 'http://localhost:5000/api/articles?limit=100'
  : `http://localhost:5000/api/articles?category=${selectedCategory}&limit=100`;
```

---

## 🔍 SEARCH FEATURE

### Add search functionality:
```javascript
const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState([]);

async function handleSearch(query) {
  if (!query) return;
  
  const response = await fetch(`http://localhost:5000/api/search?q=${encodeURIComponent(query)}&limit=50`);
  const data = await response.json();
  setSearchResults(data.results);
}
```

---

## 🌐 ENVIRONMENT VARIABLES

### Create `.env.local`:
```bash
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### Use in code:
```javascript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

fetch(`${API_URL}/api/articles?limit=100`)
```

---

## 🚀 PRODUCTION DEPLOYMENT

### For Production:
1. Deploy Flask API to Railway/VPS
2. Get API URL (e.g., `https://api.tennews.com`)
3. Update `.env.production`:
```bash
NEXT_PUBLIC_API_URL=https://api.tennews.com
```

---

## ✅ TESTING

### 1. Start API server:
```bash
python3 api.py
```

### 2. Test API:
```bash
curl http://localhost:5000/api/articles?limit=10
```

### 3. Start Next.js:
```bash
npm run dev
```

### 4. Visit http://localhost:3000

---

## 📝 MINIMAL EXAMPLE

Here's a minimal working example:

```javascript
// pages/index.js (simplified)
import { useEffect, useState } from 'react';

export default function Home() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:5000/api/articles?limit=50')
      .then(res => res.json())
      .then(data => {
        setArticles(data.articles);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Ten News Live</h1>
      {articles.map(article => (
        <article key={article.id}>
          <h2>{article.ai_emoji} {article.title}</h2>
          <p>{article.description}</p>
          <small>{article.source} • Score: {article.ai_final_score.toFixed(0)}</small>
          <a href={article.url} target="_blank">Read More →</a>
        </article>
      ))}
    </div>
  );
}
```

---

## 🎨 YOUR CURRENT DESIGN

Your existing design is beautiful! Just swap the data source:

**Old:**
```javascript
fetch('/tennews_data_live.json')
```

**New:**
```javascript
fetch('http://localhost:5000/api/articles?limit=100')
  .then(res => res.json())
  .then(data => {
    // Transform data.articles to match your old format if needed
    setNewsData(data);
  })
```

---

## ⚡ AUTO-REFRESH

Add live updates:

```javascript
useEffect(() => {
  // Initial fetch
  fetchArticles();
  
  // Auto-refresh every 5 minutes
  const interval = setInterval(fetchArticles, 5 * 60 * 1000);
  
  // Cleanup
  return () => clearInterval(interval);
}, []);
```

---

## 🐛 CORS ISSUES?

If you get CORS errors, the Flask API already has CORS enabled:

```python
# api.py
from flask_cors import CORS
app = Flask(__name__)
CORS(app)  # ✅ Already added!
```

---

## 📊 OPTIONAL: Add Loading States

```javascript
{loading ? (
  <div className="loading">
    <div className="spinner"></div>
    <p>Loading latest news...</p>
  </div>
) : (
  <div className="articles">
    {articles.map(...)}
  </div>
)}
```

---

## ✅ CHECKLIST

- [ ] Replace JSON file fetch with API call
- [ ] Add API_URL environment variable
- [ ] Test with `python3 api.py` running
- [ ] Add auto-refresh (optional)
- [ ] Add category filtering (optional)
- [ ] Add search feature (optional)
- [ ] Test on localhost:3000
- [ ] Deploy API to production
- [ ] Update production API URL
- [ ] Deploy frontend to Vercel

---

**That's it! Your frontend will now use the live RSS system!** 🎉

