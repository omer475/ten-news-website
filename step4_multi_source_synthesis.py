#!/usr/bin/env python3
"""
STEP 4: MULTI-SOURCE SYNTHESIS
==========================================
Purpose: Generate AI-written articles by synthesizing multiple sources about the same event
Model: Claude Sonnet 4.5
Input: Cluster with N source articles (full text from Step 2) + selected image from Step 3
Output: ONE comprehensive 200-word article with dual-language support
Key Feature: Combines information from ALL sources, resolves conflicts, writes as firsthand reporting
"""

import anthropic
import json
import time
import os
from typing import List, Dict, Optional
from dataclasses import dataclass
from datetime import datetime


# ==========================================
# CONFIGURATION
# ==========================================

@dataclass
class SynthesisConfig:
    """Configuration for multi-source synthesis"""
    model: str = "claude-sonnet-4-20250514"
    max_tokens: int = 2500  # Enough for dual-language content + bullets
    temperature: float = 0.3
    timeout: int = 90
    retry_attempts: int = 3
    retry_delay: float = 2.0


# ==========================================
# SYNTHESIS PROMPTS
# ==========================================

SYSTEM_PROMPT = """You are a professional news writer for Today+, a news platform that synthesizes information from multiple sources into comprehensive, original articles.

Your task is to write ONE news article by combining information from multiple source articles about the same event. You will be given N source articles from different news outlets (BBC, CNN, Reuters, etc.) covering the same story.

CRITICAL RULES:
1. Synthesize information from ALL sources - don't just rewrite one source
2. Write as if you're reporting firsthand - NEVER mention "according to sources" or "based on reports"
3. When sources conflict (e.g., different death tolls), use the most recent/authoritative source or say "at least X"
4. Combine unique facts from each source to create the most complete picture
5. Weight information by source credibility and article score
6. Use objective, journalistic tone (inverted pyramid: most important first)
7. Generate content in TWO languages: Advanced (news) and Simplified (B2)

OUTPUT STRUCTURE:
You must generate:
1. Title (news version) - Advanced language, journalistic
2. Title (B2 version) - Simplified language, easier to understand
3. Summary bullets (news) - 3-5 key points, advanced language
4. Summary bullets (B2) - 3-5 key points, simplified language
5. Article content (news) - 200 words, advanced language
6. Article content (B2) - 200 words, simplified language

Return ONLY valid JSON with these exact keys."""


def build_synthesis_prompt(cluster: Dict, full_articles: List[Dict]) -> str:
    """
    Build the user prompt for multi-source synthesis.
    
    Args:
        cluster: Cluster metadata (event_name, main_title, etc.)
        full_articles: List of source articles with full text from Step 2
        
    Returns:
        Formatted prompt string
    """
    # Sort sources by score (highest first)
    sorted_sources = sorted(full_articles, key=lambda x: x.get('score', 0), reverse=True)
    
    # Build sources section
    sources_text = ""
    for i, article in enumerate(sorted_sources, 1):
        source_name = article.get('source_name', article.get('source', 'Unknown'))
        score = article.get('score', 0)
        title = article.get('title', 'Unknown')
        
        # Get content (prefer full content from Step 2, fallback to description)
        content = article.get('content', article.get('text', article.get('description', '')))
        
        # Limit content length to avoid token limits
        if len(content) > 2000:
            content = content[:2000] + "..."
        
        sources_text += f"""
SOURCE {i} ({source_name}, Score: {score}/1000):
Title: {title}
Content: {content}

"""
    
    prompt = f"""You are writing a news article by synthesizing information from {len(sorted_sources)} sources about the same event.

EVENT: {cluster.get('event_name', 'Unknown Event')}

{sources_text}

INSTRUCTIONS:
1. Write ONE comprehensive article that synthesizes information from ALL {len(sorted_sources)} sources above
2. Combine the most important facts from each source
3. If sources disagree on facts (like casualty numbers), use the most recent source or say "at least X"
4. DO NOT quote sources or say "according to" - write as if you're reporting firsthand
5. Use clear, objective, journalistic style
6. Follow inverted pyramid structure (most newsworthy information first)
7. Generate content in TWO language versions:
   - NEWS (Advanced): Professional journalism language
   - B2 (Simplified): Easier English for intermediate learners

OUTPUT FORMAT (JSON):
{{
  "title_news": "Advanced journalistic title with **bold** key terms",
  "title_b2": "Simplified title with **bold** key terms",
  "summary_bullets_news": [
    "First key point in advanced language",
    "Second key point in advanced language",
    "Third key point in advanced language"
  ],
  "summary_bullets_b2": [
    "First key point in simplified language",
    "Second key point in simplified language",
    "Third key point in simplified language"
  ],
  "content_news": "200-word article synthesizing all sources in advanced language...",
  "content_b2": "200-word article synthesizing all sources in simplified language..."
}}

TITLE FORMATTING:
- Use **bold** for key terms (people, places, numbers)
- Example: "**European Central Bank** raises interest rates to **4.5 percent**"

BULLET POINTS:
- 3-5 bullets per version
- Each bullet ≤15 words
- Focus on key facts

ARTICLE CONTENT:
- Exactly 200 words per version
- Start with most newsworthy information
- Include who, what, when, where, why
- Combine facts from ALL sources
- Write as cohesive narrative, not list of facts

Return ONLY valid JSON, no markdown, no explanations."""
    
    return prompt


