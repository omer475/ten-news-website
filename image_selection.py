"""
Smart Image Selection for Clustered Articles
Selects the best image from multiple sources using rule-based scoring
"""

from typing import List, Dict, Optional
from urllib.parse import urlparse
import re

# Premium news sources with typically high-quality images
PREMIUM_SOURCES = {
    'nyt', 'nytimes', 'new york times',
    'bbc', 'british broadcasting',
    'reuters', 'associated press', 'ap news',
    'financial times', 'ft.com',
    'wall street journal', 'wsj',
    'guardian', 'theguardian',
    'washington post', 'washingtonpost',
    'bloomberg', 'cnbc', 'cnn',
    'economist', 'atlantic', 'wired'
}

MAJOR_SOURCES = {
    'forbes', 'fortune', 'techcrunch', 'verge',
    'business insider', 'axios', 'politico',
    'npr', 'pbs', 'abc news', 'nbc news',
    'usa today', 'time', 'newsweek'
}

# Domains to exclude (ads, tracking pixels, logos)
BLACKLISTED_DOMAINS = {
    'doubleclick.net', 'googlesyndication.com', 'ads.', 'adserver',
    'pixel.', 'tracker.', 'analytics.', 'facebook.com/tr',
    'twitter.com/i/jot', 'logo.', 'icon.'
}

# Image formats
PREFERRED_FORMATS = {'jpg', 'jpeg', 'webp', 'png'}
EXCLUDED_FORMATS = {'gif', 'svg', 'ico', 'bmp'}


