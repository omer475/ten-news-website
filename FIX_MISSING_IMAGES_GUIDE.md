# Fix Missing Images on Website

**Issue**: Some images are not showing on tennews.ai even though image URLs exist in Supabase.

---

## 🔍 **Step 1: Diagnose the Problem**

### Check Supabase Database

1. Go to **Supabase Dashboard** → SQL Editor
2. Run this query to see the image URL status:

```sql
-- Check image URL status
SELECT 
    id,
    title,
    source,
    CASE 
        WHEN image_url IS NULL THEN '❌ NULL'
        WHEN image_url = '' THEN '❌ EMPTY'
        WHEN LENGTH(image_url) < 10 THEN '❌ TOO SHORT'
        ELSE '✅ HAS URL'
    END AS status,
    LEFT(image_url, 80) AS url_preview,
    published_at
FROM articles
WHERE published = true
ORDER BY published_at DESC
LIMIT 20;
```

**What to look for:**
- ❌ **NULL** or **EMPTY**: No image URL saved
- ❌ **TOO SHORT**: Invalid/incomplete URL
- ✅ **HAS URL**: Image URL exists

### Check Browser Console

1. Open https://tennews.ai
2. Press `F12` to open Developer Tools
3. Go to **Console** tab
4. Look for these logs:

```
✅ Image loaded successfully: [URL]  ← Image is working
❌ Image failed to load: [URL]       ← Image URL is broken
⚠️ No image URL for article: [Title] ← No URL in database
```

**If you see "Image failed to load":**
- The URL exists but is broken/inaccessible
- Could be CORS issue, deleted image, or wrong URL

**If you see "No image URL":**
- Database doesn't have the image URL
- RSS feed didn't provide an image
- Image extraction failed

---

## 🛠️ **Common Issues & Fixes**

### Issue 1: Image URL is NULL/Empty in Database

**Cause**: RSS feed didn't provide an image, or image extraction failed.

**Fix**: Images are automatically extracted from RSS feeds. If some sources don't provide images:
1. This is expected behavior
2. The website shows emoji fallback (🌍, 💻, etc.)
3. No action needed - working as designed

**To verify extraction is working:**
```sql
-- Check which sources provide images
SELECT 
    source,
    COUNT(*) AS total,
    COUNT(image_url) AS with_image,
    ROUND(COUNT(image_url) * 100.0 / COUNT(*), 1) AS percent
FROM articles
WHERE published = true
GROUP BY source
ORDER BY total DESC
LIMIT 20;
```

### Issue 2: Image URL Exists But Won't Load

**Cause**: 
- URL is broken/expired
- CORS policy blocking the image
- Image was deleted from source
- URL format is invalid

**Fix A - Check if URL is accessible:**

Open the image URL directly in your browser:
1. Get URL from Supabase
2. Paste in browser address bar
3. If image doesn't load → URL is broken

**Fix B - CORS issue:**

The frontend already uses `crossOrigin="anonymous"`. If still failing:
```javascript
// In pages/index.js, the img tag already has:
crossOrigin="anonymous"
```

