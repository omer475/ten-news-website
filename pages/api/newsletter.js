import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email } = req.body;

  // Validate email
  if (!email || !email.includes('@')) {
    return res.status(400).json({ message: 'Valid email required' });
  }

  try {
    // Store email in local file (simple approach)
    const subscribersFile = path.join(process.cwd(), 'subscribers.json');
    let subscribers = [];

    // Read existing subscribers
    try {
      if (fs.existsSync(subscribersFile)) {
        const data = fs.readFileSync(subscribersFile, 'utf8');
        subscribers = JSON.parse(data);
      }
    } catch (error) {
      console.log('Creating new subscribers file');
    }

    // Check if email already exists
    if (subscribers.some(sub => sub.email === email)) {
      return res.status(400).json({ message: 'Email already subscribed' });
    }

    // Add new subscriber
    subscribers.push({
      email,
      subscribedAt: new Date().toISOString(),
      active: true
    });

    // Save subscribers
    fs.writeFileSync(subscribersFile, JSON.stringify(subscribers, null, 2));

    // Send welcome email
    await resend.emails.send({
      from: 'Ten News <news@tennews.com>', // You'll need to verify this domain in Resend
      to: email,
      subject: 'Welcome to Ten News - Daily Global Digest',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 40px;">
            <h1 style="font-size: 32px; font-weight: 800; margin: 0; color: #0f172a;">
              <span style="color: #3b82f6;">TEN</span> NEWS
            </h1>
            <p style="color: #64748b; margin: 8px 0 0 0;">Daily Global Digest</p>
          </div>
          
          <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 24px;">Welcome to Ten News! 🎉</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0;">
              Thank you for subscribing to Ten News. You'll now receive our daily digest of the 10 most important global stories, carefully curated by AI and delivered every morning at 7 AM UK time.
            </p>
          </div>
          
          <div style="margin-bottom: 24px;">
            <h3 style="color: #0f172a; margin: 0 0 12px 0; font-size: 18px;">What to expect:</h3>
            <ul style="color: #475569; line-height: 1.6; margin: 0; padding-left: 20px;">
              <li>10 carefully selected global news stories</li>
              <li>40-50 word summaries in clear English</li>
              <li>Key details and context for each story</li>
              <li>Stories from trusted sources worldwide</li>
              <li>Delivered daily at 7 AM UK time</li>
            </ul>
          </div>
          
          <div style="text-align: center; padding: 20px; background: #000; border-radius: 8px; color: white;">
            <p style="margin: 0; font-size: 14px;">
              Your first newsletter will arrive tomorrow morning.<br>
              Stay informed with Ten News!
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 24px;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              You can unsubscribe at any time by replying to any newsletter email.
            </p>
          </div>
        </div>
      `
    });

    console.log(`✅ New subscriber added: ${email}`);
    return res.status(200).json({ message: 'Successfully subscribed!' });

  } catch (error) {
    console.error('Newsletter signup error:', error);
    return res.status(500).json({ message: 'Failed to subscribe. Please try again.' });
  }
}
