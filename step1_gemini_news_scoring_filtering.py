import requests
import json
import time
import os
from typing import List, Dict

def score_news_articles_step1(articles: List[Dict], api_key: str) -> Dict:
    """
    Step 1: Score news articles using Gemini API
    
    Args:
        articles: list of dicts with 'title', 'source', 'text' (optional), 'url'
        api_key: Google AI API key
    
    Returns:
        dict with 'approved' and 'filtered' lists
    """
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key={api_key}"
    
    system_prompt = """You are a news curator AI for a global news application. Your job is to score news articles from 0-1000 based on whether they are "must-know" news that people need to stay informed about the world.

CORE MISSION: Surface only essential news - information people NEED to know to be informed citizens and understand major world events. Quality and significance over quantity.

MUST-KNOW NEWS DEFINITION:
News that people cannot afford to miss because it:
- Directly impacts their lives (economy, health, safety, policy, rights)
- Represents major world events everyone should know (wars, elections, disasters, treaties)
- Involves significant institutional actions (governments, central banks, major organizations)
- Has historical importance (will be remembered, creates lasting change)
- Is essential for understanding the current state of the world

NOT must-know: Interesting stories, nice-to-know facts, entertainment, minor updates, incremental developments without major new information.

EVALUATION CRITERIA:

1. SIGNIFICANCE & IMPACT
Judge the real-world importance:
- Does this affect millions of people's lives directly?
- Is this a major event that reshapes politics, economy, or society?
- Does this involve critical government/institutional actions?
- Will this be historically significant?
- Do citizens NEED this information?

Breaking news indicators (analyze meaning, not just keywords):
- Major events that just happened: elections decided, leaders resign, disasters strike, wars begin/end, major attacks occur, policies passed, treaties signed
- Not breaking: scheduled events, ongoing situations without major development, analysis pieces, future predictions
- Language patterns: look for present/past tense completion ("announces," "passes," "strikes," "dies") NOT speculation ("could," "may," "expected to")

2. SOURCE CREDIBILITY
Tier 1 (Highest): Reuters, AP, AFP, BBC, CNN, Al Jazeera, NPR, New York Times, Wall Street Journal, Washington Post, The Guardian, Financial Times, The Economist
Tier 2 (Strong): Established national outlets with journalism standards, quality specialized sources (Nature, Science, Bloomberg, Politico, Axios, Foreign Affairs)
Tier 3 (Acceptable): Credible regional outlets, reputable digital publications

Eliminate: Tabloids, blogs, unverified sources, conspiracy sites, sponsored content, satirical sources

3. TITLE QUALITY
Must be clear, specific, informative, and professional:
- Explains what happened with details (names, numbers, locations, outcomes)
- Neutral factual tone without emotional manipulation
- Complete information, not a teaser or clickbait hook
- Grammatically correct
- Specific proper nouns (not vague references)

Eliminate: Clickbait, vague hooks, excessive caps, manipulative language, unclear references

4. CONTENT FOCUS
High priority (core must-know):
- Politics: Elections, major legislation, government crises, policy changes
- Economy: Markets, inflation, employment, major corporate news, economic policy, trade
- International: Wars, diplomacy, conflicts, refugee crises, treaties
- Health: Pandemics, major health crises, breakthrough treatments, public health policy
- Science/Tech: Major breakthroughs, significant AI developments, space milestones, major cybersecurity threats
- Environment: Major climate events, environmental disasters, significant climate policy
- Security: Terrorism, major societal crime, significant cybersecurity breaches

Lower priority (only if truly exceptional):
- Sports: Only major finals (World Cup final, Olympics opening/closing, Super Bowl, Champions League final) or historic achievements
- Entertainment: Only deaths of major cultural figures or historic cultural moments with broad societal impact
- Lifestyle/Culture: Generally excluded unless societally transformative
- Celebrity: Excluded unless broader significance (major philanthropy, important social issue involvement)

5. ARTICLE TEXT ANALYSIS (if provided)
When text snippet is available, use it to:
- Distinguish breaking news from analysis/commentary
- Detect if it's an update to ongoing story (only approve if MAJOR new development)
- Identify clickbait disguised as news
- Verify title accurately represents content
- Assess depth and substance

AUTOMATIC FILTERING - Score below 700:
- Clickbait or manipulative headlines
- Low credibility sources
- Celebrity gossip, entertainment fluff, lifestyle features
- Opinion pieces, editorials, commentary (unless about major must-know event)
- Vague or unclear titles without substance
- Minor updates to ongoing stories without major developments
- "Analysis" or "Explainer" pieces (unless tied to breaking major news)
- Unverified rumors or speculation
- Promotional content or press releases
- Extreme sensationalism
- Hyper-local news without national/international significance
- "Interesting but not essential" stories

SCORING SCALE (Holistic Judgment):

950-1000: CRITICAL MUST-KNOW
- Major breaking news of global significance
- Examples: War starts/ends, major natural disaster (thousands affected), pandemic declared, historic election results, major leader dies/resigns, significant terrorist attack, major economic crisis, peace treaty signed, major scientific breakthrough with immediate impact

850-949: HIGHLY IMPORTANT
- Significant breaking news or major developments
- Examples: Major policy changes, significant economic news (interest rate decisions, major market moves), important international developments, major health announcements, significant court rulings, important legislative votes

700-849: IMPORTANT MUST-KNOW
- Solid news people should be aware of
- Examples: Notable political developments, economic indicators, ongoing major story updates with substantial new information, significant regional events with broader implications, important appointments/departures

500-699: DECENT BUT NOT ESSENTIAL (FILTERED)
- Good reporting but not critical
- Examples: Minor political news, corporate announcements without major impact, incremental updates, regional news without global significance

Below 500: NOT MUST-KNOW (FILTERED)
- Not essential, low quality, or violates filtering rules
- Examples: Celebrity news, entertainment, sports (except major finals), lifestyle, opinion pieces, clickbait, minor stories, vague content

SCORING PRINCIPLES:
1. Impact over interest: Does this affect people's lives or is it just interesting?
2. Significance test: Will this matter tomorrow? Next week? Next year?
3. Need-to-know test: Must people know this to be informed citizens?
4. Better to approve borderline important news (avoid false negatives) than filter potentially important news
5. When in doubt between two scores, choose the higher one - missing important news is worse than showing slightly less important news
6. Quality over quantity: Better to approve 5 essential stories than 30 mixed-quality stories

SPECIAL SITUATIONS:
- Major event dominance: Can approve multiple articles on same event if it's truly critical breaking news
- Slow news day: Do NOT lower standards - maintain 700+ threshold
- Conflicting reports: Approve if from credible sources covering developing essential story
- Analysis of major events: Score based on the underlying event's importance, not the analysis itself
- Updates to ongoing stories: Only approve if MAJOR new development, not incremental updates

OUTPUT REQUIREMENTS:
Return ONLY valid JSON array with exactly this structure for each article:
[
  {
    "title": "exact article title here",
    "score": 850,
    "status": "APPROVED"
  },
  {
    "title": "another article title",
    "score": 650,
    "status": "FILTERED"
  }
]

Rules:
- status = "APPROVED" if score >= 700
- status = "FILTERED" if score < 700
- Maintain order of input articles
- No explanations or additional fields
- Valid JSON only"""

    # Format articles for prompt
    articles_text = json.dumps(articles, indent=2)
    
    user_prompt = f"""Score these news articles based on must-know criteria. Return JSON array only.

Articles to score:
{articles_text}

Evaluate each article and return JSON array with title, score (0-1000), and status (APPROVED if >=700, FILTERED if <700)."""

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": user_prompt
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
    
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        
        data = response.json()
        
        # Extract the generated content
        result_text = data['candidates'][0]['content']['parts'][0]['text']
        
        # Parse JSON result
        results = json.loads(result_text)
        
        # Separate approved and filtered
        approved = []
        filtered = []
        
        # Match scores with original article data (including URLs)
        for i, result in enumerate(results):
            article_with_score = {
                **articles[i],  # Include all original fields (title, source, text, url)
                'score': result['score'],
                'status': result['status']
            }
            
            if result['status'] == 'APPROVED':
                approved.append(article_with_score)
            else:
                filtered.append(article_with_score)
        
        return {
            'approved': approved,
            'filtered': filtered,
            'total': len(results),
            'approval_rate': len(approved) / len(results) * 100 if results else 0
        }
        
    except requests.exceptions.RequestException as e:
        print(f"API request error: {e}")
        raise
    except (KeyError, json.JSONDecodeError) as e:
        print(f"Response parsing error: {e}")
        print(f"Response: {response.text}")
        raise


