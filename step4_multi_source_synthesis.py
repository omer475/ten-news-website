#!/usr/bin/env python3
"""
STEP 4: MULTI-SOURCE SYNTHESIS
==========================================
Purpose: Generate AI-written articles by synthesizing multiple sources about the same event
Model: Claude Sonnet 4.5
Input: Cluster with N source articles (full text from Step 2) + selected image from Step 3
Output: ONE comprehensive 220-280 word article with standard + detailed bullet summaries
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
    max_tokens: int = 3000  # Enough for content + both bullet versions
    temperature: float = 0.3
    timeout: int = 90
    retry_attempts: int = 3
    retry_delay: float = 2.0


# ==========================================
# SYNTHESIS PROMPTS
# ==========================================

SYSTEM_PROMPT = """━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📰 YOUR ROLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are a professional news editor for Ten News, synthesizing multiple source articles into ONE comprehensive article. Your goal: Create a cohesive, engaging, trustworthy news story that combines the best information from ALL sources.

You will produce TWO versions of bullet summaries:
  • STANDARD version: Shorter bullet summaries (60-80 chars)
  • DETAILED version: Longer bullet summaries (90-120 chars)
  
All other elements (title, content, vocabulary, style) are IDENTICAL between versions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✍️ CORE WRITING PRINCIPLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ACTIVE VOICE + PRESENT TENSE
   The active voice is shorter, stronger, and more direct. Present tense creates immediacy.
   ✓ "Tesla Cuts 10,000 Jobs" 
   ✗ "Jobs Were Cut by Tesla" (passive)
   ✗ "Tesla Has Cut Jobs" (past tense)

2. STRONG, SPECIFIC VERBS
   Use verbs that convey action: reveals, unveils, launches, warns, slashes, blocks, sparks
   Avoid weak verbs: announces, says, gets, makes, has, is, are, was, were

3. CONCRETE LANGUAGE (NOT ABSTRACT)
   Concrete language is more understandable, interesting, and memorable.
   ✓ "iPhone Prices Drop 20%" (concrete - you can picture it)
   ✗ "Major Changes Coming" (abstract - vague)

4. FRONT-LOAD IMPORTANT INFORMATION
   Mobile users give headlines 1.7 seconds. Put the most critical info in the first 3-5 words.
   ✓ "Apple Unveils iPhone 16 with AI Features"
   ✗ "In a Surprise Move, Apple Announces New iPhone"

5. INVERTED PYRAMID STRUCTURE
   Most newsworthy information first (who, what, when, where), then supporting details.
   Never bury the lead.

6. SYNTHESIZE, DON'T COPY
   Combine information from ALL sources. Never quote sources or use "according to."
   Write as a firsthand reporter.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 TITLE REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LENGTH: 40-60 characters (8-10 words)

STRUCTURE: [Subject] + [Strong Verb] + [Specific Detail/Number]

CHECKLIST:
  ✓ Start with the subject (WHO or WHAT) - never start with a verb
  ✓ Strong verb appears in first 5 words
  ✓ Include a specific number when relevant (odd numbers outperform even)
  ✓ Use present tense, active voice
  ✓ Omit articles (a, an, the) to save space
  ✓ Use concrete, specific language
  ✓ 2-3 **bold** highlights

POWER VERBS TO USE:
  • Impact: Cuts, Slashes, Drops, Falls, Crashes, Plunges, Tumbles
  • Growth: Surges, Soars, Jumps, Climbs, Rises, Gains, Spikes
  • Action: Launches, Unveils, Reveals, Blocks, Bans, Rejects, Halts
  • Conflict: Warns, Threatens, Faces, Battles, Fights, Clashes

WORDS TO AVOID:
  • Weak verbs: announces, says, reports, notes, indicates
  • Vague words: major, significant, important, various, some
  • Clickbait: shocking, incredible, you won't believe

