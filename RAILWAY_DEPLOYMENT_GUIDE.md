# 🚂 Railway.app Deployment Guide - 24/7 Live News System

## 📋 Overview

This guide will help you deploy your live news system to **Railway.app** so it runs **24/7** even when your computer is off.

---

## ✨ WHAT WILL HAPPEN

Once deployed:
- **Part 1** runs automatically **every 5 minutes**
- **Part 2** runs automatically **every 50 minutes**
- Both update `tennews_data_live.json` immediately
- Your website (Vercel) reads the latest file automatically
- **Runs forever** until you stop it

---

## 💰 COST ESTIMATE

**Railway.app Pricing:**
- **Free Tier**: $5/month in free credits
- **Pro Plan**: $20/month (if you exceed free tier)

**Your Expected Usage:**
- Part 1: Runs 288 times/day (~2-3 min each) = ~10 hours/day
- Part 2: Runs 28.8 times/day (~15-20 min each) = ~8 hours/day
- **Total runtime**: ~18 hours/day of compute
- **Estimated cost**: $8-12/month

**Free tier should be sufficient for testing!**

---

## 🚀 STEP-BY-STEP DEPLOYMENT

### STEP 1: Sign Up for Railway.app

1. Go to https://railway.app
2. Click **"Start a New Project"**
3. Sign up with GitHub (easiest option)
4. Authorize Railway to access your repositories

---

### STEP 2: Prepare Your Repository

Your code is already on GitHub! ✅ We just need to add Railway configuration files.

**Files we'll create:**
- `Procfile` - Tells Railway what to run
- `railway.json` - Cron schedules
- `.railwayignore` - Files to exclude

---

### STEP 3: Add Railway Configuration Files

**These files will be created in your project:**

#### 1. `Procfile`
```
part1: python3 news-part1-breaking.py
part2: python3 news-part2-global.py
```

#### 2. `railway.json`
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "numReplicas": 1,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

#### 3. `.railwayignore`
```
node_modules/
.next/
*.log
*.md
public/
components/
pages/
styles/
livenews_data_*.json
part1_breaking_*.json
part2_global_*.json
tennews_data_2025_*.json
*.html
```

---

### STEP 4: Deploy to Railway

1. **Connect Repository:**
   - In Railway dashboard, click **"New Project"**
   - Select **"Deploy from GitHub repo"**
   - Choose `ten-news-website` repository
   - Click **"Deploy Now"**

2. **Wait for Build:**
   - Railway will detect Python and install dependencies
   - Takes ~2-3 minutes

3. **Configure Environment Variables:**
   - In Railway project, go to **"Variables"** tab
   - Add these keys:
     ```
     NEWSAPI_KEY=your-newsapi-key
     CLAUDE_API_KEY=your-claude-key
     GOOGLE_API_KEY=your-google-key
     PERPLEXITY_API_KEY=your-perplexity-key
     ```

4. **Enable Cron Jobs:**
   - Railway will automatically detect services from `Procfile`
   - You'll see two services: `part1` and `part2`
   
5. **Set Up Cron Schedules:**
   - For `part1` service:
     - Go to Settings → Cron
     - Set schedule: `*/5 * * * *` (every 5 minutes)
   - For `part2` service:
     - Go to Settings → Cron
     - Set schedule: `*/50 * * * *` (every 50 minutes)

---

### STEP 5: Push Updated Files to GitHub

**Save and push the Railway configuration files:**

Railway will automatically detect changes and redeploy!

---

### STEP 6: Monitor Your Deployment

**Railway Dashboard:**
- Go to your project
- Click on `part1` or `part2` service
- View **"Logs"** tab to see real-time output
- Check **"Metrics"** tab for resource usage

**What to look for:**
```
🔴 PART 1: BREAKING NEWS GENERATOR
✅ LIVE UPDATE SUCCESS!
📰 Added 3 new articles from Part 1
📊 Total articles in live feed: 15
```

---

## 📂 FILE STORAGE STRATEGY

### Option A: Direct File Access (Simple)
Railway has a **persistent volume** where files are stored.

**Your `tennews_data_live.json` will be saved on Railway's server.**

**To make it accessible to your website:**
1. Use Railway's **public domain** (auto-generated)
2. Add a simple API endpoint to serve the JSON file
3. Your Vercel website fetches from Railway URL

**OR**

