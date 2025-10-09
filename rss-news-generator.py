#!/usr/bin/env python3
# TEN NEWS - RSS-BASED LIVE NEWS GENERATOR
# Fetches from ~80 RSS feeds globally
# Runs continuously, updating tennews_data_live.json

import feedparser
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
from rss_sources import RSS_FEEDS

# ==================== API KEY CONFIGURATION ====================
CLAUDE_API_KEY = os.environ.get('CLAUDE_API_KEY', 'your-api-key-here')
GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY', 'your-google-api-key-here')
PERPLEXITY_API_KEY = os.environ.get('PERPLEXITY_API_KEY', 'your-perplexity-key-here')

# Model Configuration
CLAUDE_MODEL = "claude-3-5-sonnet-20241022"
GEMINI_MODEL = "gemini-2.0-flash-exp"

# Configure Gemini
if GOOGLE_API_KEY and GOOGLE_API_KEY != 'your-google-api-key-here':
    genai.configure(api_key=GOOGLE_API_KEY)

# Configure Perplexity (uses OpenAI SDK)
from openai import OpenAI
PERPLEXITY_MODEL = "sonar"
if PERPLEXITY_API_KEY and PERPLEXITY_API_KEY != 'your-perplexity-key-here':
    perplexity_client = OpenAI(
        api_key=PERPLEXITY_API_KEY,
        base_url="https://api.perplexity.ai"
    )
else:
    perplexity_client = None

# ==================== CONFIGURATION ====================
RUN_FREQUENCY_MINUTES = 15  # How often to fetch new articles
TIMESTAMP_FILE = "rss_last_run.json"
OUTPUT_FILE = "tennews_data_live.json"

# ==================== TIMESTAMP TRACKING ====================
def get_last_run_time():
    """Get timestamp of last run"""
    try:
        if os.path.exists(TIMESTAMP_FILE):
            with open(TIMESTAMP_FILE, 'r') as f:
                data = json.load(f)
                return datetime.fromisoformat(data['last_run'])
    except Exception as e:
        print(f"⚠️  Could not read last run time: {str(e)}")
    
    # Default to RUN_FREQUENCY_MINUTES ago
    return datetime.now() - timedelta(minutes=RUN_FREQUENCY_MINUTES)

def save_last_run_time():
    """Save current timestamp"""
    try:
        with open(TIMESTAMP_FILE, 'w') as f:
            json.dump({'last_run': datetime.now().isoformat()}, f)
    except Exception as e:
        print(f"⚠️  Could not save run time: {str(e)}")

# ==================== UTILITY FUNCTIONS ====================
def clean_text_for_json(text):
    """Clean text to be JSON-safe"""
    if not text:
        return ""
    
    text = str(text)
    text = text.replace('"', "'")
    text = text.replace('\\', '\\\\')
    text = text.replace('\n', ' ')
    text = text.replace('\r', '')
    text = text.replace('\t', ' ')
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def get_formatted_timestamp():
    """Get user-friendly timestamp"""
    uk_tz = pytz.timezone('Europe/London')
    now_uk = datetime.now(uk_tz)
    return now_uk.strftime('%A, %B %d, %Y at %H:%M BST')

# ==================== RSS FETCHING ====================
def fetch_from_rss_feed(feed_url, source_name, cutoff_time):
    """
    Fetch articles from a single RSS feed
    Only return articles published after cutoff_time
    """
    articles = []
    
    try:
        # Fetch RSS feed using requests (better SSL handling)
        headers = {'User-Agent': 'Mozilla/5.0 (compatible; TenNewsBot/1.0)'}
        response = requests.get(feed_url, headers=headers, timeout=10, verify=True)
        response.raise_for_status()
        
        # Parse RSS feed
        feed = feedparser.parse(response.content)
        
        # Check for errors
        if feed.bozo:
            # Bozo bit set means there was an issue
            return []
        
        # Process entries
        for entry in feed.entries:
            try:
                # Get publication time
                pub_date = None
                if hasattr(entry, 'published_parsed') and entry.published_parsed:
                    pub_date = datetime(*entry.published_parsed[:6])
                elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
                    pub_date = datetime(*entry.updated_parsed[:6])
                
                # Check if article is recent enough
                if pub_date and pub_date >= cutoff_time:
                    article = {
                        'source': {'name': source_name},
                        'title': clean_text_for_json(entry.get('title', '')),
                        'description': clean_text_for_json(entry.get('summary', '') or entry.get('description', '')),
                        'url': entry.get('link', ''),
                        'urlToImage': extract_image_from_entry(entry),
                        'publishedAt': pub_date.isoformat() + 'Z',
                        'content': None  # Will extract later
                    }
                    
                    # Only add if we have title and URL
                    if article['title'] and article['url']:
                        articles.append(article)
                        
            except Exception as e:
                # Skip problematic entries
                continue
        
        if articles:
            print(f"   ✅ {source_name}: {len(articles)} articles")
        else:
            print(f"   ⚠️ {source_name}: 0 new articles")
            
        return articles
        
    except Exception as e:
        print(f"   ❌ {source_name}: {str(e)[:50]}")
        return []

