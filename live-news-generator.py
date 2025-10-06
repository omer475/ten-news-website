# TEN NEWS - LIVE NEWS GENERATOR
# Real-time news fetching using NewsAPI
# This works ALONGSIDE the daily 10-news digest generator
# Features: Live news updates, images included, multiple categories

import requests
import json
from datetime import datetime, timedelta
import time
import os
import pytz
import re

# ==================== API KEY CONFIGURATION ====================
NEWSAPI_KEY = os.environ.get('NEWSAPI_KEY', 'your-newsapi-key-here')
CLAUDE_API_KEY = os.environ.get('CLAUDE_API_KEY', 'your-api-key-here')

# Claude Model for article enhancement
CLAUDE_MODEL = "claude-3-5-sonnet-20241022"

# ==================== NEWS CATEGORIES ====================
# NewsAPI supports various categories
NEWS_CATEGORIES = [
    'general',
    'business', 
    'technology',
    'science',
    'health',
    'sports',
    'entertainment'
]

# Top news sources for quality content
PREMIUM_SOURCES = [
    'bbc-news',
    'reuters',
    'cnn',
    'the-wall-street-journal',
    'bloomberg',
    'the-verge',
    'techcrunch',
    'wired',
    'associated-press',
    'abc-news',
    'al-jazeera-english',
    'ars-technica',
    'axios',
    'fortune',
    'the-guardian-uk',
    'national-geographic',
    'newsweek',
    'nbc-news',
    'politico',
    'time',
    'usa-today',
    'the-washington-post'
]

# ==================== UTILITY FUNCTIONS ====================
def clean_text_for_json(text):
    """Clean text to be JSON-safe"""
    if not text:
        return ""
    
    text = str(text)
    text = text.replace('"', "'")
    text = text.replace('\\', '\\\\')
    text = text.replace('\n', ' ')
    text = text.replace('\r', ' ')
    text = text.replace('\t', ' ')
    
    # Remove control characters
    text = ''.join(char for char in text if ord(char) >= 32 or char == '\n')
    text = text.strip()
    
    return text

def get_formatted_timestamp():
    """Get formatted timestamp in UK timezone"""
    uk_tz = pytz.timezone('Europe/London')
    uk_time = datetime.now(uk_tz)
    return uk_time.strftime("%A, %B %d, %Y at %H:%M %Z")

