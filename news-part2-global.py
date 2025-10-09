# TEN NEWS - PART 2: SCIENCE, RESEARCH & GLOBAL NEWS GENERATOR
# Runs every 50 minutes
# Queries 123 global sources across all categories and regions
# Time-based filtering: Only news from last 50 minutes

import requests
import json
from datetime import datetime, timedelta
import time
import os
import pytz
import re
from bs4 import BeautifulSoup
import google.generativeai as genai
from unified_news_scoring import score_articles_unified, apply_unified_scores

# ==================== API KEY CONFIGURATION ====================
NEWSAPI_KEY = os.environ.get('NEWSAPI_KEY', 'your-newsapi-key-here')
CLAUDE_API_KEY = os.environ.get('CLAUDE_API_KEY', 'your-api-key-here')
GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY', 'your-google-api-key-here')

CLAUDE_MODEL = "claude-3-5-sonnet-20241022"
GEMINI_MODEL = "gemini-1.5-flash-latest"

if GOOGLE_API_KEY and GOOGLE_API_KEY != 'your-google-api-key-here':
    genai.configure(api_key=GOOGLE_API_KEY)

# ==================== PART 2 SOURCES (123) ====================
GLOBAL_NEWS_SOURCES = [
    # SCIENCE & RESEARCH (3)
    'new-scientist',
    'national-geographic',
    'medical-news-today',
    
    # TECHNOLOGY & INNOVATION (15)
    'wired',
    'ars-technica',
    'techcrunch',
    'the-verge',
    'engadget',
    'the-next-web',
    'techradar',
    'hacker-news',
    'recode',
    'crypto-coins-news',
    'next-big-future',
    'mashable',
    'vice-news',
    'buzzfeed',
    'ign',
    
    # BUSINESS & ECONOMICS (12)
    'the-economist',
    'financial-times',
    'fortune',
    'business-insider',
    'cnbc',
    'australian-financial-review',
    'handelsblatt',
    'forbes',
    'business-insider-uk',
    'financial-post',
    'les-echos',
    'il-sole-24-ore',
    
    # DATA JOURNALISM & ANALYSIS (5)
    'fivethirtyeight',
    'axios',
    'politico',
    'the-hill',
    'newsweek',
    
    # PREMIUM US NEWS SOURCES (10)
    'the-new-york-times',
    'npr',
    'time',
    'the-atlantic',
    'the-new-yorker',
    'new-york-magazine',
    'msnbc',
    'the-american-conservative',
    'national-review',
    'breitbart-news',
    
    # UNITED KINGDOM & IRELAND (10)
    'the-independent',
    'the-telegraph',
    'daily-mail',
    'mirror',
    'metro',
    'the-lad-bible',
    'the-irish-times',
    'rte',
    'the-sport-bible',
    'google-news-uk',
    
    # GERMANY (10)
    'spiegel-online',
    'der-tagesspiegel',
    'die-zeit',
    'focus',
    'bild',
    'gruenderszene',
    't3n',
    'wirtschafts-woche',
    # Note: 'handelsblatt' already in business section
    'google-news-de',
    
    # FRANCE (6)
    'le-monde',
    'liberation',
    # Note: 'les-echos' already in business section
    'lequipe',
    'google-news-fr',
    
    # ITALY (5)
    'la-repubblica',
    'ansa',
    # Note: 'il-sole-24-ore' already in business section
    'la-gazzetta-dello-sport',
    'google-news-it',
    
    # SPAIN & PORTUGAL (3)
    'el-pais',
    'google-news-es',
    'google-news-pt',
    
    # INDIA (5)
    'the-times-of-india',
    'the-hindu',
    'google-news-in',
    'ndtv',
    'india-today',
    
    # CHINA & EAST ASIA (7)
    'xinhua',
    'south-china-morning-post',
    'the-japan-times',
    'nikkei-asia',
    'the-korea-herald',
    'the-straits-times',
    'bangkok-post',
    
    # AUSTRALIA & NEW ZEALAND (5)
    'abc-news-au',
    'news-com-au',
    'the-sydney-morning-herald',
    'google-news-au',
    'the-age',
    
    # MIDDLE EAST (7)
    # Note: 'al-jazeera-english' in Part 1
    'haaretz',
    'the-jerusalem-post',
    'ynet',
    'al-arabiya',
    'sabq',
    'google-news-sa',
    
    # AFRICA (4)
    'news24',
    'daily-maverick',
    'the-east-african',
    'african-news',
    
    # LATIN AMERICA (5)
    'globo',
    'google-news-br',
    'infobae',
    'google-news-ar',
    'el-universal',
    
    # CANADA (3)
    'the-globe-and-mail',
    'cbc-news',
    'google-news-ca',
    
    # SCANDINAVIA (4)
    'aftenposten',
    'svenska-dagbladet',
    'politiken',
    'helsingin-sanomat',
    
    # RUSSIA & EASTERN EUROPE (3)
    'rt',
    'meduza',
    'prague-post',
    
    # INTERNATIONAL AGGREGATORS (1)
    'google-news'
]

