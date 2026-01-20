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
 * It's designed to be called by a cron job (Vercel Cron, Supabase Edge Function, etc.)
 * 
 * Features:
 * - Time-optimized sending (sends at user's preferred hour in their timezone)
 * - Personalized content based on user interests
 * - Engagement tracking
 * - Batch processing to handle large subscriber lists
 */

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

  console.log('📧 Starting daily digest email job...');

  try {
    // Get current hour to find users who should receive email now
    const currentUtcHour = new Date().getUTCHours();
    console.log(`⏰ Current UTC hour: ${currentUtcHour}`);

    // Fetch users who are ready for their daily email at this hour
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, email, full_name, email_timezone, preferred_email_hour, preferred_categories, email_personalization_enabled, articles_read_count')
      .eq('newsletter_subscribed', true)
      .neq('email_frequency', 'never')
      .not('email', 'is', null);

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      throw usersError;
    }

    console.log(`📋 Found ${users?.length || 0} total subscribed users`);

    // Filter users whose local time matches their preferred hour
    const eligibleUsers = (users || []).filter(user => {
      const timezone = user.email_timezone || 'UTC';
      const preferredHour = user.preferred_email_hour ?? 7; // Default 7 AM
      
      try {
        // Get current hour in user's timezone
        const userLocalHour = parseInt(
          new Date().toLocaleString('en-US', { 
            hour: 'numeric', 
            hour12: false, 
            timeZone: timezone 
          })
        );
        
        return userLocalHour === preferredHour;
      } catch (e) {
        // If timezone is invalid, use UTC
        return currentUtcHour === preferredHour;
      }
    });

    console.log(`✅ ${eligibleUsers.length} users ready for email at their preferred time`);

    if (eligibleUsers.length === 0) {
      return res.status(200).json({ 
        message: 'No users ready for email at this hour',
        processed: 0 
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

    // Send emails in batches
    const batchSize = 10;
    let sentCount = 0;
    let failedCount = 0;
    const results = [];

    for (let i = 0; i < eligibleUsers.length; i += batchSize) {
      const batch = eligibleUsers.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (user) => {
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

          // Generate personalized email
          const emailHtml = generateDigestEmail(user, userArticles);
          const greeting = getGreeting(user.email_timezone || 'UTC');
          const date = new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric',
            timeZone: user.email_timezone || 'UTC'
          });

          // Send email via Resend
          const { data: emailData, error: emailError } = await resend.emails.send({
            from: 'Ten News <onboarding@resend.dev>',
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
              timezone: user.email_timezone,
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
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      sentCount += batchResults.filter(r => r.success).length;
      failedCount += batchResults.filter(r => !r.success).length;

      // Small delay between batches to respect rate limits
      if (i + batchSize < eligibleUsers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
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
 * Generate beautiful HTML email for daily digest
 */
function generateDigestEmail(user, articles) {
  const firstName = user.full_name?.split(' ')[0] || 'there';
  const articlesReadMsg = user.articles_read_count > 0 
    ? `You've read ${user.articles_read_count} articles so far!` 
    : 'Start your informed day!';
  
  const articlesHtml = articles.map((article, index) => {
    const title = article.title_news || article.title || 'Untitled';
    const summary = article.content_news?.substring(0, 150) || article.description?.substring(0, 150) || '';
    const category = article.category || 'World';
    const emoji = article.emoji || '📰';
    const url = article.url || '#';
    
    return `
      <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: ${index < articles.length - 1 ? '1px solid #e5e7eb' : 'none'};">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
          <span style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700;">${index + 1}</span>
          <span style="font-size: 18px;">${emoji}</span>
          <span style="background: #f1f5f9; color: #475569; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">${category}</span>
        </div>
        
        <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0; line-height: 1.4;">
          <a href="${url}" style="color: #0f172a; text-decoration: none;">${title}</a>
        </h2>
        
        <p style="color: #64748b; line-height: 1.6; margin: 0 0 12px 0; font-size: 15px;">
          ${summary}${summary.length >= 150 ? '...' : ''}
        </p>
        
        <a href="${url}" style="color: #3b82f6; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-flex; align-items: center; gap: 4px;">
          Read more <span style="font-size: 12px;">→</span>
        </a>
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; background: white;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 40px 30px; text-align: center;">
          <h1 style="font-size: 32px; font-weight: 800; margin: 0 0 8px 0; letter-spacing: -0.5px;">
            <span style="color: #3b82f6;">TEN</span> NEWS
          </h1>
          <p style="margin: 0 0 16px 0; font-size: 14px; opacity: 0.8; text-transform: uppercase; letter-spacing: 1px;">Daily Brief</p>
          <p style="margin: 0; font-size: 20px; font-weight: 600;">Hey ${firstName}! 👋</p>
          <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">${articlesReadMsg}</p>
        </div>

        <!-- Intro -->
        <div style="padding: 24px 30px; background: #f8fafc; border-bottom: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #475569; font-size: 15px; line-height: 1.6;">
            Here are the <strong>${articles.length} most important stories</strong> you need to know today. Curated by AI, delivered just for you.
          </p>
        </div>

        <!-- Articles -->
        <div style="padding: 30px;">
          ${articlesHtml}
        </div>

        <!-- CTA -->
        <div style="padding: 0 30px 30px;">
          <a href="https://tennews.ai" style="display: block; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; text-decoration: none; text-align: center; padding: 16px 24px; border-radius: 12px; font-weight: 700; font-size: 16px;">
            Read All Stories on Ten News →
          </a>
        </div>

        <!-- Footer -->
        <div style="background: #f8fafc; padding: 24px 30px; border-top: 1px solid #e5e7eb;">
          <p style="color: #64748b; margin: 0 0 8px 0; font-size: 13px; text-align: center;">
            You're receiving this because you subscribed to Ten News Daily Brief
          </p>
          <p style="color: #94a3b8; margin: 0; font-size: 12px; text-align: center;">
            <a href="https://tennews.ai/settings" style="color: #64748b;">Manage preferences</a> · 
            <a href="https://tennews.ai/unsubscribe" style="color: #64748b;">Unsubscribe</a>
          </p>
        </div>
        
      </div>
    </body>
    </html>
  `;
}

