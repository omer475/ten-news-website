# STEP 4: PERPLEXITY DYNAMIC CONTEXT SEARCH
# ==========================================
# Purpose: Search web for contextual data based on selected components from Step 3
# Model: Perplexity Sonar (sonar)
# Input: ~100 articles with component selections from Step 3
# Output: Context data for each selected component
# Search Types: Timeline events, Key data points, Graph data, Map locations
# Cost: ~$0.31 per 100 articles (varies by component count)
# Time: ~3-4 minutes for 100 articles

import requests
import json
import time
from typing import List, Dict, Optional
from dataclasses import dataclass


# ==========================================
# CONFIGURATION
# ==========================================

@dataclass
class PerplexityConfig:
    """Configuration for Perplexity searches"""
    base_url: str = "https://api.perplexity.ai/chat/completions"
    model: str = "sonar"  # Valid models: "sonar", "sonar-pro", "sonar-online", "sonar-reasoning"
    temperature: float = 0.2
    max_tokens: int = 2000
    search_recency_filter: str = "month"  # "day", "week", "month", "year"
    timeout: int = 30
    retry_attempts: int = 3
    retry_delay: float = 2.0
    delay_between_requests: float = 0.5
    enable_map_search: bool = False  # Map component currently disabled


# ==========================================
# SEARCH PROMPTS FOR EACH COMPONENT TYPE
# ==========================================

