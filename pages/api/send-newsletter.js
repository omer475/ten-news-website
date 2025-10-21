import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Security: Only allow requests with the correct secret
  const { secret, newsData } = req.body;
  if (secret !== process.env.NEWSLETTER_SECRET) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    // Read subscribers
    const subscribersFile = path.join(process.cwd(), 'subscribers.json');
    let subscribers = [];

    try {
      if (fs.existsSync(subscribersFile)) {
        const data = fs.readFileSync(subscribersFile, 'utf8');
        subscribers = JSON.parse(data).filter(sub => sub.active);
      }
    } catch (error) {
      console.log('No subscribers file found');
      return res.status(200).json({ message: 'No subscribers to send to' });
    }

    if (subscribers.length === 0) {
      return res.status(200).json({ message: 'No active subscribers' });
    }

    // Create email template
    const createNewsletterHTML = (newsData) => {
      const articles = newsData.articles || [];
      const greeting = newsData.dailyGreeting || 'Good morning!';
      const date = newsData.displayDate || new Date().toLocaleDateString();

      return `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center;">
            <h1 style="font-size: 32px; font-weight: 800; margin: 0 0 8px 0;">
              <span style="color: #fbbf24;">TEN</span> NEWS
            </h1>
            <p style="margin: 0; font-size: 16px; opacity: 0.9;">${date}</p>
            <p style="margin: 8px 0 0 0; font-size: 18px; font-weight: 600;">${greeting}</p>
          </div>

          <!-- Articles -->
          <div style="padding: 30px;">
            ${articles.map((article, index) => `
              <div style="margin-bottom: 30px; padding-bottom: 24px; border-bottom: ${index < articles.length - 1 ? '1px solid #e5e7eb' : 'none'};">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                  <span style="background: rgba(59, 130, 246, 0.1); color: #3b82f6; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 700;">${article.rank}</span>
                  <span style="font-size: 16px;">${article.emoji}</span>
                  <span style="background: rgba(100, 116, 139, 0.1); color: #64748b; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase;">${article.category}</span>
                </div>
                
                <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; line-height: 1.3;">
                  ${article.title}
                </h2>
                
                <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0; font-size: 16px;">
                  ${article.summary}
                </p>
                
                ${article.details && article.details.length > 0 ? `
                  <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 12px;">
                    <div style="display: flex; gap: 20px; text-align: center;">
                      ${article.details.slice(0, 3).map(detail => {
                        const [label, value] = detail.split(':');
                        return `
                          <div style="flex: 1;">
                            <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px;">${label?.trim()}</div>
                            <div style="font-size: 16px; font-weight: 700; color: #1e293b;">${value?.trim()}</div>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>
                ` : ''}
                
                <a href="${article.url}" style="color: #3b82f6; text-decoration: none; font-weight: 600; font-size: 14px;">
                  Read full article →
                </a>
              </div>
            `).join('')}
          </div>

          <!-- Footer -->
          <div style="background: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #64748b; margin: 0 0 8px 0; font-size: 14px;">
              You're receiving this because you subscribed to Ten News
            </p>
            <p style="color: #94a3b8; margin: 0; font-size: 12px;">
              To unsubscribe, reply to this email with "UNSUBSCRIBE"
            </p>
          </div>
        </div>
      `;
    };

    // Send to all subscribers
    const emailHTML = createNewsletterHTML(newsData);
    const subject = `${newsData.dailyGreeting || 'Ten News Daily Digest'} - ${newsData.displayDate || new Date().toLocaleDateString()}`;

    // Send emails in batches to avoid rate limits
    const batchSize = 50;
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);
      
      try {
        await resend.emails.send({
          from: 'Ten News <onboarding@resend.dev>',
          to: batch.map(sub => sub.email),
          subject: subject,
          html: emailHTML,
        });
        
        sentCount += batch.length;
        console.log(`✅ Sent newsletter to ${batch.length} subscribers (batch ${Math.floor(i/batchSize) + 1})`);
        
        // Small delay between batches
        if (i + batchSize < subscribers.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`❌ Failed to send batch ${Math.floor(i/batchSize) + 1}:`, error);
        failedCount += batch.length;
      }
    }

    console.log(`📧 Newsletter sent: ${sentCount} successful, ${failedCount} failed`);
    return res.status(200).json({ 
      message: `Newsletter sent to ${sentCount} subscribers`,
      sent: sentCount,
      failed: failedCount
    });

  } catch (error) {
    console.error('Newsletter sending error:', error);
    return res.status(500).json({ message: 'Failed to send newsletter' });
  }
}
