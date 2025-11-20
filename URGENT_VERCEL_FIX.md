# 🚨 URGENT: Website Not Showing Articles - Vercel Environment Variables Missing

## The Problem:
Your website API is redirecting because **Supabase environment variables aren't set on Vercel**.

The articles ARE in Supabase, but the API can't access them.

---

## 🚀 QUICK FIX (5 minutes):

### Step 1: Go to Vercel Dashboard
Open: **https://vercel.com/dashboard**

### Step 2: Find Your Project
Click on: **ten-news-website** (or whatever your project is named)

### Step 3: Go to Settings
Click: **Settings** (top menu)

### Step 4: Add Environment Variables
Click: **Environment Variables** (left sidebar)

### Step 5: Add These 4 Variables

**Click "Add New" for each one:**

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
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRseXdpdHBicnVreGlxeGZueml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5MDgyNDcsImV4cCI6MjA3NjQ4NDI0N30.vkNY5wBBVwK5rGxqR3QwkLNqL3qGZqVJgJjQZJZqZqQ
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

### Step 6: Redeploy
1. Click: **Deployments** (top menu)
2. Find the **latest deployment** (should say "main" branch)
3. Click the **three dots (...)** on the right
4. Click: **Redeploy**
5. Check: **Use existing Build Cache** (optional, makes it faster)
6. Click: **Redeploy** to confirm

### Step 7: Wait & Test
- Wait **2-3 minutes** for redeployment
- You'll see "Building..." then "Ready"
- When it says **"Ready"**, refresh **https://tennews.ai**
- Articles should appear! 🎉

---

## 🎯 What You'll See After Fix:

✅ **61 clustered articles** from Supabase
✅ **Multi-source synthesis** (articles combining multiple sources)
✅ **Professional formatting**
❌ **No components yet** (timeline/details/graph) - that's normal for this cycle

---

## 🚀 After Website Works:

Run the system again to process NEW articles with improved component selection:

```bash
cd "/Users/omersogancioglu/Ten news website " && ./RUN_LIVE_CLUSTERED_SYSTEM.sh
```

---

## ✅ Summary:

| Problem | Solution |
|---------|----------|
| API redirecting | Add Supabase env vars to Vercel |
| No articles visible | Redeploy after adding vars |
| Articles in Supabase | ✅ Yes (61 articles published) |
| Code updated | ✅ Yes (pushed to GitHub) |
| Just needs | Environment variables on Vercel |

---

**Follow the steps above and your website will work in 5 minutes!** 🚀

