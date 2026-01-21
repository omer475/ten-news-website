import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize Supabase with service role for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Re-engagement Email Sender
 * 
 * Sends "We miss you!" style emails to users who haven't been active.
 * 
 * Strategy:
 * - 7 days inactive: "Here's what you missed this week"
 * - 14 days inactive: "Your personalized news is waiting"
 * - 30 days inactive: "Come back - here's what's happening"
 * 
 * Only sends one re-engagement email every 14 days to avoid spam.
 */

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

  console.log('🔄 Starting re-engagement email job...');

  try {
    // First, update inactive user counts
    await supabase.rpc('update_inactive_users').catch(() => {
      console.log('⚠️ update_inactive_users function not found, calculating manually');
    });

    // Fetch users who need re-engagement
    const { data: inactiveUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id, email, full_name, consecutive_days_inactive, last_app_activity_at, articles_read_count, reengagement_email_sent_at')
      .eq('newsletter_subscribed', true)
      .not('email', 'is', null)
      .gte('consecutive_days_inactive', 7)
      .or('reengagement_email_sent_at.is.null,reengagement_email_sent_at.lt.' + new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString());

    if (usersError) {
      console.error('❌ Error fetching inactive users:', usersError);
      throw usersError;
    }

    console.log(`📋 Found ${inactiveUsers?.length || 0} inactive users needing re-engagement`);

    if (!inactiveUsers || inactiveUsers.length === 0) {
      return res.status(200).json({ 
        message: 'No users need re-engagement',
        processed: 0 
      });
    }

    // Fetch recent top articles (last 7 days for catching up)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: articles, error: articlesError } = await supabase
      .from('published_articles')
      .select('*')
      .gte('created_at', sevenDaysAgo)
      .order('ai_final_score', { ascending: false })
      .limit(5);

    if (articlesError) {
      console.error('❌ Error fetching articles:', articlesError);
      throw articlesError;
    }

    console.log(`📰 Found ${articles?.length || 0} articles for re-engagement`);

    // Send emails
    let sentCount = 0;
    let failedCount = 0;

    for (const user of inactiveUsers) {
      try {
        const daysInactive = user.consecutive_days_inactive || 7;
        const emailHtml = generateReengagementEmail(user, articles, daysInactive);
        const subject = getReengagementSubject(daysInactive, user.full_name);

        const { data: emailData, error: emailError } = await resend.emails.send({
          from: 'Today+ <info@todayplus.news>',
          to: user.email,
          subject: subject,
          html: emailHtml,
        });

        if (emailError) throw emailError;

        // Log and update
        await Promise.all([
          supabase.from('email_logs').insert({
            user_id: user.id,
            email_type: 'reengagement',
            subject: subject,
            articles_included: articles?.length || 0,
            status: 'sent',
            resend_id: emailData?.id,
            metadata: { days_inactive: daysInactive }
          }),
          supabase
            .from('profiles')
            .update({ reengagement_email_sent_at: new Date().toISOString() })
            .eq('id', user.id)
        ]);

        console.log(`✅ Re-engagement sent to ${user.email} (${daysInactive} days inactive)`);
        sentCount++;

        // Delay between emails
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Failed for ${user.email}:`, error.message);
        failedCount++;
      }
    }

    console.log(`🔄 Re-engagement complete: ${sentCount} sent, ${failedCount} failed`);

    return res.status(200).json({
      message: 'Re-engagement job completed',
      sent: sentCount,
      failed: failedCount,
      totalInactive: inactiveUsers.length
    });

  } catch (error) {
    console.error('❌ Re-engagement job error:', error);
    return res.status(500).json({ 
      message: 'Failed to send re-engagement emails', 
      error: error.message 
    });
  }
}

/**
 * Get compelling subject line based on how long they've been inactive
 */
function getReengagementSubject(daysInactive, fullName) {
  const firstName = fullName?.split(' ')[0] || 'there';
  
  if (daysInactive >= 30) {
    return `${firstName}, a lot has happened. Here's your catch-up 📰`;
  } else if (daysInactive >= 14) {
    return `We saved these stories just for you, ${firstName} ✨`;
  } else {
    return `${firstName}, here's what you missed this week 👀`;
  }
}

/**
 * Generate re-engagement email based on inactivity level
 */
function generateReengagementEmail(user, articles, daysInactive) {
  const firstName = user.full_name?.split(' ')[0] || 'there';
  
  // Different messaging based on how long they've been away
  let heroMessage, subMessage;
  
  if (daysInactive >= 30) {
    heroMessage = "A lot has happened while you were away";
    subMessage = `It's been ${daysInactive} days since we last saw you. The world didn't stop - here are the stories that defined this month.`;
  } else if (daysInactive >= 14) {
    heroMessage = "Your personalized news is waiting";
    subMessage = `We've been saving the best stories for you. Here's what everyone's been talking about.`;
  } else {
    heroMessage = "Here's what you missed";
    subMessage = `Just ${daysInactive} days and look what happened! Here are the top stories you should know.`;
  }

  const articlesHtml = (articles || []).map((article, index) => {
    // Remove markdown **bold** syntax from title
    const rawTitle = article.title_news || article.title || 'Untitled';
    const title = rawTitle.replace(/\*\*/g, '');
    const category = article.category || 'World';
    const emoji = article.emoji || '📰';
    const url = article.url || 'https://todayplus.news';
    
    return `
      <div style="margin-bottom: 20px; padding: 20px; background: ${index === 0 ? 'linear-gradient(135deg, #f0f9ff, #e0f2fe)' : '#f8fafc'}; border-radius: 12px; border-left: 4px solid ${index === 0 ? '#3b82f6' : '#e5e7eb'};">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span style="font-size: 18px;">${emoji}</span>
          <span style="color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: 600;">${category}</span>
          ${index === 0 ? '<span style="background: #3b82f6; color: white; font-size: 10px; padding: 2px 8px; border-radius: 10px; font-weight: 700;">TOP STORY</span>' : ''}
        </div>
        <a href="${url}" style="color: #0f172a; text-decoration: none; font-size: 16px; font-weight: 700; line-height: 1.4; display: block;">
          ${title}
        </a>
      </div>
    `;
  }).join('');

  // Stats to make it personal
  const statsSection = user.articles_read_count > 0 ? `
    <div style="background: #fef3c7; padding: 16px 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; color: #92400e; font-size: 14px;">
        🏆 <strong>Your reading streak:</strong> You've read ${user.articles_read_count} articles total. Don't let it stop now!
      </p>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; background: white;">
        
        <!-- Hero -->
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%); color: white; padding: 50px 30px; text-align: center;">
          <p style="font-size: 48px; margin: 0 0 16px 0;">👋</p>
          <h1 style="font-size: 28px; font-weight: 800; margin: 0 0 12px 0; letter-spacing: -0.5px;">
            Hey ${firstName}!
          </h1>
          <p style="font-size: 20px; font-weight: 600; margin: 0 0 8px 0; color: #93c5fd;">
            ${heroMessage}
          </p>
          <p style="margin: 0; font-size: 14px; opacity: 0.8; line-height: 1.5;">
            ${subMessage}
          </p>
        </div>

        ${statsSection}

        <!-- Articles -->
        <div style="padding: 30px;">
          <h2 style="font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 20px 0; font-weight: 600;">
            📰 Top Stories You Missed
          </h2>
          ${articlesHtml}
        </div>

        <!-- CTA -->
        <div style="padding: 0 30px 40px;">
          <a href="https://todayplus.news" style="display: block; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; text-decoration: none; text-align: center; padding: 18px 24px; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);">
            📱 Open Today+
          </a>
          <p style="text-align: center; margin: 16px 0 0 0; color: #94a3b8; font-size: 13px;">
            Get back to staying informed in 2 minutes a day
          </p>
        </div>

        <!-- Footer -->
        <div style="background: #f8fafc; padding: 24px 30px; border-top: 1px solid #e5e7eb;">
          <p style="color: #64748b; margin: 0 0 8px 0; font-size: 13px; text-align: center;">
            We only send re-engagement emails occasionally when you haven't visited.
          </p>
          <p style="color: #94a3b8; margin: 0; font-size: 12px; text-align: center;">
            <a href="https://todayplus.news/settings" style="color: #64748b;">Update preferences</a> · 
            <a href="https://todayplus.news/unsubscribe" style="color: #64748b;">Unsubscribe</a>
          </p>
        </div>
        
      </div>
    </body>
    </html>
  `;
}
