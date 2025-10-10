"""
TEN NEWS - AI FILTER
Processes RSS articles with AI scoring, timeline, and details generation
Runs every 5 minutes
Integrates with existing Claude AI logic
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

class AINewsFilter:
    def __init__(self):
        self.db_path = 'ten_news.db'
        self.batch_size = 30  # Process 30 articles at a time
        self.filter_interval = 300  # 5 minutes
        self.min_score = 70  # Minimum score to publish
        
        # API Configuration
        self.claude_api_key = os.getenv('CLAUDE_API_KEY')
        self.google_api_key = os.getenv('GOOGLE_API_KEY')
        self.perplexity_api_key = os.getenv('PERPLEXITY_API_KEY')
        
        # Models
        self.claude_model = "claude-3-5-sonnet-20241022"
        self.gemini_model = "gemini-2.0-flash-exp"
        self.perplexity_model = "sonar"
        
        # Configure Gemini
        if self.google_api_key:
            genai.configure(api_key=self.google_api_key)
        
        # Configure Perplexity (uses OpenAI SDK)
        if self.perplexity_api_key:
            from openai import OpenAI
            self.perplexity_client = OpenAI(
                api_key=self.perplexity_api_key,
                base_url="https://api.perplexity.ai"
            )
        else:
            self.perplexity_client = None
        
        self.setup_logging()
    
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
    
    def _process_batch(self, articles):
        """Process a batch of articles"""
        self.logger.info(f"   🔄 Processing batch of {len(articles)} articles...")
        
        for article in articles:
            try:
                # STEP 1: Score the article with Gemini
                score, category, emoji, reasoning = self._score_article(article)
                
                # Apply source credibility adjustment
                source_credibility = get_source_credibility(article['source'])
                final_score = score + (source_credibility - 6)  # Adjust based on source
                final_score = max(0, min(100, final_score))  # Clamp to 0-100
                
                self.logger.info(f"   📊 {article['title'][:50]}... → Score: {final_score:.1f}")
                
                # STEP 2: Decide if it should be published
                should_publish = final_score >= self.min_score
                
                if should_publish:
                    # STEP 3: Generate summary with Claude (35-40 words)
                    summary = self._generate_summary(article)
                    
                    # STEP 4: Optimize title with Claude (4-10 words)
                    optimized_title = self._optimize_title(article)
                    
                    # STEP 5: Generate timeline with Claude
                    timeline = self._generate_timeline(article)
                    
                    # STEP 6: Generate details section with Claude
                    details = self._generate_details(article)
                    
                    # STEP 7: Publish
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
            
            prompt = f"""
You are an elite news curator. Score this article on a 0-100 scale.

ARTICLE:
Title: {article['title']}
Source: {article['source']}
Description: {article['description'][:500]}

SCORING CRITERIA (0-100 points):

1. GLOBAL RELEVANCE (0-35 points)
Would people in multiple countries care about this?
- 30-35: Universal impact (tech everyone uses, major geopolitical shifts, breakthrough discoveries)
- 22-29: Wide international interest (major country developments, global industry changes)
- 12-21: Regional but significant (important but limited geography/sector)
- 0-11: Too local/niche