class ImageSelector:
    """
    Selects the best image from multiple source articles
    using multi-factor scoring
    """
    
    def __init__(self):
        self.debug = True  # Set to False in production
    
    def select_best_image(self, sources: List[Dict], article_title: str = "") -> Optional[Dict]:
        """
        Select the best image from source articles
        
        Args:
            sources: List of source articles with metadata
            article_title: Synthesized article title (for future relevance check)
        
        Returns:
            Dict with {url, source_name, score} or None if no good images
        """
        if not sources:
            return None
        
        # Collect all candidate images
        candidates = []
        for source in sources:
            image_url = source.get('image_url') or source.get('urlToImage')
            if not image_url:
                continue
            
            candidates.append({
                'url': image_url,
                'source_name': source.get('source_name', source.get('source', 'Unknown')),
                'source_url': source.get('url', ''),
                'article_score': source.get('score', 50),  # Gemini score
                'width': source.get('image_width', 0),
                'height': source.get('image_height', 0)
            })
        
        if not candidates:
            if self.debug:
                print("⚠️  No images found in any source")
            return None
        
        # Filter and score candidates
        valid_candidates = []
        for candidate in candidates:
            # Apply filters
            if not self._is_valid_image(candidate):
                continue
            
            # Calculate score
            score = self._calculate_image_score(candidate)
            candidate['quality_score'] = score
            valid_candidates.append(candidate)
        
        if not valid_candidates:
            if self.debug:
                print("⚠️  All images filtered out (quality/size issues)")
            return None
        
        # Sort by score and return best
        valid_candidates.sort(key=lambda x: x['quality_score'], reverse=True)
        best = valid_candidates[0]
        
        if self.debug:
            print(f"\n📸 IMAGE SELECTION:")
            print(f"   Total candidates: {len(candidates)}")
            print(f"   Valid candidates: {len(valid_candidates)}")
            print(f"   ✅ Selected: {best['source_name']} (score: {best['quality_score']:.1f})")
            if len(valid_candidates) > 1:
                print(f"   Runner-up: {valid_candidates[1]['source_name']} (score: {valid_candidates[1]['quality_score']:.1f})")
        
        return {
            'url': best['url'],
            'source_name': best['source_name'],
            'quality_score': best['quality_score']
        }
    
    def _is_valid_image(self, candidate: Dict) -> bool:
        """
        Filter out invalid/low-quality images
        """
        url = candidate['url']
        
        # Check URL exists
        if not url or len(url) < 10:
            return False
        
        # Check blacklisted domains
        try:
            domain = urlparse(url).netloc.lower()
            for blacklisted in BLACKLISTED_DOMAINS:
                if blacklisted in domain:
                    if self.debug:
                        print(f"   ❌ Filtered (blacklisted domain): {domain}")
                    return False
        except:
            return False
        
        # Check file extension
        url_lower = url.lower()
        extension = url_lower.split('.')[-1].split('?')[0]  # Handle query params
        
        if extension in EXCLUDED_FORMATS:
            if self.debug:
                print(f"   ❌ Filtered (bad format): {extension}")
            return False
        
        # Check dimensions if available
        width = candidate.get('width', 0)
        height = candidate.get('height', 0)
        
        # If we have dimensions, enforce minimum size
        if width > 0 and height > 0:
            if width < 400 or height < 300:
                if self.debug:
                    print(f"   ❌ Filtered (too small): {width}x{height}px")
                return False
            
            # Check aspect ratio (avoid extreme ratios)
            aspect_ratio = width / height if height > 0 else 0
            if aspect_ratio > 3 or aspect_ratio < 0.33:
                if self.debug:
                    print(f"   ❌ Filtered (extreme aspect): {aspect_ratio:.2f}")
                return False
        
        return True
    
    def _calculate_image_score(self, candidate: Dict) -> float:
        """
        Calculate quality score for an image (0-100)
        """
        score = 0.0
        
        # Factor 1: Source Reputation (30 points)
        source_name = candidate['source_name'].lower()
        
        if any(premium in source_name for premium in PREMIUM_SOURCES):
            score += 30
        elif any(major in source_name for major in MAJOR_SOURCES):
            score += 15
        
        # Factor 2: Article Score (20 points)
        # Gemini score is 70-100, normalize to 0-20
        article_score = candidate.get('article_score', 70)
        normalized = ((article_score - 70) / 30) * 20  # 70-100 → 0-20
        score += max(0, min(20, normalized))
        
        # Factor 3: Image Dimensions (30 points)
        width = candidate.get('width', 0)
        height = candidate.get('height', 0)
        
        if width >= 1200:
            score += 30
        elif width >= 800:
            score += 20
        elif width >= 600:
            score += 10
        elif width > 0:  # Has dimensions but small
            score += 5
        else:
            # No dimension data - assume medium quality
            score += 15
        
        # Factor 4: Aspect Ratio (20 points)
        if width > 0 and height > 0:
            aspect_ratio = width / height
            
            # 16:9 ideal (1.78)
            if 1.7 <= aspect_ratio <= 1.85:
                score += 20
            # 4:3 or 3:2 (1.33 or 1.5)
            elif 1.2 <= aspect_ratio <= 1.6:
                score += 15
            # Slightly wide
            elif 1.6 < aspect_ratio <= 2.0:
                score += 12
            # Acceptable
            elif 1.0 <= aspect_ratio < 1.2:
                score += 10
        else:
            # No dimension data - neutral score
            score += 10
        
        # Bonus: Image Format (5 points)
        url = candidate['url'].lower()
        if '.webp' in url:
            score += 5
        elif '.jpg' in url or '.jpeg' in url:
            score += 5
        elif '.png' in url:
            score += 3
        
        return score


# Standalone function for easy import
def select_best_image(sources: List[Dict], article_title: str = "") -> Optional[Dict]:
    """
    Convenience function to select best image
    
    Returns:
        Dict with {url, source_name, quality_score} or None
    """
    selector = ImageSelector()
    return selector.select_best_image(sources, article_title)


if __name__ == "__main__":
    # Test with sample data
    test_sources = [
        {
            'source_name': 'TechCrunch',
            'image_url': 'https://techcrunch.com/wp-content/uploads/2025/11/ai-chip.jpg',
            'score': 85,
            'width': 1200,
            'height': 675
        },
        {
            'source_name': 'The New York Times',
            'image_url': 'https://nytimes.com/images/2025/11/20/business/tech-ai/tech-ai-articleLarge.jpg',
            'score': 92,
            'width': 600,
            'height': 400
        },
        {
            'source_name': 'Unknown Blog',
            'image_url': 'https://example.com/small-logo.png',
            'score': 70,
            'width': 200,
            'height': 200
        }
    ]
    
    result = select_best_image(test_sources, "AI Chip Breakthrough")
    if result:
        print(f"\n✅ Selected: {result['source_name']}")
        print(f"   URL: {result['url']}")
        print(f"   Score: {result['quality_score']:.1f}/100")
    else:
        print("\n❌ No suitable image found")

