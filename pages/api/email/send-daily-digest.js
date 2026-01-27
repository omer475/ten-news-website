import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize Supabase with service role for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Daily Digest Email Sender
 * 
 * This endpoint sends personalized daily news digests to users.
 * It's designed to be called by a cron job every hour.
 * 
 * Features:
 * - Time-optimized sending (sends at 10 AM in each user's timezone)
 * - Personalized content based on user interests
 * - Engagement tracking
 * - Batch processing to handle large subscriber lists
 * 
 * TIMEZONE LOGIC:
 * - Cron runs every hour (0 * * * *)
 * - For each user, we calculate their current local hour
 * - Only send if it's exactly 10 AM in their timezone
 * - Also verify they haven't received an email today already
 */

// Target hour for sending emails (10 AM in user's timezone)
const TARGET_HOUR = 10;

// Valid IANA timezone identifiers for common timezones
const VALID_TIMEZONES = [
  'Pacific/Honolulu',      // Hawaii (UTC-10)
  'America/Anchorage',     // Alaska (UTC-9)
  'America/Los_Angeles',   // Pacific (UTC-8)
  'America/Denver',        // Mountain (UTC-7)
  'America/Chicago',       // Central (UTC-6)
  'America/New_York',      // Eastern (UTC-5)
  'America/Sao_Paulo',     // Brazil (UTC-3)
  'Atlantic/Reykjavik',    // Iceland (UTC+0)
  'Europe/London',         // UK (UTC+0/+1)
  'Europe/Paris',          // Central Europe (UTC+1/+2)
  'Europe/Istanbul',       // Turkey (UTC+3)
  'Asia/Dubai',            // Gulf (UTC+4)
  'Asia/Kolkata',          // India (UTC+5:30)
  'Asia/Bangkok',          // Indochina (UTC+7)
  'Asia/Shanghai',         // China (UTC+8)
  'Asia/Tokyo',            // Japan (UTC+9)
  'Australia/Sydney',      // Australia East (UTC+10/+11)
  'Pacific/Auckland',      // New Zealand (UTC+12/+13)
  'UTC'
];

/**
 * Validate and normalize timezone string
 * @param {string} timezone - User's timezone
 * @returns {string} - Valid IANA timezone or 'UTC' as fallback
 */
function normalizeTimezone(timezone) {
  if (!timezone || typeof timezone !== 'string') {
    return 'UTC';
  }
  
  // Check if it's already a valid IANA timezone by testing it
  try {
    new Date().toLocaleString('en-US', { timeZone: timezone });
    return timezone;
  } catch (e) {
    console.log(`⚠️ Invalid timezone "${timezone}", falling back to UTC`);
    return 'UTC';
  }
}

/**
 * Get current hour in a specific timezone (0-23)
 * Uses multiple methods for reliability
 */
function getCurrentHourInTimezone(timezone) {
  const validTz = normalizeTimezone(timezone);
  
  try {
    // Method 1: Use Intl.DateTimeFormat for most reliable hour extraction
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: validTz,
      hour: 'numeric',
      hour12: false
    });
    
    const parts = formatter.formatToParts(new Date());
    const hourPart = parts.find(p => p.type === 'hour');
    
    if (hourPart) {
      const hour = parseInt(hourPart.value, 10);
      // Handle midnight (can be returned as 24 in some locales)
      return hour === 24 ? 0 : hour;
    }
    
    // Fallback method: toLocaleString
    const hourStr = new Date().toLocaleString('en-US', { 
      hour: 'numeric', 
      hour12: false, 
      timeZone: validTz 
    });
    const hour = parseInt(hourStr, 10);
    return hour === 24 ? 0 : hour;
    
  } catch (e) {
    console.error(`❌ Error getting hour for timezone "${timezone}":`, e.message);
    // Return -1 to indicate invalid - user will be skipped
    return -1;
  }
}

/**
 * Get current date string in user's timezone (YYYY-MM-DD format for reliable comparison)
 */
function getDateInTimezone(date, timezone) {
  const validTz = normalizeTimezone(timezone);
  
  try {
    const year = date.toLocaleString('en-US', { timeZone: validTz, year: 'numeric' });
    const month = date.toLocaleString('en-US', { timeZone: validTz, month: '2-digit' });
    const day = date.toLocaleString('en-US', { timeZone: validTz, day: '2-digit' });
    return `${year}-${month}-${day}`;
  } catch (e) {
    // Fallback to UTC
    return date.toISOString().split('T')[0];
  }
}

