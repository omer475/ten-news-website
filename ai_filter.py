"""
TEN NEWS LIVE - AI FILTER
Uses Claude Sonnet 4 to score and filter articles
45-60 point thresholds by category
"""

import sqlite3
from datetime import datetime
import time
import json
import os
import anthropic

class AINewsFilter:
    def __init__(self, db_path='news.db', api_key=None):
        self.db_path = db_path
        self.api_key = api_key or os.environ.get('ANTHROPIC_API_KEY')
        if not self.api_key:
            raise ValueError("Claude API key required!")
        
        self.client = anthropic.Anthropic(api_key=self.api_key)
        
        # Category thresholds
        self.thresholds = {
            'breaking': 55,
            'science': 45,
            'technology': 45,
            'data': 45,
            'environment': 45,
            'business': 50,
            'politics': 50,
            'health': 50,
            'international': 50,
        }
    
    def get_unprocessed_articles(self, limit=100):
        """Get articles waiting for AI processing"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, url, source, title, description, category, source_credibility
            FROM articles
            WHERE ai_processed = FALSE
            ORDER BY fetched_at DESC
            LIMIT ?
        ''', (limit,))
        
        articles = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return articles
    
    def score_articles_batch(self, articles):
        """Score multiple articles in one AI call"""
        if not articles:
            return []
        
        # Prepare articles for AI
        articles_text = []
        for i, article in enumerate(articles, 1):
            articles_text.append(f"""
