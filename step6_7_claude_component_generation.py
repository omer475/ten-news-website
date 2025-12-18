# STEP 6: CLAUDE COMPONENT GENERATION (Timeline, Details, Graph)
# ================================================================
# Purpose: Generate supplementary components using Perplexity search context
# Model: Claude Sonnet 4.5 (best quality for writing)
# Input: Articles with dual-language content from Step 5 + Perplexity context from Step 4
# Output: Timeline, Details, Graph based on web search results
# Writes: timeline, details, graph (as selected by Gemini in Step 3)
# Cost: ~$0.60 per 100 articles
# Time: ~2-3 minutes for 100 articles

import anthropic
import json
import time
from typing import List, Dict, Optional
from dataclasses import dataclass


# ==========================================
# CONFIGURATION
# ==========================================

@dataclass
class ComponentWriterConfig:
    """Configuration for Claude component writer"""
    model: str = "claude-sonnet-4-20250514"
    max_tokens: int = 1536  # Enough for timeline + details + graph
    temperature: float = 0.3
    timeout: int = 60
    retry_attempts: int = 3
    retry_delay: float = 2.0
    delay_between_requests: float = 0.3


# ==========================================
# COMPONENT GENERATION PROMPT
# ==========================================

COMPONENT_PROMPT = """Generate news article components using the provided search data.

ARTICLE TITLE: {title}
BULLET SUMMARY: {bullets}
SELECTED COMPONENTS: {components}
SEARCH CONTEXT DATA: {context}

Generate ONLY the selected components. Follow formats EXACTLY.

═══════════════════════════════════════════════════════════════
🗺️ MAP (if selected)
═══════════════════════════════════════════════════════════════

Generate 1-3 PRECISE location markers for the story.

PRECISION REQUIREMENTS:
✓ Use the most specific location possible (port, base, facility, city)
✓ NEVER use just a country name
✓ Include exact coordinates
✓ Description explains what happened at this specific location

PRECISION HIERARCHY (use most specific available):
1. Specific sites: "Novorossiysk Naval Base", "Zaporizhzhia Nuclear Plant"
2. Ports/Facilities: "Port of Novorossiysk", "Ben Gurion Airport"
3. Infrastructure: "Crimean Bridge", "Nord Stream Pipeline"
4. Districts/Areas: "Gaza City's Shifa Hospital"
5. Cities: "Novorossiysk", "Kharkiv" (only if no more specific location)

OUTPUT FORMAT:
[
  {
    "name": "Novorossiysk Naval Base",
    "city": "Novorossiysk",
    "country": "Russia",
    "coordinates": {"lat": 44.7234, "lng": 37.7687},
    "description": "Site of underwater drone attack on Kilo-class submarine"
  }
]

GOOD MAP EXAMPLES:
✓ {"name": "Novorossiysk Port", "city": "Novorossiysk", "country": "Russia", ...}
✓ {"name": "Shifa Hospital", "city": "Gaza City", "country": "Palestine", ...}
✓ {"name": "Crimean Bridge", "city": "Kerch Strait", "country": "Russia", ...}

BAD MAP EXAMPLES (REJECTED):
✗ {"name": "Ukraine", "city": "", "country": "Ukraine", ...} - Just a country
✗ {"name": "Russia", "city": "", "country": "Russia", ...} - Just a country
✗ {"name": "Middle East", ...} - A region, not a location

═══════════════════════════════════════════════════════════════
📅 TIMELINE (if selected)
═══════════════════════════════════════════════════════════════

Generate 2-4 events providing CONTEXT for the story.

CRITICAL RULES:
✗ DO NOT include the main news event from the title
✓ Include background events, prior developments, upcoming dates
✓ Chronological order (oldest → newest)
✓ Each event description: MAX 12 words

DATE FORMATS:
- Past events: "Mar 15, 2024" or "Mar 2024" (month only if day unknown)
- Future events: "Expected Dec 2024" or "Q1 2025"
- Same-day events: "14:30 GMT"

OUTPUT FORMAT:
[
  {"date": "Mar 2023", "event": "Ukraine debuts Sea Baby surface drones against Russian fleet"},
  {"date": "Sep 2023", "event": "Drone strike damages Russian landing ship in Sevastopol"},
  {"date": "Jan 2024", "event": "SBU announces development of underwater drone capability"}
]

═══════════════════════════════════════════════════════════════
📋 DETAILS (if selected)
═══════════════════════════════════════════════════════════════

Generate EXACTLY 3 fact cards with information NOT in the bullet summary.

CRITICAL RULES:
✓ Facts must NOT duplicate information in bullet summary
✓ Prioritize interesting details from full article text
✓ Supplement with internet search findings
✓ EVERY detail MUST contain a number or specific data
✓ Label: 1-3 words | Value: specific data
✓ MAX 7 words per detail

SOURCES (in priority order):
1. Interesting facts from full article NOT in bullets
2. Contextual data from internet search
3. Historical comparisons or background stats

NUMBER TYPES:
- Quantities: 4 missiles, 340 km range
- Specifications: 533mm torpedoes, 2,500 kg payload
- Counts: 12 previous attacks, 3rd successful strike
- Dates/Duration: Since 2022, 18-month development

GOOD EXAMPLES (assuming these are NOT in bullets):
✓ "Kalibr missile range: 2,500 km"
✓ "Kilo-class crew size: 52 sailors"
✓ "Sub displacement: 2,350 tons"
✓ "Previous drone attacks: 12"

BAD EXAMPLES:
✗ Any fact already stated in bullet summary
✗ "Status: Ongoing" (no number)
✗ "Target: Submarine" (no specific data)

OUTPUT FORMAT:
[
  {"label": "Kalibr range", "value": "2,500 km"},
  {"label": "Submarine crew", "value": "52 sailors"},
  {"label": "Kilo-class built", "value": "Since 1980"}
]

═══════════════════════════════════════════════════════════════
📊 GRAPH (if selected)
═══════════════════════════════════════════════════════════════

Generate chart data from the search context.

GRAPH TYPE SELECTION:
- "line": Continuous trends over time (rates, prices, temperatures)
- "bar": Comparing categories or discrete periods (quarterly results, countries)
- "area": Cumulative data or ranges (total cases, market share)

REQUIREMENTS:
✓ Minimum 4 data points
✓ Dates in YYYY-MM format
✓ Values as pure numbers (no units in value field)
✓ Clear, concise title (max 6 words)
✓ Axis labels with units

OUTPUT FORMAT:
{
  "type": "line",
  "title": "Ukrainian Drone Attacks 2022-2024",
  "data": [
    {"date": "2022-10", "value": 2},
    {"date": "2023-03", "value": 5},
    {"date": "2023-09", "value": 8},
    {"date": "2024-01", "value": 14}
  ],
  "y_label": "Attacks",
  "x_label": "Date"
}

═══════════════════════════════════════════════════════════════
FINAL OUTPUT
═══════════════════════════════════════════════════════════════

Return ONLY valid JSON with selected components:

{
  "map": [...],         // Include ONLY if map was selected
  "timeline": [...],    // Include ONLY if timeline was selected
  "details": [...],     // Include ONLY if details was selected
  "graph": {...}        // Include ONLY if graph was selected
}

PRE-SUBMISSION CHECKLIST:
□ Map: 1-3 PRECISE locations (not countries), with coordinates and descriptions
□ Timeline: 2-4 events, chronological, ≤12 words each, main event NOT included
□ Details: Exactly 3, ALL have numbers, NOT duplicating bullet summary
□ Graph: 4+ data points, YYYY-MM dates, numeric values only
□ Valid JSON (no trailing commas, no markdown)"""


