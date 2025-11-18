#!/usr/bin/env python3
"""
STEP 1: GEMINI NEWS SCORING & FILTERING
==========================================
Purpose: Filter RSS articles down to "must-know" news articles
Model: Gemini 2.5 Flash
Input: RSS articles with title, source, description, url
Output: Approved articles (score ≥700)
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
        
        return {
            "approved": all_approved,
            "filtered": all_filtered
        }
    else:
        # Single batch - use existing logic
        return _process_batch(articles, url, api_key, max_retries)


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
    
    system_prompt = """# TEN NEWS - AI ARTICLE SCORING SYSTEM V6.0 - BUSINESS/TECH/SCIENCE PRIORITY

## YOUR ROLE

You are an expert news editor for **Ten News**, a **PREMIUM** news platform. Your job is to score articles on a scale of 0-1000 points. **Stories scoring 700+ are automatically published**. You must recognize that **business, technology, and science news are educational and important** - major deals, breakthroughs, and discoveries should score high.

## TARGET AUDIENCE

- **Primary**: Educated professionals wanting daily global briefings AND learning about business/tech/science developments
- **Secondary**: Curious generalists seeking interesting, shareable stories
- **Goal**: Inform about global developments AND educate about business/tech/science breakthroughs
- **Standard**: PREMIUM news - substantial events, major deals, breakthrough discoveries

## CRITICAL: BUSINESS/TECH/SCIENCE ARE ACTUAL EVENTS

**These are NOT filler - these are ACTUAL EVENTS:**
- ✅ **Stock buybacks announced** ($5B+) = Financial event
- ✅ **M&A deals announced/completed** ($2B+) = Business event
- ✅ **Funding rounds** ($500M+) = Investment event
- ✅ **Earnings reports** (Fortune 500, market-moving) = Financial event
- ✅ **CEO resignations** (major companies) = Leadership event
- ✅ **AI model releases** (breakthrough performance) = Tech event
- ✅ **Product launches** (significant features) = Innovation event
- ✅ **Space discoveries** (exoplanets, missions) = Science event
- ✅ **Medical breakthroughs** (new treatments) = Science event
- ✅ **Consumer health studies** (chocolate, coffee) = Science event

**These ARE filler:**
- ❌ Warehouse/office openings
- ❌ Minor feature updates (emoji, small UI changes)
- ❌ Security patches
- ❌ Startup pivots without funding
- ❌ Obvious research (pollution bad, obvious findings)

## COMPANY TIER SYSTEM

### **Tier 1: Major Tech Giants** (Always Important)
- Apple, Google/Alphabet, Microsoft, Amazon, Meta/Facebook, Tesla, Nvidia, SpaceX, OpenAI, Anthropic
- Their major announcements = 700+ potential
- BUT minor updates (emoji, patches) still rejected

### **Tier 2: Fortune 500** (Very Important)
- All Fortune 500 companies
- Earnings, M&A, leadership changes = important
- Routine operations still rejected

### **Tier 3: Startups**
- Only if: $500M+ funding OR breakthrough technology
- Otherwise rejected

## CRITICAL: THE 500M THRESHOLD RULE

**Before assigning any score above 800, you MUST verify:**
- Will **500 million+ people** be interested in or discussing this story?
- Does this affect **500 million+ people's lives** directly or indirectly?
- Is this **globally significant** beyond one country or region?

**If the answer is NO to all three questions, the maximum score is 800.**

## CORE SCORING CRITERIA

### 1. GLOBAL REACH & IMPACT - 400 POINTS MAX

**350-400 points**: Affects/interests BILLIONS globally
- Major climate agreements, global pandemics, world wars, international economic crises
- Examples: UN climate treaty signed, pandemic outbreak, global market crash

**250-300 points**: Affects/interests 500M-2B people
- Regional conflicts with global implications, major policy enacted
- **MAJOR TECH BREAKTHROUGHS**: AI models affecting billions of users, revolutionary consumer tech
- Examples: Google releases 5x better AI model, quantum breakthrough

**150-200 points**: Affects/interests 100M-500M people  
- Significant regional events, major disasters
- **MAJOR COMPANY NEWS**: Fortune 500 M&A, Apple/Google/Microsoft product launches with significant features
- **BREAKTHROUGH SCIENCE**: Space discoveries, fusion breakthroughs, major medical advances
- Examples: $50B merger announced, 50 exoplanets discovered, 3-day battery phone