def process_large_rss_feed(all_articles: List[Dict], api_key: str, batch_size: int = 30) -> Dict:
    """
    Process large RSS feeds in batches of 30
    
    Args:
        all_articles: Complete list from RSS (could be 1000+)
        api_key: Gemini API key
        batch_size: Articles per API call (max 30 recommended)
    
    Returns:
        Combined results from all batches
    """
    all_approved = []
    all_filtered = []
    
    total_batches = (len(all_articles) + batch_size - 1) // batch_size
    
    for i in range(0, len(all_articles), batch_size):
        batch = all_articles[i:i+batch_size]
        batch_num = i // batch_size + 1
        
        print(f"\nProcessing batch {batch_num}/{total_batches} ({len(batch)} articles)...")
        
        try:
            results = score_news_articles_step1(batch, api_key)
            all_approved.extend(results['approved'])
            all_filtered.extend(results['filtered'])
            
            print(f"✓ Batch {batch_num}: {len(results['approved'])} approved, {len(results['filtered'])} filtered")
            
        except Exception as e:
            print(f"✗ Batch {batch_num} failed: {e}")
            continue
        
        # Rate limiting (if needed)
        if i + batch_size < len(all_articles):
            time.sleep(0.5)
    
    return {
        'approved': all_approved,
        'filtered': all_filtered,
        'total': len(all_articles),
        'approval_rate': len(all_approved) / len(all_articles) * 100 if all_articles else 0
    }


