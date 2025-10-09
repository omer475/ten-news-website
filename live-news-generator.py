# TEN NEWS - LIVE NEWS GENERATOR (ENHANCED)
# Real-time news fetching with full text extraction, AI scoring, and smart deduplication
# This works ALONGSIDE the daily 10-news digest generator
# 
# NEW FEATURES:
# 1. Full text extraction via web scraping
# 2. Time-based filtering (fetch news since last run)
# 3. Smart image selection from duplicates
# 4. AI importance/world-relevance/interestingness scoring
# 5. Unlimited emoji selection with AI
# 6. Claude AI rewriting (35-40 words) + title optimization (4-10 words)

import requests
import json
from datetime import datetime, timedelta
import time
import os
import pytz
import re
from bs4 import BeautifulSoup
from urllib.parse import urlparse
import google.generativeai as genai

# ==================== API KEY CONFIGURATION ====================
NEWSAPI_KEY = os.environ.get('NEWSAPI_KEY', 'your-newsapi-key-here')
CLAUDE_API_KEY = os.environ.get('CLAUDE_API_KEY', 'your-api-key-here')
GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY', 'your-google-api-key-here')

# Model Configuration
CLAUDE_MODEL = "claude-3-5-sonnet-20241022"
GEMINI_MODEL = "gemini-1.5-flash"  # Fast and cost-effective for scoring

# Configure Gemini
if GOOGLE_API_KEY and GOOGLE_API_KEY != 'your-google-api-key-here':
    genai.configure(api_key=GOOGLE_API_KEY)

# ==================== TIMESTAMP TRACKING ====================
TIMESTAMP_FILE = "livenews_last_run.json"

def get_last_run_time():
    """Get timestamp of last run"""
    try:
        if os.path.exists(TIMESTAMP_FILE):
            with open(TIMESTAMP_FILE, 'r') as f:
                data = json.load(f)
                return datetime.fromisoformat(data['last_run'])
    except Exception as e:
        print(f"⚠️ Could not read last run time: {str(e)}")
    
    # Default to 15 minutes ago
    return datetime.now() - timedelta(minutes=15)

def save_last_run_time():
    """Save current timestamp"""
    try:
        with open(TIMESTAMP_FILE, 'w') as f:
            json.dump({'last_run': datetime.now().isoformat()}, f)
    except Exception as e:
        print(f"⚠️ Could not save run time: {str(e)}")

