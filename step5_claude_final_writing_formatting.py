# STEP 5: CLAUDE DUAL-LANGUAGE CONTENT GENERATION
# ================================================
# Purpose: Generate dual-language titles, articles, and bullets from scraped article
# Model: Claude Sonnet 4.5 (best quality for writing)
# Input: Articles with scraped full text from Step 2
# Output: Dual-language content (titles, articles, bullets)
# Writes: title_news, title_b2, content_news, content_b2, summary_bullets_news, summary_bullets_b2
# Note: Components (timeline, details, graph) are generated in Step 6 using Perplexity context
# Cost: ~$1.20 per 100 articles
# Time: ~4-5 minutes for 100 articles

import anthropic
import json
import time
import re
from typing import List, Dict, Optional
from dataclasses import dataclass


# ==========================================
# CONFIGURATION
# ==========================================

@dataclass
class WriterConfig:
    """Configuration for Claude writer"""
    model: str = "claude-sonnet-4-20250514"
    max_tokens: int = 4096  # Increased for dual-language content (2 articles of 300-400 words each)
    temperature: float = 0.3
    timeout: int = 60
    retry_attempts: int = 3
    retry_delay: float = 2.0
    delay_between_requests: float = 0.3


# ==========================================
# COMPLETE SYSTEM PROMPT
# ==========================================

