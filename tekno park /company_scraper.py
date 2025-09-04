#!/usr/bin/env python3
"""
Company Information Scraper for Teknopark Istanbul
Extracts company data and contact information using Claude API Haiku model
Designed for Google Colab environment
"""

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

# Configure logging
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
            '.firma-link'
        ]
        
        company_links = []
        for selector in company_selectors:
            links = soup.select(selector)
            if links:
                company_links.extend(links)
                break
        
        # If no specific selectors work, try to find all internal links that might be companies
        if not company_links:
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
        
        # Extract company information
        for link in company_links:
            company_name = link.get_text(strip=True)
            company_url = urljoin(main_url, link.get('href'))
            
            if company_name and len(company_name) > 2:  # Filter out very short names
                companies.append({
                    'name': company_name,
                    'profile_url': company_url,
                    'website_url': '',
                    'email': '',
                    'phone': ''
                })
        
        logger.info(f"Found {len(companies)} companies")
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
        # Prepare the prompt for Claude
        prompt = f"""
        Please extract contact information from the following HTML content for the company "{company_name}".
        
        I need you to find and return ONLY the following information in JSON format:
        - website_url: The company's main website URL (not social media)
        - email: Email address (preferably general contact email)
        - phone: Phone number
        
        If any information is not found, use an empty string "".
        
        Return only valid JSON in this exact format:
        {{
            "website_url": "",
            "email": "",
            "phone": ""
        }}
        
        HTML Content:
        {html_content[:8000]}  # Limit content to avoid token limits
        """
        
        try:
            message = self.claude_client.messages.create(
                model="claude-3-haiku-20240307",
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
                return json.loads(json_str)
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
        time.sleep(1)
        
        return company
    
    def scrape_all_companies(self, main_url: str) -> List[Dict[str, str]]:
        """
        Main method to scrape all companies and their details
        
        Args:
            main_url: The main page URL containing company listings
            
        Returns:
            List of companies with full contact information
        """
        # Step 1: Extract company list from main page
        companies = self.extract_companies_from_main_page(main_url)
        
        if not companies:
            logger.error("No companies found on the main page")
            return []
        
        # Step 2: Scrape details for each company
        logger.info(f"Starting to scrape details for {len(companies)} companies...")
        
        for i, company in enumerate(companies, 1):
            logger.info(f"Processing company {i}/{len(companies)}: {company['name']}")
            try:
                updated_company = self.scrape_company_details(company)
                self.companies_data.append(updated_company)
                
                # Progress update every 10 companies
                if i % 10 == 0:
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
        
        return filename

def main():
    """
    Main function to run the scraper
    Replace 'YOUR_CLAUDE_API_KEY' with your actual API key
    """
    
    # PASTE YOUR CLAUDE API KEY HERE
    CLAUDE_API_KEY = "YOUR_CLAUDE_API_KEY"  # Replace with your actual API key
    
    if CLAUDE_API_KEY == "YOUR_CLAUDE_API_KEY":
        print("ERROR: Please replace 'YOUR_CLAUDE_API_KEY' with your actual Claude API key")
        return
    
    # Target website
    main_url = "https://www.teknoparkistanbul.com.tr/firmalar"
    
    # Initialize scraper
    scraper = CompanyScraper(CLAUDE_API_KEY)
    
    print("Starting company data extraction...")
    print(f"Target website: {main_url}")
    print("-" * 50)
    
    try:
        # Scrape all companies
        companies_data = scraper.scrape_all_companies(main_url)
        
        if companies_data:
            print(f"\nSuccessfully scraped {len(companies_data)} companies")
            
            # Save to Excel
            excel_file = scraper.save_to_excel("teknopark_companies.xlsx")
            print(f"Data saved to: {excel_file}")
            
            # Display summary
            print("\nSummary:")
            print(f"Total companies: {len(companies_data)}")
            print(f"Companies with websites: {sum(1 for c in companies_data if c.get('website_url'))}")
            print(f"Companies with emails: {sum(1 for c in companies_data if c.get('email'))}")
            print(f"Companies with phones: {sum(1 for c in companies_data if c.get('phone'))}")
            
        else:
            print("No companies were successfully scraped")
            
    except Exception as e:
        logger.error(f"Error in main execution: {e}")
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    main()
