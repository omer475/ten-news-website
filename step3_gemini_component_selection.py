# STEP 3: GEMINI COMPONENT SELECTION
# ==========================================
# Purpose: Analyze articles and decide which visual components to include
# Model: Gemini 2.0 Flash (cheapest option)
# Input: ~100 full articles from Step 2
# Output: Component selections for each article (timeline, details, graph, map)
# Components: Choose 2-4 from: Timeline, Details, Graph, Map
# Cost: ~$0.035 per 100 articles
# Time: ~2-3 minutes for 100 articles

import google.generativeai as genai
import json
import time
from typing import List, Dict, Optional
from dataclasses import dataclass


# ==========================================
# CONFIGURATION
# ==========================================

@dataclass
class ComponentConfig:
    """Configuration for component selection"""
    model: str = "gemini-2.0-flash"
    temperature: float = 0.1
    top_p: float = 0.95
    top_k: int = 40
    max_output_tokens: int = 256
    min_components: int = 1  # Minimum components per article (allow single best)
    max_components: int = 4  # Maximum components per article (all if relevant)
    max_article_preview: int = 2000  # Max chars to send (save tokens)
    retry_attempts: int = 3
    retry_delay: float = 2.0


# ==========================================
# SYSTEM PROMPT - COMPONENT SELECTION LOGIC
# ==========================================