# ==========================================
# UPDATE PROMPT (for existing articles)
# ==========================================

def build_update_prompt(cluster: Dict, current_article: Dict, new_sources: List[Dict], full_articles: List[Dict]) -> str:
    """
    Build prompt for updating an existing article with new sources.
    
    Args:
        cluster: Cluster metadata
        current_article: Current published article
        new_sources: List of NEW source articles to incorporate
        full_articles: ALL source articles (including old ones)
        
    Returns:
        Formatted update prompt
    """
    # Build new sources section
    new_sources_text = ""
    for i, article in enumerate(new_sources, 1):
        source_name = article.get('source_name', article.get('source', 'Unknown'))
        score = article.get('score', 0)
        title = article.get('title', 'Unknown')
        content = article.get('content', article.get('text', article.get('description', '')))
        
        if len(content) > 2000:
            content = content[:2000] + "..."
        
        new_sources_text += f"""
NEW SOURCE {i} ({source_name}, Score: {score}/1000):
Title: {title}
Content: {content}

"""
    
    prompt = f"""You are UPDATING a news article with new information from {len(new_sources)} additional sources.

EVENT: {cluster.get('event_name', 'Unknown Event')}

CURRENT PUBLISHED ARTICLE (News Version):
Title: {current_article.get('title_news', '')}
Content: {current_article.get('content_news', '')}

CURRENT PUBLISHED ARTICLE (B2 Version):
Title: {current_article.get('title_b2', '')}
Content: {current_article.get('content_b2', '')}

{new_sources_text}

INSTRUCTIONS:
1. Rewrite BOTH versions of the article to incorporate the new information
2. Keep the article to exactly 200 words per version
3. Maintain the same journalistic tone and style
4. Seamlessly integrate new facts (updated numbers, new developments, etc.)
5. Remove outdated information if needed to stay within 200 words
6. Prioritize the most recent and important information
7. If new information contradicts old information, use the newer source
8. Make it read as ONE cohesive article, not multiple articles stitched together
9. Update titles if major new developments warrant it
10. Update summary bullets to reflect current state

OUTPUT FORMAT (JSON):
{{
  "title_news": "Updated advanced title with **bold** key terms",
  "title_b2": "Updated simplified title with **bold** key terms",
  "summary_bullets_news": ["Updated bullet 1", "Updated bullet 2", "Updated bullet 3"],
  "summary_bullets_b2": ["Updated bullet 1", "Updated bullet 2", "Updated bullet 3"],
  "content_news": "Updated 200-word article in advanced language...",
  "content_b2": "Updated 200-word article in simplified language..."
}}

Return ONLY valid JSON, no markdown, no explanations."""
    
    return prompt


# ==========================================
# MULTI-SOURCE SYNTHESIZER
# ==========================================

