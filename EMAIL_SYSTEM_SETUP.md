# 📧 Ten News Professional Email System

A complete email marketing system with daily digests, time-optimized sending, personalization, and re-engagement campaigns.

---

## 🎯 Features

| Feature | Description |
|---------|-------------|
| **Daily Digest** | Send personalized news at user's preferred local time |
| **Time-Optimized** | Emails arrive at 7 AM (or custom hour) in each user's timezone |
| **Personalization** | Articles sorted by user's preferred categories |
| **Re-engagement** | Automatic "We miss you" emails after 7+ days of inactivity |
| **Analytics** | Track opens, clicks, and engagement per user |
| **Preferences API** | Users can customize frequency, timezone, and categories |

---

## 🚀 Quick Setup (15 minutes)

### Step 1: Run Database Migration

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy the contents of `migrations/add_email_preferences.sql`
3. Click **Run**

This creates:
- Email preference columns on `profiles` table
- `email_logs` table for tracking
- `email_queue` table for scheduled sends
- Views for finding users ready for emails

### Step 2: Add Environment Variables to Vercel

Go to **Vercel Dashboard** → **Settings** → **Environment Variables**

Add these variables:

```
CRON_SECRET=your-secret-key-here-generate-a-random-string
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
RESEND_API_KEY=re_your_resend_api_key
```

**How to get these:**

