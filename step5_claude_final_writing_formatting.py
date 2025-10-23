# STEP 5: CLAUDE FINAL WRITING & FORMATTING
# ==========================================
# Purpose: Write everything in one comprehensive Claude call
# Model: Claude Sonnet 4.5 (best quality for writing)
# Input: ~100 articles with context data from Step 4
# Output: Complete formatted articles ready for users
# Writes: Title, Summary (paragraph + bullets), Timeline, Details, Graph, Map
# Cost: ~$1.80 per 100 articles
# Time: ~5-7 minutes for 100 articles

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
    max_tokens: int = 2048
    temperature: float = 0.3
    timeout: int = 60
    retry_attempts: int = 3
    retry_delay: float = 2.0
    delay_between_requests: float = 0.3


# ==========================================
# COMPLETE SYSTEM PROMPT
# ==========================================

CLAUDE_WRITING_PROMPT = """You are a professional news writer for a global news application. Your task is to write a complete, publication-ready news article.

You will receive:
1. Original article text
2. Selected components (timeline, details, graph, map)
3. Context data from web searches (for selected components only)

You must write:
1. Title (≤12 words)
2. Detailed article text (maximum 200 words) - comprehensive, detailed journalistic coverage
3. Summary bullets (3-5 bullets, 8-15 words each, max 40 words total)
4. Timeline (if selected, 2-4 events)
5. Details (if selected, exactly 3 data points)
6. Graph (if selected, formatted data)
7. Map (if selected, formatted coordinates)

=== TITLE RULES ===
- Maximum 12 words
- Declarative statement (NEVER a question)
- Include geographic/entity context (country, region, organization)
- Complete main point of article
- Active voice, sentence case
- NO clickbait, questions, exclamation marks

Examples:
✓ "European Central Bank raises interest rates to 4.5 percent"
✓ "Magnitude 7.8 earthquake strikes Turkey near Syrian border"
✓ "Donald Trump wins 2024 presidential election with 312 electoral votes"

=== DETAILED ARTICLE TEXT (Maximum 200 words) ===
CRITICAL: Write a comprehensive, detailed news article that provides complete information about the story.

Rules:
- Maximum 200 words (MANDATORY - do not exceed)
- Write detailed, comprehensive journalistic coverage
- No minimum word count - focus on quality and completeness
- Provide comprehensive coverage of the story
- Include background context, current developments, and implications
- Use multiple paragraphs for better readability
- Include specific details, quotes, statistics, and expert opinions
- Cover WHO, WHAT, WHEN, WHERE, WHY, and HOW
- Use past tense for completed events, present tense for ongoing situations
- Use active voice
- Write for an educated audience seeking in-depth information

Structure:
1. Opening paragraph: Main event with key details and immediate impact
2. Background paragraph: Context, historical factors, and why this matters
3. Details paragraph: Specific information, numbers, quotes, expert analysis
4. Implications paragraph: Consequences, future outlook, broader significance

Writing style:
- Professional journalism tone
- Factual and objective
- Engaging but not sensational
- Clear and accessible language
- Proper attribution when mentioning sources
- Avoid speculation unless clearly labeled as such

=== SUMMARY BULLETS (3-5 bullets, 8-15 words each, MAX 40 words total) ===
CRITICAL: Bullets must tell COMPLETE story independently.

Rules:
- 3-5 bullets (minimum 3, maximum 5)
- 8-15 words per bullet
- MAXIMUM 40 words total across ALL bullets combined
- Each bullet is complete, standalone thought
- Start directly with key information (no "The" or "This")
- No periods at end
- Include specific details (numbers, names, locations)
- Active voice

Structure:
1. First bullet: Full main event with key details (WHO + WHAT + KEY NUMBER)
2. Second bullet: Context or background (WHY, historical comparison)
3. Third bullet: Impact/consequences (WHO affected, HOW MANY)
4. Fourth bullet: Additional key detail
5. Fifth bullet (optional): Final important detail

Each bullet must be understandable on its own. User should fully understand news from ONLY bullets.

Examples:
✓ "ECB raises interest rates to 4.5%, tenth consecutive increase since July 2023"
✓ "Current inflation at 5.3%, well above the 2% target rate"
✓ "Decision affects 340 million people across 20 eurozone countries"
✓ "Higher borrowing costs expected for mortgages and business loans"

=== TIMELINE (if selected) ===
- 2-4 events in chronological order (oldest first)
- Use context data provided from Perplexity
- Each event: date + description (≤14 words)
- Focus on contextual events (background, related developments, upcoming)
- DO NOT include main news event from title

Date formats:
- Different days: "Oct 14, 2024"
- Same day recent: "14:30, Oct 14"
- Month only: "Oct 2024"
- Future: "Dec 2024"

Format:
[
  {"date": "Jul 27, 2023", "event": "ECB begins rate hike cycle with increase to 3.75 percent"},
  {"date": "Mar 2024", "event": "ECB holds rates steady for first time in eight months"}
]

=== DETAILS (if selected) ===
- EXACTLY 3 data points
- Format: "Label: Value"
- Label: 1-3 words, Value: specific number/data
- Total per detail: under 8 words
- EVERY detail MUST contain a NUMBER

CRITICAL: Each detail must include:
- Percentage: 4.25%, 5.3%
- Amount/Count: 340M, $2.8T, 10 consecutive
- Date: 2023, Mar 2024, Since 2001
- Rate/Ratio: 6.4%, 0.1%

Use context data from Perplexity. DO NOT repeat data from title/summary.

Examples:
✓ "Previous rate: 4.25%"
✓ "Inflation target: 2%"
✓ "GDP growth: 0.1%"

❌ "Platform: Social media" - no number
❌ "Status: Ongoing" - no number

=== GRAPH (if selected) ===
Format graph data from Perplexity context:

{
  "type": "line",  // or "bar", "area", "column"
  "title": "Federal Funds Rate 2020-2024",
  "data": [
    {"date": "2020-03", "value": 0.25},
    {"date": "2022-03", "value": 0.50},
    {"date": "2023-07", "value": 5.25},
    {"date": "2024-01", "value": 5.50}
  ],
  "y_label": "Interest Rate (%)",
  "x_label": "Date"
}

Use data from Perplexity search. Ensure:
- At least 4 data points
- Dates in YYYY-MM format
- Values as numbers only
- Clear axis labels

=== MAP (if selected) ===
Format map data from Perplexity context:

{
  "type": "point_markers",
  "center": {"lat": 37.17, "lon": 37.03},
  "zoom": 7,
  "markers": [
    {
      "lat": 37.17,
      "lon": 37.03,
      "label": "Epicenter (M7.8)",
      "type": "epicenter",
      "color": "red",
      "size": "large"
    },
    {
      "lat": 37.00,
      "lon": 37.38,
      "label": "Gaziantep, Turkey",
      "type": "affected_city",
      "color": "orange",
      "size": "medium",
      "info": "Major damage reported"
    }
  ],
  "affected_region": {
    "type": "circle",
    "center": {"lat": 37.17, "lon": 37.03},
    "radius_km": 200,
    "color": "rgba(255, 0, 0, 0.2)"
  }
}

Color coding:
- red: epicenter, major damage, critical
- orange: significant damage, affected area
- yellow: minor impact, tremors felt
- blue: primary location, general

Zoom levels:
- 4-5: Multi-country
- 7-8: Regional
- 10-11: City-level

=== OUTPUT FORMAT ===
Return ONLY valid JSON:

{
  "title": "...",
  "detailed_text": "Detailed comprehensive article (max 200 words)...",
  "summary_bullets": [
    "Bullet 1 (8-15 words)",
    "Bullet 2 (8-15 words)",
    "Bullet 3 (8-15 words)"
  ],
  "timeline": [...],  // Only if timeline selected
  "details": [...],   // Only if details selected
  "graph": {...},     // Only if graph selected
  "map": {...}        // Only if map selected
}

VALIDATION CHECKLIST:
- Title: ≤12 words, declarative, geographic specificity
- Detailed text: Maximum 200 words, detailed comprehensive coverage, journalistic style
- Bullets: 3-5 bullets, 8-15 words each, MAX 40 words total, complete story, no periods
- Timeline: 2-4 events, chronological, ≤14 words per event
- Details: Exactly 3, all have numbers, <8 words each
- Graph: At least 4 data points, correct format
- Map: Valid coordinates, appropriate colors/sizes

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
3. Summary bullets (3-5, 8-15 words each, max 40 words total)
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
        
        # Check required fields
        if 'title' not in result:
            errors.append("Missing title")
        elif len(result['title'].split()) > 12:
            errors.append(f"Title too long: {len(result['title'].split())} words")
        
        # Validate detailed text
        if 'detailed_text' not in result:
            errors.append("Missing detailed_text")
        else:
            detailed_words = len(result['detailed_text'].split())
            if detailed_words > 200:
                errors.append(f"Detailed text word count: {detailed_words} (maximum 200)")
            elif detailed_words < 50:
                errors.append(f"Detailed text too short: {detailed_words} words (should be detailed and comprehensive)")
        
        # Validate summary bullets
        if 'summary_bullets' not in result:
            errors.append("Missing summary_bullets")
        else:
            bullets = result['summary_bullets']
            if len(bullets) < 3 or len(bullets) > 5:
                errors.append(f"Bullet count: {len(bullets)} (need 3-5)")
            
            # Check total word count across all bullets
            total_words = 0
            for i, bullet in enumerate(bullets):
                words = len(bullet.split())
                total_words += words
                if words < 8 or words > 15:
                    errors.append(f"Bullet {i+1} word count: {words} (need 8-15)")
                
                if bullet.endswith('.'):
                    errors.append(f"Bullet {i+1} ends with period")
            
            if total_words > 40:
                errors.append(f"Total bullet words: {total_words} (max 40)")
        
        # Check selected components - support both field names
        components = article.get('components', article.get('selected_components', []))
        
        if 'timeline' in components:
            if 'timeline' not in result:
                errors.append("Timeline selected but not in output")
            elif len(result['timeline']) < 2 or len(result['timeline']) > 4:
                errors.append(f"Timeline event count: {len(result['timeline'])} (need 2-4)")
        
        if 'details' in components:
            if 'details' not in result:
                errors.append("Details selected but not in output")
            elif len(result['details']) != 3:
                errors.append(f"Details count: {len(result['details'])} (need exactly 3)")
            else:
                for i, detail in enumerate(result['details']):
                    if not any(char.isdigit() for char in detail):
                        errors.append(f"Detail {i+1} has no number: '{detail}'")
        
        if 'graph' in components and 'graph' not in result:
            errors.append("Graph selected but not in output")
        
        if 'map' in components and 'map' not in result:
            errors.append("Map selected but not in output")
        
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
            print(f"  Components: {components_str}", end=' ')
            
            # Write article
            formatted = self.write_article(article)
            
            if formatted:
                # Combine with original metadata - PRESERVE ALL FIELDS
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
                    **formatted  # Add Claude-generated content
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
                if len(bullet.split()) < 8:
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