# ==================== NEWSAPI FETCHING ====================
def fetch_top_headlines(category=None, country='us', page_size=20):
    """Fetch top headlines from NewsAPI"""
    if not NEWSAPI_KEY or NEWSAPI_KEY == 'your-newsapi-key-here':
        print("❌ NewsAPI key not configured!")
        return []
    
    url = "https://newsapi.org/v2/top-headlines"
    
    params = {
        'apiKey': NEWSAPI_KEY,
        'pageSize': page_size,
        'language': 'en'
    }
    
    if category:
        params['category'] = category
        print(f"📰 Fetching {category} news...")
    else:
        print(f"📰 Fetching general headlines...")
    
    if country:
        params['country'] = country
    
    try:
        response = requests.get(url, params=params, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            articles = data.get('articles', [])
            print(f"   ✅ Found {len(articles)} articles")
            return articles
        elif response.status_code == 426:
            print(f"   ⚠️ Upgrade required - using free tier limits")
            return []
        elif response.status_code == 429:
            print(f"   ⚠️ Rate limit reached")
            return []
        else:
            print(f"   ❌ Error {response.status_code}: {response.text[:200]}")
            return []
            
    except Exception as e:
        print(f"   ❌ Error fetching news: {str(e)}")
        return []

def fetch_everything_news(query, from_date=None, sort_by='publishedAt', page_size=20):
    """Fetch news using everything endpoint with query"""
    if not NEWSAPI_KEY or NEWSAPI_KEY == 'your-newsapi-key-here':
        print("❌ NewsAPI key not configured!")
        return []
    
    url = "https://newsapi.org/v2/everything"
    
    # Default to last 24 hours if no date provided
    if not from_date:
        from_date = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
    
    params = {
        'apiKey': NEWSAPI_KEY,
        'q': query,
        'from': from_date,
        'sortBy': sort_by,
        'language': 'en',
        'pageSize': page_size
    }
    
    print(f"🔍 Searching for: '{query}'...")
    
    try:
        response = requests.get(url, params=params, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            articles = data.get('articles', [])
            print(f"   ✅ Found {len(articles)} articles")
            return articles
        else:
            print(f"   ❌ Error {response.status_code}")
            return []
            
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        return []

def fetch_from_premium_sources(page_size=50):
    """Fetch news from premium sources"""
    if not NEWSAPI_KEY or NEWSAPI_KEY == 'your-newsapi-key-here':
        print("❌ NewsAPI key not configured!")
        return []
    
    url = "https://newsapi.org/v2/top-headlines"
    
    # Join sources with comma
    sources_str = ','.join(PREMIUM_SOURCES[:20])  # NewsAPI limits to 20 sources
    
    params = {
        'apiKey': NEWSAPI_KEY,
        'sources': sources_str,
        'pageSize': page_size
    }
    
    print(f"🌟 Fetching from {len(PREMIUM_SOURCES[:20])} premium sources...")
    
    try:
        response = requests.get(url, params=params, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            articles = data.get('articles', [])
            print(f"   ✅ Found {len(articles)} articles from premium sources")
            return articles
        else:
            print(f"   ❌ Error {response.status_code}")
            return []
            
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        return []

# ==================== ARTICLE PROCESSING ====================
def process_newsapi_article(article):
    """Process and clean NewsAPI article"""
    processed = {
        'title': clean_text_for_json(article.get('title', '')),
        'description': clean_text_for_json(article.get('description', '')),
        'url': article.get('url', ''),
        'image': article.get('urlToImage', ''),
        'publishedAt': article.get('publishedAt', ''),
        'source': article.get('source', {}).get('name', 'Unknown'),
        'author': clean_text_for_json(article.get('author', '')),
        'content': clean_text_for_json(article.get('content', ''))
    }
    
    # Remove articles with missing critical data
    if not processed['title'] or not processed['url']:
        return None
    
    # Ensure image URL is valid
    if processed['image'] and not processed['image'].startswith('http'):
        processed['image'] = ''
    
    return processed

def deduplicate_articles(articles):
    """Remove duplicate articles based on URL and title similarity"""
    seen_urls = set()
    seen_titles = set()
    unique_articles = []
    
    for article in articles:
        url = article.get('url', '').lower()
        title = article.get('title', '').lower()
        
        # Skip if URL already seen
        if url in seen_urls:
            continue
        
        # Skip if very similar title exists
        title_unique = True
        for seen_title in seen_titles:
            # Simple similarity check
            if title in seen_title or seen_title in title:
                title_unique = False
                break
        
        if not title_unique:
            continue
        
        seen_urls.add(url)
        seen_titles.add(title)
        unique_articles.append(article)
    
    return unique_articles

# ==================== AI ENHANCEMENT ====================
def call_claude_api(prompt, task_description):
    """Call Claude API for article enhancement"""
    if not CLAUDE_API_KEY or CLAUDE_API_KEY == 'your-api-key-here':
        print("⚠️ Claude API key not configured - skipping AI enhancement")
        return None
    
    print(f"🤖 {task_description}...")
    
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    
    data = {
        "model": CLAUDE_MODEL,
        "max_tokens": 2000,
        "temperature": 0.3,
        "messages": [{"role": "user", "content": prompt}]
    }
    
    try:
        response = requests.post(url, headers=headers, json=data, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            if 'content' in result and len(result['content']) > 0:
                return result['content'][0]['text']
        else:
            print(f"   ⚠️ Claude API error {response.status_code}")
            
    except Exception as e:
        print(f"   ⚠️ Claude API error: {str(e)}")
    
    return None

def parse_json_response(response_text):
    """Parse JSON from Claude response"""
    if not response_text:
        return None
    
    response_text = response_text.strip()
    
    # Remove markdown code blocks
    if response_text.startswith('```json'):
        response_text = response_text[7:]
    if response_text.startswith('```'):
        response_text = response_text[3:]
    if response_text.endswith('```'):
        response_text = response_text[:-3]
    response_text = response_text.strip()
    
    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        # Try to extract JSON from response
        start_idx = response_text.find('{')
        end_idx = response_text.rfind('}') + 1
        if start_idx >= 0 and end_idx > start_idx:
            try:
                return json.loads(response_text[start_idx:end_idx])
            except:
                pass
    
    return None

def categorize_articles_with_ai(articles):
    """Use AI to categorize and enhance articles"""
    if not articles:
        return []
    
    # Prepare articles for AI
    articles_info = []
    for i, article in enumerate(articles[:30], 1):  # Process max 30 articles
        articles_info.append({
            'id': i,
            'title': article.get('title', ''),
            'description': article.get('description', ''),
            'source': article.get('source', '')
        })
    
    prompt = f"""Analyze these {len(articles_info)} live news articles and categorize them.

For each article, assign ONE category:
- World News (politics, international affairs, conflicts)
- Business (markets, companies, economy, finance)
- Technology (tech companies, innovations, gadgets, AI)
- Science (research, discoveries, space, environment)
- Health (medical, wellness, pandemics, treatments)
- Sports (games, athletes, tournaments)
- Entertainment (movies, music, celebrities, culture)

Also rate each article's importance (1-10, where 10 is breaking major news).

Return ONLY this JSON:
{{
  "categorized_articles": [
    {{
      "id": 1,
      "category": "Technology",
      "importance": 8,
      "emoji": "💻",
      "reasoning": "Brief reason for category"
    }}
  ]
}}

ARTICLES:
{json.dumps(articles_info, indent=2)}"""
    
    response = call_claude_api(prompt, "Categorizing articles")
    
    if response:
        parsed = parse_json_response(response)
        if parsed and 'categorized_articles' in parsed:
            return parsed['categorized_articles']
    
    return []

# ==================== MAIN LIVE NEWS GENERATION ====================
def generate_live_news(num_articles=30, use_categories=True, use_ai_enhancement=True):
    """Generate live news feed"""
    print("🔴 TEN NEWS - LIVE NEWS GENERATOR")
    print("=" * 60)
    print(f"⏰ {get_formatted_timestamp()}")
    print("=" * 60)
    
    all_articles = []
    
    # Strategy 1: Fetch from premium sources
    premium_articles = fetch_from_premium_sources(page_size=50)
    for article in premium_articles:
        processed = process_newsapi_article(article)
        if processed:
            all_articles.append(processed)
    
    time.sleep(1)  # Rate limiting
    
    # Strategy 2: Fetch by categories
    if use_categories:
        for category in ['business', 'technology', 'science', 'health']:
            category_articles = fetch_top_headlines(category=category, country=None, page_size=10)
            for article in category_articles:
                processed = process_newsapi_article(article)
                if processed:
                    all_articles.append(processed)
            time.sleep(1)  # Rate limiting
    
    # Strategy 3: Search for trending topics
    trending_queries = [
        'breaking news',
        'AI technology',
        'stock market',
        'climate change',
        'election'
    ]
    
    for query in trending_queries:
        search_articles = fetch_everything_news(query, page_size=5)
        for article in search_articles:
            processed = process_newsapi_article(article)
            if processed:
                all_articles.append(processed)
        time.sleep(1)  # Rate limiting
    
    print(f"\n📊 Collected {len(all_articles)} total articles")
    
    # Deduplicate
    unique_articles = deduplicate_articles(all_articles)
    print(f"📊 After deduplication: {len(unique_articles)} unique articles")
    
    if not unique_articles:
        print("❌ No articles found!")
        return None
    
    # Sort by publication date (newest first)
    unique_articles.sort(
        key=lambda x: x.get('publishedAt', ''), 
        reverse=True
    )
    
    # Take top N articles
    selected_articles = unique_articles[:num_articles]
    
    # AI Enhancement (optional)
    if use_ai_enhancement and CLAUDE_API_KEY != 'your-api-key-here':
        print(f"\n🤖 Enhancing {len(selected_articles)} articles with AI...")
        categorized = categorize_articles_with_ai(selected_articles)
        
        # Merge AI categorization with articles
        if categorized:
            category_map = {item['id']: item for item in categorized}
            for i, article in enumerate(selected_articles, 1):
                if i in category_map:
                    ai_data = category_map[i]
                    article['category'] = ai_data.get('category', 'World News')
                    article['importance'] = ai_data.get('importance', 5)
                    article['emoji'] = ai_data.get('emoji', '📰')
                else:
                    article['category'] = 'World News'
                    article['importance'] = 5
                    article['emoji'] = '📰'
    else:
        # Default categorization without AI
        print(f"\n📋 Using default categorization for {len(selected_articles)} articles...")
        for article in selected_articles:
            article['category'] = 'World News'
            article['importance'] = 5
            article['emoji'] = '📰'
    
    # Prepare final data structure
    live_news_data = {
        'generatedAt': datetime.now().isoformat(),
        'generatedAtUK': datetime.now(pytz.timezone('Europe/London')).isoformat(),
        'displayTimestamp': get_formatted_timestamp(),
        'totalArticles': len(selected_articles),
        'source': 'NewsAPI Live Feed',
        'articles': selected_articles
    }
    
    # Save to file
    timestamp = datetime.now().strftime('%Y_%m_%d_%H%M')
    filename = f"livenews_data_{timestamp}.json"
    
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(live_news_data, f, ensure_ascii=False, indent=2)
        
        print(f"\n✅ SUCCESS! Saved: {filename}")
        print(f"📰 Total articles: {len(selected_articles)}")
        print(f"🖼️  Articles with images: {sum(1 for a in selected_articles if a.get('image'))}")
        
        # Show category breakdown
        categories = {}
        for article in selected_articles:
            cat = article.get('category', 'Unknown')
            categories[cat] = categories.get(cat, 0) + 1
        
        print(f"\n📊 Category breakdown:")
        for cat, count in sorted(categories.items(), key=lambda x: x[1], reverse=True):
            print(f"   {cat}: {count} articles")
        
        return filename
        
    except Exception as e:
        print(f"❌ Error saving file: {str(e)}")
        return None

# ==================== CONTINUOUS LIVE FEED ====================
def run_continuous_live_feed(interval_minutes=15):
    """Run live news generator continuously"""
    print("🔴 STARTING CONTINUOUS LIVE NEWS FEED")
    print(f"⏰ Will update every {interval_minutes} minutes")
    print("⏹️  Press Ctrl+C to stop\n")
    
    while True:
        try:
            generate_live_news(num_articles=30, use_ai_enhancement=True)
            print(f"\n⏳ Waiting {interval_minutes} minutes until next update...")
            time.sleep(interval_minutes * 60)
            
        except KeyboardInterrupt:
            print("\n⏹️  Stopping live feed...")
            break
        except Exception as e:
            print(f"❌ Error in live feed: {str(e)}")
            print(f"⏳ Waiting 5 minutes before retry...")
            time.sleep(300)

# ==================== MAIN ====================
if __name__ == "__main__":
    print("TEN NEWS - LIVE NEWS GENERATOR")
    print("=" * 60)
    print("This generator works ALONGSIDE your daily 10-news digest")
    print("It provides real-time news updates with images from NewsAPI")
    print("=" * 60)
    print("\nOptions:")
    print("1. Generate live news once (30 articles)")
    print("2. Generate live news once (50 articles)")
    print("3. Run continuous feed (updates every 15 min)")
    print("4. Run continuous feed (updates every 30 min)")
    
    choice = input("\nEnter choice (1-4) or press Enter for option 1: ").strip()
    
    if choice == '2':
        generate_live_news(num_articles=50)
    elif choice == '3':
        run_continuous_live_feed(interval_minutes=15)
    elif choice == '4':
        run_continuous_live_feed(interval_minutes=30)
    else:
        generate_live_news(num_articles=30)