# ==================== PREMIUM NEWS SOURCES ====================
PREMIUM_SOURCES = [
    'bbc-news', 'reuters', 'cnn', 'the-wall-street-journal', 'bloomberg',
    'the-verge', 'techcrunch', 'wired', 'associated-press', 'abc-news',
    'al-jazeera-english', 'ars-technica', 'axios', 'fortune',
    'the-guardian-uk', 'national-geographic', 'newsweek', 'nbc-news',
    'politico', 'time', 'usa-today', 'the-washington-post'
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
    text = ''.join(char for char in text if ord(char) >= 32 or char == '\n')
    text = text.strip()
    
    return text

def get_formatted_timestamp():
    """Get formatted timestamp in UK timezone"""
    uk_tz = pytz.timezone('Europe/London')
    uk_time = datetime.now(uk_tz)
    return uk_time.strftime("%A, %B %d, %Y at %H:%M %Z")

# ==================== REQUIREMENT 1: FULL TEXT EXTRACTION ====================
def extract_full_text(url, timeout=10):
    """Extract full article text from URL"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=timeout)
        
        if response.status_code != 200:
            return None
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove unwanted elements
        for tag in soup(['script', 'style', 'nav', 'header', 'footer', 'aside', 'iframe']):
            tag.decompose()
        
        # Try common article content selectors
        article_selectors = [
            'article',
            '[class*="article-content"]',
            '[class*="article-body"]',
            '[class*="story-content"]',
            '[class*="post-content"]',
            '[itemprop="articleBody"]',
            '.content',
            'main'
        ]
        
        article_text = ""
        for selector in article_selectors:
            elements = soup.select(selector)
            if elements:
                # Get all paragraphs within the article
                paragraphs = elements[0].find_all('p')
                if paragraphs:
                    article_text = ' '.join([p.get_text().strip() for p in paragraphs if p.get_text().strip()])
                    break
        
        # Fallback: get all paragraphs
        if not article_text or len(article_text) < 200:
            paragraphs = soup.find_all('p')
            article_text = ' '.join([p.get_text().strip() for p in paragraphs if len(p.get_text().strip()) > 30])
        
        # Clean up
        article_text = ' '.join(article_text.split())  # Normalize whitespace
        
        # Validation: must be substantial
        if len(article_text) < 300:  # Minimum 300 characters for valid article
            return None
        
        return article_text[:5000]  # Limit to 5000 characters
        
    except Exception as e:
        print(f"      ⚠️ Extraction failed: {str(e)[:50]}")
        return None

# ==================== REQUIREMENT 2: TIME-BASED FILTERING ====================
def fetch_newsapi_since_last_run(last_run_time):
    """Fetch news from NewsAPI since last run time"""
    if not NEWSAPI_KEY or NEWSAPI_KEY == 'your-newsapi-key-here':
        print("❌ NewsAPI key not configured!")
        return []
    
    url = "https://newsapi.org/v2/everything"
    
    # Calculate time difference
    now = datetime.now()
    minutes_ago = int((now - last_run_time).total_seconds() / 60)
    print(f"📅 Fetching news from last {minutes_ago} minutes...")
    
    # Format dates for API
    from_date = last_run_time.strftime('%Y-%m-%dT%H:%M:%S')
    
    # Fetch from premium sources
    sources_str = ','.join(PREMIUM_SOURCES[:20])  # API limit
    
    params = {
        'apiKey': NEWSAPI_KEY,
        'sources': sources_str,
        'from': from_date,
        'sortBy': 'publishedAt',
        'language': 'en',
        'pageSize': 100  # Maximum allowed
    }
    
    try:
        response = requests.get(url, params=params, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            articles = data.get('articles', [])
            print(f"   ✅ Found {len(articles)} articles since last run")
            return articles
        else:
            print(f"   ❌ Error {response.status_code}: {response.text[:200]}")
            return []
            
    except Exception as e:
        print(f"   ❌ Error fetching news: {str(e)}")
        return []

def fetch_breaking_news_everywhere():
    """Fetch breaking/important news regardless of time"""
    if not NEWSAPI_KEY or NEWSAPI_KEY == 'your-newsapi-key-here':
        return []
    
    url = "https://newsapi.org/v2/everything"
    
    # Search for breaking/important news from last 2 hours
    from_date = (datetime.now() - timedelta(hours=2)).strftime('%Y-%m-%dT%H:%M:%S')
    
    params = {
        'apiKey': NEWSAPI_KEY,
        'q': 'breaking OR urgent OR crisis OR major',
        'from': from_date,
        'sortBy': 'publishedAt',
        'language': 'en',
        'pageSize': 50
    }
    
    print(f"🚨 Searching for breaking news...")
    
    try:
        response = requests.get(url, params=params, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            articles = data.get('articles', [])
            print(f"   ✅ Found {len(articles)} breaking news articles")
            return articles
        else:
            return []
            
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        return []

# ==================== REQUIREMENT 3: SMART IMAGE SELECTION ====================
def smart_deduplicate_with_best_images(articles):
    """
    Deduplicate articles and select the best image from duplicates
    Returns: unique articles with best available images
    """
    print(f"\n🔍 Smart deduplication with image optimization...")
    
    # Group similar articles
    article_groups = {}
    
    for article in articles:
        title = article.get('title', '').lower()
        url = article.get('url', '').lower()
        
        # Create a normalized title for grouping
        # Remove common words and special chars
        title_normalized = re.sub(r'[^a-z0-9\s]', '', title)
        title_words = set(title_normalized.split())
        
        # Find matching group
        matched_group = None
        for group_key, group_articles in article_groups.items():
            group_words = set(group_key.split())
            
            # Check if titles have significant overlap (>60%)
            if title_words and group_words:
                overlap = len(title_words & group_words) / max(len(title_words), len(group_words))
                if overlap > 0.6:
                    matched_group = group_key
                    break
        
        if matched_group:
            article_groups[matched_group].append(article)
        else:
            article_groups[title_normalized] = [article]
    
    # Select best article from each group
    unique_articles = []
    
    for group_key, group in article_groups.items():
        if len(group) == 1:
            unique_articles.append(group[0])
        else:
            # Multiple articles - choose best
            # Priority: 1) Has image, 2) Longer description, 3) More reputable source
            
            # First, collect all good images from group
            available_images = [a.get('urlToImage', '') for a in group if a.get('urlToImage')]
            best_image = available_images[0] if available_images else ''
            
            # Select best article by content quality
            best_article = max(group, key=lambda a: (
                len(a.get('description', '')),
                len(a.get('content', '')),
                1 if a.get('source', {}).get('name', '') in ['Reuters', 'BBC News', 'Bloomberg'] else 0
            ))
            
            # If best article doesn't have image, use best available image
            if not best_article.get('urlToImage') and best_image:
                best_article['urlToImage'] = best_image
                print(f"   📸 Enhanced image for: {best_article.get('title', '')[:50]}...")
            
            unique_articles.append(best_article)
    
    print(f"   ✅ Reduced from {len(articles)} to {len(unique_articles)} articles (kept best images)")
    return unique_articles

# ==================== REQUIREMENT 4 & 5: AI SCORING AND EMOJI ====================
def score_articles_with_gemini(articles):
    """
    Use Gemini AI to score articles on:
    - Importance (1-10)
    - World Relevance (1-10)
    - Interestingness (1-10)
    Also select best emoji from ALL available emojis
    """
    if not GOOGLE_API_KEY or GOOGLE_API_KEY == 'your-google-api-key-here':
        print("⚠️ Google API key not configured - using default scores")
        return None
    
    print(f"\n🤖 Scoring {len(articles)} articles with Gemini AI...")
    
    # Prepare articles for AI (max 50 at a time for efficiency)
    articles_batch = articles[:50]
    
    articles_info = []
    for i, article in enumerate(articles_batch, 1):
        articles_info.append({
            'id': i,
            'title': article.get('title', '')[:150],
            'description': article.get('description', '')[:300],
            'full_text_preview': article.get('full_text', '')[:500] if article.get('full_text') else '',
            'source': article.get('source', {}).get('name', '')
        })
    
    prompt = f"""Analyze these {len(articles_info)} news articles and score each one:

SCORING CRITERIA:
1. **Importance** (1-10): How significant is this news? Breaking events = 10, minor updates = 1-3
2. **World Relevance** (1-10): How relevant to global audience? Major world events = 10, local news = 1-3
3. **Interestingness** (1-10): How engaging/compelling? Fascinating stories = 10, mundane = 1-3

EMOJI SELECTION:
- Choose the SINGLE BEST emoji from ALL available emojis (not just category-based)
- The emoji should perfectly capture the essence of the story
- Examples: 🚨 breaking news, 🏆 achievements, 💰 finance, 🌍 global, ⚡ energy, 🎯 target, 🔥 trending, etc.

QUALITY THRESHOLD:
- Only articles scoring 7.0+ overall should be considered newsworthy

Return ONLY valid JSON (no markdown):
{{
  "scored_articles": [
    {{
      "id": 1,
      "importance": 9,
      "world_relevance": 8,
      "interestingness": 7,
      "overall_score": 8.0,
      "emoji": "🚨",
      "category": "World News",
      "brief_reasoning": "Why these scores - max 20 words"
    }}
  ]
}}

ARTICLES:
{json.dumps(articles_info, indent=2)}"""
    
    try:
        model = genai.GenerativeModel(GEMINI_MODEL)
        response = model.generate_content(prompt)
        
        if response.text:
            # Parse JSON from response
            response_text = response.text.strip()
            
            # Remove markdown code blocks if present
            if response_text.startswith('```json'):
                response_text = response_text[7:]
            if response_text.startswith('```'):
                response_text = response_text[3:]
            if response_text.endswith('```'):
                response_text = response_text[:-3]
            response_text = response_text.strip()
            
            parsed = json.loads(response_text)
            
            if 'scored_articles' in parsed:
                scored = parsed['scored_articles']
                print(f"   ✅ Successfully scored {len(scored)} articles")
                return scored
                
    except Exception as e:
        print(f"   ⚠️ Gemini API error: {str(e)[:100]}")
    
    return None

def apply_ai_scores(articles, scores, score_threshold=7.0):
    """
    Apply AI scores to articles and filter by threshold
    Returns: articles meeting quality threshold, sorted by score
    """
    if not scores:
        # Fallback: assign default scores
        for article in articles:
            article['importance'] = 5
            article['world_relevance'] = 5
            article['interestingness'] = 5
            article['overall_score'] = 5.0
            article['emoji'] = '📰'
            article['category'] = 'World News'
        return articles
    
    # Create score map
    score_map = {score['id']: score for score in scores}
    
    # Apply scores
    scored_articles = []
    for i, article in enumerate(articles[:50], 1):  # Match batch size
        if i in score_map:
            score_data = score_map[i]
            
            # Calculate weighted overall score
            # Importance: 40%, World Relevance: 30%, Interestingness: 30%
            overall = (
                score_data.get('importance', 5) * 0.40 +
                score_data.get('world_relevance', 5) * 0.30 +
                score_data.get('interestingness', 5) * 0.30
            )
            
            article['importance'] = score_data.get('importance', 5)
            article['world_relevance'] = score_data.get('world_relevance', 5)
            article['interestingness'] = score_data.get('interestingness', 5)
            article['overall_score'] = round(overall, 2)
            article['emoji'] = score_data.get('emoji', '📰')
            article['category'] = score_data.get('category', 'World News')
            article['ai_reasoning'] = score_data.get('brief_reasoning', '')
            
            # Filter by threshold
            if overall >= score_threshold:
                scored_articles.append(article)
        else:
            # Articles beyond batch - assign default
            article['importance'] = 5
            article['world_relevance'] = 5
            article['interestingness'] = 5
            article['overall_score'] = 5.0
            article['emoji'] = '📰'
            article['category'] = 'World News'
    
    # Sort by overall score (highest first)
    scored_articles.sort(key=lambda x: x['overall_score'], reverse=True)
    
    print(f"   ✅ {len(scored_articles)} articles meet quality threshold ({score_threshold}+)")
    
    return scored_articles

# ==================== REQUIREMENT 6: CLAUDE AI REWRITING ====================
def rewrite_article_with_claude(article):
    """
    Rewrite article using Claude AI
    Must be 35-40 words based on full text
    """
    if not CLAUDE_API_KEY or CLAUDE_API_KEY == 'your-api-key-here':
        return None
    
    title = article.get('title', '')
    full_text = article.get('full_text', '')
    
    if not full_text:
        return None
    
    prompt = f"""You are a professional news writer. Rewrite this news article.

REQUIREMENTS:
1. **STRICT WORD COUNT: Exactly 35-40 words** (count every word carefully - tolerance +/- 2 words max)
2. Read the FULL TEXT carefully to understand the complete story
3. Write in clear, engaging news style
4. Focus on the most important facts
5. DO NOT add bold markup - plain text only

ORIGINAL TITLE: {title}

FULL ARTICLE TEXT:
{full_text[:3000]}

Return ONLY the rewritten article text (35-40 words, no title, no extra formatting)."""
    
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    
    data = {
        "model": CLAUDE_MODEL,
        "max_tokens": 500,
        "temperature": 0.5,
        "messages": [{"role": "user", "content": prompt}]
    }
    
    try:
        response = requests.post(url, headers=headers, json=data, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            if 'content' in result and len(result['content']) > 0:
                rewritten = result['content'][0]['text'].strip()
                
                # Validate word count
                word_count = len(rewritten.split())
                if 40 <= word_count <= 50:
                    return rewritten
                else:
                    print(f"      ⚠️ Word count {word_count} outside range, skipping")
                    return None
        else:
            print(f"      ⚠️ Claude API error {response.status_code}")
            
    except Exception as e:
        print(f"      ⚠️ Error: {str(e)[:50]}")
    
    return None

def optimize_title_with_claude(title, full_text):
    """
    Optimize title to be 4-10 words using Claude AI
    """
    if not CLAUDE_API_KEY or CLAUDE_API_KEY == 'your-api-key-here':
        return title
    
    word_count = len(title.split())
    
    # If title is already good length, keep it
    if 4 <= word_count <= 10:
        return title
    
    prompt = f"""You are a professional headline writer. Create a concise, impactful news headline.

REQUIREMENTS:
1. **STRICT WORD COUNT: Exactly 4-10 words** (count carefully)
2. Capture the main point of the story
3. Be clear and engaging
4. Use active voice
5. No clickbait

ORIGINAL TITLE: {title}

ARTICLE CONTEXT:
{full_text[:500]}

Return ONLY the optimized headline (4-10 words, no quotes, no extra text)."""
    
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    
    data = {
        "model": CLAUDE_MODEL,
        "max_tokens": 100,
        "temperature": 0.5,
        "messages": [{"role": "user", "content": prompt}]
    }
    
    try:
        response = requests.post(url, headers=headers, json=data, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            optimized_title = result['content'][0]['text'].strip()
            optimized_title = clean_text_for_json(optimized_title)
            
            # Verify word count
            optimized_word_count = len(optimized_title.split())
            if 4 <= optimized_word_count <= 10:
                return optimized_title
            else:
                print(f"      ⚠️ Title word count out of range ({optimized_word_count} words), keeping original")
                return title
        else:
            return title
            
    except Exception as e:
        print(f"      ⚠️ Title optimization error: {str(e)[:50]}")
        return title

def rewrite_articles_batch(articles):
    """Rewrite multiple articles with Claude"""
    print(f"\n✍️  Rewriting {len(articles)} articles with Claude AI (35-40 words)...")
    
    rewritten_count = 0
    title_optimized_count = 0
    
    for i, article in enumerate(articles, 1):
        original_title = article.get('title', '')
        print(f"   [{i}/{len(articles)}] {original_title[:60]}...")
        
        # First, rewrite the article summary
        rewritten = rewrite_article_with_claude(article)
        
        if rewritten:
            article['rewritten_text'] = rewritten
            article['word_count'] = len(rewritten.split())
            rewritten_count += 1
            print(f"      ✅ Rewritten ({article['word_count']} words)")
            
            # Then, optimize the title
            optimized_title = optimize_title_with_claude(original_title, article.get('full_text', ''))
            if optimized_title != original_title:
                article['title'] = optimized_title
                article['original_title'] = original_title
                title_optimized_count += 1
                print(f"      ✅ Title optimized ({len(optimized_title.split())} words)")
            
        else:
            print(f"      ❌ Skipping - rewrite failed")
        
        time.sleep(1.5)  # Slightly longer rate limiting for two API calls
    
    print(f"\n   ✅ Successfully rewrote {rewritten_count}/{len(articles)} articles")
    print(f"   ✅ Optimized {title_optimized_count} titles to 4-10 words")
    
    # Filter: only keep articles with successful rewrites
    articles_with_rewrites = [a for a in articles if 'rewritten_text' in a]
    
    return articles_with_rewrites

# ==================== MAIN PROCESSING PIPELINE ====================
def process_newsapi_article(article):
    """Process and clean NewsAPI article"""
    processed = {
        'title': clean_text_for_json(article.get('title', '')),
        'description': clean_text_for_json(article.get('description', '')),
        'url': article.get('url', ''),
        'urlToImage': article.get('urlToImage', ''),
        'publishedAt': article.get('publishedAt', ''),
        'source': article.get('source', {}),
        'author': clean_text_for_json(article.get('author', '')),
        'content': clean_text_for_json(article.get('content', ''))
    }
    
    # Validation
    if not processed['title'] or not processed['url']:
        return None
    
    # Ensure image URL is valid
    if processed['urlToImage'] and not processed['urlToImage'].startswith('http'):
        processed['urlToImage'] = ''
    
    return processed

def generate_live_news_enhanced():
    """
    Generate live news with ALL 6 requirements
    """
    print("🔴 TEN NEWS - LIVE NEWS GENERATOR (ENHANCED)")
    print("=" * 60)
    print(f"⏰ {get_formatted_timestamp()}")
    print("=" * 60)
    
    # REQUIREMENT 2: Get last run time
    last_run = get_last_run_time()
    print(f"📅 Last run: {last_run.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Fetch news since last run
    time_based_articles = fetch_newsapi_since_last_run(last_run)
    
    # Also fetch breaking news
    time.sleep(2)
    breaking_articles = fetch_breaking_news_everywhere()
    
    # Combine all sources
    all_articles = time_based_articles + breaking_articles
    
    print(f"\n📊 Total articles collected: {len(all_articles)}")
    
    if not all_articles:
        print("❌ No articles found!")
        print("📄 Saving empty result file...")
        
        empty_data = {
            'generatedAt': datetime.now().isoformat(),
            'displayTimestamp': get_formatted_timestamp(),
            'totalArticles': 0,
            'articles': []
        }
        
        timestamp = datetime.now().strftime('%Y_%m_%d_%H%M')
        filename = f"livenews_data_{timestamp}.json"
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(empty_data, f, ensure_ascii=False, indent=2)
        
        save_last_run_time()
        return filename
    
    # Process articles
    processed = []
    for article in all_articles:
        proc = process_newsapi_article(article)
        if proc:
            processed.append(proc)
    
    print(f"📊 After processing: {len(processed)} valid articles")
    
    # REQUIREMENT 3: Smart deduplication with image selection
    unique_articles = smart_deduplicate_with_best_images(processed)
    
    # REQUIREMENT 1: Extract full text for each article
    print(f"\n📖 Extracting full text from {len(unique_articles)} articles...")
    
    articles_with_text = []
    for i, article in enumerate(unique_articles, 1):
        print(f"   [{i}/{len(unique_articles)}] {article.get('title', '')[:60]}...")
        
        full_text = extract_full_text(article['url'])
        
        if full_text:
            article['full_text'] = full_text
            article['full_text_length'] = len(full_text)
            articles_with_text.append(article)
            print(f"      ✅ Extracted {len(full_text)} characters")
        else:
            print(f"      ❌ Skipping - extraction failed")
        
        time.sleep(0.5)  # Rate limiting
    
    print(f"\n   ✅ Successfully extracted text from {len(articles_with_text)}/{len(unique_articles)} articles")
    
    if not articles_with_text:
        print("❌ No articles with full text!")
        save_last_run_time()
        return None
    
    # REQUIREMENT 4 & 5: AI scoring and emoji selection
    scores = score_articles_with_gemini(articles_with_text)
    
    # Apply scores and filter by threshold (7.0+)
    quality_articles = apply_ai_scores(articles_with_text, scores, score_threshold=7.0)
    
    if not quality_articles:
        print("❌ No articles meet quality threshold!")
        print("📄 Saving empty result file...")
        
        empty_data = {
            'generatedAt': datetime.now().isoformat(),
            'displayTimestamp': get_formatted_timestamp(),
            'totalArticles': 0,
            'articles': []
        }
        
        timestamp = datetime.now().strftime('%Y_%m_%d_%H%M')
        filename = f"livenews_data_{timestamp}.json"
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(empty_data, f, ensure_ascii=False, indent=2)
        
        save_last_run_time()
        return filename
    
    print(f"\n📊 Articles meeting quality threshold: {len(quality_articles)}")
    print(f"📊 Score range: {quality_articles[-1]['overall_score']:.1f} - {quality_articles[0]['overall_score']:.1f}")
    
    # REQUIREMENT 6: Claude AI rewriting
    final_articles = rewrite_articles_batch(quality_articles)
    
    if not final_articles:
        print("❌ No articles successfully rewritten!")
        save_last_run_time()
        return None
    
    print(f"\n✅ Final article count: {len(final_articles)}")
    
    # Prepare final data structure
    live_news_data = {
        'generatedAt': datetime.now().isoformat(),
        'generatedAtUK': datetime.now(pytz.timezone('Europe/London')).isoformat(),
        'displayTimestamp': get_formatted_timestamp(),
        'totalArticles': len(final_articles),
        'source': 'NewsAPI Live Feed (Enhanced)',
        'quality_threshold': 7.0,
        'features': [
            'Full text extraction',
            'Time-based filtering',
            'Smart image selection',
            'AI importance scoring',
            'Unlimited emoji selection',
            'Claude AI rewriting (35-40 words) + title optimization (4-10 words)'
        ],
        'articles': final_articles
    }
    
    # Save to file
    timestamp = datetime.now().strftime('%Y_%m_%d_%H%M')
    filename = f"livenews_data_{timestamp}.json"
    
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(live_news_data, f, ensure_ascii=False, indent=2)
        
        print(f"\n{'='*60}")
        print(f"✅ SUCCESS! Saved: {filename}")
        print(f"📰 Total articles: {len(final_articles)}")
        print(f"🖼️  Articles with images: {sum(1 for a in final_articles if a.get('urlToImage'))}")
        print(f"📖 All articles have full text extraction")
        print(f"✍️  All articles rewritten by Claude AI (35-40 words) with optimized titles (4-10 words)")
        
        # Show category and score breakdown
        categories = {}
        for article in final_articles:
            cat = article.get('category', 'Unknown')
            categories[cat] = categories.get(cat, 0) + 1
        
        print(f"\n📊 Category breakdown:")
        for cat, count in sorted(categories.items(), key=lambda x: x[1], reverse=True):
            print(f"   {cat}: {count} articles")
        
        print(f"\n📊 Top 5 articles by score:")
        for i, article in enumerate(final_articles[:5], 1):
            print(f"   {i}. [{article['overall_score']}] {article['emoji']} {article['title'][:60]}...")
        
        # Update last run time
        save_last_run_time()
        
        print(f"\n⏰ Next run will fetch news from: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 60)
        
        return filename
        
    except Exception as e:
        print(f"❌ Error saving file: {str(e)}")
        return None

# ==================== MAIN ====================
if __name__ == "__main__":
    print("TEN NEWS - LIVE NEWS GENERATOR (ENHANCED)")
    print("=" * 60)
    print("NEW FEATURES:")
    print("✅ Full text extraction via web scraping")
    print("✅ Time-based filtering (only new news since last run)")
    print("✅ Smart image selection from duplicate articles")
    print("✅ AI scoring (importance + world relevance + interestingness)")
    print("✅ Unlimited emoji selection (best emoji from all available)")
    print("✅ Claude AI rewriting (35-40 words) + title optimization (4-10 words)")
    print("=" * 60)
    print("\nStarting live news generation...")
    print("This may take 8-10 minutes depending on article count.\n")
    
    result = generate_live_news_enhanced()
    
    if result:
        print(f"\n🎉 Live news generation complete!")
        print(f"📄 Output file: {result}")
        print(f"\n💡 Next step: Run research enhancer to add bold, details, timeline, citations")
        print(f"   Command: python3 news-research-enhancer.py {result}")
    else:
        print(f"\n⚠️ Live news generation completed with no articles or errors.")
