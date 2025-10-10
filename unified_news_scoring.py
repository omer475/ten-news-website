# TEN NEWS - UNIFIED SCORING SYSTEM (0-100 Points)
# Used by both Part 1 (Breaking) and Part 2 (Global)
# Minimum threshold: 70 points

import json
import google.generativeai as genai

GEMINI_MODEL = "gemini-2.0-flash-exp"  # Latest Gemini 2.0 (faster & smarter)

def score_articles_unified(articles, google_api_key, part_name="Unknown"):
    """
    Unified 0-100 scoring system for all news articles
    
    2-STAGE FILTERING:
    Stage 1: Instant rejection (celebrity, local, sports, clickbait)
    Stage 2: AI scoring 0-100 across 4 dimensions
    
    MINIMUM THRESHOLD: 70 points
    """
    if not google_api_key or google_api_key == 'your-google-api-key-here':
        print("⚠️ Google API key not configured")
        return None
    
    print(f"\n🤖 [{part_name}] Scoring {len(articles)} articles (UNIFIED 0-100 SYSTEM)...")
    print("   📊 Minimum threshold: 70 points")
    
    # Prepare articles for AI (max 30 at a time for quality)
    articles_batch = articles[:30]
    
    articles_info = []
    for i, article in enumerate(articles_batch, 1):
        articles_info.append({
            'id': i,
            'title': article.get('title', '')[:200],
            'description': article.get('description', '')[:400],
            'full_text_preview': article.get('full_text', '')[:800] if article.get('full_text') else '',
            'source': article.get('source', {}).get('name', ''),
            'published': article.get('publishedAt', '')
        })
    
    prompt = f"""You are an ELITE news curator for Ten News Live - a global platform for intelligent readers.
Your standards are EXTREMELY HIGH. Most articles will be REJECTED.

**PHILOSOPHY**: Quality over quantity. Better to show ZERO articles than mediocre ones.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STAGE 1: INSTANT REJECTION CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For EACH article, first check if it matches these categories:

❌ **INSTANT REJECT**:
1. Celebrity/Entertainment Gossip (relationships, fashion, drama, award shows)
2. Local News Without Global Significance (local crime, traffic, city councils)
3. Routine Sports Content (scores, player stats, transfers) - EXCEPT major records/Olympic moments/scandals
4. Clickbait/Listicles ("10 ways...", "You won't believe...")
5. Promotional Content (product launches, company PR, earnings unless market-moving)
6. Opinion Pieces Without New Information

If article matches ANY of these → Set "stage1_reject": true and move to next article.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STAGE 2: SCORING (0-100 POINTS) - Only for articles that passed Stage 1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Score EACH dimension carefully:

**1. GLOBAL RELEVANCE (0-35 points)**
Would people in multiple countries care about this?

   30-35: Universal impact (tech everyone uses, major geopolitical shifts, breakthrough discoveries)
   22-29: Wide international interest (major country developments, global industry changes)
   12-21: Regional but significant (important but limited geography/sector)
   0-11: Too local/niche

**2. SURPRISE FACTOR / "DID YOU KNOW?" (0-30 points)**
Is this unexpected, counterintuitive, or mind-blowing?

   25-30: "Wait, WHAT?" moment (bumblebees shouldn't fly, octopuses have 3 hearts, honey never expires)
   18-24: Very surprising (unexpected partnerships, dramatic pivots, counterintuitive findings)
   10-17: Somewhat unexpected (new tech reveals, unusual developments)
   5-9: Predictable but notable
   0-4: "Yeah, we knew that" - completely expected

**3. UNIVERSAL UNDERSTANDING (0-20 points)**
Can anyone grasp why this matters without specialized knowledge?

   17-20: Instantly clear to everyone (anyone can understand the significance immediately)
   12-16: Easy to explain in one sentence (simple concept with obvious implications)
   6-11: Requires some context (explainable but needs brief background)
   0-5: Too technical/specialized (requires expert knowledge to appreciate)

**4. DATA/SCIENTIFIC INTEREST (0-15 points)**
For data/science stories: Is the finding fascinating?

   13-15: Mind-bending fact (counterintuitive physics, shocking statistics, nature surprises)
   9-12: Very interesting data (meaningful trends, compelling research findings)
   5-8: Useful information (incremental findings, expected correlations)
   0-4: Boring data (obvious findings, dry statistics, predictable results)

Note: Non-science/data stories can score 0-4 in this category without penalty

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL SCORE CALCULATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FINAL_SCORE = Global_Relevance + Surprise_Factor + Universal_Understanding + Data_Scientific_Interest

**MINIMUM TO PUBLISH: 70 POINTS**

Most articles will score 40-70. Only exceptional articles reach 70+.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EMOJI & CATEGORY SELECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Choose the SINGLE most relevant emoji from ALL available emojis
- Assign appropriate category: "World News", "Science", "Technology", "Business", "Health", etc.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RETURN FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return ONLY valid JSON (no markdown, no explanations):

{{
  "scored_articles": [
    {{
      "id": 1,
      "stage1_reject": false,
      "global_relevance": 32,
      "surprise_factor": 28,
      "universal_understanding": 18,
      "data_scientific_interest": 14,
      "final_score": 92,
      "verdict": "PUBLISH",
      "emoji": "🔬",
      "category": "Science",
      "reasoning": "Brief 1-2 sentence explanation"
    }},
    {{
      "id": 2,
      "stage1_reject": true,
      "rejection_reason": "Celebrity gossip - entertainment news",
      "verdict": "REJECT"
    }}
  ]
}}

BE EXTREMELY STRICT. Reject 85-90% of articles.
Only truly important, globally significant news should score 60+.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ARTICLES TO EVALUATE ({len(articles_info)} total):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{json.dumps(articles_info, indent=2)}"""
    
    try:
        model = genai.GenerativeModel(GEMINI_MODEL)
        response = model.generate_content(prompt)
        
        if response.text:
            response_text = response.text.strip()
            
            # Remove markdown if present
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
                
                # Count Stage 1 rejections
                stage1_rejects = sum(1 for a in scored if a.get('stage1_reject', False))
                stage2_evaluated = len(scored) - stage1_rejects
                
                print(f"   ✅ Scored {len(scored)} articles")
                print(f"   ⚡ Stage 1 rejections: {stage1_rejects}")
                print(f"   📊 Stage 2 evaluated: {stage2_evaluated}")
                
                return scored
                
    except Exception as e:
        print(f"   ⚠️ Gemini API error: {str(e)[:150]}")
    
    return None


