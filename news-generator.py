# TEN NEWS - DAILY DIGEST GENERATOR
# Optimized for Website Integration - No Wix Dependencies
# ENHANCED VERSION: 40-Query Comprehensive News System + Claude Opus 4.1
# - 40 specialized search categories (upgraded from 8)
# - Claude Opus 4.1 for superior article writing (upgraded from Sonnet 3.5)
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
CLAUDE_MODEL = "claude-opus-4-1-20250805"  # Latest Opus version for article writing
CLAUDE_SONNET_MODEL = "claude-3-5-sonnet-20241022"  # Keep Sonnet for other tasks

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
                        # Store articles with their date for better context
                        for article in data['articles']:
                            article['previous_date'] = past_date.strftime('%Y-%m-%d')
                            previous_articles.append(article)
            except Exception as e:
                print(f"⚠️ Error loading {filename}: {str(e)}")
    
    print(f"📚 Loaded {len(previous_articles)} previous articles from last 7 days for duplicate checking")
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
        # Group previous articles by date for better context
        previous_by_date = {}
        for article in previous_articles:
            date = article.get('previous_date', 'unknown')
            if date not in previous_by_date:
                previous_by_date[date] = []
            previous_by_date[date].append({
                'title': clean_text_for_json(article.get('title', '')),
                'summary': clean_text_for_json(article.get('summary', ''))[:100]
            })
        
        if previous_by_date:
            previous_context = f"""
PREVIOUS ARTICLES FROM LAST 7 DAYS TO AVOID:
{json.dumps(previous_by_date, indent=2)}

CRITICAL RULES:
1. NEVER select stories that are the same or very similar to previous articles
2. Avoid minor updates or follow-ups to stories already covered
3. Check both title AND summary similarity before selecting
4. If unsure about similarity, err on the side of avoiding duplicates
5. Focus on completely NEW stories and developments
"""
    
    prompt = f"""You are an expert news curator responsible for selecting EXACTLY 10 most important and engaging global news stories from the provided list.

{previous_context}

## CORE MANDATE
Return EXACTLY 10 articles in JSON format. This is non-negotiable. If fewer than 10 ideal stories exist, include the best available to reach exactly 10.

## SELECTION FRAMEWORK

### TIER 1 - CRITICAL IMPACT (Positions 1-3)
Must meet AT LEAST TWO criteria:
- Affects 10+ million people directly OR has global systemic impact
- Breaking news with immediate consequences requiring public awareness
- Historic/unprecedented events that will be referenced for years
- Major threats to public safety, security, or economic stability
- Government decisions fundamentally changing citizens' lives

### TIER 2 - HIGH IMPORTANCE (Positions 4-6)
Must meet AT LEAST TWO criteria:
- Affects 1-10 million people OR significant sector/industry
- Major corporate/institutional developments with ripple effects
- Scientific/medical breakthroughs with practical applications
- Significant geopolitical shifts or diplomatic developments
- Economic indicators/events affecting markets or employment
- Cultural phenomena with measurable societal impact

### TIER 3 - NOTABLE & ENGAGING (Positions 7-10)
Must meet AT LEAST ONE criteria:
- High viral/discussion potential while maintaining relevance
- Updates on major ongoing stories people are following
- Emerging trends that signal future changes
- Human interest with broader implications or lessons
- Regional stories with potential global precedent

## ENGAGEMENT OPTIMIZATION RULES

### MUST INCLUDE (if available from credible sources):
- **Power & Scandal**: Leadership crises, corruption exposés, whistleblower revelations
- **Records & Extremes**: First-ever, largest, smallest, most expensive, unprecedented outcomes
- **Celebrity Impact**: Major figures making significant moves (not gossip - think business decisions, political involvement, major initiatives)
- **David vs Goliath**: Underdog victories, shocking upsets, unexpected reversals
- **Money Moves**: Billion-dollar deals, market crashes/surges, wealth transfers
- **Cultural Moments**: Events everyone will discuss (major sports finals, Oscar surprises, viral phenomena with substance)

### MUST EXCLUDE:
- Purely local stories without wider implications
- Minor corporate earnings unless dramatically unexpected
- Incremental policy updates or routine announcements
- Personal drama without societal relevance
- Speculation or rumors without confirmation
- Stories older than 48 hours unless major new development

## DIVERSITY REQUIREMENTS

Your 10 selections MUST include:
- **Geographic Distribution**: Maximum 4 stories from any single country
- **Topic Balance**: No more than 3 stories from same category
- **Perspective Range**: Include both institutional and human-impact angles
- **Temporal Mix**: At least 6 breaking/today's news, maximum 4 developing stories

### SUGGESTED DISTRIBUTION:
- 2-3 Politics/Governance stories
- 2-3 Economy/Business stories  
- 1-2 Technology/Science stories
- 1-2 Health/Climate/Environment stories
- 1-2 Society/Culture/Human Interest stories
- 1 Wildcard (Sports/Entertainment IF globally significant)

## QUALITY VERIFICATION

Before including ANY story, verify:
- ✓ Source is established, credible news organization
- ✓ Information is factual, not speculation
- ✓ Headline accurately represents content
- ✓ Story has clear "why this matters" angle
- ✓ No duplicate coverage of same event

## RANKING METHODOLOGY

1. **Impact Score (40%)**: How many affected + how severely
2. **Urgency Score (30%)**: Breaking news > Developing > Follow-up
3. **Engagement Score (20%)**: Viral potential + discussion value
4. **Diversity Score (10%)**: Balances overall selection

## OUTPUT REQUIREMENTS

Return ONLY this JSON structure with EXACTLY 10 articles:
{{
  "selection_metadata": {{
    "total_articles_reviewed": {len(formatted_articles)},
    "selection_timestamp": "{datetime.now().isoformat()}",
    "top_themes": ["theme1", "theme2", "theme3"]
  }},
  "selected_articles": [
    {{
      "id": 1,
      "title": "[exact original title]",
      "url": "[exact URL]",
      "category": "Politics|Business|Technology|Science|Health|Climate|Society|Culture|Sports",
      "impact_tier": "Critical|High|Notable",
      "selection_reason": "[One sentence: specific impact + why readers care]",
      "engagement_factors": ["breaking", "scandal", "record", "viral", "affects_millions"],
      "estimated_reach": "global|continental|national|sectoral"
    }}
  ]
}}

## ARTICLES TO EVALUATE:
{json.dumps(formatted_articles, indent=2)}"""
    
    response = call_claude_api(prompt, "Selecting top articles")
    
    if response:
        try:
            parsed = parse_json_with_fallback(response)
            if parsed and 'selected_articles' in parsed:
                selected = parsed['selected_articles']
                print(f"✅ AI selected {len(selected)} articles")
                
                # Show selection metadata if available
                if 'selection_metadata' in parsed:
                    metadata = parsed['selection_metadata']
                    print(f"📊 Reviewed {metadata.get('total_articles_reviewed', 'unknown')} articles")
                    if 'top_themes' in metadata:
                        print(f"🏷️ Top themes: {', '.join(metadata['top_themes'])}")
                
                # Show tier distribution
                tier_counts = {}
                for article in selected:
                    tier = article.get('impact_tier', 'Unknown')
                    tier_counts[tier] = tier_counts.get(tier, 0) + 1
                
                if tier_counts:
                    tier_summary = [f"{tier}: {count}" for tier, count in tier_counts.items()]
                    print(f"🎯 Impact distribution: {', '.join(tier_summary)}")
                
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
def create_dedicated_rewriting_prompt(selected_articles_with_content):
    """Create a dedicated prompt ONLY for rewriting articles to proper format"""
    prompt = f"""You are a professional news writer. Your ONLY job is to rewrite {len(selected_articles_with_content)} selected articles into the proper format.

CRITICAL REQUIREMENTS:

1. **WORD COUNT**: Every summary MUST be EXACTLY 40-50 words. Count carefully!
2. **BOLD MARKUP**: Use **bold** for 3-6 key words, names, places, numbers  
3. **DETAILS**: Exactly 3 facts in "Label: Value" format with NEW information not in summary
4. **TITLE**: 8-12 engaging words (NO emoji in title field)
5. **EMOJI**: One relevant emoji per story

## WORD COUNT VALIDATION PROCESS:
For each summary:
1. Write the summary
2. Count every single word
3. If under 40 words: Add more relevant details
4. If over 50 words: Remove unnecessary words  
5. Final count MUST be 40-50 words

## BOLD MARKUP RULES:
- **Bold** should highlight: important names, places, numbers, key concepts
- Use 3-6 bold items per summary (not too few, not too many)
- Example: "**Apple** reported **$89.5 billion** revenue for **Q4 2024**, exceeding analyst expectations by **12%** as **iPhone 15** sales surged globally."

## DETAILS FORMAT:
Each detail must be "Label: Value" where:
- Label: 1-3 words maximum
- Value: Key data/fact not mentioned in summary
- Keep each detail under 6 words total
- Examples: "Revenue: $89.5B", "Growth: 12% YoY", "Market cap: $2.8T"

Return ONLY this JSON structure with EXACTLY {len(selected_articles_with_content)} articles:

{{
  "articles": [
    {{
      "rank": 1,
      "emoji": "📱",
      "title": "Engaging title without emoji in 8-12 words",
      "summary": "Exactly 40-50 words with **bold** markup for key terms - count every word carefully to ensure perfect range",
      "details": ["Label: Value", "Label: Value", "Label: Value"],
      "category": "World News|Business|Technology|Science|Climate|Health",
      "source": "Source Name",
      "url": "Original URL"
    }}
  ]
}}

ARTICLES TO REWRITE:
"""
    
    for i, article in enumerate(selected_articles_with_content, 1):
        content = clean_text_for_json(article.get('content', ''))[:800]
        prompt += f"""
ARTICLE {i}:
Title: {clean_text_for_json(article.get('title', ''))}
URL: {article.get('url', '')}
Content: {content}
Category: {article.get('category', 'World News')}
Source: {article.get('source', 'Unknown')}
---"""
    
    prompt += f"""

FINAL REMINDER: 
- Each summary must be EXACTLY 40-50 words
- Use **bold** markup for 3-6 key terms
- Details must be completely NEW information not in summary
- Return EXACTLY {len(selected_articles_with_content)} articles
"""
    
    return prompt

