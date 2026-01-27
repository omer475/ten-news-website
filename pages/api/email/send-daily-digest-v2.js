import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Daily Digest Email Sender v2 - Queue-Based
 * 
 * This version uses Supabase functions to handle timezone logic
 * and a queue table to process emails in batches.
 * 
 * Benefits:
 * - Timezone logic runs in PostgreSQL (fast, no JS timeout issues)
 * - Queue survives Vercel timeouts - continues from where it left off
 * - No duplicate emails (enforced by database unique constraint)
 * - Can handle unlimited users by processing in batches
 * 
 * How it works:
 * 1. First, queue all eligible users (calls Supabase function)
 * 2. Then, process pending queue in batches
 * 3. If timeout occurs, next cron run continues processing
 */

const TARGET_HOUR = 10;
const BATCH_SIZE = 20; // Process 20 emails per run to stay under timeout

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Verify authorization
  const authHeader = req.headers.authorization;
  const cronSecret = req.headers['x-cron-secret'];
  
  if (cronSecret !== process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const startTime = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📧 DAILY DIGEST v2 - Queue-Based System`);
  console.log(`📅 Time: ${new Date().toISOString()}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // Step 1: Queue eligible users (this runs timezone logic in PostgreSQL)
    console.log('📝 Step 1: Queuing eligible users...');
    const { data: queueResult, error: queueError } = await supabase
      .rpc('queue_daily_emails', { target_hour: TARGET_HOUR });

    if (queueError) {
      console.error('❌ Error queuing emails:', queueError);
      // Continue anyway - there might be pending emails from previous run
    } else {
      console.log(`✅ Queued ${queueResult || 0} new users for email`);
    }

    // Step 2: Get pending emails from queue
    console.log(`\n📤 Step 2: Processing pending queue (batch size: ${BATCH_SIZE})...`);
    const { data: pendingEmails, error: pendingError } = await supabase
      .rpc('get_pending_emails', { batch_size: BATCH_SIZE });

    if (pendingError) {
      console.error('❌ Error getting pending emails:', pendingError);
      throw pendingError;
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      console.log('✅ No pending emails to process');
      return res.status(200).json({
        message: 'No pending emails',
        queued: queueResult || 0,
        sent: 0,
        elapsed_ms: Date.now() - startTime
      });
    }

    console.log(`📋 Found ${pendingEmails.length} pending emails to send`);

    // Step 3: Fetch articles for the digest
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: articles, error: articlesError } = await supabase
      .from('published_articles')
      .select('*')
      .gte('created_at', twentyFourHoursAgo)
      .order('ai_final_score', { ascending: false })
      .limit(10);

    if (articlesError || !articles?.length) {
      console.log('⚠️ No articles available');
      // Mark all as failed since we have no content
      for (const email of pendingEmails) {
        await supabase.rpc('mark_email_failed', { 
          queue_id_param: email.queue_id, 
          error_msg: 'No articles available' 
        });
      }
      return res.status(200).json({
        message: 'No articles to send',
        queued: queueResult || 0,
        sent: 0
      });
    }

    console.log(`📰 Found ${articles.length} articles for digest`);

    // Step 4: Send emails
    let sentCount = 0;
    let failedCount = 0;

    for (const emailRecord of pendingEmails) {
      // Check if we're running out of time (leave 10 seconds buffer)
      if (Date.now() - startTime > 50000) {
        console.log('⏱️ Running low on time, stopping batch. Will continue next run.');
        break;
      }

      try {
        // Personalize articles
        let userArticles = articles;
        if (emailRecord.email_personalization_enabled && emailRecord.preferred_categories?.length > 0) {
          userArticles = [...articles].sort((a, b) => {
            const aMatch = emailRecord.preferred_categories.includes(a.category) ? 1 : 0;
            const bMatch = emailRecord.preferred_categories.includes(b.category) ? 1 : 0;
            return bMatch - aMatch;
          });
        }

        // Generate email
        const timezone = emailRecord.timezone || 'UTC';
        const emailHtml = generateDigestEmail(emailRecord, userArticles, timezone);
        const greeting = getGreeting(timezone);
        const date = new Date().toLocaleDateString('en-US', { 
          weekday: 'long', 
          month: 'long', 
          day: 'numeric',
          timeZone: timezone
        });

        // Send via Resend
        const { data: emailData, error: emailError } = await resend.emails.send({
          from: 'Today+ <info@todayplus.news>',
          to: emailRecord.email,
          subject: `${greeting} - Your Daily Brief for ${date}`,
          html: emailHtml,
        });

        if (emailError) throw emailError;

        // Mark as sent in queue and log
        await Promise.all([
          supabase.rpc('mark_email_sent', { 
            queue_id_param: emailRecord.queue_id, 
            user_id_param: emailRecord.user_id 
          }),
          supabase.from('email_logs').insert({
            user_id: emailRecord.user_id,
            email_type: 'daily_digest',
            subject: `${greeting} - Your Daily Brief for ${date}`,
            articles_included: userArticles.length,
            status: 'sent',
            resend_id: emailData?.id,
            metadata: { 
              timezone,
              queue_id: emailRecord.queue_id,
              version: 'v2'
            }
          })
        ]);

        console.log(`✅ Sent to ${emailRecord.email}`);
        sentCount++;

        // Small delay between emails (Resend rate limit)
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`❌ Failed for ${emailRecord.email}:`, error.message);
        await supabase.rpc('mark_email_failed', { 
          queue_id_param: emailRecord.queue_id, 
          error_msg: error.message 
        });
        failedCount++;
      }
    }

    // Check if there are more pending
    const { count: remainingCount } = await supabase
      .from('email_send_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const elapsed = Date.now() - startTime;
    console.log(`\n📧 Batch complete: ${sentCount} sent, ${failedCount} failed`);
    console.log(`⏱️ Elapsed: ${elapsed}ms`);
    if (remainingCount > 0) {
      console.log(`📋 ${remainingCount} emails still pending (will process next run)`);
    }

    return res.status(200).json({
      message: 'Daily digest batch completed',
      queued: queueResult || 0,
      sent: sentCount,
      failed: failedCount,
      remaining: remainingCount || 0,
      elapsed_ms: elapsed
    });

  } catch (error) {
    console.error('❌ Daily digest error:', error);
    return res.status(500).json({ 
      message: 'Failed to send daily digest', 
      error: error.message 
    });
  }
}

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

