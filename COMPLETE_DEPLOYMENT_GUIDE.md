# 🚀 COMPLETE DEPLOYMENT GUIDE - Railway.app + Supabase Storage

## 📋 OVERVIEW

This guide will help you:
1. ✅ Set up Supabase database for article storage
2. ✅ Deploy news generation to Railway.app (runs 24/7)
3. ✅ Connect everything together

**Time needed:** 30-45 minutes
**Cost:** ~$8-15/month (Railway) + $0-25/month (Supabase, optional)

---

## 🗄️ PART 1: SUPABASE DATABASE SETUP (15 minutes)

### Step 1: Access Supabase Dashboard

1. Go to https://supabase.com
2. Sign in (you already have an account for auth)
3. Select your project: **Ten News Website**

### Step 2: Create Articles Table

1. In Supabase dashboard, click **"SQL Editor"** in left sidebar
2. Click **"New Query"**
3. Open the file `supabase-news-schema.sql` in your project
4. Copy ALL the SQL code
5. Paste into Supabase SQL Editor
6. Click **"Run"** (bottom right)
7. Wait ~10 seconds
8. You should see: ✅ "Success. No rows returned"

**What this does:**
- Creates `articles` table
- Sets up indexes for fast queries
- Creates helper functions
- Enables public read access

### Step 3: Get Supabase Credentials

1. In Supabase dashboard, click **"Settings"** (gear icon, bottom left)
2. Click **"API"**
3. Copy these two values:

```
Project URL: https://xxxxx.supabase.co
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**⚠️ IMPORTANT:** 
- Use `service_role` key (NOT `anon` key)
- `service_role` allows writing to database
- Keep it secret!

### Step 4: Test Database (Optional)

1. In SQL Editor, run this test query:

```sql
SELECT COUNT(*) FROM articles;
```

2. Should return: `0` (table is empty, ready to use)

**✅ Supabase setup complete!**

---

## 🚂 PART 2: RAILWAY.APP DEPLOYMENT (20 minutes)

### Step 1: Create Railway Account

1. Go to https://railway.app
2. Click **"Login"**
3. Select **"Login with GitHub"**
4. Authorize Railway to access your GitHub repositories
5. You'll see Railway dashboard

### Step 2: Create New Project

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Find and select: **`ten-news-website`**
4. Click **"Deploy Now"**

Railway will:
- Clone your repository
- Detect Python
- Install dependencies from `requirements.txt`
- This takes ~2-3 minutes

### Step 3: Configure Environment Variables

**Critical step - Add your API keys!**

1. In Railway project dashboard, click **"Variables"** tab
2. Click **"+ New Variable"**
3. Add these one by one:

```
NEWSAPI_KEY = your-newsapi-key-here
CLAUDE_API_KEY = sk-ant-api03-xxxxx
GOOGLE_API_KEY = AIzaSyxxxxxxx
PERPLEXITY_API_KEY = pplx-xxxxxxx
SUPABASE_URL = https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**How to add each:**
- Click "+ New Variable"
- Enter name (e.g., `NEWSAPI_KEY`)
- Enter value
- Click "Add"
- Repeat for all 6 variables

**⚠️ Double-check:**
- No quotes around values
- No spaces
- Copy-paste to avoid typos

### Step 4: Set Up Services (Cron Jobs)

Railway detected your `Procfile` which defines two services:
- `part1` - Breaking news generator
- `part2` - Global news generator

**Configure Part 1 (Breaking News):**

1. In Railway dashboard, click on **`part1`** service
2. Click **"Settings"** tab
3. Scroll to **"Cron Schedule"**
4. Enter: `*/5 * * * *`
   - This means: "Every 5 minutes"
5. Click **"Save"**

**Configure Part 2 (Global News):**

1. Click on **`part2`** service (use service switcher at top)
2. Click **"Settings"** tab
3. Scroll to **"Cron Schedule"**
4. Enter: `*/50 * * * *`
   - This means: "Every 50 minutes"
5. Click **"Save"**

**⚠️ Note:** Railway cron jobs run in the background. They won't show as "running" unless it's actually executing.

### Step 5: Deploy Services

1. Click **"Deploy"** button (top right)
2. Railway will restart services with new configuration
3. Wait ~2 minutes for deployment

**Both services are now scheduled!**

---

## 📊 PART 3: VERIFY EVERYTHING WORKS (10 minutes)

### Test 1: Check Railway Logs