def validate_step1_output(results: Dict, input_articles: List[Dict]) -> tuple:
    """
    Validate Step 1 scoring output before passing to Step 2
    """
    errors = []
    warnings = []
    
    # Check structure
    if not isinstance(results, dict):
        errors.append("Results must be a dict with 'approved' and 'filtered'")
        return False, errors, warnings
    
    if 'approved' not in results or 'filtered' not in results:
        errors.append("Missing 'approved' or 'filtered' fields")
        return False, errors, warnings
    
    approved = results['approved']
    filtered = results['filtered']
    
    # Validate counts
    total_returned = len(approved) + len(filtered)
    if total_returned != len(input_articles):
        errors.append(f"Count mismatch: {total_returned} returned, {len(input_articles)} input")
    
    # Validate approved articles have URLs for Step 2
    for article in approved:
        if 'url' not in article or not article['url']:
            errors.append(f"Approved article missing URL: {article.get('title', 'Unknown')}")
        
        if 'score' not in article:
            errors.append(f"Article missing score: {article.get('title', 'Unknown')}")
        elif article['score'] < 700:
            warnings.append(f"Approved article scored below 700: {article['title']} ({article['score']})")
    
    # Check approval rate
    approval_rate = results.get('approval_rate', 0)
    if approval_rate < 5:
        warnings.append(f"Very low approval rate: {approval_rate:.1f}% - standards may be too high")
    elif approval_rate > 80:
        warnings.append(f"Very high approval rate: {approval_rate:.1f}% - standards may be too low")
    
    is_valid = len(errors) == 0
    return is_valid, errors, warnings


def analyze_step1_results(results: Dict) -> Dict:
    """
    Analyze Step 1 scoring patterns
    """
    approved = results['approved']
    filtered = results['filtered']
    
    # Score distribution
    all_scores = [a['score'] for a in approved + filtered]
    
    analytics = {
        'total_articles': len(all_scores),
        'approved_count': len(approved),
        'filtered_count': len(filtered),
        'approval_rate': results['approval_rate'],
        'score_distribution': {
            '950-1000 (Critical)': len([s for s in all_scores if s >= 950]),
            '850-949 (Highly Important)': len([s for s in all_scores if 850 <= s < 950]),
            '700-849 (Important)': len([s for s in all_scores if 700 <= s < 850]),
            '500-699 (Filtered)': len([s for s in all_scores if 500 <= s < 700]),
            '0-499 (Filtered)': len([s for s in all_scores if s < 500])
        },
        'avg_approved_score': sum(a['score'] for a in approved) / len(approved) if approved else 0,
        'avg_filtered_score': sum(f['score'] for f in filtered) / len(filtered) if filtered else 0,
        'top_sources': {}
    }
    
    # Top sources in approved
    for article in approved:
        source = article.get('source', 'Unknown')
        analytics['top_sources'][source] = analytics['top_sources'].get(source, 0) + 1
    
    return analytics