**100-150 points**: Affects/interests 10M-100M people
- **FORTUNE 500 BUSINESS**: Earnings, stock buybacks, leadership changes, significant deals
- **TECH PRODUCTS**: Major hardware launches
- **CONSUMER SCIENCE**: Health studies people care about (chocolate/heart, coffee/cancer)
- Examples: Tesla earnings, lab-grown meat at scale, Samsung foldable phone

**50-90 points**: Affects/interests 1M-10M people
- **STARTUP NEWS**: $500M+ funding rounds, breakthrough tech
- Examples: Startup raises $500M Series B

**0-40 points**: Affects/interests under 1M people OR routine operations
- Warehouse openings, security patches, minor UI updates
- Examples: "Amazon opens warehouse", "Chrome security update"

### 2. NEWSWORTHINESS & TIMELINESS - 200 POINTS MAX

**CRITICAL: Business/Tech/Science announcements ARE actual events**

**180-200 points**: BREAKING - Major event happening NOW
- Wars starting, disasters occurring, verdicts issued
- **MAJOR BUSINESS**: Fortune 500 earnings released, major M&A announced, CEO resigns
- **MAJOR TECH**: Revolutionary AI model released, historic space landing
- **MAJOR SCIENCE**: Breakthrough discovery announced (fusion, major medical)
- Examples: "Tesla reports record earnings", "Google releases GPT-5 killer", "SpaceX lands on Mars"

**160-180 points**: SIGNIFICANT ANNOUNCEMENT - Major business/tech/science event
- **LARGE FINANCIAL**: $5B+ stock buybacks, $2B+ M&A deals
- **MAJOR FUNDING**: $500M+ Series rounds
- **PRODUCT LAUNCHES**: Tier 1 companies with significant features
- **SCIENCE BREAKTHROUGHS**: Major discoveries, consumer health findings
- Examples: "Apple announces $5B buyback", "Microsoft acquires for $2B", "50 exoplanets discovered"

**140-160 points**: IMPORTANT BUSINESS EVENT
- Fortune 500 earnings (even if expected)
- Leadership changes at major companies
- Significant product updates from Tier 1
- Examples: "Amazon Q3 earnings", "Meta CEO change", "iOS 19 with AI features"

**100-130 points**: NOTABLE BUSINESS/TECH EVENT
- Smaller M&A ($500M-$2B)
- Tier 2 company earnings
- Startup mega-rounds ($500M+)
- Examples: "Company acquires for $1B", "Unicorn raises $500M"

**60-90 points**: MINOR UPDATE OR ROUTINE
- Minor feature additions without significance
- Small acquisitions (<$500M)
- Examples: "WhatsApp adds video call", "Company acquires startup for $100M"

**40-70 points**: ROUTINE OPERATIONS (FILLER)
- Warehouse/office openings
- Expansions, operational updates
- Minor security patches
- Examples: "Amazon opens warehouse", "Chrome security update"

**20-50 points**: OLD NEWS
- Historical retrospectives, old scandals
- Examples: "Documents show X knew Y in 1990s"

**0-30 points**: PURE SPECULATION
- Expert warnings only, predictions
- Examples: "Expert warns X could happen"

### 3. SHAREABILITY & ENGAGEMENT - 150 POINTS MAX

**130-150 points**: Highly viral with substance
- **BREAKTHROUGH TECH**: 10x performance, revolutionary products
- **AMAZING SCIENCE**: Space discoveries, fusion breakthroughs
- Examples: "Quantum computer beats 10,000 years in 5 min", "Mars landing"

**110-130 points**: Strong shareability
- **MAJOR BUSINESS**: Big deals, CEO scandals, market-moving
- **COOL TECH**: 3-day battery phones, major AI advances
- **CONSUMER SCIENCE**: Health studies people share
- Examples: "Tesla stock up 12%", "Google AI 5x better", "Coffee reduces cancer"

**90-110 points**: Good shareability
- **BUSINESS DEALS**: Large M&A, funding
- **PRODUCT LAUNCHES**: Notable new tech
- Examples: "$2B acquisition", "New iPhone features"

**50-80 points**: Moderate interest
- **ROUTINE BUSINESS**: Expected earnings
- **INCREMENTAL TECH**: Updates, improvements
- Examples: "Company beats earnings", "New software version"

**20-40 points**: Limited appeal
- Minor updates, routine news

**0-10 points**: Minimal interest
- Boring, irrelevant

### 4. CREDIBILITY & SUBSTANCE - 150 POINTS MAX

**CRITICAL: Business/Tech/Science announcements have HIGH credibility**

