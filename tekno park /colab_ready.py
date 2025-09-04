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
    
    def extract_companies_from_main_page(self, main_url: str) -> List[Dict[str, str]]:
        """
        Extract company information from the main Teknopark page
        
        Args:
            main_url: The main page URL containing company listings
            
        Returns:
            List of dictionaries containing company basic info
        """
        logger.info(f"Extracting companies from: {main_url}")
        content = self.get_page_content(main_url)
        
        if not content:
            logger.error("Failed to fetch main page content")
            return []
        
        soup = BeautifulSoup(content, 'html.parser')
        companies = []
        
        # Look for company links and names - this may need adjustment based on actual page structure
        # Common patterns for company listings
        company_selectors = [
            'a[href*="firma"]',
            'a[href*="company"]', 
            '.company-item a',
            '.firm-item a',
            '.company-link',
            '.firma-link',
            '.companies-list a',
            '.firm-list a'
        ]
        
        company_links = []
        for selector in company_selectors:
            links = soup.select(selector)
            if links:
                company_links.extend(links)
                logger.info(f"Found {len(links)} links with selector: {selector}")
                break
        
        # If no specific selectors work, try to find all internal links that might be companies
        if not company_links:
            logger.info("No specific company selectors worked, trying generic approach...")
            all_links = soup.find_all('a', href=True)
            base_domain = urlparse(main_url).netloc
            
            for link in all_links:
                href = link.get('href')
                if href and (href.startswith('http') or href.startswith('/')):
                    full_url = urljoin(main_url, href)
                    if urlparse(full_url).netloc == base_domain:
                        # Filter for company-related URLs
                        if any(keyword in href.lower() for keyword in ['firma', 'company', 'detail']):
                            company_links.append(link)
        
        # Also try looking for div containers that might contain company info
        if not company_links:
            logger.info("Trying to find company containers...")
            company_containers = soup.find_all(['div', 'li'], class_=re.compile(r'(company|firma|firm)', re.I))
            for container in company_containers:
                link = container.find('a', href=True)
                if link:
                    company_links.append(link)
        
        # Extract company information
        seen_names = set()  # To avoid duplicates
        for link in company_links:
            company_name = link.get_text(strip=True)
            company_url = urljoin(main_url, link.get('href'))
            
            if company_name and len(company_name) > 2 and company_name not in seen_names:
                seen_names.add(company_name)
                companies.append({
                    'name': company_name,
                    'profile_url': company_url,
                    'website_url': '',
                    'email': '',
                    'phone': ''
                })
        
        logger.info(f"Found {len(companies)} unique companies")
        
        # If still no companies found, let's try a different approach
        if not companies:
            logger.info("No companies found with standard methods, trying text-based search...")
            # Look for patterns that might indicate company listings
            text_content = soup.get_text()
            # This is a fallback - you might need to adjust based on the actual page structure
            
        return companies
    
    def extract_contact_info_with_claude(self, html_content: str, company_name: str) -> Dict[str, str]:
        """
        Use Claude API to extract contact information from HTML content
        
        Args:
            html_content: Raw HTML content
            company_name: Name of the company for context
            
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
        Please extract contact information from the following content for the company "{company_name}".
        
        I need you to find and return ONLY the following information in JSON format:
        - website_url: The company's main website URL (look for www., http, .com, .net, .org, .tr etc. - NOT social media links)
        - email: Email address (look for @ symbol, preferably general contact email like info@, contact@, sales@)
        - phone: Phone number (look for numbers with country codes, area codes, or standard phone patterns)
        
        If any information is not found, use an empty string "".
        Return ONLY valid JSON in this exact format (no additional text):
        
        {{
            "website_url": "",
            "email": "",
            "phone": ""
        }}
        
        Content to analyze:
        {text_content}
        """
        
        try:
            message = self.claude_client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=500,
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
                
                # Validate and clean the extracted information
                if contact_info.get('website_url'):
                    url = contact_info['website_url']
                    if not url.startswith('http'):
                        contact_info['website_url'] = 'https://' + url
                
                return contact_info
            else:
                logger.warning(f"Could not parse JSON from Claude response for {company_name}")
                return {"website_url": "", "email": "", "phone": ""}
                
        except Exception as e:
            logger.error(f"Error using Claude API for {company_name}: {e}")
            return {"website_url": "", "email": "", "phone": ""}
    
    def scrape_company_details(self, company: Dict[str, str]) -> Dict[str, str]:
        """
        Scrape detailed information for a single company
        
        Args:
            company: Company dictionary with basic info
            
        Returns:
            Updated company dictionary with contact details
        """
        logger.info(f"Scraping details for: {company['name']}")
        
        # Get the company's profile page content
        content = self.get_page_content(company['profile_url'])
        
        if not content:
            logger.warning(f"Could not fetch content for {company['name']}")
            return company
        
        # Use Claude to extract contact information
        contact_info = self.extract_contact_info_with_claude(content, company['name'])
        
        # Update company information
        company.update(contact_info)
        
        # Add a small delay to be respectful to the server
        time.sleep(2)  # Increased delay for stability
        
        return company
    
    def scrape_all_companies(self, main_url: str, limit: Optional[int] = None) -> List[Dict[str, str]]:
        """
        Main method to scrape all companies and their details
        
        Args:
            main_url: The main page URL containing company listings
            limit: Optional limit on number of companies to process (for testing)
            
        Returns:
            List of companies with full contact information
        """
        # Step 1: Extract company list from main page
        companies = self.extract_companies_from_main_page(main_url)
        
        if not companies:
            logger.error("No companies found on the main page")
            return []
        
        # Apply limit if specified
        if limit:
            companies = companies[:limit]
            logger.info(f"Processing limited set of {len(companies)} companies")
        
        # Step 2: Scrape details for each company
        logger.info(f"Starting to scrape details for {len(companies)} companies...")
        
        for i, company in enumerate(companies, 1):
            logger.info(f"Processing company {i}/{len(companies)}: {company['name']}")
            try:
                updated_company = self.scrape_company_details(company)
                self.companies_data.append(updated_company)
                
                # Progress update every 5 companies
                if i % 5 == 0:
                    logger.info(f"Completed {i}/{len(companies)} companies")
                    
            except Exception as e:
                logger.error(f"Error processing {company['name']}: {e}")
                # Add the company anyway with available information
                self.companies_data.append(company)
        
        return self.companies_data
    
    def save_to_excel(self, filename: str = "companies_data.xlsx") -> str:
        """
        Save the scraped data to an Excel file
        
        Args:
            filename: Name of the Excel file to create
            
        Returns:
            Path to the created file
        """
        if not self.companies_data:
            logger.error("No data to save")
            return ""
        
        # Create DataFrame
        df = pd.DataFrame(self.companies_data)
        
        # Reorder columns for better presentation
        column_order = ['name', 'website_url', 'email', 'phone', 'profile_url']
        df = df.reindex(columns=column_order)
        
        # Rename columns to Turkish as requested
        df.columns = ['Firma İsmi', 'Website URL', 'E-mail', 'Telefon', 'Profil URL']
        
        # Save to Excel
        df.to_excel(filename, index=False, engine='openpyxl')
        logger.info(f"Data saved to {filename}")
        
        # Display first few rows for verification
        print("\nFirst 5 rows of extracted data:")
        print(df.head())
        
        return filename