/**
 * Check if user already received email today (in their timezone)
 * Uses last_email_sent_at field as a quick check
 */
function alreadySentTodayFromField(lastEmailSentAt, timezone) {
  if (!lastEmailSentAt) return false;
  
  try {
    const lastSent = new Date(lastEmailSentAt);
    const now = new Date();
    
    // Compare dates in user's timezone using consistent format
    const todayInTz = getDateInTimezone(now, timezone);
    const lastSentInTz = getDateInTimezone(lastSent, timezone);
    
    return todayInTz === lastSentInTz;
  } catch (e) {
    console.error('Error checking alreadySentToday:', e.message);
    // On error, assume not sent to avoid missing emails
    return false;
  }
}

/**
 * Check email_logs table to definitively confirm if email was sent today
 * This is more reliable than the profile field
 */
async function checkEmailLogsSentToday(supabaseClient, userId, timezone) {
  try {
    // Get the start of today in the user's timezone
    const now = new Date();
    const todayStr = getDateInTimezone(now, timezone);
    
    // Query email_logs for today's daily_digest
    const { data, error } = await supabaseClient
      .from('email_logs')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('email_type', 'daily_digest')
      .eq('status', 'sent')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error(`Error checking email_logs for user ${userId}:`, error.message);
      return false; // On error, allow sending
    }
    
    if (data && data.length > 0) {
      // Check if the last email was sent today in user's timezone
      const lastSent = new Date(data[0].created_at);
      const lastSentDateStr = getDateInTimezone(lastSent, timezone);
      return todayStr === lastSentDateStr;
    }
    
    return false;
  } catch (e) {
    console.error('Error in checkEmailLogsSentToday:', e.message);
    return false;
  }
}

// Track if we're currently processing to prevent concurrent runs
let isProcessing = false;
let lastRunTime = null;