function generateDigestEmail(user, articles, timezone = 'UTC') {
  const firstName = user.full_name?.split(' ')[0] || '';
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone
  });

  const articlesHtml = articles.map((article, index) => {
    const rawTitle = article.title_news || article.title || 'Untitled';
    const cleanTitle = rawTitle.replace(/\*\*/g, '');
    const summary = article.summary_news || article.summary || '';
    const truncatedSummary = summary.length > 120 ? summary.substring(0, 120) + '...' : summary;
    const articleUrl = article.id 
      ? `https://todayplus.news/?article=${article.id}`
      : 'https://todayplus.news';
    
    return `
      <tr>
        <td style="padding: 0 0 32px 0;">
          <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #7c3aed; letter-spacing: 1px;">
            ${String(index + 1).padStart(2, '0')}
          </p>
          <a href="${articleUrl}" style="text-decoration: none;">
            <h2 style="margin: 0 0 10px 0; font-size: 18px; font-weight: 600; color: #111827; line-height: 1.4;">
              ${cleanTitle}
            </h2>
          </a>
          ${truncatedSummary ? `
          <p style="margin: 0; font-size: 15px; color: #6b7280; line-height: 1.6;">
            ${truncatedSummary}
          </p>
          ` : ''}
        </td>
      </tr>`;
  }).join('');

  const timeGreeting = (() => {
    try {
      const hour = parseInt(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: timezone }));
      if (hour >= 5 && hour < 12) return 'morning';
      if (hour >= 12 && hour < 17) return 'afternoon';
      return 'evening';
    } catch { return 'morning'; }
  })();

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Today+ Daily Brief</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fafafa;">
        <tr>
          <td align="center" style="padding: 40px 16px;">
            <table cellpadding="0" cellspacing="0" border="0" style="max-width: 520px; width: 100%; background-color: #ffffff; border-radius: 16px;">
              
              <!-- Header -->
              <tr>
                <td style="padding: 48px 40px 40px 40px; border-bottom: 1px solid #f3f4f6;">
                  <h1 style="margin: 0 0 4px 0; font-size: 24px; font-weight: 700; color: #111827;">
                    Today<span style="color: #7c3aed;">+</span>
                  </h1>
                  <p style="margin: 0; font-size: 13px; color: #9ca3af;">${dateStr}</p>
                  ${firstName ? `
                  <p style="margin: 24px 0 0 0; font-size: 16px; color: #374151;">
                    Good ${timeGreeting}, ${firstName}. Here's what matters today.
                  </p>
                  ` : `
                  <p style="margin: 24px 0 0 0; font-size: 16px; color: #374151;">
                    Here's what matters today.
                  </p>
                  `}
                </td>
              </tr>
              
              <!-- Articles -->
              <tr>
                <td style="padding: 40px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    ${articlesHtml}
                  </table>
                </td>
              </tr>
              
              <!-- CTA -->
              <tr>
                <td style="padding: 0 40px 48px 40px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center">
                        <a href="https://todayplus.news" style="display: inline-block; background-color: #111827; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 14px; font-weight: 500;">
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
                  <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
                    You're receiving this because you subscribed to Today+
                  </p>
                  <p style="margin: 8px 0 0 0; font-size: 12px; text-align: center;">
                    <a href="https://todayplus.news/unsubscribe" style="color: #6b7280;">Unsubscribe</a>
                    <span style="color: #d1d5db; padding: 0 8px;">·</span>
                    <a href="https://todayplus.news" style="color: #6b7280;">View online</a>
                  </p>
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
