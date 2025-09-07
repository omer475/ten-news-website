# TEN NEWS - DAILY DIGEST GENERATOR
# Optimized for Website Integration - No Wix Dependencies
# ENHANCED VERSION: 40-Query Comprehensive News System + Claude Opus 4.1
# - 40 specialized search categories (upgraded from 8)
# - Claude Opus 4.1 (latest) for superior article writing quality
# - Enhanced error handling and JSON parsing
# - Increased article limit: 250 per query (upgraded from 100)
# - Improved rate limiting: 2-second delays (upgraded from 1s)
# - Detailed progress reporting with category labels

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

# Claude Models - Updated to latest Opus 4.1
CLAUDE_MODEL = "claude-opus-4-1-20250805"
CLAUDE_SONNET_MODEL = "claude-3-5-sonnet-20241022"  # Keep Sonnet for specific tasks

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

def clean_json_response(content):
    """Clean and fix common JSON issues in GDELT responses"""
    # Remove any BOM or weird characters at start
    if content.startswith('\ufeff'):
        content = content[1:]
    
    # Fix common escape issues
    content = content.replace('\\\\', '\\')
    
    # Try to find valid JSON boundaries
    first_brace = content.find('{')
    last_brace = content.rfind('}')
    
    if first_brace >= 0 and last_brace > first_brace:
        content = content[first_brace:last_brace + 1]
    
    return content

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
    """Fetch important news from GDELT using comprehensive 40-query system"""
    print(f"🌍 Fetching global news from GDELT (approved sources only)...")
    print(f"🔥 Using hybrid relevance sorting for importance-based ranking")
    print(f"📰 Fetching up to 250 articles per query across 40 categories")
    print(f"Time period: Last 24 hours")
    print("=" * 70)
    
    all_articles = []
    url = "https://api.gdeltproject.org/api/v2/doc/doc"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    # Comprehensive search queries for maximum coverage - 40 specialized searches
    search_queries = [
        # 1. GENERAL BREAKING NEWS
        "(breaking OR urgent OR crisis OR emergency OR unprecedented OR historic OR exclusive OR BREAKING OR URGENT)",
        
        # 2. CASUALTIES/HUMAN IMPACT
        "(killed OR died OR death OR casualties OR victims OR injured OR wounded OR fatalities OR toll)",
        
        # 3. SCALE/NUMBERS
        "(billion OR trillion OR million OR record OR highest OR lowest OR surge OR plunge OR soar OR crash)",
        
        # 4. BUSINESS/FINANCE
        "(market OR stocks OR earnings OR IPO OR merger OR acquisition OR bankrupt OR revenue OR profit OR loss)",
        
        # 5. ECONOMIC INDICATORS
        "(Fed OR inflation OR recession OR GDP OR unemployment OR economy OR rates OR dollar OR euro OR yuan)",
        
        # 6. SCIENCE/TECHNOLOGY
        "(AI OR artificial intelligence OR robot OR quantum OR breakthrough OR discovery OR innovation OR research OR study)",
        
        # 7. SPACE/MEDICAL/CLIMATE
        "(SpaceX OR NASA OR vaccine OR cure OR climate OR cancer OR treatment OR therapy OR disease OR pandemic)",
        
        # 8. DATA/RANKINGS/STUDIES
        "(index OR ranking OR study OR survey OR report OR statistics OR poll OR data OR analysis OR forecast)",
        
        # 9. CONFLICT/DISASTER
        "(attack OR explosion OR collapse OR disaster OR conflict OR war OR battle OR strike OR protest OR riot)",
        
        # 10. MAJOR ANNOUNCEMENTS
        "(announced OR launched OR revealed OR unveiled OR discovered OR confirmed OR admitted OR denied)",
        
        # 11. CORPORATE LEADERSHIP & EXECUTIVE CHANGES
        "(CEO OR executive OR resign OR appointed OR fired OR promoted OR stepped down OR retirement OR succession)",
        
        # 12. MERGERS & ACQUISITIONS
        "(merger OR acquisition OR buyout OR takeover OR deal OR purchase OR bid OR offer OR valuation)",
        
        # 13. ARTIFICIAL INTELLIGENCE & MACHINE LEARNING
        "(ChatGPT OR GPT OR LLM OR neural network OR machine learning OR deep learning OR AGI OR OpenAI OR Anthropic)",
        
        # 14. CRYPTOCURRENCY & BLOCKCHAIN
        "(bitcoin OR cryptocurrency OR blockchain OR ethereum OR crypto OR NFT OR DeFi OR mining OR wallet)",
        
        # 15. CLIMATE CHANGE & ENVIRONMENTAL
        "(climate change OR global warming OR carbon OR emissions OR renewable energy OR solar OR wind OR net zero)",
        
        # 16. MEDICAL BREAKTHROUGHS & HEALTH
        "(FDA approval OR medical breakthrough OR clinical trial OR drug OR medicine OR treatment OR cure OR therapy)",
        
        # 17. STARTUP & VENTURE CAPITAL
        "(startup OR funding OR venture capital OR unicorn OR Series A OR Series B OR IPO OR valuation OR investment)",
        
        # 18. GEOPOLITICAL TENSIONS & SANCTIONS
        "(sanctions OR tensions OR diplomatic OR embassy OR relations OR summit OR treaty OR agreement OR talks)",
        
        # 19. ENERGY & OIL MARKETS
        "(oil OR gas OR OPEC OR energy OR pipeline OR renewable OR nuclear OR coal OR electricity OR power)",
        
        # 20. CENTRAL BANK & MONETARY POLICY
        "(central bank OR interest rate OR monetary policy OR Federal Reserve OR ECB OR BOE OR BOJ OR stimulus)",
        
        # 21. SUPPLY CHAIN & LOGISTICS
        "(supply chain OR shipping OR logistics OR shortage OR disruption OR container OR port OR delivery)",
        
        # 22. CYBERSECURITY & DATA BREACHES
        "(cyber attack OR hack OR data breach OR ransomware OR security OR vulnerability OR password OR encryption)",
        
        # 23. SPACE EXPLORATION & SATELLITES
        "(space station OR satellite OR Mars OR moon OR astronaut OR rocket OR launch OR orbit OR mission)",
        
        # 24. EDUCATION & UNIVERSITY RANKINGS
        "(university OR education OR scholarship OR research grant OR Nobel OR academic OR school OR student)",
        
        # 25. SPORTS BUSINESS & MAJOR EVENTS
        "(Olympics OR World Cup OR championship OR transfer OR contract OR stadium OR league OR tournament)",
        
        # 26. RETAIL & E-COMMERCE
        "(Amazon OR retail OR e-commerce OR sales OR shopping OR consumer OR store OR online OR delivery)",
        
        # 27. AUTOMOTIVE & ELECTRIC VEHICLES
        "(Tesla OR electric vehicle OR autonomous OR car OR automotive OR EV OR battery OR charging OR factory)",
        
        # 28. REAL ESTATE & HOUSING MARKETS
        "(real estate OR housing OR mortgage OR property OR construction OR rent OR prices OR development)",
        
        # 29. REGULATORY & COMPLIANCE
        "(regulation OR compliance OR fine OR lawsuit OR antitrust OR investigation OR probe OR penalty OR ruling)",
        
        # 30. DEMOGRAPHIC & POPULATION TRENDS
        "(population OR demographic OR migration OR census OR aging OR birth rate OR immigration OR refugee)",
        
        # 31. MAJOR TECH COMPANIES
        "(Apple OR Google OR Microsoft OR Meta OR Facebook OR Twitter OR X OR TikTok OR Instagram)",
        
        # 32. WORLD LEADERS
        "(Biden OR Putin OR Xi Jinping OR Trump OR Zelensky OR Modi OR Macron OR Netanyahu)",
        
        # 33. MAJOR BANKS
        "(JPMorgan OR Bank of America OR Wells Fargo OR Citigroup OR Goldman Sachs OR Morgan Stanley)",
        
        # 34. AVIATION
        "(Boeing OR Airbus OR airline OR flight OR aviation OR crash OR safety OR pilot)",
        
        # 35. ENTERTAINMENT
        "(Netflix OR Disney OR Hollywood OR movie OR film OR streaming OR box office OR Oscar)",
        
        # 36. FOOD & AGRICULTURE
        "(food OR agriculture OR farming OR crop OR harvest OR famine OR hunger OR prices)",
        
        # 37. INSURANCE & DISASTER
        "(insurance OR hurricane OR earthquake OR flood OR wildfire OR tornado OR damage OR claims)",
        
        # 38. PHARMA
        "(Pfizer OR Moderna OR Johnson OR vaccine OR drug OR pharmaceutical OR FDA OR clinical)",
        
        # 39. SOCIAL MEDIA
        "(viral OR trending OR social media OR influencer OR platform OR content OR creator)",
        
        # 40. ELECTIONS
        "(election OR vote OR poll OR campaign OR candidate OR primary OR ballot OR democracy)"
    ]
    
    print("\n🔍 Searching for important news across 40 specialized categories...")
    
    for idx, query in enumerate(search_queries, 1):
        query_labels = {
            1: "General Breaking News",
            2: "Human Impact/Casualties",
            3: "Major Scale Stories",
            4: "Business/Finance News",
            5: "Economic Indicators",
            6: "Science/Technology",
            7: "Space/Medical/Climate",
            8: "Data Rankings/Studies",
            9: "Conflicts/Disasters",
            10: "Major Announcements",
            11: "Corporate Leadership",
            12: "Mergers & Acquisitions",
            13: "AI & Machine Learning",
            14: "Cryptocurrency/Blockchain",
            15: "Climate Change/Environment",
            16: "Medical Breakthroughs",
            17: "Startup/Venture Capital",
            18: "Geopolitical Tensions",
            19: "Energy/Oil Markets",
            20: "Central Bank Policy",
            21: "Supply Chain/Logistics",
            22: "Cybersecurity/Breaches",
            23: "Space Exploration",
            24: "Education/Rankings",
            25: "Sports Business",
            26: "Retail/E-commerce",
            27: "Automotive/EVs",
            28: "Real Estate/Housing",
            29: "Regulatory/Compliance",
            30: "Demographics/Population",
            31: "Major Tech Companies",
            32: "World Leaders",
            33: "Major Banks",
            34: "Aviation",
            35: "Entertainment",
            36: "Food & Agriculture",
            37: "Insurance & Disaster",
            38: "Pharma",
            39: "Social Media",
            40: "Elections"
        }
        
        label = query_labels.get(idx, f"Search {idx}")
        print(f"\n📋 {label}: {query[:40]}...")
        
        params = {
            "query": query,
            "mode": "ArtList", 
            "format": "json",
            "maxrecords": "250",
            "timespan": "1d",
            "sort": "hybridrel"
        }
        
        try:
            response = requests.get(url, params=params, headers=headers, timeout=30)
            
            if response.status_code == 200:
                content = response.text
                
                # Check if we got HTML error
                if content.startswith('<!DOCTYPE') or content.startswith('<html'):
                    print(f"   ❌ Got HTML response, skipping...")
                    continue
                
                try:
                    # Clean the response before parsing
                    cleaned_content = clean_json_response(content)
                    data = json.loads(cleaned_content)
                    articles = data.get('articles', [])
                    
                    # Process articles
                    valid_count = 0
                    for article in articles:
                        if article.get('title') and article.get('url'):
                            # Clean the title for JSON safety
                            article['title'] = clean_text_for_json(article.get('title', ''))
                            all_articles.append(article)
                            valid_count += 1
                    
                    print(f"   ✓ Found {valid_count} articles")
                    
                except json.JSONDecodeError as e:
                    print(f"   ❌ Failed to parse JSON response: {str(e)[:100]}")
                    # Try alternative parsing
                    try:
                        # Sometimes GDELT returns invalid JSON, try to extract articles manually
                        import re
                        url_pattern = r'"url"\s*:\s*"([^"]+)"'
                        title_pattern = r'"title"\s*:\s*"([^"]+)"'
                        
                        urls = re.findall(url_pattern, content)
                        titles = re.findall(title_pattern, content)
                        
                        if urls and titles:
                            valid_count = 0
                            for url, title in zip(urls[:250], titles[:250]):
                                if url and title:
                                    all_articles.append({
                                        'url': url,
                                        'title': clean_text_for_json(title)
                                    })
                                    valid_count += 1
                            print(f"   ✓ Recovered {valid_count} articles using fallback parsing")
                        else:
                            print(f"   ❌ Could not recover articles from response")
                    except Exception as e2:
                        print(f"   ❌ Fallback parsing also failed: {str(e2)[:50]}")
                    
            elif response.status_code == 429:
                print(f"   ⚠️ Rate limited, waiting 2 seconds...")
                time.sleep(2)
                
            else:
                print(f"   ❌ Error {response.status_code}")
                
            # Delay between requests to prevent rate limiting
            time.sleep(2)  # Increased from 1 to 2 seconds for enhanced stability
            
        except requests.exceptions.Timeout:
            print(f"   ❌ Request timed out")
        except requests.exceptions.RequestException as e:
            print(f"   ❌ Request error: {str(e)[:100]}")
        except Exception as e:
            print(f"   ❌ Unexpected error: {str(e)[:100]}")
    
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

