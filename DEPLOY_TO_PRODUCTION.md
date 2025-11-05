# 🚀 DEPLOY TO PRODUCTION - STEP BY STEP

## Current Status:
- ✅ Local site working perfectly (localhost:3000)
- ✅ Code pushed to GitHub
- ❌ Production site (tennews.ai) needs environment variables

---

## 🎯 QUICK FIX - DO THIS NOW:

### Step 1: Go to Vercel Dashboard
Open: **https://vercel.com/dashboard**

### Step 2: Find Your Project
Click on: **ten-news-website** (or your project name)

### Step 3: Add Environment Variables
1. Click: **Settings** (top menu)
2. Click: **Environment Variables** (left sidebar)
3. Click: **Add New** button

**Add these 4 variables one by one:**

#### Variable 1:
```
Name: NEXT_PUBLIC_SUPABASE_URL
Value: https://tlywitpbrukxiqxfnzit.supabase.co
Environments: ✓ Production ✓ Preview ✓ Development
```
Click **Save**

#### Variable 2:
```
Name: NEXT_PUBLIC_SUPABASE_ANON_KEY  
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRseXdpdHBicnVreGlxeGZueml0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDkwODI0NywiZXhwIjoyMDc2NDg0MjQ3fQ.ZtUGnPgd4A24NIv3vF2iWBffWylobwQKbJX9cbFxfN0
Environments: ✓ Production ✓ Preview ✓ Development
```
Click **Save**

#### Variable 3:
```
Name: SUPABASE_URL
Value: https://tlywitpbrukxiqxfnzit.supabase.co
Environments: ✓ Production ✓ Preview ✓ Development
```
Click **Save**

#### Variable 4:
```
Name: SUPABASE_SERVICE_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRseXdpdHBicnVreGlxeGZueml0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDkwODI0NywiZXhwIjoyMDc2NDg0MjQ3fQ.ZtUGnPgd4A24NIv3vF2iWBffWylobwQKbJX9cbFxfN0
Environments: ✓ Production ✓ Preview ✓ Development
```
Click **Save**

### Step 4: Redeploy
1. Click: **Deployments** (top menu)
2. Find the latest deployment (should say "main")
3. Click the **three dots (...)** on the right
4. Click: **Redeploy**
5. Confirm: **Yes, redeploy**

### Step 5: Wait & Refresh
- Wait **2-3 minutes** for deployment to complete
- You'll see a progress bar
- When it says "Ready", refresh **tennews.ai**
- Articles should appear! 🎉

---

## 📸 Visual Guide:

### Finding Environment Variables:
```
Vercel Dashboard
  └── Your Project
      └── Settings
          └── Environment Variables
              └── Add New
```

### What Each Variable Does:
- `NEXT_PUBLIC_SUPABASE_URL` - Tells frontend where Supabase is
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Allows frontend to read from Supabase
- `SUPABASE_URL` - Backend connection
- `SUPABASE_SERVICE_KEY` - Backend full access

---

## ✅ After Setup You'll See:

On **tennews.ai**:
- 📰 22+ fresh articles from database
- 🗺️ Maps for geographic news
- 📊 Graphs for economic data
- 📅 Timelines with 3-4 events
- 📋 Details with key facts
- ✨ All working just like localhost!

---

## 🆘 If Still Not Working:

### Check 1: Are variables saved?
- Go back to Settings → Environment Variables
- You should see all 4 variables listed

### Check 2: Did deployment finish?
- Go to Deployments
- Latest one should say "Ready" with green checkmark

### Check 3: Clear browser cache
- Hard refresh: `Cmd + Shift + R` (Mac) or `Ctrl + Shift + R` (Windows)
- Or try incognito/private mode

### Check 4: Check deployment logs
- Click on the deployment
- Click "View Function Logs"
- Look for errors

---

## 💡 Why This Happened:

The production site doesn't have access to your local `.env.local` file. 
Vercel needs these variables set in its dashboard to connect to Supabase.

**Your local site works because it has `.env.local`**
**Production needs variables set in Vercel dashboard**

---

**Once you add these 4 variables and redeploy, tennews.ai will work exactly like localhost:3000!** 🚀

