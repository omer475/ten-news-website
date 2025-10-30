"""
TEN NEWS - RSS FETCHER
Fetches articles from 200+ RSS sources every 10 minutes
Features:
- 30 parallel workers
- Duplicate detection
- 7-method image extraction
- Complete error handling
"""

import feedparser
import sqlite3
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin
import time
import logging
from bs4 import BeautifulSoup
import requests
import json
from rss_sources import ALL_SOURCES, get_source_credibility
import urllib3

# Suppress SSL warnings for specific sources
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class OptimizedRSSFetcher:
    def __init__(self, db_path='ten_news.db'):
        self.db_path = db_path
        self.max_workers = 30  # Parallel fetching
        self.fetch_interval = 600  # 10 minutes in seconds
        self.sources = ALL_SOURCES
        self.setup_logging()
        self.init_database()
    
    def setup_logging(self):
        """Configure logging"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('rss_fetcher.log'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def init_database(self):
        """Initialize database with schema"""
        conn = self._get_db_connection()
        cursor = conn.cursor()
        
        # Execute schema from database_schema.sql
        with open('database_schema.sql', 'r') as f:
            schema = f.read()
            cursor.executescript(schema)
        
        conn.commit()
        conn.close()
        self.logger.info("✅ Database initialized")
    
    def _get_db_connection(self):
        """Get a database connection with proper settings for concurrent access"""
        conn = sqlite3.connect(
            self.db_path,
            timeout=30.0,  # Wait up to 30 seconds for locks
            isolation_level=None,  # Enable autocommit mode
            check_same_thread=False
        )
        # Enable WAL mode for better concurrency
        conn.execute('PRAGMA journal_mode=WAL')
        conn.execute('PRAGMA busy_timeout=30000')  # 30 second timeout
        return conn
    
    def _get_source_marker(self, source_name, conn):
        """Get the marker showing where we left off with this source"""
        cursor = conn.cursor()
        cursor.execute('''
            SELECT last_article_url, last_article_guid, last_published_date
            FROM source_markers
            WHERE source = ?
        ''', (source_name,))
        result = cursor.fetchone()
        if result:
            return {
                'last_url': result[0],
                'last_guid': result[1],
                'last_date': result[2]
            }
        return None
    
    def _update_source_marker(self, source_name, latest_url, latest_guid, latest_date, conn):
        """Update the marker for where we left off with this source"""
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO source_markers 
            (source, last_article_url, last_article_guid, last_fetch_timestamp, last_published_date)
            VALUES (?, ?, ?, ?, ?)
        ''', (source_name, latest_url, latest_guid, datetime.now().isoformat(), latest_date))
        conn.commit()
    
    def run_forever(self):
        """Main loop - run every 10 minutes"""
        self.logger.info("🚀 RSS Fetcher started - running every 10 minutes")
        self.logger.info(f"📰 Monitoring {len(self.sources)} RSS sources")
        
        while True:
            try:
                cycle_start = datetime.now()
                self.logger.info(f"\n{'='*60}")
                self.logger.info(f"🔄 Starting new fetch cycle at {cycle_start.strftime('%Y-%m-%d %H:%M:%S')}")
                self.logger.info(f"{'='*60}\n")
                
                # Start fetch cycle
                cycle_id = self._start_fetch_cycle()
                
                # Parallel fetch all sources
                results = self._parallel_fetch_all_sources()
                
                # Complete cycle
                self._complete_fetch_cycle(cycle_id, results, cycle_start)
                
                # Summary
                self.logger.info(f"\n{'='*60}")
                self.logger.info(f"✅ Fetch cycle complete!")
                self.logger.info(f"   📊 Sources fetched: {results['sources_fetched']}/{len(self.sources)}")
                self.logger.info(f"   📰 Total articles found: {results['total_articles']}")
                self.logger.info(f"   ✨ New articles: {results['new_articles']}")
                self.logger.info(f"   ❌ Failed sources: {results['failed_sources']}")
                duration = (datetime.now() - cycle_start).total_seconds()
                self.logger.info(f"   ⏱️  Duration: {duration:.1f}s")
                self.logger.info(f"{'='*60}\n")
                
                # Sleep until next cycle
                self.logger.info(f"😴 Sleeping for {self.fetch_interval}s (10 minutes)...")
                time.sleep(self.fetch_interval)
                
            except KeyboardInterrupt:
                self.logger.info("🛑 RSS Fetcher stopped by user")
                break
            except Exception as e:
                self.logger.error(f"❌ Critical error in main loop: {e}", exc_info=True)
                time.sleep(60)  # Wait 1 minute before retrying
    
    def _start_fetch_cycle(self):
        """Start a new fetch cycle in database"""
        conn = self._get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO fetch_cycles (started_at, status)
            VALUES (?, 'running')
        ''', (datetime.now().isoformat(),))
        cycle_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return cycle_id
    
    def _complete_fetch_cycle(self, cycle_id, results, start_time):
        """Mark fetch cycle as complete"""
        conn = self._get_db_connection()
        cursor = conn.cursor()
        
        duration = (datetime.now() - start_time).total_seconds()
        
        cursor.execute('''
            UPDATE fetch_cycles SET
                completed_at = ?,
                duration_seconds = ?,
                status = 'completed',
                sources_fetched = ?,
                failed_sources = ?,
                new_articles_found = ?,
                total_articles_fetched = ?,
                errors = ?
            WHERE id = ?
        ''', (
            datetime.now().isoformat(),
            duration,
            results['sources_fetched'],
            results['failed_sources'],
            results['new_articles'],
            results['total_articles'],
            json.dumps(results['errors']),
            cycle_id
        ))
        
        conn.commit()
        conn.close()
    
    def _parallel_fetch_all_sources(self):
        """Fetch all sources in parallel using ThreadPoolExecutor"""
        results = {
            'total_articles': 0,
            'new_articles': 0,
            'sources_fetched': 0,
            'failed_sources': 0,
            'errors': []
        }
        
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            # Submit all fetch tasks
            future_to_source = {
                executor.submit(self._fetch_single_source, source_name, url): source_name
                for source_name, url in self.sources
            }
            
            # Process results as they complete
            for future in as_completed(future_to_source):
                source_name = future_to_source[future]
                try:
                    result = future.result()
                    results['total_articles'] += result['articles_found']
                    results['new_articles'] += result['new_articles']
                    results['sources_fetched'] += 1
                    
                    if result['success']:
                        if result['new_articles'] > 0:
                            self.logger.info(f"✅ {source_name}: {result['new_articles']} new articles")
                    else:
                        results['failed_sources'] += 1
                        results['errors'].append({
                            'source': source_name,
                            'error': result['error']
                        })
                        self.logger.warning(f"⚠️  {source_name}: {result['error']}")
                        
                except Exception as e:
                    results['failed_sources'] += 1
                    results['errors'].append({
                        'source': source_name,
                        'error': str(e)
                    })
                    self.logger.error(f"❌ {source_name}: {e}")
        
        return results
    
    def _fetch_single_source(self, source_name, feed_url):
        """Fetch articles from a single RSS source - OPTIMIZED VERSION"""
        result = {
            'success': False,
            'articles_found': 0,
            'new_articles': 0,
            'error': None,
            'skipped_marker': 0,  # Stopped early via marker
            'skipped_date': 0,     # Skipped via date check
            'skipped_db': 0        # Skipped via DB check
        }
        
        try:
            # Fetch and parse feed
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            
            # SSL problem sources - bypass verification
            ssl_problem_sources = ['Uber Engineering', 'Netflix Tech Blog', 'Airbnb Engineering']
            verify_ssl = source_name not in ssl_problem_sources
            
            response = requests.get(
                feed_url, 
                timeout=10, 
                headers=headers,
                verify=verify_ssl
            )
            response.raise_for_status()
            
            # Parse the fetched content
            feed = feedparser.parse(response.content)
            
            # Check for parsing errors - but allow if we have entries
            if feed.bozo and not feed.entries:
                result['error'] = f"Feed parsing error: {feed.bozo_exception}"
                self._update_source_stats_failure(source_name, result['error'])
                return result
            
            result['articles_found'] = len(feed.entries)
            
            # Get database connection
            conn = self._get_db_connection()
            
            # OPTIMIZATION: Get source marker (last processed article)
            marker = self._get_source_marker(source_name, conn)
            
            # Track the newest article for updating marker
            newest_article = None
            
            # Process each article (RSS feeds are newest first)
            for entry in feed.entries:
                article_url = entry.get('link', '')
                article_guid = entry.get('id', '')
                
                if not article_url:
                    continue
                
                # LAYER 1: Marker Check (Fastest - stops processing immediately)
                if marker:
                    if (article_url == marker['last_url'] or 
                        (article_guid and article_guid == marker['last_guid'])):
                        # Hit the last article we processed - everything after is old
                        result['skipped_marker'] = len(feed.entries) - feed.entries.index(entry)
                        break  # STOP PROCESSING - no need to check older articles
                
                # LAYER 2: Date Check (Fast - avoids DB lookup)
                if marker and marker['last_date']:
                    if hasattr(entry, 'published_parsed') and entry.published_parsed:
                        try:
                            pub_date = datetime(*entry.published_parsed[:6])
                            last_date = datetime.fromisoformat(marker['last_date'])
                            if pub_date < last_date:
                                result['skipped_date'] += 1
                                continue  # Skip old article
                        except:
                            pass  # If parsing fails, continue to DB check
                
                # LAYER 3: Database Lookup (Slowest - final safety check)
                cursor = conn.cursor()
                cursor.execute('SELECT id FROM articles WHERE url = ?', (article_url,))
                if cursor.fetchone():
                    result['skipped_db'] += 1
                    continue  # Already have this article
                
                # NEW ARTICLE - Extract and insert
                article_data = self._extract_article_data(entry, source_name)
                if self._insert_article(article_data, conn):
                    result['new_articles'] += 1
                    
                    # Track the newest article (first in feed)
                    if not newest_article:
                        pub_date = None
                        if hasattr(entry, 'published_parsed') and entry.published_parsed:
                            try:
                                pub_date = datetime(*entry.published_parsed[:6]).isoformat()
                            except:
                                pass
                        
                        newest_article = {
                            'url': article_url,
                            'guid': article_guid,
                            'date': pub_date
                        }
            
            # Update source marker with newest article
            if newest_article:
                self._update_source_marker(
                    source_name,
                    newest_article['url'],
                    newest_article['guid'],
                    newest_article['date'],
                    conn
                )
            
            conn.commit()
            conn.close()
            
            # Update source statistics
            self._update_source_stats_success(source_name, result)
            
            result['success'] = True
            
        except Exception as e:
            result['error'] = str(e)
            self._update_source_stats_failure(source_name, str(e))
        
        return result
    
    def _should_process_article(self, entry, source_name, conn):
        """Check if article should be processed (duplicate detection)"""
        
        # Extract URL
        url = entry.get('link', '')
        if not url:
            return False, "No URL found"
        
        # Check 1: URL already exists?
        cursor = conn.cursor()
        cursor.execute('SELECT id FROM articles WHERE url = ?', (url,))
        if cursor.fetchone():
            return False, "URL already exists"
        
        # Check 2: GUID check (if available)
        guid = entry.get('id', '')
        if guid:
            cursor.execute('SELECT id FROM articles WHERE guid = ?', (guid,))
            if cursor.fetchone():
                return False, "GUID already exists"
        
        # Check 3: Published date check
        if hasattr(entry, 'published_parsed') and entry.published_parsed:
            try:
                pub_date = datetime(*entry.published_parsed[:6])
                last_fetch = self._get_last_fetch_time(source_name, conn)
                
                if last_fetch and pub_date <= last_fetch:
                    return False, "Article older than last fetch"
            except:
                pass  # If date parsing fails, continue processing
        
        return True, "New article"
    
    def _get_last_fetch_time(self, source_name, conn):
        """Get the last successful fetch time for this source"""
        cursor = conn.cursor()
        cursor.execute('''
            SELECT last_fetch_at FROM source_stats 
            WHERE source = ?
        ''', (source_name,))
        result = cursor.fetchone()
        if result and result[0]:
            try:
                return datetime.fromisoformat(result[0])
            except:
                pass
        return None
    
    def _extract_article_data(self, entry, source_name):
        """Extract all article data from RSS entry"""
        
        # Basic fields
        url = entry.get('link', '')
        guid = entry.get('id', '')
        title = entry.get('title', '')
        description = entry.get('description', '') or entry.get('summary', '')
        author = entry.get('author', '')
        
        # Clean HTML from description
        if description:
            soup = BeautifulSoup(description, 'html.parser')
            description = soup.get_text().strip()
        
        # Published date
        published_date = None
        if hasattr(entry, 'published_parsed') and entry.published_parsed:
            try:
                published_date = datetime(*entry.published_parsed[:6]).isoformat()
            except:
                pass
        
        # Extract content (some feeds provide full content)
        content = ''
        if hasattr(entry, 'content'):
            content = entry.content[0].get('value', '')
            # Clean HTML from content
            soup = BeautifulSoup(content, 'html.parser')
            content = soup.get_text().strip()
        
        # Extract image
        image_url, extraction_method = self._extract_image_url(entry, url)
        
        return {
            'url': url,
            'guid': guid,
            'source': source_name,
            'title': title,
            'description': description,
            'content': content,
            'image_url': image_url,
            'author': author,
            'published_date': published_date,
            'image_extraction_method': extraction_method
        }
    
    def _extract_image_url(self, entry, article_url):
        """
        Extract image from RSS entry with multiple fallback methods
        Returns: (image_url: str or None, method: str)
        """
        
        # METHOD 1: RSS Enclosure tag (most common for images)
        if hasattr(entry, 'enclosures') and entry.enclosures:
            for enclosure in entry.enclosures:
                if enclosure.get('type', '').startswith('image/'):
                    return enclosure.get('href'), 'enclosure'
        
        # METHOD 2: Media Content tag (common in feeds)
        if hasattr(entry, 'media_content') and entry.media_content:
            for media in entry.media_content:
                if media.get('medium') == 'image' or media.get('type', '').startswith('image/'):
                    return media.get('url'), 'media_content'
        
        # METHOD 3: Media Thumbnail tag
        if hasattr(entry, 'media_thumbnail') and entry.media_thumbnail:
            return entry.media_thumbnail[0].get('url'), 'media_thumbnail'
        
        # METHOD 4: Look in description HTML
        if hasattr(entry, 'description'):
            soup = BeautifulSoup(entry.description, 'html.parser')
            img = soup.find('img')
            if img and img.get('src'):
                return img.get('src'), 'description_html'
        
        # METHOD 5: Content HTML
        if hasattr(entry, 'content'):
            for content in entry.content:
                soup = BeautifulSoup(content.get('value', ''), 'html.parser')
                img = soup.find('img')
                if img and img.get('src'):
                    return img.get('src'), 'content_html'
        
        # METHOD 6: Parse full article page for og:image (fallback when other methods fail)
        # Use with timeout to avoid slowdowns
        try:
            response = requests.get(article_url, timeout=3, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}, allow_redirects=True)
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                # Try og:image first
                og_image = soup.find('meta', property='og:image') or soup.find('meta', attrs={'name': 'og:image'})
                if og_image and og_image.get('content'):
                    image_url = og_image.get('content')
                    # Handle relative URLs
                    if image_url.startswith('//'):
                        image_url = 'https:' + image_url
                    elif image_url.startswith('/'):
                        image_url = urljoin(article_url, image_url)
                    return image_url, 'og_image'
                # Fallback: Try twitter:image
                twitter_image = soup.find('meta', attrs={'name': 'twitter:image'}) or soup.find('meta', attrs={'property': 'twitter:image'})
                if twitter_image and twitter_image.get('content'):
                    image_url = twitter_image.get('content')
                    if image_url.startswith('//'):
                        image_url = 'https:' + image_url
                    elif image_url.startswith('/'):
                        image_url = urljoin(article_url, image_url)
                    return image_url, 'twitter_image'
        except Exception:
            # Silent fail - this is just a fallback method
            pass
        
        # METHOD 7: No image found
        return None, 'none'
    
    def _insert_article(self, article_data, conn):
        """Insert article into database"""
        try:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR IGNORE INTO articles (
                    url, guid, source, title, description, content,
                    image_url, author, published_date, 
                    image_extraction_method, fetched_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                article_data['url'],
                article_data['guid'],
                article_data['source'],
                article_data['title'],
                article_data['description'],
                article_data['content'],
                article_data['image_url'],
                article_data['author'],
                article_data['published_date'],
                article_data['image_extraction_method'],
                datetime.now().isoformat()
            ))
            return cursor.rowcount > 0
        except Exception as e:
            self.logger.error(f"Error inserting article: {e}")
            return False
    
    def _update_source_stats_success(self, source_name, result):
        """Update source statistics after successful fetch"""
        conn = self._get_db_connection()
        cursor = conn.cursor()
        
        # Get or create source stats
        cursor.execute('SELECT * FROM source_stats WHERE source = ?', (source_name,))
        existing = cursor.fetchone()
        
        if existing:
            total_fetches = existing[3] + 1
            successful_fetches = existing[4] + 1
            total_articles = existing[6] + result['new_articles']
            avg_articles = total_articles / successful_fetches if successful_fetches > 0 else 0
            
            cursor.execute('''
                UPDATE source_stats SET
                    last_fetch_at = ?,
                    total_fetches = ?,
                    successful_fetches = ?,
                    total_articles_found = ?,
                    average_articles_per_fetch = ?,
                    consecutive_failures = 0
                WHERE source = ?
            ''', (
                datetime.now().isoformat(),
                total_fetches,
                successful_fetches,
                total_articles,
                avg_articles,
                source_name
            ))
        else:
            cursor.execute('''
                INSERT INTO source_stats (
                    source, last_fetch_at, total_fetches, successful_fetches,
                    total_articles_found, average_articles_per_fetch
                ) VALUES (?, ?, 1, 1, ?, ?)
            ''', (
                source_name,
                datetime.now().isoformat(),
                result['new_articles'],
                result['new_articles']
            ))
        
        conn.commit()
        conn.close()
    
    def _update_source_stats_failure(self, source_name, error):
        """Update source statistics after failed fetch"""
        conn = self._get_db_connection()
        cursor = conn.cursor()
        
        # Get or create source stats
        cursor.execute('SELECT * FROM source_stats WHERE source = ?', (source_name,))
        existing = cursor.fetchone()
        
        if existing:
            cursor.execute('''
                UPDATE source_stats SET
                    total_fetches = total_fetches + 1,
                    failed_fetches = failed_fetches + 1,
                    last_error = ?,
                    consecutive_failures = consecutive_failures + 1
                WHERE source = ?
            ''', (error, source_name))
        else:
            cursor.execute('''
                INSERT INTO source_stats (
                    source, total_fetches, failed_fetches, last_error, consecutive_failures
                ) VALUES (?, 1, 1, ?, 1)
            ''', (source_name, error))
        
        conn.commit()
        conn.close()

# Run if executed directly
if __name__ == '__main__':
    fetcher = OptimizedRSSFetcher()
    fetcher.run_forever()