class MultiSourceSynthesizer:
    """
    Generates AI-written articles by synthesizing multiple sources.
    Replaces single-article processing from original Step 3.
    """
    
    def __init__(self, api_key: str, config: Optional[SynthesisConfig] = None):
        """
        Initialize synthesizer with API key and config.
        
        Args:
            api_key: Anthropic API key
            config: SynthesisConfig instance (uses defaults if None)
        """
        self.client = anthropic.Anthropic(api_key=api_key)
        self.config = config or SynthesisConfig()
    
    def synthesize_cluster(self, cluster: Dict, full_articles: List[Dict], is_update: bool = False, current_article: Dict = None) -> Optional[Dict]:
        """
        Synthesize multiple sources into one article.
        
        Args:
            cluster: Cluster metadata with event_name, main_title, etc.
            full_articles: List of source articles with full text
            is_update: Whether this is an update to existing article
            current_article: Current published article (if is_update=True)
            
        Returns:
            Dict with synthesized content or None if failed
        """
        if not full_articles:
            print("⚠️ No source articles provided")
            return None
        
        # Build prompt
        if is_update and current_article:
            # Identify new sources (added since last update)
            new_sources = [a for a in full_articles if a.get('is_new', False)]
            if not new_sources:
                print("⚠️ No new sources for update")
                return None
            prompt = build_update_prompt(cluster, current_article, new_sources, full_articles)
        else:
            prompt = build_synthesis_prompt(cluster, full_articles)
        
        # Try up to retry_attempts times
        for attempt in range(self.config.retry_attempts):
            try:
                response = self.client.messages.create(
                    model=self.config.model,
                    max_tokens=self.config.max_tokens,
                    temperature=self.config.temperature,
                    timeout=self.config.timeout,
                    system=SYSTEM_PROMPT,
                    messages=[{
                        "role": "user",
                        "content": prompt
                    }]
                )
                
                # Extract response
                response_text = response.content[0].text
                
                # Remove markdown code blocks if present
                response_text = response_text.replace('```json', '').replace('```', '').strip()
                
                # Parse JSON
                result = json.loads(response_text)
                
                # Validate output
                is_valid, errors = self._validate_output(result)
                
                if is_valid:
                    return result
                else:
                    print(f"  ⚠ Validation issues (attempt {attempt + 1}): {errors[:2]}")
                    if attempt < self.config.retry_attempts - 1:
                        time.sleep(self.config.retry_delay)
                
            except json.JSONDecodeError as e:
                print(f"❌ JSON decode error (attempt {attempt + 1}): {e}")
                if attempt < self.config.retry_attempts - 1:
                    time.sleep(self.config.retry_delay)
            except Exception as e:
                print(f"❌ Synthesis error (attempt {attempt + 1}): {e}")
                if attempt < self.config.retry_attempts - 1:
                    time.sleep(self.config.retry_delay)
        
        return None  # Failed after all retries
    
    def _validate_output(self, result: Dict) -> tuple[bool, List[str]]:
        """
        Validate synthesized output.
        
        Args:
            result: Synthesis result dict
            
        Returns:
            (is_valid, list of errors)
        """
        errors = []
        
        # Check required fields
        required_fields = [
            'title_news', 'title_b2',
            'summary_bullets_news', 'summary_bullets_b2',
            'content_news', 'content_b2'
        ]
        
        for field in required_fields:
            if field not in result:
                errors.append(f"Missing required field: {field}")
        
        # Check bullets
        if 'summary_bullets_news' in result:
            bullets = result['summary_bullets_news']
            if not isinstance(bullets, list) or len(bullets) < 3 or len(bullets) > 5:
                errors.append(f"summary_bullets_news must be 3-5 items, got {len(bullets) if isinstance(bullets, list) else 'not a list'}")
        
        if 'summary_bullets_b2' in result:
            bullets = result['summary_bullets_b2']
            if not isinstance(bullets, list) or len(bullets) < 3 or len(bullets) > 5:
                errors.append(f"summary_bullets_b2 must be 3-5 items, got {len(bullets) if isinstance(bullets, list) else 'not a list'}")
        
        # Check content length (should be around 200 words)
        if 'content_news' in result:
            word_count = len(result['content_news'].split())
            if word_count < 150 or word_count > 250:
                errors.append(f"content_news word count: {word_count} (should be 150-250)")
        
        if 'content_b2' in result:
            word_count = len(result['content_b2'].split())
            if word_count < 150 or word_count > 250:
                errors.append(f"content_b2 word count: {word_count} (should be 150-250)")
        
        return len(errors) == 0, errors
    
    def synthesize_all_clusters(self, clusters_with_sources: List[Dict]) -> List[Dict]:
        """
        Synthesize articles for all clusters.
        
        Args:
            clusters_with_sources: List of clusters, each with 'sources' list
            
        Returns:
            List of synthesized articles
        """
        print(f"\n{'='*60}")
        print(f"STEP 3: MULTI-SOURCE SYNTHESIS")
        print(f"{'='*60}")
        print(f"Total clusters: {len(clusters_with_sources)}\n")
        
        results = []
        failed = []
        
        for i, cluster in enumerate(clusters_with_sources, 1):
            event_name = cluster.get('event_name', 'Unknown')[:60]
            source_count = len(cluster.get('sources', []))
            
            print(f"[{i}/{len(clusters_with_sources)}] Synthesizing: {event_name}")
            print(f"  Sources: {source_count}")
            
            # Synthesize
            synthesized = self.synthesize_cluster(cluster, cluster['sources'])
            
            if synthesized:
                # Combine cluster metadata with synthesized content
                complete_article = {
                    'cluster_id': cluster['id'],
                    'event_name': cluster['event_name'],
                    'source_count': source_count,
                    'importance_score': cluster['importance_score'],
                    **synthesized,
                    'sources': cluster['sources']  # Keep source info for reference
                }
                results.append(complete_article)
                print(f"  ✓ Synthesis complete")
            else:
                failed.append(event_name)
                print(f"  ✗ Synthesis failed")
            
            # Rate limiting
            if i < len(clusters_with_sources):
                time.sleep(0.5)
        
        success_rate = (len(results) / len(clusters_with_sources) * 100) if clusters_with_sources else 0
        
        print(f"\n{'='*60}")
        print(f"SYNTHESIS COMPLETE")
        print(f"{'='*60}")
        print(f"✓ Success: {len(results)}/{len(clusters_with_sources)} ({success_rate:.1f}%)")
        if failed:
            print(f"⚠ Failed: {len(failed)} clusters")
            for name in failed[:5]:  # Show first 5
                print(f"   - {name}")
        
        return results


