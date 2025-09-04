# Teknopark Istanbul Company Scraper

A comprehensive web scraping solution that extracts company information from Teknopark Istanbul website and collects detailed contact information using Claude API Haiku model.

## Features

- ✅ Extracts company list from https://www.teknoparkistanbul.com.tr/firmalar
- ✅ Visits each company's profile page
- ✅ Uses Claude API Haiku to intelligently extract contact information
- ✅ Collects: Company Name, Website URL, Email, Phone Number
- ✅ Exports data to Excel file with Turkish column headers
- ✅ Optimized for Google Colab environment
- ✅ Includes test mode for development

## What Information is Extracted

For each company, the scraper collects:
- **Firma İsmi** (Company Name)
- **Website URL** (Company's main website)
- **E-mail** (Contact email address)
- **Telefon** (Phone number)
- **Profil URL** (Link to company's Teknopark profile)

## Google Colab Usage (Recommended)

### Step 1: Copy the Code
Copy the entire content of `google_colab_setup.py` into a new Google Colab notebook cell.

### Step 2: Add Your API Key
Replace `YOUR_CLAUDE_API_KEY` with your actual Claude API key:
```python
CLAUDE_API_KEY = "your-actual-api-key-here"
```

### Step 3: Run the Code
Execute the cell to install dependencies and load the scraper.

### Step 4: Start Scraping

**For testing (only 5 companies):**
```python
run_scraper(CLAUDE_API_KEY, test_mode=True)
```

**For full scraping (all companies):**
```python
run_scraper(CLAUDE_API_KEY, test_mode=False)
```

### Step 5: Download Results
After scraping is complete, download the Excel file:
```python
from google.colab import files
files.download('teknopark_companies.xlsx')
```

## Local Usage

### Prerequisites
- Python 3.7+
- Claude API key from Anthropic

### Installation
```bash
pip install -r requirements.txt
```

### Usage
1. Edit `company_scraper.py` and add your Claude API key:
```python
CLAUDE_API_KEY = "your-actual-api-key-here"
```

2. Run the scraper:
```bash
python company_scraper.py
```

## Getting Claude API Key

1. Visit https://console.anthropic.com/
2. Sign up or log in to your account
3. Go to API Keys section
4. Create a new API key
5. Copy the key and paste it in the code

## Technical Details

### How It Works

1. **Company Discovery**: Scrapes the main Teknopark page to find all company profile links
2. **Content Extraction**: Visits each company's profile page to get HTML content
3. **AI Processing**: Uses Claude API Haiku model to intelligently extract contact information from HTML
4. **Data Cleaning**: Validates and formats extracted data
5. **Excel Export**: Creates a well-formatted Excel file with Turkish headers

### Smart Features

- **Intelligent Parsing**: Claude AI can understand different website layouts and extract contact info accurately
- **Error Handling**: Robust error handling for network issues and parsing failures
- **Rate Limiting**: Built-in delays to respect website servers
- **Duplicate Prevention**: Avoids processing duplicate companies
- **Progress Tracking**: Real-time progress updates during scraping

### File Structure

```
├── company_scraper.py          # Main scraper for local usage
├── google_colab_setup.py       # Complete setup for Google Colab
├── requirements.txt            # Python dependencies
└── README.md                  # This file
```

## Expected Output

The scraper will create an Excel file (`teknopark_companies.xlsx`) with the following columns:

| Firma İsmi | Website URL | E-mail | Telefon | Profil URL |
|------------|-------------|--------|---------|------------|
| Company A  | https://... | info@...| +90...  | https://... |
| Company B  | https://... | sales@..| +90...  | https://... |

## Troubleshooting

### Common Issues

1. **No companies found**: The website structure might have changed. Check the selectors in `extract_companies_from_main_page()`.

2. **Claude API errors**: 
   - Verify your API key is correct
   - Check your API quota/billing
   - Ensure you have access to Claude Haiku model

3. **Slow performance**: 
   - This is normal due to API calls and respectful rate limiting
   - Use test mode for development
   - Consider reducing the delay in `scrape_company_details()`

### Performance Notes

- **Full scraping**: May take 30-60 minutes depending on number of companies
- **Test mode**: Takes 2-3 minutes for 5 companies
- **API costs**: Approximately $0.01-0.05 per company depending on content size

## Customization

### Modifying Extracted Fields
To extract additional information, modify the Claude prompt in `extract_contact_info_with_claude()`.

### Changing Target Website
Update the `main_url` variable and adjust the company discovery selectors in `extract_companies_from_main_page()`.

### Adjusting Rate Limiting
Modify the `time.sleep()` value in `scrape_company_details()` (minimum 1 second recommended).

## Legal and Ethical Considerations

- ✅ Respects robots.txt and rate limiting
- ✅ Only scrapes publicly available information
- ✅ Uses respectful delays between requests
- ✅ Designed for legitimate business research purposes

Please ensure you comply with the website's terms of service and applicable laws in your jurisdiction.

## Support

For issues or questions:
1. Check the troubleshooting section
2. Verify your Claude API key and permissions
3. Test with a smaller dataset first using test mode