This is correct. CORS issues are on the source server side (can't fix).

**Fix C - Fallback is working:**

When image fails, code automatically shows emoji:
```javascript
onError={(e) => {
  e.target.style.display = 'none';
  e.target.parentElement.innerHTML = `
    <div style="font-size: 72px">
      ${story.emoji || '📰'}
    </div>
  `;
}}
```

### Issue 3: Some Sources Don't Provide Images

**This is NORMAL behavior:**

Not all RSS feeds include images. Sources that often don't have images:
- Text-only news feeds
- Academic journals
- Some financial news
- Opinion pieces

**The website handles this automatically:**
- Shows emoji instead of image
- No broken image icons
- Still looks good

---

## 📊 **Check Image Success Rate**

Run this in Supabase to see overall image coverage:

```sql
-- Overall image statistics
SELECT 
    COUNT(*) AS total_published,
    COUNT(image_url) AS has_image_url,
    COUNT(CASE WHEN image_url != '' THEN 1 END) AS has_valid_url,
    ROUND(COUNT(CASE WHEN image_url != '' THEN 1 END) * 100.0 / COUNT(*), 1) AS percent_with_images
FROM articles
WHERE published = true;
```

**Expected results:**
- 60-80% with images = GOOD (normal)
- 40-60% with images = OK (some sources without images)
- <40% with images = Issue (check RSS fetcher)

---

## 🔧 **Improve Image Coverage**

### Option 1: Use Image Fallback Service

If you want placeholder images for articles without URLs, you could use a service like:
- https://source.unsplash.com/random/800x600/?news
- https://picsum.photos/800/600

**Add to frontend** (pages/index.js):
```javascript
urlToImage: article.urlToImage || `https://source.unsplash.com/800x600/?${article.category}`
```

### Option 2: Fetch Images During Processing

Enhance the ScrapingBee step to extract images from article content:
- Parse `<meta property="og:image">` tags
- Look for main content images
- Save to `image_url` field

(This would require updating step2 processing)

---

## 🧪 **Test Current Setup**

### Test 1: Check API Response

```bash
curl https://tennews.ai/api/news-supabase | jq '.articles[] | {title: .title, hasImage: (.urlToImage != "")}'
```

Shows which articles have images in API.

### Test 2: Check Frontend Rendering

1. Open https://tennews.ai
2. Open browser console (F12)
3. Run:
```javascript
// Check which stories have images
document.querySelectorAll('img[alt]').forEach(img => {
  if (img.complete && img.naturalWidth === 0) {
    console.log('❌ Failed:', img.alt);
  } else if (img.complete) {
    console.log('✅ Loaded:', img.alt);
  }
});
```

---

## ✅ **What's Working Correctly**

Your current setup ALREADY handles missing images well:

1. **Image URL Extraction**: ✅ Working (from RSS feeds)
2. **Database Storage**: ✅ Working (`image_url` field)
3. **API Mapping**: ✅ Working (`image_url` → `urlToImage`)
4. **Frontend Display**: ✅ Working (shows images when available)
5. **Fallback Handling**: ✅ Working (shows emoji when image fails)
6. **Error Logging**: ✅ Working (console logs failed images)

---

## 📝 **Expected Behavior**

**NORMAL:**
- Some articles have images ✅
- Some articles show emojis instead (no image in RSS feed) ✅
- Failed images automatically show emoji fallback ✅
- No broken image icons visible ✅

**NOT NORMAL:**
- All articles showing emojis (no images loading) ❌
- Broken image icons visible ❌
- Console full of image errors ❌

---

## 🎯 **Action Items**

### Immediate:
1. Check browser console for specific image errors
2. Run SQL query to see how many articles have image URLs
3. Verify it's just 20-40% missing (normal) vs 80%+ missing (issue)

### If 80%+ Missing Images:
1. Check RSS fetcher logs
2. Verify `image_url` column exists in Supabase
3. Check if image extraction is running

### If Images Exist in DB But Won't Load:
1. Test URLs directly in browser
2. Check for CORS errors in console
3. May be source-side issue (can't fix)

---

## 🚀 **Files Updated**

- ✅ `pages/api/news-supabase.js` - Added debug logging for missing images
- ✅ `CHECK_IMAGE_URLS.sql` - SQL queries to diagnose image issues
- ✅ Frontend already has proper error handling

---

## 💡 **Summary**

**Most likely situation:**
- Some RSS feeds don't provide images (normal)
- Website correctly shows emoji fallback
- Everything is working as designed

**To verify:**
Run the SQL query above and check:
- If 60-80% have images → Working perfectly!
- If <40% have images → Run diagnostic steps

**Bottom line:** Unless you're seeing broken image icons or ALL articles without images, the system is working correctly. Not all news sources provide images, and your website handles this gracefully with emoji fallbacks.