# ==========================================
# TESTING
# ==========================================

if __name__ == "__main__":
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    api_key = os.getenv('ANTHROPIC_API_KEY')
    
    if not api_key:
        print("❌ ANTHROPIC_API_KEY not set")
        exit(1)
    
    # Test cluster with multiple sources
    test_cluster = {
        "id": 1,
        "event_name": "Turkey Earthquake",
        "main_title": "Turkey Earthquake Death Toll Rises to 50",
        "sources": [
            {
                "id": 1,
                "source_name": "BBC News",
                "score": 920,
                "title": "Turkey Earthquake Death Toll Rises to 50",
                "content": """A powerful earthquake struck southeastern Turkey early Monday morning, killing at least 50 people and injuring hundreds more. The 7.8 magnitude quake hit near the city of Gaziantep at 4:17 AM local time. Buildings collapsed across several cities, trapping residents under rubble. Rescue teams are working around the clock to find survivors. The earthquake was felt across the region, including in Syria and Lebanon. Turkish President declared a state of emergency in 10 provinces. International aid is being mobilized."""
            },
            {
                "id": 2,
                "source_name": "CNN",
                "score": 880,
                "title": "Earthquake Strikes Turkey, Dozens Dead",
                "content": """An earthquake devastated Turkey on Monday, leaving dozens dead and hundreds injured. The quake measured 7.8 on the Richter scale and struck before dawn. Thousands of buildings were damaged or destroyed. The epicenter was near Gaziantep, a major city in southern Turkey. Emergency services are overwhelmed with rescue operations. Neighboring countries including Syria also reported casualties. Weather conditions are hampering rescue efforts as temperatures drop below freezing."""
            },
            {
                "id": 3,
                "source_name": "Reuters",
                "score": 850,
                "title": "Turkey Quake Leaves 50 Dead, Hundreds Injured",
                "content": """Turkey was hit by one of its strongest earthquakes in decades on Monday, with officials reporting at least 50 deaths. The magnitude 7.8 earthquake occurred at 4:17 AM, catching many people in their sleep. The worst-hit areas include Gaziantep, Kahramanmaras, and Diyarbakir. Rescue operations continue as authorities fear the death toll will rise. The earthquake also affected northern Syria, where buildings collapsed. Turkey's disaster management agency has deployed thousands of personnel. International rescue teams are en route."""
            }
        ],
        "importance_score": 920,
        "source_count": 3
    }
    
    print("🧪 TESTING MULTI-SOURCE SYNTHESIS")
    print("=" * 80)
    
    try:
        synthesizer = MultiSourceSynthesizer(api_key)
        result = synthesizer.synthesize_cluster(test_cluster, test_cluster['sources'])
        
        if result:
            print("\n✅ SYNTHESIZED ARTICLE:")
            print(f"\nTitle (News): {result['title_news']}")
            print(f"Title (B2): {result['title_b2']}")
            
            print(f"\nBullets (News):")
            for bullet in result['summary_bullets_news']:
                print(f"  • {bullet}")
            
            print(f"\nBullets (B2):")
            for bullet in result['summary_bullets_b2']:
                print(f"  • {bullet}")
            
            print(f"\nContent (News): {len(result['content_news'].split())} words")
            print(result['content_news'])
            
            print(f"\nContent (B2): {len(result['content_b2'].split())} words")
            print(result['content_b2'])
        else:
            print("\n❌ Synthesis failed")
        
    except Exception as e:
        print(f"❌ Test error: {e}")
        import traceback
        traceback.print_exc()