CLAUDE_WRITING_PROMPT = """You are a professional news writer for a global news application. Your task is to write dual-language news content.

You will receive:
1. Original scraped article text (from Step 2)
2. Article title and description

You must write DUAL-LANGUAGE CONTENT (Advanced + B2 English):
1. Titles (2 versions: Advanced & B2)
2. Full Articles (2 versions: 300-400 words each)
3. Summary Bullets (2 versions: 4 bullets each, 10-15 words per bullet)

NOTE: Timeline, details, and graph components will be generated separately in Step 6 using web search context.

=== DUAL-LANGUAGE REQUIREMENTS ===

Generate TWO versions of title, article, and bullets:

**ADVANCED VERSION** (Professional News English):
- Target audience: Educated adults, native English speakers
- Professional journalism tone (BBC, Reuters, NYT style)
- Can use complex vocabulary, subordinate clauses, passive voice when appropriate
- May reference cultural/political context without explanation

**B2 VERSION** (Upper-Intermediate English):
- Target audience: B2-level English learners (CEFR B2)
- Simpler sentence structures (mostly simple & compound sentences)
- More common vocabulary (but NOT "too easy" - can use words like "interest", "inflation", "legislation")
- Avoid idioms, cultural references, complex subordinate clauses
- Explain technical terms briefly if needed
- Same information as Advanced, just clearer language

IMPORTANT: Both versions MUST contain the same factual information, just different complexity levels.

=== TITLE_NEWS (Advanced Version) ===
- Maximum 12 words
- Declarative statement (NEVER a question)
- Include geographic/entity context (country, region, organization)
- Complete main point of article
- Active voice, sentence case
- NO clickbait, questions, exclamation marks
- Professional journalism tone
- **BOLD MARKUP**: Add **bold** markdown around 1-3 key terms (names, numbers, places, organizations)
  - Example: "**European Central Bank** raises interest rates to **4.5 percent**"
  - Use **bold** for: person names, organization names, numbers/percentages, key locations

=== TITLE_B2 (B2 English Version) ===
- Maximum 12 words
- Same rules as TITLE_NEWS but with simpler language
- Use more common vocabulary
- Avoid complex phrasing
- Still include geographic/entity context
- **BOLD MARKUP**: Add **bold** markdown around 1-3 key terms
  - Example: "**European Central Bank** increases **interest rates** to **4.5 percent**"

Examples:
✓ Advanced: "**European Central Bank** raises interest rates to **4.5 percent**"
✓ B2: "**European Central Bank** increases **interest rates** to **4.5 percent**"

=== CONTENT_NEWS (Advanced Version, 200-500 words) ===
CRITICAL: Write a comprehensive, detailed news article for educated readers.

Rules:
- **Target: 300-400 words** (Flexible: 200-500 based on source article length)
- Professional journalism tone (BBC, Reuters, NYT style)
- Detailed, comprehensive journalistic coverage
- Stay FAITHFUL to the original article - don't add information not in the source
- Include background context, current developments, and implications
- Use multiple paragraphs for better readability
- Include specific details, quotes, statistics, and expert opinions from the source
- Cover WHO, WHAT, WHEN, WHERE, WHY, and HOW
- Complex vocabulary and sentence structures allowed
- Use past tense for completed events, present tense for ongoing situations
- **BOLD MARKUP**: Add **bold** markdown around important terms throughout
  - Highlight: organization names, person names, numbers, percentages, locations, dates, key concepts

Structure (adjust based on source length):
1. Opening paragraph: Main event with key details and immediate impact
2. Background paragraph: Context, historical factors, and why this matters
3. Details paragraph: Specific information, numbers, quotes, expert analysis
4. Implications paragraph: Consequences, future outlook, broader significance

Writing style:
- Professional journalism tone
- Factual and objective
- Engaging but not sensational
- Can use complex language
- Proper attribution when mentioning sources
- For shorter source articles, focus on key points without padding

=== CONTENT_B2 (B2 English Version, 200-500 words) ===
CRITICAL: Write the SAME article but in simpler B2-level English.

Rules:
- **Target: 300-400 words** (Flexible: 200-500 based on source article length)
- Same information as CONTENT_NEWS, just simpler language
- Simpler sentence structures (mostly simple and compound sentences)
- More common vocabulary (but NOT "too easy" - words like "interest", "inflation" are fine)
- Avoid idioms and complex cultural references
- Explain technical terms briefly if needed
- Use shorter paragraphs
- **BOLD MARKUP**: Add **bold** markdown around important terms throughout
  - Highlight: organization names, person names, numbers, percentages, locations, dates, key concepts

Structure: Same as CONTENT_NEWS (adjust based on source length)
Writing style: Same tone, just clearer language

=== SUMMARY_BULLETS_NEWS (Advanced Version, 4 bullets, 10-15 words each) ===
CRITICAL: Bullets must tell COMPLETE story independently.

Rules:
- Exactly 4 bullets (no more, no less)
- **10-15 words per bullet** (MANDATORY range)
- Each bullet is complete, standalone thought
- Start directly with key information (no "The" or "This")
- No periods at end
- Include specific details (numbers, names, locations)
- Active voice
- Professional news language
- **BOLD MARKUP**: Add **bold** markdown around 1-2 key terms PER BULLET (4-8 highlights total across all bullets)

Structure:
1. First bullet: Full main event with key details (WHO + WHAT + KEY NUMBER)
2. Second bullet: Context or background (WHY, historical comparison)
3. Third bullet: Impact/consequences (WHO affected, HOW MANY)
4. Fourth bullet: Additional key detail or future implications

=== SUMMARY_BULLETS_B2 (B2 English Version, 4 bullets, 10-15 words each) ===
CRITICAL: Same rules as SUMMARY_BULLETS_NEWS but simpler language.

Rules:
- Exactly 4 bullets
- **10-15 words per bullet** (MANDATORY range)
- Same information as SUMMARY_BULLETS_NEWS, just simpler language
- More common vocabulary
- Simpler sentence structures
- Still include all key facts and numbers
- **BOLD MARKUP**: Add **bold** markdown around 1-2 key terms PER BULLET (4-8 highlights total across all bullets)

Examples:
✓ Advanced: "**ECB** raises interest rates to **4.5%**, tenth consecutive increase since July"
✓ B2: "**ECB** increases interest rates to **4.5%**, tenth time in a row since July"

=== OUTPUT FORMAT ===
Return ONLY valid JSON with DUAL-LANGUAGE content:

{
  "title_news": "Advanced version with **bold** markup for 1-3 key terms",
  "title_b2": "B2 simple version with **bold** markup for 1-3 key terms",
  "content_news": "Advanced article 300-400 words with **bold** markup throughout...",
  "content_b2": "B2 simple article 300-400 words with **bold** markup throughout...",
  "summary_bullets_news": [
    "Advanced bullet 1 (10-15 words) with **bold** markup",
    "Advanced bullet 2 (10-15 words) with **bold** markup",
    "Advanced bullet 3 (10-15 words) with **bold** markup",
    "Advanced bullet 4 (10-15 words) with **bold** markup"
  ],
  "summary_bullets_b2": [
    "B2 bullet 1 (10-15 words) with **bold** markup",
    "B2 bullet 2 (10-15 words) with **bold** markup",
    "B2 bullet 3 (10-15 words) with **bold** markup",
    "B2 bullet 4 (10-15 words) with **bold** markup"
  ]
}

VALIDATION CHECKLIST:
- TITLE_NEWS & TITLE_B2: ≤12 words each, declarative, geographic specificity, **bold** markup for 1-3 key terms
- CONTENT_NEWS & CONTENT_B2: Target 300-400 words (flexible: 200-500 based on source), detailed comprehensive coverage, **bold** markup throughout
- SUMMARY_BULLETS_NEWS & SUMMARY_BULLETS_B2: Exactly 4 bullets each, 10-15 words per bullet, **bold** markup 1-2 per bullet

CRITICAL: 
- Both language versions must contain THE SAME INFORMATION, just different complexity levels
- Stay FAITHFUL to the source article - don't add information not in the original
- For shorter source articles, write shorter but complete coverage

NOTE: Components (timeline, details, graph) will be added in Step 6 using Perplexity context.

Return ONLY valid JSON, no markdown, no explanations."""