export default async function handler(req, res) {
  // Only allow POST with secret or cron header
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Verify authorization (cron secret or API key)
  const authHeader = req.headers.authorization;
  const cronSecret = req.headers['x-cron-secret'];
  
  if (cronSecret !== process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Prevent concurrent runs (in case cron triggers multiple times)
  if (isProcessing) {
    console.log('⚠️ Already processing, skipping this run');
    return res.status(200).json({ message: 'Already processing', skipped: true });
  }

  // Prevent running more than once per hour (within same instance)
  const now = new Date();
  if (lastRunTime && (now.getTime() - lastRunTime.getTime()) < 55 * 60 * 1000) {
    console.log(`⚠️ Last run was ${Math.round((now.getTime() - lastRunTime.getTime()) / 60000)} minutes ago, skipping`);
    return res.status(200).json({ 
      message: 'Already ran recently', 
      skipped: true,
      lastRun: lastRunTime.toISOString() 
    });
  }

  isProcessing = true;
  lastRunTime = now;

  try {
  const currentUtcHour = now.getUTCHours();
  const currentUtcMinute = now.getUTCMinutes();
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📧 DAILY DIGEST EMAIL JOB STARTED`);
  console.log(`📅 UTC Time: ${now.toISOString()}`);
  console.log(`🕐 UTC Hour: ${currentUtcHour}:${String(currentUtcMinute).padStart(2, '0')}`);
  console.log(`🎯 Target Hour: ${TARGET_HOUR}:00 (in each user's local timezone)`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // Fetch ALL subscribed users with their timezone preferences
    const { data: allUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id, email, full_name, preferred_categories, email_personalization_enabled, articles_read_count, email_timezone, last_email_sent_at')
      .eq('newsletter_subscribed', true)
      .not('email', 'is', null);

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      throw usersError;
    }

    console.log(`📋 Found ${allUsers?.length || 0} subscribed users total`);

    // Create a timezone distribution summary for debugging
    const timezoneStats = {};
    (allUsers || []).forEach(user => {
      const tz = user.email_timezone || 'UTC';
      if (!timezoneStats[tz]) {
        timezoneStats[tz] = { count: 0, currentHour: getCurrentHourInTimezone(tz) };
      }
      timezoneStats[tz].count++;
    });
    
    console.log('\n📊 Timezone Distribution:');
    Object.entries(timezoneStats).forEach(([tz, stats]) => {
      const isTargetHour = stats.currentHour === TARGET_HOUR;
      console.log(`   ${isTargetHour ? '✅' : '⏳'} ${tz}: ${stats.count} users (current hour: ${stats.currentHour}:00${isTargetHour ? ' - WILL SEND' : ''})`);
    });
    console.log('');

    // Filter users where it's currently 10 AM in their timezone
    // and they haven't received an email today
    const eligibleUsers = [];
    const skippedReasons = { wrongHour: 0, alreadySent: 0, invalidTimezone: 0 };

    // First pass: filter by timezone hour (fast check)
    const candidateUsers = [];
    for (const user of (allUsers || [])) {
      const timezone = normalizeTimezone(user.email_timezone);
      const currentHourInUserTz = getCurrentHourInTimezone(timezone);
      
      // Skip if we couldn't determine the hour (invalid timezone)
      if (currentHourInUserTz === -1) {
        skippedReasons.invalidTimezone++;
        continue;
      }
      
      // Check if it's the target hour (10 AM) in their timezone
      if (currentHourInUserTz !== TARGET_HOUR) {
        skippedReasons.wrongHour++;
        continue;
      }
      
      // Quick check using profile field first
      if (alreadySentTodayFromField(user.last_email_sent_at, timezone)) {
        console.log(`   ⏭️ Skipping ${user.email} - already sent today (field check, last: ${user.last_email_sent_at})`);
        skippedReasons.alreadySent++;
        continue;
      }
      
      candidateUsers.push({ user, timezone });
    }

    console.log(`\n🔍 Candidate users (passed hour filter): ${candidateUsers.length}`);
    console.log(`   Now performing database duplicate check...`);

    // Second pass: verify against email_logs table (reliable check)
    for (const { user, timezone } of candidateUsers) {
      // Double-check with email_logs table to prevent duplicates
      const alreadySentInLogs = await checkEmailLogsSentToday(supabase, user.id, timezone);
      
      if (alreadySentInLogs) {
        console.log(`   ⏭️ Skipping ${user.email} - found in email_logs for today`);
        skippedReasons.alreadySent++;
        continue;
      }
      
      // User is eligible for email
      console.log(`   ✅ Eligible: ${user.email} (timezone: ${timezone}, local hour: ${TARGET_HOUR})`);
      eligibleUsers.push(user);
    }

    console.log(`\n📈 Filter Summary:`);
    console.log(`   - Wrong hour in their timezone: ${skippedReasons.wrongHour}`);
    console.log(`   - Already sent today: ${skippedReasons.alreadySent}`);
    console.log(`   - Invalid timezone: ${skippedReasons.invalidTimezone}`);
    console.log(`   - ELIGIBLE FOR EMAIL: ${eligibleUsers.length}`);
    console.log(`🎯 ${eligibleUsers.length} users ready for email at this hour (${TARGET_HOUR}:00 in their timezone)`);

    if (!eligibleUsers || eligibleUsers.length === 0) {
      return res.status(200).json({ 
        message: `No users ready for email at this hour (looking for ${TARGET_HOUR}:00 in user timezones)`,
        processed: 0,
        totalSubscribed: allUsers?.length || 0
      });
    }

    // Fetch today's top articles
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: articles, error: articlesError } = await supabase
      .from('published_articles')
      .select('*')
      .gte('created_at', twentyFourHoursAgo)
      .order('ai_final_score', { ascending: false })
      .limit(10);

    if (articlesError) {
      console.error('❌ Error fetching articles:', articlesError);
      throw articlesError;
    }

    console.log(`📰 Found ${articles?.length || 0} articles for digest`);

    if (!articles || articles.length === 0) {
      return res.status(200).json({ 
        message: 'No articles to send',
        processed: 0 
      });
    }

    // Send emails sequentially with delay to avoid Resend rate limits (2/sec max)
    let sentCount = 0;
    let failedCount = 0;
    const results = [];

    for (const user of eligibleUsers) {
      // Add delay between emails (600ms = ~1.6 emails/sec, safely under 2/sec limit)
      if (results.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 600));
      }
      
      const result = await (async () => {
        try {
          // Personalize articles if enabled
          let userArticles = articles;
          if (user.email_personalization_enabled && user.preferred_categories?.length > 0) {
            // Prioritize articles matching user's interests
            userArticles = [...articles].sort((a, b) => {
              const aMatch = user.preferred_categories.includes(a.category) ? 1 : 0;
              const bMatch = user.preferred_categories.includes(b.category) ? 1 : 0;
              return bMatch - aMatch;
            });
          }

          // Generate personalized email using user's timezone
          const userTimezone = user.email_timezone || 'UTC';
          const emailHtml = generateDigestEmail(user, userArticles, userTimezone);
          const greeting = getGreeting(userTimezone);
          const date = new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric',
            timeZone: userTimezone
          });

          // Send email via Resend
          const { data: emailData, error: emailError } = await resend.emails.send({
            from: 'Today+ <info@todayplus.news>',
            to: user.email,
            subject: `${greeting} - Your Daily Brief for ${date}`,
            html: emailHtml,
          });

          if (emailError) throw emailError;

          // CRITICAL: Log successful send to email_logs FIRST
          // This is the source of truth for duplicate detection
          const { error: logError } = await supabase.from('email_logs').insert({
            user_id: user.id,
            email_type: 'daily_digest',
            subject: `${greeting} - Your Daily Brief for ${date}`,
            articles_included: userArticles.length,
            status: 'sent',
            resend_id: emailData?.id,
            metadata: { 
              personalized: user.email_personalization_enabled,
              timezone: user.email_timezone || 'UTC',
              sent_at_utc: new Date().toISOString()
            }
          });

          if (logError) {
            console.error(`⚠️ Failed to log email for ${user.email}:`, logError.message);
          }

          // Update last_email_sent_at in profiles (secondary check)
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ last_email_sent_at: new Date().toISOString() })
            .eq('id', user.id);

          if (updateError) {
            console.error(`⚠️ Failed to update last_email_sent_at for ${user.email}:`, updateError.message);
          }

          console.log(`✅ Sent to ${user.email} (logged: ${!logError}, profile updated: ${!updateError})`);
          return { success: true, email: user.email };
        } catch (error) {
          console.error(`❌ Failed for ${user.email}:`, error.message);
          
          // Log failed send
          await supabase.from('email_logs').insert({
            user_id: user.id,
            email_type: 'daily_digest',
            status: 'failed',
            metadata: { error: error.message }
          });
          
          return { success: false, email: user.email, error: error.message };
        }
      })();

      results.push(result);
      if (result.success) {
        sentCount++;
      } else {
        failedCount++;
      }
    }

    console.log(`📧 Daily digest complete: ${sentCount} sent, ${failedCount} failed`);

    return res.status(200).json({
      message: 'Daily digest job completed',
      sent: sentCount,
      failed: failedCount,
      totalEligible: eligibleUsers.length,
      articlesIncluded: articles.length
    });

  } catch (error) {
    console.error('❌ Daily digest job error:', error);
    return res.status(500).json({ 
      message: 'Failed to send daily digest', 
      error: error.message 
    });
  } finally {
    isProcessing = false;
  }
}

