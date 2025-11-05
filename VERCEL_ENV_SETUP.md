# VERCEL ENVIRONMENT VARIABLES SETUP

## 🚀 To Get Articles on tennews.ai

Your code has been pushed to GitHub! Vercel will auto-deploy, but you need to add these environment variables:

### Go to Vercel Dashboard:
1. Visit: https://vercel.com/
2. Select your project: `ten-news-website`
3. Go to: **Settings** → **Environment Variables**

### Add These Variables:

**Variable 1:**
```
Name: NEXT_PUBLIC_SUPABASE_URL
Value: https://tlywitpbrukxiqxfnzit.supabase.co
```

**Variable 2:**
```
Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRseXdpdHBicnVreGlxeGZueml0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDkwODI0NywiZXhwIjoyMDc2NDg0MjQ3fQ.ZtUGnPgd4A24NIv3vF2iWBffWylobwQKbJX9cbFxfN0
```

**Variable 3:**
```
Name: SUPABASE_URL
Value: https://tlywitpbrukxiqxfnzit.supabase.co
```

**Variable 4:**
```
Name: SUPABASE_SERVICE_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRseXdpdHBicnVreGlxeGZueml0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDkwODI0NywiZXhwIjoyMDc2NDg0MjQ3fQ.ZtUGnPgd4A24NIv3vF2iWBffWylobwQKbJX9cbFxfN0
```

### Important:
- Add all 4 variables
- Apply to: **Production**, **Preview**, and **Development**
- After adding, click **"Redeploy"** to apply changes

### After Setup:
1. Wait 2-3 minutes for deployment
2. Visit: https://tennews.ai
3. You should see all 22+ articles with timeline, details, and diverse components!

---

## ✅ What Was Fixed:

1. **Component Selection** - Now analyzes titles only and selects diverse components
2. **Supabase Connection** - Environment variables properly configured
3. **Field Name Mismatches** - Fixed communication between pipeline steps
4. **Article Publishing** - All articles now have full data (timeline, details, bullets)

---

## 🎉 Your Site Will Show:

✅ Fresh articles from Supabase database
✅ Diverse component selections:
   - Geographic stories → [map, details, timeline]
   - Economic data → [graph, details, timeline]
   - Political events → [timeline, details]
   - Product news → [details, timeline]

✅ Full content for each article:
   - Timeline with 3-4 historical events
   - Details with key numbers and facts
   - Summary bullets (4-5 points)
   - Images

---

**The local site (localhost:3000) is already working perfectly!**
**Just need to add these env vars to Vercel to make tennews.ai work the same way.**

