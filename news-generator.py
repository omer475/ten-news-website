# TEN NEWS - DAILY DIGEST GENERATOR
# Optimized for Website Integration - No Wix Dependencies

import requests
import json
from datetime import datetime, timedelta, timezone
import time
import random
import os
from bs4 import BeautifulSoup
import re
import pytz
import schedule

# ==================== API KEY CONFIGURATION ====================
CLAUDE_API_KEY = os.environ.get('CLAUDE_API_KEY', 'your-api-key-here')

# Claude Models
CLAUDE_MODEL = "claude-3-5-sonnet-20241022"
CLAUDE_SONNET_MODEL = "claude-3-5-sonnet-20241022"

# ==================== APPROVED NEWS SOURCES ====================
ALLOWED_DOMAINS = [
    "reuters.com", "apnews.com", "afp.com", "nytimes.com", "washingtonpost.com",
    "wsj.com", "usatoday.com", "cnn.com", "nbcnews.com", "abcnews.go.com",
    "cbsnews.com", "npr.org", "foxnews.com", "foxbusiness.com", "msnbc.com",
    "cnbc.com", "bloomberg.com", "marketwatch.com", "ft.com", "barrons.com",
    "fool.com", "seekingalpha.com", "bbc.com", "theguardian.com", "telegraph.co.uk",
    "thetimes.co.uk", "independent.co.uk", "euronews.com", "politico.eu", "politico.com",
    "lemonde.fr", "france24.com", "lefigaro.fr", "spiegel.de", "zeit.de",
    "welt.de", "elpais.com", "corriere.it", "japantimes.co.jp", "scmp.com",
    "straitstimes.com", "timesofindia.com", "thehindu.com", "koreaherald.com", "koreatimes.co.kr",
    "channelnewsasia.com", "asia.nikkei.com", "asiatimes.com", "thediplomat.com", "nzherald.co.nz",
    "abc.net.au", "smh.com.au", "theaustralian.com.au", "inquirer.net", "bangkokpost.com",
    "aljazeera.com", "haaretz.com", "jpost.com", "arabnews.com", "timesofisrael.com",
    "al-monitor.com", "i24news.tv", "africanews.com", "allafrica.com", "cnbcafrica.com",
    "theafricareport.com", "businessday.co.za", "african.business", "batimes.com.ar", "riotimesonline.com",
    "forbes.com", "fortune.com", "businessinsider.com", "fastcompany.com", "inc.com",
    "entrepreneur.com", "hbr.org", "techcrunch.com", "venturebeat.com", "wired.com",
    "arstechnica.com", "theverge.com", "theinformation.com", "mashable.com", "engadget.com",
    "thenextweb.com", "geekwire.com", "axios.com", "vox.com", "theintercept.com",
    "qz.com", "morningbrew.com", "finance.yahoo.com", "investing.com", "thestreet.com",
    "investors.com", "kiplinger.com", "news.crunchbase.com", "cbinsights.com", "pitchbook.com",
    "sifted.eu", "eu-startups.com", "tech.eu", "alleywatch.com", "builtin.com",
    "yourstory.com", "e27.co", "mckinsey.com", "bcg.com", "bain.com",
    "deloitte.com", "pwc.com", "sloanreview.mit.edu", "gsb.stanford.edu", "prnewswire.com",
    "businesswire.com", "industrydive.com", "nature.com", "science.org", "scientificamerican.com",
    "newscientist.com", "phys.org", "sciencedaily.com", "eurekalert.org", "livescience.com",
    "space.com", "nasa.gov", "esa.int", "arxiv.org", "plos.org",
    "cell.com", "thelancet.com", "nejm.org", "jama.jamanetwork.com", "bmj.com",
    "ieee.org", "acm.org", "kaggle.com", "datasciencecentral.com", "kdnuggets.com",
    "towardsdatascience.com", "fivethirtyeight.com", "ourworldindata.org", "statista.com", "pewresearch.org"
]

DOMAIN_FILTER = "(" + " OR ".join(ALLOWED_DOMAINS) + ")"
ALLOWED_DOMAINS_SET = set(ALLOWED_DOMAINS)

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
    if len(text) > 500:
        text = text[:497] + "..."
    
    return text

