#!/usr/bin/env python3
"""
STEP 1: GEMINI NEWS APPROVAL SYSTEM
==========================================
Purpose: Filter RSS articles into APPROVED or ELIMINATED
Model: Gemini 2.0 Flash
Input: RSS articles with title, source, description, url
Output: Approved articles (with category) or eliminated articles
"""

import os
import requests
import json
import time
import re
from datetime import datetime, timezone
from typing import List, Dict

def _fix_truncated_json(json_text: str) -> Dict:
    """
    Fix truncated JSON responses from Gemini API
    """
    # Clean up the response
    json_text = json_text.strip()
    
    # Look for {"results": [...]} pattern
    start_idx = json_text.find('{')
    if start_idx == -1:
        raise ValueError("No JSON object found in response")
    
    json_text = json_text[start_idx:]
    
    # If it doesn't end with }, try to fix it by closing any open brackets/braces
    if not json_text.rstrip().endswith('}'):
        last_brace = json_text.rfind('}')
        if last_brace > 0:
            json_text = json_text[:last_brace + 1]

            open_brackets = json_text.count('[') - json_text.count(']')
            open_braces = json_text.count('{') - json_text.count('}')

            if open_brackets > 0:
                json_text += ']' * open_brackets
            if open_braces > 0:
                json_text += '}' * open_braces
    
    try:
        return json.loads(json_text)
    except json.JSONDecodeError as e:
        # Try to extract just the results array
        results_match = re.search(r'"results"\s*:\s*\[(.*?)\]', json_text, re.DOTALL)
        if results_match:
            try:
                results_str = '[' + results_match.group(1) + ']'
                results = json.loads(results_str)
                return {"results": results}
            except Exception:
                pass
        raise ValueError(f"Could not parse JSON: {e}")


# Delight-lane categories: non-Sports buckets where a fascinating/uplifting
# story deserves to publish even at interest 5-7. Sports is EXCLUDED (already
# 84% of light supply / ~33% of all content).
DELIGHT_CATEGORIES = {'Science', 'Health', 'Tech', 'Entertainment', 'Lifestyle',
                      'World', 'Food', 'Travel'}


def _apply_delight_lane(approved: List[Dict], filtered: List[Dict]):
    """Promote a reserved quota of NON-SPORTS high-delight stories that the
    interest>=8 gate dropped (interest 5-7). Fixes light supply being 84% Sports
    (Science/Space/good-news score 5-7 on importance and never published). The
    global interest gate is UNTOUCHED — this is additive headroom. Tunable via
    DELIGHT_LANE_FRACTION (default 0.12; 0 disables) and DELIGHT_MIN (default 7)."""
    try:
        frac = float(os.getenv('DELIGHT_LANE_FRACTION', '0.12'))
    except ValueError:
        frac = 0.12
    if frac <= 0 or not approved:
        return approved, filtered
    min_delight = int(os.getenv('DELIGHT_MIN', '7'))
    quota = max(1, int(frac * len(approved) + 0.999))   # ceil, ~10-15%
    cands = [a for a in filtered
             if a.get('disqualifier') == 'low_interest'
             and a.get('_delight_category') in DELIGHT_CATEGORIES
             and 5 <= (a.get('interest_score') or 0) <= 7
             and (a.get('delight_score') or 0) >= min_delight]
    cands.sort(key=lambda a: (a.get('delight_score', 0), a.get('interest_score', 0)), reverse=True)
    promote = cands[:quota]
    if not promote:
        return approved, filtered
    promote_ids = {id(a) for a in promote}
    for a in promote:
        a['status'] = 'APPROVED'
        a['category'] = a.get('_delight_category', 'Other')
        a['score'] = 750
        a['path'] = 'DELIGHT'
        a.pop('disqualifier', None)
    filtered = [a for a in filtered if id(a) not in promote_ids]
    print(f"   ✨ [delight-lane] promoted {len(promote)} non-sports high-delight stories "
          f"(quota {quota}, min_delight {min_delight})")
    return approved + promote, filtered