# ==================== TIMESTAMP TRACKING ====================
TIMESTAMP_FILE_PART2 = "part2_last_run.json"

def get_last_run_time():
    """Get timestamp of last Part 2 run"""
    try:
        if os.path.exists(TIMESTAMP_FILE_PART2):
            with open(TIMESTAMP_FILE_PART2, 'r') as f:
                data = json.load(f)
                return datetime.fromisoformat(data['last_run'])
    except Exception as e:
        print(f"⚠️ Could not read last run time: {str(e)}")
    
    # Default to 50 minutes ago
    return datetime.now() - timedelta(minutes=50)

def save_last_run_time():
    """Save current timestamp"""
    try:
        with open(TIMESTAMP_FILE_PART2, 'w') as f:
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
def fetch_from_source(source_id, minutes_ago=50):
    """Fetch articles from a specific source (last X minutes)"""
    if not NEWSAPI_KEY or NEWSAPI_KEY == 'your-newsapi-key-here':
        return []
    
    now = datetime.now()
    from_time = now - timedelta(minutes=minutes_ago)
    from_param = from_time.strftime('%Y-%m-%dT%H:%M:%S')
    
    url = "https://newsapi.org/v2/everything"
    params = {
        'apiKey': NEWSAPI_KEY,
        'sources': source_id,
        'from': from_param,
        'language': 'en',
        'sortBy': 'publishedAt',
        'pageSize': 5  # Less per source for Part 2 (123 sources!)
    }
    
    try:
        response = requests.get(url, params=params, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            articles = data.get('articles', [])
            return articles
        else:
            return []
            
    except Exception as e:
        return []

# ==================== SMART DEDUPLICATION ====================
def smart_deduplicate_with_best_images(articles):
    """Remove duplicate articles, keep best image"""
    if len(articles) <= 1:
        return articles
    
    article_groups = {}
    
    for article in articles:
        title = article.get('title', '').lower()
        title_normalized = re.sub(r'[^a-z0-9\s]', '', title)
        title_words = set(title_normalized.split())
        
        matched_group = None
        for group_key, group_articles in article_groups.items():
            group_words = set(group_key.split())
            
            if title_words and group_words:
                overlap = len(title_words & group_words) / max(len(title_words), len(group_words))
                if overlap > 0.6:
                    matched_group = group_key
                    break
        
        if matched_group:
            article_groups[matched_group].append(article)
        else:
            article_groups[title_normalized] = [article]
    
    unique_articles = []
    
    for group_key, group in article_groups.items():
        if len(group) == 1:
            unique_articles.append(group[0])
        else:
            available_images = [a.get('urlToImage', '') for a in group if a.get('urlToImage')]
            best_image = available_images[0] if available_images else ''
            
            best_article = max(group, key=lambda a: len(a.get('description', '')))
            
            if best_image and best_image != best_article.get('urlToImage', ''):
                best_article['urlToImage'] = best_image
            
            unique_articles.append(best_article)
    
    print(f"   ✅ Deduplication: {len(articles)} → {len(unique_articles)} articles")
    return unique_articles

# ==================== AI SCORING ====================
def score_articles_with_gemini(articles):
    """Score articles with Gemini (global focus, diverse topics)"""
    if not GOOGLE_API_KEY or GOOGLE_API_KEY == 'your-google-api-key-here':
        print("⚠️ Google API key not configured")
        return None
    
    print(f"\n🤖 Scoring {len(articles)} articles with Gemini AI...")
    
    articles_info = []
    for i, article in enumerate(articles[:50], 1):
        articles_info.append({
            'id': i,
            'title': article.get('title', '')[:150],
            'description': article.get('description', '')[:300],
            'full_text_preview': article.get('full_text', '')[:500] if article.get('full_text') else '',
            'source': article.get('source', {}).get('name', '')
        })
    
    prompt = f"""You are a news editor for a global news service covering science, technology, business, and world affairs.

**GLOBAL FOCUS**: Equal weight to ALL countries and regions. Judge by GLOBAL IMPACT and QUALITY.

**SCORING CRITERIA**:

1. **Importance** (1-10):
   - 9-10: Groundbreaking discoveries, major breakthroughs, significant global developments
   - 7-8: Important regional/national events, notable advancements
   - 5-6: Interesting updates in ongoing stories
   - 1-4: Routine announcements, minor updates

2. **World Relevance** (1-10):
   - 9-10: Universal interest, affects many countries/industries
   - 7-8: Regional significance with broader implications
   - 5-6: National interest with international angle
   - 1-4: Purely local interest

3. **Interestingness** (1-10):
   - 9-10: Surprising, unprecedented, highly compelling
   - 7-8: Notable human interest, fascinating developments
   - 5-6: Solid newsworthy content
   - 1-4: Routine, predictable

**QUALITY THRESHOLD**: Recommend articles scoring **7.5+ overall**

**EMOJI SELECTION**: Choose the most relevant emoji from all available options

Return ONLY valid JSON (no markdown):
{{
  "scored_articles": [
    {{
      "id": 1,
      "importance": 8,
      "world_relevance": 7,
      "interestingness": 8,
      "overall_score": 7.7,
      "emoji": "🔬",
      "category": "Science",
      "brief_reasoning": "Why these scores"
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
                print(f"   ✅ Scored {len(scored)} articles")
                return scored
                
    except Exception as e:
        print(f"   ⚠️ Gemini error: {str(e)[:100]}")
    
    return None

def apply_ai_scores(articles, scores, score_threshold=7.5):
    """Apply AI scores and filter by threshold (7.5+)"""
    if not scores:
        print("   ⚠️ No AI scores - skipping all articles")
        return []
    
    score_map = {score['id']: score for score in scores}
    scored_articles = []
    
    for i, article in enumerate(articles[:50], 1):
        if i in score_map:
            score_data = score_map[i]
            
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
            
            if overall >= score_threshold:
                scored_articles.append(article)
    
    scored_articles.sort(key=lambda x: x['overall_score'], reverse=True)
    
    print(f"   ✅ {len(scored_articles)} articles meet threshold ({score_threshold}+)")
    
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
    
    prompt = f"""Professional news writer. Rewrite this article.

REQUIREMENTS:
1. **STRICT: 35-40 words** (+/- 2 tolerance)
2. Read full text carefully
3. Clear, engaging style
4. Key facts only
5. Plain text, no bold

TITLE: {title}

TEXT:
{full_text[:3000]}

Return ONLY rewritten text (35-40 words)."""
    
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
    except:
        pass
    
    return None

def optimize_title_with_claude(title, full_text):
    """Optimize title (4-10 words)"""
    if not CLAUDE_API_KEY or CLAUDE_API_KEY == 'your-api-key-here':
        return title
    
    word_count = len(title.split())
    if 4 <= word_count <= 10:
        return title
    
    prompt = f"""Professional headline writer. Create concise headline.

REQUIREMENTS:
1. **4-10 words exactly**
2. Clear and engaging
3. Active voice
4. No clickbait

ORIGINAL: {title}

CONTEXT:
{full_text[:500]}

Return ONLY headline (4-10 words)."""
    
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
            optimized = result['content'][0]['text'].strip()
            optimized = clean_text_for_json(optimized)
            
            if 4 <= len(optimized.split()) <= 10:
                return optimized
    except:
        pass
    
    return title

# ==================== MAIN GENERATION ====================
def generate_part2_global_news():
    """Generate Part 2: Science, Research & Global News (every 50 minutes)"""
    print("🌍 TEN NEWS - PART 2: GLOBAL NEWS GENERATOR")
    print("=" * 60)
    print(f"⏰ {get_formatted_timestamp()}")
    print("=" * 60)
    
    last_run = get_last_run_time()
    minutes_since_last = int((datetime.now() - last_run).total_seconds() / 60)
    print(f"📅 Last run: {last_run.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"⏱️  Time window: Last {minutes_since_last} minutes")
    
    # Fetch from all 123 sources
    print(f"\n🌐 Fetching from {len(GLOBAL_NEWS_SOURCES)} global sources...")
    print("This will take ~10-15 minutes (rate limiting)...")
    
    all_articles = []
    success_count = 0
    fail_count = 0
    
    for i, source in enumerate(GLOBAL_NEWS_SOURCES, 1):
        articles = fetch_from_source(source, minutes_ago=minutes_since_last)
        if articles:
            all_articles.extend(articles)
            success_count += 1
            if i % 10 == 0:
                print(f"   Progress: {i}/{len(GLOBAL_NEWS_SOURCES)} sources ({success_count} successful)")
        else:
            fail_count += 1
        
        # Rate limiting (2 requests/second max)
        time.sleep(0.5)
    
    print(f"\n📊 Fetch complete:")
    print(f"   ✅ {success_count} sources returned articles")
    print(f"   ❌ {fail_count} sources returned nothing")
    print(f"   📰 Total articles: {len(all_articles)}")
    
    if not all_articles:
        print("❌ No articles found!")
        save_last_run_time()
        return None
    
    # Deduplication
    print(f"\n🔍 Deduplication...")
    unique_articles = smart_deduplicate_with_best_images(all_articles)
    
    # Extract full text (limit to top 100 for time)
    print(f"\n📖 Extracting full text from top {min(100, len(unique_articles))} articles...")
    articles_with_text = []
    
    for i, article in enumerate(unique_articles[:100], 1):
        if i % 10 == 0:
            print(f"   Progress: {i}/100 articles extracted")
        
        full_text = extract_full_text(article['url'])
        if full_text:
            article['full_text'] = full_text
            articles_with_text.append(article)
        
        time.sleep(0.3)
    
    print(f"\n   ✅ Extracted: {len(articles_with_text)}/100 articles")
    
    if not articles_with_text:
        print("❌ No articles with full text!")
        save_last_run_time()
        return None
    
    # AI scoring (UNIFIED: 70+ threshold)
    scores = score_articles_unified(articles_with_text, GOOGLE_API_KEY, part_name="Part 2: Global")
    quality_articles = apply_unified_scores(articles_with_text, scores, score_threshold=70)
    
    if not quality_articles:
        print("❌ No articles meet STRICT quality threshold (70+ points) in THIS RUN!")
        print("   ✅ This is COMPLETELY NORMAL - many 50-minute windows have no exceptional news.")
        print("   💡 Users see accumulated articles from ALL successful runs.")
        save_last_run_time()
        return None
    
    # Claude rewriting
    print(f"\n✍️  Rewriting {len(quality_articles)} articles...")
    final_articles = []
    
    for i, article in enumerate(quality_articles, 1):
        if i % 5 == 0:
            print(f"   Progress: {i}/{len(quality_articles)} articles rewritten")
        
        rewritten = rewrite_article_with_claude(article)
        if rewritten:
            article['rewritten_text'] = rewritten
            article['word_count'] = len(rewritten.split())
            
            optimized_title = optimize_title_with_claude(article.get('title', ''), article.get('full_text', ''))
            if optimized_title != article.get('title', ''):
                article['title'] = optimized_title
            
            final_articles.append(article)
        
        time.sleep(1.5)
    
    print(f"\n   ✅ Processed: {len(final_articles)} articles")
    
    if not final_articles:
        print("❌ No articles after rewriting!")
        save_last_run_time()
        return None
    
    # Save
    output_data = {
        'generatedAt': datetime.now().isoformat(),
        'displayTimestamp': get_formatted_timestamp(),
        'part': 2,
        'description': 'Science, Research & Global News (Every 50 minutes)',
        'sources_count': len(GLOBAL_NEWS_SOURCES),
        'totalArticles': len(final_articles),
        'articles': final_articles
    }
    
    timestamp = datetime.now().strftime('%Y_%m_%d_%H%M')
    filename = f"part2_global_{timestamp}.json"
    
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
    print("\n🌍 PART 2: GLOBAL NEWS GENERATOR")
    print("Runs every 50 minutes | 123 global sources | 7.5+ threshold")
    print("=" * 60)
    print()
    
    result = generate_part2_global_news()
    
    if result:
        print(f"\n🎉 Part 2 complete!")
        print(f"📄 Output: {result}")
    else:
        print(f"\n⚠️ Part 2 completed with no articles.")

