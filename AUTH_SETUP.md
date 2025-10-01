# Ten News Authentication Setup Guide

## 🚀 Quick Start

This guide will help you set up user authentication for the Ten News website using Supabase.

## 📋 Prerequisites

- Supabase account (free at [supabase.com](https://supabase.com))
- Vercel account for deployment
- Node.js environment

## 🛠️ Step 1: Set up Supabase Project

### 1. Create a new Supabase project
1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New project"
3. Fill in your project details:
   - **Name**: `ten-news-auth`
   - **Database Password**: Choose a strong password
   - **Region**: Choose the closest region to your users

### 2. Get your project credentials
After your project is created:
1. Go to **Settings** → **API**
2. Copy these values (you'll need them later):
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: `eyJ...`
   - **service_role key**: `eyJ...` (keep this secret!)

## 🗄️ Step 2: Database Setup

### Run the migration SQL

1. In your Supabase dashboard, go to **SQL Editor**
2. Copy and paste the entire contents of `supabase-migrations.sql`
3. Click **Run** to execute the migration

**Important Note:** If you get a "must be owner of table users" error, this means the migration file has been updated to remove the problematic line. The error occurs when trying to modify Supabase's built-in `auth.users` table, which is not allowed. The migration only creates your custom `profiles` table and related functions.

This will create:
- `profiles` table with user profile data
- Row Level Security (RLS) policies
- Automatic profile creation on user signup
- Triggers for updating timestamps

## 🔧 Step 3: Environment Variables

### For Local Development (.env.local)
Create a `.env.local` file in your project root:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Existing variables
CLAUDE_API_KEY=your_claude_api_key_here
RESEND_API_KEY=your_resend_api_key_here
NEWSLETTER_SECRET=your_secret_key_here
```

### For Vercel Deployment
1. Go to your Vercel dashboard
2. Navigate to your Ten News project
3. Go to **Settings** → **Environment Variables**
4. Add these variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `CLAUDE_API_KEY`
   - `RESEND_API_KEY`
   - `NEWSLETTER_SECRET`

## 🎨 Step 4: Email Configuration (Optional)

### Supabase Auth Email Templates
1. In Supabase dashboard, go to **Authentication** → **Email Templates**
2. Customize the email templates for:
   - **Confirm signup**
   - **Invite user**
   - **Reset password**
   - **Magic link**

### Custom SMTP (Recommended for production)
1. Go to **Authentication** → **SMTP Settings**
2. Configure your SMTP provider (Gmail, SendGrid, etc.)
3. This ensures better email deliverability

## 🚀 Step 5: Test the Setup

### Local Testing
```bash
npm run dev
```

### Test Authentication Flow
1. Open `http://localhost:3000`
2. Click **"SIGN UP"** in the header
3. Create a test account
4. Check your email for verification
5. Try logging in/out

### Verify Database
1. In Supabase dashboard, go to **Table Editor**
2. Check that the `profiles` table exists
3. Verify user profiles are created automatically

## 🔐 Step 6: Security Configuration

### Supabase Auth Settings
1. Go to **Authentication** → **Settings**
2. Configure:
   - **Site URL**: Your production domain (e.g., `https://tennews.ai`)
   - **Redirect URLs**: Add your domain
   - **JWT Expiry**: Default is fine (3600 seconds)
   - **Enable email confirmations**: ✅ Enabled

### Row Level Security (RLS)
The migration already sets up proper RLS policies:
- Users can only see/modify their own profiles
- Automatic profile creation on signup

## 🐛 Troubleshooting

### Common Issues

#### 1. "Auth session missing" errors
- Check that your Supabase URL and keys are correct
- Verify environment variables are set in Vercel

#### 2. Users can't sign up
- Check Supabase Auth settings
- Verify email templates are configured
- Check spam folder for verification emails

#### 3. Profile not created
- Check the SQL migration ran successfully
- Verify the trigger is active in Supabase

#### 4. CORS errors
- The Vercel deployment should handle CORS automatically
- If testing locally, you might need additional CORS configuration

### Debug Tips

1. **Check browser console** for JavaScript errors
2. **Check Vercel function logs** for API errors
3. **Check Supabase logs** for database errors
4. **Test with Supabase client directly** to isolate issues

## 📊 Monitoring

### Supabase Dashboard
- **Authentication**: Monitor signups, logins, and errors
- **Database**: Check user and profile table growth
- **Logs**: Review API calls and errors

### Vercel Analytics
- Track user authentication events
- Monitor API performance

## 🔄 Updating Authentication

### Adding New User Fields
1. Add columns to the `profiles` table in Supabase
2. Update the SQL migration file
3. Update the signup form and API endpoints
4. Update the profile display components

### Changing Auth Providers
The current setup uses email/password auth. To add:
- **Social logins**: Configure in Supabase Auth settings
- **Magic links**: Already supported, just enable in settings
- **Phone auth**: Requires additional Supabase configuration

## 🎯 Production Checklist

- ✅ Supabase project created
- ✅ Database migration run
- ✅ Environment variables set in Vercel
- ✅ Email templates configured
- ✅ Custom domain set in Supabase Auth settings
- ✅ SSL certificate active
- ✅ RLS policies active
- ✅ Authentication tested end-to-end

## 📞 Support

If you encounter issues:

1. **Check this guide** for common solutions
2. **Supabase Discord** for technical questions
3. **Vercel support** for deployment issues
4. **Review the code** in the API routes for debugging

## 🔗 Useful Links

- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Auth with Supabase](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
- [Supabase Auth UI](https://supabase.com/docs/guides/auth/auth-helpers/auth-ui)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

---

**🎉 Your Ten News website now has full user authentication!**

Users can now create accounts, log in/out, and have personalized profiles. The authentication system integrates seamlessly with your existing newsletter functionality.