def score_news_articles_step1(articles: List[Dict], api_key: str, batch_size: int = 50, max_retries: int = 5) -> Dict:
    """
    Step 1: Approve or Eliminate news articles using Gemini API
    
    Args:
        articles: list of dicts with 'title', 'source', 'text' (optional), 'url'
        api_key: Google AI API key
        batch_size: Number of articles to process per API call (default: 50)
        max_retries: Maximum retry attempts for rate limiting (default: 5)
    
    Returns:
        dict with 'approved' and 'filtered' lists
    """
    
    # Count articles with/without images for logging
    articles_with_images = sum(1 for a in articles if a.get('image_url') and a.get('image_url').strip())
    articles_without_images = len(articles) - articles_with_images
    
    if articles_without_images > 0:
        print(f"   📷 {articles_without_images} articles without images (Bright Data will fetch later)")
    print(f"   ✅ Filtering {len(articles)} total articles")
    
    # Use gemini-2.5-flash-lite for production
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key={api_key}"
    
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
                    time.sleep(4)  # 4 second delay between batches (Gemini Flash handles high RPM)
                    
            except Exception as e:
                print(f"  ❌ Batch {batch_num} failed: {e}")
                # Mark batch articles as filtered on error
                for article in batch:
                    article['category'] = 'Other'
                    article['score'] = 0
                    article['status'] = 'ELIMINATED'
                    article['disqualifier'] = 'batch_error'
                all_filtered.extend(batch)
        
        all_approved, all_filtered = _apply_delight_lane(all_approved, all_filtered)
        return {
            "approved": all_approved,
            "filtered": all_filtered
        }
    else:
        # Single batch
        result = _process_batch(articles, url, api_key, max_retries)
        result['approved'], result['filtered'] = _apply_delight_lane(
            result.get('approved', []), result.get('filtered', []))
        return result