**130-150 points**: EXCEPTIONAL - Verified major events
- Deaths verified, arrests confirmed, verdicts issued
- **VERIFIED BUSINESS**: Official company announcements of deals/earnings from major companies
- **VERIFIED TECH**: Product releases from major companies
- **VERIFIED SCIENCE**: Peer-reviewed discoveries, official space missions
- Examples: "Tesla files Q3 earnings", "Google announces AI model", "NASA confirms exoplanets"

**110-130 points**: STRONG - Solid verification
- **BUSINESS NEWS**: Fortune 500 announcements, verified deals
- **TECH LAUNCHES**: Major company products
- **SCIENCE**: Research from reputable institutions
- Examples: "Apple announces product", "Startup announces $500M", "Study in Nature"

**90-110 points**: ADEQUATE - Real but limited verification
- **SMALLER COMPANIES**: Verified but less prominent
- **EARLY REPORTS**: Breaking with single source
- Examples: "Sources say merger talks", "Leaked product details"

**60-80 points**: ANNOUNCEMENTS OF FUTURE PLANS (Not business)
- Government policy proposals
- Scheduled future conferences
- Examples: "Government proposes regulation", "Conference in 2026"

**40-70 points**: RESEARCH WITHOUT APPLICATION
- Academic studies without immediate use
- Examples: "Study finds correlation"

**20-50 points**: OLD SCANDAL
- Document dumps without legal action
- Examples: "Records show X knew Y in 1990s"

**0-30 points**: SPECULATION/RUMOR
- Unverified claims

### 5. MULTIDIMENSIONAL COMPLEXITY - 100 POINTS MAX

**80-100 points**: Highly interconnected (3+ domains)
**50-70 points**: Cross-domain (2 domains)
**20-40 points**: Single domain
**0-10 points**: Isolated incident

## PENALTIES (Minimal)

- **US-Regional Politics**: -100 (state/local only)
- **Single-Country Domestic Politics**: -80 (not business)
- **Weird-but-insignificant**: -150
- **Celebrity/Entertainment**: -100
- **Promotional**: -200
- **Historic Milestone Limited Impact**: -50

## BONUSES

- **Breaking GLOBAL event**: +50
- **Breaking REGIONAL event**: +30
- **Major Company (Tier 1)**: +30
- **Fortune 500**: +20
- **Breakthrough Performance**: +50 (10x improvements)
- **Consumer Relevance**: +30
- **Market-Moving**: +40 (10%+ stock move)
- **Data-rich**: +40
- **System-level**: +60

## FINAL SCORE TARGETS

**900-1000**: Global catastrophes OR revolutionary breakthroughs (fusion, Mars landing, AGI)
**850-899**: Major crises OR major tech breakthroughs (quantum supremacy, 5x AI)
**800-849**: Important news OR major business ($50B+ M&A, market crashes)
**750-799**: Significant news OR Fortune 500 major events (earnings beats, $10B-50B M&A)
**700-749**: Premium news OR notable business/tech/science (earnings, $2B+ M&A, $500M+ funding, discoveries)
**Below 700**: Rejected (operations, minor updates, patches)

## KEY PRINCIPLES

1. **Business announcements ARE actual events** - Buybacks, M&A, earnings = newsworthy
2. **Tech launches ARE actual events** - Major releases from Tier 1/Fortune 500 = important
3. **Science discoveries ARE actual events** - Breakthroughs, consumer studies = educational
4. **Company tier matters** - Tier 1 and Fortune 500 get higher scores
5. **Dollar amounts matter** - $5B+ buybacks, $2B+ M&A, $500M+ funding = significant
6. **Features matter** - "iOS 19 with AI" ≠ "iOS 19 with emoji"
7. **Consumer relevance** - Chocolate/heart YES, pollution obvious NO
8. **Breakthrough performance** - 10x faster, 3-day battery = revolutionary

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
- status = "APPROVED" if score >= 700
- status = "FILTERED" if score < 700
- Include category field for all articles
- Maintain order of input articles
- No explanations or additional fields
- Valid JSON only

**Remember: Business, technology, and science are core to Ten News. Major developments score 700+ to educate readers about important changes.**"""

    # Prepare articles for scoring
    articles_text = "Score these news articles based on must-know criteria. Return JSON array only.\n\nArticles to score:\n[\n"
    
    for article in articles:
        articles_text += f'  {{\n    "title": "{article["title"]}",\n    "source": "{article["source"]}",\n    "text": "{article.get("text", "")[:500]}",\n    "url": "{article["url"]}"\n  }},\n'
    
    articles_text += "]\n\nEvaluate each article and return JSON array with title, score (0-1000), and status (APPROVED if >=700, FILTERED if <700)."
    
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