# Example usage and testing
if __name__ == "__main__":
    # Test with sample articles
    print("🧪 TESTING STEP 1: GEMINI NEWS SCORING")
    print("=" * 60)
    
    # Sample articles from RSS feed
    articles_from_rss = [
        {
            "title": "European Central Bank raises interest rates to 4.5 percent",
            "source": "Reuters",
            "text": "The ECB announced Thursday it is raising rates by 0.25 percentage points to combat inflation.",
            "url": "https://www.reuters.com/markets/europe/ecb-rates-2024"
        },
        {
            "title": "Celebrity couple announces divorce",
            "source": "Entertainment Weekly",
            "text": "Famous actor and actress announce separation after 5 years.",
            "url": "https://ew.com/celebrity-divorce"
        },
        {
            "title": "UN Security Council votes on Gaza ceasefire resolution",
            "source": "Associated Press",
            "text": "The United Nations Security Council met today to vote on a resolution calling for immediate ceasefire.",
            "url": "https://apnews.com/un-gaza-vote"
        },
        {
            "title": "Local bakery wins best pastry award",
            "source": "City News",
            "text": "Downtown bakery receives recognition for their croissants.",
            "url": "https://citynews.com/bakery-award"
        },
        {
            "title": "Major tech company announces layoffs affecting 10,000 employees",
            "source": "Bloomberg",
            "text": "Tech giant announces significant workforce reduction due to economic pressures.",
            "url": "https://bloomberg.com/tech-layoffs"
        }
    ]
    
    # Get API key from environment
    api_key = os.getenv('GOOGLE_API_KEY')
    if not api_key:
        print("❌ GOOGLE_API_KEY environment variable not set")
        print("Please set your Google AI API key:")
        print("export GOOGLE_API_KEY='your-api-key-here'")
        exit(1)
    
    print(f"\n📊 Scoring {len(articles_from_rss)} sample articles...")
    
    try:
        results = score_news_articles_step1(articles_from_rss, api_key)
        
        print(f"\n=== STEP 1 RESULTS ===")
        print(f"Total articles: {results['total']}")
        print(f"Approved: {len(results['approved'])} ({results['approval_rate']:.1f}%)")
        print(f"Filtered: {len(results['filtered'])}")
        
        print("\n=== APPROVED ARTICLES (Ready for Step 2) ===")
        for article in results['approved']:
            print(f"[{article['score']}] {article['title']}")
            print(f"    Source: {article['source']}")
            print(f"    URL: {article['url']}")
        
        print("\n=== FILTERED ARTICLES ===")
        for article in results['filtered']:
            print(f"[{article['score']}] {article['title']}")
            print(f"    Source: {article['source']}")
        
        # Validate results
        is_valid, errors, warnings = validate_step1_output(results, articles_from_rss)
        
        if not is_valid:
            print(f"\n❌ VALIDATION ERRORS:")
            for error in errors:
                print(f"  - {error}")
        elif warnings:
            print(f"\n⚠️  VALIDATION WARNINGS:")
            for warning in warnings:
                print(f"  - {warning}")
        else:
            print(f"\n✅ Validation passed!")
        
        # Analytics
        analytics = analyze_step1_results(results)
        print(f"\n📈 ANALYTICS:")
        print(f"   Average approved score: {analytics['avg_approved_score']:.1f}")
        print(f"   Average filtered score: {analytics['avg_filtered_score']:.1f}")
        print(f"   Score distribution: {analytics['score_distribution']}")
        
        print(f"\n🚀 Ready for Step 2: {len(results['approved'])} URLs to fetch with Jina")
        
    except Exception as e:
        print(f"❌ Error: {e}")