class SearchPrompts:
    """Search prompts optimized for each component type"""
    
    @staticmethod
    def timeline_search(title: str, text_preview: str) -> str:
        """Prompt for finding timeline events"""
        return f"""Find 3-4 historical events that provide context for this news article: "{title}"

Article context: {text_preview[:300]}

Search for:
1. PREVIOUS events that led to this situation (what happened before)
2. RELATED developments in this topic area
3. UPCOMING planned events or deadlines (if ongoing story)

Requirements:
- Return EXACT dates (format: Oct 14, 2024 or "14:30, Oct 14" for same-day with time)
- Each event: 10-15 words maximum
- Focus on events that help understand the CONTEXT, not the main event itself
- Chronological order (oldest first)

Return as JSON:
{{
  "timeline_events": [
    {{"date": "Jul 27, 2023", "event": "ECB begins rate hike cycle with increase to 3.75 percent"}},
    {{"date": "Mar 14, 2024", "event": "ECB holds rates steady for first time in eight months"}},
    {{"date": "Dec 12, 2024", "event": "Next ECB policy meeting scheduled"}}
  ]
}}

Return ONLY valid JSON."""

    @staticmethod
    def details_search(title: str, text_preview: str) -> str:
        """Prompt for finding key data points with numbers"""
        return f"""Find key NUMERICAL data that provides context for this news: "{title}"

Article context: {text_preview[:300]}

CRITICAL: Focus on finding data with NUMBERS (percentages, amounts, dates, counts, rankings).

Search for:
1. BACKGROUND statistics with numbers (previous rates, historical benchmarks, industry averages)
2. COMPARATIVE data with numbers (how this compares to past, other regions, averages)
3. IMPACT data with numbers (affected populations, market size, scope, scale)
4. HISTORICAL context with dates/counts (when this last happened, how many times, since when)

Examples of good numerical data:
- "Previous interest rate was 4.25%"
- "Affects 340 million people across eurozone"
- "Last rate pause was in March 2024"
- "Inflation currently at 5.3% vs target of 2%"
- "GDP growth at 0.1% in Q3"

Requirements:
- EVERY data point must contain a NUMBER
- DO NOT return data already mentioned in the title
- Return 5-8 numerical facts
- Focus on context that helps understand the bigger picture

Return as JSON:
{{
  "key_data": [
    "Previous rate: 4.25%",
    "Inflation target: 2%",
    "Current inflation: 5.3%",
    "GDP growth: 0.1%",
    "Affected population: 340M",
    "Rate hikes: 10 consecutive"
  ]
}}

Return ONLY valid JSON with numerical data."""

    @staticmethod
    def graph_search(title: str, graph_data_needed: str, graph_type: str) -> str:
        """Prompt for finding time-series graph data"""
        return f"""Find time-series data for visualizing: "{graph_data_needed}" related to "{title}"

Graph type: {graph_type}

Search for:
- Historical data points with DATES and VALUES
- Need at least 4-6 data points for visualization
- Cover reasonable time period (typically 2-5 years)
- Include most recent data point

For {graph_type} chart:
{"- Focus on trend over time with continuous data" if graph_type == "line" else ""}
{"- Focus on comparing different categories or entities" if graph_type == "bar" else ""}
{"- Focus on volume/magnitude over time" if graph_type == "area" else ""}
{"- Focus on discrete time periods (quarters, months)" if graph_type == "column" else ""}

Return as JSON:
{{
  "graph_data": [
    {{"date": "2020-03", "value": 0.25, "label": "COVID rate cut"}},
    {{"date": "2022-03", "value": 0.50, "label": "First hike"}},
    {{"date": "2023-07", "value": 5.25, "label": "Peak rate"}},
    {{"date": "2024-01", "value": 5.50, "label": "Current rate"}}
  ],
  "y_axis_label": "Interest Rate (%)",
  "x_axis_label": "Date"
}}

Requirements:
- EXACT dates in YYYY-MM format
- Numerical values only (no strings)
- Optional short labels for key points
- At least 4 data points

Return ONLY valid JSON."""

    @staticmethod
    def map_search(title: str, text_preview: str, map_locations: List[str]) -> str:
        """Prompt for finding geographic coordinates"""
        locations_str = ", ".join(map_locations) if map_locations else "mentioned locations"
        
        return f"""Find geographic coordinates and location data for this news: "{title}"

Article context: {text_preview[:300]}
Locations mentioned: {locations_str}

Search for:
1. PRIMARY LOCATION: Main location of the event (exact coordinates)
2. EPICENTER/CENTER: If disaster/event, find epicenter coordinates
3. AFFECTED AREAS: Other cities/regions mentioned (coordinates for each)
4. EVENT TYPE: earthquake, conflict, election, protest, hurricane, etc.
5. SCALE: Radius in kilometers if applicable

Return as JSON:
{{
  "primary_location": {{"name": "Gaziantep, Turkey", "lat": 37.00, "lon": 37.38}},
  "epicenter": {{"lat": 37.17, "lon": 37.03}},
  "affected_areas": [
    {{"name": "Ankara", "lat": 39.93, "lon": 32.85, "impact": "tremors felt"}},
    {{"name": "Aleppo, Syria", "lat": 36.20, "lon": 36.16, "impact": "major damage"}}
  ],
  "event_type": "earthquake",
  "radius_km": 200
}}

Requirements:
- EXACT coordinates (latitude, longitude as numbers)
- Include impact description for affected areas
- Event type for context
- Radius if applicable (disasters, conflicts)

Return ONLY valid JSON with coordinates."""


# ==========================================
# PERPLEXITY CONTEXT SEARCHER CLASS
# ==========================================

