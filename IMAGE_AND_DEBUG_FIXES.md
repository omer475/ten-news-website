# Image Extraction & Component Selection Debug Fixes

## Changes Made

### 1. ✅ Image URL Extraction from RSS Feeds

**Problem:** Articles were showing "⚠️ No images found in any source" because the RSS fetcher wasn't extracting image URLs.

**Solution:** Added comprehensive image extraction logic to `complete_clustered_8step_workflow.py` (Step 0):

**File:** `complete_clustered_8step_workflow.py`
- **Lines 119-145:** Added image URL extraction from multiple RSS formats:
  - `media:content` (most common in news RSS)
  - `media:thumbnail` (fallback)
  - `enclosures` (podcasts, some news sites)
  - `links` array (alternative format)
- **Line 156:** Added `image_url` to article data structure

**File:** `step1_5_event_clustering.py`
- **Line 351:** Added `image_url` field when saving articles to `source_articles` table

**Database Migration:** Created `add_image_url_to_source_articles.sql`
- Adds `image_url TEXT` column to `source_articles` table
- Adds index for faster queries on images

### 2. ✅ Component Selection Debug Logging

**Problem:** Component selection consistently returned "none" with no visibility into why.

**Solution:** Added comprehensive debug logging to `step5_gemini_component_selection.py`:

**File:** `step5_gemini_component_selection.py`
- **Lines 298-302:** Debug log showing:
  - Article title (first 80 chars)
  - Content length sent to Gemini
  - Raw Gemini response (first 300 chars)
- **Lines 311-315:** Debug log showing:
  - Validated component list
  - Warning if Gemini returned zero components

## What to Do Next

### Step 1: Apply Database Migration

Run this SQL in your Supabase SQL Editor:

```bash
cd "/Users/omersogancioglu/Ten news website "
cat add_image_url_to_source_articles.sql
```

Copy the SQL and run it in Supabase. You should see output like:

```
column_name | data_type | is_nullable
------------|-----------|------------
image_url   | text      | YES
```

### Step 2: Run the System with Debug Logging

```bash
cd "/Users/omersogancioglu/Ten news website " && ./RUN_LIVE_CLUSTERED_SYSTEM.sh
```

### Step 3: Observe the Changes

**For Images (Step 3):**
Look for output like:
```
📸 STEP 3: SMART IMAGE SELECTION
   Selecting best image from 2 sources...
   
   📸 IMAGE SELECTION:
      Total candidates: 2
      Valid candidates: 2
      ✅ Selected: The New York Times (score: 75.3)
```

Instead of:
```
   ⚠️  No images found in any source
```

**For Component Selection (Step 5):**
Look for output like:
```
🔍 STEP 5: COMPONENT SELECTION & PERPLEXITY SEARCH

   🔍 DEBUG - Gemini Raw Response:
      Title: Tech Stocks Face Volatility Amid AI Market Uncertainty...
      Content length sent: 847 chars
      Gemini returned: {"components": ["details", "graph"], "emoji": "📈", "graph_type": "line"}
      Validated components: ['details', 'graph']
```

This will show you EXACTLY what Gemini is returning and help diagnose the "none" issue.

## Expected Outcomes

### After Fix 1 (Image Extraction):
- ✅ Articles should have images from RSS feeds
- ✅ Step 3 will show candidates and select the best one
- ✅ Images should appear on tennews.ai

### After Fix 2 (Debug Logging):
- ✅ Console shows raw Gemini responses
- ✅ We can see if Gemini returns empty arrays or if validation fails
- ✅ Next steps will be clear based on debug output

## Files Changed

1. `complete_clustered_8step_workflow.py` - Added image extraction in RSS fetcher
2. `step1_5_event_clustering.py` - Added image_url when saving to database
3. `step5_gemini_component_selection.py` - Added debug logging
4. `add_image_url_to_source_articles.sql` - Database migration (NEW FILE)
5. `IMAGE_AND_DEBUG_FIXES.md` - This documentation (NEW FILE)

## Troubleshooting

### If images still don't appear:
1. Check if RSS feeds actually contain images (not all do)
2. Look at the debug output in Step 3 to see if candidates were found
3. Check Supabase `source_articles` table - `image_url` column should have values

### If components are still "none":
1. Check the debug output to see what Gemini is actually returning
2. If Gemini returns `{"components": []}`, the prompt may need adjustment
3. If JSON parsing fails, the response format may be incorrect

## Next Steps After Testing

Based on the debug output, we may need to:
1. Adjust the Gemini prompt to be more generous with component selection
2. Increase the content length sent to Gemini (currently 1000 chars)
3. Add fallback logic for specific article types

**The debug logging will tell us exactly what needs to be fixed! 🔍**