# ==========================================
# CLAUDE COMPONENT WRITER CLASS
# ==========================================

class ClaudeComponentWriter:
    """
    Generates article components using Claude Sonnet 4.5
    Components: Timeline, Details, Graph
    Based on Perplexity search context data
    """
    
    def __init__(self, api_key: str, config: Optional[ComponentWriterConfig] = None):
        """
        Initialize writer with API key and optional config
        
        Args:
            api_key: Anthropic API key
            config: ComponentWriterConfig instance (uses defaults if None)
        """
        self.client = anthropic.Anthropic(api_key=api_key)
        self.config = config or ComponentWriterConfig()
    
    def write_components(self, article: Dict) -> Optional[Dict]:
        """
        Generate components for a single article
        
        Args:
            article: Article dict with:
                - title_news: Article title (for context)
                - selected_components: List of components to generate
                - context_data: Perplexity search results
        
        Returns:
            Dict with generated components or None if failed
        """
        # Get selected components
        components = article.get('components', article.get('selected_components', []))
        if not components:
            return {}  # No components selected
        
        # Build formatted system prompt with article data
        system_prompt = self._build_system_prompt(article, components)
        
        # Try up to retry_attempts times
        for attempt in range(self.config.retry_attempts):
            try:
                response = self.client.messages.create(
                    model=self.config.model,
                    max_tokens=self.config.max_tokens,
                    temperature=self.config.temperature,
                    timeout=self.config.timeout,
                    system=system_prompt,
                    messages=[{
                        "role": "user",
                        "content": "Generate the components now. Return ONLY valid JSON."
                    }]
                )
                
                # Extract response
                response_text = response.content[0].text
                print(f"   📝 Raw Claude response: {response_text[:300]}...")
                
                # Remove markdown code blocks if present
                import re
                json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response_text)
                if json_match:
                    response_text = json_match.group(1).strip()
                else:
                    response_text = response_text.replace('```json', '').replace('```', '')
                    response_text = response_text.strip()
                
                # Try to find JSON object with braces if not starting with {
                if not response_text.startswith('{'):
                    json_obj_match = re.search(r'\{[\s\S]*\}', response_text)
                    if json_obj_match:
                        response_text = json_obj_match.group(0)
                    elif '"timeline"' in response_text or '"details"' in response_text or '"map"' in response_text or '"graph"' in response_text:
                        # Wrap bare JSON content in braces
                        response_text = '{' + response_text.strip() + '}'
                
                # Clean up trailing commas
                response_text = re.sub(r',\s*}', '}', response_text)
                response_text = re.sub(r',\s*]', ']', response_text)
                
                # Remove any leading/trailing whitespace and newlines inside the JSON
                response_text = response_text.strip()
                
                print(f"   📝 Cleaned JSON: {response_text[:200]}...")
                
                # Parse JSON
                result = json.loads(response_text)
                
                # Validate
                is_valid, errors = self._validate_output(result, components)
                
                if is_valid:
                    return result
                else:
                    print(f"  ⚠ Validation issues (attempt {attempt + 1}): {errors[:2]}")
                    if attempt < self.config.retry_attempts - 1:
                        time.sleep(self.config.retry_delay)
                
            except json.JSONDecodeError as e:
                print(f"❌ JSON decode error: {e}")
                print(f"   Response text: {response_text[:200]}...")
                if attempt < self.config.retry_attempts - 1:
                    time.sleep(self.config.retry_delay)
            except Exception as e:
                print(f"❌ Error: {e}")
                if attempt < self.config.retry_attempts - 1:
                    time.sleep(self.config.retry_delay)
        
        return None  # Failed after all retries
    
    def _build_system_prompt(self, article: Dict, components: List[str]) -> str:
        """Build system prompt with article data filled in"""
        
        title = article.get('title_news', article.get('title', 'Unknown'))
        
        # Get bullet summary
        bullets = article.get('summary_bullets_news', article.get('summary_bullets', []))
        if isinstance(bullets, list):
            bullets_text = '\n'.join([f"• {b}" for b in bullets])
        else:
            bullets_text = str(bullets)
        
        # Build context string from context_data
        context_data = article.get('context_data', {})
        context_parts = []
        for component in components:
            if component in context_data and context_data[component]:
                context_text = context_data[component].get('results', '') if isinstance(context_data[component], dict) else str(context_data[component])
                context_parts.append(context_text[:2500])  # Limit per component
        
        context_str = '\n\n'.join(context_parts) if context_parts else 'No additional context available.'
        
        # Format the prompt template with article data
        formatted_prompt = COMPONENT_PROMPT.format(
            title=title,
            bullets=bullets_text,
            components=', '.join(components),
            context=context_str
        )
        
        return formatted_prompt
    
    def _validate_output(self, result: Dict, selected_components: List[str]) -> tuple[bool, List[str]]:
        """
        Validate component output
        
        Returns:
            (is_valid, errors)
        """
        errors = []
        
        if 'timeline' in selected_components:
            if 'timeline' not in result:
                errors.append("Timeline selected but not in output")
            elif len(result['timeline']) < 2 or len(result['timeline']) > 4:
                errors.append(f"Timeline event count: {len(result['timeline'])} (need 2-4)")
        
        if 'details' in selected_components:
            if 'details' not in result:
                errors.append("Details selected but not in output")
            elif len(result['details']) != 3:
                errors.append(f"Details count: {len(result['details'])} (need exactly 3)")
            else:
                for i, detail in enumerate(result['details']):
                    # Handle both old format (string) and new format (dict with label/value)
                    if isinstance(detail, dict):
                        # New format: {"label": "...", "value": "..."}
                        value = str(detail.get('value', ''))
                        if not any(char.isdigit() for char in value):
                            errors.append(f"Detail {i+1} has no number in value: '{value}'")
                    elif isinstance(detail, str):
                        # Old format: "Label: Value"
                        if not any(char.isdigit() for char in detail):
                            errors.append(f"Detail {i+1} has no number: '{detail}'")
        
        if 'graph' in selected_components:
            if 'graph' not in result:
                errors.append("Graph selected but not in output")
        
        if 'map' in selected_components:
            if 'map' not in result:
                errors.append("Map selected but not in output")
            elif not isinstance(result['map'], list) or len(result['map']) < 1:
                errors.append("Map must have at least 1 location")
            else:
                # Validate each location has required fields and is precise (not just country)
                vague_locations = ['ukraine', 'russia', 'israel', 'palestine', 'china', 'usa', 'united states', 'middle east', 'europe', 'asia']
                for i, loc in enumerate(result['map']):
                    if not isinstance(loc, dict):
                        errors.append(f"Map location {i+1} is not a dict")
                    elif 'name' not in loc or 'coordinates' not in loc:
                        errors.append(f"Map location {i+1} missing name or coordinates")
                    elif loc.get('name', '').lower() in vague_locations:
                        errors.append(f"Map location {i+1} is too vague: '{loc.get('name')}' (need specific site/city)")
        
        return len(errors) == 0, errors
    
    def write_all_articles(self, articles: List[Dict]) -> List[Dict]:
        """
        Generate components for all articles
        
        Args:
            articles: List of articles from Step 5 with dual-language content
        
        Returns:
            Articles with components added
        """
        if not articles:
            return []
        
        print(f"\n{'='*60}")
        print(f"STEP 6: COMPONENT GENERATION")
        print(f"{'='*60}")
        print(f"Total articles: {len(articles)}\n")
        
        results = []
        failed = []
        
        for i, article in enumerate(articles, 1):
            title = article.get('title_news', article.get('title', 'Unknown'))[:60]
            components = article.get('components', article.get('selected_components', []))
            
            print(f"[{i}/{len(articles)}] Generating components: {title}")
            print(f"  Components: {', '.join(components) if components else 'none'}")
            
            if not components:
                # No components selected, just pass through
                results.append(article)
                print(f"  (No components selected)")
                continue
            
            # Generate components
            generated = self.write_components(article)
            
            if generated:
                # Add components to article
                complete_article = {**article, **generated}
                results.append(complete_article)
                print(f"  Components generated: {', '.join(generated.keys())} ✓")
            else:
                # Failed, but include article anyway (components are optional)
                results.append(article)
                failed.append(title)
                print(f"  ✗ Failed (article included without components)")
            
            # Rate limiting
            if i < len(articles):
                time.sleep(self.config.delay_between_requests)
        
        success_rate = ((len(results) - len(failed)) / len(articles) * 100) if articles else 0
        
        print(f"\n{'='*60}")
        print(f"COMPONENT GENERATION COMPLETE")
        print(f"{'='*60}")
        print(f"✓ Success: {len(results) - len(failed)}/{len(articles)} ({success_rate:.1f}%)")
        if failed:
            print(f"⚠ Failed: {len(failed)} articles (included without components)")
        
        return results


# ==========================================
# TESTING
# ==========================================

if __name__ == "__main__":
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    api_key = os.getenv('ANTHROPIC_API_KEY')
    
    # Test with a sample article
    test_article = {
        "title_news": "**European Central Bank** raises interest rates to **4.5 percent**",
        "components": ["timeline", "details"],
        "context_data": {
            "timeline": "ECB began raising rates in July 2023. Previous rate was 4.25%.",
            "details": "Current rate: 4.5%, Previous rate: 4.25%, Inflation: 5.3%"
        }
    }
    
    writer = ClaudeComponentWriter(api_key)
    components = writer.write_components(test_article)
    
    print("\n✅ Generated components:")
    print(json.dumps(components, indent=2))