/**
 * Get appropriate greeting based on time of day in user's timezone
 */
function getGreeting(timezone) {
  try {
    const hour = parseInt(
      new Date().toLocaleString('en-US', { 
        hour: 'numeric', 
        hour12: false, 
        timeZone: timezone 
      })
    );
    
    if (hour >= 5 && hour < 12) return '☀️ Good Morning';
    if (hour >= 12 && hour < 17) return '🌤️ Good Afternoon';
    if (hour >= 17 && hour < 21) return '🌅 Good Evening';
    return '🌙 Your Evening Brief';
  } catch (e) {
    return '📰 Your Daily Brief';
  }
}

/**
 * Generate premium text-only email for daily digest
 * Inspired by top fintech design: clean, sophisticated, spacious
 */
function generateDigestEmail(user, articles, timezone = 'UTC') {
  const firstName = user.full_name?.split(' ')[0] || '';
  
  // Format date elegantly in user's timezone
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone
  });

  // Generate article list
  const articlesHtml = articles.map((article, index) => {
    const rawTitle = article.title_news || article.title || 'Untitled';
    // Remove ** markers, we'll style differently
    const cleanTitle = rawTitle.replace(/\*\*/g, '');
    const category = article.category || 'World';
    
    // Get a brief summary if available
    const summary = article.summary_news || article.summary || '';
    const truncatedSummary = summary.length > 120 ? summary.substring(0, 120) + '...' : summary;
    
    // Build article-specific URL (same as share button)
    const articleUrl = article.id 
      ? `https://todayplus.news/?article=${article.id}`
      : 'https://todayplus.news';
    
    return `
              <tr>
                <td style="padding: 0 0 32px 0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding: 0;">
                        
                        <!-- Number -->
                        <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #7c3aed; letter-spacing: 1px;">
                          ${String(index + 1).padStart(2, '0')}
                        </p>
                        
                        <!-- Title -->
                        <a href="${articleUrl}" style="text-decoration: none;">
                          <h2 style="margin: 0 0 10px 0; font-size: 18px; font-weight: 600; color: #111827; line-height: 1.4; letter-spacing: -0.3px;">
                            ${cleanTitle}
                          </h2>
                        </a>
                        
                        <!-- Summary -->
                        ${truncatedSummary ? `
                        <p style="margin: 0; font-size: 15px; font-weight: 400; color: #6b7280; line-height: 1.6;">
                          ${truncatedSummary}
                        </p>
                        ` : ''}
                        
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>`;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>Today+ Daily Brief</title>
      <style>
        @media only screen and (max-width: 600px) {
          .container { padding: 32px 20px !important; }
          .header { padding: 40px 20px !important; }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
      
      <!-- Wrapper -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fafafa;">
        <tr>
          <td align="center" style="padding: 40px 16px;">
            
            <!-- Card -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width: 520px; width: 100%; background-color: #ffffff; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
              
              <!-- Header -->
              <tr>
                <td class="header" style="padding: 48px 40px 40px 40px; border-bottom: 1px solid #f3f4f6;">
                  
                  <!-- Logo -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td>
                        <h1 style="margin: 0 0 4px 0; font-size: 24px; font-weight: 700; color: #111827; letter-spacing: -0.5px;">
                          Today<span style="color: #7c3aed;">+</span>
                        </h1>
                        <p style="margin: 0; font-size: 13px; font-weight: 500; color: #9ca3af;">
                          ${dateStr}
                        </p>
                      </td>
                    </tr>
                  </table>
                  
                  ${firstName ? `
                  <!-- Greeting -->
                  <p style="margin: 24px 0 0 0; font-size: 16px; font-weight: 400; color: #374151; line-height: 1.5;">
                    Good ${getTimeGreeting(timezone)}, ${firstName}. Here's what matters today.
                  </p>
                  ` : `
                  <p style="margin: 24px 0 0 0; font-size: 16px; font-weight: 400; color: #374151; line-height: 1.5;">
                    Here's what matters today.
                  </p>
                  `}
                  
                </td>
              </tr>
              
              <!-- Articles -->
              <tr>
                <td class="container" style="padding: 40px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    ${articlesHtml}
                  </table>
                </td>
              </tr>
              
              <!-- CTA -->
              <tr>
                <td style="padding: 0 40px 48px 40px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center">
                        <a href="https://todayplus.news" style="display: inline-block; background-color: #111827; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 14px; font-weight: 500; letter-spacing: 0.2px;">
                          Continue reading
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 24px 40px; background-color: #fafafa; border-top: 1px solid #f3f4f6; border-radius: 0 0 16px 16px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center">
                        <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.6;">
                          You're receiving this because you subscribed to Today+
                        </p>
                        <p style="margin: 8px 0 0 0; font-size: 12px;">
                          <a href="https://todayplus.news/unsubscribe" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a>
                          <span style="color: #d1d5db; padding: 0 8px;">·</span>
                          <a href="https://todayplus.news" style="color: #6b7280; text-decoration: underline;">View online</a>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
            </table>
            
          </td>
        </tr>
      </table>
      
    </body>
    </html>
  `;
}

/**
 * Get time of day greeting word based on timezone
 */
function getTimeGreeting(timezone = 'UTC') {
  try {
    const hour = parseInt(
      new Date().toLocaleString('en-US', { 
        hour: 'numeric', 
        hour12: false, 
        timeZone: timezone 
      })
    );
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'evening';
  } catch (e) {
    return 'morning'; // Default to morning since we're sending at 10 AM
  }
}