COMPONENT_SELECTION_PROMPT = """You are analyzing news article TITLES to select the MOST RELEVANT visual components for each story.

CRITICAL: You will ONLY see the article TITLE. Choose components based on the title alone.

AVAILABLE COMPONENTS (select 1-3 of these, ONLY if truly relevant):
1. timeline - Historical events and chronology
2. details - Key facts, numbers, statistics
3. graph - Data visualization and trends
[MAP COMPONENT CURRENTLY DISABLED]

SELECTION PHILOSOPHY: QUALITY OVER QUANTITY
- Choose ONLY components that add genuine value to understanding the story
- If only 1 component is relevant, select only 1
- If 2 are relevant, select 2
- If 3 are relevant, select 3
- If all 4 are relevant, select 4
- NEVER select irrelevant components just to meet a minimum

COMPONENT SELECTION GUIDE:

📊 GRAPH - Choose for data/trend/comparison stories:
- Economic data (rates, prices, stocks, GDP)
- Election results, polls, voting data
- Climate data (temperatures, emissions)
- Growth/decline trends ("increases to", "falls to")
Examples: "Interest rates rise to 4.5%", "Election results", "Stock market crashes"

📅 TIMELINE - Choose for evolving/historical stories:
- Ongoing investigations, scandals, crises
- Peace talks, negotiations, diplomatic events
- Policy changes with history
- Stories with "recalls", "resigns", "announces"
Examples: "Ambassador recalled", "CEO resigns", "Nuclear deal collapses"

📋 DETAILS - Choose for fact-heavy stories:
- Product launches (specs, prices, dates)
- Deaths, casualties (numbers, names)
- Scientific discoveries (measurements, findings)
- Business deals (amounts, companies)
Examples: "Pope canonizes 7 saints", "iPhone 16 announced", "Company acquires rival"

SELECTION STRATEGY BY TITLE TYPE (choose ONLY relevant ones):

Disasters/Conflicts → ["timeline", "details"] (if ongoing) or ["details"] (if immediate event)
Economic/Financial → ["graph", "details"] (if data-heavy) or ["details"] (if simple announcement)
Politics/Diplomacy → ["timeline", "details"] (if ongoing) or ["details"] (if single event)
Product/Tech News → ["details"] (usually just specs) or ["details", "graph"] (if market data)
Science/Research → ["details"] (usually just findings) or ["details", "graph"] (if data)
Elections → ["graph", "details"] (if results with data) or ["details"] (if single announcement)
Deaths/Casualties → ["details"] (if single event) or ["details", "timeline"] (if historical context)

OUTPUT FORMAT - RETURN ONLY THESE EXACT KEYWORDS:
{
  "components": ["graph", "details"],
  "emoji": "📊",
  "graph_type": "line",
  "graph_data_needed": "historical trend data"
}

EMOJI SELECTION:
Choose ONE emoji that best represents the story's main topic:

📰 News & Media: 📰 📻 📺 🗞️
🌍 Geography & Travel: 🌍 🌎 🌏 🗺️ ✈️ 🚢
🏛️ Politics & Government: 🏛️ ⚖️ 🗳️ 🏴 🏳️
💼 Business & Economy: 💼 💰 📈 📉 💵 💶 💷 💴 🏢 🏦
🔬 Science & Research: 🔬 🧬 🧪 🔭 🌌 ⚗️
💊 Health & Medicine: 💊 🏥 🩺 💉 🧬 🦠
🌱 Environment & Climate: 🌱 ♻️ 🌳 🌊 ⛰️ 🌡️ ⚡ 🌤️ 🌧️ 🌪️ 🔥
⚽ Sports: ⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🥊 🏆 🥇
🎭 Arts & Entertainment: 🎭 🎬 🎵 🎨 📚 🎪 🎤
💻 Technology: 💻 📱 🤖 🔌 💾 🖥️ ⌨️ 🖱️ 📡
🚗 Transportation: 🚗 🚙 🚕 ✈️ 🚂 🚁 🚢 🚀
🏗️ Infrastructure: 🏗️ 🏘️ 🌉 🏭 ⚡
⚠️ Disasters & Emergencies: 🔥 🌊 ⚡ 🌪️ 💥 ⚠️ 🚨
⚔️ Conflicts & Security: ⚔️ 🛡️ 💣 🚨 👮 🔫
🎓 Education: 🎓 📚 🏫 ✏️ 📖
👨‍👩‍👧 Society & Culture: 👥 🤝 ❤️ 👶 👴 ⚡
🍔 Food & Agriculture: 🍔 🌾 🍎 🐄 🌽 🥖
⚖️ Law & Justice: ⚖️ 👨‍⚖️ 🏛️ 📜
🏆 Awards & Achievements: 🏆 🥇 🥈 🥉 ⭐ 🎖️
💀 Death & Tragedy: 💀 ⚰️ 🕊️ 🖤
🎉 Celebrations & Events: 🎉 🎊 🎈 🎁 🎂
🔐 Privacy & Security: 🔐 🔒 🔑 🛡️ 👁️

Examples:
- "Earthquake in Turkey" → 🌊
- "Fed raises interest rates" → 📈
- "SpaceX launches satellite" → 🚀
- "Climate summit in Paris" → 🌍
- "Apple announces iPhone 16" → 📱
- "World Cup final" → ⚽
- "Nobel Prize winner announced" → 🏆

CRITICAL RULES:
1. Use ONLY these exact words: "timeline", "details", "graph", "map"
2. NO descriptive names like "Timeline of events" - just "timeline"
3. Choose ONE emoji that best captures the story's essence
3. Return 1-4 components (choose ONLY relevant ones)
4. Choose the MOST RELEVANT components for the title
5. Quality over quantity - better to have 1 perfect component than 2 mediocre ones
6. Ask yourself: "Does this component genuinely help understand this story?"

EXAMPLES:

Title: "Earthquake strikes Turkey near Gaziantep"
Output: {"components": ["details", "timeline"], "graph_type": null, "graph_data_needed": null}
(Details for casualties/damage, timeline if developing situation)

Title: "Interest rates rise to 4.5 percent"
Output: {"components": ["graph", "details"], "graph_type": "line", "graph_data_needed": "interest rates over time"}
(Graph for rate trends, details for key facts)

Title: "iPhone 16 announced with $999 price"
Output: {"components": ["details"], "graph_type": null, "graph_data_needed": null}
(Only details needed - specs, price, availability)

Title: "Colombia recalls ambassador after Trump accusations"
Output: {"components": ["timeline", "details"], "graph_type": null, "graph_data_needed": null}
(Timeline for diplomatic developments, details for key facts)

Title: "Election results show Biden wins 306 electoral votes"
Output: {"components": ["graph", "details"], "graph_type": "bar", "graph_data_needed": "electoral votes by candidate"}
(Graph for vote visualization, details for key numbers)

Title: "Scientists discover new Earth-like planet"
Output: {"components": ["details"], "graph_type": null, "graph_data_needed": null}
(Only details needed - distance, size, characteristics)

Title: "Hurricane Milton approaches Florida coast"
Output: {"components": ["details", "timeline"], "graph_type": null, "graph_data_needed": null}
(Details for wind speed/category, timeline for forecast progression)

REMEMBER: 
- Analyze ONLY the title
- Use exact keywords: "timeline", "details", "graph" (MAP CURRENTLY DISABLED)
- Select 1-3 components that are TRULY relevant to the story
- Quality over quantity - choose fewer but better components
- Ask: "Would a reader genuinely benefit from this component?"

Return ONLY valid JSON with the exact keyword strings."""


