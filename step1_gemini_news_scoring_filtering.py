#!/usr/bin/env python3
"""
STEP 1: GEMINI NEWS SCORING & FILTERING
==========================================
Purpose: Filter RSS articles down to "must-know" news articles
Model: Gemini 2.5 Flash
Input: RSS articles with title, source, description, url
Output: Approved articles (score ≥70)
"""

import requests
import json
import time
import re
from typing import List, Dict

def _fix_truncated_json(json_text: str) -> List[Dict]:
    """
    Fix truncated JSON responses from Gemini API
    """
    # Clean up the response
    json_text = json_text.strip()
    
    # Remove any leading/trailing non-JSON content
    start_idx = json_text.find('[')
    if start_idx == -1:
        raise ValueError("No JSON array found in response")
    
    json_text = json_text[start_idx:]
    
    # If it doesn't end with ], try to find the last complete object
    if not json_text.endswith(']'):
        # Find the last complete object by looking for }, patterns
        last_complete_idx = -1
        brace_count = 0
        in_string = False
        escape_next = False
        
        for i, char in enumerate(json_text):
            if escape_next:
                escape_next = False
                continue
                
            if char == '\\':
                escape_next = True
                continue
                
            if char == '"' and not escape_next:
                in_string = not in_string
                continue
                
            if not in_string:
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        # Found end of an object
                        last_complete_idx = i
        
        if last_complete_idx > 0:
            # Find the end of this object (including any trailing comma)
            end_idx = last_complete_idx + 1
            while end_idx < len(json_text) and json_text[end_idx] in ', \n\t':
                end_idx += 1
            
            json_text = json_text[:end_idx] + ']'
        else:
            # If we can't find complete objects, just close the array
            json_text = json_text.rstrip(', \n\t') + ']'
    
    # Try to parse the fixed JSON
    try:
        return json.loads(json_text)
    except json.JSONDecodeError as e:
        # Last resort: try to extract individual objects using regex
        objects = re.findall(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', json_text)
        if objects:
            parsed_objects = []
            for obj_str in objects:
                try:
                    parsed_objects.append(json.loads(obj_str))
                except json.JSONDecodeError:
                    continue
            return parsed_objects
        else:
            raise ValueError(f"Could not extract any valid JSON objects: {e}")

def score_news_articles_step1(articles: List[Dict], api_key: str, batch_size: int = 30, max_retries: int = 3) -> Dict:
    """
    Step 1: Score news articles using Gemini API
    
    Args:
        articles: list of dicts with 'title', 'source', 'text' (optional), 'url'
        api_key: Google AI API key
        batch_size: Number of articles to process per API call (default: 30)
        max_retries: Maximum retry attempts for rate limiting (default: 3)
    
    Returns:
        dict with 'approved' and 'filtered' lists
    """
    
    # FILTER OUT ARTICLES WITHOUT IMAGES (User requirement)
    articles_with_images = []
    articles_without_images = []
    
    for article in articles:
        image_url = article.get('image_url')
        if image_url and image_url.strip():  # Has valid image URL
            articles_with_images.append(article)
        else:
            articles_without_images.append(article)
    
    if articles_without_images:
        print(f"   ⚠️  Filtered {len(articles_without_images)} articles WITHOUT images")
    
    if not articles_with_images:
        print(f"   ❌ No articles with images to score!")
        return {
            "approved": [],
            "filtered": articles_without_images
        }
    
    print(f"   ✅ Scoring {len(articles_with_images)} articles WITH images")
    
    # Continue with articles that have images
    articles = articles_with_images
    
    # Use gemini-2.0-flash-exp as gemini-2.5-flash may not be available yet
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key={api_key}"
    
    # Process articles in batches to avoid rate limits
    if len(articles) > batch_size:
        print(f"📦 Processing {len(articles)} articles in batches of {batch_size}...")
        all_approved = []
        all_filtered = []
        
        for i in range(0, len(articles), batch_size):
            batch = articles[i:i + batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (len(articles) + batch_size - 1) // batch_size
            
            print(f"  Processing batch {batch_num}/{total_batches} ({len(batch)} articles)...")
            
            try:
                batch_result = _process_batch(batch, url, api_key, max_retries)
                all_approved.extend(batch_result['approved'])
                all_filtered.extend(batch_result['filtered'])
                
                # Delay between batches to avoid rate limits (except for last batch)
                if i + batch_size < len(articles):
                    time.sleep(2)  # 2 second delay between batches
                    
            except Exception as e:
                print(f"  ❌ Batch {batch_num} failed: {e}")
                # Mark batch articles as filtered on error
                for article in batch:
                    article['category'] = 'Other'
                    article['score'] = 0
                    article['status'] = 'FILTERED'
                all_filtered.extend(batch)
        
        # Add articles without images to filtered list
        all_filtered.extend(articles_without_images)
        
        return {
            "approved": all_approved,
            "filtered": all_filtered
        }
    else:
        # Single batch - use existing logic
        result = _process_batch(articles, url, api_key, max_retries)
        # Add articles without images to filtered list
        result['filtered'].extend(articles_without_images)
        return result


def _process_batch(articles: List[Dict], url: str, api_key: str, max_retries: int = 3) -> Dict:
    """
    Process a single batch of articles with retry logic for rate limiting
    
    Args:
        articles: Batch of articles to process
        url: Gemini API URL
        api_key: Google AI API key
        max_retries: Maximum retry attempts
    
    Returns:
        dict with 'approved' and 'filtered' lists
    """
    
    system_prompt = """# TEN NEWS V8.2 SCORING PROMPT - GLOBAL RELEVANCE EDITION 🌍



## 🚫 CRITICAL: FILTER OUT THESE STORIES FIRST



**Before scoring ANY article, check if it falls into these categories. If YES, automatically score LOW (650-700) or REJECT:**



### **❌ HUMAN INTEREST SOB STORIES (Auto-score: 650-700)**

These are emotional stories about individuals, NOT news:

- Cancer patients writing letters

- Death tributes/memorials (unless world leader/major celebrity)

- Personal disease/illness stories

- Overdose/suicide stories

- "Inspiring" individual struggles

- Family heartbreak stories

- Personal tragedies



**Keywords to watch:** cancer, writes cards, milestone, tribute, memorial, overdose, heartbreak, inspiring story, touching, emotional, personal struggle, brave battle, final wish



**Examples to REJECT:**

- ❌ "Mother with Stage 4 Cancer Writes Milestone Cards" → 650 (sob story)

- ❌ "Tyler Henry Has Memory Issues After Brain Surgery" → 650 (personal health)

- ❌ "Family's Heartbreaking Tribute to Lost Son" → 650 (personal tragedy)



---



### **❌ STOCK ANALYSIS / INVESTMENT FLUFF (Auto-score: 700-720)** ⭐ NEW

These are investor-focused articles that average readers don't care about:

- Stock price predictions/targets

- Analyst ratings (upgrade/downgrade)

- "Stocks to buy/sell" articles

- ETF recommendations

- Portfolio advice

- Market speculation

- Index rebalancing news

- Routine market movements ("stocks rise/fall")

- Individual company stock analysis



**Keywords to watch:** stock target, price target, analyst rating, upgrade, downgrade, buy rating, sell rating, outperform, underperform, stocks to buy, ETF pick, portfolio, rebalancing, stocks rise, stocks fall, investor tip, hidden gem for investors



**Examples to REJECT:**

- ❌ "Nvidia Stock Targets $300 by 2026" → 720 (stock prediction)

- ❌ "2 Stocks Surge Past Nvidia Performance" → 720 (stock comparison)

- ❌ "Occidental Petroleum Faces Analyst Review" → 700 (analyst opinion)

- ❌ "Vanguard ETF Emerges as Buy-and-Hold Pick" → 700 (investment advice)

- ❌ "Stocks Rise on Soft September Data" → 720 (routine market)

- ❌ "Carvana Joins S&P 500 in Rebalancing" → 720 (index news)

- ❌ "Wall Street Targets 2026 Stock Gains" → 720 (speculation)



**EXCEPTION - These finance stories ARE globally relevant (850+):**

- ✅ Central bank decisions (Fed raises rates, ECB policy)

- ✅ Major crashes/surges (market drops 5%+)

- ✅ Billionaire warnings (Ray Dalio, Warren Buffett)

- ✅ Major bank news (UBS layoffs, Goldman scandal)

- ✅ Currency crises (Yen collapse, etc.)



---



### **❌ LIFESTYLE FLUFF (Auto-score: 650-700)**

These are tips, guides, and human interest features, NOT news:

- Tipping etiquette guides

- Chef reveals/expert tips

- "How to" articles

- "Best way to" guides

- Celebrity advice/tips

- Lifestyle trends

- Personal habits/routines

- Listicles (Top 10, Best 5, etc.)



**Keywords to watch:** chef reveals, expert says, tips for, how to, guide to, best way, secrets, tricks, etiquette, advice, top 10, best 5, ways to, reasons why



**Examples to REJECT:**

- ❌ "Chef Reveals Proper Tipping Etiquette" → 650 (lifestyle fluff)

- ❌ "Expert Shares Best Way to Cook Turkey" → 650 (advice article)

- ❌ "10 Tips for Better Sleep" → 650 (listicle)

- ❌ "Top 10 Reasons New Businesses Fail" → 650 (listicle)



---



### **❌ LOCAL/REGIONAL NEWS (Auto-score: 650-700)**

These are hyper-local stories with no global relevance:



**US Local (Auto-reject unless involves federal government or global company):**

- State-level politics (Arizona, Michigan, Texas, Florida, etc.)

- City crime (Chicago shooting, NYC subway, etc.)

- Local disasters (unless 100+ deaths)

- County/municipal news

- State court cases (unless Supreme Court)



**US States to watch:** Alabama, Alaska, Arizona, Arkansas, California, Colorado, Connecticut, Delaware, Florida, Georgia, Hawaii, Idaho, Illinois, Indiana, Iowa, Kansas, Kentucky, Louisiana, Maine, Maryland, Massachusetts, Michigan, Minnesota, Mississippi, Missouri, Montana, Nebraska, Nevada, New Hampshire, New Jersey, New Mexico, New York (local), North Carolina, North Dakota, Ohio, Oklahoma, Oregon, Pennsylvania, Rhode Island, South Carolina, South Dakota, Tennessee, Texas, Utah, Vermont, Virginia, Washington, West Virginia, Wisconsin, Wyoming



**US Cities (local news):** Chicago, Houston, Phoenix, Philadelphia, San Antonio, San Diego, Dallas, Austin, Jacksonville, Columbus, Charlotte, Indianapolis, Denver, Detroit, Nashville, Portland, Las Vegas, Baltimore, Milwaukee, Atlanta, Miami, Oakland, Minneapolis, Cleveland, Pittsburgh



**UK Local (Auto-reject unless national policy):**

- City-specific news (Manchester, Birmingham, Leeds, Liverpool, Bristol, etc.)

- Regional festivals/events

- Local council decisions



**Other Regional:**

- District/municipality announcements

- Regional festivals/ceremonies

- Village/town news

- State-level politics (India, etc.)



**Keywords to watch:** district, municipality, local, regional, constituency, county, village, township



**Examples to REJECT:**

- ❌ "Michigan Man Charged in Fatal Shooting" → 650 (local crime)

- ❌ "Chicago Police Investigate Robbery" → 650 (local crime)

- ❌ "Arizona Congresswoman Pepper Sprayed at Protest" → 680 (local politics)

- ❌ "14 Legionnaires' Cases Hit Florida Gym" → 650 (local health)

- ❌ "Teen Charged with Arson in NYC Subway" → 650 (local crime)

- ❌ "Texas Flood Victims Make 911 Pleas" → 700 (local disaster)

- ❌ "Birmingham Restaurant Wins Pizza Award" → 650 (local fluff)



---



## ✅ WHAT WE WANT: GLOBALLY RELEVANT NEWS



**THESE should score 850-950:**



---



### **🌍 INTERNATIONAL/GLOBAL EVENTS (900-950)**

**MUST-KNOW NEWS - Always start at 900 minimum!**



**Automatic 900+ triggers:**

- Major conflicts, wars, peace deals (Gaza, Ukraine, etc.)

- Superpower actions (US, China, Russia, EU, India major policy)

- Multiple countries involved (trade wars, treaties, summits)

- Border openings/closings affecting millions

- UN/NATO/EU/WHO major decisions

- Military escalations, nuclear threats

- Terrorist attacks (international)

- Global health emergencies

- Major disasters (100+ deaths OR affects millions)

- Refugee/migration crises

- International sanctions/trade wars



**Multi-Country Bonus (IMPORTANT):**

- Story involves 2 major countries: +15 points

- Story involves 3+ major countries: +25 points



**Major Countries List:** US, China, Russia, UK, Germany, France, Japan, India, Brazil, Australia, Canada, South Korea, Italy, Spain, Mexico, Indonesia, Saudi Arabia, Israel, Iran, Ukraine, Taiwan, EU, NATO



**Examples:**

- ✅ "NATO Ministers Say Putin Rejects Ukraine Peace" → **930** (900 + Russia/NATO + breaking)

- ✅ "US and China Trade War Escalates" → **935** (900 + 2 superpowers +25 + trade impact +10)

- ✅ "Israel Opens Rafah Gate for Gaza Evacuations" → **925** (900 + humanitarian +15 + breaking +10)

- ✅ "Asia's Deadly Floods Kill Over 1,000 People" → **940** (900 + 1000+ deaths +20 + multiple countries +15)

- ✅ "EU Launches Antitrust Probe into Meta" → **920** (900 + EU + global tech company)

- ✅ "Macron Arrives in China for Ukraine Talks" → **935** (900 + France/China/Ukraine = 3 countries +25)



---



### **💼 BIG BUSINESS/DEALS (850-950)**

- M&A deals $1B+ (especially household brands)

- Billionaire business moves

- Major company strategy shifts

- Corporate scandals (high profile)

- Antitrust investigations

- Major layoffs/restructuring (10,000+ employees)



**Global Companies that boost score:**

Apple, Google, Microsoft, Amazon, Meta, Netflix, Tesla, Nvidia, OpenAI, Samsung, Disney, Nike, Coca-Cola, McDonald's, Toyota, Boeing, Airbus, Pfizer, Goldman Sachs, JPMorgan, LVMH, Alibaba, Tencent, etc.



**Examples:**

- ✅ "Netflix Acquires Warner Bros for $83 Billion" → **940** (850 + household brands +20 + $83B +20 + industry impact +15 + breaking +10)

- ✅ "Hermès Heir Sues Over $25B Missing Shares" → **900** (850 + luxury brand +15 + $25B +20 + scandal +15)

- ✅ "Amazon Faces EU Antitrust Investigation" → **920** (850 + Amazon +20 + EU +15 + regulatory +10)



---



### **🚀 TECH (Consumer-Relevant) (850-920)**

- Consumer product launches (AI phones, major releases)

- Tech policy affecting users (privacy, government bans)

- Major platform changes (affects millions)

- AI breakthroughs (ChatGPT, etc.)

- Tech company strategy shifts

- Cybersecurity (major breaches)



**Global Tech Companies:** Apple, Google, Microsoft, Amazon, Meta, Nvidia, Tesla, OpenAI, Anthropic, DeepMind, Samsung, TikTok, ByteDance, Netflix, Spotify, Uber, Airbnb, Huawei, Xiaomi, Alibaba, Tencent



**AI Terms that boost score:** AI, artificial intelligence, ChatGPT, GPT-4, GPT-5, Claude, Gemini, machine learning, neural network, large language model, LLM



**Examples:**

- ✅ "OpenAI Releases GPT-5 with Major Breakthrough" → **920** (850 + OpenAI +20 + AI +20 + breakthrough +15)

- ✅ "Apple Announces AI-Powered iPhone Features" → **910** (850 + Apple +20 + AI +20 + consumer product +15)

- ✅ "Meta, DeepSeek, Xai Earn Worst AI Safety Grades" → **900** (850 + multiple tech companies +15 + AI +20 + regulatory +10)

- ❌ "Instagram Users Struggle with Repost Button" → 750 (minor UX issue, not major news)



---



### **💰 FINANCE & MARKETS (850-920)** ⭐ NEW IN V8.2

**ONLY major events that affect everyone - NOT stock tips or analyst opinions!**



**✅ WHAT WE WANT (850-920):**

- Central bank decisions (Federal Reserve, ECB, Bank of England, Bank of Japan)

- Interest rate changes

- Major stock market crashes/surges (5%+ moves)

- Currency crises

- Global recession/inflation news

- Billionaire warnings (Ray Dalio, Buffett, etc.)

- Major bank scandals/layoffs (10,000+ employees)

- Government debt crises



**❌ WHAT WE DON'T WANT (Filter at 700-720):**

- Stock price predictions/targets

- Analyst ratings (upgrade/downgrade)

- Individual stock analysis

- ETF recommendations

- "Stocks to buy" articles

- Routine market movements

- Index rebalancing news

- Portfolio advice



**Finance Terms that boost score:** Federal Reserve, Fed, ECB, interest rate, central bank, recession, inflation, currency crisis, debt crisis, bank collapse



**Examples:**

- ✅ "Federal Reserve Raises Interest Rates" → **890** (affects everyone globally)

- ✅ "Global Markets Crash 7% on Trade War Fears" → **910** (major crash)

- ✅ "Japan's Yen Falls to 30-Year Low" → **880** (currency crisis)

- ✅ "Ray Dalio Warns America Faces Debt Spiral" → **870** (famous billionaire warning)

- ✅ "UBS Plans 10,000 Job Cuts" → **860** (major bank, mass layoffs)

- ❌ "Stocks Rise on Soft September Data" → **720** (routine, filter out)

- ❌ "Nvidia Stock Targets $300 by 2026" → **720** (stock prediction, filter out)

- ❌ "Occidental Petroleum Faces Analyst Review" → **700** (analyst opinion, filter out)

- ❌ "2 Stocks Surge Past Nvidia Performance" → **720** (stock comparison, filter out)



---



### **₿ CRYPTO & BLOCKCHAIN (850-900)** ⭐ NEW IN V8.2

- Bitcoin major price movements ($5K+ swings)

- Major crypto regulatory decisions

- Exchange collapses/scandals (FTX-level)

- Institutional adoption news

- Stablecoin news (affects markets)



**Crypto Terms:** Bitcoin, BTC, Ethereum, ETH, crypto, cryptocurrency, blockchain, DeFi, NFT, Binance, Coinbase, stablecoin



**Examples:**

- ✅ "Bitcoin Surges Past $100,000" → **890** (850 + Bitcoin +15 + milestone +20)

- ✅ "SEC Approves Bitcoin ETF" → **900** (850 + regulatory +20 + institutional impact +25)

- ⚠️ "Bitcoin Choppy Below $95K" → 780 (routine price movement)

- ⚠️ "Altcoin XYZ Launches New Feature" → 700 (niche crypto)



---



### **🔬 SCIENCE BREAKTHROUGHS (850-920)**

- Medical breakthroughs (cancer cure, new treatments)

- Space discoveries (NASA, ESA, major missions)

- Climate science (major findings)

- Physics/quantum breakthroughs

- Nobel Prize announcements



**Science Terms that boost score:** breakthrough, discovery, NASA, ESA, SpaceX, Mars, Moon, quantum, CERN, vaccine, cure, treatment, clinical trial, Nobel Prize, peer-reviewed, Nature, Science



**Only if:** Average person can understand and impact is clear



**Examples:**

- ✅ "NASA Confirms Discovery of Water on Mars" → **920** (850 + NASA +20 + major discovery +25 + space +15)

- ✅ "CERN Scientists Discover New Particle" → **890** (850 + CERN +15 + physics breakthrough +20)

- ✅ "Hamilton Smith, Nobel Laureate, Dies at 94" → **870** (850 + Nobel Prize +15)

- ⚠️ "Taxonomist Discovers 1,700 New Spider Species" → 780 (interesting but niche)



---



### **🏥 HEALTH & MEDICINE (850-920)** ⭐ EXPANDED IN V8.2

- WHO announcements/emergencies

- Pandemic/epidemic news

- Major vaccine developments

- Drug approvals (affects millions)

- Global health crises

- Major medical breakthroughs



**Health Terms that boost score:** WHO, World Health, pandemic, epidemic, outbreak, vaccine, FDA approved, clinical trial, cancer cure, breakthrough treatment, Pfizer, Moderna



**Examples:**

- ✅ "WHO Declares New Global Health Emergency" → **930** (900 + WHO +15 + global emergency +15)

- ✅ "Pfizer Announces Cancer Vaccine Breakthrough" → **910** (850 + Pfizer +15 + cancer +20 + breakthrough +20)

- ✅ "Bird Flu Outbreak Spreads to 10 Countries" → **920** (900 + outbreak +10 + multiple countries +15)

- ⚠️ "14 Legionnaires' Cases Hit Florida Gym" → 650 (local health issue)



---



### **🏆 GLOBAL SPORTS (850-900)** ⭐ NEW IN V8.2

**Only major international events - NOT routine league matches!**



- World Cup (FIFA, Rugby, Cricket)

- Olympics (Summer, Winter)

- Champions League Finals

- Major tennis Grand Slams (finals)

- Formula 1 Championship

- World records

- Major athlete news (Messi, Ronaldo, LeBron level)



**Sports Events that score high:** World Cup, Olympics, Olympic, Champions League, Premier League (major news only), Wimbledon, US Open, Australian Open, French Open, Super Bowl, F1, Formula 1, Grand Prix



**Global Athletes:** Messi, Ronaldo, Cristiano, LeBron, Curry, Djokovic, Nadal, Federer, Serena, Hamilton, Verstappen



**Examples:**

- ✅ "World Cup Final Breaks Viewership Records" → **900** (850 + World Cup +25 + record +15)

- ✅ "Olympics Committee Announces 2036 Host City" → **880** (850 + Olympics +20)

- ✅ "Messi Announces Retirement from Football" → **890** (850 + global celebrity +25 + major news +15)

- ⚠️ "Liverpool vs Arsenal Premier League Match" → 720 (routine match)

- ❌ "Texas High School Football Wins State" → 650 (local sports)



---



### **💎 CONSUMER FASCINATION (850-950)**

- Luxury brand drama

- Extreme wealth/exclusivity stories

- Mind-blowing statistics (99%, 1000%)

- Viral trends with substance

- Record-breaking purchases



**Examples:**

- ✅ "Ferrari Rejects 99% of Buyers as Unworthy" → **910** (850 + luxury +15 + mind-blowing stat +25 + exclusivity +15)

- ✅ "Fabergé Winter Egg Fetches Record £22.9M" → **890** (850 + luxury +15 + record +20)

- ✅ "Telegram Runs on Only 30 Employees" → **900** (850 + tech +15 + mind-blowing stat +25)



---



## 🎯 V8.2 SCORING FORMULA



### **STEP 1: FILTER CHECK (Critical)**



❌ Is this a sob story? → Score 650, STOP

❌ Is this lifestyle fluff/listicle? → Score 650, STOP

❌ Is this local/regional news? → Score 650-700, STOP

❌ Is this routine sports (not World Cup/Olympics)? → Score 720, STOP

❌ Is this stock analysis/investment advice? → Score 700-720, STOP ⭐ NEW



✅ If passed all filters, proceed to Step 2



---



### **STEP 2: DETERMINE BASE SCORE**



**🌍 MAJOR WORLD NEWS → Start at 900**

Triggers: War, peace deals, superpowers (US/China/Russia/EU), UN/NATO, disasters 100+ deaths, nuclear, sanctions, borders, refugees



**💼 BUSINESS/TECH/FINANCE → Start at 850**

Triggers: Global companies, $1B+ deals, AI, tech giants, central banks, major market moves



**🔬 SCIENCE/HEALTH → Start at 850**

Triggers: NASA, WHO, breakthroughs, discoveries, Nobel, vaccines, medical advances



**🏆 GLOBAL SPORTS → Start at 850**

Triggers: World Cup, Olympics, Champions League finals, world records



**💎 CONSUMER FASCINATION → Start at 850**

Triggers: Luxury brands, billionaires, mind-blowing stats, records



**📰 OTHER NEWS → Start at 750-800**

Adjust based on global relevance



---



### **STEP 3: APPLY BONUSES**



**Multi-Country Bonus (IMPORTANT - New in V8.2):**

- 2 major countries involved: +15

- 3+ major countries involved: +25



**Impact Bonuses:**

- Affects 100M+ people: +20

- Deaths 1000+: +25

- Deaths 100-999: +15

- Deaths 10-99: +10

- Major policy shift: +15

- First-ever event: +20

- Record-breaking: +15

- Breaking news (<24h): +10



**Entity Bonuses:**

- World leader (Putin, Xi, Trump, etc.): +20

- Global tech company: +15

- $1B+ amount mentioned: +20

- Household brand: +15

- Mind-blowing stat (99%, 1000x): +20



---



### **STEP 4: APPLY PENALTIES**



**Content Penalties:**

- Too technical/hard to explain: -20

- Niche audience only: -15

- Celebrity gossip (not business): -20

- Depressing only (no action/hope): -10

- Question headline: -10



**Already Filtered (shouldn't reach here):**

- Local crime: -40

- Sob story: -40

- Lifestyle fluff: -30



---



### **STEP 5: FINAL SCORE**



- Maximum: **950**

- Major World News minimum: **900**

- Good Global News minimum: **850**

- Average News: **750-849**

- Weak/Niche: **700-749**

- Filtered/Reject: **650-699**



---



## 📊 V8.2 EXAMPLES



### **✅ CORRECTLY SCORED (High):**



**"NATO Ministers Say Putin Rejects Ukraine Peace"**

- Base: 900 (major world news)

- Multi-country (NATO + Russia + Ukraine): +25

- World leader (Putin): +0 (already in base)

- Breaking: +10

- **Final: 935**



**"Netflix Acquires Warner Bros for $83 Billion"**

- Base: 850 (business)

- Household brands (Netflix + Warner): +20

- $83B amount: +20

- Industry-changing: +15

- **Final: 905**



**"Federal Reserve Raises Interest Rates"**

- Base: 850 (finance)

- Fed (major institution): +20

- Affects global markets: +15

- **Final: 885**



**"World Cup Final Draws 1.5 Billion Viewers"**

- Base: 850 (global sports)

- World Cup: +25

- Record viewership: +15

- **Final: 890**



**"Bitcoin Surges Past $100,000"**

- Base: 850 (crypto)

- Bitcoin: +15

- Milestone/record: +20

- **Final: 885**



---



### **❌ CORRECTLY FILTERED (Low):**



**"Michigan Man Charged in Fatal Shooting"**

- Filter: Local US crime

- **Final: 650**



**"14 Legionnaires' Cases Hit Florida Gym"**

- Filter: Local US health

- **Final: 650**



**"Chef Reveals Tipping Etiquette"**

- Filter: Lifestyle fluff

- **Final: 650**



**"Top 10 Reasons New Businesses Fail"**

- Filter: Listicle

- **Final: 650**



**"Texas High School Football Wins State"**

- Filter: Local sports

- **Final: 650**



**"Arizona Congresswoman Pepper Sprayed"**

- Filter: Local US politics

- **Final: 680**



---



## 📋 V8.2 QUALITY CHECKLIST



### **Filter Questions (If YES → Score 650-720):**

- [ ] Is this about an individual's personal tragedy/health?

- [ ] Is this giving tips/advice/how-to?

- [ ] Is this a listicle (Top 10, Best 5)?

- [ ] Is this local crime (US state/city)?

- [ ] Is this local politics (state level)?

- [ ] Is this regional news with no global impact?

- [ ] Is this routine sports (not World Cup/Olympics)?

- [ ] Is this stock analysis/price prediction? ⭐ NEW

- [ ] Is this analyst ratings (upgrade/downgrade)? ⭐ NEW

- [ ] Is this investment advice/ETF picks? ⭐ NEW

- [ ] Is this routine market movement ("stocks rise")? ⭐ NEW



### **Global Relevance Questions (If YES → Score 850+):**

- [ ] Does this involve multiple major countries?

- [ ] Does this affect millions of people?

- [ ] Is this about a global company/leader?

- [ ] Would BBC/CNN/NYT headline this?

- [ ] Would someone in London, Tokyo, AND São Paulo care?



### **Score Calibration:**

- [ ] Am I using 900+ for major world news?

- [ ] Am I giving multi-country bonus (+15/+25)?

- [ ] Am I properly filtering local US news?

- [ ] Am I scoring Finance/Crypto appropriately?

- [ ] Am I recognizing global sports events?



---



## 📋 V8.2 TARGETS



**Score Distribution (per 100 articles):**

- 900-950: 10-15 articles ✅

- 850-899: 20-25 articles ✅

- 800-849: 20-25 articles ✅

- 750-799: 15-20 articles ✅

- 700-749: 10-15 articles ✅

- 650-699: 10-15 articles ✅ (filtered)



**Category Balance in Daily Top 10:**

- International/World: 3-4 articles (30-40%)

- Business/Finance: 2-3 articles (20-30%)

- Tech/AI: 1-2 articles (10-20%)

- Science/Health: 1 article (10%)

- Consumer/Sports (major): 1 article (10%)



**Must Have 0 in Top 20:**

- ❌ Local crime stories

- ❌ Sob stories

- ❌ Lifestyle fluff/listicles

- ❌ Regional festivals

- ❌ State-level politics



---



## 🆕 V8.2 CHANGES FROM V8.1



### **Added:**

1. ✅ **Finance/Markets section** - Fed, ECB, major crashes (NOT stock tips)

2. ✅ **Crypto section** - Bitcoin, major crypto news

3. ✅ **Multi-country bonus** - +15 for 2 countries, +25 for 3+

4. ✅ **Global Sports section** - World Cup, Olympics score high

5. ✅ **Expanded Health** - WHO, pandemics, not just breakthroughs

6. ✅ **Comprehensive local US filter** - All 50 states + major cities

7. ✅ **UK local filter** - Regional cities

8. ✅ **Stock analysis filter** - Blocks analyst ratings, price targets, investment advice ⭐ NEW



### **Fixed:**

1. ✅ Sports no longer auto-penalized (major events score 850+)

2. ✅ Finance properly scoped (major events only, NOT stock tips)

3. ✅ Better local crime filtering

4. ✅ Multi-country stories get deserved bonus

5. ✅ Stock analysis/investment fluff filtered out ⭐ NEW



---



## 🎯 V8.2 IS READY!



**This version gives you:**

- ✅ True global relevance scoring

- ✅ Proper Finance/Crypto coverage

- ✅ Multi-country bonus system

- ✅ Global sports recognition

- ✅ Comprehensive local news filtering

- ✅ All news categories valued appropriately



**Expected Daily Top 10:**

- 3-4 International (NATO, UN, wars, treaties)

- 2-3 Business/Finance (deals, Fed, markets)

- 1-2 Tech/AI (OpenAI, Apple, major launches)

- 1 Science/Health (breakthroughs, WHO)

- 1 Global Sports/Consumer (World Cup, luxury)



**Filtered Out:**

- ❌ Local US crime

- ❌ State politics

- ❌ Sob stories

- ❌ Lifestyle fluff

- ❌ Regional news



🌍 **Use V8.2 for truly global news curation!**



## OUTPUT FORMAT

Return ONLY valid JSON array with exactly this structure for each article:

[
  {
    "title": "exact article title here",
    "score": 750,
    "status": "APPROVED",
    "category": "Technology"
  },
  {
    "title": "another article title",
    "score": 650,
    "status": "FILTERED",
    "category": "Business"
  }
]

Rules:
- status = "APPROVED" if score >= 70
- status = "FILTERED" if score < 70
- Include category field for all articles
- Maintain order of input articles
- No explanations or additional fields
- Valid JSON only"""

    # Prepare articles for scoring
    articles_text = "Score these news articles based on must-know criteria. Return JSON array only.\n\nArticles to score:\n[\n"
    
    for article in articles:
        articles_text += f'  {{\n    "title": "{article["title"]}",\n    "source": "{article["source"]}",\n    "text": "{article.get("text", "")[:500]}",\n    "url": "{article["url"]}"\n  }},\n'
    
    articles_text += "]\n\nEvaluate each article and return JSON array with title, score (0-1000), and status (APPROVED if >=70, FILTERED if <70)."
    
    # Prepare request
    request_data = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": articles_text
                    }
                ]
            }
        ],
        "systemInstruction": {
            "parts": [
                {
                    "text": system_prompt
                }
            ]
        },
        "generationConfig": {
            "temperature": 0.3,
            "topK": 40,
            "topP": 0.95,
            "maxOutputTokens": 8192,
            "responseMimeType": "application/json"
        }
    }
    
    # Retry logic for rate limiting
    for attempt in range(max_retries):
        try:
            # Make API request
            response = requests.post(url, json=request_data, timeout=120)
            
            # Handle rate limiting (429) with exponential backoff
            if response.status_code == 429:
                wait_time = (2 ** attempt) * 2  # Exponential backoff: 2s, 4s, 8s
                if attempt < max_retries - 1:
                    print(f"  ⚠️ Rate limited (429), waiting {wait_time}s before retry {attempt + 1}/{max_retries}...")
                    time.sleep(wait_time)
                    continue
                else:
                    print(f"  ❌ Rate limit exceeded after {max_retries} attempts")
                    raise requests.exceptions.HTTPError(f"429 Too Many Requests after {max_retries} retries")
            
            response.raise_for_status()
            
            # Parse response
            result = response.json()
            
            # Extract text from response
            if 'candidates' in result and len(result['candidates']) > 0:
                candidate = result['candidates'][0]
                
                # Check for safety ratings or blocked content
                if 'finishReason' in candidate:
                    finish_reason = candidate['finishReason']
                    if finish_reason != 'STOP':
                        print(f"⚠️ Gemini response finished with reason: {finish_reason}")
                        if finish_reason in ['SAFETY', 'RECITATION', 'OTHER']:
                            print(f"❌ Content blocked or filtered by Gemini")
                            if 'safetyRatings' in candidate:
                                print(f"Safety ratings: {candidate['safetyRatings']}")
                            return {"approved": [], "filtered": articles}
                
                if 'content' in candidate and 'parts' in candidate['content']:
                    response_text = candidate['content']['parts'][0]['text']
                else:
                    print(f"❌ No content in candidate. Candidate structure: {json.dumps(candidate, indent=2)[:500]}")
                    raise ValueError("No valid content in Gemini response")
            else:
                print(f"❌ No candidates in result. Result structure: {json.dumps(result, indent=2)[:500]}")
                raise ValueError("No valid response from Gemini API")
            
            # Parse JSON response with robust error handling
            scored_articles = None
            
            try:
                scored_articles = json.loads(response_text)
            except json.JSONDecodeError as e:
                print(f"⚠️ JSON parse error: {e}")
                print(f"Response text: {response_text[:500]}...")
                
                # Try to fix truncated JSON response
                try:
                    scored_articles = _fix_truncated_json(response_text)
                    print(f"✅ Fixed truncated JSON - recovered {len(scored_articles)} articles")
                except Exception as fix_error:
                    print(f"❌ Could not fix JSON: {fix_error}")
                    print("❌ Could not parse JSON response")
                    return {"approved": [], "filtered": articles}
            
            # Separate approved and filtered articles
            approved = []
            filtered = []
            
            for scored_article in scored_articles:
                # Find original article
                original_article = None
                for article in articles:
                    if article['title'] == scored_article['title']:
                        original_article = article
                        break
                
                if original_article:
                    # Add score, status, and category to original article
                    original_article['score'] = scored_article['score']
                    original_article['status'] = scored_article['status']
                    original_article['category'] = scored_article.get('category', 'Other')
                    
                    # Validate category - update to match actual categories from Gemini
                    valid_categories = ['World', 'Politics', 'Business', 'Economy', 'Technology', 'Science', 'Health', 'Sports', 'Lifestyle', 
                                       'Environment', 'International', 'Culture', 'Disaster', 'Other']
                    if original_article['category'] not in valid_categories:
                        # Map common variations to valid categories (comprehensive mapping)
                        category_mapping = {
                            # Business & Finance
                            'Economy': 'Business',
                            'Economics': 'Business',
                            'Finance': 'Business',
                            'Markets': 'Business',
                            'Companies': 'Business',
                            'Global Economy': 'Business',
                            
                            # Culture & Entertainment
                            'Entertainment': 'Culture',
                            'Art': 'Culture',
                            'Arts': 'Culture',
                            'History': 'Culture',
                            'Religion': 'Culture',
                            
                            # Environment & Climate
                            'Weather': 'Environment',
                            'Climate': 'Environment',
                            'Energy': 'Environment',
                            
                            # Science & Technology
                            'Physics': 'Science',
                            'Biology': 'Science',
                            'Medicine': 'Science',
                            'Space': 'Science',
                            'Social Science': 'Science',
                            
                            # International & World
                            'World Affairs': 'International',
                            'World News': 'International',
                            'Military': 'International',
                            
                            # Lifestyle
                            'Education': 'Lifestyle',
                            'Shopping': 'Lifestyle',
                            'Home Improvement': 'Lifestyle',
                            'Real Estate': 'Lifestyle',
                            
                            # Other
                            'News': 'Other',
                            'General News': 'Other',
                            'Top News': 'Other',
                            'Law': 'Other',
                            'Security': 'Other'
                        }
                        mapped_category = category_mapping.get(original_article['category'], 'Other')
                        print(f"   📝 Mapped '{original_article['category']}' to '{mapped_category}' for: {original_article['title'][:50]}...")
                        original_article['category'] = mapped_category
                    
                    if scored_article['status'] == 'APPROVED':
                        approved.append(original_article)
                    else:
                        filtered.append(original_article)
            
            return {
                "approved": approved,
                "filtered": filtered
            }
            
        except requests.exceptions.HTTPError as e:
            if e.response and e.response.status_code == 429:
                # Already handled above, but catch here if it slips through
                if attempt < max_retries - 1:
                    continue
            # Re-raise other HTTP errors or if retries exhausted
            if attempt == max_retries - 1:
                print(f"❌ API request failed after {max_retries} attempts: {e}")
                # Assign default categories when API fails
                for article in articles:
                    article['category'] = 'Other'
                    article['score'] = 0
                    article['status'] = 'FILTERED'
                return {"approved": [], "filtered": articles}
            raise
        except requests.exceptions.RequestException as e:
            if attempt < max_retries - 1:
                wait_time = (2 ** attempt) * 1
                print(f"  ⚠️ Request error (attempt {attempt + 1}/{max_retries}): {e}")
                print(f"  Waiting {wait_time}s before retry...")
                time.sleep(wait_time)
                continue
            # After all retries exhausted
            print(f"❌ API request failed after {max_retries} attempts: {e}")
            for article in articles:
                article['category'] = 'Other'
                article['score'] = 0
                article['status'] = 'FILTERED'
            return {"approved": [], "filtered": articles}
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            # Assign default categories when any error occurs
            for article in articles:
                article['category'] = 'Other'
                article['score'] = 0
                article['status'] = 'FILTERED'
            return {"approved": [], "filtered": articles}

if __name__ == "__main__":
    # Test the function
    test_articles = [
        {
            "title": "European Central Bank raises interest rates to 4.5 percent",
            "source": "Reuters",
            "text": "The ECB announced Thursday it is raising rates by 0.25 percentage points to combat inflation.",
            "url": "https://www.reuters.com/markets/europe/ecb-rates-2024"
        },
        {
            "title": "Celebrity couple announces divorce",
            "source": "Entertainment Weekly",
            "text": "",
            "url": "https://ew.com/celebrity-divorce"
        }
    ]
    
    api_key = "YOUR_API_KEY_HERE"
    results = score_news_articles_step1(test_articles, api_key)
    print(f"Approved: {len(results['approved'])}")
    print(f"Filtered: {len(results['filtered'])}")