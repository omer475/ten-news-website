# 🗄️ Supabase Setup Guide

## Step 1: Open Supabase SQL Editor

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query** button

---

## Step 2: Run the Schema

1. Open the file `supabase-rss-schema-safe.sql` in your code editor
2. **Copy ALL the contents** (Ctrl+A, Ctrl+C)
3. **Paste** into the Supabase SQL Editor
4. Click **Run** (or press Ctrl+Enter)

**Expected Result:**
- You should see: `✅ Schema created successfully!`
- No red errors

---

## Step 3: Verify It Worked

1. Click **New Query** again
2. Open `supabase-test.sql`
3. Copy all contents
4. Paste and click **Run**

**Expected Result:**
- You should see several tables with data
- `articles table exists` → column_count: 27
- `indexes` → 6 rows
- `RLS enabled` → true
- `policies` → 2 rows
- `functions` → 3 rows

---

## Step 4: Get Your Credentials

1. In Supabase, go to **Settings** → **API**
2. Copy these two values:

```
Project URL: https://xxxxx.supabase.co
service_role key: eyJhbGci... (long key)
```

---

## Step 5: Push Your Articles

Open your terminal and run:

```bash
cd "/Users/omersogancioglu/Ten news website "

# Set credentials (replace with your actual values)
export SUPABASE_URL="https://xxxxx.supabase.co"
export SUPABASE_SERVICE_KEY="eyJhbGci..."

# Push articles
python3 push_to_supabase.py
```

**Expected Result:**
```
============================================================
📤 PUSHING ARTICLES TO SUPABASE (tennews.ai)
============================================================
📊 Found 200+ published articles
   ✅ Trump ratchets up U.S.-China trade war...
   ✅ Palestinians return to devastation...
   ... (more articles)
✅ Pushed: 200+ articles
============================================================
🌐 Articles now live on: https://tennews.ai
============================================================
```

---

## Troubleshooting

### If Step 2 shows errors:

**Error: "relation does not exist"**
- This is OK, it means you're running it for the first time
- The script will create everything

**Error: "permission denied"**
- Make sure you're using the **service_role key**, not the **anon key**

**Error: "syntax error"**
- Make sure you copied the **entire file**, from the very first line to the last

### If Step 5 fails:

**Error: "No module named 'supabase'"**
```bash
pip3 install supabase
```

**Error: "Supabase credentials not set"**
- Make sure you ran the `export` commands in the same terminal
- Check for typos in the URL and key

---

## What to tell me:

1. What error message do you see? (copy the exact text)
2. Which step failed? (Step 2, 3, or 5)
3. Screenshot helps if possible

I'll help you fix it! 🚀