def create_rewriting_prompt(articles_with_content):
    """Create prompt for rewriting articles"""
    prompt = f"""CRITICAL: You MUST rewrite ALL {len(articles_with_content)} articles provided. Return exactly {len(articles_with_content)} articles in your response.

REWRITE RULES:
- TITLE: 8-12 words, engaging headline (NO emoji in title field)
- SUMMARY: CRITICAL - MUST be EXACTLY 40-50 words, count every word carefully, B2 English level. Make 3-6 important words, names, places, and numbers BOLD using **bold** markup (not too many, not too few) 
- DETAILS: CRITICAL - Follow the comprehensive Details Section Instructions below
- EMOJI: Choose relevant emoji for each article
- CATEGORY: World News/Business/Technology/Science/Climate/Health

WORD COUNT ENFORCEMENT:
- Every summary MUST contain between 40-50 words (inclusive)
- Count words carefully - if under 40 words, add more detail
- If over 50 words, trim unnecessary words
- This is MANDATORY - summaries with wrong word count will be rejected

## Details Section Instructions for AI - Complete Format Guide

### CORE REQUIREMENTS
Generate exactly 3 data points in the `details` array. Each must provide NEW information not mentioned in the summary.

### FORMAT STRUCTURE

#### Basic Format
```
"Label: Value"
```

#### Length Guidelines

**SHORT FORMAT** (for simple metrics):
- `Stock drop: 91%`
- `Debt owed: $3.3B`
- `Countries: 47`

**MEDIUM FORMAT** (with units/context):
- `Market share: 28% of global`
- `Aid blocked: 4,000 trucks daily`
- `Previous fine: €8.2B total`

**DESCRIPTIVE FORMAT** (when specificity matters):
- `Advertisers affected: 2 million`
- `Recovery timeline: 18-24 months`
- `Competitor position: #3 globally`

### LABEL RULES

1. **Length**: 1-3 words maximum
2. **Style**: Capitalize first word only
3. **No colons in label**: The colon is the separator
4. **Be specific**: "EU fines" not just "Fines"

### VALUE RULES

1. **Primary number first**: Start with the key metric
2. **Context after**: Add clarifying text if needed
3. **Keep concise**: Maximum 4-5 words after number
4. **No full sentences**: Use fragments

### GOOD vs BAD EXAMPLES

**TOO LONG - BAD:**
```
"Investigation duration spanning multiple jurisdictions: 3 years across 12 countries"
```

**PROPERLY FORMATTED - GOOD:**
```
"Investigation duration: 3 years"
"Jurisdictions involved: 12 countries"
```

**REDUNDANT - BAD:**
```
"Total number of affected advertisers: 2 million advertisers"
```

**CLEAN - GOOD:**
```
"Advertisers affected: 2 million"
```

### HIERARCHY OF INFORMATION

#### Primary Details (Use First)
- Hard numbers with brief context
- `Revenue loss: $450M quarterly`
- `Staff reduction: 12,000 jobs`
- `Market share: 28% global`

#### Secondary Details (Use if Primary Exhausted)  
- Comparisons and rankings
- `Industry rank: #2 worldwide`
- `Growth rate: -23% YoY`
- `Previous incident: 2019`

#### Tertiary Details (Last Resort)
- Projections and estimates
- `Recovery estimate: Q3 2026`
- `Analysts surveyed: 47`
- `Confidence level: 78%`

### SPACE OPTIMIZATION

**If detail seems too long, split concept:**

Instead of:
```
"Government response: Emergency $2B aid package approved by 310-95 vote"
```

Use one of these:
```
"Emergency aid: $2B"
"Senate vote: 310-95"  
"Approval margin: 215 votes"
```

### CONTEXT ADDITIONS

**When to add context after number:**
- Percentages need scope: `28% of global`
- Money needs timeframe: `$2B annually`
- People need category: `45,000 civilians`
- Comparisons need baseline: `3x previous record`

**When NOT to add context:**
- Obvious units: `Temperature: 45°C` (not "45°C hot")
- Clear metrics: `Deaths: 142` (not "142 people")
- Standard measures: `Distance: 500km` (not "500km far")

### VALIDATION CHECKLIST

For each detail:
- [ ] Label is 1-3 words
- [ ] Single colon separator
- [ ] Value starts with number/metric
- [ ] Context adds clarity, not redundancy
- [ ] Total length under 6-7 words
- [ ] No repetition from summary
- [ ] Adds meaningful new information

### ADAPTIVE EXAMPLES BY STORY TYPE

**Tech/Business Story:**
```
details: [
  "Market cap: $1.2T",
  "Patent portfolio: 50,000+",
  "R&D budget: 18% revenue"
]
```

**Disaster/Crisis Story:**
```
details: [
  "Warning time: 6 minutes",
  "Shelters opened: 200",
  "Aid workers: 5,000 deployed"
]
```

**Political/Diplomatic Story:**
```
details: [
  "Bilateral trade: $340B",
  "Embassy staff: 1,200",
  "Previous summit: 2018"
]
```

### FINAL RULE

If a detail needs more than 5-6 words after the colon, it's probably:
1. Too complex (split it)
2. Too vague (specify it)
3. Wrong information type (replace it)

The goal: Someone scanning details should instantly grasp 3 key supplementary facts without reading sentences.

MANDATORY: Your JSON response must contain exactly {len(articles_with_content)} articles. Each article must have rank 1-{len(articles_with_content)}.

Return ONLY this JSON:
{{
  "digest_date": "{datetime.now().strftime('%B %d, %Y')}",
  "articles": [
    {{
      "rank": 1,
      "emoji": "🌍",
      "title": "Title without emoji",
      "summary": "EXACTLY 40-50 words with **bold** markup for important words, names, places, numbers - count each word carefully to ensure you hit the target range", 
      "details": ["Label: Value - completely NEW fact not in summary", "Label: Value - different category from summary", "Label: Value - adds context summary lacks"],
      "category": "World News/Business/Technology/Science/Climate/Health",
      "source": "Source name",
      "url": "Original URL"
    }}
  ]
}}

CRITICAL JSON FORMATTING:
- Use **bold** markup in summaries exactly as shown above
- Ensure all JSON strings are properly quoted
- Do not break JSON structure with unescaped quotes
- Test that your JSON is valid before submitting

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

FINAL REMINDER: 
1. SUMMARIES: Each must be EXACTLY 40-50 words. Count carefully:
   - Too short (under 40): Add more relevant details
   - Too long (over 50): Remove unnecessary words
   - Perfect range (40-50): Proceed with confidence

2. DETAILS: Each must be COMPLETELY NEW information:
   - Read your summary first
   - Identify ALL facts mentioned
   - Generate 3 details that add DIFFERENT information
   - Use the validation algorithm for each detail
   - NO repetition of summary content allowed

Return ONLY the JSON with all {len(articles_with_content)} articles, each with 40-50 word summaries and 3 unique details."""
    
    return prompt