def deduplicate_articles(articles):
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
    prompt = f"""CRITICAL: You MUST rewrite ALL {len(articles_with_content)} articles provided. Return exactly {len(articles_with_content)} articles in your response.

REWRITE RULES:
- TITLE: 8-12 words, engaging headline (NO emoji in title field)
- SUMMARY: CRITICAL - MUST be EXACTLY 40-50 words, count every word carefully, B2 English level 
- DETAILS: 3 pieces of NEW info NOT in summary, format "Label: Value"
- EMOJI: Choose relevant emoji for each article
- CATEGORY: World News/Business/Technology/Science/Climate/Health

WORD COUNT ENFORCEMENT:
- Every summary MUST contain between 40-50 words (inclusive)
- Count words carefully - if under 40 words, add more detail
- If over 50 words, trim unnecessary words
- This is MANDATORY - summaries with wrong word count will be rejected

MANDATORY: Your JSON response must contain exactly {len(articles_with_content)} articles. Each article must have rank 1-{len(articles_with_content)}.

Return ONLY this JSON:
{{
  "digest_date": "{datetime.now().strftime('%B %d, %Y')}",
  "articles": [
    {{
      "rank": 1,
      "emoji": "🌍",
      "title": "Title without emoji",
      "summary": "EXACTLY 40-50 words - write complete sentences with proper detail, count each word carefully to ensure you hit the target range", 
      "details": ["New info 1", "New info 2", "New info 3"],
      "category": "World News/Business/Technology/Science/Climate/Health",
      "source": "Source name",
      "url": "Original URL"
    }}
  ]
}}

ARTICLES TO REWRITE (ALL {len(articles_with_content)} MUST BE INCLUDED):
"""
    
    for i, article in enumerate(articles_with_content, 1):
        content = clean_text_for_json(article.get('content', ''))[:500]
        prompt += f"""
ARTICLE {i}:
Title: {clean_text_for_json(article['title'])}
URL: {article['url']}
Content: {content}
---"""
    
    prompt += f"""

FINAL REMINDER: Each summary must be EXACTLY 40-50 words. Count carefully:
- Too short (under 40): Add more relevant details
- Too long (over 50): Remove unnecessary words
- Perfect range (40-50): Proceed with confidence

Return ONLY the JSON with all {len(articles_with_content)} articles, each with 40-50 word summaries."""
    
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
    
    # Processing tracking removed - keeping only essential files
    
    try:
        # Load previous articles
        previous_articles = load_previous_articles()
        
        # Fetch news
        articles = fetch_gdelt_news_last_24_hours()
        if not articles:
            print("❌ No articles found")
            return False
        
        # Filter and deduplicate  
        unique_articles = deduplicate_articles(articles)
        if not unique_articles:
            print("❌ No approved articles found")
            return False
        
        # AI selection
        selected_articles = select_top_articles_with_ai(unique_articles, previous_articles)
        
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
            
            # Fallback selection completed
        
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
        
        # Validate we got exactly 10 articles
        rewritten_count = len(articles_data['articles'])
        if rewritten_count < 10:
            print(f"⚠️ AI rewriting returned only {rewritten_count} articles, padding to 10")
            # Pad with remaining articles from selected_articles
            for i in range(rewritten_count, min(10, len(articles_with_content))):
                fallback_article = articles_with_content[i]
                articles_data['articles'].append({
                    "rank": i + 1,
                    "emoji": "📰",
                    "title": clean_text_for_json(fallback_article.get('title', ''))[:60],
                    "summary": clean_text_for_json(fallback_article.get('content', fallback_article.get('title', '')))[:200],
                    "details": ["Source: " + fallback_article.get('source', 'Unknown'), "Category: World News", "Auto-generated summary"],
                    "category": "World News",
                    "source": fallback_article.get('source', 'Unknown'),
                    "url": fallback_article.get('url', '')
                })
        
        # Ensure exactly 10 articles
        articles_data['articles'] = articles_data['articles'][:10]
        print(f"✅ Final output: {len(articles_data['articles'])} articles")
        
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
        
        print(f"\n✅ SUCCESS! Saved: {filename}")
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