| Variable | Where to find it |
|----------|------------------|
| `CRON_SECRET` | Generate a random string (e.g., `openssl rand -hex 32`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → `service_role` key |
| `RESEND_API_KEY` | https://resend.com/api-keys |

### Step 3: Deploy

Push to GitHub and Vercel will auto-deploy with cron jobs enabled.

```bash
git add .
git commit -m "Add professional email system"
git push
```

### Step 4: Verify Cron Jobs

After deployment, go to **Vercel Dashboard** → **Settings** → **Cron Jobs** to verify:

| Cron Job | Schedule | Description |
|----------|----------|-------------|
| `/api/cron/send-emails` | Every hour | Sends daily digests to users whose local time matches |
| `/api/cron/reengagement` | Daily at 10 AM UTC | Sends re-engagement emails to inactive users |

---

## 📋 How It Works

### Daily Digest Flow

```
Every hour (Vercel Cron)
    ↓
/api/cron/send-emails
    ↓
Find users where current_local_hour = preferred_hour
    ↓
For each user:
    - Fetch top 10 articles from last 24h
    - Sort by user's preferred categories (if enabled)
    - Generate personalized email
    - Send via Resend
    - Log to email_logs
    - Update last_email_sent_at
```

### Re-engagement Flow

```
Daily at 10 AM UTC (Vercel Cron)
    ↓
/api/cron/reengagement
    ↓
Find users where:
    - consecutive_days_inactive >= 7
    - Last re-engagement email > 14 days ago
    ↓
For each user:
    - Fetch top 5 articles from last week
    - Generate "we miss you" email
    - Send via Resend
    - Update reengagement_email_sent_at
```

### User Preferences

Users can customize via `/api/email/preferences`:

```javascript
// GET /api/email/preferences
{
  "frequency": "daily",        // daily, weekly, breaking_only, never
  "timezone": "America/New_York",
  "preferredHour": 7,          // 0-23
  "subscribed": true,
  "categories": ["Technology", "Politics"],
  "personalizationEnabled": true
}

// PUT /api/email/preferences
{
  "frequency": "daily",
  "timezone": "Europe/London",
  "preferredHour": 8
}
```

---

## 📊 Email Analytics

### View Email Logs (SQL Query)

```sql
-- Recent emails sent
SELECT 
    el.created_at,
    p.email,
    el.email_type,
    el.status,
    el.opened_at,
    el.clicked_at
FROM email_logs el
JOIN profiles p ON el.user_id = p.id
ORDER BY el.created_at DESC
LIMIT 50;
```

### User Engagement Stats

```sql
-- Top engaged users
SELECT 
    email,
    full_name,
    email_open_count,
    email_click_count,
    articles_read_count,
    last_email_opened_at
FROM profiles
WHERE newsletter_subscribed = true
ORDER BY email_click_count DESC
LIMIT 20;
```

### Inactive Users

```sql
-- Users needing re-engagement
SELECT 
    email,
    full_name,
    consecutive_days_inactive,
    last_app_activity_at,
    reengagement_email_sent_at
FROM profiles
WHERE consecutive_days_inactive >= 7
AND newsletter_subscribed = true
ORDER BY consecutive_days_inactive DESC;
```

---

## 🔧 API Reference

### Send Daily Digest (Manual Trigger)

```bash
curl -X POST https://tennews.ai/api/email/send-daily-digest \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Send Re-engagement (Manual Trigger)

```bash
curl -X POST https://tennews.ai/api/email/send-reengagement \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Get User Preferences

```bash
curl https://tennews.ai/api/email/preferences \
  -H "Authorization: Bearer USER_SESSION_TOKEN"
```

### Update User Preferences

```bash
curl -X PUT https://tennews.ai/api/email/preferences \
  -H "Authorization: Bearer USER_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"frequency": "weekly", "timezone": "Europe/Istanbul"}'
```

---

## 🎨 Email Templates

The system includes beautiful, responsive HTML email templates:

### Daily Digest
- Personalized greeting based on time of day
- User's reading streak
- Top 10 articles with categories & emojis
- Gradient header design
- Mobile-responsive

### Re-engagement
- Different messaging based on inactivity duration
- 7 days: "Here's what you missed"
- 14 days: "Your personalized news is waiting"
- 30+ days: "A lot has happened"
- User's article count encouragement
- Top 5 stories from the week

---

## 📱 Frontend Integration

### Settings Page Component

```jsx
import { useState, useEffect } from 'react';

function EmailPreferences({ session }) {
  const [prefs, setPrefs] = useState(null);
  const [timezones, setTimezones] = useState([]);

  useEffect(() => {
    fetch('/api/email/preferences', {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
      .then(r => r.json())
      .then(data => {
        setPrefs(data.preferences);
        setTimezones(data.availableTimezones);
      });
  }, []);

  const updatePrefs = async (updates) => {
    await fetch('/api/email/preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify(updates)
    });
  };

  return (
    <div>
      <h2>Email Preferences</h2>
      
      {/* Frequency selector */}
      <select 
        value={prefs?.frequency} 
        onChange={e => updatePrefs({ frequency: e.target.value })}
      >
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="breaking_only">Breaking News Only</option>
        <option value="never">Never</option>
      </select>

      {/* Timezone selector */}
      <select 
        value={prefs?.timezone}
        onChange={e => updatePrefs({ timezone: e.target.value })}
      >
        {timezones.map(tz => (
          <option key={tz.value} value={tz.value}>{tz.label}</option>
        ))}
      </select>

      {/* Preferred hour */}
      <select
        value={prefs?.preferredHour}
        onChange={e => updatePrefs({ preferredHour: parseInt(e.target.value) })}
      >
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i}>
            {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
          </option>
        ))}
      </select>
    </div>
  );
}
```

---

## ⚠️ Important Notes

### Vercel Pro Required for Cron

Vercel Cron Jobs require a **Pro plan** ($20/month). 

**Free Alternative:** Use https://cron-job.org (free) to call your endpoints:

1. Create account at cron-job.org
2. Add job: `POST https://tennews.ai/api/email/send-daily-digest`
3. Add header: `x-cron-secret: YOUR_CRON_SECRET`
4. Schedule: Every hour (`0 * * * *`)

### Rate Limits

- Resend free tier: 100 emails/day
- Resend paid: 3,000 emails/month ($20)
- For larger lists, batch in groups of 50 with 1 second delay

### Email Deliverability

Using `onboarding@resend.dev` is for testing. For production:
1. Add your domain to Resend
2. Set up SPF, DKIM, DMARC records
3. Update "from" address in email APIs

---

## 🧪 Testing

### Test Daily Digest Locally

```bash
# Start dev server
npm run dev

# Test endpoint (different terminal)
curl -X POST http://localhost:3000/api/email/send-daily-digest \
  -H "x-cron-secret: test-secret"
```

### Test with Specific User

Add a test endpoint or modify the query to filter by email:

```sql
-- Find your test user
SELECT id, email, email_timezone, preferred_email_hour 
FROM profiles 
WHERE email = 'your@email.com';
```

---

## 📁 Files Created

```
pages/api/email/
├── send-daily-digest.js    # Daily digest sender
├── send-reengagement.js    # Re-engagement sender
├── preferences.js          # User preferences API
└── track.js                # Open/click tracking

pages/api/cron/
├── send-emails.js          # Vercel cron handler
└── reengagement.js         # Vercel cron handler

migrations/
└── add_email_preferences.sql  # Database migration
```

---

## 🎉 You're All Set!

Your professional email system is now ready. Users will receive:

1. **Daily personalized news** at their preferred time
2. **Re-engagement emails** if they stop reading
3. **Full control** over their email preferences

This is exactly what Morning Brew, The Hustle, and other successful newsletters do!
