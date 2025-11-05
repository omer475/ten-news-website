<!-- 14921fff-a9e4-4999-82c0-505965ba58fc 1f9743e9-fbc1-4b47-85bf-e8dc11f884fb -->
# Fix Image Loading with URL Normalization

## Problem

Some images aren't loading even though URLs exist in Supabase. This is because:

- Many URLs are stored as protocol-relative (`//example.com/image.jpg`)
- Some URLs are missing protocols (`example.com/image.jpg`)
- Without normalization, browsers can't load these URLs

## Solution

Add URL normalization in both the API (server-side) and frontend (client-side) to ensure all URLs are properly formatted before being used.

## Changes Required

### File 1: `pages/api/news-supabase.js`

**Location:** Around line 83-103 (in the urlToImage mapping)

**Add normalization function before the urlToImage mapping:**

```javascript
// Normalize image URLs to ensure they're valid
const normalizeImageUrl = (url) => {
  if (!url) return null;
  let normalized = String(url).trim();
  
  // Normalize protocol-relative URLs (starting with //)
  if (normalized.startsWith('//')) {
    normalized = 'https:' + normalized;
  }
  
  // Normalize URLs missing protocol
  if (!normalized.startsWith('http://') && 
      !normalized.startsWith('https://') && 
      !normalized.startsWith('data:') && 
      !normalized.startsWith('blob:')) {
    // Check if it looks like an absolute URL (domain pattern)
    if (/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}/.test(normalized)) {
      normalized = 'https://' + normalized;
    }
  }
  
  return normalized;
};
```

**Update the urlToImage mapping to use normalization:**

- After validating the URL, call `normalizeImageUrl(urlStr)` before returning

### File 2: `pages/index.js`

**Location:** Around line 2498-2525 (in the image rendering logic)

**Add normalization function inside the IIFE:**

```javascript
{(() => {
  // URL normalization function
  const normalizeImageUrl = (url) => {
    if (!url) return null;
    let normalized = String(url).trim();
    
    // Normalize protocol-relative URLs (starting with //)
    if (normalized.startsWith('//')) {
      normalized = 'https:' + normalized;
      console.log(`🔧 Normalized protocol-relative URL: ${normalized.substring(0, 80)}...`);
    }
    
    // Normalize URLs missing protocol
    if (!normalized.startsWith('http://') && 
        !normalized.startsWith('https://') && 
        !normalized.startsWith('data:') && 
        !normalized.startsWith('blob:')) {
      // Check if it looks like an absolute URL (domain pattern)
      if (/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}/.test(normalized)) {
        normalized = 'https://' + normalized;
        console.log(`🔧 Added https:// to URL: ${normalized.substring(0, 80)}...`);
      }
    }
    
    return normalized;
  };
  
  // ... rest of the code
  const imageUrl = normalizeImageUrl(story.urlToImage);
  // ... use normalized imageUrl
})()}
```

**Update the imageUrl assignment:**

- Change `const imageUrl = String(story.urlToImage).trim();` to use the normalization function

## Expected Results

- Protocol-relative URLs (`//example.com/image.jpg`) → `https://example.com/image.jpg`
- URLs without protocol (`example.com/image.jpg`) → `https://example.com/image.jpg`
- Valid URLs remain unchanged
- All valid image URLs from Supabase will load properly

### To-dos

- [ ] Add URL normalization function to pages/api/news-supabase.js and apply it to urlToImage mapping
- [ ] Add URL normalization function to pages/index.js image rendering logic and apply it before using imageUrl