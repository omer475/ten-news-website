/**
 * SIMPLE EMAIL CRON - Sends at 10 AM local time for each user
 * 
 * This endpoint is called by Vercel Cron every hour.
 * It only sends to users whose local time is EXACTLY 10 AM.
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

// Target hour: 10 AM
const TARGET_HOUR = 10;

export default async function handler(req, res) {
  // Verify authorization
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now = new Date();
  console.log('\n========================================');
  console.log('📧 EMAIL CRON STARTED');
  console.log(`⏰ UTC Time: ${now.toISOString()}`);
  console.log(`🎯 Target: Send to users at 10 AM local time`);
  console.log('========================================\n');

  try {
    // Step 1: Get ALL subscribed users
    const { data: allUsers, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email, full_name, email_timezone, last_email_sent_at, preferred_categories, email_personalization_enabled')
      .eq('newsletter_subscribed', true)
      .not('email', 'is', null);

    if (fetchError) throw fetchError;

    console.log(`📋 Total subscribed users: ${allUsers?.length || 0}`);

    // Step 2: Filter to users at 10 AM AND not sent today
    const eligibleUsers = [];
    
    for (const user of (allUsers || [])) {
      const tz = user.email_timezone || 'UTC';
      
      // Get current hour in user's timezone
      let userHour;
      try {
        userHour = parseInt(now.toLocaleString('en-US', { 
          timeZone: tz, 
          hour: 'numeric', 
          hour12: false 
        }));
      } catch (e) {
        userHour = now.getUTCHours();
      }

      // CHECK 1: Is it 10 AM for this user?
      if (userHour !== TARGET_HOUR) {
        console.log(`⏭️ ${user.email}: Skip (${tz} = ${userHour}:00, not 10 AM)`);
        continue;
      }

      // CHECK 2: Already sent today?
      if (user.last_email_sent_at) {
        const lastSent = new Date(user.last_email_sent_at);
        let todayLocal, lastSentLocal;
        try {
          todayLocal = now.toLocaleDateString('en-CA', { timeZone: tz });
          lastSentLocal = lastSent.toLocaleDateString('en-CA', { timeZone: tz });
        } catch (e) {
          todayLocal = now.toISOString().split('T')[0];
          lastSentLocal = lastSent.toISOString().split('T')[0];
        }
        
        if (todayLocal === lastSentLocal) {
          console.log(`⏭️ ${user.email}: Skip (already sent today: ${lastSentLocal})`);
          continue;
        }
      }

      // This user is eligible!
      console.log(`✅ ${user.email}: ELIGIBLE (${tz} = 10 AM)`);
      eligibleUsers.push(user);
    }

    console.log(`\n🎯 Eligible users: ${eligibleUsers.length}`);

    if (eligibleUsers.length === 0) {
      return res.status(200).json({
        message: 'No users at 10 AM local time right now',
        checked: allUsers?.length || 0,
        sent: 0
      });
    }

    // Step 3: Get articles
    const { data: articles } = await supabase
      .from('published_articles')
      .select('*')
      .gte('created_at', new Date(Date.now() - 24*60*60*1000).toISOString())
      .order('ai_final_score', { ascending: false })
      .limit(10);

    if (!articles?.length) {
      return res.status(200).json({ message: 'No articles available', sent: 0 });
    }

    // Step 4: Send emails
    let sent = 0, failed = 0;

    for (const user of eligibleUsers) {
      try {
        const tz = user.email_timezone || 'UTC';
        const dateStr = now.toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', timeZone: tz
        });

        // Simple email HTML
        const html = generateEmailHTML(user, articles, dateStr);

        // Send email
        const { error: sendError } = await resend.emails.send({
          from: 'Today+ <info@todayplus.news>',
          to: user.email,
          subject: `☀️ Good Morning - Your Daily Brief for ${dateStr}`,
          html: html
        });

        if (sendError) throw sendError;

        // Update last_email_sent_at
        await supabase
          .from('profiles')
          .update({ last_email_sent_at: now.toISOString() })
          .eq('id', user.id);

        // Log success
        await supabase.from('email_logs').insert({
          user_id: user.id,
          email_type: 'daily_digest',
          status: 'sent',
          metadata: { timezone: tz, hour: 10 }
        });

        console.log(`📧 Sent to ${user.email}`);
        sent++;
        
        // Rate limit
        await new Promise(r => setTimeout(r, 500));

      } catch (err) {
        console.error(`❌ Failed ${user.email}: ${err.message}`);
        failed++;
      }
    }

    console.log(`\n✅ Done: ${sent} sent, ${failed} failed`);

    return res.status(200).json({
      message: 'Email cron completed',
      checked: allUsers?.length || 0,
      eligible: eligibleUsers.length,
      sent,
      failed
    });

  } catch (error) {
    console.error('❌ Cron error:', error);
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