# ==========================================
# CLAUDE FINAL WRITER CLASS
# ==========================================

class ClaudeFinalWriter:
    """
    Writes complete articles using Claude Sonnet 4.5
    Generates all content in one comprehensive API call
    """
    
    def __init__(self, api_key: str, config: Optional[WriterConfig] = None):
        """
        Initialize writer with API key and optional config
        
        Args:
            api_key: Anthropic API key
            config: WriterConfig instance (uses defaults if None)
        """
        self.api_key = api_key
        self.config = config or WriterConfig()
        self.client = anthropic.Anthropic(api_key=api_key)
        
        print(f"✓ Initialized Claude final writer")
        print(f"  Model: {self.config.model}")
    
    def write_article(self, article: Dict) -> Optional[Dict]:
        """
        Write complete article with all components
        
        Args:
            article: Article with original text + context data from Step 4
        
        Returns:
            Dict with formatted article or None
        """
        # Build user prompt
        user_prompt = self._build_user_prompt(article)
        
        # Retry logic
        for attempt in range(self.config.retry_attempts):
            try:
                response = self.client.messages.create(
                    model=self.config.model,
                    max_tokens=self.config.max_tokens,
                    temperature=self.config.temperature,
                    system=CLAUDE_WRITING_PROMPT,
                    messages=[
                        {
                            "role": "user",
                            "content": user_prompt
                        }
                    ]
                )
                
                # Extract and clean response
                response_text = response.content[0].text.strip()
                response_text = re.sub(r'^```json\s*', '', response_text)
                response_text = re.sub(r'\s*```$', '', response_text)
                response_text = response_text.strip()
                
                # Parse JSON
                result = json.loads(response_text)
                
                # Validate
                is_valid, errors = self._validate_output(result, article)
                
                if is_valid:
                    return result
                else:
                    print(f"  ⚠ Validation issues (attempt {attempt + 1}): {errors[:2]}")
                    if attempt < self.config.retry_attempts - 1:
                        continue
                    else:
                        # Return despite issues
                        return result
            
            except json.JSONDecodeError as e:
                print(f"  ✗ JSON parse error (attempt {attempt + 1}): {e}")
                if attempt < self.config.retry_attempts - 1:
                    time.sleep(self.config.retry_delay)
                    continue
                return None
            
            except Exception as e:
                print(f"  ✗ Error writing article (attempt {attempt + 1}): {e}")
                if attempt < self.config.retry_attempts - 1:
                    time.sleep(self.config.retry_delay)
                    continue
                return None
        
        return None
    
    def _build_user_prompt(self, article: Dict) -> str:
        """
        Build user prompt with article and context data
        
        Args:
            article: Article with text and context data
        
        Returns:
            Formatted prompt string
        """
        # Support both field names for compatibility
        components = article.get('components', article.get('selected_components', []))
        context_data = article.get('context_data', {})
        
        prompt = f"""Write a complete news article based on this information.

ORIGINAL ARTICLE:
Title: {article['title']}
Text: {article['text'][:3000]}

SELECTED COMPONENTS: {', '.join(components)}

"""
        
        # Add context data for each selected component
        if 'timeline' in components and context_data.get('timeline_data'):
            prompt += f"""TIMELINE CONTEXT (from web search):
{json.dumps(context_data['timeline_data'], indent=2)}

"""
        
        if 'details' in components and context_data.get('details_data'):
            prompt += f"""DETAILS CONTEXT (from web search):
{json.dumps(context_data['details_data'], indent=2)}

"""
        
        if 'graph' in components and context_data.get('graph_data'):
            prompt += f"""GRAPH CONTEXT (from web search):
Type: {article.get('graph_type', 'line')}
{json.dumps(context_data['graph_data'], indent=2)}

"""
        
        if 'map' in components and context_data.get('map_data'):
            prompt += f"""MAP CONTEXT (from web search):
{json.dumps(context_data['map_data'], indent=2)}

"""
        
        prompt += """Generate complete article with:
1. Title (≤12 words)
2. Detailed article text (maximum 200 words) - comprehensive, detailed journalistic coverage
3. Summary bullets (exactly 4 bullets, 10-17 words each, max 60 words total)
4. Timeline (if selected)
5. Details (if selected, exactly 3 with numbers)
6. Graph (if selected)
7. Map (if selected)

Return ONLY valid JSON."""
        
        return prompt
    
    def _validate_output(self, result: Dict, article: Dict) -> tuple[bool, List[str]]:
        """
        Validate Claude's output
        
        Returns:
            (is_valid, errors)
        """
        errors = []
        
        # Check required dual-language fields
        required_fields = ['title_news', 'title_b2', 'content_news', 'content_b2', 
                          'summary_bullets_news', 'summary_bullets_b2']
        
        for field in required_fields:
            if field not in result:
                errors.append(f"Missing {field}")
        
        # Validate titles
        if 'title_news' in result and len(result['title_news'].split()) > 12:
            errors.append(f"Title_news too long: {len(result['title_news'].split())} words")
        if 'title_b2' in result and len(result['title_b2'].split()) > 12:
            errors.append(f"Title_b2 too long: {len(result['title_b2'].split())} words")
        
        # Validate content articles (flexible: 200-500 words based on source length)
        for content_field in ['content_news', 'content_b2']:
            if content_field in result:
                content_words = len(result[content_field].split())
                # Minimum 200 words (for short source articles)
                # Maximum 500 words (allow flexibility)
                if content_words < 200:
                    errors.append(f"{content_field} too short: {content_words} words (minimum 200)")
                elif content_words > 500:
                    errors.append(f"{content_field} too long: {content_words} words (maximum 500)")
        
        # Validate summary bullets (both versions)
        for bullets_field in ['summary_bullets_news', 'summary_bullets_b2']:
            if bullets_field in result:
                bullets = result[bullets_field]
                if len(bullets) != 4:
                    errors.append(f"{bullets_field} count: {len(bullets)} (need exactly 4)")
                
                for i, bullet in enumerate(bullets):
                    words = len(bullet.split())
                    if words < 10 or words > 15:
                        errors.append(f"{bullets_field} bullet {i+1} word count: {words} (need 10-15)")
                    
                    if bullet.endswith('.'):
                        errors.append(f"{bullets_field} bullet {i+1} ends with period")
        
        # NOTE: Components (timeline, details, graph) are validated in Step 6
        
        return len(errors) == 0, errors
    
    def write_all_articles(self, articles: List[Dict]) -> List[Dict]:
        """
        Write all articles
        
        Args:
            articles: List of articles from Step 4 with context data
        
        Returns:
            List of complete formatted articles
        """
        print(f"\n{'='*60}")
        print(f"STEP 5: CLAUDE FINAL WRITING & FORMATTING")
        print(f"{'='*60}")
        print(f"Total articles: {len(articles)}\n")
        
        results = []
        failed = []
        
        for i, article in enumerate(articles, 1):
            # Support both field names
            components = article.get('components', article.get('selected_components', []))
            components_str = ', '.join(components) if components else 'none'
            print(f"[{i}/{len(articles)}] Writing: {article['title'][:50]}...")
            print(f"  Components in article: {components}")
            print(f"  Components formatted: {components_str}", end=' ')
            
            # Write article
            formatted = self.write_article(article)
            
            if formatted:
                # Combine with original metadata
                complete_article = {
                    'id': article.get('id', f"article_{i}"),
                    'url': article['url'],  # Keep original URL
                    'guid': article.get('guid', ''),
                    'source': article['source'],
                    'category': article.get('category', 'Other'),
                    'score': article.get('score', 0),
                    'image_url': article.get('image_url', ''),  # Preserve image
                    'author': article.get('author', ''),
                    'published_date': article.get('published_date', ''),
                    'published_time': article.get('published_time', ''),
                    'description': article.get('description', ''),
                    'emoji': article.get('emoji', '📰'),
                    'image_extraction_method': article.get('image_extraction_method', ''),
                    'components': article.get('components', article.get('selected_components', [])),  # NEW: Preserve component order
                    
                    **formatted  # Add Claude-generated content (includes all dual-language fields)
                }
                results.append(complete_article)
                print(f"✓")
            else:
                failed.append(article)
                print(f"✗ Failed")
            
            # Rate limiting
            if i < len(articles):
                time.sleep(self.config.delay_between_requests)
        
        success_rate = len(results) / len(articles) * 100 if articles else 0
        
        print(f"\n{'='*60}")
        print(f"FINAL WRITING COMPLETE")
        print(f"{'='*60}")
        print(f"✓ Success: {len(results)}/{len(articles)} ({success_rate:.1f}%)")
        if failed:
            print(f"✗ Failed: {len(failed)} articles")
        
        return results