class PerplexityContextSearcher:
    """
    Searches web for contextual data using Perplexity API
    Performs different searches based on selected components
    """
    
    def __init__(self, api_key: str, config: Optional[PerplexityConfig] = None):
        """
        Initialize searcher with API key and optional config
        
        Args:
            api_key: Perplexity API key
            config: PerplexityConfig instance (uses defaults if None)
        """
        if not api_key:
            raise ValueError("PERPLEXITY_API_KEY is required but not provided")
        
        if not api_key.startswith('pplx-'):
            print(f"⚠️  WARNING: Perplexity API key should start with 'pplx-'")
        
        self.api_key = api_key
        self.config = config or PerplexityConfig()
        
        print(f"✓ Initialized Perplexity context searcher")
        print(f"  Model: {self.config.model}")
        print(f"  Search recency: {self.config.search_recency_filter}")
        print(f"  API Key: {api_key[:10]}...{api_key[-4:] if len(api_key) > 14 else '***'}")
    
    def search_timeline(self, article: Dict) -> Optional[Dict]:
        """
        Search for timeline events
        
        Args:
            article: Article dict with title and text
        
        Returns:
            Dict with timeline events or None
        """
        prompt = SearchPrompts.timeline_search(
            article['title'],
            article['text'][:500]
        )
        
        result = self._make_search_request(prompt, "timeline")
        return result
    
    def search_details(self, article: Dict) -> Optional[Dict]:
        """
        Search for key numerical data points
        
        Args:
            article: Article dict with title and text
        
        Returns:
            Dict with key data or None
        """
        prompt = SearchPrompts.details_search(
            article['title'],
            article['text'][:500]
        )
        
        result = self._make_search_request(prompt, "details")
        return result
    
    def search_graph_data(self, article: Dict) -> Optional[Dict]:
        """
        Search for time-series graph data
        
        Args:
            article: Article dict with graph_data_needed and graph_type
        
        Returns:
            Dict with graph data or None
        """
        prompt = SearchPrompts.graph_search(
            article['title'],
            article['graph_data_needed'],
            article['graph_type']
        )
        
        result = self._make_search_request(prompt, "graph")
        return result
    
    def search_map_locations(self, article: Dict) -> Optional[Dict]:
        """
        Search for geographic coordinates
        
        Args:
            article: Article dict with map_locations
        
        Returns:
            Dict with location data or None
        """
        prompt = SearchPrompts.map_search(
            article['title'],
            article['text'][:500],
            article.get('map_locations', [])
        )
        
        result = self._make_search_request(prompt, "map")
        return result
    
    def _make_search_request(self, prompt: str, search_type: str) -> Optional[Dict]:
        """
        Make request to Perplexity API with retry logic
        
        Args:
            prompt: Search prompt
            search_type: Type of search (for error logging)
        
        Returns:
            Parsed JSON response or None
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.config.model,
            "messages": [
                {
                    "role": "system",
                    "content": "You are a news research assistant. Find accurate, factual information from reliable sources. Always return valid JSON."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": self.config.temperature,
            "max_tokens": self.config.max_tokens,
            "return_citations": True,
            "search_recency_filter": self.config.search_recency_filter
        }
        
        for attempt in range(self.config.retry_attempts):
            try:
                response = requests.post(
                    self.config.base_url,
                    headers=headers,
                    json=payload,
                    timeout=self.config.timeout
                )
                
                if response.status_code == 200:
                    data = response.json()
                    content = data['choices'][0]['message']['content']
                    citations = data.get('citations', [])
                    
                    # Clean and parse JSON
                    content = content.strip()
                    if content.startswith('```json'):
                        content = content[7:]
                    if content.startswith('```'):
                        content = content[3:]
                    if content.endswith('```'):
                        content = content[:-3]
                    content = content.strip()
                    
                    result = json.loads(content)
                    result['citations'] = citations
                    
                    return result
                
                elif response.status_code == 429:
                    wait_time = (2 ** attempt) * self.config.retry_delay
                    print(f"  ⚠ Rate limited ({search_type}), waiting {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                
                else:
                    # Log detailed error information
                    error_msg = f"  ✗ Perplexity error ({search_type}): {response.status_code}"
                    try:
                        error_data = response.json()
                        if 'error' in error_data:
                            error_detail = error_data['error']
                            error_msg += f"\n    Error: {error_detail.get('message', 'Unknown error')}"
                            error_msg += f"\n    Type: {error_detail.get('type', 'Unknown')}"
                    except:
                        error_msg += f"\n    Response: {response.text[:200]}"
                    print(error_msg)
                    
                    # Don't retry on 400 errors (bad request) - they won't succeed
                    if response.status_code == 400:
                        return None
                    
                    # Retry for other errors
                    if attempt < self.config.retry_attempts - 1:
                        wait_time = self.config.retry_delay * (attempt + 1)
                        time.sleep(wait_time)
                        continue
                    return None
            
            except json.JSONDecodeError as e:
                print(f"  ⚠ JSON parse error ({search_type}, attempt {attempt + 1}): {e}")
                if attempt < self.config.retry_attempts - 1:
                    time.sleep(self.config.retry_delay)
                    continue
                return None
            
            except Exception as e:
                print(f"  ✗ Search error ({search_type}, attempt {attempt + 1}): {e}")
                if attempt < self.config.retry_attempts - 1:
                    time.sleep(self.config.retry_delay)
                    continue
                return None
        
        return None
    
    def search_article_components(self, article: Dict) -> Dict:
        """
        Search for all selected components for a single article
        
        Args:
            article: Article with components from Step 3
        
        Returns:
            Dict with all search results
        """
        # Support both field names for compatibility
        components = article.get('components', article.get('selected_components', []))
        results = {
            'timeline_data': None,
            'details_data': None,
            'graph_data': None,
            'map_data': None
        }
        
        # Search based on selected components
        if 'timeline' in components:
            results['timeline_data'] = self.search_timeline(article)
            time.sleep(self.config.delay_between_requests)
        
        if 'details' in components:
            results['details_data'] = self.search_details(article)
            time.sleep(self.config.delay_between_requests)
        
        if 'graph' in components:
            results['graph_data'] = self.search_graph_data(article)
            time.sleep(self.config.delay_between_requests)
        
        if 'map' in components:
            if self.config.enable_map_search:
                results['map_data'] = self.search_map_locations(article)
                time.sleep(self.config.delay_between_requests)
            else:
                print(f"  ⚠ Map search is currently disabled (config.enable_map_search = False)")
                results['map_data'] = None
        
        return results
    
    def search_all_articles(self, articles: List[Dict]) -> List[Dict]:
        """
        Search context for all articles
        
        Args:
            articles: List of articles from Step 3 with component selections
        
        Returns:
            List of articles with added context data
        """
        print(f"\n{'='*60}")
        print(f"STEP 4: PERPLEXITY CONTEXT SEARCH")
        print(f"{'='*60}")
        print(f"Total articles: {len(articles)}\n")
        
        results = []
        search_stats = {
            'timeline': {'attempted': 0, 'success': 0},
            'details': {'attempted': 0, 'success': 0},
            'graph': {'attempted': 0, 'success': 0},
            'map': {'attempted': 0, 'success': 0}
        }
        
        for i, article in enumerate(articles, 1):
            # Support both field names for compatibility
            components = article.get('components', article.get('selected_components', []))
            components_str = ', '.join(components) if components else 'none'
            
            print(f"[{i}/{len(articles)}] Searching: {article['title'][:50]}...")
            print(f"  Components: {components_str}")
            
            # Search for selected components
            context_data = self.search_article_components(article)
            
            # Update stats
            for component in components:
                component_key = component
                search_stats[component_key]['attempted'] += 1
                
                data_key = f"{component}_data"
                if context_data.get(data_key):
                    search_stats[component_key]['success'] += 1
                    print(f"    ✓ {component}")
                else:
                    print(f"    ✗ {component} (no data found)")
            
            # Add context to article
            article_with_context = article.copy()
            article_with_context['context_data'] = context_data
            
            results.append(article_with_context)
            
            print()  # Blank line between articles
        
        # Print statistics
        print(f"{'='*60}")
        print(f"CONTEXT SEARCH COMPLETE")
        print(f"{'='*60}")
        print(f"Total articles processed: {len(results)}\n")
        
        print("Search success rates:")
        for component, stats in search_stats.items():
            if stats['attempted'] > 0:
                success_rate = (stats['success'] / stats['attempted']) * 100
                print(f"  {component}: {stats['success']}/{stats['attempted']} ({success_rate:.1f}%)")
        
        return results


# ==========================================
# VALIDATION
# ==========================================

def validate_context_data(articles: List[Dict]) -> tuple[bool, List[str]]:
    """
    Validate context search results
    
    Returns:
        (is_valid, warnings)
    """
    warnings = []
    
    for i, article in enumerate(articles[:10]):  # Check first 10
        # Support both field names
        components = article.get('components', article.get('selected_components', []))
        context_data = article.get('context_data', {})
        
        # Check if selected components have data
        for component in components:
            data_key = f"{component}_data"
            if not context_data.get(data_key):
                warnings.append(f"Article {i}: Selected '{component}' but no data found")
        
        # Validate timeline data structure
        if 'timeline' in components and context_data.get('timeline_data'):
            timeline = context_data['timeline_data']
            if 'timeline_events' in timeline:
                events = timeline['timeline_events']
                if len(events) < 2:
                    warnings.append(f"Article {i}: Timeline has only {len(events)} events (need 2-4)")
        
        # Validate details data structure
        if 'details' in components and context_data.get('details_data'):
            details = context_data['details_data']
            if 'key_data' in details:
                data_points = details['key_data']
                # Check if data points have numbers
                for j, point in enumerate(data_points[:3]):
                    if not any(char.isdigit() for char in point):
                        warnings.append(f"Article {i}: Detail {j} has no number: '{point}'")
        
        # Validate graph data structure
        if 'graph' in components and context_data.get('graph_data'):
            graph = context_data['graph_data']
            if 'graph_data' in graph:
                points = graph['graph_data']
                if len(points) < 4:
                    warnings.append(f"Article {i}: Graph has only {len(points)} data points (need 4+)")
    
    return len(warnings) == 0, warnings


# ==========================================
# EXAMPLE USAGE
# ==========================================

def main():
    """
    Example usage of Step 4
    """
    
    # API key
    PERPLEXITY_API_KEY = "YOUR_PERPLEXITY_API_KEY"
    
    # Load articles with component selections from Step 3
    articles_with_components = [
        {
            "title": "European Central Bank raises interest rates to 4.5 percent",
            "text": "The European Central Bank announced Thursday...",
            "url": "https://reuters.com/...",
            "source": "Reuters",
            "score": 850,
            "category": "Economy",
            "selected_components": ["timeline", "details", "graph"],
            "graph_type": "line",
            "graph_data_needed": "ECB interest rates 2020-2024",
            "map_locations": None
        },
        {
            "title": "Magnitude 7.8 earthquake strikes Turkey and Syria",
            "text": "A powerful magnitude 7.8 earthquake struck...",
            "url": "https://apnews.com/...",
            "source": "Associated Press",
            "score": 920,
            "category": "Disaster",
            "selected_components": ["map", "details", "timeline"],
            "graph_type": None,
            "graph_data_needed": None,
            "map_locations": ["Gaziantep", "Ankara", "Aleppo"]
        },
        # ... ~98 more articles
    ]
    
    print(f"Loaded {len(articles_with_components)} articles from Step 3")
    
    # Initialize searcher
    searcher = PerplexityContextSearcher(
        api_key=PERPLEXITY_API_KEY,
        config=PerplexityConfig(
            search_recency_filter="month",
            delay_between_requests=0.5
        )
    )
    
    # Search context for all articles
    articles_with_context = searcher.search_all_articles(articles_with_components)
    
    # Validate results
    is_valid, warnings = validate_context_data(articles_with_context)
    if warnings:
        print(f"\n⚠ Validation warnings:")
        for warning in warnings[:10]:  # Show first 10
            print(f"  - {warning}")
    
    # Save results
    with open('step4_context_data.json', 'w', encoding='utf-8') as f:
        json.dump(articles_with_context, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Saved {len(articles_with_context)} articles with context to step4_context_data.json")
    print(f"✓ Ready for Step 5: Claude Final Writing")
    
    # Show example
    print(f"\n{'='*60}")
    print(f"EXAMPLE CONTEXT DATA")
    print(f"{'='*60}")
    
    example = articles_with_context[0]
    print(f"\nArticle: {example['title'][:60]}...")
    print(f"Components: {', '.join(example['selected_components'])}")
    print(f"\nContext data retrieved:")
    
    context = example['context_data']
    
    if context.get('timeline_data'):
        print(f"\n  Timeline events:")
        events = context['timeline_data'].get('timeline_events', [])
        for event in events[:3]:
            print(f"    - {event.get('date')}: {event.get('event')[:50]}...")
    
    if context.get('details_data'):
        print(f"\n  Key data points:")
        data = context['details_data'].get('key_data', [])
        for point in data[:3]:
            print(f"    - {point}")
    
    if context.get('graph_data'):
        print(f"\n  Graph data:")
        graph = context['graph_data'].get('graph_data', [])
        print(f"    - {len(graph)} data points")
        print(f"    - Y-axis: {context['graph_data'].get('y_axis_label')}")
    
    if context.get('map_data'):
        print(f"\n  Map data:")
        map_info = context['map_data']
        if map_info.get('primary_location'):
            loc = map_info['primary_location']
            print(f"    - Primary: {loc.get('name')} ({loc.get('lat')}, {loc.get('lon')})")
        affected = map_info.get('affected_areas', [])
        print(f"    - {len(affected)} affected areas")
    
    return articles_with_context


if __name__ == "__main__":
    main()


# ==========================================
# COST & PERFORMANCE
# ==========================================

"""
PERPLEXITY PRICING:
- Sonar Large: ~$0.001 per search request

