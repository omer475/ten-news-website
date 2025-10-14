"""
TEN NEWS - AI FILTER (NEW TWO-PHASE SYSTEM)
Processes RSS articles with AI scoring and content generation
Runs every 5 minutes

NEW SYSTEM:
- Phase 1: Perplexity searches web for raw facts
- Phase 2: Claude formats all content (title, summary, timeline, details)

FEATURES:
- Parallel Gemini API calls for 10-30x faster scoring
- Single Perplexity search (comprehensive facts)
- Single Claude call (all formatting)
- 50% fewer API calls than old system
"""

import sqlite3
import time
import logging
from datetime import datetime
import json
import os
import requests
import google.generativeai as genai
from rss_sources import get_source_credibility
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

# Try to import enhanced Perplexity client
try:
    from perplexity_client import get_perplexity_client
    ENHANCED_CLIENT_AVAILABLE = True
except ImportError:
    ENHANCED_CLIENT_AVAILABLE = False

class AINewsFilter:
    def __init__(self):
        self.db_path = 'ten_news.db'
        self.batch_size = 30  # Process 30 articles at a time
        self.filter_interval = 300  # 5 minutes
        self.min_score = 700  # Minimum score to publish (0-1000 scale, must-know news only)
        
        # Parallel processing configuration
        self.parallel_workers = 10  # Score 10 articles simultaneously
        self.scoring_lock = threading.Lock()  # Thread-safe logging
        
        # API Configuration
        self.claude_api_key = os.getenv('CLAUDE_API_KEY')
        self.google_api_key = os.getenv('GOOGLE_API_KEY')
        self.perplexity_api_key = os.getenv('PERPLEXITY_API_KEY')
        
        # Models
        self.claude_model = "claude-3-5-sonnet-20241022"
        self.gemini_model = "models/gemini-2.5-flash"  # Stable Gemini 2.5 Flash with higher quota
        
        # Configure Gemini
        if self.google_api_key:
            genai.configure(api_key=self.google_api_key)
        
        # Setup logging first
        self.setup_logging()
        
        # Log parallel optimization
        self.logger.info(f"⚡ PARALLEL SCORING ENABLED: {self.parallel_workers} workers (10-30x faster!)")
        
        # Initialize enhanced Perplexity client if available
        self.perplexity_client = None
        if ENHANCED_CLIENT_AVAILABLE and self.perplexity_api_key:
            try:
                self.perplexity_client = get_perplexity_client()
                self.logger.info("✅ Enhanced Perplexity client initialized (with rate limiting & error handling)")
            except Exception as e:
                self.logger.warning(f"⚠️ Could not initialize enhanced Perplexity client: {e}")
                self.logger.info("   Falling back to direct API calls")
    
    def _get_db_connection(self):
        """Get a database connection with proper settings for concurrent access"""
        conn = sqlite3.connect(
            self.db_path,
            timeout=30.0,
            isolation_level=None,
            check_same_thread=False
        )
        conn.execute('PRAGMA journal_mode=WAL')
        conn.execute('PRAGMA busy_timeout=30000')
        return conn
    
    def setup_logging(self):
        """Configure logging"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('ai_filter.log'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def run_forever(self):
        """Run AI filter every 5 minutes"""
        self.logger.info("🤖 AI Filter started - running every 5 minutes")
        
        while True:
            try:
                self.logger.info(f"\n{'='*60}")
                self.logger.info(f"🤖 AI Filter cycle starting at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                self.logger.info(f"{'='*60}\n")
                
                # Get unprocessed articles
                articles = self._get_unprocessed_articles()
                
                if articles:
                    self.logger.info(f"📊 Processing {len(articles)} unprocessed articles")
                    
                    # Process in batches
                    for i in range(0, len(articles), self.batch_size):
                        batch = articles[i:i+self.batch_size]
                        self._process_batch(batch)
                        time.sleep(2)  # Rate limiting between batches
                    
                    self.logger.info(f"✅ AI processing complete")
                else:
                    self.logger.info("ℹ️  No unprocessed articles found")
                
                # Sleep until next cycle
                self.logger.info(f"😴 Sleeping for {self.filter_interval}s (5 minutes)...\n")
                time.sleep(self.filter_interval)
                
            except KeyboardInterrupt:
                self.logger.info("🛑 AI Filter stopped by user")
                break
            except Exception as e:
                self.logger.error(f"❌ AI Filter error: {e}", exc_info=True)
                time.sleep(60)
    
    def _get_unprocessed_articles(self):
        """Get articles that haven't been AI processed yet"""
        conn = self._get_db_connection()
        conn.row_factory = sqlite3.Row  # Access columns by name
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM articles
            WHERE ai_processed = FALSE
            ORDER BY fetched_at DESC
            LIMIT ?
        ''', (self.batch_size * 3,))  # Get more than one batch
        
        articles = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return articles
    
    def _score_single_article(self, article):
        """Score a single article (thread-safe for parallel execution)"""
        try:
            # Score the article with Gemini
            score, category, emoji, reasoning = self._score_article(article)
            
            # Apply source credibility adjustment (scale to 0-1000)
            source_credibility = get_source_credibility(article['source'])
            # Adjust score by source credibility (multiply by 10 to scale from 0-10 to 0-100 for adjustment)
            adjustment = (source_credibility - 6) * 10
            final_score = score + adjustment
            final_score = max(0, min(1000, final_score))  # Cap at 1000 for 0-1000 scale
            
            return {
                'article': article,
                'score': final_score,
                'category': category,
                'emoji': emoji,
                'reasoning': reasoning,
                'success': True
            }
        except Exception as e:
            return {
                'article': article,
                'score': 0,
                'category': 'error',
                'emoji': '❌',
                'reasoning': str(e),
                'success': False
            }
    
    def _process_batch(self, articles):
        """Process a batch of articles with PARALLEL SCORING"""
        self.logger.info(f"   🔄 Processing batch of {len(articles)} articles...")
        
        # STEP 0: FILTER OUT ARTICLES WITHOUT IMAGES (before scoring)
        articles_with_images = []
        rejected_no_image = 0
        
        for article in articles:
            if article.get('image_url') and article['image_url'].strip():
                articles_with_images.append(article)
            else:
                # Mark as processed but rejected (no image)
                self._mark_processed_only(article['id'], 0, 'no_image', 'No image URL - filtered before scoring')
                rejected_no_image += 1
        
        if rejected_no_image > 0:
            self.logger.info(f"   🖼️  Filtered out {rejected_no_image} articles without images")
        
        if not articles_with_images:
            self.logger.info(f"   ⚠️  No articles with images to process")
            return
        
        self.logger.info(f"   ⚡ Using {self.parallel_workers} parallel workers for scoring...")
        
        start_time = time.time()
        
        # STEP 1: PARALLEL SCORING - Score all articles with images simultaneously
        scored_articles = []
        with ThreadPoolExecutor(max_workers=self.parallel_workers) as executor:
            # Submit all scoring tasks
            future_to_article = {
                executor.submit(self._score_single_article, article): article 
                for article in articles_with_images
            }
            
            # Collect results as they complete
            for future in as_completed(future_to_article):
                result = future.result()
                scored_articles.append(result)
                
                # Thread-safe logging
                with self.scoring_lock:
                    article = result['article']
                    if result['success']:
                        self.logger.info(f"   📊 {article['title'][:50]}... → Score: {result['score']:.1f}")
                    else:
                        self.logger.error(f"   ❌ Scoring failed: {article['title'][:50]}...")
        
        scoring_time = time.time() - start_time
        self.logger.info(f"   ⚡ Scored {len(articles)} articles in {scoring_time:.1f}s ({len(articles)/scoring_time:.1f} articles/sec)")
        
        # STEP 2: SEQUENTIAL CONTENT GENERATION - Only for high-scoring articles
        for result in scored_articles:
            article = result['article']
            final_score = result['score']
            category = result['category']
            emoji = result['emoji']
            reasoning = result['reasoning']
            
            try:
                should_publish = final_score >= self.min_score
                
                if should_publish:
                    self.logger.info(f"      📝 Generating content for publication...")
                    
                    # NEW SYSTEM: Two-step process
                    # Step 1: Search Perplexity for raw facts
                    perplexity_data = self._search_perplexity_raw_facts(article)
                    perplexity_results = perplexity_data['results'] if perplexity_data else None
                    
                    # Step 2: Format all content with Claude
                    formatted_content = self._format_content_with_claude(article, perplexity_results)
                    
                    if formatted_content:
                        # Extract all formatted content from Claude's response
                        optimized_title = formatted_content.get('title', article['title'])
                        summary = formatted_content.get('summary', article.get('description', '')[:200])
                        timeline = json.dumps(formatted_content.get('timeline', []))
                        
                        # Format details as string (convert array to newline-separated)
                        details_array = formatted_content.get('details', [])
                        details = '\n'.join(details_array) if details_array else None
                        
                        self.logger.info(f"      → Title: {optimized_title[:60]}...")
                        self.logger.info(f"      → Summary: {len(summary.split())} words")
                        self.logger.info(f"      → Timeline: {len(formatted_content.get('timeline', []))} events")
                        self.logger.info(f"      → Details: {len(details_array)} items")
                    else:
                        # Fallback if Claude formatting fails
                        self.logger.warning(f"      ⚠️  Claude formatting failed, using original content")
                        optimized_title = article['title']
                        summary = article.get('description', '')[:200]
                        timeline = json.dumps([])
                        details = None
                    
                    # Publish
                    self._publish_article(
                        article['id'], final_score, category, emoji, reasoning,
                        summary, optimized_title, timeline, details
                    )
                    
                    self.logger.info(f"      ✅ Published (score: {final_score:.1f})")
                else:
                    # Mark as processed but not published
                    self._mark_processed_only(
                        article['id'], final_score, category, reasoning
                    )
                    self.logger.info(f"      ❌ Rejected (score: {final_score:.1f} < {self.min_score})")
                
            except Exception as e:
                self.logger.error(f"   ❌ Error processing article {article['id']}: {e}")
                # Mark as processed to avoid infinite loops
                self._mark_processed_only(article['id'], 0, 'error', str(e))
    
    def _score_article(self, article):
        """
        Score article using Gemini (0-100 scale)
        Returns: (score, category, emoji, reasoning)
        """
        if not self.google_api_key:
            return 50, 'general', '📰', 'No API key'
        
        try:
            model = genai.GenerativeModel(self.gemini_model)
            
            prompt = f"""Your Role
You are an AI news curator for a live news feed app serving the general public. Your job is to score each news article (0-1000) based solely on its title and source name. Only news scoring 700 or above will be shown to users.
Your mission: Surface only must-know news - information people need to stay informed about major world events and developments that impact their lives. Quality and significance over quantity.

Title: {article['title']}
Source: {article['source']}

CORE PRINCIPLE: MUST-KNOW NEWS ONLY
Must-know news means:
- News that impacts people's lives: Economy, health, policy changes, safety, major legal/regulatory changes
- Major world events everyone should be aware of: Wars, elections, disasters, international conflicts, peace agreements, significant political developments
- Not just interesting, but ESSENTIAL: Filter out "nice to know" in favor of "need to know"

SCORING PRIORITY (Ranked Order)

1. BREAKING NEWS (Highest Priority)
Detect through context and significance, NOT keywords.
Look for:
- Major event indicators: natural disasters, wars/conflicts, terrorist attacks, major political events (elections, resignations, coups), significant deaths of world leaders/major figures, major accidents/incidents
- Significant proper nouns: world leaders, countries, major international organizations (UN, WHO, NATO), central banks, G7/G20 nations
- Critical announcements: policy changes, economic decisions (interest rates, major regulations), public health emergencies

2. TOPIC IMPORTANCE - MUST-KNOW CRITERIA
Evaluate based on ALL 5 factors:
- Scale of impact: Affects millions of people's lives directly
- Global significance: Reshapes geopolitics, economy, or society
- Institutional weight: Major government/central bank/international organization actions
- Historical significance: Will be remembered, creates lasting change
- Public need-to-know: Citizens need this information to understand the world and make informed decisions

Special rules:
- Human tragedy: Only if globally significant (major disasters affecting thousands+, large-scale conflicts, pandemics)
- Positive breakthroughs: Major medical cures, significant scientific discoveries, major peace agreements, economic recovery milestones
- Ongoing stories: Only if MAJOR new development (peace treaty signed, war ends, election results, policy passed) - not incremental updates

3. TITLE QUALITY
Must have ALL 5 characteristics:
- Clear and informative (explains what happened)
- Specific with details (names, numbers, locations, outcomes)
- Neutral factual tone (not emotional manipulation)
- Complete thought (not a teaser)
- Grammatically correct and professional

ELIMINATE engaging but vague titles - precision and clarity are mandatory.

4. SOURCE REPUTATION
Tier 1 (Highest credibility):
- Wire services: Reuters, AP, AFP
- Major international: BBC, CNN, Al Jazeera, NPR
- Prestigious papers: NYT, WSJ, Washington Post, The Guardian, Financial Times, The Economist

Tier 2 (Reputable):
- Established national outlets with strong journalism standards
- Quality specialized sources: Nature, Science, The Lancet, Foreign Affairs, Bloomberg, Politico, Axios

Tier 3 (Acceptable but lower priority):
- Smaller but credible regional outlets
- Newer digital publications with proven track record

5. CATEGORY DIVERSITY
- Importance dominates - don't artificially balance
- Similar essential topics cluster together naturally

6. REGIONAL BALANCE
- Include major international news from all regions
- No artificial balancing

STRICT FILTERING RULES - ELIMINATE THESE
Automatically score below 700:
- Clickbait: Manipulative headlines, excessive caps, vague hooks
- Low-quality sources: Tabloids, blogs, conspiracy sites, unverified outlets
- Non-essential content: Celebrity gossip, minor entertainment news, lifestyle features, trivial stories
- Feature stories/evergreen content: "How to" guides, profiles, explainers that aren't tied to breaking news
- Duplicate stories: Keep maximum 2 articles per event ONLY if they provide substantially different essential information
- Opinion pieces: Editorials, op-eds, commentary
- Vague titles: No substance or specifics
- Spam/promotional: Press releases, advertorials, branded content
- Unverified reports: Rumors without credible sourcing
- Minor updates: Incremental "live updates" without major developments
- Extreme sensationalism: Shock value over information
- Hyper-local news: Unless has national/international significance
- Satire/parody: The Onion, satirical sources
- Sponsored content: Even from reputable sources
- "Interesting but not essential": Cool stories that don't impact lives or represent major events

SCORING GUIDELINES:
950-1000: Critical breaking must-know news (wars, major disasters, historic elections, pandemics, major policy changes)
850-950: Highly important essential news (significant economic news, major international developments, important health/science breakthroughs)
700-850: Important must-know news worth showing (solid news people should be aware of)
500-700: Decent but not essential enough (FILTERED)
Below 500: Not must-know, low quality, or violates rules (FILTERED)

KEY PRINCIPLES:
✓ Must-know over nice-to-know: If people can skip it without missing important information, filter it out
✓ Quality over quantity: 10 essential stories better than 50 mixed-quality stories
✓ Impact-focused: Does this affect people's lives or understanding of the world?
✓ Significance test: Will this matter tomorrow? Next week? Next year?
✓ Essential categories first: Politics, economy, health, science, international affairs are the core
✓ Strict standards: High threshold means users trust every article shown is worth their time
✓ No fluff: Entertainment and sports only if genuinely significant

When in doubt, ask: "Do people NEED to know this to be informed citizens and understand the world?" If no, filter it out.

Return ONLY JSON:
{{
  "score": <0-1000>,
  "category": "<breaking/science/technology/business/environment/politics/general>",
  "emoji": "<single emoji>",
  "reasoning": "<brief explanation of why this scored as it did>"
}}
"""
            
            response = model.generate_content(prompt)
            response_text = response.text.strip()
            
            # Parse JSON (remove markdown if present)
            if response_text.startswith('```json'):
                response_text = response_text[7:]
            if response_text.startswith('```'):
                response_text = response_text[3:]
            if response_text.endswith('```'):
                response_text = response_text[:-3]
            response_text = response_text.strip()
            
            data = json.loads(response_text)
            
            return (
                float(data['score']),
                data['category'],
                data['emoji'],
                data['reasoning']
            )
            
        except Exception as e:
            self.logger.error(f"Gemini scoring error: {e}")
            return 50, 'general', '📰', 'Scoring failed'
    
    def _generate_title_and_summary(self, article):
        """Generate optimized title and summary together with Claude using News Plus prompt"""
        if not self.claude_api_key:
            return article['title'], article['description'][:200]
        
        try:
            url = "https://api.anthropic.com/v1/messages"
            headers = {
                "x-api-key": self.claude_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            }
            
            prompt = f"""YOUR ROLE
You are an AI content generator for News Plus, a global news application. Your task is to generate titles and summaries for news articles. Follow these instructions exactly for every piece of content you generate.

TITLE GENERATION INSTRUCTIONS
Mandatory Requirements
When you generate a title, you MUST:
- Use maximum 12 words - Count each word. Never exceed this limit.
- Make it a declarative statement - Never write questions. Convert any question format into a statement.
- Include geographic or entity context - Always specify which country, region, organization, or entity the news is about.
- Convey the complete main point - The reader should understand the entire story from the title alone.
- Use active voice - Structure sentences with the subject performing the action.
- Use sentence case - Capitalize only the first word and proper nouns.

SUMMARY GENERATION INSTRUCTIONS
Mandatory Requirements
When you generate a summary, you MUST:
- Write exactly 35-40 words (maximum 42 words allowed) - Count every word including articles (a, an, the)
- Add new information beyond the title - Never repeat the exact wording from the title. Rephrase and expand with additional details.
- Include geographic or entity context - Always specify countries, regions, or organizations.
- Use bold markdown (**text**) to emphasize 2-3 key terms
- Prioritize impact and consequences - Lead with what matters most
- Use appropriate tense (past tense for completed events, present tense for ongoing situations)
- Use active voice

Prohibited:
- DO NOT repeat exact wording from the title
- DO NOT include word count at the end
- DO NOT use speculation, opinions, or editorial language
- DO NOT use questions or exclamation marks

INPUT ARTICLE:
Title: {article['title']}
Content: {article['description']}
{article['content'][:1000] if article['content'] else ''}

OUTPUT FORMAT:
Provide your output in this exact format:

TITLE: [Your generated title here]

SUMMARY: [Your generated summary here]

Generate now:"""
            
            data = {
                "model": self.claude_model,
                "max_tokens": 300,
                "messages": [{"role": "user", "content": prompt}]
            }
            
            response = requests.post(url, headers=headers, json=data, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                output = result['content'][0]['text'].strip()
                
                # Parse TITLE and SUMMARY from output
                import re
                title_match = re.search(r'TITLE:\s*(.+?)(?=\n\nSUMMARY:|\n\s*SUMMARY:|$)', output, re.DOTALL)
                summary_match = re.search(r'SUMMARY:\s*(.+?)$', output, re.DOTALL)
                
                if title_match and summary_match:
                    title = title_match.group(1).strip()
                    summary = summary_match.group(1).strip()
                    
                    # Remove any word count if accidentally added
                    summary = re.sub(r'\s*\(\d+\s+words?\)\s*$', '', summary, flags=re.IGNORECASE)
                    summary = summary.strip()
                    
                    # Validate word counts
                    title_words = len(title.split())
                    summary_words = len(summary.split())
                    
                    if title_words <= 12 and 35 <= summary_words <= 42:
                        return title, summary
                    else:
                        self.logger.warning(f"Word count out of range: title={title_words}, summary={summary_words}")
                        return title if title_words <= 12 else article['title'], summary if 35 <= summary_words <= 42 else article['description'][:200]
                else:
                    self.logger.error("Could not parse TITLE and SUMMARY from output")
                    return article['title'], article['description'][:200]
            
            return article['title'], article['description'][:200]
            
        except Exception as e:
            self.logger.error(f"Title/Summary generation error: {e}")
            return article['title'], article['description'][:200]
    
    def _optimize_title(self, article):
        """Optimize title to 4-10 words with Claude"""
        title = article['title']
        
        # If already 4-10 words, return as-is
        word_count = len(title.split())
        if 4 <= word_count <= 10:
            return title
        
        if not self.claude_api_key:
            # Simple truncation fallback
            words = title.split()[:10]
            return ' '.join(words)
        
        try:
            url = "https://api.anthropic.com/v1/messages"
            headers = {
                "x-api-key": self.claude_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            }
            
            prompt = f"""
Optimize this news title to 4-10 words while keeping the key information.

Original title: {title}

Requirements:
- MUST be 4-10 words
- Keep the most important information
- Make it clear and compelling
- No clickbait

Write the optimized title now (4-10 words):
"""
            
            data = {
                "model": self.claude_model,
                "max_tokens": 100,
                "messages": [{"role": "user", "content": prompt}]
            }
            
            response = requests.post(url, headers=headers, json=data, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                optimized = result['content'][0]['text'].strip()
                word_count = len(optimized.split())
                
                if 4 <= word_count <= 10:
                    return optimized
            
            # Fallback: truncate
            words = title.split()[:10]
            return ' '.join(words)
            
        except Exception as e:
            self.logger.error(f"Title optimization error: {e}")
            words = title.split()[:10]
            return ' '.join(words)
    
    def _search_perplexity_raw_facts(self, article):
        """
        NEW SYSTEM: Search Perplexity for RAW, unformatted facts
        Returns comprehensive data that Claude will format later
        """
        if not self.perplexity_api_key:
            self.logger.warning("⚠️  Perplexity API key not set, skipping web search")
            return None
        
        try:
            self.logger.info(f"      🔍 Searching web for raw facts...")
            
            url = "https://api.perplexity.ai/chat/completions"
            headers = {
                "Authorization": f"Bearer {self.perplexity_api_key}",
                "Content-Type": "application/json"
            }
            
            user_prompt = f"""Search the web and gather comprehensive factual information about this news story.

Article Title: {article['title']}
Article Description: {article.get('description', '')}

SEARCH TASKS:

1. TIMELINE EVENTS:
- Find 2-4 major events related to this story in chronological order
- Include past events that led to this story
- If the story is developing, find any important upcoming/planned events
- For each event, provide: exact date/time and what happened
- For very recent events on the same day, include the specific time with timezone
- Prioritize verified information from reliable sources

2. KEY DATA POINTS:
- Find 3 pieces of key data that provide context
- Prioritize: statistics, numbers, percentages, amounts, timeframes, scale indicators
- Examples: market values, affected populations, rates, percentages, rankings, comparisons
- If hard numbers unavailable, include contextual data like impacts, estimates, historical comparisons
- Must be recent and relevant data
- Must NOT repeat information from the article title or description

3. ADDITIONAL CONTEXT:
- Geographic locations involved (cities, regions, countries)
- Key entities, organizations, or people involved
- Impact scale and affected parties
- Any official statements or sources

Return ALL raw facts found. Do NOT format into specific structures. Provide comprehensive information that will be formatted later."""

            payload = {
                "model": "llama-3.1-sonar-large-128k-online",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a news research assistant that searches the web for verified information. Return comprehensive factual data without formatting or styling. Focus on accuracy and recency."
                    },
                    {
                        "role": "user",
                        "content": user_prompt
                    }
                ],
                "temperature": 0.2,
                "max_tokens": 2000,
                "return_citations": True,
                "search_recency_filter": "month"
            }
            
            response = requests.post(url, headers=headers, json=payload, timeout=90)
            
            if response.status_code == 200:
                data = response.json()
                search_results = data['choices'][0]['message']['content']
                citations = data.get('citations', [])
                
                self.logger.info(f"      ✅ Raw facts retrieved ({len(search_results)} chars, {len(citations)} citations)")
                
                return {
                    'results': search_results,
                    'citations': citations
                }
            else:
                self.logger.error(f"❌ Perplexity search error: {response.status_code}")
                return None
                
        except requests.exceptions.Timeout:
            self.logger.error(f"⏱️  Perplexity search timeout")
            return None
        except Exception as e:
            self.logger.error(f"❌ Perplexity search error: {e}")
            return None
    
    def _format_content_with_claude(self, article, perplexity_results):
        """
        NEW SYSTEM: Format all content (title, summary, timeline, details) with Claude
        Takes raw Perplexity results and generates formatted output
        """
        if not self.claude_api_key:
            self.logger.warning("⚠️  Claude API key not set, using fallback")
            return None
        
        try:
            self.logger.info(f"      ✍️  Formatting content with Claude...")
            
            url = "https://api.anthropic.com/v1/messages"
            headers = {
                "x-api-key": self.claude_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            }
            
            # Complete system prompt with all rules
            system_prompt = """You are a professional news content writer for News Plus, a global news application. You receive raw search results and generate ALL formatted content: title, summary, timeline, and details. You must follow ALL rules exactly.

OUTPUT FORMAT - Always respond with valid JSON in this EXACT structure:
{
  "title": "Your generated title",
  "summary": "Your generated summary",
  "timeline": [
    {"date": "Oct 14, 2024", "event": "Event description"},
    {"date": "14:30, Oct 14", "event": "Recent event with time"}
  ],
  "details": [
    "Label: Value",
    "Label: Value",
    "Label: Value"
  ]
}

TITLE RULES:
- Maximum 12 words
- Must be declarative statement (NEVER a question)
- Must include geographic/entity context (country, region, or organization)
- Must convey complete main point
- Use active voice
- Use sentence case (capitalize only first word and proper nouns)
- PROHIBITED: Questions, clickbait phrases, exclamation marks, ALL CAPS

SUMMARY RULES:
- 35-40 words (maximum 42 words allowed)
- Must add NEW information beyond the title
- NEVER repeat exact wording from title
- Must include geographic/entity specificity
- Prioritize impact and consequences
- Use past tense for completed events, present tense for ongoing situations
- Use active voice
- Use **bold** markdown for 2-3 key terms
- PROHIBITED: Exact title repetition, speculation, questions, exclamation marks

TIMELINE RULES:
- 2-4 events in chronological order (oldest to newest)
- Each event: date/time + description
- Each description: MAXIMUM 14 words
- Date formats: "Oct 14, 2024" for different days, "14:30, Oct 14" for same-day recent events
- Include past events that led to the story
- If developing, include upcoming/planned events
- Must be verified and directly relevant

DETAILS RULES:
- EXACTLY 3 data points (always 3, never more or less)
- Format: "Label: Value"
- Label: 1-3 words maximum
- Total per detail: under 8 words
- Must NOT repeat information from article title or description
- Prioritize: numbers > dates > names > contextual data

VALIDATION CHECKLIST:
Title: ≤12 words, statement not question, includes country/region/entity, active voice, sentence case
Summary: 35-42 words, no exact title repetition, geographic specificity, 2-3 **bold** terms
Timeline: 2-4 events, chronological order, each event ≤14 words, correct date format
Details: Exactly 3 items, format "Label: Value", each <8 words, no title/description repetition
Overall: Valid JSON structure, all fields present, no explanatory text outside JSON"""

            # User prompt with article and search results
            user_prompt = f"""Generate complete news content (title, summary, timeline, details) for this article using the search results provided.

ORIGINAL ARTICLE:
Title: {article['title']}
Description: {article.get('description', '')}

SEARCH RESULTS FROM WEB:
{perplexity_results if perplexity_results else 'No search results available. Use article information.'}

Generate all content following the rules in the system prompt. Return only valid JSON with no explanation."""

            data = {
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 2048,
                "temperature": 0.3,
                "system": system_prompt,
                "messages": [{"role": "user", "content": user_prompt}]
            }
            
            response = requests.post(url, headers=headers, json=data, timeout=60)
            
            if response.status_code == 200:
                result = response.json()
                response_text = result['content'][0]['text'].strip()
                
                # Clean potential markdown formatting
                import re
                response_text = re.sub(r'^```json\s*', '', response_text)
                response_text = re.sub(r'\s*```$', '', response_text)
                response_text = response_text.strip()
                
                # Parse JSON
                try:
                    content = json.loads(response_text)
                    
                    # Validate structure
                    if all(key in content for key in ['title', 'summary', 'timeline', 'details']):
                        self.logger.info(f"      ✅ Content formatted successfully")
                        self.logger.info(f"         Title: {len(content['title'].split())} words")
                        self.logger.info(f"         Summary: {len(content['summary'].split())} words")
                        self.logger.info(f"         Timeline: {len(content['timeline'])} events")
                        self.logger.info(f"         Details: {len(content['details'])} items")
                        return content
                    else:
                        self.logger.error(f"❌ Missing required fields in Claude response")
                        return None
                        
                except json.JSONDecodeError as e:
                    self.logger.error(f"❌ JSON parse error: {e}")
                    self.logger.error(f"   Response: {response_text[:200]}")
                    return None
            else:
                self.logger.error(f"❌ Claude API error: {response.status_code}")
                return None
                
        except requests.exceptions.Timeout:
            self.logger.error(f"⏱️  Claude formatting timeout")
            return None
        except Exception as e:
            self.logger.error(f"❌ Claude formatting error: {e}")
            return None
    
    def _publish_article(self, article_id, final_score, category, emoji, reasoning,
                        summary, optimized_title, timeline, details):
        """Mark article as published with all generated content"""
        conn = self._get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE articles SET
                ai_processed = TRUE,
                ai_final_score = ?,
                ai_category = ?,
                emoji = ?,
                ai_reasoning = ?,
                summary = ?,
                title = ?,
                timeline = ?,
                details_section = ?,
                timeline_generated = ?,
                details_generated = ?,
                published = TRUE,
                published_at = ?,
                category = ?
            WHERE id = ?
        ''', (
            final_score,
            category,
            emoji,
            reasoning,
            summary,
            optimized_title,
            timeline,
            details,
            timeline is not None,
            details is not None,
            datetime.now().isoformat(),
            category,
            article_id
        ))
        
        conn.commit()
        conn.close()
    
    def _mark_processed_only(self, article_id, score, category, reasoning):
        """Mark article as processed but NOT published"""
        conn = self._get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE articles SET
                ai_processed = TRUE,
                ai_final_score = ?,
                ai_category = ?,
                ai_reasoning = ?,
                published = FALSE
            WHERE id = ?
        ''', (score, category, reasoning, article_id))
        
        conn.commit()
        conn.close()

# Run if executed directly
if __name__ == '__main__':
    ai_filter = AINewsFilter()
    ai_filter.run_forever()