# ==========================================
# GEMINI COMPONENT SELECTOR CLASS
# ==========================================

class GeminiComponentSelector:
    """
    Analyzes articles and selects appropriate visual components
    Uses Gemini 2.0 Flash for cost efficiency
    """
    
    def __init__(self, api_key: str, config: Optional[ComponentConfig] = None):
        """
        Initialize selector with API key and optional config
        
        Args:
            api_key: Google AI API key
            config: ComponentConfig instance (uses defaults if None)
        """
        self.api_key = api_key
        self.config = config or ComponentConfig()
        
        # Configure Gemini
        genai.configure(api_key=api_key)
        
        # Initialize model with system instruction
        self.model = genai.GenerativeModel(
            model_name=self.config.model,
            generation_config={
                'temperature': self.config.temperature,
                'top_p': self.config.top_p,
                'top_k': self.config.top_k,
                'max_output_tokens': self.config.max_output_tokens,
                'response_mime_type': 'application/json'
            },
            system_instruction=COMPONENT_SELECTION_PROMPT
        )
        
        print(f"✓ Initialized Gemini component selector")
        print(f"  Model: {self.config.model}")
        print(f"  Components per article: {self.config.min_components}-{self.config.max_components}")
    
    def select_components(self, article: Dict) -> Dict:
        """
        Select components for a single article
        
        Args:
            article: Dict with 'title' and 'text' from Step 2
        
        Returns:
            Dict with component selection
        """
        # Get article title only
        article_title = article.get('title', 'No title')
        
        user_prompt = f"""Analyze this news title and select the MOST RELEVANT components (1-4).

TITLE: {article_title}

REQUIREMENTS:
- Analyze ONLY the title above
- Select 1-4 components that are TRULY relevant to this story
- Quality over quantity - choose fewer but better components
- Use exact keywords: "timeline", "details", "graph", "map"
- Ask yourself: "Does this component genuinely help understand this story?"

Return ONLY valid JSON with exact component keywords."""

        # Retry logic
        for attempt in range(self.config.retry_attempts):
            try:
                # Send to Gemini
                chat = self.model.start_chat(history=[])
                response = chat.send_message(user_prompt)
                
                # Parse response
                # Check if response was blocked by safety filters
                if not response.text:
                    print(f"  ⚠ Response blocked by safety filters (attempt {attempt + 1}/{self.config.retry_attempts})")
                    if attempt < self.config.retry_attempts - 1:
                        time.sleep(self.config.retry_delay)
                        continue
                    else:
                        return self._get_fallback_selection(article_title)
                
                result_text = response.text.strip()
                result = json.loads(result_text)
                
                # Debug: Check if result is a list instead of dict
                if isinstance(result, list) and len(result) > 0:
                    result = result[0]  # Take first item if it's a list
                
                # Validate and fix if needed
                result = self._validate_and_fix_selection(result)
                
                return result
            
            except json.JSONDecodeError as e:
                print(f"  ⚠ JSON parse error (attempt {attempt + 1}/{self.config.retry_attempts}): {e}")
                if attempt < self.config.retry_attempts - 1:
                    time.sleep(self.config.retry_delay)
                    continue
                else:
                    # Return intelligent fallback
                    return self._get_fallback_selection(article_title)
            
            except Exception as e:
                error_msg = str(e)
                if "response.text" in error_msg and "finish_reason" in error_msg:
                    print(f"  ⚠ Gemini safety filter blocked content (attempt {attempt + 1}/{self.config.retry_attempts})")
                else:
                    print(f"  ✗ Error selecting components (attempt {attempt + 1}/{self.config.retry_attempts}): {e}")
                
                if attempt < self.config.retry_attempts - 1:
                    time.sleep(self.config.retry_delay)
                    continue
                else:
                    return self._get_fallback_selection(article_title)
        
        return self._get_fallback_selection(article_title)
    
    def _validate_and_fix_selection(self, result: Dict) -> Dict:
        """
        Validate component selection and fix if needed
        
        Args:
            result: Raw result from Gemini
        
        Returns:
            Validated and fixed result
        """
        # Ensure result is a dict (need article reference for smart fallback)
        if not isinstance(result, dict):
            print(f"  ⚠ Invalid result type: {type(result)}, using fallback")
            return self._get_fallback_selection()
        
        # Ensure components field exists
        if 'components' not in result:
            result['components'] = []
        
        components = result['components']
        
        # Ensure components is a list (need article reference for smart fallback)
        if not isinstance(components, list):
            print(f"  ⚠ Components is not a list: {type(components)}, using fallback")
            return self._get_fallback_selection()
        
        # Filter out any non-string components
        # Note: 'map' is currently disabled but kept in valid set for backwards compatibility
        valid_component_names = {'timeline', 'details', 'graph', 'map'}
        filtered_components = []
        for comp in components:
            if isinstance(comp, str):
                # Skip 'map' component (currently disabled)
                if comp == 'map':
                    print(f"  ⚠ Map component is currently disabled, skipping")
                    continue
                if comp in valid_component_names:
                    filtered_components.append(comp)
                else:
                    print(f"  ⚠ Invalid component name: '{comp}' (expected: timeline, details, graph)")
            elif isinstance(comp, dict):
                # Sometimes Gemini returns dicts - try to extract the component name
                if 'name' in comp:
                    comp_name = comp['name']
                    if comp_name in valid_component_names:
                        filtered_components.append(comp_name)
                    else:
                        print(f"  ⚠ Invalid component name in dict: '{comp_name}'")
                else:
                    print(f"  ⚠ Invalid component dict (no 'name' field): {comp}")
            else:
                print(f"  ⚠ Invalid component type: {type(comp)} - value: {comp}")
        
        components = filtered_components
        
        # Ensure minimum components - if empty or too few, use fallback (need article reference for smart fallback)
        if len(components) < self.config.min_components:
            print(f"  ⚠ Too few components ({len(components)}), using fallback")
            return self._get_fallback_selection()
        
        # Ensure maximum components
        if len(components) > self.config.max_components:
            components = components[:self.config.max_components]
        
        result['components'] = components
        
        # Validate graph_type
        if 'graph' in components and not result.get('graph_type'):
            result['graph_type'] = 'line'  # Default to line chart
        elif 'graph' not in components:
            result['graph_type'] = None
        
        # Validate graph_data_needed
        if 'graph' in components and not result.get('graph_data_needed'):
            result['graph_data_needed'] = 'historical data'
        elif 'graph' not in components:
            result['graph_data_needed'] = None
        
        # Validate map_locations
        if 'map' not in components:
            result['map_locations'] = None
        elif not result.get('map_locations'):
            result['map_locations'] = []
        
        return result
    
    def _get_fallback_selection(self, article_title: str = '') -> Dict:
        """
        Return intelligent fallback selection based on article title
        
        Args:
            article_title: Article title to analyze
        
        Returns:
            Smart fallback component selection
        """
        # Simple keyword-based fallback
        title_lower = article_title.lower()
        
        # Check for geographic/disaster indicators
        if any(word in title_lower for word in ['earthquake', 'hurricane', 'flood', 'strikes', 'war', 'conflict', 'border', 'country']):
            return {
                'components': ['details', 'timeline'],
                'emoji': '🌍',
                'graph_type': None,
                'graph_data_needed': None
            }
        
        # Check for data/trend indicators
        elif any(word in title_lower for word in ['rate', 'price', 'percent', 'increases', 'falls', 'stock', 'market', 'election']):
            return {
                'components': ['graph', 'details'],
                'emoji': '📈',
                'graph_type': 'line',
                'graph_data_needed': 'historical data'
            }
        
        # Check for product/announcement
        elif any(word in title_lower for word in ['announces', 'launches', 'reveals', 'iphone', 'product']):
            return {
                'components': ['details', 'timeline'],
                'emoji': '📱',
                'graph_type': None,
                'graph_data_needed': None
            }
        
        # Default fallback
        else:
            return {
                'components': ['timeline', 'details'],
                'emoji': '📰',
                'graph_type': None,
                'graph_data_needed': None
            }
    
    def select_components_batch(self, articles: List[Dict]) -> List[Dict]:
        """
        Select components for multiple articles
        
        Args:
            articles: List of articles from Step 2
        
        Returns:
            List of articles with added component selection
        """
        print(f"\n{'='*60}")
        print(f"STEP 3: COMPONENT SELECTION")
        print(f"{'='*60}")
        print(f"Total articles: {len(articles)}\n")
        
        results = []
        component_stats = {
            'timeline': 0,
            'details': 0,
            'graph': 0,
            'map': 0
        }
        
        for i, article in enumerate(articles, 1):
            # Ensure article is a dictionary
            if not isinstance(article, dict):
                print(f"✗ Error: Article {i} is not a dictionary: {type(article)}")
                continue
                
            print(f"[{i}/{len(articles)}] Analyzing: {article.get('title', 'No title')[:60]}...", end=' ')
            
            try:
                # Select components
                selection = self.select_components(article)
                
                # Ensure selection is valid
                if not isinstance(selection, dict) or 'components' not in selection:
                    print(f"✗ Invalid selection returned")
                    continue
                
                # Add selection to article
                article_with_components = article.copy()
                article_with_components['components'] = selection['components']  # Fixed: was 'selected_components'
                article_with_components['emoji'] = selection.get('emoji', '📰')  # NEW: Extract emoji, default to 📰
                article_with_components['graph_type'] = selection.get('graph_type')
                article_with_components['graph_data_needed'] = selection.get('graph_data_needed')
                article_with_components['map_locations'] = selection.get('map_locations')
                
                results.append(article_with_components)
                
                # Update stats - ensure components are strings
                for component in selection['components']:
                    if isinstance(component, str) and component in component_stats:
                        component_stats[component] += 1
                
                components_str = ', '.join(selection['components']) if selection['components'] else 'none'
                print(f"✓ [{components_str}]")
                
            except Exception as e:
                print(f"✗ Error processing article: {e}")
                continue
            
            # Small delay to avoid rate limits
            if i < len(articles):
                time.sleep(0.1)
        
        # Print statistics
        print(f"\n{'='*60}")
        print(f"COMPONENT SELECTION COMPLETE")
        print(f"{'='*60}")
        print(f"Total articles processed: {len(results)}")
        print(f"\nComponent usage:")
        for component, count in sorted(component_stats.items(), key=lambda x: x[1], reverse=True):
            percentage = (count / len(results)) * 100
            print(f"  {component}: {count} articles ({percentage:.1f}%)")
        
        # Calculate average components per article
        total_components = sum(component_stats.values())
        avg_components = total_components / len(results) if results else 0
        print(f"\nAverage components per article: {avg_components:.1f}")
        
        return results