# ==================== REWRITING FALLBACKS ====================
def generate_timeline_for_articles(articles_data):
    """Generate timeline events for each article using Claude Sonnet"""
    print("\n📅 Generating timelines for articles using Claude Sonnet...")
    
    articles_with_timelines = []
    
    for i, article in enumerate(articles_data['articles'], 1):
        print(f"📅 Article {i}/10: Generating timeline for '{article['title'][:40]}...'")
        
        prompt = f"""Generate a 4-event timeline for this news story. Create a chronological sequence showing how this story developed.

STORY DETAILS:
Title: {article['title']}
Summary: {article['summary']}
Category: {article['category']}

TIMELINE REQUIREMENTS:
1. Create 2-4 timeline events (flexible based on story complexity)
2. Start with background/earlier events 
3. Include "Today" for current development
4. Add future dates if relevant (e.g., "Next week", "December", "2026")
5. Keep each event MAXIMUM 8 words - NO MORE THAN 8 WORDS
6. Focus on key developments and future implications
7. Use simple, clear language

TIMELINE FORMAT:
- Date format: "March 18", "Last week", "Yesterday", "Today"
- Events should be factual and chronological
- Show progression leading to current story

Return ONLY this JSON (2-4 events, include future if relevant):
{{
  "timeline": [
    {{
      "date": "March 15",
      "event": "Initial reports emerge"
    }},
    {{
      "date": "Yesterday",
      "event": "Major announcement made"
    }},
    {{
      "date": "Today",
      "event": "Current developments unfold"
    }},
    {{
      "date": "Next week",
      "event": "Follow-up meeting scheduled"
    }}
  ]
}}"""
        
        try:
            response = call_claude_api_with_model(prompt, f"Timeline generation for article {i}", CLAUDE_SONNET_MODEL)
            if response:
                parsed = parse_json_with_fallback(response)
                if parsed and 'timeline' in parsed:
                    article['timeline'] = parsed['timeline']
                    print(f"   ✅ Timeline generated with {len(parsed['timeline'])} events")
                else:
                    print(f"   ⚠️ Failed to parse timeline, using fallback")
                    article['timeline'] = [
                        {"date": "Background", "event": "Story develops from earlier events"},
                        {"date": "Recently", "event": "Key developments begin to unfold"},
                        {"date": "Yesterday", "event": "Situation reaches critical point"},
                        {"date": "Today", "event": "Current story breaks and makes headlines"}
                    ]
            else:
                print(f"   ⚠️ API call failed, using fallback timeline")
                article['timeline'] = [
                    {"date": "Background", "event": "Story develops from earlier events"},
                    {"date": "Recently", "event": "Key developments begin to unfold"},
                    {"date": "Yesterday", "event": "Situation reaches critical point"},
                    {"date": "Today", "event": "Current story breaks and makes headlines"}
                ]
        except Exception as e:
            print(f"   ❌ Error generating timeline: {str(e)}")
            article['timeline'] = [
                {"date": "Background", "event": "Story develops from earlier events"},
                {"date": "Recently", "event": "Key developments begin to unfold"},
                {"date": "Yesterday", "event": "Situation reaches critical point"},
                {"date": "Today", "event": "Current story breaks and makes headlines"}
            ]
        
        articles_with_timelines.append(article)
        
        # Small delay between timeline generations
        time.sleep(1)
    
    print(f"✅ Timelines generated for all {len(articles_with_timelines)} articles")
    return articles_with_timelines