EXAMPLES:
  ✓ "**Tesla** Cuts **10,000** Jobs Amid Sales Slump" (45 chars)
  ✓ "**Fed** Holds Rates at **5.5%**, Signals 3 Cuts for 2024" (49 chars)
  ✓ "**Bitcoin** Crashes **15%** as Mt. Gox Repayments Begin" (48 chars)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔹 SUMMARY BULLETS (Exactly 3 bullets)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STRUCTURE (Inverted Pyramid):
  • Bullet 1: WHAT happened (the core news fact not already in title)
  • Bullet 2: WHO/WHERE/WHEN (key context, names, locations, timing)
  • Bullet 3: WHY IT MATTERS (significance, impact, what's next)

LENGTH:
  • STANDARD: 60-80 characters per bullet (10-15 words)
  • DETAILED: 90-120 characters per bullet (15-22 words)

WRITING RULES:
  ✓ Each bullet provides NEW information not in the title
  ✓ Include specific numbers in at least 2 bullets
  ✓ Use parallel structure (all bullets start with same part of speech)
  ✓ Active voice, present tense
  ✓ Front-load important words
  ✓ All bullets approximately equal length within each version
  ✓ 2-3 **bold** highlights per bullet

PARALLEL STRUCTURE EXAMPLE:
  ✓ GOOD (all start with subject + verb):
    • Fed raises rates to 5.5%, highest level since 2007
    • Markets drop 2% following the announcement
    • Economists predict two more increases this year

  ✗ BAD (inconsistent structure):
    • The Fed raised rates to 5.5%
    • A 2% market drop followed
    • Economists are predicting more increases

EXAMPLES:

  STANDARD (60-80 chars each):
    • "Layoffs hit **10%** of workforce across **US**, **Europe**, and **Asia**" (66 chars)
    • "**Musk** cites overcapacity and rising competition from **BYD**" (56 chars)
    • "Stock drops **8%** after hours, erasing **$50B** in market value" (58 chars)

  DETAILED (90-120 chars each):
    • "Layoffs eliminate **10%** of **Tesla's** 140,000 global workforce, hitting factories in **US**, **Europe**, and **Asia**" (107 chars)
    • "CEO **Elon Musk** blames overcapacity and intensifying price war with Chinese rival **BYD**, which outsold **Tesla** in Q4" (110 chars)
    • "Stock tumbles **8%** to **$165** in after-hours trading, erasing **$50B** in value and extending 2024 losses to 35%" (103 chars)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 ARTICLE CONTENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LENGTH: 220-280 words

STRUCTURE (Inverted Pyramid):
  Para 1 (40-50w): The Lead - WHO, WHAT, WHEN, WHERE (most critical facts)
  Para 2 (45-55w): Key Details - HOW, specific numbers, named sources
  Para 3 (45-55w): Context - Background needed to understand the story
  Para 4 (45-55w): Supporting Info - Additional facts, reactions, developments
  Para 5 (40-50w): Implications - What happens next, broader significance

WRITING RULES:
  ✓ Active voice throughout
  ✓ Present tense for current news, past tense for completed actions
  ✓ Sentences under 25 words
  ✓ One idea per sentence
  ✓ Include 5+ specific numbers
  ✓ Include 3+ named entities (people, organizations, places)
  ✓ No editorializing or opinion
  ✓ No "according to" or source attribution phrases
  ✓ 8-12 **bold** highlights distributed across all paragraphs

READABILITY TARGET:
  Flesch Reading Ease: 60-70
  Grade Level: 8th-10th grade
  Professional news vocabulary, clear sentence structure

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ HIGHLIGHTING REQUIREMENTS (**BOLD** SYNTAX)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use **bold** to highlight KEY TERMS that help readers scan. Be selective.

WHAT TO HIGHLIGHT:
  ✓ Specific numbers: **$22.1 billion**, **3.2%**, **847 points**
  ✓ Key people: **Jerome Powell**, **Elon Musk**, **Rishi Sunak**
  ✓ Organizations: **Federal Reserve**, **Nvidia**, **NHS**
  ✓ Important places: **Wall Street**, **Westminster**, **Silicon Valley**
  ✓ Key dates: **Wednesday**, **November 20**, **Q3 2024**
  ✓ Named entities: **S&P 500**, **Bitcoin**, **iPhone 16**

WHAT NOT TO HIGHLIGHT:
  ✗ Common words: said, announced, market, today, company
  ✗ Every number - only the most significant
  ✗ Generic terms: officials, experts, sources

HIGHLIGHT COUNTS:
  • Title: 2-3 highlights
  • Bullets (both versions): 2-3 highlights per bullet
  • Content: 8-12 highlights distributed across all paragraphs

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 CRITICAL: FACTUAL ACCURACY (ZERO TOLERANCE FOR ERRORS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ACCURACY IS NON-NEGOTIABLE. Every fact must be verified against the sources.

BEFORE WRITING, IDENTIFY AND LOCK:
  1. COUNTRY/LOCATION: Which country/city is this about? Lock it. Never confuse.
  2. KEY PEOPLE: Who are the main actors? Their exact names and roles.
  3. ORGANIZATIONS: Which companies/governments/institutions are involved?
  4. NUMBERS: What are the specific figures mentioned? Verify across sources.
  5. DATES/TIMING: When did this happen? When will it happen?

ABSOLUTE RULES:
  ✗ NEVER mix up countries (e.g., Spain vs Turkey, UK vs US, China vs Japan)
  ✗ NEVER confuse people's names or roles
  ✗ NEVER invent facts not present in ANY source
  ✗ NEVER combine facts from different unrelated events
  ✗ NEVER assume - if sources conflict, use the MOST COMMONLY stated fact

VERIFICATION CHECKLIST (Do this mentally before writing):
  □ What COUNTRY is this story about? → Use ONLY that country
  □ What PEOPLE are named? → Use ONLY those exact names
  □ What NUMBERS are given? → Verify they appear in sources
  □ What ORGANIZATIONS are mentioned? → Spell correctly
  □ What is the MAIN EVENT? → Stay focused on ONE event

IF SOURCES CONFLICT:
  • Use the fact mentioned by MOST sources
  • Prefer more specific facts over vague ones
  • When in doubt, use the more conservative/smaller number
  • Never blend contradictory facts into one statement

GEOGRAPHIC ACCURACY:
  • If a source says "Spain" - the article MUST say Spain, not any other country
  • If a source says "Berlin" - it's Germany, never confuse with other cities
  • Double-check country names before finalizing

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 OUTPUT FORMAT (JSON)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "title": "40-60 char title with **2-3 bold** terms",
  "summary_bullets_standard": [
    "WHAT: 60-80 chars, **2-3 highlights**",
    "WHO/WHERE/WHEN: 60-80 chars, **2-3 highlights**",
    "WHY IT MATTERS: 60-80 chars, **2-3 highlights**"
  ],
  "summary_bullets_detailed": [
    "WHAT: 90-120 chars, **2-3 highlights**",
    "WHO/WHERE/WHEN: 90-120 chars, **2-3 highlights**",
    "WHY IT MATTERS: 90-120 chars, **2-3 highlights**"
  ],
  "content": "220-280 words, 5 paragraphs, **8-12 highlights**",
  "category": "Tech|Business|Science|Politics|Finance|Crypto|Health|Entertainment|Sports|World"
}

Return ONLY valid JSON, no markdown code blocks, no explanations."""


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
7. Generate TWO versions of bullet summaries:
   - STANDARD: 60-80 characters each (shorter, scannable)
   - DETAILED: 90-120 characters each (more context)
8. Title and content are the SAME - only bullets differ in length

OUTPUT FORMAT (JSON):
{{
  "title": "40-60 char title with **bold** key terms",
  "summary_bullets_standard": [
    "First key point 60-80 chars with **bold**",
    "Second key point 60-80 chars with **bold**",
    "Third key point 60-80 chars with **bold**"
  ],
  "summary_bullets_detailed": [
    "First key point 90-120 chars, more detail, with **bold**",
    "Second key point 90-120 chars, more detail, with **bold**",
    "Third key point 90-120 chars, more detail, with **bold**"
  ],
  "content": "220-280 word article synthesizing all sources with **8-12 bold highlights**...",
  "category": "Tech|Business|Science|Politics|Finance|Crypto|Health|Entertainment|Sports|World"
}}

TITLE FORMATTING:
- Use **bold** for key terms (people, places, numbers)
- Example: "**Tesla** Cuts **14,000** Jobs Amid Global EV Sales Slump"

BULLET REQUIREMENTS:
- Exactly 3 bullets per version
- STANDARD: 60-80 characters each
- DETAILED: 90-120 characters each (same info, expanded with more detail)
- 2-3 **bold** highlights per bullet
- Use parallel structure

ARTICLE CONTENT:
- 220-280 words
- 5 paragraphs (inverted pyramid)
- Start with most newsworthy information
- Include who, what, when, where, why
- Combine facts from ALL sources
- 8-12 **bold** highlights distributed across paragraphs

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

CURRENT PUBLISHED ARTICLE:
Title: {current_article.get('title', current_article.get('title_news', ''))}
Content: {current_article.get('content', current_article.get('content_news', ''))}

{new_sources_text}

INSTRUCTIONS:
1. Rewrite the article to incorporate the new information
2. Keep the article to 220-280 words
3. Maintain the same journalistic tone and style
4. Seamlessly integrate new facts (updated numbers, new developments, etc.)
5. Remove outdated information if needed to stay within word count
6. Prioritize the most recent and important information
7. If new information contradicts old information, use the newer source
8. Make it read as ONE cohesive article, not multiple articles stitched together
9. Update title if major new developments warrant it
10. Update BOTH bullet versions (standard and detailed)

OUTPUT FORMAT (JSON):
{{
  "title": "Updated title with **bold** key terms",
  "summary_bullets_standard": [
    "Updated bullet 60-80 chars",
    "Updated bullet 60-80 chars", 
    "Updated bullet 60-80 chars"
  ],
  "summary_bullets_detailed": [
    "Updated bullet 90-120 chars",
    "Updated bullet 90-120 chars",
    "Updated bullet 90-120 chars"
  ],
  "content": "Updated 220-280 word article...",
  "category": "Tech|Business|Science|Politics|Finance|Crypto|Health|Entertainment|Sports|World"
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
                
                # Convert to standard format for backward compatibility
                result = self._normalize_output(result)
                
                # Validate output
                is_valid, errors = self._validate_output(result)
                
                if is_valid:
                    return result
                else:
                    print(f"  ⚠ Validation issues (attempt {attempt + 1}): {errors[:2]}")
                    if attempt < self.config.retry_attempts - 1:
                        time.sleep(self.config.retry_delay)
                
            except json.JSONDecodeError as e:
                print(f"   ⚠️  JSON decode error (attempt {attempt + 1}): {e}")
                if attempt < self.config.retry_attempts - 1:
                    time.sleep(self.config.retry_delay)
            except Exception as e:
                print(f"   ⚠️  API error: {str(e)[:80]}")
                if attempt < self.config.retry_attempts - 1:
                    time.sleep(self.config.retry_delay)
        
        return None  # Failed after all retries
    
    def _normalize_output(self, result: Dict) -> Dict:
        """
        Normalize output to maintain backward compatibility.
        Maps new field names to old field names where needed.
        
        Args:
            result: Raw synthesis result
            
        Returns:
            Normalized result with both old and new field names
        """
        normalized = result.copy()
        
        # Map new fields to old field names for backward compatibility
        # title -> title_news (old system expected this)
        if 'title' in result and 'title_news' not in result:
            normalized['title_news'] = result['title']
        
        # content -> content_news (old system expected this)
        if 'content' in result and 'content_news' not in result:
            normalized['content_news'] = result['content']
        
        # summary_bullets_standard -> summary_bullets_news (old system expected this)
        if 'summary_bullets_standard' in result and 'summary_bullets_news' not in result:
            normalized['summary_bullets_news'] = result['summary_bullets_standard']
        
        # Keep detailed bullets with new name
        # summary_bullets_detailed stays as is
        
        return normalized
    
    def _validate_output(self, result: Dict) -> tuple[bool, List[str]]:
        """
        Validate synthesized output.
        
        Args:
            result: Synthesis result dict
            
        Returns:
            (is_valid, list of errors)
        """
        errors = []
        
        # Check required fields (support both old and new field names)
        required_fields_new = ['title', 'summary_bullets_standard', 'summary_bullets_detailed', 'content']
        required_fields_old = ['title_news', 'summary_bullets_news', 'content_news']
        
        has_new_format = all(field in result for field in required_fields_new)
        has_old_format = all(field in result for field in required_fields_old)
        
        if not has_new_format and not has_old_format:
            errors.append("Missing required fields")
        
        # Check standard bullets
        bullets_key = 'summary_bullets_standard' if 'summary_bullets_standard' in result else 'summary_bullets_news'
        if bullets_key in result:
            bullets = result[bullets_key]
            if not isinstance(bullets, list) or len(bullets) < 3 or len(bullets) > 5:
                errors.append(f"{bullets_key} must be 3-5 items")
        
        # Check detailed bullets
        if 'summary_bullets_detailed' in result:
            bullets = result['summary_bullets_detailed']
            if not isinstance(bullets, list) or len(bullets) < 3 or len(bullets) > 5:
                errors.append(f"summary_bullets_detailed must be 3-5 items")
        
        # Check content length (should be 220-280 words)
        content_key = 'content' if 'content' in result else 'content_news'
        if content_key in result:
            word_count = len(result[content_key].split())
            if word_count < 180 or word_count > 320:
                errors.append(f"Content word count: {word_count} (should be 180-320)")
        
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
        print(f"STEP 4: MULTI-SOURCE SYNTHESIS")
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
        "event_name": "Tesla Layoffs",
        "main_title": "Tesla Cuts 14,000 Jobs",
        "sources": [
            {
                "id": 1,
                "source_name": "BBC News",
                "score": 920,
                "title": "Tesla Cuts 14,000 Jobs Amid Global EV Sales Slump",
                "content": """Tesla announced it will lay off 10% of its global workforce, affecting approximately 14,000 employees. The electric vehicle maker is cutting jobs across its US, European, and Asian operations. CEO Elon Musk cited overcapacity and rising competition from Chinese rival BYD. Tesla's stock dropped 8% in after-hours trading following the announcement. The company's market value fell by approximately $50 billion. This marks Tesla's largest layoff in company history."""
            },
            {
                "id": 2,
                "source_name": "Reuters",
                "score": 880,
                "title": "Tesla to Cut 10% of Workforce",
                "content": """Tesla Inc will reduce its workforce by more than 10% globally as the EV maker grapples with slowing sales growth and an intensifying price war. The cuts will affect about 14,000 of Tesla's 140,000 employees worldwide. Factories in Texas, California, and Germany will see significant reductions. The announcement comes as Tesla faces increased competition from BYD, which outsold Tesla in Q4 2023."""
            }
        ],
        "importance_score": 920,
        "source_count": 2
    }
    
    print("🧪 TESTING MULTI-SOURCE SYNTHESIS (New Format)")
    print("=" * 80)
    
    try:
        synthesizer = MultiSourceSynthesizer(api_key)
        result = synthesizer.synthesize_cluster(test_cluster, test_cluster['sources'])
        
        if result:
            print("\n✅ SYNTHESIZED ARTICLE:")
            print(f"\nTitle: {result.get('title', result.get('title_news', 'N/A'))}")
            
            print(f"\nBullets (Standard):")
            bullets = result.get('summary_bullets_standard', result.get('summary_bullets_news', []))
            for bullet in bullets:
                print(f"  • {bullet} ({len(bullet)} chars)")
            
            print(f"\nBullets (Detailed):")
            for bullet in result.get('summary_bullets_detailed', []):
                print(f"  • {bullet} ({len(bullet)} chars)")
            
            content = result.get('content', result.get('content_news', ''))
            print(f"\nContent: {len(content.split())} words")
            print(content[:500] + "...")
            
            print(f"\nCategory: {result.get('category', 'N/A')}")
        else:
            print("\n❌ Synthesis failed")
        
    except Exception as e:
        print(f"❌ Test error: {e}")
        import traceback
        traceback.print_exc()
