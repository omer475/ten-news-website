# 🔗 FIX EMAIL VERIFICATION REDIRECT TO TENNEWS.AI

## ✅ **GOOD NEWS:**
- ✅ **Email verification is working** - emails are being sent
- ❌ **Redirect URL is wrong** - going to localhost instead of tennews.ai

---

## 🎯 **THE FIX: Update Supabase URL Configuration**

### **STEP 1: Go to Supabase Dashboard**
1. **Open**: https://supabase.com/dashboard
2. **Select your project** (`tlywitpbrukxiqxfnzit.supabase.co`)
3. **Go to**: **Authentication** → **URL Configuration**

### **STEP 2: Update URL Settings**
**Set these EXACT values:**

**Site URL:**
```
https://tennews.ai
```

**Redirect URLs (add ALL of these):**
```
https://tennews.ai/auth/callback
https://tennews.ai/**
http://localhost:3000/auth/callback
```

### **STEP 3: Click "Save"**

---

## 🎯 **STEP 3: Test the Fix**

### **Test Complete Flow:**
1. **Go to**: https://tennews.ai
2. **Click**: "SIGN UP"
3. **Enter**: Email, password, full name
4. **Submit**: The form
5. **Check**: Email inbox for verification email
6. **Click**: Verification link
7. **Verify**: It now goes to `tennews.ai/auth/callback` instead of localhost

---

## 🔍 **WHY THIS HAPPENS:**

### **The Problem:**
- **Supabase** uses the **Site URL** to generate verification links
- If **Site URL** is set to `http://localhost:3000`, all verification links go there
- Even in production, links will redirect to localhost

### **The Solution:**
- **Site URL** must be set to `https://tennews.ai` for production
- **Redirect URLs** must include both production and development URLs
- This ensures links work in both environments

---

## 📋 **VERIFICATION:**

### **After Fix, Verification Links Should:**
- ✅ **Go to**: `https://tennews.ai/auth/callback`
- ✅ **Not go to**: `http://localhost:3000/auth/callback`
- ✅ **Work on**: Production site (tennews.ai)
- ✅ **Still work on**: Local development (localhost:3000)

---

## 🆘 **IF STILL NOT WORKING:**

### **Check 1: Site URL is Correct?**
- Make sure **Site URL** is exactly `https://tennews.ai`
- No trailing slash, no extra characters

### **Check 2: Redirect URLs Include Both?**
- Must have both `https://tennews.ai/auth/callback` AND `http://localhost:3000/auth/callback`
- This allows both production and development to work

### **Check 3: Save Settings?**
- Make sure you clicked **"Save"** after updating
- Settings don't apply until saved

### **Check 4: Wait for Propagation?**
- Sometimes takes 1-2 minutes for changes to take effect
- Try signing up again after a few minutes

---

## 🎉 **AFTER FIX:**

### **Complete User Flow Will Work:**
1. ✅ **User signs up** on tennews.ai
2. ✅ **Receives verification email** from Supabase
3. ✅ **Clicks verification link** → goes to tennews.ai/auth/callback
4. ✅ **Email verified** → user can log in
5. ✅ **Profile created** in Supabase profiles table
6. ✅ **Welcome email** sent from Resend

---

**Update the Site URL to `https://tennews.ai` in Supabase URL Configuration and your verification links will work perfectly!** 🚀