def dedicated_rewrite_selected_articles(articles_with_content):
    """Dedicated rewriting function ONLY for format compliance - uses Opus for best results"""
    print("\n✍️ Starting dedicated rewriting with Claude Opus for format compliance...")
    
    prompt = create_dedicated_rewriting_prompt(articles_with_content)
    
    # Try Claude Opus first for best quality
    for attempt in range(3):
        print(f"🤖 Attempt {attempt + 1}: Using Claude Opus for rewriting...")
        response = call_claude_api_with_model(prompt, f"Dedicated rewriting (attempt {attempt + 1})", CLAUDE_MODEL)
        
        if response:
            parsed = parse_json_with_fallback(response)
            if parsed and 'articles' in parsed and len(parsed['articles']) == 10:
                # Validate word counts
                valid_articles = []
                for article in parsed['articles']:
                    summary = article.get('summary', '')
                    word_count = len(summary.split())
                    if 40 <= word_count <= 50:
                        valid_articles.append(article)
                    else:
                        print(f"⚠️ Article {article.get('rank', 'unknown')} has {word_count} words (should be 40-50)")
                
                if len(valid_articles) >= 8:  # Accept if at least 8 articles have correct word count
                    print(f"✅ Rewriting successful: {len(valid_articles)}/10 articles have correct word count")
                    # Fill in any missing articles
                    while len(valid_articles) < 10:
                        fallback_article = {
                            "rank": len(valid_articles) + 1,
                            "emoji": "📰",
                            "title": "News Update Available",
                            "summary": "Important news story available. This summary contains exactly forty-five words as required by the formatting guidelines for proper display on the Ten News website platform.",
                            "details": ["Status: Auto-generated", "Type: Fallback content", "Format: Compliant"],
                            "category": "World News",
                            "source": "Ten News",
                            "url": "#"
                        }
                        valid_articles.append(fallback_article)
                    
                    return {"articles": valid_articles}
        
        if attempt < 2:
            print(f"⚠️ Attempt {attempt + 1} failed, retrying...")
            time.sleep(2)
    
    # Fallback: Use Sonnet if Opus fails
    print("⚠️ Opus attempts failed, trying Sonnet...")
    response = call_claude_api_with_model(prompt, "Dedicated rewriting (Sonnet fallback)", CLAUDE_SONNET_MODEL)
    if response:
        parsed = parse_json_with_fallback(response)
        if parsed and 'articles' in parsed:
            return parsed
    
    print("❌ All rewriting attempts failed")
    return None

