"""
TEN NEWS LIVE - RSS FETCHER
Parallel RSS fetching with 30 workers
Runs every 10 minutes
"""

import feedparser
import sqlite3
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
import time
from rss_sources import get_all_sources
import hashlib

class RSSFetcher:
    def __init__(self, db_path='news.db', max_workers=30):
        self.db_path = db_path
        self.max_workers = max_workers
        self.sources = get_all_sources()
        
    def create_article_hash(self, url, title):
        """Create unique hash for deduplication"""
        content = f"{url}{title}".lower()
        return hashlib.md5(content.encode()).hexdigest()
    
    def fetch_single_source(self, source):
        """Fetch articles from single RSS feed"""
        try:
            feed = feedparser.parse(source['url'])
            
            if feed.bozo and not feed.entries:
                # Feed has errors and no entries
                return {
                    'source': source['name'],
                    'category': source['category'],
                    'status': 'error',
                    'articles': [],
                    'error': str(feed.bozo_exception) if hasattr(feed, 'bozo_exception') else 'Unknown error'
                }
            
            articles = []
            for entry in feed.entries[:20]:  # Max 20 articles per source
                try:
                    # Extract article data
                    article = {
                        'url': entry.get('link', ''),
                        'title': entry.get('title', ''),
                        'description': entry.get('description', '') or entry.get('summary', ''),
                        'source': source['name'],
                        'category': source['category'],
                        'credibility': source['credibility'],
                        'author': entry.get('author', ''),
                        'image_url': self._extract_image(entry),
                        'published_date': self._parse_date(entry),
                        'fetched_at': datetime.now().isoformat()
                    }
                    
                    # Only add if has title and URL
                    if article['title'] and article['url']:
                        article['hash'] = self.create_article_hash(article['url'], article['title'])
                        articles.append(article)
                        
                except Exception as e:
                    continue  # Skip problematic entries
            
            return {
                'source': source['name'],
                'category': source['category'],
                'status': 'success',
                'articles': articles,
                'error': None
            }
            
        except Exception as e:
            return {
                'source': source['name'],
                'category': source['category'],
                'status': 'error',
                'articles': [],
                'error': str(e)
            }
    
    def _extract_image(self, entry):
        """Extract image URL from feed entry"""
        # Try multiple fields
        if hasattr(entry, 'media_content') and entry.media_content:
            return entry.media_content[0].get('url', '')
        if hasattr(entry, 'media_thumbnail') and entry.media_thumbnail:
            return entry.media_thumbnail[0].get('url', '')
        if 'enclosures' in entry and entry.enclosures:
            for enc in entry.enclosures:
                if enc.get('type', '').startswith('image/'):
                    return enc.get('href', '')
        return ''
    
    def _parse_date(self, entry):
        """Parse publication date from entry"""
        try:
            if hasattr(entry, 'published_parsed') and entry.published_parsed:
                return datetime(*entry.published_parsed[:6]).isoformat()
            elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
                return datetime(*entry.updated_parsed[:6]).isoformat()
        except:
            pass
        return datetime.now().isoformat()
    
    def fetch_all_parallel(self):
        """Fetch all sources in parallel"""
        print(f"\n🔄 RSS FETCHER STARTING")
        print("=" * 70)
        print(f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"📡 Fetching {len(self.sources)} sources with {self.max_workers} workers...")
        print()
        
        start_time = time.time()
        all_articles = []
        success_count = 0
        error_count = 0
        
        # Parallel fetching
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_source = {executor.submit(self.fetch_single_source, source): source for source in self.sources}
            
            for i, future in enumerate(as_completed(future_to_source), 1):
                result = future.result()
                
                if result['status'] == 'success':
                    success_count += 1
                    all_articles.extend(result['articles'])
                    if result['articles']:
                        print(f"✅ [{i:3}/{len(self.sources)}] {result['source']:40} {len(result['articles']):3} articles")
                    else:
                        print(f"⚪ [{i:3}/{len(self.sources)}] {result['source']:40}   0 articles")
                else:
                    error_count += 1
                    print(f"❌ [{i:3}/{len(self.sources)}] {result['source']:40} ERROR: {result['error'][:30]}")
        
        duration = time.time() - start_time
        
        print()
        print("=" * 70)
        print(f"📊 FETCH COMPLETE")
        print(f"   ✅ Successful: {success_count}/{len(self.sources)}")
        print(f"   ❌ Failed: {error_count}/{len(self.sources)}")
        print(f"   📰 Total articles: {len(all_articles)}")
        print(f"   ⏱️  Duration: {duration:.1f}s")
        print("=" * 70)
        
        return all_articles, {
            'sources_total': len(self.sources),
            'sources_success': success_count,
            'sources_failed': error_count,
            'articles_found': len(all_articles),
            'duration_seconds': duration
        }
    
    def save_to_database(self, articles):
        """Save articles to SQLite database"""
        if not articles:
            print("⚠️  No articles to save")
            return 0
        
        print(f"\n💾 Saving {len(articles)} articles to database...")
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        saved_count = 0
        duplicate_count = 0
        
        for article in articles:
            try:
                # Check if already exists
                cursor.execute('SELECT id FROM articles WHERE hash = ?', (article['hash'],))
                if cursor.fetchone():
                    duplicate_count += 1
                    continue
                
                # Insert new article
                cursor.execute('''
                    INSERT INTO articles (
                        url, hash, source, title, description, image_url,
                        author, published_date, category, source_credibility,
                        fetched_at, ai_processed, published
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, FALSE)
                ''', (
                    article['url'],
                    article['hash'],
                    article['source'],
                    article['title'],
                    article['description'],
                    article['image_url'],
                    article['author'],
                    article['published_date'],
                    article['category'],
                    article['credibility'],
                    article['fetched_at']
                ))
                saved_count += 1
                
            except Exception as e:
                print(f"⚠️  Error saving article: {str(e)[:50]}")
                continue
        
        conn.commit()
        conn.close()
        
        print(f"   ✅ Saved: {saved_count} new articles")
        print(f"   ⏭️  Skipped: {duplicate_count} duplicates")
        
        return saved_count
    
    def log_fetch_cycle(self, stats, new_articles_saved):
        """Log fetch cycle to database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO fetch_cycles (
                started_at, duration_seconds, sources_total,
                sources_success, sources_failed, articles_found,
                new_articles_saved, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')
        ''', (
            datetime.now().isoformat(),
            stats['duration_seconds'],
            stats['sources_total'],
            stats['sources_success'],
            stats['sources_failed'],
            stats['articles_found'],
            new_articles_saved
        ))
        
        conn.commit()
        conn.close()
    
    def run_fetch_cycle(self):
        """Run complete fetch cycle"""
        # Fetch all articles
        articles, stats = self.fetch_all_parallel()
        
        # Save to database
        new_articles = self.save_to_database(articles)
        
        # Log cycle
        self.log_fetch_cycle(stats, new_articles)
        
        print(f"\n✅ Fetch cycle complete! {new_articles} new articles added.\n")
        
        return new_articles

if __name__ == '__main__':
    fetcher = RSSFetcher()
    fetcher.run_fetch_cycle()