# ==========================================
# VALIDATION
# ==========================================

def validate_component_selections(articles: List[Dict]) -> tuple[bool, List[str]]:
    """
    Validate component selections
    
    Returns:
        (is_valid, errors)
    """
    errors = []
    
    if not articles:
        errors.append("No articles provided")
        return False, errors
    
    for i, article in enumerate(articles[:10]):  # Check first 10
        if 'selected_components' not in article:
            errors.append(f"Article {i} missing 'selected_components'")
            continue
        
        components = article['selected_components']
        
        # Check component count
        if len(components) < 2:
            errors.append(f"Article {i} has only {len(components)} components (need 2-4)")
        elif len(components) > 4:
            errors.append(f"Article {i} has {len(components)} components (max 4)")
        
        # Check valid component names
        valid_components = {'timeline', 'details', 'graph', 'map'}
        for comp in components:
            if comp not in valid_components:
                errors.append(f"Article {i} has invalid component: {comp}")
        
        # Check graph consistency
        if 'graph' in components:
            if not article.get('graph_type'):
                errors.append(f"Article {i} has graph but no graph_type")
            if not article.get('graph_data_needed'):
                errors.append(f"Article {i} has graph but no graph_data_needed")
        
        # Check map consistency
        if 'map' in components:
            if article.get('map_locations') is None:
                errors.append(f"Article {i} has map but map_locations is None")
    
    return len(errors) == 0, errors


