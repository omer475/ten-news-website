# 🚨 Fix: Email Not Sending After Signup

## The Problem
After updating Supabase URL settings, confirmation emails are no longer being sent when users create accounts.

---

## ✅ Quick Fix Checklist

### **STEP 1: Verify Email Confirmations Are Enabled** ⚠️ **MOST IMPORTANT**

This is the #1 reason emails stop sending!

1. **Go to Supabase Dashboard:**
   - Visit: https://supabase.com/dashboard
   - Select your project

2. **Navigate to Email Settings:**
   - Click **"Authentication"** in left sidebar
   - Click **"Settings"** (under Authentication)
   - Scroll down to **"Email"** section

3. **Check These Settings:**
   - ✅ **"Enable email confirmations"** - MUST be checked ON
   - ✅ **"Enable email change confirmations"** - should be ON
   - ✅ **"Enable password reset emails"** - should be ON

4. **If "Enable email confirmations" is OFF:**
   - Turn it ON ✅
   - Click **"Save"** at the bottom
   - Wait 1-2 minutes

---

### **STEP 2: Verify URL Configuration Didn't Break**

1. **Go to:** Authentication → **URL Configuration**

2. **Check Site URL:**
   - Should be: `https://tennews.ai`
   - Should NOT be: `http://localhost:3000`

3. **Check Redirect URLs:**
   - Must include: `https://tennews.ai/auth/callback`
   - Should also include: `http://localhost:3000/auth/callback` (for dev)

4. **Click "Save"** if you made changes

---

### **STEP 3: Check Email Templates**

1. **Go to:** Authentication → **Email Templates**

2. **Click:** **"Confirm signup"** template

3. **Verify the template has:**
   - **Subject line** (not empty)
   - **Body** containing `{{ .ConfirmationURL }}`

4. **If template is broken:**
   - Click **"Reset to default"**
   - Or manually ensure `{{ .ConfirmationURL }}` is in the body

---

### **STEP 4: Check Supabase Logs**

1. **Go to:** Authentication → **Logs**

2. **Look for:**
   - Recent signup attempts
   - Any error messages
   - Email sending failures

3. **Common errors:**
   - "Email rate limit exceeded" → Wait a few minutes
   - "SMTP error" → Check SMTP settings
   - "Invalid redirect URL" → Check URL Configuration

---

### **STEP 5: Test Email Sending Manually**

1. **Go to:** Authentication → **Users**

2. **Find your test user** (the one you just created)

3. **Click the "..." menu** next to the user

4. **Click:** **"Send confirmation email"**

5. **Check your email** (including spam folder)

---

## 🔍 Common Issues & Solutions

### **Issue 1: Email Confirmations Disabled**

**Symptom:** No emails sent, user created but not verified

**Solution:**
- Go to Authentication → Settings
- Enable "Enable email confirmations"
- Click Save

---

### **Issue 2: Site URL Changed Incorrectly**

**Symptom:** Emails sent but to wrong URL

**Solution:**
- Site URL should be `https://tennews.ai` (production)
- NOT `http://localhost:3000`
- Redirect URLs should include both production and dev URLs

---

### **Issue 3: Email Rate Limits**

**Symptom:** First email works, subsequent ones don't

**Solution:**
- Supabase has rate limits (usually 3-4 emails per hour per email)
- Wait 15-30 minutes and try again
- Use different email for testing

---

### **Issue 4: Email Going to Spam**

**Symptom:** Emails not in inbox

**Solution:**
- Check spam/junk folder
- Look for emails from `noreply@supabase.com`
- Mark as "Not Spam" if found

---

### **Issue 5: SMTP Not Configured**

**Symptom:** Emails unreliable or delayed

**Solution:**
- Supabase default SMTP works but may be slow
- For better delivery, configure custom SMTP:
  - Go to Authentication → SMTP Settings
  - Enable Custom SMTP
  - Use Resend or SendGrid

---

## 🧪 Testing Steps

### **Test 1: Create New Account**

1. Go to https://tennews.ai
2. Click "SIGN UP"
3. Enter email, password, full name
4. Submit form
5. Check browser console (F12) for any errors
6. Check email inbox AND spam folder

### **Test 2: Check Supabase Dashboard**

1. Go to Authentication → Users
2. Find your test user
3. Check user status:
   - **Unconfirmed** = Email sent, waiting for verification
   - **Confirmed** = Email already verified (might be auto-confirmed)

### **Test 3: Manual Email Resend**

1. In Authentication → Users
2. Find your test user
3. Click "..." → "Send confirmation email"
4. Check email again

---

## 📋 What Should Happen

### **Normal Flow:**

1. ✅ User submits signup form
2. ✅ Supabase creates user account
3. ✅ Supabase sends confirmation email (if enabled)
4. ✅ Resend sends welcome email (your custom email)
5. ✅ User receives TWO emails:
   - **Verification email** from Supabase
   - **Welcome email** from Ten News (Resend)

### **If Email Confirmations Are Disabled:**

1. ✅ User submits signup form
2. ✅ Supabase creates user account
3. ❌ **NO confirmation email** (because it's disabled)
4. ✅ User is auto-confirmed (can log in immediately)
5. ✅ Resend sends welcome email

---

## 🆘 If Still Not Working

### **Check 1: Enable Email Confirmations**
- Most common issue!
- Authentication → Settings → Enable email confirmations

### **Check 2: Check Browser Console**
- Open browser DevTools (F12)
- Look for errors in Console tab
- Look for network errors in Network tab

### **Check 3: Check Vercel Logs**
- Go to Vercel dashboard
- Check Function Logs for your API
- Look for signup errors

### **Check 4: Test with Different Email**
- Try Gmail, Yahoo, Outlook
- Some email providers block Supabase emails

### **Check 5: Temporary Workaround**
- Go to Authentication → Settings
- Turn OFF "Enable email confirmations"
- Users will be auto-confirmed (no email needed)
- **Note:** This bypasses email verification (not recommended for production)

---

## 🎯 Most Likely Fix

**99% of the time, the issue is:**

✅ **"Enable email confirmations" is turned OFF in Supabase Settings**

**To fix:**
1. Go to Supabase Dashboard
2. Authentication → Settings
3. Scroll to "Email" section
4. Turn ON "Enable email confirmations"
5. Click Save

**This should immediately fix the issue!** 🚀

---

## 📝 After Fixing

Once emails are working again:

1. ✅ Test signup flow
2. ✅ Verify confirmation email arrives
3. ✅ Click confirmation link
4. ✅ Verify redirect goes to tennews.ai (not localhost)
5. ✅ Verify user can log in after confirmation

---

**Remember: Email confirmations must be ENABLED in Supabase Settings for emails to be sent!** 🎯


