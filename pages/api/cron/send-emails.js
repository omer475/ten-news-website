/**
 * DAILY EMAIL CRON - Sends daily digest to all users with an account
 * 
 * Runs once per day (Vercel Hobby plan limitation).
 * Sends to ALL users who have an email and haven't received an email in the last 20 hours.
 */

import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = {
  maxDuration: 60,
};

const MIN_HOURS_BETWEEN_EMAILS = 20;

export default async function handler(req, res) {
  // Verify authorization
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now = new Date();
  const nowMs = now.getTime();
  console.log('\n========================================');
  console.log('EMAIL CRON STARTED');
  console.log(`UTC Time: ${now.toISOString()}`);
  console.log(`Dedup: Skip if last email < ${MIN_HOURS_BETWEEN_EMAILS}h ago`);
  console.log('========================================\n');

  try {
    // Step 1: Get ALL users with an email address
    const { data: allUsers, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email, full_name, email_timezone, last_email_sent_at, preferred_categories, email_personalization_enabled')
      .not('email', 'is', null);

    if (fetchError) throw fetchError;

    console.log(`Total users with email: ${allUsers?.length || 0}`);

    if (!allUsers || allUsers.length === 0) {
      return res.status(200).json({
        message: 'No users found in profiles table',
        debug: {
          hasServiceKey: !!(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET',
        }
      });
    }

    // Step 2: Filter out users who already received email in the last 20 hours
    const eligibleUsers = [];
    let skippedRecentlySent = 0;

    for (const user of allUsers) {
      if (user.last_email_sent_at) {
        const hoursSinceLastEmail = (nowMs - new Date(user.last_email_sent_at).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastEmail < MIN_HOURS_BETWEEN_EMAILS) {
          console.log(`SKIP ${user.email}: sent ${hoursSinceLastEmail.toFixed(1)}h ago`);
          skippedRecentlySent++;
          continue;
        }
      }

      console.log(`ELIGIBLE ${user.email}`);
      eligibleUsers.push(user);
    }

    console.log(`\nFilter results: ${eligibleUsers.length} eligible, ${skippedRecentlySent} recently sent`);

    if (eligibleUsers.length === 0) {
      return res.status(200).json({
        message: 'No users eligible (all recently sent)',
        checked: allUsers.length,
        eligible: 0,
        sent: 0,
        skippedRecentlySent
      });
    }

    // Step 3: Get articles from last 24 hours
    const { data: articles } = await supabase
      .from('published_articles')
      .select('*')
      .gte('created_at', new Date(nowMs - 24 * 60 * 60 * 1000).toISOString())
      .order('ai_final_score', { ascending: false })
      .limit(10);

    if (!articles?.length) {
      return res.status(200).json({ message: 'No articles available in last 24h', sent: 0 });
    }

    console.log(`Found ${articles.length} articles for digest`);

    // Step 4: Send emails
    let sent = 0, failed = 0, skippedDedup = 0;

    for (const user of eligibleUsers) {
      try {
        // Re-check last_email_sent_at right before sending (prevents race conditions)
        const { data: freshUser } = await supabase
          .from('profiles')
          .select('last_email_sent_at')
          .eq('id', user.id)
          .single();

        if (freshUser?.last_email_sent_at) {
          const hoursSince = (nowMs - new Date(freshUser.last_email_sent_at).getTime()) / (1000 * 60 * 60);
          if (hoursSince < MIN_HOURS_BETWEEN_EMAILS) {
            skippedDedup++;
            continue;
          }
        }

        // Update last_email_sent_at BEFORE sending (acts as a lock)
        const { error: lockError } = await supabase
          .from('profiles')
          .update({ last_email_sent_at: now.toISOString() })
          .eq('id', user.id);

        if (lockError) {
          console.error(`LOCK FAILED ${user.email}: ${lockError.message}`);
          failed++;
          continue;
        }

        const tz = user.email_timezone || 'UTC';
        const dateStr = now.toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', timeZone: tz
        });

        const html = generateEmailHTML(user, articles, dateStr);

        // Send email via Resend
        const { data: emailData, error: sendError } = await resend.emails.send({
          from: 'Today+ <info@todayplus.news>',
          to: user.email,
          subject: `Your Daily Brief for ${dateStr}`,
          html: html
        });

        if (sendError) {
          // Rollback the lock if send failed
          await supabase
            .from('profiles')
            .update({ last_email_sent_at: user.last_email_sent_at || null })
            .eq('id', user.id);
          throw sendError;
        }

        // Log success
        await supabase.from('email_logs').insert({
          user_id: user.id,
          email_type: 'daily_digest',
          status: 'sent',
          resend_id: emailData?.id,
          metadata: { timezone: tz }
        });

        console.log(`SENT ${user.email}`);
        sent++;

        // Rate limit
        await new Promise(r => setTimeout(r, 500));

      } catch (err) {
        console.error(`FAILED ${user.email}: ${err.message}`);
        failed++;
      }
    }

    console.log(`\nDone: ${sent} sent, ${failed} failed, ${skippedDedup} dedup catches`);

    return res.status(200).json({
      message: 'Email cron completed',
      checked: allUsers.length,
      eligible: eligibleUsers.length,
      sent,
      failed,
      skippedDedup
    });

  } catch (error) {
    console.error('Cron error:', error);
    return res.status(500).json({ error: error.message });
  }
}

function generateEmailHTML(user, articles, dateStr) {
  const firstName = user.full_name?.split(' ')[0] || '';
  
  const articlesList = articles.slice(0, 5).map((a, i) => `
    <tr>
      <td style="padding: 16px 0; border-bottom: 1px solid #eee;">
        <span style="color: #7c3aed; font-weight: bold;">${i + 1}.</span>
        <a href="https://todayplus.news/?article=${a.id}" style="color: #111; text-decoration: none; font-weight: 600;">
          ${(a.title_news || a.title || '').replace(/\*\*/g, '')}
        </a>
      </td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #111;">Today<span style="color: #7c3aed;">+</span></h1>
      <p style="color: #666;">${dateStr}</p>
      ${firstName ? `<p>Good morning, ${firstName}. Here's what matters today.</p>` : '<p>Here\'s what matters today.</p>'}
      <table style="width: 100%; border-collapse: collapse;">
        ${articlesList}
      </table>
      <p style="margin-top: 24px;">
        <a href="https://todayplus.news" style="background: #111; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Continue reading</a>
      </p>
      <p style="margin-top: 32px; font-size: 12px; color: #999;">
        <a href="https://todayplus.news/unsubscribe" style="color: #999;">Unsubscribe</a>
      </p>
    </body>
    </html>
  `;
}