1. In Railway dashboard, click **`part1`** service
2. Click **"Logs"** tab
3. Wait for next 5-minute mark (e.g., if it's 14:23, wait until 14:25)
4. You should see logs appear:

```
🔴 PART 1: BREAKING NEWS GENERATOR
⏰ Thursday, October 09, 2025 at 14:25 BST
Fetching articles from 12 sources...
✅ Found 87 articles
Smart deduplication...
✅ Reduced to 73 unique articles
```

5. Repeat for `part2` service (waits until next 50-minute mark)

**If you see logs → ✅ It's working!**

### Test 2: Check Supabase Database

1. Go to Supabase dashboard
2. Click **"Table Editor"** (left sidebar)
3. Select **"articles"** table
4. You should see articles appearing!

**If you see articles → ✅ Storage is working!**

### Test 3: Check Your Website

1. Go to your website: https://your-site.vercel.app
2. Refresh the page
3. You should see new articles appearing

**Troubleshooting:**
- If articles in Supabase but not on website → Update your website API to fetch from Supabase
- I'll create that API endpoint next!

---

## 🌐 PART 4: UPDATE WEBSITE TO USE SUPABASE (Optional)

Create or update `/pages/api/news-live.js`:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  try {
    // Fetch top 50 articles by score
    const { data, error } = await supabase
      .rpc('get_top_articles', { limit_count: 50 })
    
    if (error) throw error
    
    // Format for your existing frontend
    const formatted = {
      generatedAt: new Date().toISOString(),
      displayTimestamp: new Date().toLocaleString(),
      totalArticles: data.length,
      articles: data.map(article => ({
        title: article.title,
        summary: article.summary,
        url: article.url,
        image: article.image_url,
        source: article.source,
        category: article.category,
        emoji: article.emoji,
        final_score: article.final_score,
        details: JSON.parse(article.details || '[]'),
        timeline: JSON.parse(article.timeline || '[]'),
        citations: JSON.parse(article.citations || '[]'),
        publishedAt: article.published_at
      }))
    }
    
    res.status(200).json(formatted)
  } catch (error) {
    console.error('Error fetching articles:', error)
    res.status(500).json({ error: 'Failed to fetch articles' })
  }
}
```

**Then update your frontend to use this endpoint:**
- Your existing code already fetches from `/api/news`
- Just rename the file or change the fetch URL

---

## 💰 COST BREAKDOWN

### Railway.app:
- **Free Tier:** $5/month credits
- **Your usage:** ~$8-12/month
- **What you get:** 24/7 execution, cron jobs, logs, metrics

### Supabase:
- **Free Tier:** 500MB database, 2GB bandwidth
- **Likely sufficient for:** ~50,000-100,000 articles
- **Pro Tier:** $25/month (if you exceed free tier)

### Total Monthly Cost:
- **Minimum:** $8/month (Railway only, use free Supabase)
- **With Pro Supabase:** $33/month

---

## 🎯 MONITORING & MAINTENANCE

### Daily Checks (5 minutes):

1. **Railway Logs:**
   - Check for errors in part1/part2 logs
   - Verify articles are being generated

2. **Supabase Database:**
   - Check article count is growing
   - Verify no errors in logs

3. **Your Website:**
   - Visit site
   - Refresh to see new articles

### Weekly Maintenance:

1. **Database Cleanup** (Optional):
   - Delete articles older than 30 days
   - Run in Supabase SQL Editor:
   ```sql
   DELETE FROM articles WHERE published_at < NOW() - INTERVAL '30 days';
   ```

2. **Cost Check:**
   - Railway: Check usage in dashboard
   - Supabase: Check database size

---

## 🚨 TROUBLESHOOTING

### "No articles being generated"

**Check:**
1. Railway logs - Are services running?
2. Environment variables - All 6 set correctly?
3. API keys - Are they valid and have credits?
4. Cron schedule - Set to `*/5 * * * *` and `*/50 * * * *`?

### "Articles in database but not on website"

**Solution:**
1. Update website API to fetch from Supabase
2. Use the `/pages/api/news-live.js` code above
3. Deploy to Vercel

### "Railway out of free credits"

**Solution:**
1. Upgrade to Railway Pro: $20/month
2. Or optimize:
   - Part 1: Every 10 min (instead of 5)
   - Part 2: Every 60 min (instead of 50)

### "Supabase database full"

**Solution:**
1. Run cleanup query (delete old articles)
2. Or upgrade to Pro: $25/month (50GB database)

---

## ✅ CHECKLIST

Before going live, verify:

- [ ] Supabase table created (`articles`)
- [ ] Supabase credentials added to Railway
- [ ] Railway project created from GitHub
- [ ] All 6 environment variables set in Railway
- [ ] Part 1 cron schedule: `*/5 * * * *`
- [ ] Part 2 cron schedule: `*/50 * * * *`
- [ ] Services deployed and running
- [ ] Logs show articles being generated
- [ ] Articles appearing in Supabase database
- [ ] Website updated to fetch from Supabase
- [ ] Website shows new articles

---

## 🎉 YOU'RE LIVE!

Once all checks pass:
- ✅ News generates automatically 24/7
- ✅ Articles stored in Supabase database
- ✅ Website updates in real-time
- ✅ You can close your laptop!

---

## 📞 SUPPORT

**Railway.app:**
- Discord: https://discord.gg/railway
- Docs: https://docs.railway.app

**Supabase:**
- Discord: https://discord.supabase.com
- Docs: https://supabase.com/docs

**Your project:**
- Check `TWO_PART_NEWS_SYSTEM.md` for system details
- Check `UNIFIED_SCORING_SYSTEM.md` for scoring logic

---

**Ready to deploy? Follow this guide step by step!** 🚀