# ==========================================
# FINAL VALIDATION
# ==========================================

def validate_final_articles(articles: List[Dict]) -> tuple[bool, List[str]]:
    """
    Final validation of complete articles
    
    Returns:
        (is_valid, errors)
    """
    errors = []
    
    for i, article in enumerate(articles[:5]):  # Check first 5
        # Check required fields
        required_fields = ['title', 'summary', 'original_url', 'source']
        for field in required_fields:
            if field not in article:
                errors.append(f"Article {i} missing field: {field}")
        
        # Validate summary structure
        if 'summary' in article:
            summary = article['summary']
            if 'paragraph' not in summary or 'bullets' not in summary:
                errors.append(f"Article {i} summary missing paragraph or bullets")
        
        # Check bullet completeness
        if 'summary' in article and 'bullets' in article['summary']:
            bullets = article['summary']['bullets']
            for j, bullet in enumerate(bullets):
                # Check if bullet is complete (has subject + verb + detail)
                if len(bullet.split()) < 10:
                    errors.append(f"Article {i} bullet {j+1} too short (may be incomplete)")
    
    return len(errors) == 0, errors


# ==========================================
# STATISTICS & ANALYSIS
# ==========================================

def analyze_final_output(articles: List[Dict]) -> Dict:
    """
    Analyze final output quality
    
    Returns:
        Dict with statistics
    """
    stats = {
        'total_articles': len(articles),
        'avg_title_length': 0,
        'avg_paragraph_length': 0,
        'avg_bullets_count': 0,
        'components_usage': {
            'timeline': 0,
            'details': 0,
            'graph': 0,
            'map': 0
        },
        'categories': {}
    }
    
    if not articles:
        return stats
    
    # Calculate averages
    title_lengths = [len(a['title'].split()) for a in articles]
    stats['avg_title_length'] = sum(title_lengths) / len(title_lengths)
    
    para_lengths = [len(a['summary']['paragraph'].split()) for a in articles if 'summary' in a]
    stats['avg_paragraph_length'] = sum(para_lengths) / len(para_lengths) if para_lengths else 0
    
    bullet_counts = [len(a['summary']['bullets']) for a in articles if 'summary' in a]
    stats['avg_bullets_count'] = sum(bullet_counts) / len(bullet_counts) if bullet_counts else 0
    
    # Component usage
    for article in articles:
        if 'timeline' in article:
            stats['components_usage']['timeline'] += 1
        if 'details' in article:
            stats['components_usage']['details'] += 1
        if 'graph' in article:
            stats['components_usage']['graph'] += 1
        if 'map' in article:
            stats['components_usage']['map'] += 1
    
    # Category distribution
    for article in articles:
        cat = article.get('category', 'Other')
        stats['categories'][cat] = stats['categories'].get(cat, 0) + 1
    
    return stats


