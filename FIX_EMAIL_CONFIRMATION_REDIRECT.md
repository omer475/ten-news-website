# 🔗 Fix Email Confirmation Redirect Issue

## The Problem
When users create an account, the confirmation email from Supabase contains a link that redirects to `localhost:3000` instead of your production URL (`https://tennews.ai`).

## Why This Happens
Supabase uses two settings to generate confirmation links:
1. **Site URL** in Supabase Dashboard → This is the base URL used for all email links
2. **emailRedirectTo** in your code → This specifies where users should be redirected after confirmation

Even if your code specifies the correct URL, if the **Site URL** in Supabase is set to localhost, all confirmation emails will have localhost links.

---

## ✅ Solution: Two Steps Required

### **STEP 1: Update Supabase Dashboard Settings** ⚠️ **REQUIRED**

This is the most important step! You MUST update Supabase dashboard settings:

1. **Go to Supabase Dashboard:**
   - Visit: https://supabase.com/dashboard
   - Select your project

2. **Navigate to Authentication Settings:**
   - Click **"Authentication"** in the left sidebar
   - Click **"URL Configuration"** (under Settings)

3. **Update Site URL:**
   - **Site URL:** Set to `https://tennews.ai`
   - **Important:** Remove any trailing slashes, no `http://localhost:3000` here

4. **Add Redirect URLs:**
   Add these URLs to the **"Redirect URLs"** list (one per line):
   ```
   https://tennews.ai/auth/callback
   https://tennews.ai/**
   http://localhost:3000/auth/callback
   ```
   - The first two allow production redirects
   - The last one allows local development to still work

5. **Click "Save"** at the bottom

6. **Wait 1-2 minutes** for changes to propagate

---

### **STEP 2: Add Environment Variable (Optional but Recommended)**

I've updated your code to use an environment variable for better flexibility.

**For Vercel Production:**
1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add a new variable:
   - **Name:** `NEXT_PUBLIC_SITE_URL`
   - **Value:** `https://tennews.ai`
   - **Environment:** Production, Preview, Development

**For Local Development (.env.local):**
Add this to your `.env.local` file:
```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**Note:** The code will still work without this variable (it falls back to checking `NODE_ENV`), but using the environment variable is cleaner and more flexible.

---

## 🧪 Testing the Fix

1. **Clear any existing sessions** (log out if logged in)
2. **Create a new test account** on https://tennews.ai
3. **Check your email** for the confirmation email from Supabase
4. **Click the confirmation link** in the email
5. **Verify it redirects to:** `https://tennews.ai/auth/callback` (NOT localhost)

---

## 🔍 Troubleshooting

### Still redirecting to localhost?

**Check 1: Site URL in Supabase**
- Go to Supabase Dashboard → Authentication → URL Configuration
- Make sure **Site URL** is exactly `https://tennews.ai` (no trailing slash)
- Make sure you clicked **"Save"**

**Check 2: Redirect URLs**
- Make sure `https://tennews.ai/auth/callback` is in the Redirect URLs list
- Make sure you clicked **"Save"**

**Check 3: Wait for Propagation**
- Supabase changes can take 1-2 minutes to take effect
- Try signing up again after waiting a few minutes

**Check 4: Environment Variable (if using)**
- Make sure `NEXT_PUBLIC_SITE_URL=https://tennews.ai` is set in Vercel
- Make sure you redeployed after adding the variable

---

## 📋 Summary

**What I Fixed:**
- ✅ Updated `pages/api/auth/signup.js` to use environment variable for redirect URL
- ✅ Code now reads `NEXT_PUBLIC_SITE_URL` or falls back intelligently

**What You Need to Do:**
1. ⚠️ **Update Supabase Dashboard** → Authentication → URL Configuration
   - Set **Site URL** to `https://tennews.ai`
   - Add redirect URLs including `https://tennews.ai/auth/callback`
   - Click **Save**
2. ✅ **Optional:** Add `NEXT_PUBLIC_SITE_URL` to Vercel environment variables

---

**After updating Supabase dashboard settings, your confirmation emails will redirect to the correct production URL!** 🚀



