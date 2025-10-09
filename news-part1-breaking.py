# TEN NEWS - PART 1: BREAKING NEWS GENERATOR
# Runs every 5 minutes
# Queries 12 premium breaking news sources
# Time-based filtering: Only news from last 5 minutes

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
from unified_news_scoring import score_articles_unified, apply_unified_scores

# ==================== API KEY CONFIGURATION ====================
NEWSAPI_KEY = os.environ.get('NEWSAPI_KEY', 'your-newsapi-key-here')
CLAUDE_API_KEY = os.environ.get('CLAUDE_API_KEY', 'your-api-key-here')
GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY', 'your-google-api-key-here')

# Model Configuration
CLAUDE_MODEL = "claude-3-5-sonnet-20241022"
GEMINI_MODEL = "gemini-1.5-flash-latest"

# Configure Gemini
if GOOGLE_API_KEY and GOOGLE_API_KEY != 'your-google-api-key-here':
    genai.configure(api_key=GOOGLE_API_KEY)

# ==================== PART 1 SOURCES (12) ====================
BREAKING_NEWS_SOURCES = [
    'reuters',
    'associated-press',
    'bbc-news',
    'cnn',
    'bloomberg',
    'the-guardian-uk',
    'al-jazeera-english',
    'abc-news',
    'the-washington-post',
    'the-wall-street-journal',
    'usa-today',
    'nbc-news'
]

# ==================== TIMESTAMP TRACKING ====================
TIMESTAMP_FILE_PART1 = "part1_last_run.json"

def get_last_run_time():
    """Get timestamp of last Part 1 run"""
    try:
        if os.path.exists(TIMESTAMP_FILE_PART1):
            with open(TIMESTAMP_FILE_PART1, 'r') as f:
                data = json.load(f)
                return datetime.fromisoformat(data['last_run'])
    except Exception as e:
        print(f"⚠️ Could not read last run time: {str(e)}")
    
    # Default to 5 minutes ago
    return datetime.now() - timedelta(minutes=5)

def save_last_run_time():
    """Save current timestamp"""
    try:
        with open(TIMESTAMP_FILE_PART1, 'w') as f:
            json.dump({'last_run': datetime.now().isoformat()}, f)
    except Exception as e:
        print(f"⚠️ Could not save run time: {str(e)}")

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

# ==================== FULL TEXT EXTRACTION ====================
def extract_full_text(url, timeout=10):
    """Extract full article text from URL"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=timeout)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Remove unwanted elements
        for tag in soup(['script', 'style', 'nav', 'header', 'footer', 'aside', 'iframe']):
            tag.decompose()
        
        # Try multiple selectors
        article_text = None
        
        # Common article selectors
        selectors = [
            'article', 
            '[role="main"]',
            '.article-body',
            '.story-body',
            '#article-body',
            '.post-content'
        ]
        
        for selector in selectors:
            article = soup.select_one(selector)
            if article:
                paragraphs = article.find_all('p')
                if paragraphs:
                    article_text = ' '.join([p.get_text().strip() for p in paragraphs])
                    break
        
        # Fallback: get all paragraphs
        if not article_text:
            paragraphs = soup.find_all('p')
            if paragraphs:
                article_text = ' '.join([p.get_text().strip() for p in paragraphs])
        
        if article_text:
            article_text = ' '.join(article_text.split())
            return article_text[:5000] if len(article_text) > 5000 else article_text
            
    except Exception as e:
        return None
    
    return None

# ==================== NEWSAPI FETCHING BY SOURCE ====================
def fetch_from_source(source_id, minutes_ago=5):
    """
    Fetch articles from a specific source
    Only articles from the last X minutes
    """
    if not NEWSAPI_KEY or NEWSAPI_KEY == 'your-newsapi-key-here':
        return []
    
    # Calculate time range
    now = datetime.now()
    from_time = now - timedelta(minutes=minutes_ago)
    
    # Format for NewsAPI (ISO 8601)
    from_param = from_time.strftime('%Y-%m-%dT%H:%M:%S')
    
    url = "https://newsapi.org/v2/everything"
    params = {
        'apiKey': NEWSAPI_KEY,
        'sources': source_id,
        'from': from_param,
        'language': 'en',
        'sortBy': 'publishedAt',
        'pageSize': 10  # Max 10 per source
    }
    
    try:
        response = requests.get(url, params=params, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            articles = data.get('articles', [])
            return articles
        else:
            print(f"   ⚠️ {source_id}: API error {response.status_code}")
            return []
            
    except Exception as e:
        print(f"   ⚠️ {source_id}: {str(e)[:50]}")
        return []

# ==================== SMART DEDUPLICATION ====================
def smart_deduplicate_with_best_images(articles):
    """Remove duplicate articles, keep best image"""
    if len(articles) <= 1:
        return articles
    
    print(f"\n🔍 Smart deduplication with image optimization...")
    
    # Group similar articles
    article_groups = {}
    
    for article in articles:
        title = article.get('title', '').lower()
        url = article.get('url', '').lower()
        
        # Create a normalized title for grouping
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
            # Collect all good images from group
            available_images = [a.get('urlToImage', '') for a in group if a.get('urlToImage')]
            best_image = available_images[0] if available_images else ''
            
            # Choose best article (prioritize longer description)
            best_article = max(group, key=lambda a: len(a.get('description', '')))
            
            # Use best image
            if best_image and best_image != best_article.get('urlToImage', ''):
                best_article['urlToImage'] = best_image
                print(f"   📸 Enhanced image for: {best_article.get('title', '')[:50]}...")
            
            unique_articles.append(best_article)
    
    print(f"   ✅ Reduced from {len(articles)} to {len(unique_articles)} articles (kept best images)")
    return unique_articles

# ==================== AI SCORING (GEMINI) ====================
def score_articles_with_gemini(articles):
    """
    Score articles with Gemini AI
    STRICT criteria for breaking news
    """
    if not GOOGLE_API_KEY or GOOGLE_API_KEY == 'your-google-api-key-here':
        print("⚠️ Google API key not configured")
        return None
    
    print(f"\n🤖 Scoring {len(articles)} articles with Gemini AI (STRICT MODE)...")
    
    articles_info = []
    for i, article in enumerate(articles[:50], 1):
        articles_info.append({
            'id': i,
            'title': article.get('title', '')[:150],
            'description': article.get('description', '')[:300],
            'full_text_preview': article.get('full_text', '')[:500] if article.get('full_text') else '',
            'source': article.get('source', {}).get('name', '')
        })
    
    prompt = f"""You are a STRICT news editor for a premium global news service. Analyze these {len(articles_info)} breaking news articles.

