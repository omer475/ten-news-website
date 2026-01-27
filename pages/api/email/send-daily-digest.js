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
 */

// Target hour for sending emails (10 AM in user's timezone)
const TARGET_HOUR = 10;

/**
 * Get current hour in a specific timezone
 */
function getCurrentHourInTimezone(timezone) {
  try {
    const hour = parseInt(
      new Date().toLocaleString('en-US', { 
        hour: 'numeric', 
        hour12: false, 
        timeZone: timezone 
      })
    );
    return hour;
  } catch (e) {
    // If timezone is invalid, return -1 to skip this user
    return -1;
  }
}

/**
 * Check if user already received email today (in their timezone)
 */
function alreadySentToday(lastEmailSentAt, timezone) {
  if (!lastEmailSentAt) return false;
  
  try {
    const lastSent = new Date(lastEmailSentAt);
    const now = new Date();
    
    // Get today's date in user's timezone
    const todayInTz = now.toLocaleDateString('en-US', { timeZone: timezone });
    const lastSentInTz = lastSent.toLocaleDateString('en-US', { timeZone: timezone });
    
    return todayInTz === lastSentInTz;
  } catch (e) {
    return false;
  }
}

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

  const currentUtcHour = new Date().getUTCHours();
  console.log(`📧 Starting daily digest email job... (UTC hour: ${currentUtcHour})`);

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

    // Filter users where it's currently 10 AM in their timezone
    // and they haven't received an email today
    const eligibleUsers = (allUsers || []).filter(user => {
      const timezone = user.email_timezone || 'UTC';
      const currentHourInUserTz = getCurrentHourInTimezone(timezone);
      
      // Check if it's the target hour (10 AM) in their timezone
      if (currentHourInUserTz !== TARGET_HOUR) {
        return false;
      }
      
      // Check if we already sent them an email today
      if (alreadySentToday(user.last_email_sent_at, timezone)) {
        console.log(`⏭️ Skipping ${user.email} - already sent today`);
        return false;
      }
      
      return true;
    });

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

          // Log successful send
          await supabase.from('email_logs').insert({
            user_id: user.id,
            email_type: 'daily_digest',
            subject: `${greeting} - Your Daily Brief for ${date}`,
            articles_included: userArticles.length,
            status: 'sent',
            resend_id: emailData?.id,
            metadata: { 
              personalized: user.email_personalization_enabled 
            }
          });

          // Update last email sent
          await supabase
            .from('profiles')
            .update({ last_email_sent_at: new Date().toISOString() })
            .eq('id', user.id);

          console.log(`✅ Sent to ${user.email}`);
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
                        <a href="https://todayplus.news" style="text-decoration: none;">
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

