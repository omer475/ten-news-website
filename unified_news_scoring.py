# TEN NEWS - UNIFIED SCORING SYSTEM (0-100 Points)
# Used by both Part 1 (Breaking) and Part 2 (Global)
# Minimum threshold: 70 points

import json
import google.generativeai as genai

GEMINI_MODEL = "gemini-1.5-flash-latest"

def score_articles_unified(articles, google_api_key, part_name="Unknown"):
    """
    Unified 0-100 scoring system for all news articles
    
    2-STAGE FILTERING:
    Stage 1: Instant rejection (celebrity, local, sports, clickbait)
    Stage 2: AI scoring 0-100 across 5 dimensions
    
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

**1. GLOBAL IMPACT & IMPORTANCE (0-35 points)**
   30-35: World-changing (pandemics, wars, major disasters, revolutionary discoveries, economic crises)
   20-29: Nationally/regionally significant (major elections, court decisions, corporate mega-deals, significant findings)
   10-19: Notable but limited impact (sector developments, regional news with broader interest)
   0-9: Minor/local

**2. SCIENTIFIC/TECHNOLOGICAL BREAKTHROUGH (0-30 points)**
   25-30: Revolutionary breakthrough (disease cures, paradigm shifts, game-changing tech)
   15-24: Significant advancement (important research, notable progress, meaningful innovations)
   5-14: Incremental progress (small improvements, confirmatory studies)
   0-4: Not scientific/tech or obvious findings

**3. NOVELTY & URGENCY (0-20 points)**
   18-20: Breaking/urgent (happening now, rapidly developing, time-critical)
   12-17: Fresh & timely (last 3 hours, new significant development)
   6-11: Recent (last 24 hours, still relevant)
   0-5: Old (>24 hours, rehashed, updates without new info)

**4. SOURCE CREDIBILITY (0-10 points)**
   9-10: Gold standard (Reuters, AP, BBC, Nature, Science, Cell, Lancet, NEJM, NYT, WaPo, FT, Economist)
   7-8: Highly credible (major national papers, established science outlets, major broadcasters)
   5-6: Credible (regional quality newspapers, specialized publications)
   0-4: Lower credibility (tabloids, blogs, unverified sources)

**5. ENGAGEMENT & INTEREST FACTOR (0-15 points)**
   13-15: Extremely engaging (mind-blowing, clear life-changing implications, fascinating insights)
   8-12: Quite interesting (educational, surprising findings, important implications)
   3-7: Moderately interesting (somewhat interesting, niche appeal)
   0-2: Boring (dry, no clear implications, uninteresting)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL SCORE CALCULATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FINAL_SCORE = Global_Impact + Scientific_Significance + Novelty + Credibility + Engagement

**MINIMUM TO PUBLISH: 70 POINTS**

Most articles will score 40-60. Only exceptional articles reach 70+.

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
      "global_impact": 32,
      "scientific_significance": 28,
      "novelty": 18,
      "credibility": 10,
      "engagement": 14,
      "final_score": 102,
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

BE EXTREMELY STRICT. Reject 90-95% of articles.
Only truly exceptional, globally significant news should score 70+.

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
            
            article['global_impact'] = score_data.get('global_impact', 0)
            article['scientific_significance'] = score_data.get('scientific_significance', 0)
            article['novelty'] = score_data.get('novelty', 0)
            article['credibility'] = score_data.get('credibility', 0)
            article['engagement'] = score_data.get('engagement', 0)
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