### Option B: GitHub Auto-Commit (Recommended)
After each update, automatically commit `tennews_data_live.json` to GitHub.

**Your website fetches directly from GitHub!**

**To implement:**
1. Create a GitHub Personal Access Token
2. Add to Railway environment: `GITHUB_TOKEN=your-token`
3. Modify both scripts to auto-commit after saving

---

## 🔧 ADDING AUTO-COMMIT TO GITHUB

**Add this function to both scripts:**

```python
import subprocess

def commit_to_github(filename):
    """Auto-commit updated file to GitHub"""
    try:
        subprocess.run(['git', 'add', filename], check=True)
        subprocess.run([
            'git', 'commit', '-m', 
            f'Auto-update: {filename} at {datetime.now().isoformat()}'
        ], check=True)
        subprocess.run(['git', 'push'], check=True)
        print(f"✅ Pushed {filename} to GitHub")
    except Exception as e:
        print(f"⚠️ Git push failed: {e}")

# Call after saving live file:
commit_to_github(live_filename)
```

**Benefits:**
- ✅ Your website always has the latest data
- ✅ Full version history
- ✅ No extra API endpoints needed

---

## 🌐 UPDATE YOUR WEBSITE TO USE LIVE DATA

**Modify `/pages/api/news.js` (or create if missing):**

```javascript
export default async function handler(req, res) {
  try {
    // Fetch from GitHub raw URL
    const response = await fetch(
      'https://raw.githubusercontent.com/omer475/ten-news-website/main/tennews_data_live.json'
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch live news');
    }
    
    const data = await response.json();
    
    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching live news:', error);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
}
```

**Your `pages/index.js` already fetches from `/api/news`, so no changes needed!**

---

## 🎯 FINAL CHECKLIST

- [ ] Railway.app account created
- [ ] GitHub repository connected to Railway
- [ ] `Procfile`, `railway.json`, `.railwayignore` added
- [ ] Environment variables configured in Railway
- [ ] Cron schedules set (Part 1: `*/5 * * * *`, Part 2: `*/50 * * * *`)
- [ ] Auto-commit function added to both scripts
- [ ] Website API endpoint updated to fetch from GitHub
- [ ] Tested: Check Railway logs for successful runs
- [ ] Tested: Visit your website and see live news!

---

## 🚨 TROUBLESHOOTING

### "Deployment failed - build error"
- Check Railway logs for specific error
- Ensure `requirements.txt` includes all dependencies
- Try manual build: `pip install -r requirements.txt`

### "Cron job not running"
- Verify cron syntax: `*/5 * * * *` for every 5 minutes
- Check Railway service status (should be "Active")
- View logs to see if there are errors

### "No articles appearing on website"
- Check Railway logs: Are scripts finding articles?
- Verify `tennews_data_live.json` exists in repo
- Check GitHub: Is file being committed?
- Test API endpoint directly: `https://your-site.vercel.app/api/news`

### "Out of Railway free credits"
- Upgrade to Pro plan ($20/month)
- Or optimize: Run Part 1 every 10 min instead of 5 min
- Or reduce sources in Part 2

---

## 💡 COST OPTIMIZATION TIPS

**If you need to reduce costs:**

1. **Reduce Part 1 Frequency:**
   - Change from every 5 min → every 10 min
   - Cron: `*/10 * * * *`
   - Saves 50% of Part 1 compute

2. **Reduce Part 2 Frequency:**
   - Change from every 50 min → every 60 min
   - Cron: `0 * * * *` (every hour)
   - Saves 20% of Part 2 compute

3. **Reduce Source Count:**
   - Part 2: Use 50 sources instead of 123
   - Faster runtime = less cost

4. **Use Railway's "Sleep" Feature:**
   - Run only during peak hours (8 AM - 10 PM)
   - Use cron conditions

---

## 📞 SUPPORT

**Railway Support:**
- Discord: https://discord.gg/railway
- Docs: https://docs.railway.app

**Your Project:**
- Check logs first
- Review `TWO_PART_NEWS_SYSTEM.md`
- Review `UNIFIED_SCORING_SYSTEM.md`

---

## 🎉 YOU'RE DONE!

Once deployed:
- News generates automatically 24/7
- Website updates in real-time
- You can close your laptop! 💻→📴
- System runs on Railway's servers ☁️

**Check your website in 10 minutes to see fresh news!** 🚀