def get_formatted_date():
    """Get formatted date in UK timezone"""
    uk_tz = pytz.timezone('Europe/London')
    uk_time = datetime.now(uk_tz)
    return uk_time.strftime("%A, %B %-d, %Y").upper()

def save_historical_events(events, date):
    """Save historical events to local JSON file"""
    historical_data = {
        "date": date,
        "events": events,
        "generated_at": datetime.now().isoformat()
    }
    
    filename = f"historical_events_{datetime.now().strftime('%Y_%m_%d')}.json"
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(historical_data, f, ensure_ascii=False, indent=2)
        print(f"✅ Historical events saved: {filename}")
        return filename
    except Exception as e:
        print(f"❌ Error saving historical events: {str(e)}")
        return None

def load_previous_articles():
    """Load previous articles from local JSON files to avoid duplicates"""
    previous_articles = []
    
    # Look for JSON files from the last 7 days
    for i in range(1, 8):
        past_date = datetime.now() - timedelta(days=i)
        filename = f"tennews_data_{past_date.strftime('%Y_%m_%d')}.json"
        
        if os.path.exists(filename):
            try:
                with open(filename, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if 'articles' in data:
                        previous_articles.extend(data['articles'])
            except Exception as e:
                print(f"⚠️ Error loading {filename}: {str(e)}")
    
    print(f"📚 Loaded {len(previous_articles)} previous articles for duplicate checking")
    return previous_articles

# ==================== GDELT NEWS FETCHING ====================
def fetch_gdelt_news_last_24_hours():
    """Fetch important news from GDELT"""
    print(f"🌍 Fetching global news from GDELT...")
    print("=" * 50)
    
    all_articles = []
    url = "https://api.gdeltproject.org/api/v2/doc/doc"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    # Focused search queries for better results
    search_queries = [
        "(breaking OR urgent OR crisis OR emergency OR unprecedented)",
        "(billion OR trillion OR million OR record OR highest)",
        "(market OR stocks OR economy OR Fed OR inflation)",
        "(AI OR artificial intelligence OR technology OR breakthrough)",
        "(climate OR disaster OR attack OR conflict OR war)",
        "(announced OR launched OR revealed OR confirmed)",
        "(CEO OR merger OR acquisition OR deal)",
        "(election OR government OR diplomatic OR sanctions)"
    ]
    
    for idx, query in enumerate(search_queries, 1):
        print(f"🔍 Search {idx}/8: {query[:30]}...")
        
        params = {
            "query": query,
            "mode": "ArtList", 
            "format": "json",
            "maxrecords": "100",
            "timespan": "1d",
            "sort": "hybridrel"
        }
        
        try:
            response = requests.get(url, params=params, headers=headers, timeout=30)
            
            if response.status_code == 200:
                content = response.text
                
                if not content.startswith('<!DOCTYPE') and not content.startswith('<html'):
                    try:
                        data = json.loads(content)
                        articles = data.get('articles', [])
                        
                        valid_count = 0
                        for article in articles:
                            if article.get('title') and article.get('url'):
                                article['title'] = clean_text_for_json(article.get('title', ''))
                                all_articles.append(article)
                                valid_count += 1
                        
                        print(f"   ✓ Found {valid_count} articles")
                        
                    except json.JSONDecodeError:
                        print(f"   ❌ Failed to parse JSON")
                else:
                    print(f"   ❌ Got HTML response")
            else:
                print(f"   ❌ Error {response.status_code}")
                
            time.sleep(1)
            
        except Exception as e:
            print(f"   ❌ Error: {str(e)[:50]}")
    
    return all_articles

# ==================== DOMAIN FILTERING ====================
def extract_base_domain(url):
    """Extract base domain from URL"""
    try:
        if url.startswith('http://'):
            domain = url[7:].split('/')[0]
        elif url.startswith('https://'):
            domain = url[8:].split('/')[0]
        else:
            domain = url.split('/')[0]
        
        domain = domain.replace('www.', '')
        
        parts = domain.split('.')
        if len(parts) > 2:
            if parts[-2] in ['co', 'com', 'net', 'org', 'gov', 'edu', 'ac']:
                base_domain = '.'.join(parts[-3:])
            else:
                base_domain = '.'.join(parts[-2:])
        else:
            base_domain = domain
            
        return base_domain
    except Exception:
        return None

def deduplicate_articles(articles, processing_log=None):
    """Remove duplicates and filter by approved domains"""
    print(f"\n🔄 Processing and filtering articles...")
    unique_articles = []
    seen_urls = set()
    approved_count = 0
    rejected_count = 0
    duplicate_count = 0
    
    rejected_domains = []
    approved_domains = []
    
    for article in articles:
        url = article.get('url', '').lower()
        if url and url not in seen_urls:
            base_domain = extract_base_domain(url)
            
            if base_domain and base_domain in ALLOWED_DOMAINS_SET:
                seen_urls.add(url)
                article['domain'] = base_domain
                unique_articles.append(article)
                approved_count += 1
                if base_domain not in approved_domains:
                    approved_domains.append(base_domain)
            else:
                rejected_count += 1
                if base_domain and base_domain not in rejected_domains:
                    rejected_domains.append(base_domain)
        else:
            duplicate_count += 1
    
    print(f"- Total articles: {len(articles):,}")
    print(f"- Duplicates removed: {duplicate_count:,}")
    print(f"- From approved sources: {approved_count:,}")
    print(f"- Rejected (unapproved sources): {rejected_count:,}")
    print(f"- Unique approved: {len(unique_articles):,}")
    
    # Log detailed statistics
    if processing_log:
        processing_log["steps"]["3_filtering"] = {
            "total_input": len(articles),
            "duplicates_removed": duplicate_count,
            "approved_sources": approved_count,
            "rejected_sources": rejected_count,
            "final_unique": len(unique_articles),
            "approved_domains": approved_domains[:10],  # Top 10 domains
            "rejected_domains": rejected_domains[:10],  # Top 10 rejected
            "description": "Domain filtering and deduplication"
        }
        processing_log["statistics"]["eliminated_duplicates"] = duplicate_count
        processing_log["statistics"]["eliminated_unapproved_sources"] = rejected_count
        processing_log["statistics"]["approved_for_ai_selection"] = len(unique_articles)
    
    return unique_articles

# ==================== AI ARTICLE SELECTION ====================
def select_top_articles_with_ai(articles, previous_articles=None):
    """Use AI to select top 10 articles"""
    print("\n🤖 Using AI to select top 10 stories...")
    
    formatted_articles = []
    for i, article in enumerate(articles):
        formatted_articles.append({
            "id": i,
            "title": clean_text_for_json(article.get('title', '')),
            "url": article.get('url', ''),
            "domain": article.get('domain', '')
        })
    
    # Create context about previous articles
    previous_context = ""
    if previous_articles:
        previous_titles = [clean_text_for_json(prev.get('title', '')) for prev in previous_articles[:10]]
        if previous_titles:
            previous_context = f"""
PREVIOUS ARTICLES TO AVOID:
{json.dumps(previous_titles, indent=2)}

Rule: Avoid selecting duplicates or minor updates of these stories.
"""
    
    prompt = f"""You MUST select EXACTLY 10 most important global news stories from the provided list. If there are fewer than 10 suitable stories, select the best available ones and fill to reach exactly 10.

{previous_context}

MANDATORY REQUIREMENTS:
1. MUST return exactly 10 articles in the JSON response
2. If fewer than 10 high-quality articles exist, include the best available ones to reach 10
3. Global Impact: Prioritize stories affecting millions worldwide
4. Breaking/Significant: Major developments over routine updates
5. Balance: Mix categories (politics, business, technology, science, climate, health)
6. Avoid: Personal stories, local news only, minor updates, duplicates

CRITICAL: Your response must contain exactly 10 articles. No exceptions.

Return ONLY this JSON structure:
{{
  "selected_articles": [
    {{
      "id": 0,
      "title": "exact title",
      "url": "exact url", 
      "category": "World News/Business/Technology/Science/Climate/Health",
      "selection_reason": "Brief reason for selection"
    }}
  ]
}}

ARTICLES TO EVALUATE:
{json.dumps(formatted_articles, indent=2)}"""
    
    response = call_claude_api(prompt, "Selecting top articles")
    
    if response:
        try:
            parsed = parse_json_with_fallback(response)
            if parsed and 'selected_articles' in parsed:
                selected = parsed['selected_articles']
                print(f"✅ AI selected {len(selected)} articles")
                return selected
        except Exception as e:
            print(f"⚠️ Error parsing selection: {str(e)}")
    
    return None

# ==================== WEB SCRAPING ====================
def scrape_article_content(url):
    """Scrape article content from URL"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code != 200:
            return None
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        for script in soup(["script", "style", "noscript"]):
            script.decompose()
        
        selectors = [
            'article', '[class*="article-body"]', '[class*="story-body"]',
            '[class*="content-body"]', '[itemprop="articleBody"]', 'main'
        ]
        
        article_text = ""
        for selector in selectors:
            content = soup.select_one(selector)
            if content:
                article_text = content.get_text(separator=' ', strip=True)
                if len(article_text) > 200:
                    break
        
        if len(article_text) < 200:
            paragraphs = soup.find_all('p')
            article_text = ' '.join([p.get_text(strip=True) for p in paragraphs])
        
        article_text = re.sub(r'\s+', ' ', article_text).strip()
        return article_text[:2000] if article_text else None
        
    except Exception:
        return None

# ==================== ARTICLE REWRITING ====================
def create_rewriting_prompt(articles_with_content):
    """Create prompt for rewriting articles"""
    prompt = f"""Rewrite these articles for TEN NEWS daily digest.

TITLE RULES:
- 8-12 words, engaging headline
- Add relevant emoji at start
- Use B2 English (intermediate level)

SUMMARY RULES:  
- EXACTLY 40-50 words
- B2 English with technical terms explained
- Complete information despite length limit

DETAILS RULES:
- Extract 3 pieces of NEW info NOT in summary
- Format: "Label: Value" 
- Each under 5 words
- Zero repetition from summary

Return ONLY this JSON:
{{
  "digest_date": "{datetime.now().strftime('%B %d, %Y')}",
  "articles": [
    {{
      "rank": 1,
      "emoji": "🌍",
      "title": "Title without emoji",
      "summary": "40-50 word summary", 
      "details": ["New info 1", "New info 2", "New info 3"],
      "category": "World News/Business/Technology/Science/Climate/Health",
      "source": "Source name",
      "url": "Original URL"
    }}
  ]
}}

ARTICLES TO REWRITE:
"""
    
    for i, article in enumerate(articles_with_content, 1):
        content = clean_text_for_json(article.get('content', ''))[:500]
        prompt += f"""
ARTICLE {i}:
Title: {clean_text_for_json(article['title'])}
URL: {article['url']}
Content: {content}
---"""
    
    return prompt

# ==================== DAILY GREETING GENERATION ====================
def generate_daily_greeting_and_reading_time(articles):
    """Generate daily greeting and reading time"""
    uk_tz = pytz.timezone('Europe/London')
    uk_time = datetime.now(uk_tz)
    
    total_words = sum(len(article.get('summary', '').split()) for article in articles)
    titles = [article.get('title', '') for article in articles[:5]]
    
    prompt = f"""Create a daily greeting for news readers. Today is {uk_time.strftime('%B %d, %Y')}.

REQUIREMENTS:
1. Start with "Good morning," or special day greeting if appropriate
2. Maximum 10 words total including greeting
3. Make it engaging about today's news or special day
4. Use B2 English

Today's headlines: {json.dumps(titles, indent=2)}

Calculate reading time for {total_words} words (200-250 WPM average).

Return ONLY this JSON:
{{
  "greeting": "Complete greeting under 10 words",
  "reading_time": "X minute read"
}}"""
    
    response = call_claude_api_with_model(prompt, "Generating greeting", CLAUDE_SONNET_MODEL)
    
    if response:
        try:
            parsed = parse_json_with_fallback(response)
            if parsed:
                return parsed.get('greeting', 'Good morning, today brings important global updates'), parsed.get('reading_time', '3 minute read')
        except Exception:
            pass
    
    estimated_minutes = max(1, round(total_words / 225))
    return "Good morning, today brings important global updates", f"{estimated_minutes} minute read"

# ==================== HISTORICAL EVENTS ====================
def generate_historical_events():
    """Generate historical events for today's date"""
    uk_tz = pytz.timezone('Europe/London')
    uk_time = datetime.now(uk_tz)
    current_month = uk_time.strftime('%B')
    current_day = uk_time.day
    
    print(f"\n📚 Generating historical events for {current_month} {current_day}...")
    
    prompt = f"""Find 4 historical events that occurred on {current_month} {current_day}.

REQUIREMENTS:
- Different time periods and categories
- Globally significant events
- Maximum 10 words per description
- Format: year and description only

Return ONLY this JSON:
{{
  "events": [
    {{
      "year": "1485",
      "description": "Battle of Bosworth Field ends War of Roses"
    }},
    {{
      "year": "1969", 
      "description": "Neil Armstrong walks on moon for first time"
    }},
    {{
      "year": "YEAR3",
      "description": "Event 3 description"
    }},
    {{
      "year": "YEAR4", 
      "description": "Event 4 description"
    }}
  ]
}}"""
    
    response = call_claude_api_with_model(prompt, "Generating historical events", CLAUDE_SONNET_MODEL)
    
    if response:
        try:
            parsed = parse_json_with_fallback(response)
            if parsed and 'events' in parsed:
                events = parsed['events']
                print(f"✅ Generated {len(events)} historical events")
                return events
        except Exception:
            pass
    
    # Fallback events
    return [
        {"year": "1485", "description": "Battle of Bosworth Field ends War of Roses"},
        {"year": "1864", "description": "Geneva Convention for wounded soldiers signed"},
        {"year": "1911", "description": "Mona Lisa stolen from Louvre Museum"},
        {"year": "1969", "description": "Apollo 11 lands on moon successfully"}
    ]

# ==================== CLAUDE API ====================
def call_claude_api_with_model(prompt, task_description, model=None):
    """Call Claude API with specified model"""
    if not CLAUDE_API_KEY:
        print("❌ No Claude API key set!")
        return None
    
    api_model = model if model else CLAUDE_MODEL
    print(f"🤖 {task_description} using {api_model}...")
    
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01", 
        "content-type": "application/json"
    }
    
    data = {
        "model": api_model,
        "max_tokens": 4000,
        "temperature": 0.1,
        "messages": [{"role": "user", "content": prompt}]
    }
    
    for attempt in range(3):
        try:
            response = requests.post(url, headers=headers, json=data, timeout=60)
            
            if response.status_code == 200:
                result = response.json()
                if 'content' in result and len(result['content']) > 0:
                    print(f"✅ {task_description} complete!")
                    return result['content'][0]['text']
            elif response.status_code == 429:
                wait_time = 2 ** attempt * 5
                print(f"⚠️ Rate limited, waiting {wait_time} seconds...")
                time.sleep(wait_time)
                continue
            else:
                print(f"❌ API Error {response.status_code}")
                break
                
        except Exception as e:
            print(f"❌ Error: {str(e)[:100]}")
            if attempt < 2:
                time.sleep(5)
                continue
            break
    
    return None