**GLOBAL FOCUS**: All countries matter equally. Judge by GLOBAL IMPACT, not regional bias.

**SCORING CRITERIA** (be VERY strict):

1. **Importance** (1-10):
   - 9-10: Major breaking events affecting millions (wars, disasters, major political changes, groundbreaking discoveries)
   - 7-8: Significant national/regional events with global implications
   - 5-6: Notable developments in ongoing stories
   - 1-4: Minor updates, routine announcements, celebrity news
   
2. **World Relevance** (1-10):
   - 9-10: Direct global impact (climate agreements, pandemic news, major conflicts, economic crises)
   - 7-8: Regional events with international consequences
   - 5-6: National events of interest to global audience
   - 1-4: Purely local/domestic news
   
3. **Interestingness** (1-10):
   - 9-10: Unprecedented, historic, shocking revelations
   - 7-8: Compelling human stories, major breakthroughs, surprising developments
   - 5-6: Standard newsworthy content
   - 1-4: Routine, predictable, mundane updates

**QUALITY THRESHOLD**: 
- Only articles scoring **8.0+ overall** should be recommended
- If unsure, score LOWER - we want ONLY the best

**EMOJI SELECTION**:
- Choose the SINGLE most relevant emoji from ALL available emojis
- Match the tone and subject perfectly