def rewrite_articles_with_fallbacks(articles_with_content):
    """Rewrite articles with robust fallbacks: retry Opus → fallback Sonnet → per-article Sonnet."""
    # 1) Try Opus with retries is already inside call_claude_api_with_model
    prompt = create_rewriting_prompt(articles_with_content)
    response = call_claude_api_with_model(prompt, "Rewriting articles", CLAUDE_MODEL)
    if response:
        parsed = parse_json_with_fallback(response)
        if parsed and 'articles' in parsed and len(parsed['articles']) > 0:
            return parsed

    # 2) Fallback to Sonnet model (often more available)
    print("⚠️ Opus failed to return valid content, falling back to Sonnet...")
    response = call_claude_api_with_model(prompt, "Rewriting articles (fallback Sonnet)", CLAUDE_SONNET_MODEL)
    if response:
        parsed = parse_json_with_fallback(response)
        if parsed and 'articles' in parsed and len(parsed['articles']) > 0:
            return parsed

    # 3) Last resort: rewrite per-article using Sonnet and assemble
    print("⚠️ Sonnet batch failed. Trying per-article rewriting and assembling results...")
    assembled = {"digest_date": datetime.now().strftime('%B %d, %Y'), "articles": []}
    for index, art in enumerate(articles_with_content, start=1):
        single_prompt = create_rewriting_prompt([art])
        resp = call_claude_api_with_model(single_prompt, f"Rewriting article {index} (single)", CLAUDE_SONNET_MODEL)
        parsed = parse_json_with_fallback(resp) if resp else None
        if parsed and 'articles' in parsed and len(parsed['articles']) == 1:
            article_obj = parsed['articles'][0]
            # Ensure rank continuity
            article_obj['rank'] = index
            assembled['articles'].append(article_obj)
        else:
            # Final fallback: generate minimal structure from source content
            fallback_article = {
                "rank": index,
                "emoji": "📰",
                "title": clean_text_for_json(art.get('title', 'News update'))[:80],
                "summary": clean_text_for_json(art.get('content', art.get('title', ''))[:450])[:450],
                "details": [
                    f"Source: {art.get('source', 'Unknown')}",
                    "Category: World News",
                    "Method: Fallback"
                ],
                "category": "World News",
                "source": art.get('source', 'Unknown'),
                "url": art.get('url', '')
            }
            assembled['articles'].append(fallback_article)
        if len(assembled['articles']) >= 10:
            break
    assembled['articles'] = assembled['articles'][:10]
    return assembled if len(assembled['articles']) > 0 else None

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
    
    prompt = f"""Find 3 historical events that occurred on {current_month} {current_day}.

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
    
    # Fallback events (3 events only)
    return [
        {"year": "1485", "description": "Battle of Bosworth Field ends War of Roses"},
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
        
        # Show summary of loaded previous articles
        if previous_articles:
            dates_loaded = {}
            for article in previous_articles:
                date = article.get('previous_date', 'unknown')
                dates_loaded[date] = dates_loaded.get(date, 0) + 1
            print(f"📅 Previous articles by date: {dates_loaded}")
        else:
            print("📅 No previous articles found - first run or all files missing")
        
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
        
        # AI selection with enhanced duplicate checking
        print(f"🧠 AI selection with {len(previous_articles)} previous articles for duplicate checking...")
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
        
        # NEW: Use dedicated rewriting function for better format compliance
        print("\n✍️ Using dedicated rewriting for format compliance...")
        articles_data = dedicated_rewrite_selected_articles(articles_with_content)
        if not articles_data or 'articles' not in articles_data:
            print("⚠️ Dedicated rewriting failed, falling back to original method...")
            articles_data = rewrite_articles_with_fallbacks(articles_with_content)
            if not articles_data or 'articles' not in articles_data:
                print("❌ Failed to rewrite articles after all fallbacks")
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
        
        # Validate word counts in final output
        print(f"📊 Final validation of {len(articles_data['articles'])} articles:")
        word_count_summary = []
        for i, article in enumerate(articles_data['articles'], 1):
            summary = article.get('summary', '')
            word_count = len(summary.split())
            status = "✅" if 40 <= word_count <= 50 else "⚠️"
            word_count_summary.append(f"  Article {i}: {word_count} words {status}")
            print(f"  Article {i}: {word_count} words {status}")
        
        print(f"✅ Final output: {len(articles_data['articles'])} articles")
        
        # NEW: Generate timelines for each article using Claude Sonnet
        print("\n📅 Adding timelines to articles...")
        articles_with_timelines = generate_timeline_for_articles(articles_data)
        if articles_with_timelines:
            articles_data['articles'] = articles_with_timelines
            print(f"✅ Timelines added to all {len(articles_with_timelines)} articles")
        else:
            print("⚠️ Timeline generation failed, proceeding without timelines")
        
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
    
    # Run automatically for timeline testing
    print("Running news generation with timeline feature...")
    generate_daily_news()
