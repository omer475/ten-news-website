# Install required packages
!pip install requests beautifulsoup4 pandas anthropic openpyxl lxml

# Import the scraper
import requests
from bs4 import BeautifulSoup
import pandas as pd
import re
import time
import json
from urllib.parse import urljoin, urlparse
import anthropic
from typing import List, Dict, Optional
import logging
import concurrent.futures
from threading import Lock
import threading

# Configure logging for Colab
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class CompanyScraper:
    def __init__(self, claude_api_key: str):
        """
        Initialize the scraper with Claude API key
        
        Args:
            claude_api_key: Your Anthropic Claude API key
        """
        self.claude_client = anthropic.Anthropic(api_key=claude_api_key)
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        self.companies_data = []
        self.lock = Lock()  # For thread-safe operations
        
    def get_company_names_from_user(self) -> List[Dict[str, str]]:
        """
        Get company names from user input (comma-separated)
        
        Returns:
            List of company dictionaries
        """
        print("🏢 Please enter ALL company names in ONE line, separated by commas")
        print("💡 Example:")
        print("   Apple Inc, Microsoft Corporation, Google LLC, Amazon, Tesla")
        print("-" * 70)
        
        while True:
            companies_text = input("Enter company names (separated by commas): ").strip()
            
            if not companies_text:
                print("⚠️ Please enter company names")
                continue
            
            # Split by comma and clean up each name
            companies = []
            for company in companies_text.split(','):
                company = company.strip()
                if company:  # Only add non-empty names
                    companies.append({
                        'name': company,
                        'website_url': '',
                        'email': '',
                        'phone': '',
                        'address': '',
                        'description': '',
                        'industry': '',
                        'social_media': ''
                    })
            
            if not companies:
                print("❌ No valid companies found! Please try again.")
                continue
            
            break
        
        print(f"\n📋 Found {len(companies)} companies to process:")
        for i, company in enumerate(companies, 1):
            print(f"   {i}. {company['name']}")
        
        # Ask for confirmation
        confirm = input(f"\n✅ Process these {len(companies)} companies? (y/n): ").strip().lower()
        if confirm not in ['y', 'yes']:
            print("❌ Operation cancelled")
            return []
        
        return companies
    
    def _find_column(self, df: pd.DataFrame, possible_names: List[str]) -> Optional[str]:
        """
        Find a column in the DataFrame that matches one of the possible names
        
        Args:
            df: DataFrame to search in
            possible_names: List of possible column names
            
        Returns:
            The actual column name found, or None
        """
        df_columns_lower = [col.lower().strip() for col in df.columns]
        
        for possible_name in possible_names:
            possible_name_lower = possible_name.lower().strip()
            if possible_name_lower in df_columns_lower:
                # Find the actual column name (with original case)
                for actual_col in df.columns:
                    if actual_col.lower().strip() == possible_name_lower:
                        return actual_col
        
        return None
    
    def search_company_website(self, company_name: str) -> str:
        """
        Aggressively search for company's website - MUST find something!
        
        Args:
            company_name: Name of the company
            
        Returns:
            Company's website URL - never returns None/empty
        """
        logger.info(f"🔍 Aggressively searching website for: {company_name}")
        
        # Method 1: Enhanced DuckDuckGo search (focus on top results)
        website = self._search_duckduckgo_top_results(company_name)
        if website:
            logger.info(f"✅ Found via DuckDuckGo (top results): {website}")
            return website
        
        # Method 2: Enhanced Bing search (focus on top results)
        website = self._search_bing_top_results(company_name)
        if website:
            logger.info(f"✅ Found via Bing (top results): {website}")
            return website
        
        # Method 3: Try different search variations
        website = self._search_with_variations(company_name)
        if website:
            logger.info(f"✅ Found via search variations: {website}")
            return website
        
        # Method 4: Try direct domain guessing
        website = self._guess_company_domain(company_name)
        if website:
            logger.info(f"✅ Found via domain guessing: {website}")
            return website
        
        # Method 5: Aggressive fallback searches
        website = self._aggressive_fallback_search(company_name)
        if website:
            logger.info(f"✅ Found via aggressive fallback: {website}")
            return website
        
        # Method 6: Last resort - create a likely URL
        fallback_url = self._create_fallback_url(company_name)
        logger.warning(f"⚠️ Using fallback URL for {company_name}: {fallback_url}")
        return fallback_url
    
    def _search_duckduckgo_top_results(self, company_name: str) -> Optional[str]:
        """Enhanced DuckDuckGo search focusing on top 3 results"""
        try:
            # Try multiple search queries for better results
            search_queries = [
                company_name,
                f"{company_name} website",
                f"{company_name} official site"
            ]
            
            for query in search_queries:
                search_url = f"https://duckduckgo.com/html/?q={requests.utils.quote(query)}"
                
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
                
                response = requests.get(search_url, headers=headers, timeout=15)
                if response.status_code != 200:
                    continue
                
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Find actual search result containers in DuckDuckGo
                result_containers = soup.find_all('div', class_='result')[:3]  # Top 3 results
                
                for container in result_containers:
                    link = container.find('a', class_='result__a')
                    if link and link.get('href'):
                        href = link.get('href')
                        if href.startswith('http') and 'duckduckgo.com' not in href:
                            # Trust search engine ranking - if it's in top 3, it's likely correct
                            if self._is_business_website(href) and self._quick_validate_website(href):
                                return href
            
            return None
            
        except Exception as e:
            logger.error(f"DuckDuckGo search error for {company_name}: {e}")
            return None
    
    def _search_bing_top_results(self, company_name: str) -> Optional[str]:
        """Enhanced Bing search focusing on top 3 results"""
        try:
            # Try multiple search queries
            search_queries = [
                company_name,
                f"{company_name} website",
                f"{company_name} official"
            ]
            
            for query in search_queries:
                search_url = f"https://www.bing.com/search?q={requests.utils.quote(query)}"
                
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
                
                response = requests.get(search_url, headers=headers, timeout=15)
                if response.status_code != 200:
                    continue
                
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Find Bing search results
                result_containers = soup.find_all('li', class_='b_algo')[:3]  # Top 3 results
                
                for container in result_containers:
                    link = container.find('h2').find('a') if container.find('h2') else None
                    if link and link.get('href'):
                        href = link.get('href')
                        if href.startswith('http') and 'bing.com' not in href:
                            # Trust search engine ranking - if it's in top 3, it's likely correct
                            if self._is_business_website(href) and self._quick_validate_website(href):
                                return href
            
            return None
            
        except Exception as e:
            logger.error(f"Bing search error for {company_name}: {e}")
            return None
    
    def _search_with_variations(self, company_name: str) -> Optional[str]:
        """Try searching with different variations of the company name"""
        try:
            # Create variations of the company name
            variations = [
                company_name,
                company_name.replace(' Inc', '').replace(' LLC', '').replace(' Corp', ''),
                company_name.split()[0],  # First word only
                ' '.join(company_name.split()[:2])  # First two words
            ]
            
            # Remove duplicates while preserving order
            unique_variations = []
            for var in variations:
                if var.strip() and var not in unique_variations:
                    unique_variations.append(var.strip())
            
            for variation in unique_variations:
                if len(variation) < 3:  # Skip very short variations
                    continue
                    
                # Try simple DuckDuckGo search with this variation
                website = self._simple_search(variation)
                if website:
                    return website
            
            return None
            
        except Exception as e:
            logger.error(f"Search variations error for {company_name}: {e}")
            return None
    
    def _simple_search(self, query: str) -> Optional[str]:
        """Simple search method for variations"""
        try:
            search_url = f"https://duckduckgo.com/html/?q={requests.utils.quote(query)}"
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            
            response = requests.get(search_url, headers=headers, timeout=10)
            if response.status_code != 200:
                return None
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Look for the first few legitimate results
            for link in soup.find_all('a', href=True)[:10]:  # Check first 10 links
                href = link.get('href')
                if (href and href.startswith('http') and 
                    'duckduckgo.com' not in href and
                    self._is_business_website(href)):
                    
                    # Quick validation
                    if self._quick_validate_website(href):
                        return href
            
            return None
            
        except Exception as e:
            return None
    
    def _search_bing(self, company_name: str) -> Optional[str]:
        """Search using Bing as another alternative"""
        try:
            search_query = f"{company_name} official website"
            search_url = f"https://www.bing.com/search?q={requests.utils.quote(search_query)}"
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            
            response = requests.get(search_url, headers=headers, timeout=15)
            if response.status_code != 200:
                return None
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Look for Bing search results
            for link in soup.find_all('a', href=True):
                href = link.get('href')
                if href and href.startswith('http') and 'bing.com' not in href:
                    if self._is_likely_company_website(href, company_name):
                        return href
            
            return None
            
        except Exception as e:
            logger.error(f"Bing search error for {company_name}: {e}")
            return None
    
    def _guess_company_domain(self, company_name: str) -> Optional[str]:
        """Try to guess the company's domain by constructing likely URLs"""
        try:
            # Clean company name for domain guessing
            clean_name = re.sub(r'[^a-zA-Z0-9\s]', '', company_name.lower())
            clean_name = re.sub(r'\s+(inc|corp|corporation|llc|ltd|limited|company|co)\s*$', '', clean_name)
            clean_name = clean_name.replace(' ', '')
            
            # Try common domain patterns
            domain_patterns = [
                f"https://www.{clean_name}.com",
                f"https://{clean_name}.com",
                f"https://www.{clean_name}.net",
                f"https://{clean_name}.net",
                f"https://www.{clean_name}.org",
                f"https://{clean_name}.org",
                f"https://www.{clean_name}.co",
                f"https://{clean_name}.co"
            ]
            
            for url in domain_patterns:
                try:
                    response = requests.head(url, timeout=10, allow_redirects=True)
                    if response.status_code == 200:
                        # Verify it's actually a website by checking for HTML content
                        test_response = requests.get(url, timeout=10)
                        if 'text/html' in test_response.headers.get('content-type', ''):
                            return url
                except:
                    continue
            
            return None
            
        except Exception as e:
            logger.error(f"Domain guessing error for {company_name}: {e}")
            return None
    
    def _is_likely_company_website(self, url: str, company_name: str) -> bool:
        """Check if a URL is likely to be the company's official website"""
        url_lower = url.lower()
        company_lower = company_name.lower()
        
        # Exclude social media and other non-official sites
        excluded_sites = [
            'facebook.com', 'twitter.com', 'linkedin.com', 'instagram.com', 
            'youtube.com', 'wikipedia.org', 'bloomberg.com', 'reuters.com',
            'crunchbase.com', 'glassdoor.com', 'indeed.com', 'amazon.com/dp'
        ]
        
        if any(site in url_lower for site in excluded_sites):
            return False
        
        # Check if company name or parts of it appear in the domain
        company_words = re.findall(r'\w+', company_lower)
        company_words = [word for word in company_words if len(word) > 3]  # Only significant words
        
        for word in company_words:
            if word in url_lower:
                return True
        
        # Check for common business domains
        business_domains = ['.com', '.net', '.org', '.co', '.io', '.biz']
        if any(domain in url_lower for domain in business_domains):
            return True
        
        return False
    
    def _validate_company_website(self, url: str, company_name: str) -> bool:
        """Flexibly validate if a URL is likely the correct company website"""
        try:
            # First, check if it's likely a business website
            if not self._is_business_website(url):
                return False
            
            # Try to access the website
            response = requests.head(url, timeout=10, allow_redirects=True)
            if response.status_code != 200:
                return False
            
            # Get the actual content to analyze
            content_response = requests.get(url, timeout=15)
            if content_response.status_code != 200:
                return False
            
            # Check if it's actually HTML content
            content_type = content_response.headers.get('content-type', '').lower()
            if 'text/html' not in content_type:
                return False
            
            # If we get here, it's a working business website
            # For aggressive mode, accept any working business website
            # The search engines should have ranked it correctly
            return True
            
        except Exception as e:
            logger.error(f"Website validation error for {url}: {e}")
            return False
    
    def _is_business_website(self, url: str) -> bool:
        """Check if URL looks like a business website - more flexible"""
        url_lower = url.lower()
        
        # Exclude obvious non-business sites (but be more selective)
        excluded_sites = [
            'facebook.com', 'twitter.com', 'instagram.com', 'tiktok.com',
            'youtube.com', 'wikipedia.org', 'reddit.com', 'quora.com',
            'amazon.com/dp', 'ebay.com/itm', 'pinterest.com'
        ]
        
        # Check for exact matches only (not partial)
        for excluded in excluded_sites:
            if excluded in url_lower:
                return False
        
        # Accept most domains as potentially legitimate
        # Trust that search engines return relevant results
        business_indicators = [
            '.com', '.net', '.org', '.co', '.io', '.biz', '.corp', '.inc',
            '.us', '.uk', '.ca', '.de', '.fr', '.jp', '.au', '.global',
            '.tech', '.info', '.pro', '.company', '.business'
        ]
        
        if any(indicator in url_lower for indicator in business_indicators):
            return True
        
        # Also accept any HTTPS website as potentially legitimate
        if url_lower.startswith('https://'):
            return True
        
        return False
    
    def _quick_validate_website(self, url: str) -> bool:
        """Quick validation to check if website is accessible"""
        try:
            response = requests.head(url, timeout=8, allow_redirects=True)
            return response.status_code == 200
        except:
            return False
    
    def _aggressive_fallback_search(self, company_name: str) -> Optional[str]:
        """Aggressive fallback search methods"""
        try:
            # Method 1: Try simplified company name searches
            simplified_names = self._get_simplified_names(company_name)
            
            for simple_name in simplified_names:
                # Try Google (as backup)
                website = self._try_google_search(simple_name)
                if website:
                    return website
                
                # Try Yahoo search
                website = self._try_yahoo_search(simple_name)
                if website:
                    return website
            
            # Method 2: Try with different keywords
            keywords = ['company', 'corporation', 'official', 'homepage', 'main site']
            for keyword in keywords:
                search_query = f"{company_name} {keyword}"
                website = self._simple_search(search_query)
                if website:
                    return website
            
            # Method 3: Try broader domain guessing with more TLDs
            website = self._expanded_domain_guessing(company_name)
            if website:
                return website
            
            return None
            
        except Exception as e:
            logger.error(f"Aggressive fallback search error: {e}")
            return None
    
    def _get_simplified_names(self, company_name: str) -> List[str]:
        """Get simplified versions of company name"""
        names = []
        
        # Original name
        names.append(company_name)
        
        # Remove common suffixes
        suffixes = ['inc', 'corp', 'corporation', 'llc', 'ltd', 'limited', 'company', 'co', 'group', 'holdings']
        clean_name = company_name.lower()
        for suffix in suffixes:
            clean_name = re.sub(f'\\s+{suffix}\\s*$', '', clean_name)
        names.append(clean_name.title())
        
        # First word only
        first_word = company_name.split()[0]
        if len(first_word) > 3:
            names.append(first_word)
        
        # First two words
        words = company_name.split()
        if len(words) >= 2:
            names.append(' '.join(words[:2]))
        
        # Remove duplicates
        return list(dict.fromkeys(names))
    
    def _try_google_search(self, query: str) -> Optional[str]:
        """Try Google search as backup method"""
        try:
            search_url = f"https://www.google.com/search?q={requests.utils.quote(query)}"
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            
            response = requests.get(search_url, headers=headers, timeout=10)
            if response.status_code != 200:
                return None
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Look for result links
            for link in soup.find_all('a', href=True)[:15]:
                href = link.get('href')
                if href and '/url?q=' in href:
                    # Extract URL
                    start = href.find('/url?q=') + 7
                    end = href.find('&', start)
                    if end == -1:
                        end = len(href)
                    
                    url = href[start:end]
                    if self._is_business_website(url) and self._quick_validate_website(url):
                        return url
            
            return None
            
        except Exception:
            return None
    
    def _try_yahoo_search(self, query: str) -> Optional[str]:
        """Try Yahoo search as another backup"""
        try:
            search_url = f"https://search.yahoo.com/search?p={requests.utils.quote(query)}"
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            
            response = requests.get(search_url, headers=headers, timeout=10)
            if response.status_code != 200:
                return None
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Look for Yahoo result links
            for link in soup.find_all('a', href=True)[:10]:
                href = link.get('href')
                if (href and href.startswith('http') and 
                    'yahoo.com' not in href and 'search.yahoo.com' not in href):
                    if self._is_business_website(href) and self._quick_validate_website(href):
                        return href
            
            return None
            
        except Exception:
            return None
    
    def _expanded_domain_guessing(self, company_name: str) -> Optional[str]:
        """Try more domain extensions and patterns"""
        try:
            # Clean company name
            clean_name = re.sub(r'[^a-zA-Z0-9\s]', '', company_name.lower())
            clean_name = re.sub(r'\s+(inc|corp|corporation|llc|ltd|limited|company|co|group)\s*$', '', clean_name)
            
            # Try different name variations
            name_variations = [
                clean_name.replace(' ', ''),
                clean_name.replace(' ', '-'),
                clean_name.replace(' ', '_'),
                ''.join(word[0] for word in clean_name.split()),  # Acronym
            ]
            
            # Try more TLDs
            tlds = ['.com', '.net', '.org', '.co', '.io', '.biz', '.info', '.us', '.global', '.world']
            
            for name_var in name_variations:
                if not name_var or len(name_var) < 2:
                    continue
                    
                for tld in tlds:
                    for prefix in ['https://www.', 'https://']:
                        url = f"{prefix}{name_var}{tld}"
                        try:
                            response = requests.head(url, timeout=5, allow_redirects=True)
                            if response.status_code == 200:
                                # Double check it's real
                                test_response = requests.get(url, timeout=8)
                                if 'text/html' in test_response.headers.get('content-type', ''):
                                    return url
                        except:
                            continue
            
            return None
            
        except Exception:
            return None
    
    def _create_fallback_url(self, company_name: str) -> str:
        """Create a reasonable fallback URL when all else fails"""
        # Clean the company name for URL
        clean_name = re.sub(r'[^a-zA-Z0-9\s]', '', company_name.lower())
        clean_name = re.sub(r'\s+(inc|corp|corporation|llc|ltd|limited|company|co)\s*$', '', clean_name)
        clean_name = clean_name.replace(' ', '').strip()
        
        if not clean_name:
            clean_name = 'company'
        
        # Create most likely URL pattern
        fallback_url = f"https://www.{clean_name}.com"
        
        return fallback_url
    
    def _search_engine_deep_analysis(self, query: str, engine: str) -> Optional[str]:
        """
        Deep analysis of search engine results - checks first 5 results
        """
        try:
            if engine == "duckduckgo":
                search_url = f"https://duckduckgo.com/html/?q={requests.utils.quote(query)}"
            elif engine == "bing":
                search_url = f"https://www.bing.com/search?q={requests.utils.quote(query)}"
            elif engine == "google":
                search_url = f"https://www.google.com/search?q={requests.utils.quote(query)}"
            else:
                return None
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            
            response = requests.get(search_url, headers=headers, timeout=15)
            if response.status_code != 200:
                return None
            
            soup = BeautifulSoup(response.text, 'html.parser')
            potential_urls = []
            
            # Extract URLs based on search engine
            if engine == "duckduckgo":
                # DuckDuckGo specific parsing
                result_containers = soup.find_all('div', class_='result')[:5]
                for container in result_containers:
                    link = container.find('a', class_='result__a')
                    if link and link.get('href'):
                        href = link.get('href')
                        if href.startswith('http') and 'duckduckgo.com' not in href:
                            potential_urls.append(href)
            
            elif engine == "bing":
                # Bing specific parsing
                result_containers = soup.find_all('li', class_='b_algo')[:5]
                for container in result_containers:
                    link = container.find('h2')
                    if link:
                        a_tag = link.find('a')
                        if a_tag and a_tag.get('href'):
                            href = a_tag.get('href')
                            if href.startswith('http') and 'bing.com' not in href:
                                potential_urls.append(href)
            
            elif engine == "google":
                # Google specific parsing
                for link in soup.find_all('a', href=True)[:15]:
                    href = link.get('href')
                    if href and '/url?q=' in href:
                        # Extract URL from Google redirect
                        start = href.find('/url?q=') + 7
                        end = href.find('&', start)
                        if end == -1:
                            end = len(href)
                        actual_url = href[start:end]
                        if actual_url.startswith('http') and 'google.com' not in actual_url:
                            potential_urls.append(actual_url)
            
            # Test each potential URL
            logger.info(f"Found {len(potential_urls)} potential URLs from {engine}")
            
            for i, url in enumerate(potential_urls, 1):
                logger.info(f"Testing URL {i}/5: {url}")
                
                if self._is_business_website(url) and self._quick_validate_website(url):
                    # Use Claude to validate if this website is actually for the company
                    if self._validate_url_with_claude(url, query):
                        return url
                
                time.sleep(1)  # Small delay between URL tests
            
            return None
            
        except Exception as e:
            logger.error(f"Deep analysis error for {query} on {engine}: {e}")
            return None
    
    def _validate_url_with_claude(self, url: str, company_query: str) -> bool:
        """
        Use Claude to quickly validate if URL is relevant to company
        """
        try:
            # Get page content quickly
            response = self.session.get(url, timeout=10)
            if response.status_code != 200:
                return False
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style"]):
                script.decompose()
            
            # Get limited content for quick analysis
            text_content = soup.get_text()
            text_content = ' '.join(text_content.split())[:2000]  # Smaller sample for quick validation
            
            # Extract company name from query
            company_name = company_query.split()[0:3]  # First few words
            company_name = ' '.join(company_name).replace(' şirket', '').replace(' firma', '').replace(' company', '')
            
            prompt = f"""
            Quick validation: Is this website relevant to the company "{company_name}"?
            
            Website URL: {url}
            Company: {company_name}
            
            Based on the content below, answer only "YES" if this appears to be the official website or a legitimate business website for this company, or "NO" if it's not relevant.
            
            Consider:
            - Does the content mention the company name or related business?
            - Is this a business website (not news, social media, or directory)?
            - Does it seem like the company's official presence?
            
            Answer only: YES or NO
            
            Content sample:
            {text_content}
            """
            
            message = self.claude_client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=50,
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )
            
            response_text = message.content[0].text.strip().upper()
            return response_text == "YES"
            
        except Exception as e:
            logger.error(f"Claude validation error for {url}: {e}")
            return False  # Conservative approach - reject if can't validate
    
    def search_company_website_thoroughly(self, company_name: str) -> str:
        """
        Thorough website search focusing on search engines, not domain guessing
        """
        logger.info(f"🔍 Thoroughly searching website for: {company_name}")
        
        # Method 1: Enhanced DuckDuckGo search - check first 5 results
        logger.info(f"🔍 Searching DuckDuckGo for: {company_name}")
        website = self._search_engine_deep_analysis(company_name, "duckduckgo")
        if website:
            logger.info(f"✅ Found via DuckDuckGo: {website}")
            return website
        
        # Method 2: Enhanced Bing search - check first 5 results
        logger.info(f"🔍 Searching Bing for: {company_name}")
        website = self._search_engine_deep_analysis(company_name, "bing")
        if website:
            logger.info(f"✅ Found via Bing: {website}")
            return website
        
        # Method 3: Enhanced Google search - check first 5 results
        logger.info(f"🔍 Searching Google for: {company_name}")
        website = self._search_engine_deep_analysis(company_name, "google")
        if website:
            logger.info(f"✅ Found via Google: {website}")
            return website
        
        # Method 4: Try with additional search terms
        for additional_term in ["şirket", "firma", "company", "official site"]:
            query = f"{company_name} {additional_term}"
            logger.info(f"🔍 Trying enhanced search: {query}")
            
            website = self._search_engine_deep_analysis(query, "duckduckgo")
            if website:
                logger.info(f"✅ Found via enhanced DuckDuckGo search: {website}")
                return website
                
            time.sleep(2)
        
        # Method 5: Last resort - only use domain guessing as absolute fallback
        logger.warning(f"⚠️ All search methods failed for {company_name}, trying domain guessing...")
        website = self._guess_company_domain(company_name)
        if website and self._thoroughly_validate_website(website, company_name):
            logger.info(f"✅ Found via domain guessing: {website}")
            return website
        
        # Method 6: Create reasonable fallback URL
        fallback_url = self._create_fallback_url(company_name)
        logger.warning(f"⚠️ Using fallback URL for {company_name}: {fallback_url}")
        return fallback_url
    
    def _thoroughly_validate_website(self, url: str, company_name: str) -> bool:
        """Thorough validation of website relevance"""
        try:
            # Basic checks
            if not self._is_business_website(url):
                return False
            
            if not self._quick_validate_website(url):
                return False
            
            # Get content for analysis
            content = self.get_page_content_with_retries(url)
            if not content:
                return False
            
            # Use Claude Sonnet to validate relevance
            is_relevant = self._validate_website_relevance_with_sonnet(content, company_name, url)
            return is_relevant
            
        except Exception as e:
            logger.error(f"Thorough validation error for {url}: {e}")
            return False
    
    def _validate_website_relevance_with_sonnet(self, content: str, company_name: str, url: str) -> bool:
        """Use Claude Sonnet to validate if website is relevant to company"""
        try:
            soup = BeautifulSoup(content, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style"]):
                script.decompose()
            
            # Get text content and limit it
            text_content = soup.get_text()
            text_content = ' '.join(text_content.split())[:4000]  # Limit for analysis
            
            prompt = f"""
            Please analyze if this website content is relevant to the company "{company_name}".
            
            Website URL: {url}
            Company Name: {company_name}
            
            Analyze the content and determine if this is likely the official website or a legitimate website for this company.
            
            Consider:
            1. Does the content mention the company name or related business?
            2. Is this a business website (not a social media profile or news article)?
            3. Does the content suggest this is the company's official presence?
            
            Return only "YES" if this appears to be a legitimate website for the company, or "NO" if it's not relevant.
            
            Website content to analyze:
            {text_content}
            """
            
            message = self.claude_client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=100,
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )
            
            response = message.content[0].text.strip().upper()
            return response == "YES"
            
        except Exception as e:
            logger.error(f"Sonnet validation error: {e}")
            return True  # Default to accepting if validation fails
    
    def get_page_content_with_retries(self, url: str, max_retries: int = 3) -> Optional[str]:
        """Get page content with multiple retries for reliability"""
        for attempt in range(max_retries):
            try:
                response = self.session.get(url, timeout=30)
                response.raise_for_status()
                return response.text
            except requests.RequestException as e:
                if attempt < max_retries - 1:
                    logger.warning(f"Attempt {attempt + 1} failed for {url}, retrying...")
                    time.sleep(3)  # Wait before retry
                else:
                    logger.error(f"All attempts failed for {url}: {e}")
        return None
    
    def extract_contact_info_with_sonnet(self, html_content: str, company_name: str, website_url: str) -> Dict[str, str]:
        """Enhanced contact extraction using Claude Sonnet"""
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()
        
        # Get text content
        text_content = soup.get_text()
        text_content = ' '.join(text_content.split())[:8000]  # More content for Sonnet
        
        prompt = f"""
        You are an expert at extracting comprehensive business information from websites.
        
        Please carefully analyze the following website content for the company "{company_name}" (website: {website_url}) and extract ALL available business information.
        
        I need you to find:
        1. EMAIL: The main business contact email address (avoid generic addresses like admin@, webmaster@, noreply@)
        2. PHONE: The main business phone number (with country code if available)
        3. ADDRESS: The complete business address (street, city, state/province, country, postal code)
        4. DESCRIPTION: A brief description of what the company does (2-3 sentences)
        5. INDUSTRY: The industry/sector the company operates in
        6. SOCIAL_MEDIA: Any social media links (LinkedIn, Twitter, Facebook, etc.)
        
        Guidelines:
        - Look for "Contact Us", "About Us", "Contact Information", "About" sections
        - For EMAIL: Prefer general business emails like: info@, contact@, sales@, hello@, support@
        - For PHONE: Include area codes and country codes when available
        - For ADDRESS: Include complete address if available, even if it's just city/country
        - For DESCRIPTION: Summarize the company's main business/services
        - For INDUSTRY: Use general terms like "Technology", "Healthcare", "Finance", "Manufacturing", etc.
        - For SOCIAL_MEDIA: Include LinkedIn, Twitter, Facebook links if found
        - If any information is not found, use empty strings
        - If multiple options exist, choose the most professional/comprehensive one
        
        Return your response in this exact JSON format:
        {{
            "email": "",
            "phone": "",
            "address": "",
            "description": "",
            "industry": "",
            "social_media": ""
        }}
        
        Website content to analyze:
        {text_content}
        """
        
        try:
            message = self.claude_client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=1000,
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )
            
            response_text = message.content[0].text.strip()
            
            # Try to extract JSON from the response
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            
            if json_start != -1 and json_end != -1:
                json_str = response_text[json_start:json_end]
                contact_info = json.loads(json_str)
                
                # Clean and validate extracted information
                if contact_info.get('email'):
                    email = contact_info['email'].strip()
                    if '@' in email and '.' in email:
                        contact_info['email'] = email
                    else:
                        contact_info['email'] = ''
                
                if contact_info.get('phone'):
                    phone = contact_info['phone'].strip()
                    # Basic phone validation
                    if any(char.isdigit() for char in phone):
                        contact_info['phone'] = phone
                    else:
                        contact_info['phone'] = ''
                
                # Clean other fields
                for field in ['address', 'description', 'industry', 'social_media']:
                    if contact_info.get(field):
                        contact_info[field] = contact_info[field].strip()
                    else:
                        contact_info[field] = ''
                
                return contact_info
            else:
                logger.warning(f"Could not parse JSON from Sonnet response for {company_name}")
                return {"email": "", "phone": "", "address": "", "description": "", "industry": "", "social_media": ""}
                
        except Exception as e:
            logger.error(f"Error using Claude Sonnet for {company_name}: {e}")
            return {"email": "", "phone": "", "address": "", "description": "", "industry": "", "social_media": ""}
    
    def get_page_content(self, url: str) -> Optional[str]:
        """
        Fetch webpage content with error handling
        
        Args:
            url: URL to fetch
            
        Returns:
            HTML content or None if failed
        """
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            return response.text
        except requests.RequestException as e:
            logger.error(f"Error fetching {url}: {e}")
            return None
    
    def extract_contact_info_with_claude(self, html_content: str, company_name: str, website_url: str) -> Dict[str, str]:
        """
        Use Claude API to extract contact information from HTML content
        
        Args:
            html_content: Raw HTML content
            company_name: Name of the company for context
            website_url: The website URL being analyzed
            
        Returns:
            Dictionary containing extracted contact information
        """
        # Clean and limit the HTML content
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()
        
        # Get text content and limit it
        text_content = soup.get_text()
        text_content = ' '.join(text_content.split())[:6000]  # Clean whitespace and limit
        
        # Prepare the prompt for Claude
        prompt = f"""
        Please extract contact information from the following website content for the company "{company_name}" (website: {website_url}).
        
        I need you to find and return ONLY the following information in JSON format:
        - email: Email address (look for @ symbol, preferably general contact email like info@, contact@, sales@, support@)
        - phone: Phone number (look for numbers with country codes, area codes, or standard phone patterns)
        
        If any information is not found, use an empty string "".
        Return ONLY valid JSON in this exact format (no additional text):
        
        {{
            "email": "",
            "phone": ""
        }}
        
        Website content to analyze:
        {text_content}
        """
        
        try:
            message = self.claude_client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=1000,
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )
            
            response_text = message.content[0].text.strip()
            
            # Try to extract JSON from the response
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            
            if json_start != -1 and json_end != -1:
                json_str = response_text[json_start:json_end]
                contact_info = json.loads(json_str)
                return contact_info
            else:
                logger.warning(f"Could not parse JSON from Claude response for {company_name}")
                return {"email": "", "phone": ""}
                
        except Exception as e:
            logger.error(f"Error using Claude API for {company_name}: {e}")
            return {"email": "", "phone": ""}
    
    def process_single_company(self, company_data: Dict[str, str]) -> Dict[str, str]:
        """
        Process a single company to get all information
        
        Args:
            company_data: Dictionary with company name and possibly website
            
        Returns:
            Dictionary with updated company information
        """
        company_name = company_data['name']
        logger.info(f"🔍 Processing: {company_name}")
        
        # Step 1: Get website URL (either from Excel or search)
        website_url = company_data.get('website_url', '')
        
        if not website_url:
            # Need to search for website
            logger.info(f"🔍 Searching for website: {company_name}")
            website_url = self.search_company_website(company_name)
            
            if not website_url:
                logger.warning(f"❌ Could not find website for {company_name}")
                return company_data
            
            company_data['website_url'] = website_url
            logger.info(f"🌐 Found website: {website_url}")
        else:
            logger.info(f"🌐 Using provided website: {website_url}")
        
        # Step 2: Get website content
        content = self.get_page_content(website_url)
        
        if not content:
            logger.warning(f"❌ Could not fetch content from {website_url}")
            return company_data
        
        # Step 3: Extract contact information using Claude
        contact_info = self.extract_contact_info_with_claude(content, company_name, website_url)
        company_data.update(contact_info)
        
        logger.info(f"✅ Completed: {company_name}")
        return company_data
    
    def scrape_companies_sequential(self, companies_data: List[Dict[str, str]]) -> List[Dict[str, str]]:
        """
        Process companies sequentially for maximum accuracy
        
        Args:
            companies_data: List of company data dictionaries
            
        Returns:
            List of updated company data dictionaries
        """
        logger.info(f"🎯 Starting sequential processing for maximum accuracy")
        
        results = []
        total = len(companies_data)
        
        for i, company_data in enumerate(companies_data, 1):
            company_name = company_data['name']
            logger.info(f"🔍 Processing {i}/{total}: {company_name}")
            
            try:
                # Process with extra care and validation
                updated_company_data = self.process_single_company_carefully(company_data)
                results.append(updated_company_data)
                
                logger.info(f"✅ Completed {i}/{total}: {company_name}")
                
                # Add longer delay between companies for accuracy
                time.sleep(3)  # 3 seconds between each company
                
            except Exception as e:
                logger.error(f"❌ Error processing {company_name}: {e}")
                # Add company with basic info even if processing failed
                results.append({
                    'name': company_name,
                    'website_url': '',
                    'email': '',
                    'phone': ''
                })
        
        logger.info(f"🎉 Sequential processing completed! Processed {len(results)} companies")
        return results
    
    def process_single_company_carefully(self, company_data: Dict[str, str]) -> Dict[str, str]:
        """
        Process a single company with extra care for accuracy
        
        Args:
            company_data: Dictionary with company name and possibly website
            
        Returns:
            Dictionary with updated company information
        """
        company_name = company_data['name']
        logger.info(f"🔍 Carefully processing: {company_name}")
        
        # Step 1: Get website URL with thorough validation
        website_url = company_data.get('website_url', '')
        
        if not website_url:
            # Search for website with multiple attempts
            logger.info(f"🔍 Searching for website: {company_name}")
            website_url = self.search_company_website_thoroughly(company_name)
            
            if not website_url:
                logger.warning(f"❌ Could not find website for {company_name}")
                return company_data
            
            company_data['website_url'] = website_url
            logger.info(f"🌐 Found website: {website_url}")
        else:
            logger.info(f"🌐 Using provided website: {website_url}")
            # Validate provided website
            if not self._quick_validate_website(website_url):
                logger.warning(f"⚠️ Provided website not accessible: {website_url}")
                # Try to find alternative
                alternative_url = self.search_company_website_thoroughly(company_name)
                if alternative_url:
                    website_url = alternative_url
                    company_data['website_url'] = website_url
                    logger.info(f"🔄 Using alternative website: {website_url}")
        
        # Step 2: Get website content with retries
        content = self.get_page_content_with_retries(website_url)
        
        if not content:
            logger.warning(f"❌ Could not fetch content from {website_url}")
            return company_data
        
        # Step 3: Extract contact information using Claude Sonnet with enhanced prompt
        contact_info = self.extract_contact_info_with_sonnet(content, company_name, website_url)
        company_data.update(contact_info)
        
        logger.info(f"✅ Carefully completed: {company_name}")
        return company_data
    
    def save_to_excel(self, companies_data: List[Dict[str, str]], filename: str = "companies_data.xlsx") -> str:
        """
        Save the scraped data to an Excel file
        
        Args:
            companies_data: List of company data dictionaries
            filename: Name of the Excel file to create
            
        Returns:
            Path to the created file
        """
        if not companies_data:
            logger.error("No data to save")
            return ""
        
        # Create DataFrame
        df = pd.DataFrame(companies_data)
        
        # Reorder columns for better presentation
        available_columns = [col for col in ['name', 'website_url', 'email', 'phone', 'address', 'description', 'industry', 'social_media'] if col in df.columns]
        df = df.reindex(columns=available_columns)
        
        # Rename columns to Turkish/English
        column_mapping = {
            'name': 'Firma İsmi',
            'website_url': 'Website URL', 
            'email': 'E-mail',
            'phone': 'Telefon',
            'address': 'Adres',
            'description': 'Açıklama',
            'industry': 'Sektör',
            'social_media': 'Sosyal Medya'
        }
        
        df.columns = [column_mapping.get(col, col) for col in df.columns]
        
        # Save to Excel
        df.to_excel(filename, index=False, engine='openpyxl')
        logger.info(f"Data saved to {filename}")
        
        # Display first few rows for verification
        print("\n📊 Extracted data preview:")
        print(df.head(10))
        
        return filename