def extract_image_from_entry(entry):
    """Try to extract an image URL from RSS entry"""
    # Try media:content
    if hasattr(entry, 'media_content') and entry.media_content:
        return entry.media_content[0].get('url', '')
    
    # Try media:thumbnail
    if hasattr(entry, 'media_thumbnail') and entry.media_thumbnail:
        return entry.media_thumbnail[0].get('url', '')
    
    # Try enclosure
    if hasattr(entry, 'enclosures') and entry.enclosures:
        for enclosure in entry.enclosures:
            if 'image' in enclosure.get('type', ''):
                return enclosure.get('href', '')
    
    # Try to find image in content
    if hasattr(entry, 'content'):
        content_html = entry.content[0].get('value', '')
        soup = BeautifulSoup(content_html, 'html.parser')
        img = soup.find('img')
        if img and img.get('src'):
            return img.get('src')
    
    return ''

# ==================== FULL TEXT EXTRACTION ====================
def extract_full_text(url):
    """Extract full article text from URL"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Remove scripts, styles, ads
        for element in soup(['script', 'style', 'nav', 'footer', 'aside', 'iframe']):
            element.decompose()
        
        # Try to find article content
        article_selectors = [
            'article', '[role="article"]', '.article-content', '.article-body',
            '.post-content', '.entry-content', '.content', 'main'
        ]
        
        article_text = ''
        for selector in article_selectors:
            content = soup.select_one(selector)
            if content:
                paragraphs = content.find_all('p')
                article_text = ' '.join([p.get_text() for p in paragraphs])
                if len(article_text) > 500:  # Minimum viable length
                    break
        
        # Fallback: all paragraphs
        if len(article_text) < 500:
            paragraphs = soup.find_all('p')
            article_text = ' '.join([p.get_text() for p in paragraphs])
        
        # Clean text
        article_text = re.sub(r'\s+', ' ', article_text).strip()
        
        # Limit length
        if len(article_text) > 5000:
            article_text = article_text[:5000]
        
        return article_text if len(article_text) > 300 else None
        
    except Exception as e:
        return None

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
            
            unique_articles.append(best_article)
    
    print(f"   ✅ Reduced from {len(articles)} to {len(unique_articles)} articles")
    return unique_articles

# ==================== CLAUDE AI REWRITING ====================
def rewrite_article_with_claude(title, full_text):
    """Rewrite article to 35-40 words using Claude"""
    if not CLAUDE_API_KEY or CLAUDE_API_KEY == 'your-api-key-here':
        return None
    
    prompt = f"""Rewrite this news article into a clear, engaging summary of EXACTLY 35-40 words (+/- 2 tolerance).

ARTICLE TITLE: {title}

FULL ARTICLE TEXT:
{full_text[:3000]}

REQUIREMENTS:
- MUST be between 33-42 words (strictly enforce)
- Write in present tense
- Be factual and objective
- Capture the main point
- No clickbait or sensationalism

Return ONLY the rewritten summary, nothing else."""

    url = f"https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    data = {
        "model": CLAUDE_MODEL,
        "max_tokens": 150,
        "messages": [{
            "role": "user",
            "content": prompt
        }]
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
    
    prompt = f"""Create a clear, newsworthy title (4-10 words) for this article.

ORIGINAL TITLE: {title}

ARTICLE TEXT:
{full_text[:1500]}

REQUIREMENTS:
- MUST be 4-10 words
- Clear and direct
- No clickbait
- Capture main point

Return ONLY the title, nothing else."""

    url = f"https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    data = {
        "model": CLAUDE_MODEL,
        "max_tokens": 50,
        "messages": [{
            "role": "user",
            "content": prompt
        }]
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

# ==================== RESEARCH ENHANCEMENT ====================
def enhance_article_with_research(article, article_num, total_articles):
    """Add timeline, details, and bold markup using Claude AI"""
    print(f"   📚 [{article_num}/{total_articles}] Researching: {article.get('title', '')[:50]}...")
    
    if not CLAUDE_API_KEY or CLAUDE_API_KEY == 'your-api-key-here':
        return article
    
    title = article.get('title', '')
    summary = article.get('summary_text', '')
    full_text = article.get('full_text', '')[:2000]
    
    prompt = f"""You are enhancing a news article with additional details.

