/**
 * Test endpoint to verify timezone logic is working correctly
 * 
 * Call this to see which users would receive emails at the current time
 * GET /api/email/test-timezone
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TARGET_HOUR = 10;

function normalizeTimezone(timezone) {
  if (!timezone || typeof timezone !== 'string') {
    return 'UTC';
  }
  try {
    new Date().toLocaleString('en-US', { timeZone: timezone });
    return timezone;
  } catch (e) {
    return 'UTC';
  }
}

function getCurrentHourInTimezone(timezone) {
  const validTz = normalizeTimezone(timezone);
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: validTz,
      hour: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(new Date());
    const hourPart = parts.find(p => p.type === 'hour');
    if (hourPart) {
      const hour = parseInt(hourPart.value, 10);
      return hour === 24 ? 0 : hour;
    }
    return -1;
  } catch (e) {
    return -1;
  }
}

function getDateInTimezone(date, timezone) {
  const validTz = normalizeTimezone(timezone);
  try {
    const year = date.toLocaleString('en-US', { timeZone: validTz, year: 'numeric' });
    const month = date.toLocaleString('en-US', { timeZone: validTz, month: '2-digit' });
    const day = date.toLocaleString('en-US', { timeZone: validTz, day: '2-digit' });
    return `${year}-${month}-${day}`;
  } catch (e) {
    return date.toISOString().split('T')[0];
  }
}

export default async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Simple auth check (optional, remove in production if needed)
  const authKey = req.headers['x-test-key'] || req.query.key;
  if (authKey !== process.env.CRON_SECRET && process.env.NODE_ENV === 'production') {
    return res.status(401).json({ message: 'Unauthorized. Pass ?key=YOUR_CRON_SECRET' });
  }

  const now = new Date();

  try {
    // Fetch all subscribed users
    const { data: allUsers, error } = await supabase
      .from('profiles')
      .select('id, email, email_timezone, last_email_sent_at, newsletter_subscribed')
      .eq('newsletter_subscribed', true)
      .not('email', 'is', null);

    if (error) throw error;

    // Analyze timezone distribution
    const timezoneAnalysis = {};
    const eligibleUsers = [];
    const skippedUsers = [];

    for (const user of (allUsers || [])) {
      const timezone = normalizeTimezone(user.email_timezone);
      const currentHour = getCurrentHourInTimezone(timezone);
      const todayStr = getDateInTimezone(now, timezone);
      
      // Check last sent
      let lastSentToday = false;
      if (user.last_email_sent_at) {
        const lastSentDate = getDateInTimezone(new Date(user.last_email_sent_at), timezone);
        lastSentToday = lastSentDate === todayStr;
      }

      // Track timezone stats
      if (!timezoneAnalysis[timezone]) {
        timezoneAnalysis[timezone] = {
          count: 0,
          currentHour: currentHour,
          isTargetHour: currentHour === TARGET_HOUR,
          eligible: 0,
          alreadySentToday: 0,
          wrongHour: 0
        };
      }
      timezoneAnalysis[timezone].count++;

      // Determine eligibility
      if (currentHour !== TARGET_HOUR) {
        timezoneAnalysis[timezone].wrongHour++;
        skippedUsers.push({
          email: user.email,
          timezone,
          currentHour,
          reason: `Wrong hour (${currentHour} != ${TARGET_HOUR})`
        });
      } else if (lastSentToday) {
        timezoneAnalysis[timezone].alreadySentToday++;
        skippedUsers.push({
          email: user.email,
          timezone,
          currentHour,
          reason: 'Already sent today',
          lastSent: user.last_email_sent_at
        });
      } else {
        timezoneAnalysis[timezone].eligible++;
        eligibleUsers.push({
          email: user.email,
          timezone,
          currentHour,
          lastSent: user.last_email_sent_at
        });
      }
    }

    // Check email_logs for today
    const todayUtc = now.toISOString().split('T')[0];
    const { data: emailLogs } = await supabase
      .from('email_logs')
      .select('user_id, created_at, status')
      .eq('email_type', 'daily_digest')
      .eq('status', 'sent')
      .gte('created_at', `${todayUtc}T00:00:00.000Z`);

    return res.status(200).json({
      currentTime: {
        utc: now.toISOString(),
        utcHour: now.getUTCHours(),
        utcMinute: now.getUTCMinutes()
      },
      targetHour: TARGET_HOUR,
      summary: {
        totalSubscribed: allUsers?.length || 0,
        eligibleNow: eligibleUsers.length,
        skippedWrongHour: skippedUsers.filter(u => u.reason.includes('Wrong hour')).length,
        skippedAlreadySent: skippedUsers.filter(u => u.reason.includes('Already sent')).length,
        emailsSentToday: emailLogs?.length || 0
      },
      timezoneDistribution: timezoneAnalysis,
      eligibleUsers: eligibleUsers.slice(0, 10), // First 10 for brevity
      skippedSamples: skippedUsers.slice(0, 10), // First 10 for brevity
      emailLogsToday: emailLogs?.slice(0, 10) || []
    });

  } catch (error) {
    console.error('Test endpoint error:', error);
    return res.status(500).json({ error: error.message });
  }
}