COST FOR 100 ARTICLES:
Average 3 components per article = 300 total searches
Cost: 300 × $0.001 = ~$0.30

Breakdown by component:
- Timeline searches: ~70 articles × $0.001 = $0.07
- Details searches: ~95 articles × $0.001 = $0.095
- Graph searches: ~40 articles × $0.001 = $0.04
- Map searches: ~30 articles × $0.001 = $0.03
Total: ~$0.31 per 100 articles

TIME:
- Per search: ~2-3 seconds
- Average 3 searches per article = 6-9 seconds per article
- Plus 0.5s delays between searches
- Total: ~10 seconds per article
- 100 articles: ~15-20 minutes

Optimization: Can parallelize searches within same article
- Reduce to ~5 seconds per article
- 100 articles: ~8-10 minutes

SUCCESS RATE:
- Timeline: ~85% (depends on event having history)
- Details: ~95% (almost always finds numbers)
- Graph: ~75% (needs time-series data to exist)
- Map: ~90% (can find coordinates for most locations)
- Overall: ~85-90% success rate
"""


# ==========================================
# INTEGRATION WITH STEP 5
# ==========================================

"""
After Step 4 completes, pass to Step 5 for final writing:

# Get articles with context data
articles_with_context = searcher.search_all_articles(articles_with_components)

