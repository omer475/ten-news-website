// Common news source mappings to their domains
const sourceDomains = {
  'cnn': 'cnn.com',
  'bbc': 'bbc.com',
  'bbc news': 'bbc.com',
  'reuters': 'reuters.com',
  'associated press': 'apnews.com',
  'ap': 'apnews.com',
  'ap news': 'apnews.com',
  'new york times': 'nytimes.com',
  'nyt': 'nytimes.com',
  'the new york times': 'nytimes.com',
  'washington post': 'washingtonpost.com',
  'the washington post': 'washingtonpost.com',
  'guardian': 'theguardian.com',
  'the guardian': 'theguardian.com',
  'fox news': 'foxnews.com',
  'fox': 'foxnews.com',
  'nbc': 'nbcnews.com',
  'nbc news': 'nbcnews.com',
  'abc news': 'abcnews.go.com',
  'abc': 'abcnews.go.com',
  'cbs news': 'cbsnews.com',
  'cbs': 'cbsnews.com',
  'cnbc': 'cnbc.com',
  'bloomberg': 'bloomberg.com',
  'financial times': 'ft.com',
  'ft': 'ft.com',
  'wall street journal': 'wsj.com',
  'wsj': 'wsj.com',
  'the wall street journal': 'wsj.com',
  'politico': 'politico.com',
  'axios': 'axios.com',
  'the hill': 'thehill.com',
  'huffpost': 'huffpost.com',
  'huffington post': 'huffpost.com',
  'the huffington post': 'huffpost.com',
  'buzzfeed': 'buzzfeed.com',
  'buzzfeed news': 'buzzfeed.com',
  'vice': 'vice.com',
  'vice news': 'vice.com',
  'vox': 'vox.com',
  'the verge': 'theverge.com',
  'verge': 'theverge.com',
  'techcrunch': 'techcrunch.com',
  'wired': 'wired.com',
  'ars technica': 'arstechnica.com',
  'engadget': 'engadget.com',
  'mashable': 'mashable.com',
  'gizmodo': 'gizmodo.com',
  'the atlantic': 'theatlantic.com',
  'atlantic': 'theatlantic.com',
  'npr': 'npr.org',
  'pbs': 'pbs.org',
  'al jazeera': 'aljazeera.com',
  'sky news': 'news.sky.com',
  'sky': 'news.sky.com',
  'daily mail': 'dailymail.co.uk',
  'the daily mail': 'dailymail.co.uk',
  'telegraph': 'telegraph.co.uk',
  'the telegraph': 'telegraph.co.uk',
  'independent': 'independent.co.uk',
  'the independent': 'independent.co.uk',
  'times': 'thetimes.co.uk',
  'the times': 'thetimes.co.uk',
  'forbes': 'forbes.com',
  'fortune': 'fortune.com',
  'business insider': 'businessinsider.com',
  'insider': 'businessinsider.com',
  'yahoo': 'yahoo.com',
  'yahoo news': 'news.yahoo.com',
  'google news': 'news.google.com',
  'usa today': 'usatoday.com',
  'los angeles times': 'latimes.com',
  'la times': 'latimes.com',
  'chicago tribune': 'chicagotribune.com',
  'today+': 'tennews.ai',
  'tennews': 'tennews.ai',
  'time': 'time.com',
  'newsweek': 'newsweek.com',
  'economist': 'economist.com',
  'the economist': 'economist.com'
};

// Function to get source domain for logo.dev API
export const getSourceDomain = (source) => {
  if (!source) return null;

  const normalizedSource = source.toLowerCase().trim();

  // Check if we have a direct mapping
  if (sourceDomains[normalizedSource]) {
    return sourceDomains[normalizedSource];
  }

  // If source looks like a domain already, use it directly
  if (normalizedSource.includes('.')) {
    return normalizedSource;
  }

  // Try to construct a domain from the source name
  const cleanName = normalizedSource.replace(/[^a-z0-9]/g, '');
  return `${cleanName}.com`;
};

// Get logo URL from logo.dev
export const getLogoUrl = (source) => {
  const domain = getSourceDomain(source);
  if (!domain) return null;
  return `https://img.logo.dev/${domain}?token=pk_JnGAFnpEQqu1eh3MHrQM3A`;
};
