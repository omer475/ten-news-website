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

COMPONENT_PROMPT = """You are generating supplementary components for a news article using web search context data.

You will receive:
1. Article title (for context)
2. Selected components to generate (timeline, details, and/or graph)
3. Perplexity search context data for each selected component

Generate ONLY the selected components based on the provided context data.

=== TIMELINE ===
- 2-4 events in chronological order (oldest first)
- Use context data provided from Perplexity search
- Each event: date + description (≤14 words)
- Focus on contextual events (background, related developments, upcoming)
- DO NOT include the main news event from the title

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

=== DETAILS ===
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

=== GRAPH ===
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

=== OUTPUT FORMAT ===
Return ONLY valid JSON with the selected components:

{
  "timeline": [...],  // Only if timeline selected
  "details": [...],   // Only if details selected
  "graph": {...}      // Only if graph selected
}

VALIDATION CHECKLIST:
- Timeline: 2-4 events, chronological, ≤14 words per event (if selected)
- Details: Exactly 3, all have numbers, <8 words each (if selected)
- Graph: At least 4 data points, correct format (if selected)

Return ONLY valid JSON, no markdown, no explanations."""


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
        
        # Build user prompt
        prompt = self._build_prompt(article, components)
        
        # Try up to retry_attempts times
        for attempt in range(self.config.retry_attempts):
            try:
                response = self.client.messages.create(
                    model=self.config.model,
                    max_tokens=self.config.max_tokens,
                    temperature=self.config.temperature,
                    timeout=self.config.timeout,
                    system=COMPONENT_PROMPT,
                    messages=[{
                        "role": "user",
                        "content": prompt
                    }]
                )
                
                # Extract response
                response_text = response.content[0].text
                
                # Remove markdown code blocks if present
                response_text = response_text.replace('```json', '').replace('```', '')
                response_text = response_text.strip()
                
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
    
    def _build_prompt(self, article: Dict, components: List[str]) -> str:
        """Build user prompt for component generation"""
        
        title = article.get('title_news', article.get('title', 'Unknown'))
        context_data = article.get('context_data', {})
        
        prompt = f"""Generate components for this news article:

TITLE: {title}

SELECTED COMPONENTS: {', '.join(components)}

"""
        
        # Add context data for each component
        for component in components:
            if component in context_data and context_data[component]:
                prompt += f"\n=== {component.upper()} CONTEXT DATA ===\n"
                prompt += context_data[component][:2000]  # Limit context length
                prompt += "\n"
        
        prompt += "\nReturn ONLY valid JSON."
        
        return prompt
    
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
                    if not any(char.isdigit() for char in detail):
                        errors.append(f"Detail {i+1} has no number: '{detail}'")
        
        if 'graph' in selected_components:
            if 'graph' not in result:
                errors.append("Graph selected but not in output")
        
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

