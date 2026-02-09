#!/usr/bin/env python3
"""
Image Quality Detection System for Ten News
=============================================
Uses Google Gemini 2.0 Flash to detect poor quality news images.
Rejects: TV graphics, news anchors, watermarks, low quality, screenshots
Accepts: Clear photos of actual news events, professional photography

Cost: ~$0.0002 per image (~$1.80/month for 300 images/day)
"""

import google.generativeai as genai
import requests
from io import BytesIO
import json
import os
from typing import Dict, Optional, List
import time

# Try to import PIL, but make it optional for environments where it's not needed
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    print("⚠️  PIL not available - image quality checker will use URL-based analysis only")


class ImageQualityChecker:
    """
    Analyzes news images using Gemini 2.0 Flash to detect
    unsuitable content (TV graphics, anchors, watermarks, etc.)
    """
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize with Gemini API key"""
        self.api_key = api_key or os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not found in environment variables")
        
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel('gemini-2.0-flash')
        
        self.prompt = """Analyze this news article image and determine if it's suitable for publication on a professional news website.

REJECT if the image contains ANY of these:
- TV broadcast graphics (channel logos, chyrons, "BREAKING NEWS" banners, lower thirds with text overlays)
- News broadcasters or anchors sitting at news desks or standing in TV studios
- Generic shots of reporters with microphones in front of cameras (people COVERING the story, not IN the story)
- Large watermarks or news company logos that dominate the image (CNN, BBC, Fox News, etc.)
- Screenshots of TV news programs or broadcasts
- Very low quality, blurry, or heavily pixelated images
- Social media screenshots or meme-style images
- Generic stock photos with visible watermarks
- Just headshots of news personalities with no relevance to the story

ACCEPT if the image shows:
- Clear, high-quality photographs of actual news events, locations, or scenes
- Real people directly involved in the story (politicians, witnesses, subjects - NOT reporters covering it)
- Professional news photography of the actual subject matter
- Event photos, location photos, or action shots related to the news
- Minimal or subtle branding that doesn't dominate the image

Key distinction: A photo OF a politician speaking = ACCEPT. A photo of a news anchor TALKING ABOUT the politician = REJECT.