# ================================
# EXECUTION SECTION FOR COLAB
# ================================

# 🔑 YOUR API KEY IS ALREADY SET HERE 🔑
CLAUDE_API_KEY = "your-api-key-here"

def run_scraper(test_mode: bool = False):
    """
    Main function to run the scraper in Google Colab
    
    Args:
        test_mode: If True, only processes first 5 companies for testing
    """
    
    # Target website
    main_url = "https://www.teknoparkistanbul.com.tr/firmalar"
    
    # Initialize scraper
    scraper = CompanyScraper(CLAUDE_API_KEY)
    
    print("🚀 Starting company data extraction...")
    print(f"📍 Target website: {main_url}")
    print("-" * 60)
    
    try:
        # Scrape companies with optional limit for testing
        limit = 5 if test_mode else None
        companies_data = scraper.scrape_all_companies(main_url, limit=limit)
        
        if companies_data:
            print(f"\n✅ Successfully scraped {len(companies_data)} companies")
            
            # Save to Excel
            excel_file = scraper.save_to_excel("teknopark_companies.xlsx")
            print(f"💾 Data saved to: {excel_file}")
            
            # Display summary
            print("\n📊 Summary:")
            print(f"📈 Total companies: {len(companies_data)}")
            print(f"🌐 Companies with websites: {sum(1 for c in companies_data if c.get('website_url'))}")
            print(f"📧 Companies with emails: {sum(1 for c in companies_data if c.get('email'))}")
            print(f"📞 Companies with phones: {sum(1 for c in companies_data if c.get('phone'))}")
            
            # Download link for Colab
            print(f"\n⬇️ To download the file, run this in a new cell:")
            print(f"from google.colab import files")
            print(f"files.download('{excel_file}')")
            
        else:
            print("❌ No companies were successfully scraped")
            
    except Exception as e:
        logger.error(f"Error in main execution: {e}")
        print(f"❌ An error occurred: {e}")

# Automatically start test mode
print("=" * 60)
print("🎯 TEKNOPARK ISTANBUL COMPANY SCRAPER")
print("=" * 60)
print("✅ All dependencies installed!")
print("✅ API key configured!")
print("✅ Ready to scrape!")
print()
print("🧪 Starting TEST MODE (5 companies)...")
print("=" * 60)

# Run test mode automatically
run_scraper(test_mode=True)
