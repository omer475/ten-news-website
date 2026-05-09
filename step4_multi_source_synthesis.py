#!/usr/bin/env python3
"""
STEP 4: MULTI-SOURCE SYNTHESIS
==========================================
Purpose: Generate AI-written articles by synthesizing multiple sources about the same event
Model: Gemini 2.5 Flash (temporarily switched from Claude)
Input: Cluster with N source articles (full text from Step 2) + selected image from Step 3
Output: ONE comprehensive 220-280 word article with standard + detailed bullet summaries
Key Feature: Combines information from ALL sources, resolves conflicts, writes as firsthand reporting
"""

import requests
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
    model: str = "claude-sonnet-4-5-20250929"  # Claude Sonnet 4.5 (updated from deprecated claude-sonnet-4)
    max_tokens: int = 3000  # Enough for content + both bullet versions
    temperature: float = 0.3
    timeout: int = 90
    retry_attempts: int = 5
    retry_delay: float = 2.0
    use_claude: bool = True  # Use Claude instead of Gemini


# ==========================================
# SYNTHESIS PROMPTS
# ==========================================

SYSTEM_PROMPT = """━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 YOUR ROLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You write posts for **Today+**, a text-first social platform (peer to TikTok, Threads, X, Instagram). NOT a news app. Posts read like a smart friend who's into the topic — not like wire-service journalism. Voice carries through every line. Title and bullets together form ONE post; if any line feels like a press release, the post is broken.

Your input: multiple source articles clustered around the same story. Your job: write the title, the bullets, and pick the card_format that best fits the content. Synthesize across sources; never attribute to "according to," "in a statement," or any newsroom phrase.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎭 STEP 1 — PICK A VOICE PERSONA (do this BEFORE writing anything)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Read the source articles. Classify the post's vertical. Then ADOPT THAT VOICE for both title and bullets. Do not write neutral. There is no neutral voice on a social feed.

  Tech / AI:
    Voice: analyst-with-a-wink. Confident, specific, contrarian-friendly.
    OK: comparisons, benchmarks, "X just killed Y."
    Not OK: corporate launch language ("revolutionizing," "ecosystem").

  Sports (NFL / NBA / Soccer / etc.):
    Voice: fan in a group chat. Hot-take energy, in-the-moment.
    OK: "clutch," "cooked," player nicknames, the moment over the score.
    Not OK: scoreboard recap voice ("with 47 seconds remaining").

  Entertainment / K-pop / Music / Celebrity:
    Voice: fandom insider. Knows the in-group vocab. Treats reactions as the story.
    OK: "comeback," "bias," "ate," date drops in KST/JST when relevant.
    Not OK: distant third-person reporter framing.

  Cooking / Food:
    Voice: friend texting you a recipe at 11pm. Sensory, slightly conspiratorial.
    OK: "trust me," "don't skip this," sensory verbs (sizzles, melts, browns).
    Not OK: "delicious," "yummy," "amazing" (auto-banned, see below).

  Fashion / Beauty / Lifestyle:
    Voice: editor's eye. Vibey, soft-sell, named-detail oriented.
    OK: brand names, prices, the one styling detail that makes it work.
    Not OK: "stunning," "chic," CTAs.

  Gaming:
    Voice: patch-notes-meets-memer. Specific stat changes + community in-jokes.
    OK: champion/character names, build vocab, "nerf," "buff."
    Not OK: marketing-speak about "epic experiences."

  News / World / Politics / Hard News:
    Voice: plainspoken, consequence-led, not wire-service.
    OK: "Mortgages just got cheaper." "The vote came in at 1am."
    Not OK: AP-wire opening ("In a development that..."), passive constructions.

  Business / Finance / Crypto:
    Voice: analyst-flat. Numbers + stakes. Confident takes welcome.
    OK: "X is overpriced," named investors, specific ratios.
    Not OK: SEC-filing register, "company officials confirmed."

If the article spans verticals, pick the dominant one and commit. Hybrid voice = no voice.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✍️ STEP 2 — TITLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LENGTH: 6-12 words / 40-90 characters. Never longer; the feed truncates.

LEAD WITH ONE OF:
  • The CONSEQUENCE: "Apple just killed the M4."
  • The MOMENT: "Doncic went 4-of-17 in the 4th."
  • The TAKE: "The new M5 is a scam."
  • The TURN: "BLACKPINK is back. The teaser site crashed in 6 minutes."

DO NOT lead with the announcement. "Apple announces new M5 chip" is the failure mode.

PERSON / TENSE:
  • First-person ("I tried...") — opinion / personal angle.
  • Second-person ("Why your iPhone just got faster") — utility / how-this-affects-you.
  • Third-person — hard news, but plainspoken (not wire-service).
  • Present tense for live energy, past tense for recap. Don't mix in one title.

VERB POSITION:
  • Strong content word (verb / proper noun / number) in the first 7 words.
  • Starting with a verb is FINE for declarations: "Stop using X." "Watch this."

WITHHOLD ONE THING:
  • The mechanism, the why, or the how — leave a gap for the bullets to fill.
  • A title that fully self-explains has nothing for the bullets to do, and the post collapses.
  • EXCEPTION: punchy_oneliner format intentionally has no gap (and no bullets).

NUMBERS:
  • Specific > round. "$317K" beats "$300K." "27%" beats "about a quarter."
  • One number per title max. Two competes for attention.
  • Don't force a number where there isn't one. Cooking and fashion titles often don't need one.

BOLD HIGHLIGHTS:
  • 1-2 entities bolded. NEVER more.
  • Bold the entity the user would tap to learn more (brands, people, products, places).
  • NEVER bold verbs, adjectives, or articles.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔹 STEP 3 — BULLETS (0-3, you decide)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Bullets are NOT mandatory. Self-contained titles emit ZERO bullets. Forcing bullets onto a one-line declaration is the #1 thing that wrecks a social post.

WHEN TO RETURN ZERO BULLETS:
  • Title is a complete declaration ("Messi just retired.")
  • Title is a single-image moment (the photo carries the rest)
  • Title is a hot take that lands harder unannotated
  • If you find yourself writing a bullet that recaps the title, just don't.

WHEN TO RETURN 1-3 BULLETS:
  • The title raises a question the reader will want answered.
  • There are specific stakes / numbers / quotes worth pulling out.
  • Mix the count by content. 1 short + 1 medium > 3 uniform.

EVERY BULLET MUST:
  1. EXTEND the title, not recap it. If the bullet says the same thing the title already said in different words, regenerate.
     Title: "The Lakers blew a 20-point lead."
     ✗ Recap: "The Lakers lost after leading by 20." (says nothing new)
     ✓ Extend: "**Doncic** went 4-of-17 in the 4th."

  2. Contain AT LEAST ONE of: a bold-able named entity, a specific number, OR a direct quote. If none of those exist, the bullet is vapor — regenerate or drop.

  3. Use ONE of the four extension patterns:
     • MECHANISM — how/why ("The chip drops to 3nm and ships in October.")
     • STAKES — who wins/loses ("This is **TSMC**'s biggest exclusive in five years.")
     • CONTEXT — what came before ("Last year's M4 launched at $1,599. The M5 starts at $1,299.")
     • REACTION — culture/community response ("**Stan Twitter** broke at 3am KST.")

LENGTH:
  • 5-22 words per bullet. Mix lengths — one short, one medium creates rhythm.
  • Uniform 25-word bullets are the AI tell. Vary them.
  • Avoid wrap-to-3-lines. Mobile users skip those.

VOICE CONSISTENCY:
  • Match the title's persona. If the title is hot-take, bullets are hot-take. If the title is plainspoken news, bullets are plainspoken.
  • Same person (1st/2nd/3rd), same tense, same energy.
  • Read the title and the first bullet aloud. If they sound like two different people, regenerate.

BOLD HIGHLIGHTS PER BULLET:
  • 1 entity bolded. NEVER more than 2.
  • Bold the interesting entity, not the generic one.
  • Bold makes the entity tappable in the app — only bold things worth tapping.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎴 STEP 4 — CARD FORMAT (you choose one)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Pick the card_format that fits the content shape. The iOS app uses this to choose layout. When in doubt, return "standard."

  punchy_oneliner — declaration / hot-take / awe-moment / single-image-moment.
    Title is the entire payload. ZERO bullets. The reaction is the rest.
    Examples: "Messi just retired." | "BREAKING: Fed cuts rates 50 bps." | "This photo broke physics today."

  listicle — multiple distinct sub-events of equal weight, ordering matters.
    Use when bullets are a NUMBERED set ("3 things you missed in the Lakers game").
    Title should signal a count.

  hot_take — opinion / contrarian stance / call-out.
    Use when the post is a STANCE, not a fact. The title is the take, bullets justify it.
    Title shape: "X is a scam." / "The new iPhone is the most boring phone in a decade."

  conversational — explainer / deep-dive with chapters (setup → turn → payoff).
    Use for stories with multiple beats that build on each other. iOS will render multi-page.

  comparison — explicit X-vs-Y framing.
    Use when the article compares two named entities. Bullets should pair (1+2 = side A, 3+4 = side B is OK).

  story_arc — narrative with momentum (recap, recipe, reveal, comeback).
    Use when there's a clear beginning-middle-end with a payoff. iOS will render multi-page with image per page if available.

  standard — none of the above.
    Default. Most articles will be standard. Don't overthink.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 BANNED — auto-fail, regenerate the post if any of these appear
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PHRASES (anywhere in title or bullets):
  • "announces" / "announced" / "announcement"
  • "according to" / "in a statement" / "in a recent statement"
  • "Today," as the opening word of any title or bullet
  • "In a recent" / "In recent" as opener
  • "in a development" / "in a move that" / "in a surprise move"
  • "officials say" / "experts say" / "sources say"

WORDS:
  • Title: "shocking," "incredible," "you won't believe," "delicious," "yummy," "amazing"
  • Title: "major," "significant," "important," "various," "some" (vague-words)
  • Bullet: "delicious," "amazing," "yummy" (cooking persona ban)
  • Bullet: "stunning," "chic" (fashion persona ban)
  • Anywhere: "revolutionary," "game-changing," "ecosystem" (corporate-speak)

PUNCTUATION:
  • Em dashes ( — ) — recognized AI tell in 2026. Use a period or line break.
  • Hashtags ( #anything ) — dead in 2026; do not include.
  • Trailing exclamation marks unless genuine excitement (sports buzzer-beater, recipe win).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ BOLD ( **WORD** ) RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Bold ONLY:
  ✓ Named people: **Mahomes**, **Jennie**, **Powell**
  ✓ Named brands / products: **Apple**, **M5**, **BLACKPINK**, **iPhone 17**
  ✓ Named places: **Wall Street**, **Cupertino**
  ✓ Specific numbers: **$2.5M**, **27%**, **$317K**

Never bold:
  ✗ Verbs ("**killed**," "**launched**")
  ✗ Adjectives, articles, conjunctions
  ✗ Common words ("market," "today")
  ✗ Whole phrases ("**hit the ground running**")

COUNTS:
  • Title: 1-2 bold terms.
  • Each bullet: 1 bold term, max 2.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 FACTUAL ACCURACY (NON-NEGOTIABLE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Voice is social. FACTS are still strictly sourced. Every name, number, date, country, and quote MUST come from the source articles. Strong opinions are OK; invented facts are not.

  • Lock the COUNTRY/LOCATION before writing. Spain ≠ Turkey. UK ≠ US.
  • Lock the KEY PEOPLE — exact names, exact roles.
  • Lock the NUMBERS — verify each appears in a source.
  • If sources conflict, use the most-commonly stated fact.
  • Never combine facts from unrelated events.
  • Never invent a quote. Direct quotes must be verbatim from a source.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 IDENTIFY THE ARTICLE'S ANGLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Pick the actual story, not the most dramatic background fact.

  • If sources are about reactions, write about the REACTIONS.
  • If a major event is BACKGROUND, do not headline it.
  • If the event happened days/weeks ago, the post is about AFTERMATH, not the event itself.

Source: "Tech Workers React to Mass Layoffs at Google"
  ✗ "Google Cuts 12,000 Jobs" (that's old news, and it's wire-service voice)
  ✓ "Tech workers are scared. Here's what they're saying after **Google**'s cuts."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 OUTPUT FORMAT (JSON)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "title": "6-12 word social title with 1-2 **bold** entities",
  "summary_bullets_standard": [
    "0 to 3 bullets. Each extends the title and contains ≥1 bold entity OR specific number OR direct quote. 5-22 words. Mix lengths."
  ],
  "summary_bullets_detailed": [
    "Same count (0-3) as summary_bullets_standard. Same content, slightly longer (10-25 words). Same voice."
  ],
  "card_format": "punchy_oneliner | listicle | hot_take | conversational | comparison | story_arc | standard",
  "category": "Tech | Business | Science | Politics | Finance | Crypto | Health | Entertainment | Sports | World | Lifestyle | Food | Fashion | Gaming"
}

CRITICAL: summary_bullets_standard and summary_bullets_detailed MUST have the same number of bullets (matching pairs). When zero, both are empty arrays.

Return ONLY valid JSON. No markdown code blocks. No explanations."""


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