Respond ONLY with valid JSON format (no markdown, no code blocks):
{
    "suitable": true or false,
    "confidence": 0-100,
    "issues": ["list", "of", "specific", "problems"],
    "reason": "One sentence explanation"
}"""

    def check_image(self, image_url: str, retry_count: int = 3) -> Dict:
        """
        Check if an image is suitable for publication.
        
        Args:
            image_url: URL of the image to check
            retry_count: Number of retries if API fails
            
        Returns:
            Dict with keys: suitable, confidence, issues, reason, error
        """
        if not image_url:
            return {
                "suitable": False,
                "confidence": 0,
                "issues": ["no_image_url"],
                "reason": "No image URL provided",
                "error": True
            }
        
        for attempt in range(retry_count):
            try:
                # Download image
                response = requests.get(image_url, timeout=10, headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                })
                response.raise_for_status()
                
                # Open image with PIL if available
                if PIL_AVAILABLE:
                    img = Image.open(BytesIO(response.content))
                    
                    # Convert RGBA to RGB if needed
                    if img.mode == 'RGBA':
                        img = img.convert('RGB')
                    
                    print(f"      Image loaded: {img.size[0]}x{img.size[1]} pixels")
                    
                    # Quick dimension check - very small images are likely icons/logos
                    if img.size[0] < 100 or img.size[1] < 100:
                        return {
                            "suitable": False,
                            "confidence": 95,
                            "issues": ["too_small"],
                            "reason": f"Image too small ({img.size[0]}x{img.size[1]}px) - likely an icon or logo",
                            "error": False
                        }
                    
                    # Send to Gemini with PIL image
                    result = self.model.generate_content([self.prompt, img])
                else:
                    # Fallback: send image bytes directly
                    img_bytes = response.content
                    result = self.model.generate_content([
                        self.prompt,
                        {"mime_type": response.headers.get('content-type', 'image/jpeg'), 
                         "data": img_bytes}
                    ])
                
                # Parse response
                response_text = result.text.strip()
                
                # Remove markdown code blocks if present
                if response_text.startswith('```'):
                    lines = response_text.split('\n')
                    # Remove first and last lines (``` markers)
                    json_lines = []
                    in_block = False
                    for line in lines:
                        if line.strip().startswith('```'):
                            in_block = not in_block
                            continue
                        if in_block or not line.strip().startswith('```'):
                            json_lines.append(line)
                    response_text = '\n'.join(json_lines).strip()
                
                # Try to extract JSON from response
                # Sometimes Gemini adds text before/after JSON
                json_start = response_text.find('{')
                json_end = response_text.rfind('}')
                if json_start != -1 and json_end != -1:
                    response_text = response_text[json_start:json_end + 1]
                
                parsed = json.loads(response_text)
                
                # Validate response structure
                required_keys = ['suitable', 'confidence', 'reason']
                if not all(key in parsed for key in required_keys):
                    raise ValueError(f"Invalid response structure: missing keys from {list(parsed.keys())}")
                
                return {
                    "suitable": bool(parsed["suitable"]),
                    "confidence": int(parsed["confidence"]),
                    "issues": parsed.get("issues", []),
                    "reason": parsed["reason"],
                    "error": False
                }
                
            except requests.exceptions.RequestException as e:
                print(f"      ⚠️  Download error (attempt {attempt + 1}/{retry_count}): {str(e)[:80]}")
                if attempt == retry_count - 1:
                    return {
                        "suitable": False,
                        "confidence": 0,
                        "issues": ["download_error"],
                        "reason": f"Failed to download image: {str(e)[:100]}",
                        "error": True
                    }
                time.sleep(2)
                
            except json.JSONDecodeError as e:
                raw = result.text if 'result' in dir() else 'No response'
                print(f"      ⚠️  Parse error (attempt {attempt + 1}/{retry_count}): {str(e)[:80]}")
                print(f"      Raw response: {raw[:200]}")
                if attempt == retry_count - 1:
                    return {
                        "suitable": False,
                        "confidence": 0,
                        "issues": ["api_parse_error"],
                        "reason": "Failed to parse AI response",
                        "error": True
                    }
                time.sleep(1)
                
            except Exception as e:
                print(f"      ⚠️  Unexpected error (attempt {attempt + 1}/{retry_count}): {str(e)[:80]}")
                if attempt == retry_count - 1:
                    return {
                        "suitable": False,
                        "confidence": 0,
                        "issues": ["unknown_error"],
                        "reason": f"Error checking image: {str(e)[:100]}",
                        "error": True
                    }
                time.sleep(1)
        
        return {
            "suitable": False,
            "confidence": 0,
            "issues": ["max_retries_exceeded"],
            "reason": "Failed after maximum retries",
            "error": True
        }


def check_image_quality(image_url: str, min_confidence: int = 70) -> Dict:
    """
    Quick function to check a single image URL.
    
    Args:
        image_url: URL of the image
        min_confidence: Minimum confidence threshold (0-100)
        
    Returns:
        Dict with: suitable, confidence, issues, reason, error
    """
    checker = ImageQualityChecker()
    return checker.check_image(image_url)


def check_and_select_best_image(candidates: List[Dict], min_confidence: int = 70) -> Optional[Dict]:
    """
    Check multiple image candidates and return the best suitable one.
    Tries candidates in order of their quality_score, returns the first
    that passes the Gemini quality check.
    
    Args:
        candidates: List of dicts with 'url', 'source_name', 'quality_score'
        min_confidence: Minimum confidence threshold
        
    Returns:
        The first suitable candidate dict (with quality_check added), or None
    """
    if not candidates:
        return None
    
    # Sort by quality_score descending
    sorted_candidates = sorted(candidates, key=lambda x: x.get('quality_score', 0), reverse=True)
    
    checker = ImageQualityChecker()
    
    # Check top candidates (limit to 3 to save API costs)
    max_checks = min(3, len(sorted_candidates))
    
    for i, candidate in enumerate(sorted_candidates[:max_checks]):
        url = candidate.get('url', '')
        if not url:
            continue
            
        print(f"      🔍 Quality check {i+1}/{max_checks}: {candidate.get('source_name', 'Unknown')}")
        
        result = checker.check_image(url)
        
        # If error, skip this candidate but don't reject it outright
        if result.get("error"):
            print(f"      ⚠️  Check error, skipping: {result['reason'][:60]}")
            continue
        
        # Check if suitable
        if result["suitable"] and result["confidence"] >= min_confidence:
            print(f"      ✅ Image approved ({result['confidence']}% confidence): {result['reason'][:60]}")
            candidate['quality_check'] = result
            return candidate
        else:
            print(f"      ❌ Image rejected ({result['confidence']}% confidence): {result['reason'][:60]}")
            # Log the issues
            if result.get("issues"):
                print(f"         Issues: {', '.join(result['issues'])}")
    
    # No suitable image found
    print(f"      ❌ No suitable image found after checking {max_checks} candidates")
    return None


def check_article_image(article: Dict, min_confidence: int = 70) -> Dict:
    """
    Check if an article's image is suitable, with decision on whether to 
    generate an AI image replacement.
    
    Args:
        article: Article dict with 'image_url' key
        min_confidence: Minimum confidence threshold (0-100)
        
    Returns:
        Dict with: needs_ai_generation, reason, issues, original_url, quality_score
    """
    checker = ImageQualityChecker()
    
    image_url = article.get('image_url') or article.get('imageUrl')
    
    if not image_url:
        return {
            "needs_ai_generation": True,
            "reason": "no_image",
            "issues": [],
            "original_url": None,
            "quality_score": 0
        }
    
    result = checker.check_image(image_url)
    
    # If there was an error checking, keep original image (fail safe)
    if result.get("error"):
        print(f"      ⚠️  Error checking image, keeping original: {result['reason'][:60]}")
        return {
            "needs_ai_generation": False,
            "reason": "check_error",
            "issues": result["issues"],
            "original_url": image_url,
            "quality_score": 0,
            "error": True
        }
    
    # Decide if we need AI generation
    if not result["suitable"] or result["confidence"] < min_confidence:
        print(f"      ❌ Image rejected ({result['confidence']}% confidence): {result['reason'][:60]}")
        return {
            "needs_ai_generation": True,
            "reason": result["reason"],
            "issues": result["issues"],
            "original_url": image_url,
            "confidence": result["confidence"],
            "quality_score": 0
        }
    
    print(f"      ✅ Image approved ({result['confidence']}% confidence)")
    return {
        "needs_ai_generation": False,
        "reason": "image_approved",
        "issues": [],
        "original_url": image_url,
        "quality_score": result["confidence"]
    }


# Example usage / test
if __name__ == "__main__":
    print("🧪 Image Quality Checker - Test Mode")
    print("=" * 60)
    
    test_urls = [
        "https://example.com/test-image.jpg",  # Replace with real URLs to test
    ]
    
    checker = ImageQualityChecker()
    
    for url in test_urls:
        print(f"\nChecking: {url[:80]}...")
        result = checker.check_image(url)
        print(json.dumps(result, indent=2))