def apply_unified_scores(articles, scores, score_threshold=70):
    """
    Apply unified 0-100 scores to articles
    Filter by STRICT 70-point threshold
    
    Returns: List of articles meeting threshold, sorted by score (highest first)
    """
    if not scores:
        print("   ⚠️ No AI scores available - ALL articles rejected")
        return []
    
    # Create score map
    score_map = {score['id']: score for score in scores}
    
    # Apply scores and filter
    qualified_articles = []
    stage1_rejected = 0
    stage2_rejected = 0
    
    for i, article in enumerate(articles[:30], 1):
        if i in score_map:
            score_data = score_map[i]
            
            # Check Stage 1 rejection
            if score_data.get('stage1_reject', False):
                stage1_rejected += 1
                continue
            
            # Extract scores
            final_score = score_data.get('final_score', 0)
            
            article['global_relevance'] = score_data.get('global_relevance', 0)
            article['surprise_factor'] = score_data.get('surprise_factor', 0)
            article['universal_understanding'] = score_data.get('universal_understanding', 0)
            article['data_scientific_interest'] = score_data.get('data_scientific_interest', 0)
            article['final_score'] = final_score
            article['verdict'] = score_data.get('verdict', 'REJECT')
            article['emoji'] = score_data.get('emoji', '📰')
            article['category'] = score_data.get('category', 'World News')
            article['ai_reasoning'] = score_data.get('reasoning', '')
            
            # Filter by threshold
            if final_score >= score_threshold:
                qualified_articles.append(article)
            else:
                stage2_rejected += 1
        else:
            stage2_rejected += 1
    
    # Sort by final_score (highest first)
    qualified_articles.sort(key=lambda x: x['final_score'], reverse=True)
    
    print(f"\n   📊 FILTERING RESULTS:")
    print(f"      ❌ Stage 1 rejected: {stage1_rejected}")
    print(f"      ❌ Stage 2 rejected (score < {score_threshold}): {stage2_rejected}")
    print(f"      ✅ QUALIFIED (score ≥ {score_threshold}): {len(qualified_articles)}")
    
    if qualified_articles:
        print(f"\n   🏆 SCORE RANGE: {qualified_articles[-1]['final_score']:.0f} - {qualified_articles[0]['final_score']:.0f} points")
    
    return qualified_articles