Article {i}:
ID: {article['id']}
Source: {article['source']} (Credibility: {article['source_credibility']}/10)
Category: {article['category']}
Title: {article['title']}
Description: {article['description'][:500]}
""")
        
        prompt = f"""You are an elite news curator for Ten News Live. Score these {len(articles)} articles using a strict 0-100 point system.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCORING SYSTEM (0-100 POINTS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. GLOBAL IMPACT (0-35 points)
   - 30-35: World-changing events (pandemics, wars, major disasters)
   - 20-29: Nationally/regionally significant
   - 10-19: Notable but limited impact
   - 0-9: Minor/local

2. SCIENTIFIC/TECH SIGNIFICANCE (0-30 points)
   - 25-30: Revolutionary breakthrough
   - 15-24: Significant advancement
   - 5-14: Incremental progress
   - 0-4: Not scientific

3. NOVELTY & URGENCY (0-20 points)
   - 18-20: Breaking right now
   - 12-17: Fresh & timely (last 3 hours)
   - 6-11: Recent (last 24 hours)
   - 0-5: Old news

4. CREDIBILITY (0-10 points)
   - Use source_credibility score provided
   
5. ENGAGEMENT (0-15 points)
   - 13-15: Extremely engaging, fascinating
   - 8-12: Quite interesting
   - 3-7: Moderately interesting
   - 0-2: Boring

FINAL SCORE = Global Impact + Scientific Significance + Novelty + Credibility + Engagement

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STAGE 1: INSTANT REJECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Immediately reject (stage1_pass = false):
❌ Celebrity gossip, entertainment news
❌ Local news without global significance
❌ Routine sports (scores, transfers, injuries)
❌ Clickbait, listicles, "10 ways to..."
❌ Product reviews, shopping deals
❌ Opinion pieces without news value

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ARTICLES TO EVALUATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{chr(10).join(articles_text)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESPONSE FORMAT (JSON)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return a JSON array with one object per article:

[
  {{
    "id": 123,
    "stage1_pass": true or false,
    "global_impact": 0-35,
    "scientific_significance": 0-30,
    "novelty": 0-20,
    "credibility": 0-10,
    "engagement": 0-15,
    "final_score": sum of above,
    "emoji": "🔥" (single best emoji),
    "reasoning": "2-3 sentence explanation"
  }},
  ...
]

BE STRICT. Most articles should score 30-50. Only exceptional news reaches 60+.
"""

        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=8000,
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )
            
            # Parse response
            response_text = response.content[0].text.strip()
            
            # Remove markdown code blocks if present
            if response_text.startswith('```json'):
                response_text = response_text[7:]
            if response_text.startswith('```'):
                response_text = response_text[3:]
            if response_text.endswith('```'):
                response_text = response_text[:-3]
            response_text = response_text.strip()
            
            scores = json.loads(response_text)
            return scores
            
        except Exception as e:
            print(f"❌ AI scoring error: {str(e)[:200]}")
            return []
    
    def apply_scores_to_database(self, scores):
        """Update articles in database with AI scores"""
        if not scores:
            return 0, 0
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        published_count = 0
        rejected_count = 0
        
        for score in scores:
            article_id = score['id']
            
            # Get article category to check threshold
            cursor.execute('SELECT category FROM articles WHERE id = ?', (article_id,))
            result = cursor.fetchone()
            if not result:
                continue
            
            category = result[0]
            threshold = self.thresholds.get(category, 50)
            
            # Determine if should publish
            should_publish = (
                score.get('stage1_pass', False) and 
                score.get('final_score', 0) >= threshold
            )
            
            # Update article
            cursor.execute('''
                UPDATE articles SET
                    ai_processed = TRUE,
                    ai_stage1_pass = ?,
                    ai_global_impact = ?,
                    ai_scientific_significance = ?,
                    ai_novelty = ?,
                    ai_credibility = ?,
                    ai_engagement = ?,
                    ai_final_score = ?,
                    ai_emoji = ?,
                    ai_reasoning = ?,
                    published = ?,
                    published_at = ?,
                    processed_at = ?
                WHERE id = ?
            ''', (
                score.get('stage1_pass', False),
                score.get('global_impact', 0),
                score.get('scientific_significance', 0),
                score.get('novelty', 0),
                score.get('credibility', 0),
                score.get('engagement', 0),
                score.get('final_score', 0),
                score.get('emoji', '📰'),
                score.get('reasoning', ''),
                should_publish,
                datetime.now().isoformat() if should_publish else None,
                datetime.now().isoformat(),
                article_id
            ))
            
            if should_publish:
                published_count += 1
            else:
                rejected_count += 1
        
        conn.commit()
        conn.close()
        
        return published_count, rejected_count
    
    def run_filter_cycle(self, batch_size=100):
        """Run one AI filtering cycle"""
        print(f"\n🤖 AI FILTER STARTING")
        print("=" * 70)
        print(f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        start_time = time.time()
        
        # Get unprocessed articles
        articles = self.get_unprocessed_articles(limit=batch_size)
        
        if not articles:
            print("✅ No articles to process!")
            print("=" * 70 + "\n")
            return 0
        
        print(f"📊 Processing {len(articles)} articles...")
        print()
        
        # Score articles
        scores = self.score_articles_batch(articles)
        
        if not scores:
            print("❌ AI scoring failed!")
            return 0
        
        # Apply scores
        published, rejected = self.apply_scores_to_database(scores)
        
        duration = time.time() - start_time
        
        # Log cycle
        self._log_filter_cycle(len(articles), published, rejected, duration, scores)
        
        # Print results
        print()
        print("=" * 70)
        print(f"📊 AI FILTER COMPLETE")
        print(f"   📰 Processed: {len(articles)} articles")
        print(f"   ✅ Published: {published} articles")
        print(f"   ❌ Rejected: {rejected} articles")
        print(f"   📈 Acceptance rate: {(published/len(articles)*100):.1f}%")
        if scores:
            avg_score = sum(s.get('final_score', 0) for s in scores) / len(scores)
            print(f"   📊 Avg score: {avg_score:.1f}/100")
        print(f"   ⏱️  Duration: {duration:.1f}s")
        print("=" * 70 + "\n")
        
        return published
    
    def _log_filter_cycle(self, processed, published, rejected, duration, scores):
        """Log filter cycle to database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        avg_score = sum(s.get('final_score', 0) for s in scores) / len(scores) if scores else 0
        stage1_rejected = sum(1 for s in scores if not s.get('stage1_pass', False))
        stage2_rejected = rejected - stage1_rejected
        
        cursor.execute('''
            INSERT INTO ai_filter_cycles (
                started_at, duration_seconds, articles_processed,
                articles_published, stage1_rejected, stage2_rejected,
                avg_score, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')
        ''', (
            datetime.now().isoformat(),
            duration,
            processed,
            published,
            stage1_rejected,
            stage2_rejected,
            avg_score
        ))
        
        conn.commit()
        conn.close()

if __name__ == '__main__':
    filter_engine = AINewsFilter()
    filter_engine.run_filter_cycle()