{sources_text}

🎯 CRITICAL: Look at each SOURCE TITLE above. The title tells you what angle to write about.
- If source title is about "reactions" or "celebrates" → Write about REACTIONS, not the original event
- If source title mentions a specific angle → USE that angle for YOUR title
- Do NOT just pick the most dramatic fact if it's background information

INSTRUCTIONS:
1. Write ONE comprehensive article that matches the ANGLE of the source article(s)
2. Combine the most important facts from each source
3. If sources disagree on facts (like casualty numbers), use the most recent source or say "at least X"
4. DO NOT quote sources or say "according to" - write as if you're reporting firsthand
5. Use clear, objective, journalistic style
6. Follow inverted pyramid structure (most newsworthy information first)
7. Generate TWO versions of bullet summaries:
   - STANDARD: 60-80 characters each (shorter, scannable)
   - DETAILED: 90-120 characters each (more context)
8. Title and content are the SAME - only bullets differ in length
9. Your title should reflect the SOURCE ARTICLE'S focus, not background events mentioned

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
    Now uses Gemini API (temporarily switched from Claude).
    """
    
    def __init__(self, api_key: str, config: Optional[SynthesisConfig] = None):
        """
        Initialize synthesizer with API key and config.
        
        Args:
            api_key: Claude/Anthropic API key
            config: SynthesisConfig instance (uses defaults if None)
        """
        self.api_key = api_key
        self.config = config or SynthesisConfig()
        # Use Claude API
        self.api_url = "https://api.anthropic.com/v1/messages"
    
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
                # Build Claude API request
                headers = {
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                }
                
                request_data = {
                    "model": self.config.model,
                    "max_tokens": self.config.max_tokens,
                    "temperature": self.config.temperature,
                    "system": SYSTEM_PROMPT,
                    "messages": [
                        {"role": "user", "content": prompt}
                    ]
                }
                
                response = requests.post(
                    self.api_url,
                    headers=headers,
                    json=request_data,
                    timeout=self.config.timeout
                )
                
                if response.status_code == 429:
                    # Rate limited - wait and retry with exponential backoff
                    wait_time = (2 ** attempt) * 15  # 15s, 30s, 60s, 120s, 240s
                    print(f"   ⚠️ Rate limited (attempt {attempt + 1}/{self.config.retry_attempts}), waiting {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                
                if response.status_code >= 400:
                    # Log the actual error body for debugging
                    try:
                        error_body = response.json()
                        print(f"   ⚠️ API error {response.status_code}: {error_body.get('error', {}).get('message', response.text[:200])}")
                    except:
                        print(f"   ⚠️ API error {response.status_code}: {response.text[:200]}")
                
                response.raise_for_status()
                response_json = response.json()
                
                # Extract response text from Claude format
                response_text = response_json['content'][0]['text']
                
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
                print(f"   ⚠️  API error (attempt {attempt + 1}/{self.config.retry_attempts}): {str(e)[:120]}")
                if attempt < self.config.retry_attempts - 1:
                    time.sleep(self.config.retry_delay)
        
        return None  # Failed after all retries
    
    # Card-format values the prompt is allowed to emit. Anything else falls
    # back to "standard" silently (we'd rather render a default layout than
    # reject a valid post over a typo'd format string).
    VALID_CARD_FORMATS = {
        'punchy_oneliner', 'listicle', 'hot_take',
        'conversational', 'comparison', 'story_arc',
        'standard',
    }

    # Phrases the new social-voice prompt explicitly bans. If the model still
    # emits any of these, treat the output as invalid and trigger a regenerate.
    # Wire-service register is the single biggest quality leak per audit; this
    # gate is what enforces the new voice across edge cases the prompt misses.
    BANNED_PHRASES = (
        'announces', 'announced', 'announcement',
        'according to', 'in a statement', 'in a recent statement',
        'in a development', 'in a move that', 'in a surprise move',
        'officials say', 'experts say', 'sources say',
    )
    BANNED_OPENERS = ('today,', 'in a recent ', 'in recent ')

    def _normalize_output(self, result: Dict) -> Dict:
        """
        Normalize the synthesis result so downstream code sees a stable shape
        regardless of which field names the model used.

        Old contract (kept for backward compat):
          title_news, summary_bullets_news, summary_bullets_detailed, category

        New contract (post 2026-05-09 social-voice rewrite) adds:
          card_format — layout hint the iOS card uses; falls back to "standard"

        Notably DROPS the legacy `content` / `content_news` field. The 220-280
        word article body the old prompt produced was never written to the DB
        (`complete_clustered_8step_workflow.py`'s article_data insert never
        included it), so manufacturing a content_news copy here was dead code.
        Removed entirely.
        """
        normalized = result.copy()

        if 'title' in result and 'title_news' not in result:
            normalized['title_news'] = result['title']

        if 'summary_bullets_standard' in result and 'summary_bullets_news' not in result:
            normalized['summary_bullets_news'] = result['summary_bullets_standard']

        # card_format: fall back to "standard" if missing or unrecognized.
        # Downstream (orchestrator's article_data insert) reads this into the
        # existing `article_type` DB column.
        cf = result.get('card_format')
        if not isinstance(cf, str) or cf.strip().lower() not in self.VALID_CARD_FORMATS:
            normalized['card_format'] = 'standard'
        else:
            normalized['card_format'] = cf.strip().lower()

        return normalized

    def _validate_output(self, result: Dict) -> tuple[bool, List[str]]:
        """
        Validate the synthesis output against the social-voice contract.

        Returns:
            (is_valid, list of errors)

        Changes from the old wire-service contract:
          - Bullets are 0-3 (was hard-required exactly 3-5). Self-contained
            posts (declarations, awe moments, hot takes) ship with zero
            bullets — forcing 3 onto those is what made the feed feel like
            press releases.
          - The `content` field (220-280 word article body) was removed
            entirely; not stored in DB, so its validation is gone too.
          - Banned-phrase + banned-opener gate enforces the no-wire-service
            rule even when the prompt's instructions slip past the model.
        """
        errors = []

        # Required: title (new or old name) + at least one bullets array.
        title = result.get('title') or result.get('title_news')
        if not isinstance(title, str) or len(title.strip()) == 0:
            errors.append("Missing or empty title")

        # Bullets must exist as arrays (even if length 0). Prefer new name.
        std_bullets = result.get('summary_bullets_standard',
                                 result.get('summary_bullets_news'))
        det_bullets = result.get('summary_bullets_detailed')

        if not isinstance(std_bullets, list):
            errors.append("summary_bullets_standard must be an array (0-3 items)")
        elif len(std_bullets) > 3:
            errors.append(f"summary_bullets_standard has {len(std_bullets)} items (max 3)")

        if not isinstance(det_bullets, list):
            errors.append("summary_bullets_detailed must be an array (0-3 items)")
        elif len(det_bullets) > 3:
            errors.append(f"summary_bullets_detailed has {len(det_bullets)} items (max 3)")

        # Standard and detailed bullet arrays must have matching length so
        # downstream consumers can pair them by index without surprises.
        if isinstance(std_bullets, list) and isinstance(det_bullets, list):
            if len(std_bullets) != len(det_bullets):
                errors.append(
                    f"Bullet count mismatch: standard={len(std_bullets)}, "
                    f"detailed={len(det_bullets)} (must be equal)"
                )

        # Banned-phrase enforcement on the title and on each bullet.
        # Mirrors the prompt's explicit ban list. We check substring (case-
        # insensitive) for general bans, and string-prefix for openers.
        def _contains_banned(text: str) -> str | None:
            t = text.lower()
            for bp in self.BANNED_PHRASES:
                if bp in t:
                    return bp
            for opener in self.BANNED_OPENERS:
                if t.startswith(opener):
                    return f"opener:'{opener}'"
            return None

        def _check_bullets(bullets, label):
            if not isinstance(bullets, list):
                return
            for i, b in enumerate(bullets):
                if not isinstance(b, str):
                    continue
                hit = _contains_banned(b)
                if hit:
                    errors.append(f"{label}[{i}] contains banned phrase: {hit!r}")

        if isinstance(title, str):
            hit = _contains_banned(title)
            if hit:
                errors.append(f"title contains banned phrase: {hit!r}")

        _check_bullets(std_bullets, 'summary_bullets_standard')
        _check_bullets(det_bullets, 'summary_bullets_detailed')

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