# ==========================================
# STATISTICS & ANALYSIS
# ==========================================

def analyze_component_patterns(articles: List[Dict]) -> Dict:
    """
    Analyze component selection patterns
    
    Returns:
        Dict with analysis results
    """
    # Component combinations
    combinations = {}
    for article in articles:
        components = tuple(sorted(article['selected_components']))
        combinations[components] = combinations.get(components, 0) + 1
    
    # Graph types distribution
    graph_types = {}
    for article in articles:
        if 'graph' in article['selected_components']:
            graph_type = article.get('graph_type', 'unknown')
            graph_types[graph_type] = graph_types.get(graph_type, 0) + 1
    
    # Category-component correlation
    category_components = {}
    for article in articles:
        category = article.get('category', 'Other')
        if category not in category_components:
            category_components[category] = {
                'timeline': 0,
                'details': 0,
                'graph': 0,
                'map': 0,
                'total': 0
            }
        
        category_components[category]['total'] += 1
        for component in article['selected_components']:
            category_components[category][component] += 1
    
    return {
        'total_articles': len(articles),
        'component_combinations': combinations,
        'graph_types': graph_types,
        'category_components': category_components
    }


# ==========================================
# EXAMPLE USAGE
# ==========================================

def main():
    """
    Example usage of Step 3
    """
    
    # API key
    GEMINI_API_KEY = "YOUR_GOOGLE_AI_API_KEY"
    
    # Load full articles from Step 2
    # In real pipeline, this comes from Step 2 output
    full_articles = [
        {
            "title": "European Central Bank raises interest rates to 4.5 percent",
            "text": "The European Central Bank announced Thursday it is raising interest rates by 0.25 percentage points to 4.5%, marking the tenth consecutive increase since July 2023. The decision comes as inflation remains at 5.3%, well above the bank's 2% target. ECB President Christine Lagarde stated that the move is necessary to bring inflation under control...",
            "url": "https://reuters.com/...",
            "source": "Reuters",
            "score": 850,
            "category": "Economy"
        },
        {
            "title": "Magnitude 7.8 earthquake strikes Turkey and Syria",
            "text": "A powerful magnitude 7.8 earthquake struck southern Turkey and northern Syria at 4:17 AM local time. The epicenter was located 23 kilometers from Gaziantep, Turkey. Initial reports indicate at least 1,200 casualties across both countries. The tremor was felt across six countries including Lebanon, Cyprus, and Iraq...",
            "url": "https://apnews.com/...",
            "source": "Associated Press",
            "score": 920,
            "category": "Disaster"
        },
        # ... ~98 more articles from Step 2
    ]
    
    print(f"Loaded {len(full_articles)} full articles from Step 2")
    
    # Initialize selector
    selector = GeminiComponentSelector(
        api_key=GEMINI_API_KEY,
        config=ComponentConfig(
            min_components=2,
            max_components=4
        )
    )
    
    # Select components for all articles
    articles_with_components = selector.select_components_batch(full_articles)
    
    # Validate results
    is_valid, errors = validate_component_selections(articles_with_components)
    if errors:
        print(f"\n⚠ Validation warnings:")
        for error in errors:
            print(f"  - {error}")
    
    # Analyze patterns
    analysis = analyze_component_patterns(articles_with_components)
    
    print(f"\n{'='*60}")
    print(f"COMPONENT PATTERN ANALYSIS")
    print(f"{'='*60}")
    
    # Show most common combinations
    print(f"\nMost common component combinations:")
    top_combos = sorted(analysis['component_combinations'].items(), key=lambda x: x[1], reverse=True)[:5]
    for combo, count in top_combos:
        percentage = (count / analysis['total_articles']) * 100
        components_str = ' + '.join(combo)
        print(f"  {components_str}: {count} articles ({percentage:.1f}%)")
    
    # Show graph type distribution
    if analysis['graph_types']:
        print(f"\nGraph type distribution:")
        for graph_type, count in sorted(analysis['graph_types'].items(), key=lambda x: x[1], reverse=True):
            print(f"  {graph_type}: {count} articles")
    
    # Show category-component correlation
    print(f"\nComponent usage by category:")
    for category, stats in analysis['category_components'].items():
        if stats['total'] > 0:
            print(f"\n  {category} ({stats['total']} articles):")
            for component in ['timeline', 'details', 'graph', 'map']:
                percentage = (stats[component] / stats['total']) * 100
                print(f"    {component}: {percentage:.0f}%")
    
    # Save results
    with open('step3_components_selected.json', 'w', encoding='utf-8') as f:
        json.dump(articles_with_components, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Saved {len(articles_with_components)} articles with components to step3_components_selected.json")
    print(f"✓ Ready for Step 4: Perplexity Context Search")
    
    # Show examples
    print(f"\n{'='*60}")
    print(f"EXAMPLE SELECTIONS")
    print(f"{'='*60}")
    
    for i, article in enumerate(articles_with_components[:3], 1):
        print(f"\nArticle {i}: {article['title'][:60]}...")
        print(f"  Category: {article['category']}")
        print(f"  Components: {', '.join(article['selected_components'])}")
        if 'graph' in article['selected_components']:
            print(f"  Graph type: {article['graph_type']}")
            print(f"  Graph data: {article['graph_data_needed']}")
        if 'map' in article['selected_components']:
            print(f"  Map locations: {article['map_locations']}")
    
    return articles_with_components


if __name__ == "__main__":
    main()


# ==========================================
# COST & PERFORMANCE
# ==========================================

"""
GEMINI 2.0 FLASH PRICING:
- Input: $0.075 per 1M tokens
- Output: $0.30 per 1M tokens

PER 100 ARTICLES:
- Input per article: ~2,500 tokens (system prompt + article preview)
- Output per article: ~100 tokens (component selection JSON)
- Total input: 250,000 tokens
- Total output: 10,000 tokens
- Cost: (250k × $0.075/1M) + (10k × $0.30/1M)
- Cost: $0.01875 + $0.003 = ~$0.022 (~2 cents)

Actually cheaper in practice: ~$0.035 per 100 articles

TIME:
- ~1-2 seconds per article
- Total: ~2-3 minutes for 100 articles
- With 0.1s delays between requests

COMPONENT STATISTICS (Expected):
Based on typical news distribution:
- Details: ~95% of articles (almost always useful)
- Timeline: ~70% of articles (most news has history)
- Graph: ~40% of articles (when time-series data exists)
- Map: ~30% of articles (geographic events)

AVERAGE COMPONENTS PER ARTICLE: ~3.0

Most common combinations:
1. Timeline + Details + Graph (35%)
2. Timeline + Details (25%)
3. Map + Details + Timeline (20%)
4. Details + Graph (15%)
5. All four components (5%)
"""


# ==========================================
# INTEGRATION WITH STEP 4
# ==========================================

"""
After Step 3 completes, pass to Step 4 for dynamic searching:

# Get articles with component selections
articles_with_components = selector.select_components_batch(full_articles)

print(f"Step 3 complete: {len(articles_with_components)} articles with component selections")

# Each article now has:
# - All fields from Step 2 (url, title, text, etc.)
# - selected_components: list of 2-4 components
# - graph_type: 'line', 'bar', 'area', 'column' (if graph selected)
# - graph_data_needed: description of data to search
# - map_locations: list of location names (if map selected)

# Step 4 will now search ONLY for selected components:
# - If 'timeline' selected → search for historical events
# - If 'details' selected → search for key numbers/stats
# - If 'graph' selected → search for time-series data
# - If 'map' selected → search for coordinates/locations

# Proceed to Step 4: Perplexity Dynamic Context Search
# See "Step 4: Perplexity Context Search" document
"""


# ==========================================
# TROUBLESHOOTING
# ==========================================

"""
COMMON ISSUES & SOLUTIONS:

1. Too few components selected:
   - Validation will automatically add 'details' as fallback
   - Adjust min_components in config if needed

2. Wrong component selections:
   - Review system prompt for better guidance
   - Add more examples in prompt
   - Increase temperature slightly (0.2 → 0.3)

3. Missing graph_type when graph selected:
   - Validation automatically defaults to 'line'
   - Can adjust default in _validate_and_fix_selection()

4. JSON parsing errors:
   - Retry logic handles this automatically
   - Falls back to default selection after 3 attempts
   - Default: ['timeline', 'details']

5. Rate limiting:
   - Increase delay between requests
   - Default 0.1s should be sufficient

6. High costs:
   - Already using cheapest model (Gemini 2.0 Flash)
   - Can reduce max_article_preview to 1500 chars
   - Minimal cost impact (~$0.035 per 100 articles)
"""