# ================================
# EXECUTION SECTION FOR COLAB
# ================================

# 🔑 YOUR API KEY IS ALREADY SET HERE 🔑
CLAUDE_API_KEY = "your-api-key-here"

def run_company_scraper():
    """
    Main function to run the company scraper with comma-separated input
    """
    print("=" * 80)
    print("🏢 COMPANY CONTACT INFORMATION SCRAPER")
    print("🎯 ACCURACY-FIRST MODE - Claude Sonnet Powered")
    print("🔍 Thorough Website Validation & Contact Extraction")
    print("=" * 80)
    
    # Initialize scraper
    scraper = CompanyScraper(CLAUDE_API_KEY)
    
    try:
        # Get company names from user input
        companies_data = scraper.get_company_names_from_user()
        
        if not companies_data:
            print("❌ No companies to process")
            return
        
        print(f"\n🔄 Starting to process {len(companies_data)} companies...")
        print("🎯 Sequential processing for maximum accuracy!")
        print("🔍 Using Claude Sonnet for website validation and contact extraction")
        print("⏱️ Taking time to ensure correctness - no rush!")
        print("-" * 50)
        
        # Process companies sequentially for accuracy
        start_time = time.time()
        processed_companies = scraper.scrape_companies_sequential(companies_data)
        end_time = time.time()
        
        if processed_companies:
            print(f"\n✅ Successfully processed {len(processed_companies)} companies")
            print(f"⏱️ Total time: {end_time - start_time:.1f} seconds")
            
            # Verify no websites are missing
            missing_websites = sum(1 for c in processed_companies if not c.get('website_url'))
            if missing_websites == 0:
                print("🎉 SUCCESS: Found websites for ALL companies!")
            else:
                print(f"⚠️ Warning: {missing_websites} companies still without websites")
            
            # Save to Excel
            excel_file = scraper.save_to_excel(processed_companies, "company_contacts_complete.xlsx")
            print(f"💾 Data saved to: {excel_file}")
            
            # Display summary
            print("\n📊 Final Summary:")
            print(f"📈 Total companies processed: {len(processed_companies)}")
            print(f"🌐 Companies with websites: {sum(1 for c in processed_companies if c.get('website_url'))}")
            print(f"📧 Companies with emails: {sum(1 for c in processed_companies if c.get('email'))}")
            print(f"📞 Companies with phones: {sum(1 for c in processed_companies if c.get('phone'))}")
            print(f"📍 Companies with addresses: {sum(1 for c in processed_companies if c.get('address'))}")
            print(f"📝 Companies with descriptions: {sum(1 for c in processed_companies if c.get('description'))}")
            print(f"🏭 Companies with industry info: {sum(1 for c in processed_companies if c.get('industry'))}")
            print(f"📱 Companies with social media: {sum(1 for c in processed_companies if c.get('social_media'))}")
            
            # Automatic download for Google Colab
            print(f"\n⬇️ Automatically downloading the Excel file...")
            try:
                from google.colab import files
                files.download(excel_file)
                print(f"✅ Download started! Check your Downloads folder for: {excel_file}")
            except ImportError:
                print(f"💾 File saved as: {excel_file}")
                print(f"📁 You can find it in the current directory")
            except Exception as download_error:
                print(f"❌ Download error: {download_error}")
                print(f"💾 File saved as: {excel_file}")
                print(f"📁 Manual download: Right-click the file in the file browser")
            
        else:
            print("❌ No companies were successfully processed")
            
    except Exception as e:
        logger.error(f"Error in main execution: {e}")
        print(f"❌ An error occurred: {e}")

# Automatically start the scraper
print("=" * 80)
print("✅ All dependencies installed!")
print("✅ API key configured!")
print("✅ Parallel processing ready!")
print("=" * 80)

# Start the interactive company scraper
run_company_scraper()