ARTICLE:
Title: {title}
Summary: {summary}
Full Text: {full_text}

Create a JSON response with:
1. "summary_bold": The summary text with **bold** markup on 2-3 key terms (names, numbers, key concepts)
2. "timeline": Array of 2-4 timeline events {{date, event}}
3. "details": Array of 3 detail items {{label, value, icon}} - focus on numbers, dates, key facts
4. "title_bold": The title with **bold** markup on 1-2 key terms

Return ONLY valid JSON, no markdown blocks."""

    url = f"https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    data = {
        "model": CLAUDE_MODEL,
        "max_tokens": 800,
        "messages": [{
            "role": "user",
            "content": prompt
        }]
    }
    
    try:
        response = requests.post(url, headers=headers, json=data, timeout=45)
        
        if response.status_code == 200:
            result = response.json()
            response_text = result['content'][0]['text'].strip()
            
            # Parse JSON response
            if response_text.startswith('```json'):
                response_text = response_text[7:]
            if response_text.startswith('```'):
                response_text = response_text[3:]
            if response_text.endswith('```'):
                response_text = response_text[:-3]
            response_text = response_text.strip()
            
            try:
                parsed = json.loads(response_text)
                
                # Apply enhancements
                if 'summary_bold' in parsed:
                    article['summary_text'] = clean_text_for_json(parsed['summary_bold'])
                
                if 'timeline' in parsed and isinstance(parsed['timeline'], list):
                    article['timeline'] = [
                        {
                            'date': clean_text_for_json(item.get('date', '')),
                            'event': clean_text_for_json(item.get('event', ''))
                        }
                        for item in parsed['timeline'][:4]
                    ]
                
                if 'details' in parsed and isinstance(parsed['details'], list):
                    article['details'] = [
                        {
                            'label': clean_text_for_json(item.get('label', '')),
                            'value': clean_text_for_json(item.get('value', '')),
                            'icon': item.get('icon', '📊')
                        }
                        for item in parsed['details'][:3]
                    ]
                
                if 'title_bold' in parsed:
                    article['title'] = clean_text_for_json(parsed['title_bold'])
                
                print(f"      ✅ Enhanced")
                
            except json.JSONDecodeError:
                print(f"      ⚠️ JSON parse error")
        else:
            print(f"      ⚠️ API error {response.status_code}")
            
    except Exception as e:
        print(f"      ⚠️ Error: {str(e)[:50]}")
    
    return article

# ==================== MAIN GENERATION FUNCTION ====================
def generate_rss_news():
    """Main function to generate news from RSS feeds"""
    
    print("\n" + "=" * 60)
    print("🌍 TEN NEWS - RSS LIVE NEWS GENERATOR")
    print("=" * 60)
    print(f"⏰ {get_formatted_timestamp()}")
    print("=" * 60)
    
    # Get time window
    last_run = get_last_run_time()
    current_time = datetime.now()
    time_diff_minutes = int((current_time - last_run).total_seconds() / 60)
    
    print(f"📅 Last run: {last_run.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"⏱️  Time window: Last {time_diff_minutes} minutes")
    print()
    
    # Fetch from all RSS feeds
    print(f"📡 Fetching from {len(RSS_FEEDS)} RSS feeds...")
    print(f"   This will take ~5-10 minutes...")
    print()
    
    all_articles = []
    sources_with_articles = 0
    
    for source_name, feed_url in RSS_FEEDS.items():
        articles = fetch_from_rss_feed(feed_url, source_name, last_run)
        if articles:
            all_articles.extend(articles)
            sources_with_articles += 1
        time.sleep(0.5)  # Rate limiting
    
    print()
    print("📊 Fetch complete:")
    print(f"   ✅ {sources_with_articles} sources returned articles")
    print(f"   ❌ {len(RSS_FEEDS) - sources_with_articles} sources returned nothing")
    print(f"   📰 Total articles: {len(all_articles)}")
    
    if len(all_articles) == 0:
        print("\n❌ No articles found!")
        print("⚠️  Completed with no articles.")
        save_last_run_time()
        return None
    
    # Deduplicate
    unique_articles = smart_deduplicate_with_best_images(all_articles)
    
    # Extract full text
    print(f"\n📖 Extracting full text from {len(unique_articles)} articles...")
    articles_with_text = []
    
    for i, article in enumerate(unique_articles, 1):
        print(f"   [{i}/{len(unique_articles)}] {article.get('title', '')[:50]}...")
        full_text = extract_full_text(article['url'])
        if full_text:
            article['full_text'] = full_text
            articles_with_text.append(article)
        else:
            print(f"      ⚠️ Skipped (couldn't extract text)")
    
    print(f"\n   ✅ Successfully extracted text from {len(articles_with_text)} articles")
    
    if len(articles_with_text) == 0:
        print("\n❌ No articles with extractable text!")
        save_last_run_time()
        return None
    
    # AI Scoring
    scores = score_articles_unified(articles_with_text, GOOGLE_API_KEY, "RSS Feed")
    if not scores:
        print("\n❌ AI scoring failed!")
        save_last_run_time()
        return None
    
    # Apply scores and filter
    qualified_articles = apply_unified_scores(articles_with_text, scores, score_threshold=60)
    
    if len(qualified_articles) == 0:
        print("\n❌ No articles passed the 60-point threshold!")
        save_last_run_time()
        return None
    
    print(f"\n✅ {len(qualified_articles)} articles qualified (60+ points)")
    
    # Claude rewriting
    print(f"\n✍️  CLAUDE AI REWRITING")
    print("=" * 60)
    print(f"   Rewriting {len(qualified_articles)} articles (35-40 words)...")
    
    final_articles = []
    for i, article in enumerate(qualified_articles, 1):
        print(f"   [{i}/{len(qualified_articles)}] {article.get('title', '')[:40]}...")
        
        # Rewrite summary
        rewritten = rewrite_article_with_claude(article['title'], article.get('full_text', ''))
        if rewritten:
            article['summary_text'] = rewritten
            article['summary'] = rewritten
            print(f"      ✅ Rewritten ({len(rewritten.split())} words)")
        else:
            # Fallback to description
            article['summary_text'] = article.get('description', '')[:200]
            article['summary'] = article['summary_text']
            print(f"      ⚠️ Using fallback")
        
        # Optimize title
        optimized_title = optimize_title_with_claude(article['title'], article.get('full_text', ''))
        article['title'] = optimized_title
        
        final_articles.append(article)
        time.sleep(1)  # Rate limiting
    
    print(f"\n   ✅ Rewriting complete!")
    
    # Research enhancement
    print(f"\n📚 RESEARCH ENHANCEMENT")
    print("=" * 60)
    print(f"   Adding timeline, details, and bold markup...")
    
    enhanced_articles = []
    for i, article in enumerate(final_articles, 1):
        enhanced = enhance_article_with_research(article, i, len(final_articles))
        enhanced_articles.append(enhanced)
        time.sleep(1)
    
    print(f"\n   ✅ Enhancement complete!")
    final_articles = enhanced_articles
    
    # Update live file
    print(f"\n💾 UPDATING LIVE FILE")
    print("=" * 60)
    
    # Read existing articles
    existing_articles = []
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
                existing_articles = existing_data.get('articles', [])
                print(f"   📖 Found {len(existing_articles)} existing articles")
        except Exception as e:
            print(f"   ⚠️ Could not read existing file: {e}")
    
    # Add source tag and timestamp
    for article in final_articles:
        article['source_part'] = 'rss'
        article['added_at'] = datetime.now().isoformat()
    
    # Combine and sort by score
    all_articles_combined = existing_articles + final_articles
    all_articles_combined.sort(key=lambda x: x.get('final_score', 0), reverse=True)
    
    # Create output
    output_data = {
        'generatedAt': datetime.now().isoformat(),
        'displayTimestamp': get_formatted_timestamp(),
        'lastUpdate': {
            'source': 'rss',
            'timestamp': datetime.now().isoformat(),
            'articlesAdded': len(final_articles)
        },
        'totalArticles': len(all_articles_combined),
        'articles': all_articles_combined
    }
    
    # Save
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n{'='*60}")
    print(f"✅ SUCCESS!")
    print(f"📰 Added {len(final_articles)} new articles")
    print(f"📊 Total articles in live feed: {len(all_articles_combined)}")
    if final_articles:
        scores_list = [a['final_score'] for a in final_articles]
        print(f"📈 New articles score range: {min(scores_list):.1f} - {max(scores_list):.1f}")
    print("=" * 60)
    
    save_last_run_time()
    return OUTPUT_FILE

# ==================== RUN ====================
if __name__ == "__main__":
    try:
        generate_rss_news()
    except KeyboardInterrupt:
        print("\n\n⚠️  Stopped by user")
    except Exception as e:
        print(f"\n\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