def _process_batch(articles: List[Dict], url: str, api_key: str, max_retries: int = 5) -> Dict:
    """
    Process a single batch of articles with retry logic for rate limiting
    """
    
    system_prompt = """# TodayPlus Article Approval System V6

## YOUR ROLE

You are the **Chief Editor of Today+**, a serious global NEWS publication. Your job: decide **APPROVED** or **ELIMINATED** for each article.

We are a focused NEWS platform: world/politics, business, finance, tech, science, health, and sports — plus MAJOR entertainment/cultural news (big releases, major awards, significant celebrity events). We are NOT a lifestyle magazine: ELIMINATE soft lifestyle content — food/recipes, fashion/style, travel guides, home/wellness/"inspiration" pieces — even from established lifestyle sources. Approve real news that informs, not content that merely entertains or sells a lifestyle.

---

## CORE PHILOSOPHY

**"Would someone who follows this topic want to see this?"**

We serve users from **15 countries** with personalized interests across many topics. Approve real news that matters — to any of our user segments. A Premier League fan cares about match results. A tech enthusiast cares about product launches. A science reader cares about new discoveries. **Serve all of them.**

**NOVELTY BAR (be strict):** Only APPROVE articles a reader would genuinely want to read TODAY. Reject anything that is already commodity coverage, a repetitive follow-up, or low-novelty (a story already everywhere with nothing new). Variety across verticals is good, but every approved item must clear the "actually worth someone's time right now" test — not merely "technically a real event."

**Our 15 countries:** USA, UK, Canada, Australia, India, Germany, France, Spain, Italy, Ukraine, Russia, Türkiye, China, Japan, Israel

---

## DECISION FRAMEWORK

### APPROVE if:
- A real news event happened or a real development occurred
- It has significance — globally, for one of our 15 countries, OR for followers of a NEWS topic (business/tech/science/world/politics/finance/health/sports, or major entertainment)
- A reader who follows that news topic/country would find it informative

### ELIMINATE if:
- It's SOFT LIFESTYLE content: food/recipes/restaurants, fashion/style, travel/destination guides, home/interior, wellness/self-help, "inspiration" or aspirational lifestyle pieces
- It's pure opinion with no news hook (pure editorials, hot takes with no event)
- It's promotional (betting, promo codes, deals, "how to watch", "shop this")
- It's a trivial individual story with no broader significance
- It's from a non-covered country AND has no global impact AND no news-topic value
- It's a routine/incremental update with nothing new
- It's noise that adds no value

---

## INTEREST SCORING (1-10)

For each APPROVED article, also output an **interest score from 1-10**. Score from the perspective of **users who follow the article's topic or country** — not the general public.

| Score | Level | Description |
|-------|-------|-------------|
| 9-10 | Must-Know for EVERYONE | Wars, mass casualties 20+, world-changing events |
| 7-8 | Major for topic followers or a covered country | Elections, policy shifts, $1B+ deals, championship results, blockbuster releases — but score 8 ONLY if it is ALSO novel/standout; routine "major" items (another match result, another earnings beat, another official statement) land at 7 |
| 5-6 | Notable and interesting | Regular major-league results, notable tech/science news, economic updates, celebrity events |
| 4 | Niche but real news | Less mainstream sports, minor but real developments, smaller tech/science stories |
| 3 | Borderline | Very niche, routine, or from non-covered country with limited appeal |
| 1-2 | Filler | Barely newsworthy to anyone |

**Key instruction:** A Premier League match result is a 6-7 for sports followers. A notable tech product launch is a 6. A celebrity health diagnosis is a 5-6. Turkish domestic news is a 7 if Türkiye followers would care. Only score 1-3 for truly routine filler or non-covered country local news with zero topic appeal.

**PUBLISH BAR (tightened 2026-06-10):** We publish ONLY articles scoring **interest 8-10**, and an 8 must be EARNED. An 8 requires genuine novelty AND consequence — the standout of the cycle, not merely a real "major" event. If a story is routine for its own beat (another match result, another earnings beat, another official statement, another product refresh, another incremental policy step), it scores 6-7 and does NOT publish, even if technically "major". Commodity coverage, repetitive follow-ups, mid-table results, and low-novelty rewrites score 5-7 and will NOT publish. When torn between 7 and 8, ALWAYS choose 7. It is correct — and expected — for MOST approved articles to land at 5-7 and not publish.

## DELIGHT SCORING (1-10) — separate from interest

For each APPROVED article, ALSO output a **delight score from 1-10**, judged
INDEPENDENTLY of interest/importance. Delight = is this **fascinating,
uplifting, surprising, or shareable** — the kind of thing you'd send a friend
saying "whoa, look at this", regardless of how globally important it is.

| Score | Description |
|-------|-------------|
| 9-10 | A genuine wow: a stunning scientific discovery, a remarkable first, a beautiful/awe-inspiring feat, a story that makes you smile or marvel |
| 7-8 | Clearly delightful: a cool space/science finding, a good-news human-interest story, a surprising fact, a charming cultural moment |
| 5-6 | Mildly interesting/pleasant, but not striking |
| 1-4 | Routine, grim, or dry — no delight (most hard-news, politics, conflict, business) |

A war, a scandal, an earnings report = low delight (1-3) even if high interest.
A newly discovered exoplanet, a medical breakthrough, an animal-rescue story, a
record-breaking natural wonder, a quirky surprising fact = high delight (8-10)
even if interest is only 5-7. Score delight honestly; do NOT inflate it for
sports results (those are already well-covered).

---

## COUNTRY-AWARE RULES

### News from our 15 countries — LENIENT
Approve national-level news, political developments, economic policy, notable incidents, significant business, sports, entertainment, and cultural events. **If a reader who selected that country would find it interesting, APPROVE it.**

Examples to APPROVE:
- "Türkiye Central Bank raises rates to 45%" → Approve (major economic policy)
- "German coalition talks collapse" → Approve
- "India launches new space mission" → Approve
- "Australian wildfires force evacuations" → Approve
- "Japan PM calls snap election" → Approve
- "Italian PM announces major reform" → Approve
- "Istanbul metro expansion opens new line" → Approve (notable Türkiye infrastructure)
- "Erdogan meets Saudi Crown Prince in Ankara" → Approve (Türkiye diplomacy)
- "Turkish lira hits new low against dollar" → Approve (Türkiye economy)
- "Major earthquake hits eastern Türkiye" → Approve (significant incident)
- "Türkiye arrests opposition journalist" → Approve (human rights, political)

**Important:** Articles from non-English sources (Turkish, Russian, German, etc.) about our 15 countries should still be evaluated and approved if newsworthy. The language of the source does not matter — only the content.

### News from OTHER countries — MODERATE
Approve if it has global significance OR strong topic appeal:
- Mass casualties (10+ deaths)
- Affects multiple countries or regions
- Major geopolitical shift
- Unprecedented natural disaster
- Major sports results from globally followed events (e.g., Copa Libertadores final, Brazilian football)
- Significant tech/science developments regardless of origin country

Examples to ELIMINATE from non-covered countries:
- "Peru local elections update" → Eliminate (not our country, not global, no topic interest)
- "Thai court rules on local dispute" → Eliminate
- "Argentine province governor resigns" → Eliminate
- "Malaysian minister visits Indonesia" → Eliminate (routine diplomacy)

---

## SPORTS RULES — BE GENEROUS

Sports fans want results. **Approve all real match results and confirmed events from major leagues.**

### APPROVE these sports:
- **ALL match results** from TOP leagues: Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, Europa League, NBA, NFL, NHL, MLB, MLS, F1, MotoGP, Cricket (international + IPL), UFC/Boxing main cards, Tennis (ATP/WTA tour events), Golf (PGA majors)
- Championship finals and playoffs at any level of major sports
- Major tournament results (Grand Slams, Olympics, World Cups)
- Record-breaking moments, historic milestones
- Major transfers and signings ($20M+)
- Significant injuries to star players
- New team entries (e.g., Cadillac joining F1)
- Major coaching changes at top clubs
- Notable esports tournament results (Worlds, Majors)

### ELIMINATE these sports:
- Minor league, college, and youth results (unless historic)
- Player rumors without confirmed events
- Pre-match predictions and betting previews
- Betting odds and tips
- "How to watch" guides
- Fantasy sports advice
- Training camp reports with no real news

---

## BUSINESS RULES

### APPROVE:
- Significant deals and acquisitions ($50M+)
- Major market moves (indices up/down 2%+)
- CEO changes at major or well-known companies
- Tech funding rounds ($10M+)
- Mass layoffs (200+)
- Regulatory actions with real impact
- Economic policy changes (interest rates, trade deals, sanctions)
- Major product launches from known companies
- Notable startup milestones (unicorn status, major pivot, shutdown)

### ELIMINATE:
- Routine quarterly earnings with no surprises
- Seeking Alpha / investment analysis articles
- Earnings call transcripts
- Press releases without real news value
- Local business openings/closings
- Financial advice columns
- Generic market commentary ("Markets mixed today")

---

## TECH & AI RULES — BE GENEROUS

Tech enthusiasts follow this space closely. **Approve real tech news from known companies and platforms.**

### APPROVE:
- New AI model releases and significant updates
- AI company news (funding, partnerships, regulation, leadership)
- Product launches and major updates from known companies (Apple, Google, Microsoft, Samsung, Meta, Amazon, Nintendo, Sony, etc.)
- Cybersecurity breaches and notable hacks
- Tech layoffs (200+)
- Significant regulatory actions (antitrust, data privacy)
- Space launches and discoveries
- Gaming: major game releases, console news, industry deals, showcase events
- Streaming platform news (mergers, major content deals, price changes)
- Notable open-source releases and developer platform changes

### ELIMINATE:
- Product reviews and buying guides
- How-to tutorials, tips, settings/feature walkthroughs
- **CONSUMER SERVICE-JOURNALISM** — "your phone/device/app can now do X", "how to use
  the new feature", "the setting you should turn on", "what this feature means for you".
  These are user tips dressed as news. A genuine product LAUNCH ("Google launches Pixel
  10", "Apple ships iOS 27") is news; a feature-usage explainer aimed at the reader's own
  device is NOT. If the headline talks to the reader about THEIR device, eliminate it.
- Truly minor app updates (bug fixes, small UI changes), routine feature rollouts
- Generic "AI will change everything" opinion pieces with no news hook

---

## ENTERTAINMENT RULES — BE GENEROUS

Entertainment adds variety. **Approve real events involving well-known figures and cultural moments.**

### APPROVE:
- Major award ceremonies and nominations (Oscars, Grammys, Emmys, Golden Globes, etc.)
- Celebrity news with real events: health diagnoses, deaths, marriages, divorces, arrests, legal cases, retirements
- Major film/TV/music releases and announcements from big studios or well-known artists
- Streaming platform mergers and major content deals
- Cultural events with broad appeal (festivals, concerts, tours)
- Gaming industry events and major releases
- Notable viral cultural moments with real-world impact

### ELIMINATE:
- Celebrity gossip without real events ("spotted dating", rumor mills)
- Reality TV recaps
- Pure tabloid speculation

---

## SOFT LIFESTYLE — ELIMINATE (news-platform pivot 2026-06-07)

We are a NEWS platform, not a lifestyle magazine. ELIMINATE soft lifestyle content
even when it's well-made or from an established source:

- **Food/cooking:** recipes, restaurant reviews/openings, food trends, chef profiles,
  cookbook features, seasonal cooking. (EXCEPTION: a genuine food-SAFETY news event —
  a major recall or contamination outbreak — is news; approve that.)
- **Fashion/style:** fashion-week coverage, collections, trend reports, "who wore what",
  designer-style pieces. (EXCEPTION: a fashion-house BUSINESS event — a major M&A,
  bankruptcy, or CEO change — is business news; approve that.)
- **Travel:** destination features, travel guides, "best places", hotel/resort pieces.
  (EXCEPTION: travel POLICY news — visa-rule changes, border closures, an airline
  bankruptcy/strike — is news; approve that.)
- **Home/interior/wellness/self-help/"inspiration"/aspirational lifestyle** pieces.

Rule of thumb: if it INFORMS about a real news event → approve. If it merely entertains,
inspires, or sells a lifestyle → eliminate.

---

## SCIENCE & HEALTH RULES — BE GENEROUS

Science readers want to stay informed. **Approve real research results and discoveries from credible sources.**

### APPROVE:
- Breakthroughs and significant findings (published research, new discoveries)
- Space discoveries, missions, and launches
- Climate science developments and major environmental events
- New treatments, drug approvals, and vaccine results
- Disease outbreaks affecting many people
- Notable animal/nature discoveries
- Technology-science crossovers (biotech, quantum computing, fusion energy)
- Archaeological discoveries

### ELIMINATE:
- "Study suggests maybe..." with truly weak or preliminary conclusions
- Niche academic papers with no real-world relevance
- Alternative medicine promotion

---

## DATE AWARENESS

You will be told today's date in the user message. Use it to:
- ELIMINATE articles about events that clearly happened months or years ago (stale news)
- ELIMINATE articles with future dates that have already passed (e.g., "targets 2024 launch" when we're in 2026)
- Articles should describe RECENT events (within the last 48 hours ideally)

## ALWAYS ELIMINATE (regardless of country/topic):

| Type | Examples |
|------|----------|
| **Pure opinion with no news hook** | Pure editorials, hot takes not tied to any event |
| **Listicles/Guides** | "15 Best...", "How to...", "Top 10..." — eliminate (these are lifestyle/SEO filler, not news) |
| **Service journalism / "you" tips** | "Your phone can now...", "The setting you should turn on", "How to protect yourself from...", "What X means for you" — reader-tips dressed as news. Eliminate. (A real product LAUNCH or a real security BREACH is news; a usage tip is not.) |
| **Promotional** | Betting odds, promo codes, deals, "where to buy", "how to watch" |
| **Trivial individual stories** | "Mom of 3 shares...", "Man drives 5000 miles...", personal journeys |
| **Investment advice** | "Buy this stock", Seeking Alpha, earnings transcripts |
| **Weather** | Routine forecasts (disasters ARE news) |
| **Routine updates** | No new information, just rehashing existing story |
| **Pure speculation** | Headlines that are entirely "May/Could/Might" with zero confirmed facts |

**Note:** An article that reports a real event but includes some analysis is NOT "opinion" — it's news with context. Approve it. Only eliminate pure opinion pieces with no news hook.

---

## CATEGORY ASSIGNMENT

When approving, assign one category:

| Category | For |
|----------|-----|
| World | International affairs, diplomacy, conflicts |
| Politics | Government, elections, policy |
| Business | Companies, economy, trade |
| Tech | Technology, AI, startups, space, gaming |
| Science | Research, discoveries, climate |
| Health | Medicine, public health |
| Finance | Markets, currencies, banking |
| Sports | All sports results and news |
| Entertainment | Celebrity news, cultural events, music, film/TV |
| Food | Recipes, restaurants, cooking, culinary culture |
| Fashion | Style, designers, fashion industry, beauty |
| Travel | Destinations, travel guides, hotel/airline news |
| Lifestyle | Home, wellness, fitness, personal development |

---

## OUTPUT FORMAT

```json
{
  "results": [
    {"id": 1, "decision": "APPROVED", "category": "Sports", "interest": 8, "delight": 3},
    {"id": 2, "decision": "ELIMINATED"},
    {"id": 3, "decision": "APPROVED", "category": "Science", "interest": 6, "delight": 9}
  ]
}
```

For APPROVED articles, include `"interest"` (1-10) AND `"delight"` (1-10). Omit both for ELIMINATED articles.

---

## QUICK TEST

Before eliminating, ask yourself: **"Would a user who follows this topic be interested?"**

If yes → APPROVE it.

---

*TodayPlus Article Approval System V6*
*"Diverse, quality news for every interest"*
"""
    
    # Prepare articles for filtering
    today = datetime.now(timezone.utc).strftime('%B %d, %Y')
    articles_text = f"TODAY'S DATE: {today}\n\nFilter these news articles. Return JSON with results array.\n\nArticles to filter:\n"
    
    for idx, article in enumerate(articles):
        articles_text += f'\n[Article {idx + 1}]\n'
        articles_text += f'ID: {idx + 1}\n'
        articles_text += f'Title: {article["title"]}\n'
        articles_text += f'Source: {article["source"]}\n'
        if article.get("source_country"):
            articles_text += f'Source Country: {article["source_country"]}\n'
        if article.get("text"):
            articles_text += f'Description: {article.get("text", "")[:300]}\n'
    
    articles_text += '\n\nReturn JSON object with "results" array. Each result needs: id, decision (APPROVED/ELIMINATED), category (only for APPROVED), interest score 1-10 (only for APPROVED), and delight score 1-10 (only for APPROVED).'
    
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
            "temperature": 0.2,
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
                wait_time = (2 ** attempt) * 30
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
                            return {"approved": [], "filtered": articles}
                
                if 'content' in candidate and 'parts' in candidate['content']:
                    response_text = candidate['content']['parts'][0]['text']
                else:
                    print(f"❌ No content in candidate")
                    raise ValueError("No valid content in Gemini response")
            else:
                print(f"❌ No candidates in result")
                raise ValueError("No valid response from Gemini API")
            
            # Parse JSON response
            parsed_response = None
            
            try:
                parsed_response = json.loads(response_text)
            except json.JSONDecodeError as e:
                print(f"⚠️ JSON parse error: {e}")
                print(f"Response text: {response_text[:500]}...")
                
                # Try to fix truncated JSON response
                try:
                    parsed_response = _fix_truncated_json(response_text)
                    print(f"✅ Fixed truncated JSON")
                except Exception as fix_error:
                    print(f"❌ Could not fix JSON: {fix_error}")
                    return {"approved": [], "filtered": articles}
            
            # Get results array
            results_array = parsed_response.get('results', [])
            if not results_array and isinstance(parsed_response, list):
                results_array = parsed_response
            
            # Separate approved and filtered articles
            approved = []
            filtered = []
            
            for result_item in results_array:
                article_id = result_item.get('id', 0) - 1  # Convert to 0-indexed
                
                if 0 <= article_id < len(articles):
                    original_article = articles[article_id].copy()
                    decision = result_item.get('decision', 'ELIMINATED').upper()
                    interest = result_item.get('interest', 5)
                    delight = result_item.get('delight', 0)  # independent 1-10 (delight lane)

                    # PIPELINE 1 TIGHTENING (2026-05-24): publish only genuinely
                    # high-interest items. Gate at interest >= 8 (override via
                    # PIPELINE1_MIN_INTEREST) — keeps roughly the top ~30% of
                    # approvable articles so the daily budget has room for
                    # Pipeline 2. APPROVED-but-below-bar items fall through to
                    # `filtered` with a 'low_interest' disqualifier.
                    min_interest = int(os.getenv('PIPELINE1_MIN_INTEREST', '8'))

                    if decision == 'APPROVED' and interest >= min_interest:
                        original_article['status'] = 'APPROVED'
                        original_article['category'] = result_item.get('category', 'Other')
                        original_article['score'] = 750  # Default score, will be updated after writing
                        original_article['path'] = 'A'  # Default path
                        original_article['interest_score'] = interest
                        original_article['delight_score'] = delight

                        # Validate category
                        valid_categories = ['World', 'Politics', 'Business', 'Tech', 'Science',
                                          'Health', 'Finance', 'Sports', 'Entertainment',
                                          'Food', 'Fashion', 'Travel', 'Lifestyle', 'Other']
                        if original_article['category'] not in valid_categories:
                            # Map common variations
                            category_mapping = {
                                'Technology': 'Tech',
                                'Economy': 'Business',
                                'International': 'World',
                                'Culture': 'Entertainment',
                                'Cooking': 'Food',
                                'Recipe': 'Food',
                                'Recipes': 'Food',
                                'Style': 'Fashion',
                                'Beauty': 'Fashion',
                                'Wellness': 'Lifestyle',
                                'Fitness': 'Lifestyle',
                                'Home': 'Lifestyle',
                            }
                            original_article['category'] = category_mapping.get(
                                original_article['category'], 'Other'
                            )
                        
                        approved.append(original_article)
                    else:
                        original_article['status'] = 'ELIMINATED'
                        original_article['category'] = 'Other'
                        original_article['score'] = 0
                        original_article['path'] = 'DISQUALIFIED'
                        # Distinguish "approved by the model but below the interest
                        # bar" from a genuine editorial rejection — useful when
                        # tuning the threshold from the filtered_articles table.
                        original_article['disqualifier'] = (
                            'low_interest' if decision == 'APPROVED' else 'not_globally_relevant'
                        )
                        original_article['interest_score'] = interest
                        original_article['delight_score'] = delight
                        # Preserve the model's real category (category above is
                        # forced to 'Other' for filtered rows) so the delight
                        # lane can select non-Sports high-delight items.
                        original_article['_delight_category'] = result_item.get('category', 'Other')
                        filtered.append(original_article)
            
            # Handle any articles not in results (mark as filtered)
            processed_ids = set()
            for result_item in results_array:
                article_id = result_item.get('id', 0) - 1
                if 0 <= article_id < len(articles):
                    processed_ids.add(article_id)
            
            for idx, article in enumerate(articles):
                if idx not in processed_ids:
                    article_copy = article.copy()
                    article_copy['status'] = 'ELIMINATED'
                    article_copy['category'] = 'Other'
                    article_copy['score'] = 0
                    article_copy['path'] = 'DISQUALIFIED'
                    article_copy['disqualifier'] = 'not_in_response'
                    filtered.append(article_copy)
            
            return {
                "approved": approved,
                "filtered": filtered
            }
            
        except requests.exceptions.HTTPError as e:
            if e.response and e.response.status_code == 429:
                if attempt < max_retries - 1:
                    continue
            if attempt == max_retries - 1:
                print(f"❌ API request failed after {max_retries} attempts: {e}")
                for article in articles:
                    article['category'] = 'Other'
                    article['score'] = 0
                    article['status'] = 'ELIMINATED'
                return {"approved": [], "filtered": articles}
            raise
        except requests.exceptions.RequestException as e:
            if attempt < max_retries - 1:
                wait_time = (2 ** attempt) * 1
                print(f"  ⚠️ Request error (attempt {attempt + 1}/{max_retries}): {e}")
                time.sleep(wait_time)
                continue
            print(f"❌ API request failed after {max_retries} attempts: {e}")
            for article in articles:
                article['category'] = 'Other'
                article['score'] = 0
                article['status'] = 'ELIMINATED'
            return {"approved": [], "filtered": articles}
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            for article in articles:
                article['category'] = 'Other'
                article['score'] = 0
                article['status'] = 'ELIMINATED'
            return {"approved": [], "filtered": articles}


if __name__ == "__main__":
    # Test the function
    test_articles = [
        {
            "title": "NATO Conducts Air Patrols Near Ukraine Border",
            "source": "Reuters",
            "text": "NATO forces conducted extensive air patrols near the Ukrainian border.",
            "url": "https://www.reuters.com/world/nato-patrols"
        },
        {
            "title": "15 Best Wireless Headphones for 2026",
            "source": "TechRadar",
            "text": "Our comprehensive guide to the best wireless headphones this year.",
            "url": "https://techradar.com/headphones"
        }
    ]
    
    api_key = "YOUR_API_KEY_HERE"
    results = score_news_articles_step1(test_articles, api_key)
    print(f"Approved: {len(results['approved'])}")
    print(f"Filtered: {len(results['filtered'])}")