print(f"Step 4 complete: {len(articles_with_context)} articles with context data")

# Each article now has:
# - All fields from Steps 1-3
# - context_data: Dict with search results for each component
#   - timeline_data: {timeline_events: [...]}
#   - details_data: {key_data: [...]}
#   - graph_data: {graph_data: [...], y_axis_label: "...", x_axis_label: "..."}
#   - map_data: {primary_location: {...}, affected_areas: [...], epicenter: {...}}

# Step 5 will now format this data into final output:
# - Write title + summary (paragraph + bullets)
# - Format timeline from timeline_data
# - Format details from details_data
# - Format graph from graph_data
# - Format map from map_data

# Proceed to Step 5: Claude Final Writing & Formatting
# See "Step 5: Claude Final Writing" document
"""


# ==========================================
# TROUBLESHOOTING
# ==========================================

"""
COMMON ISSUES & SOLUTIONS:

1. Low success rates (<80%):
   - Check search prompts are clear
   - Verify search_recency_filter is appropriate
   - Some topics may not have web data available
   - Normal for niche stories

2. JSON parsing errors:
   - Retry logic handles most cases
   - Perplexity usually returns valid JSON
   - Markdown code blocks are cleaned automatically

3. Missing numerical data in details:
   - Prompt emphasizes numbers heavily
   - Some stories genuinely lack data
   - Validation will catch this for Step 5

4. Graph data has too few points:
   - Some topics don't have 4+ historical data points
   - This is expected and okay
   - Step 5 can handle partial data or skip graph

5. Map coordinates not found:
   - Rare with major cities
   - May happen with small villages
   - Perplexity is very good at finding coordinates

6. Rate limiting (429):
   - Increase delay_between_requests
   - Reduce search frequency
   - Upgrade Perplexity plan

7. High costs:
   - Already optimized (searches only selected components)
   - Can't reduce further without losing data
   - $0.31 per 100 articles is reasonable

8. Slow performance:
   - Can parallelize searches within article
   - Trade-off: speed vs rate limits
   - Current sequential approach is safest
"""