2. SURPRISE FACTOR / "DID YOU KNOW?" (0-30 points)
Is this unexpected, counterintuitive, or mind-blowing?
- 25-30: "Wait, WHAT?" moment (bumblebees shouldn't fly, octopuses have 3 hearts, honey never expires)
- 18-24: Very surprising (unexpected partnerships, dramatic pivots, counterintuitive findings)
- 10-17: Somewhat unexpected (new tech reveals, unusual developments)
- 5-9: Predictable but notable
- 0-4: "Yeah, we knew that" - completely expected

3. UNIVERSAL UNDERSTANDING (0-20 points)
Can anyone grasp why this matters without specialized knowledge?
- 17-20: Instantly clear to everyone (anyone can understand the significance immediately)
- 12-16: Easy to explain in one sentence (simple concept with obvious implications)
- 6-11: Requires some context (explainable but needs brief background)
- 0-5: Too technical/specialized (requires expert knowledge to appreciate)

4. DATA/SCIENTIFIC INTEREST (0-15 points)
For data/science stories: Is the finding fascinating?
- 13-15: Mind-bending fact (counterintuitive physics, shocking statistics, nature surprises)
- 9-12: Very interesting data (meaningful trends, compelling research findings)
- 5-8: Useful information (incremental findings, expected correlations)
- 0-4: Boring data (obvious findings, dry statistics, predictable results)

Note: Non-science/data stories can score 0-4 in this category without penalty

MINIMUM TO PUBLISH: 70 POINTS

CATEGORIES:
- breaking: Breaking news, urgent events
- science: Scientific discoveries, research
- technology: Tech innovations, AI, software
- business: Finance, markets, economics
- environment: Climate, sustainability, conservation
- politics: Government, policy, international relations
- general: Everything else

EMOJI: Choose the single best emoji that represents this story.

Return ONLY this JSON:
{{
  "score": <0-100>,
  "category": "<category>",
  "emoji": "<single emoji>",
  "reasoning": "<2 sentences explaining the score>"
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
    
    def _generate_summary(self, article):
        """Generate 35-40 word summary with Claude"""
        if not self.claude_api_key:
            return article['description'][:200]
        
        try:
            url = "https://api.anthropic.com/v1/messages"
            headers = {
                "x-api-key": self.claude_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            }
            
            prompt = f"""
Rewrite this news article as a concise, engaging summary.

STRICT REQUIREMENTS:
- MUST be between 35-40 words (tolerance: +/- 2 words)
- Must be a single paragraph
- Must capture the key facts and significance
- Use bold markdown (**text**) to emphasize 2-3 key terms

Article Title: {article['title']}
Article: {article['description']}
{article['content'][:1000] if article['content'] else ''}

Write the 35-40 word summary now:
"""
            
            data = {
                "model": self.claude_model,
                "max_tokens": 200,
                "messages": [{"role": "user", "content": prompt}]
            }
            
            response = requests.post(url, headers=headers, json=data, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                summary = result['content'][0]['text'].strip()
                word_count = len(summary.split())
                
                # Validate word count
                if 33 <= word_count <= 42:
                    return summary
            
            return article['description'][:200]
            
        except Exception as e:
            self.logger.error(f"Summary generation error: {e}")
            return article['description'][:200]
    
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
    
    def _generate_timeline(self, article):
        """Generate timeline with Perplexity (WITH INTERNET SEARCH)"""
        if not self.perplexity_client:
            self.logger.warning("⚠️ Perplexity API not configured - skipping timeline")
            return None
        
        try:
            prompt = f"""
Search the internet for accurate information about this news story and create a chronological timeline.

Article: {article['title']}
Description: {article['description']}
{article['content'][:1500] if article['content'] else ''}

Requirements:
- Search for accurate dates and facts from reliable sources
- 2-4 key events in chronological order
- Each event: specific date/time + brief description (1 sentence)
- Use bold markdown (**text**) for dates and key terms
- Include relevant context

Return ONLY JSON array:
[
  {{"date": "October 2024", "event": "Description with **bold** terms"}},
  {{"date": "October 9, 2024", "event": "Another event"}}
]
"""
            
            response = self.perplexity_client.chat.completions.create(
                model=self.perplexity_model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a factual news researcher with internet access. Search for accurate information and return cited facts in the requested format."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=800,
                temperature=0.2
            )
            
            timeline_text = response.choices[0].message.content.strip()
            
            # Parse JSON
            if timeline_text.startswith('```json'):
                timeline_text = timeline_text[7:]
            if timeline_text.startswith('```'):
                timeline_text = timeline_text[3:]
            if timeline_text.endswith('```'):
                timeline_text = timeline_text[:-3]
            timeline_text = timeline_text.strip()
            
            timeline = json.loads(timeline_text)
            self.logger.info(f"   📅 Generated timeline with {len(timeline)} events (Perplexity + Web Search)")
            return json.dumps(timeline)
            
        except Exception as e:
            self.logger.error(f"Timeline generation error: {e}")
            return None
    
    def _generate_details(self, article):
        """Generate details section with Perplexity (WITH INTERNET SEARCH)"""
        if not self.perplexity_client:
            self.logger.warning("⚠️ Perplexity API not configured - skipping details")
            return None
        
        try:
            prompt = f"""
Search the internet for comprehensive information about this news story and write a detailed analysis.

Article: {article['title']}
Description: {article['description']}
{article['content'][:1500] if article['content'] else ''}

Requirements:
- Search for facts, background, context, and implications from reliable sources
- Write 3-5 paragraphs of in-depth analysis
- Include specific facts, figures, dates, and citations
- Use bold markdown (**text**) for key terms, numbers, and dates
- Explain significance, impact, and future implications
- Provide historical context where relevant

Write the detailed analysis now:
"""
            
            response = self.perplexity_client.chat.completions.create(
                model=self.perplexity_model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert news analyst with internet access. Search for comprehensive, cited information and provide in-depth analysis with proper context."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=1200,
                temperature=0.3
            )
            
            details = response.choices[0].message.content.strip()
            self.logger.info(f"   📄 Generated details section ({len(details)} chars, Perplexity + Web Search)")
            return details
            
        except Exception as e:
            self.logger.error(f"Details generation error: {e}")
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

