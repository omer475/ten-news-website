# 🗄️ SUPABASE USER PROFILES TABLE SETUP

## Current Status:
- ✅ Articles table exists in Supabase
- ❌ User profiles table missing
- ❌ Authentication triggers not set up

---

## 🎯 **STEP 1: Create User Profiles Table**

### **Go to Supabase Dashboard:**
1. **Open**: https://supabase.com/dashboard
2. **Select your project** (`tlywitpbrukxiqxfnzit.supabase.co`)
3. **Go to**: **SQL Editor** (left sidebar)
4. **Click**: **"New Query"**

### **Copy and Paste This SQL:**

```sql
-- Supabase Migration for Ten News User Profiles
-- Run this SQL in your Supabase SQL Editor

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    newsletter_subscribed BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    PRIMARY KEY (id)
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles table
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on profile changes
CREATE TRIGGER handle_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
```

### **Click "Run" to execute the SQL**

---

## 🎯 **STEP 2: Verify Table Creation**

### **Check Table Exists:**
1. **Go to**: **Table Editor** (left sidebar)
2. **Look for**: `profiles` table
3. **Verify columns**: `id`, `email`, `full_name`, `avatar_url`, `newsletter_subscribed`, `created_at`, `updated_at`

### **Test the Setup:**
1. **Go to**: **Authentication** → **Users**
2. **Create a test user** (or use existing one)
3. **Go back to**: **Table Editor** → **profiles**
4. **Check**: A profile should be automatically created for the user

---

## 🎯 **STEP 3: Update Supabase URL Configuration**

### **Go to Authentication Settings:**
1. **Go to**: **Authentication** → **URL Configuration**
2. **Set these values:**

   **Site URL:**
   ```
   https://tennews.ai
   ```

   **Redirect URLs:**
   ```
   https://tennews.ai/auth/callback
   https://tennews.ai/**
   http://localhost:3000/auth/callback
   ```

3. **Click "Save"**

---

## 🎯 **STEP 4: Test Complete Flow**

### **Test User Registration:**
1. **Go to**: https://tennews.ai
2. **Click**: "SIGN UP"
3. **Enter**: Email, password, full name
4. **Check**: Email for verification link
5. **Click**: Verification link (should go to tennews.ai/auth/callback)
6. **Verify**: User profile created in Supabase

### **Check Database:**
1. **Go to**: Supabase Dashboard → **Table Editor** → **profiles**
2. **Verify**: New user profile exists with correct data

---

## 📊 **What This Creates:**

### **Profiles Table Structure:**
```sql
profiles:
├── id (UUID) - Links to auth.users
├── email (TEXT) - User's email
├── full_name (TEXT) - User's full name
├── avatar_url (TEXT) - Profile picture URL
├── newsletter_subscribed (BOOLEAN) - Newsletter preference
├── created_at (TIMESTAMP) - Account creation time
└── updated_at (TIMESTAMP) - Last update time
```

### **Automatic Features:**
- ✅ **Auto-profile creation** when user signs up
- ✅ **Row Level Security** (users only see their own data)
- ✅ **Automatic timestamps** (created_at, updated_at)
- ✅ **Cascade delete** (profile deleted when user deleted)

---

## 🔐 **Security Features:**

### **Row Level Security (RLS):**
- Users can only view their own profile
- Users can only update their own profile
- Users can only insert their own profile

### **Automatic Triggers:**
- Profile created automatically on signup
- Updated timestamp updated automatically on changes

---

## 🚀 **After Setup:**

### **Your Authentication Will:**
1. ✅ **Create user account** in auth.users
2. ✅ **Auto-create profile** in profiles table
3. ✅ **Send verification email** to tennews.ai/auth/callback
4. ✅ **Store user data** securely with RLS

### **Your App Can:**
- ✅ **Read user profiles** from Supabase
- ✅ **Update user information**
- ✅ **Check newsletter subscription status**
- ✅ **Manage user preferences**

---

## 🆘 **Troubleshooting:**

### **If Table Creation Fails:**
- Check for syntax errors in SQL
- Make sure you're in the correct project
- Try running SQL in smaller chunks

### **If Profiles Not Created:**
- Check trigger exists: `on_auth_user_created`
- Check function exists: `handle_new_user()`
- Verify RLS policies are correct

### **If Email Verification Fails:**
- Check URL Configuration in Authentication settings
- Verify redirect URLs include tennews.ai/auth/callback

---

**Run the SQL above in Supabase SQL Editor, and your user authentication will work perfectly!** 🎉