def call_claude_api(prompt, task_description):
    """Call Claude API with default model"""
    return call_claude_api_with_model(prompt, task_description, CLAUDE_MODEL)

def parse_json_with_fallback(response_text):
    """Parse JSON with fallback strategies"""
    if not response_text:
        return None
    
    response_text = response_text.strip()
    
    # Clean markdown
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
        try:
            # Find JSON boundaries
            start_idx = response_text.find('{')
            end_idx = response_text.rfind('}') + 1
            if start_idx >= 0 and end_idx > start_idx:
                json_str = response_text[start_idx:end_idx]
                return json.loads(json_str)
        except Exception:
            pass
    
    return None

# ==================== MAIN GENERATION FUNCTION ====================
def generate_daily_news():
    """Main function to generate daily news"""
    print("🚀 TEN NEWS - Daily Digest Generator")
    print("=" * 50)
    
    # Initialize processing log
    processing_log = {
        "timestamp": datetime.now().isoformat(),
        "date": datetime.now().strftime('%Y-%m-%d'),
        "steps": {},
        "statistics": {}
    }
    
    try:
        # Load previous articles
        previous_articles = load_previous_articles()
        processing_log["steps"]["1_previous_articles"] = {
            "count": len(previous_articles),
            "description": "Previous articles loaded for duplicate checking"
        }
        
        # Fetch news
        articles = fetch_gdelt_news_last_24_hours()
        if not articles:
            print("❌ No articles found")
            return False
        
        processing_log["steps"]["2_gdelt_fetch"] = {
            "total_articles": len(articles),
            "description": "All articles fetched from GDELT API",
            "sample_titles": [clean_text_for_json(a.get('title', ''))[:100] for a in articles[:5]]
        }
        processing_log["statistics"]["total_fetched_from_gdelt"] = len(articles)
        
        # Filter and deduplicate  
        unique_articles = deduplicate_articles(articles, processing_log)
        if not unique_articles:
            print("❌ No approved articles found")
            return False
        
        # AI selection
        selected_articles = select_top_articles_with_ai(unique_articles, previous_articles)
        
        # Log AI selection results
        if selected_articles and len(selected_articles) >= 10:
            processing_log["steps"]["4_ai_selection"] = {
                "input_articles": len(unique_articles),
                "selected_articles": len(selected_articles),
                "ai_status": "successful",
                "description": "AI successfully selected 10 articles",
                "selected_titles": [a.get('title', '')[:80] for a in selected_articles[:10]]
            }
        else:
            processing_log["steps"]["4_ai_selection"] = {
                "input_articles": len(unique_articles),
                "selected_articles": len(selected_articles) if selected_articles else 0,
                "ai_status": "partial_or_failed",
                "description": f"AI returned {len(selected_articles) if selected_articles else 0} articles, need fallback"
            }
        
        # Check if we need fallback (either no articles or less than 10)
        if not selected_articles or len(selected_articles) < 10:
            current_count = len(selected_articles) if selected_articles else 0
            print(f"⚠️ AI returned only {current_count} articles, using fallback to get 10")
            
            # Start fresh with fallback selection
            selected_articles = []
            for i, article in enumerate(unique_articles[:15]):  # Try first 15 to ensure we get 10
                selected_articles.append({
                    "id": i,
                    "title": article.get('title', ''),
                    "url": article.get('url', ''),
                    "category": "World News",
                    "selection_reason": "Fallback selection"
                })
                if len(selected_articles) >= 10:
                    break
            
            # Update processing log for fallback
            processing_log["steps"]["4_ai_selection"]["ai_status"] = "failed_using_fallback"
            processing_log["steps"]["4_ai_selection"]["selected_articles"] = len(selected_articles)
            processing_log["steps"]["4_ai_selection"]["description"] = f"AI returned {current_count}, fallback generated {len(selected_articles)}"
        
        # Ensure exactly 10 articles
        if len(selected_articles) < 10:
            print(f"⚠️ Only {len(selected_articles)} articles available, padding with available articles")
            # Add more articles if needed
            for i, article in enumerate(unique_articles[len(selected_articles):]):
                selected_articles.append({
                    "id": len(selected_articles),
                    "title": article.get('title', ''),
                    "url": article.get('url', ''),
                    "category": "World News", 
                    "selection_reason": "Auto-selected to reach 10 articles"
                })
                if len(selected_articles) >= 10:
                    break
        
        selected_articles = selected_articles[:10]
        print(f"✅ Selected {len(selected_articles)} articles")
        
        # Fetch content
        print("\n🌐 Fetching article content...")
        articles_with_content = []
        
        for i, article in enumerate(selected_articles, 1):
            print(f"📄 Article {i}/10: {article['title'][:50]}...")
            
            content = scrape_article_content(article['url'])
            if content:
                print(f"   ✓ Retrieved {len(content)} characters")
            else:
                print(f"   ⚠️ Using title only")
                content = article['title']
            
            # Extract source name
            domain = article.get('domain', '').replace('.com', '').replace('.org', '').title()
            source_map = {
                'Reuters': 'Reuters', 'Bbc': 'BBC', 'Cnn': 'CNN', 'Bloomberg': 'Bloomberg',
                'Nytimes': 'The New York Times', 'Wsj': 'The Wall Street Journal',
                'Theguardian': 'The Guardian', 'Forbes': 'Forbes', 'Techcrunch': 'TechCrunch'
            }
            source = source_map.get(domain, domain)
            
            article_data = article.copy()
            article_data['content'] = content
            article_data['source'] = source
            articles_with_content.append(article_data)
        
        # Rewrite articles
        print("\n✍️ Rewriting articles...")
        rewriting_prompt = create_rewriting_prompt(articles_with_content)
        final_response = call_claude_api(rewriting_prompt, "Rewriting articles")
        
        if not final_response:
            print("❌ Failed to rewrite articles")
            return False
        
        articles_data = parse_json_with_fallback(final_response)
        if not articles_data or 'articles' not in articles_data:
            print("❌ Failed to parse rewritten articles")
            return False
        
        print(f"✅ Rewritten {len(articles_data['articles'])} articles")
        
        # Generate greeting and reading time
        daily_greeting, reading_time = generate_daily_greeting_and_reading_time(articles_data['articles'])
        formatted_date = get_formatted_date()
        
        # Generate historical events
        historical_events = generate_historical_events()
        
        # Add metadata
        articles_data.update({
            'dailyGreeting': daily_greeting,
            'readingTime': reading_time,
            'displayDate': formatted_date,
            'historicalEvents': historical_events,
            'generatedAt': datetime.now().isoformat(),
            'generatedAtUK': datetime.now(pytz.timezone('Europe/London')).isoformat()
        })
        
        # Save to file
        today = datetime.now().strftime('%Y_%m_%d')
        filename = f"tennews_data_{today}.json"
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(articles_data, f, ensure_ascii=False, indent=2)
        
        # Finalize processing log
        processing_log["steps"]["5_final_output"] = {
            "final_articles_count": len(articles_data['articles']),
            "news_file": filename,
            "greeting": daily_greeting,
            "reading_time": reading_time,
            "description": "Final news data generated and saved"
        }
        processing_log["statistics"]["final_articles_generated"] = len(articles_data['articles'])
        processing_log["completion_time"] = datetime.now().isoformat()
        
        # Save detailed processing log
        log_filename = f"processing_log_{today}.json"
        with open(log_filename, 'w', encoding='utf-8') as f:
            json.dump(processing_log, f, ensure_ascii=False, indent=2)
        
        print(f"\n✅ SUCCESS! Saved: {filename}")
        print(f"📊 Processing log: {log_filename}")
        print(f"📅 Date: {formatted_date}")
        print(f"👋 Greeting: {daily_greeting}")
        print(f"⏱️ Reading: {reading_time}")
        print(f"📰 Articles: {len(articles_data['articles'])}")
        
        # Note: Historical events are already included in the main news file
        # No need for separate historical events file
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

# ==================== SCHEDULER ====================
def run_daily_generation():
    """Run the daily generation at 7 AM UK time"""
    print(f"⏰ Running daily generation at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    success = generate_daily_news()
    if success:
        print("✅ Daily generation completed successfully!")
    else:
        print("❌ Daily generation failed!")

# Schedule the job for 7 AM UK time
schedule.every().day.at("07:00").do(run_daily_generation)

def start_scheduler():
    """Start the scheduler"""
    print("🕒 Starting TEN NEWS scheduler...")
    print("📅 Will run daily at 7:00 AM UK time")
    print("⏹️ Press Ctrl+C to stop")
    
    while True:
        schedule.run_pending()
        time.sleep(60)  # Check every minute

if __name__ == "__main__":
    print("TEN NEWS - Daily Digest Generator")
    print("1. Run once now")
    print("2. Start scheduler (daily at 7 AM UK)")
    
    choice = input("Choose option (1 or 2): ").strip()
    
    if choice == "1":
        generate_daily_news()
    elif choice == "2":
        start_scheduler()
    else:
        print("Invalid choice. Running once...")
        generate_daily_news()