Return ONLY valid JSON (no markdown):
{{
  "scored_articles": [
    {{
      "id": 1,
      "importance": 9,
      "world_relevance": 8,
      "interestingness": 7,
      "overall_score": 8.2,
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
            response_text = response.text.strip()
            
            # Remove markdown
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

def apply_ai_scores(articles, scores, score_threshold=8.0):
    """Apply AI scores and filter by STRICT threshold (8.0+)"""
    if not scores:
        print("   ⚠️ No AI scores available - skipping all articles")
        return []
    
    score_map = {score['id']: score for score in scores}
    scored_articles = []
    
    for i, article in enumerate(articles[:50], 1):
        if i in score_map:
            score_data = score_map[i]
            
            # Weighted overall score
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
            
            # STRICT threshold (8.0+)
            if overall >= score_threshold:
                scored_articles.append(article)
    
    scored_articles.sort(key=lambda x: x['overall_score'], reverse=True)
    
    print(f"   ✅ {len(scored_articles)} articles meet STRICT threshold ({score_threshold}+)")
    
    return scored_articles

# ==================== CLAUDE AI REWRITING ====================
def rewrite_article_with_claude(article):
    """Rewrite article (35-40 words)"""
    if not CLAUDE_API_KEY or CLAUDE_API_KEY == 'your-api-key-here':
        return None
    
    title = article.get('title', '')
    full_text = article.get('full_text', '')
    
    if not full_text:
        return None
    
    prompt = f"""You are a professional news writer. Rewrite this breaking news article.

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
                
                word_count = len(rewritten.split())
                if 33 <= word_count <= 42:
                    return rewritten
            
    except Exception as e:
        pass
    
    return None

def optimize_title_with_claude(title, full_text):
    """Optimize title to 4-10 words"""
    if not CLAUDE_API_KEY or CLAUDE_API_KEY == 'your-api-key-here':
        return title
    
    word_count = len(title.split())
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
            
            optimized_word_count = len(optimized_title.split())
            if 4 <= optimized_word_count <= 10:
                return optimized_title
                
    except Exception as e:
        pass
    
    return title

# ==================== MAIN GENERATION ====================
def generate_part1_breaking_news():
    """Generate Part 1: Breaking News (every 5 minutes)"""
    print("🔴 TEN NEWS - PART 1: BREAKING NEWS GENERATOR")
    print("=" * 60)
    print(f"⏰ {get_formatted_timestamp()}")
    print("=" * 60)
    
    last_run = get_last_run_time()
    minutes_since_last = int((datetime.now() - last_run).total_seconds() / 60)
    print(f"📅 Last run: {last_run.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"⏱️  Time window: Last {minutes_since_last} minutes")
    
    # Fetch from all 12 breaking news sources
    print(f"\n🚨 Fetching from {len(BREAKING_NEWS_SOURCES)} breaking news sources...")
    all_articles = []
    
    for source in BREAKING_NEWS_SOURCES:
        print(f"   📰 {source}...", end=" ")
        articles = fetch_from_source(source, minutes_ago=minutes_since_last)
        if articles:
            all_articles.extend(articles)
            print(f"✅ {len(articles)} articles")
        else:
            print("❌ No articles")
        time.sleep(0.5)
    
    print(f"\n📊 Total articles collected: {len(all_articles)}")
    
    if not all_articles:
        print("❌ No articles found!")
        save_last_run_time()
        return None
    
    # Smart deduplication
    unique_articles = smart_deduplicate_with_best_images(all_articles)
    
    # Extract full text
    print(f"\n📖 Extracting full text from {len(unique_articles)} articles...")
    articles_with_text = []
    
    for i, article in enumerate(unique_articles, 1):
        print(f"   [{i}/{len(unique_articles)}] {article.get('title', '')[:60]}...", end=" ")
        
        full_text = extract_full_text(article['url'])
        if full_text:
            article['full_text'] = full_text
            articles_with_text.append(article)
            print(f"✅ {len(full_text)} chars")
        else:
            print("❌ Failed")
    
    print(f"\n   ✅ Successfully extracted {len(articles_with_text)}/{len(unique_articles)} articles")
    
    if not articles_with_text:
        print("❌ No articles with full text!")
        save_last_run_time()
        return None
    
    # AI scoring (UNIFIED: 70+ threshold)
    scores = score_articles_unified(articles_with_text, GOOGLE_API_KEY, part_name="Part 1: Breaking")
    quality_articles = apply_unified_scores(articles_with_text, scores, score_threshold=70)
    
    if not quality_articles:
        print("❌ No articles meet STRICT quality threshold (70+ points)!")
        print("   This is NORMAL - most days will have few or ZERO qualifying articles.")
        save_last_run_time()
        return None
    
    # Claude AI rewriting
    print(f"\n✍️  Rewriting {len(quality_articles)} articles with Claude AI...")
    final_articles = []
    
    for i, article in enumerate(quality_articles, 1):
        print(f"   [{i}/{len(quality_articles)}] {article.get('title', '')[:60]}...")
        
        # Rewrite summary
        rewritten = rewrite_article_with_claude(article)
        if rewritten:
            article['rewritten_text'] = rewritten
            article['word_count'] = len(rewritten.split())
            print(f"      ✅ Summary ({article['word_count']} words)")
            
            # Optimize title
            optimized_title = optimize_title_with_claude(article.get('title', ''), article.get('full_text', ''))
            if optimized_title != article.get('title', ''):
                article['title'] = optimized_title
                article['original_title'] = article.get('title', '')
                print(f"      ✅ Title ({len(optimized_title.split())} words)")
            
            final_articles.append(article)
        
        time.sleep(1.5)
    
    print(f"\n   ✅ Successfully processed {len(final_articles)} articles")
    
    if not final_articles:
        print("❌ No articles after rewriting!")
        save_last_run_time()
        return None
    
    # Save output
    output_data = {
        'generatedAt': datetime.now().isoformat(),
        'displayTimestamp': get_formatted_timestamp(),
        'part': 1,
        'description': 'Breaking News (Every 5 minutes)',
        'sources_count': len(BREAKING_NEWS_SOURCES),
        'totalArticles': len(final_articles),
        'articles': final_articles
    }
    
    timestamp = datetime.now().strftime('%Y_%m_%d_%H%M')
    filename = f"part1_breaking_{timestamp}.json"
    
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n{'='*60}")
    print(f"✅ SUCCESS! Saved: {filename}")
    print(f"📰 Total articles: {len(final_articles)}")
    print(f"📊 Score range: {min(a['overall_score'] for a in final_articles):.1f} - {max(a['overall_score'] for a in final_articles):.1f}")
    print("=" * 60)
    
    save_last_run_time()
    return filename

# ==================== MAIN ====================
if __name__ == "__main__":
    print("\n🔴 PART 1: BREAKING NEWS GENERATOR")
    print("Runs every 5 minutes | 12 premium sources | Strict 8.0+ threshold")
    print("=" * 60)
    print()
    
    result = generate_part1_breaking_news()
    
    if result:
        print(f"\n🎉 Part 1 complete!")
        print(f"📄 Output: {result}")
    else:
        print(f"\n⚠️ Part 1 completed with no articles.")