# ==========================================
# EXAMPLE USAGE
# ==========================================

def main():
    """
    Example usage of Step 5
    """
    
    # API key
    ANTHROPIC_API_KEY = "YOUR_ANTHROPIC_API_KEY"
    
    # Load articles with context data from Step 4
    articles_with_context = [
        {
            "title": "European Central Bank raises interest rates",
            "text": "The European Central Bank announced Thursday...",
            "url": "https://reuters.com/...",
            "source": "Reuters",
            "score": 850,
            "category": "Economy",
            "selected_components": ["timeline", "details", "graph"],
            "graph_type": "line",
            "context_data": {
                "timeline_data": {
                    "timeline_events": [
                        {"date": "Jul 27, 2023", "event": "ECB begins rate hike cycle"},
                        {"date": "Mar 2024", "event": "First rate pause in 8 months"}
                    ]
                },
                "details_data": {
                    "key_data": [
                        "Previous rate: 4.25%",
                        "Inflation target: 2%",
                        "Current inflation: 5.3%",
                        "GDP growth: 0.1%"
                    ]
                },
                "graph_data": {
                    "graph_data": [
                        {"date": "2020-03", "value": 0.25},
                        {"date": "2022-03", "value": 0.50},
                        {"date": "2023-07", "value": 5.25},
                        {"date": "2024-01", "value": 5.50}
                    ],
                    "y_axis_label": "Interest Rate (%)",
                    "x_axis_label": "Date"
                }
            }
        },
        # ... ~99 more articles
    ]
    
    print(f"Loaded {len(articles_with_context)} articles from Step 4")
    
    # Initialize writer
    writer = ClaudeFinalWriter(
        api_key=ANTHROPIC_API_KEY,
        config=WriterConfig(
            temperature=0.3,
            delay_between_requests=0.3
        )
    )
    
    # Write all articles
    final_articles = writer.write_all_articles(articles_with_context)
    
    # Validate results
    is_valid, errors = validate_final_articles(final_articles)
    if errors:
        print(f"\n⚠ Validation warnings:")
        for error in errors[:10]:
            print(f"  - {error}")
    
    # Analyze output
    stats = analyze_final_output(final_articles)
    
    print(f"\n{'='*60}")
    print(f"OUTPUT STATISTICS")
    print(f"{'='*60}")
    print(f"Total articles: {stats['total_articles']}")
    print(f"Avg title length: {stats['avg_title_length']:.1f} words")
    print(f"Avg paragraph length: {stats['avg_paragraph_length']:.1f} words")
    print(f"Avg bullets per article: {stats['avg_bullets_count']:.1f}")
    
    print(f"\nComponent usage:")
    for component, count in stats['components_usage'].items():
        percentage = (count / stats['total_articles']) * 100 if stats['total_articles'] > 0 else 0
        print(f"  {component}: {count} ({percentage:.1f}%)")
    
    print(f"\nCategory distribution:")
    for category, count in sorted(stats['categories'].items(), key=lambda x: x[1], reverse=True):
        print(f"  {category}: {count}")
    
    # Save final output
    with open('step5_final_articles.json', 'w', encoding='utf-8') as f:
        json.dump(final_articles, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Saved {len(final_articles)} complete articles to step5_final_articles.json")
    print(f"\n{'='*60}")
    print(f"PIPELINE COMPLETE!")
    print(f"{'='*60}")
    print(f"Ready for production: {len(final_articles)} fully formatted articles")
    
    # Show example
    if final_articles:
        print(f"\n{'='*60}")
        print(f"EXAMPLE FINAL ARTICLE")
        print(f"{'='*60}")
        
        example = final_articles[0]
        print(f"\nTitle: {example['title']}")
        print(f"\nParagraph summary:")
        print(f"  {example['summary']['paragraph']}")
        print(f"\nBullet summary:")
        for i, bullet in enumerate(example['summary']['bullets'], 1):
            print(f"  {i}. {bullet}")
        
        if 'timeline' in example:
            print(f"\nTimeline:")
            for event in example['timeline']:
                print(f"  • {event['date']}: {event['event']}")
        
        if 'details' in example:
            print(f"\nDetails:")
            for detail in example['details']:
                print(f"  • {detail}")
    
    return final_articles


if __name__ == "__main__":
    main()


# ==========================================
# COST & PERFORMANCE
# ==========================================

"""
CLAUDE SONNET 4.5 PRICING:
- Input: $3 per 1M tokens
- Output: $15 per 1M tokens

PER ARTICLE:
- Input: ~4,000 tokens (system + article + context)
- Output: ~400 tokens (all formatted content)
- Cost: (4k × $3/1M) + (400 × $15/1M)
- Cost: $0.012 + $0.006 = ~$0.018 (1.8 cents)

FOR 100 ARTICLES:
- Total cost: 100 × $0.018 = ~$1.80

TIME:
- Per article: ~3-4 seconds
- With 0.3s delays: ~4 seconds per article
- 100 articles: ~6-7 minutes

COMPLETE PIPELINE COST (all 5 steps):
Step 1: Gemini scoring = $0.02
Step 2: ScrapingBee fetching = $0.05
Step 3: Gemini component selection = $0.035
Step 4: Perplexity context search = $0.31
Step 5: Claude final writing = $1.80
TOTAL: ~$2.22 per 100 articles

Per article: ~$0.022 (2.2 cents)

SUMMARY:
1000 RSS articles → 100 approved → 100 fully formatted
Total cost: ~$2.22
Total time: ~15-20 minutes
"""


# ==========================================
# COMPLETE PIPELINE INTEGRATION
# ==========================================

"""
COMPLETE END-TO-END EXAMPLE:

# Step 1: Score with Gemini
from step1 import GeminiNewsScorer
scorer = GeminiNewsScorer(gemini_key)
step1_result = scorer.score_all_articles(rss_articles)
approved = step1_result['approved']

# Step 2: Fetch with ScrapingBee
from step2 import ScrapingBeeArticleFetcher
fetcher = ScrapingBeeArticleFetcher(scrapingbee_key)
full_articles = fetcher.fetch_batch_parallel(approved)

# Step 3: Select components with Gemini
from step3 import GeminiComponentSelector
selector = GeminiComponentSelector(gemini_key)
articles_with_components = selector.select_components_batch(full_articles)

# Step 4: Search context with Perplexity
from step4 import PerplexityContextSearcher
searcher = PerplexityContextSearcher(perplexity_key)
articles_with_context = searcher.search_all_articles(articles_with_components)

# Step 5: Write with Claude
from step5 import ClaudeFinalWriter
writer = ClaudeFinalWriter(claude_key)
final_articles = writer.write_all_articles(articles_with_context)

# Done! 100 publication-ready articles
print(f"Pipeline complete: {len(final_articles)} articles ready")
"""


# ==========================================
# TROUBLESHOOTING
# ==========================================

"""
COMMON ISSUES & SOLUTIONS:

1. JSON parsing errors:
   - Claude usually returns valid JSON
   - Markdown code blocks are cleaned automatically
   - Retry logic handles most cases

2. Title too long (>12 words):
   - Validation catches this
   - Retry will ask Claude to shorten
   - Rare with clear prompts

3. Paragraph wrong length:
   - Validation catches this
   - Usually within 35-42 range
   - Can adjust tolerance if needed

4. Bullets ending with periods:
   - Validation catches this
   - Claude usually follows rules well
   - Clean manually if needed

5. Details missing numbers:
   - Most common issue
   - Perplexity provides numerical data
   - Claude usually includes numbers
   - Validation catches violations

6. Missing components:
   - Rare - Claude includes selected components
   - May happen if context data was empty
   - Acceptable - means no good data available

7. Slow performance:
   - 3-4 seconds per article is normal
   - Can't parallelize (one Claude conversation per article)
   - Total 6-7 minutes for 100 articles is good

8. High costs:
   - $1.80 per 100 articles is reasonable
   - Using best model (Sonnet 4.5) for quality
   - Could use cheaper model but quality drops
"""


