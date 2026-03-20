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
        
        self.prompt = """Analyze this news article image for a professional English-language news app. Determine if it's clean and suitable.

REJECT if ANY of these apply:
- Text burned into the image: headlines, captions, news tickers, or any readable text overlaid on the photo (especially non-English text like Russian, Arabic, Chinese, etc.)
- TV broadcast screenshot with chyrons, banners, lower thirds, tickers, or news desk visible
- News anchors/presenters in TV studios
- The image is primarily a logo/brand with no real photo content
- Dark/black placeholder images or solid color backgrounds
- Very low quality, extremely blurry, or heavily pixelated
- Image has graphics, arrows, circles, or editorial annotations drawn on it
- Screenshot of a website, social media post, or another news article
- Image has a large visible watermark that covers a significant area (more than a small corner)

ACCEPT only if ALL of these are true:
- It is a clean photograph of a real scene, person, place, event, or object
- The photo is NOT obscured by text overlays, headlines, or captions burned into the image
- A small corner watermark or credit line (AP, Reuters, AFP, Getty) is fine — but large text across the image is NOT
- The photo is reasonably sharp and well-lit
- Charts, graphs, and infographics with English text are acceptable

KEY RULE: The image must look like a clean editorial photograph. If there is ANY readable text overlay burned into the photo (headlines, titles, captions in any language), REJECT it. A small agency credit in a corner is okay, but text covering the image is not.

Respond ONLY with valid JSON (no markdown, no code blocks):
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

                    # Downscale very large images to save memory (e.g. 11314x6366 = 216MB)
                    max_dim = 2000
                    if img.size[0] > max_dim or img.size[1] > max_dim:
                        img.thumbnail((max_dim, max_dim), Image.LANCZOS)
                    
                    # Quick dimension check - very small images are likely icons/logos
                    if img.size[0] < 100 or img.size[1] < 100:
                        result = {
                            "suitable": False,
                            "confidence": 95,
                            "issues": ["too_small"],
                            "reason": f"Image too small ({img.size[0]}x{img.size[1]}px) - likely an icon or logo",
                            "error": False
                        }
                        img.close()
                        return result

                    # Quick pixel analysis to catch dark/monotone placeholder images
                    try:
                        # Sample pixels from a resized thumbnail for speed
                        thumb = img.copy()
                        thumb.thumbnail((50, 50))
                        pixels = list(thumb.getdata())
                        if pixels:
                            # Check if image is predominantly very dark
                            dark_count = sum(1 for r, g, b in pixels if r < 40 and g < 40 and b < 40)
                            dark_ratio = dark_count / len(pixels)
                            if dark_ratio > 0.70:
                                # Check color variance — real dark photos have more variance
                                avg_r = sum(p[0] for p in pixels) / len(pixels)
                                avg_g = sum(p[1] for p in pixels) / len(pixels)
                                avg_b = sum(p[2] for p in pixels) / len(pixels)
                                variance = sum(
                                    (p[0] - avg_r)**2 + (p[1] - avg_g)**2 + (p[2] - avg_b)**2
                                    for p in pixels
                                ) / len(pixels)
                                if variance < 2000:
                                    print(f"      ❌ Dark/monotone placeholder detected ({dark_ratio:.0%} dark, variance: {variance:.0f})")
                                    img.close()
                                    return {
                                        "suitable": False,
                                        "confidence": 92,
                                        "issues": ["dark_placeholder"],
                                        "reason": f"Dark/monotone image ({dark_ratio:.0%} dark pixels) - likely a placeholder or category header",
                                        "error": False
                                    }

                            # Check if image is predominantly a single solid color
                            avg_color = (int(avg_r) if 'avg_r' in dir() else sum(p[0] for p in pixels) // len(pixels),
                                        int(avg_g) if 'avg_g' in dir() else sum(p[1] for p in pixels) // len(pixels),
                                        int(avg_b) if 'avg_b' in dir() else sum(p[2] for p in pixels) // len(pixels))
                            near_avg = sum(1 for p in pixels
                                         if abs(p[0] - avg_color[0]) < 25
                                         and abs(p[1] - avg_color[1]) < 25
                                         and abs(p[2] - avg_color[2]) < 25)
                            solid_ratio = near_avg / len(pixels)
                            if solid_ratio > 0.85:
                                print(f"      ❌ Solid color image detected ({solid_ratio:.0%} uniform)")
                                img.close()
                                return {
                                    "suitable": False,
                                    "confidence": 90,
                                    "issues": ["solid_color_placeholder"],
                                    "reason": f"Solid/uniform color image ({solid_ratio:.0%} same color) - likely a placeholder",
                                    "error": False
                                }
                    except Exception as e:
                        print(f"      ⚠️  Pixel analysis skipped: {str(e)[:60]}")

                    # Send to Gemini with PIL image
                    result = self.model.generate_content([self.prompt, img])
                    # Free PIL image memory immediately after Gemini call
                    img.close()
                    del img
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

        # Hotlink protection check: fetch without Referer to simulate how the app loads images
        try:
            head_resp = requests.head(url, timeout=5, allow_redirects=True, headers={
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'
            })
            if head_resp.status_code in (403, 410, 451):
                print(f"      ❌ Image blocked by hotlink protection (HTTP {head_resp.status_code})")
                continue
        except requests.exceptions.RequestException:
            pass  # If HEAD fails, still try the full check

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
