# 🖼️ Testing Images - Complete Guide

## ✅ **What Was Fixed**

### **The Problem:**
- The Next.js API route (`/pages/api/news.js`) was reading from **old JSON files** (`tennews_data_*.json`)
- The new RSS system stores everything in **SQLite database** (`ten_news.db`)
- Result: **Website couldn't see images** even though they were in the database

### **The Solution:**
- ✅ Updated `/pages/api/news.js` to read directly from `ten_news.db`
- ✅ Added SQLite packages to `package.json`
- ✅ Images are now served from database to website

---

## 📊 **Current Image Status**

```
📊 Total articles in database: 6,863
✅ Published articles: 233
🖼️  Articles with images: 187 (80.3%)
❌ Articles without images: 46 (19.7%)

Image extraction methods:
  • enclosure: 108
  • media_content: 37
  • og_image: 33
  • media_thumbnail: 5
  • content_html: 4
  • none: 46
```

---

## 🧪 **How to Test the Complete System**

### **Step 1: Check Database Has Images**
```bash
cd "/Users/omersogancioglu/Ten news website "
python3 check_images.py
```

You should see:
```
📊 Total articles in database: ...
✅ Published articles: ...
🖼️  Articles with images: ...
📈 Image coverage: ...%
```

### **Step 2: Test Next.js API Locally**
```bash
# Install dependencies (if not already done)
npm install

# Start Next.js dev server
npm run dev
```

Open browser: http://localhost:3000/api/news

You should see JSON with `urlToImage` fields:
```json
{
  "articles": [
    {
      "title": "Some news title",
      "urlToImage": "https://example.com/image.jpg",
      ...
    }
  ]
}
```

### **Step 3: Test Frontend Locally**
With dev server running, open: http://localhost:3000

You should see:
- ✅ News articles with **images displayed**
- ✅ Images should be at the top of each news card
- ✅ ~80% of articles should have images

### **Step 4: Run the RSS Fetcher (Generate Fresh Articles)**

In a **separate terminal**:
```bash
cd "/Users/omersogancioglu/Ten news website "

# Set API keys
export CLAUDE_API_KEY='your-key'
export GOOGLE_API_KEY='your-key'
export PERPLEXITY_API_KEY='your-key'

# Run the system
python3 main.py
```

Wait 5-10 minutes for articles to be fetched, scored, and published.

### **Step 5: Check Fresh Images**
```bash
# In another terminal
python3 check_images.py
```

Watch the image count increase!

---

## 🔍 **Debugging Images**

### **Check Specific Article Images:**
```bash
sqlite3 ten_news.db "SELECT title, image_url FROM articles WHERE published = TRUE LIMIT 10;"
```

### **Find Articles Without Images:**
```bash
sqlite3 ten_news.db "SELECT source, COUNT(*) FROM articles WHERE published = TRUE AND image_url IS NULL GROUP BY source;"
```

### **Test Image URLs:**
Copy an `image_url` from the database and paste it in your browser. If it loads, the image is valid!

---

## 📡 **Deploy to Vercel**

### **Step 1: Commit Database to Git**
```bash
git add ten_news.db
git commit -m "Add news database with images"
git push origin main
```

### **Step 2: Deploy to Vercel**
```bash
# If not already connected
vercel

# Or just push to main (if auto-deploy is enabled)
git push origin main
```

### **Step 3: Verify on Production**
- Open your Vercel URL: `https://your-site.vercel.app/api/news`
- Check for `urlToImage` fields in the JSON
- Visit the homepage and verify images are displayed

---

## 🚀 **Continuous Updates**

### **Option 1: Manual Updates**
1. Run `python3 main.py` locally
2. Let it collect articles for 1-2 hours
3. Stop with `Ctrl+C`
4. Push database: `git add ten_news.db && git commit -m "Update news" && git push`
5. Vercel auto-deploys

### **Option 2: Railway.app (24/7 Live Updates)**
Deploy the Python system on Railway:
1. RSS Fetcher runs every 10 minutes
2. AI Filter runs every 5 minutes
3. Database is updated in real-time
4. Use Railway's database export to Vercel

---

## ✅ **Checklist**

- [x] RSS fetcher extracts images ✅
- [x] Images stored in database ✅
- [x] Next.js API reads from database ✅
- [x] Frontend displays images ✅
- [ ] Test on localhost (do this now!)
- [ ] Deploy to Vercel
- [ ] Verify production images

---

## 🎯 **Expected Results**

When you visit your website, you should see:

```
┌─────────────────────────────────────┐
│  [FULL-WIDTH IMAGE HERE]            │
│                                     │
├─────────────────────────────────────┤
│  📰 Breaking News Title             │
│                                     │
│  Summary text here...               │
│                                     │
│  📅 Timeline                        │
│  📄 Details                         │
└─────────────────────────────────────┘
```

**~80% of articles will have images.**

---

## 🐛 **Common Issues**

### **Issue: "No images showing locally"**
**Fix:**
```bash
# Make sure you have sqlite packages
npm install sqlite sqlite3

# Restart dev server
npm run dev
```

### **Issue: "Database locked"**
**Fix:**
```bash
# Stop all Python scripts first
pkill -f main.py

# Then restart
python3 main.py
```

### **Issue: "Old news showing"**
**Fix:**
```bash
# Delete old JSON files
rm tennews_data_*.json

# Restart Next.js
npm run dev
```

---

## 📊 **Monitor Image Coverage**

Run this periodically:
```bash
watch -n 10 'python3 check_images.py'
```

You'll see live updates every 10 seconds!

---

## 🎉 **You're Done!**

Images are now flowing from:
```
RSS Feeds → Database → Next.js API → Website
```

**Test it now:** `npm run dev` and visit http://localhost:3000 🚀

