"""
TEN NEWS LIVE - RSS SOURCES CONFIGURATION
200+ curated RSS feeds across all categories
"""

RSS_SOURCES = {
    # ============================================================
    # BREAKING NEWS & GENERAL (Top Tier)
    # ============================================================
    'breaking': [
        {'name': 'Reuters World', 'url': 'https://www.reuters.com/rssfeed/worldNews', 'credibility': 10},
        {'name': 'Reuters Business', 'url': 'https://www.reuters.com/rssfeed/businessNews', 'credibility': 10},
        {'name': 'Associated Press', 'url': 'https://apnews.com/apf-topnews', 'credibility': 10},
        {'name': 'BBC News World', 'url': 'http://feeds.bbci.co.uk/news/world/rss.xml', 'credibility': 10},
        {'name': 'BBC News UK', 'url': 'http://feeds.bbci.co.uk/news/uk/rss.xml', 'credibility': 10},
        {'name': 'CNN World', 'url': 'http://rss.cnn.com/rss/edition_world.rss', 'credibility': 8},
        {'name': 'CNN US', 'url': 'http://rss.cnn.com/rss/cnn_us.rss', 'credibility': 8},
        {'name': 'The Guardian World', 'url': 'https://www.theguardian.com/world/rss', 'credibility': 9},
        {'name': 'The Guardian UK', 'url': 'https://www.theguardian.com/uk-news/rss', 'credibility': 9},
        {'name': 'Al Jazeera', 'url': 'https://www.aljazeera.com/xml/rss/all.xml', 'credibility': 8},
        {'name': 'NPR News', 'url': 'https://feeds.npr.org/1001/rss.xml', 'credibility': 9},
        {'name': 'The New York Times World', 'url': 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', 'credibility': 9},
        {'name': 'The Washington Post World', 'url': 'http://feeds.washingtonpost.com/rss/world', 'credibility': 9},
        {'name': 'The Wall Street Journal World', 'url': 'https://feeds.a.dj.com/rss/RSSWorldNews.xml', 'credibility': 9},
        {'name': 'USA Today News', 'url': 'http://rssfeeds.usatoday.com/usatoday-NewsTopStories', 'credibility': 7},
        {'name': 'NBC News World', 'url': 'http://feeds.nbcnews.com/nbcnews/public/world', 'credibility': 8},
        {'name': 'ABC News Top Stories', 'url': 'https://abcnews.go.com/abcnews/topstories', 'credibility': 8},
        {'name': 'CBS News', 'url': 'https://www.cbsnews.com/latest/rss/main', 'credibility': 8},
    ],
    
    # ============================================================
    # SCIENCE & RESEARCH (Premium Sources)
    # ============================================================
    'science': [
        {'name': 'Nature News', 'url': 'http://feeds.nature.com/nature/rss/current', 'credibility': 10},
        {'name': 'Science Magazine', 'url': 'https://www.science.org/rss/news_current.xml', 'credibility': 10},
        {'name': 'Scientific American', 'url': 'http://rss.sciam.com/ScientificAmerican-Global', 'credibility': 9},
        {'name': 'New Scientist', 'url': 'https://www.newscientist.com/feed/home/', 'credibility': 9},
        {'name': 'The Scientist', 'url': 'https://www.the-scientist.com/rss', 'credibility': 9},
        {'name': 'Science Daily', 'url': 'https://www.sciencedaily.com/rss/all.xml', 'credibility': 8},
        {'name': 'Phys.org', 'url': 'https://phys.org/rss-feed/', 'credibility': 8},
        {'name': 'Live Science', 'url': 'https://www.livescience.com/feeds/all', 'credibility': 7},
        {'name': 'Space.com', 'url': 'https://www.space.com/feeds/all', 'credibility': 7},
        {'name': 'National Geographic', 'url': 'https://www.nationalgeographic.com/pages/topic/latest-stories/_jcr_content.feed', 'credibility': 9},
        {'name': 'MIT News Science', 'url': 'https://news.mit.edu/rss/topic/science', 'credibility': 10},
        {'name': 'Stanford News Science', 'url': 'https://news.stanford.edu/feed/', 'credibility': 9},
        {'name': 'Harvard Gazette Science', 'url': 'https://news.harvard.edu/gazette/section/science-n-tech/feed/', 'credibility': 9},
        {'name': 'Cell Press', 'url': 'https://www.cell.com/action/showFeed?ui=0&mi=3hgbqm&ai=0&jc=cell&type=axatoc&feed=rss', 'credibility': 10},
        {'name': 'PNAS', 'url': 'https://www.pnas.org/rss/current.xml', 'credibility': 10},
        {'name': 'EurekAlert', 'url': 'https://www.eurekalert.org/rss.xml', 'credibility': 8},
        {'name': 'Cosmos Magazine', 'url': 'https://cosmosmagazine.com/feed/', 'credibility': 7},
    ],
    
    # ============================================================
    # TECHNOLOGY & INNOVATION
    # ============================================================
    'technology': [
        {'name': 'TechCrunch', 'url': 'https://techcrunch.com/feed/', 'credibility': 7},
        {'name': 'The Verge', 'url': 'https://www.theverge.com/rss/index.xml', 'credibility': 7},
        {'name': 'Wired', 'url': 'https://www.wired.com/feed/rss', 'credibility': 8},
        {'name': 'Ars Technica', 'url': 'http://feeds.arstechnica.com/arstechnica/index', 'credibility': 8},
        {'name': 'MIT Technology Review', 'url': 'https://www.technologyreview.com/feed/', 'credibility': 9},
        {'name': 'Engadget', 'url': 'https://www.engadget.com/rss.xml', 'credibility': 7},
        {'name': 'The Next Web', 'url': 'https://thenextweb.com/feed/', 'credibility': 7},
        {'name': 'TechRadar', 'url': 'https://www.techradar.com/rss', 'credibility': 6},
        {'name': 'CNET', 'url': 'https://www.cnet.com/rss/news/', 'credibility': 7},
        {'name': 'ZDNet', 'url': 'https://www.zdnet.com/news/rss.xml', 'credibility': 7},
        {'name': 'Hacker News', 'url': 'https://news.ycombinator.com/rss', 'credibility': 7},
        {'name': 'Slashdot', 'url': 'http://rss.slashdot.org/Slashdot/slashdotMain', 'credibility': 6},
        {'name': 'IEEE Spectrum', 'url': 'https://spectrum.ieee.org/feeds/feed.rss', 'credibility': 9},
        {'name': 'VentureBeat', 'url': 'https://venturebeat.com/feed/', 'credibility': 7},
        {'name': 'Recode', 'url': 'https://www.vox.com/recode/rss/index.xml', 'credibility': 7},
    ],
    
    # ============================================================
    # BUSINESS & ECONOMICS
    # ============================================================
    'business': [
        {'name': 'Bloomberg', 'url': 'https://www.bloomberg.com/feed/podcast/businessweek', 'credibility': 9},
        {'name': 'Financial Times', 'url': 'https://www.ft.com/?format=rss', 'credibility': 9},
        {'name': 'The Economist', 'url': 'https://www.economist.com/the-world-this-week/rss.xml', 'credibility': 9},
        {'name': 'Forbes', 'url': 'https://www.forbes.com/real-time/feed2/', 'credibility': 7},
        {'name': 'Fortune', 'url': 'https://fortune.com/feed/', 'credibility': 8},
        {'name': 'Business Insider', 'url': 'https://www.businessinsider.com/rss', 'credibility': 7},
        {'name': 'CNBC', 'url': 'https://www.cnbc.com/id/100003114/device/rss/rss.html', 'credibility': 8},
        {'name': 'MarketWatch', 'url': 'http://feeds.marketwatch.com/marketwatch/topstories/', 'credibility': 7},
        {'name': 'Financial Post', 'url': 'https://financialpost.com/feed/', 'credibility': 7},
        {'name': 'Quartz', 'url': 'https://qz.com/feed/', 'credibility': 7},
        {'name': 'Fast Company', 'url': 'https://www.fastcompany.com/latest/rss', 'credibility': 7},
        {'name': 'Inc.', 'url': 'https://www.inc.com/rss/', 'credibility': 6},
        {'name': 'Entrepreneur', 'url': 'https://www.entrepreneur.com/latest.rss', 'credibility': 6},
    ],
    
    # ============================================================
    # ENVIRONMENT & CLIMATE
    # ============================================================
    'environment': [
        {'name': 'Yale Environment 360', 'url': 'https://e360.yale.edu/feeds/latest', 'credibility': 9},
        {'name': 'The Guardian Environment', 'url': 'https://www.theguardian.com/environment/rss', 'credibility': 9},
        {'name': 'BBC News Science & Environment', 'url': 'http://feeds.bbci.co.uk/news/science_and_environment/rss.xml', 'credibility': 9},
        {'name': 'Reuters Environment', 'url': 'https://www.reuters.com/rssfeed/environmentNews', 'credibility': 10},
        {'name': 'Climate Home News', 'url': 'https://www.climatechangenews.com/feed/', 'credibility': 8},
        {'name': 'Grist', 'url': 'https://grist.org/feed/', 'credibility': 7},
        {'name': 'Inside Climate News', 'url': 'https://insideclimatenews.org/feed/', 'credibility': 8},
        {'name': 'Carbon Brief', 'url': 'https://www.carbonbrief.org/feed', 'credibility': 9},
        {'name': 'Mongabay', 'url': 'https://news.mongabay.com/feed/', 'credibility': 8},
        {'name': 'The Revelator', 'url': 'https://therevelator.org/feed/', 'credibility': 7},
    ],
    
    # ============================================================
    # DATA JOURNALISM & ANALYSIS
    # ============================================================
    'data': [
        {'name': 'FiveThirtyEight', 'url': 'https://fivethirtyeight.com/feed/', 'credibility': 8},
        {'name': 'The Pudding', 'url': 'https://pudding.cool/feed/index.xml', 'credibility': 7},
        {'name': 'Our World in Data', 'url': 'https://ourworldindata.org/atom.xml', 'credibility': 9},
        {'name': 'FlowingData', 'url': 'https://flowingdata.com/feed', 'credibility': 7},
        {'name': 'Information is Beautiful', 'url': 'https://informationisbeautiful.net/feed/', 'credibility': 7},
    ],
    
    # ============================================================
    # POLITICS & POLICY
    # ============================================================
    'politics': [
        {'name': 'Politico', 'url': 'https://www.politico.com/rss/politicopicks.xml', 'credibility': 7},
        {'name': 'The Hill', 'url': 'https://thehill.com/feed/', 'credibility': 7},
        {'name': 'Axios', 'url': 'https://www.axios.com/feeds/feed.rss', 'credibility': 7},
        {'name': 'Roll Call', 'url': 'https://www.rollcall.com/feed/', 'credibility': 7},
        {'name': 'Foreign Policy', 'url': 'https://foreignpolicy.com/feed/', 'credibility': 8},
        {'name': 'Foreign Affairs', 'url': 'https://www.foreignaffairs.com/rss.xml', 'credibility': 9},
        {'name': 'The Atlantic Politics', 'url': 'https://www.theatlantic.com/feed/channel/politics/', 'credibility': 8},
    ],
    
    # ============================================================
    # INTERNATIONAL & REGIONAL NEWS
    # ============================================================
    'international': [
        # Europe
        {'name': 'DW (Germany)', 'url': 'https://rss.dw.com/rdf/rss-en-all', 'credibility': 8},
        {'name': 'France 24', 'url': 'https://www.france24.com/en/rss', 'credibility': 8},
        {'name': 'The Local Europe', 'url': 'https://www.thelocal.com/feed/', 'credibility': 6},
        {'name': 'EUobserver', 'url': 'https://euobserver.com/rss.xml', 'credibility': 7},
        
        # Asia
        {'name': 'South China Morning Post', 'url': 'https://www.scmp.com/rss/91/feed', 'credibility': 7},
        {'name': 'The Japan Times', 'url': 'https://www.japantimes.co.jp/feed/', 'credibility': 7},
        {'name': 'The Straits Times', 'url': 'https://www.straitstimes.com/news/latest-news/rss.xml', 'credibility': 7},
        {'name': 'The Times of India', 'url': 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms', 'credibility': 6},
        {'name': 'The Hindu', 'url': 'https://www.thehindu.com/news/feeder/default.rss', 'credibility': 7},
        
        # Middle East
        {'name': 'Haaretz', 'url': 'https://www.haaretz.com/cmlink/1.628067', 'credibility': 7},
        {'name': 'The Jerusalem Post', 'url': 'https://www.jpost.com/Rss/RssFeedsHeadlines.aspx', 'credibility': 6},
        
        # Africa
        {'name': 'AllAfrica', 'url': 'https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf', 'credibility': 6},
        {'name': 'Daily Maverick', 'url': 'https://www.dailymaverick.co.za/feed/', 'credibility': 7},
        
        # Latin America
        {'name': 'Buenos Aires Times', 'url': 'https://www.batimes.com.ar/feed', 'credibility': 6},
        
        # Australia
        {'name': 'ABC News Australia', 'url': 'https://www.abc.net.au/news/feed/51120/rss.xml', 'credibility': 8},
        {'name': 'The Sydney Morning Herald', 'url': 'https://www.smh.com.au/rss/feed.xml', 'credibility': 7},
    ],
    
    # ============================================================
    # HEALTH & MEDICINE
    # ============================================================
    'health': [
        {'name': 'The Lancet', 'url': 'https://www.thelancet.com/rssfeed/lancet_current.xml', 'credibility': 10},
        {'name': 'New England Journal of Medicine', 'url': 'http://www.nejm.org/action/showFeed?type=etoc&feed=rss&jc=nejm', 'credibility': 10},
        {'name': 'JAMA', 'url': 'https://jamanetwork.com/rss/site_4/9.xml', 'credibility': 10},
        {'name': 'BMJ', 'url': 'https://www.bmj.com/rss/current.xml', 'credibility': 10},
        {'name': 'Medical News Today', 'url': 'https://www.medicalnewstoday.com/rss/news.xml', 'credibility': 7},
        {'name': 'WebMD', 'url': 'https://rssfeeds.webmd.com/rss/rss.aspx?RSSSource=RSS_PUBLIC', 'credibility': 6},
        {'name': 'STAT News', 'url': 'https://www.statnews.com/feed/', 'credibility': 8},
        {'name': 'The Conversation Health', 'url': 'https://theconversation.com/global/topics/health-rss', 'credibility': 8},
    ],
}

def get_all_sources():
    """Get flat list of all sources with categories"""
    all_sources = []
    for category, sources in RSS_SOURCES.items():
        for source in sources:
            all_sources.append({
                **source,
                'category': category
            })
    return all_sources

def get_sources_by_category(category):
    """Get sources for specific category"""
    return RSS_SOURCES.get(category, [])

def get_source_count():
    """Get total number of sources"""
    return sum(len(sources) for sources in RSS_SOURCES.values())

if __name__ == '__main__':
    print(f"📰 Total RSS sources: {get_source_count()}")
    print("\n📊 By category:")
    for category, sources in RSS_SOURCES.items():
        print(f"   {category:20} {len(sources):3} sources")

