import Head from 'next/head';

export default function Privacy() {
  return (
    <>
      <Head>
        <title>Privacy Policy - Today+</title>
        <meta name="description" content="Today+ Privacy Policy" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <div style={{
        maxWidth: '720px',
        margin: '0 auto',
        padding: '48px 24px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif',
        color: '#1d1d1f',
        lineHeight: '1.6',
      }}>
        <h1 style={{ fontSize: '34px', fontWeight: '700', marginBottom: '8px' }}>Privacy Policy</h1>
        <p style={{ color: '#86868b', fontSize: '15px', marginBottom: '40px' }}>Last updated: February 17, 2026</p>

        <Section title="1. Introduction">
          Today+ (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is a premium AI-powered news service available at
          todayplus.news and through third-party platforms including ChatGPT. This Privacy Policy
          explains how we collect, use, and protect your information.
        </Section>

        <Section title="2. Information We Collect">
          <strong>When you use our website or app:</strong>
          <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
            <li>Account information (email, name) if you sign up</li>
            <li>News preferences (selected topics and countries)</li>
            <li>Basic usage analytics (pages viewed, articles read)</li>
          </ul>
          <br />
          <strong>When you use Today+ through ChatGPT:</strong>
          <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
            <li>We do <strong>not</strong> collect any personal data from ChatGPT users</li>
            <li>API requests contain only filter parameters (topic, country, date) — no user identity</li>
            <li>We do not store, log, or track ChatGPT API requests</li>
          </ul>
        </Section>

        <Section title="3. How We Use Your Information">
          <ul style={{ paddingLeft: '20px' }}>
            <li>To personalize your news feed based on your selected preferences</li>
            <li>To send daily news digests if you opt in to email notifications</li>
            <li>To improve our news curation and scoring algorithms</li>
          </ul>
        </Section>

        <Section title="4. Data Sharing">
          We do <strong>not</strong> sell, rent, or share your personal information with third parties.
          We use Supabase for data storage and Vercel for hosting. These providers process data
          on our behalf under their respective privacy policies.
        </Section>

        <Section title="5. ChatGPT Integration">
          Our ChatGPT integration provides read-only access to published news articles via a public API.
          No authentication is required. No personal data is transmitted or stored through this integration.
          ChatGPT&apos;s handling of your conversations is governed by OpenAI&apos;s privacy policy.
        </Section>

        <Section title="6. Data Retention">
          Account data is retained while your account is active. You may request deletion of your
          account and associated data at any time by contacting us. Published news articles are
          retained indefinitely as part of our public news archive.
        </Section>

        <Section title="7. Cookies">
          We use essential cookies for authentication and session management. We do not use
          third-party tracking cookies or advertising cookies.
        </Section>

        <Section title="8. Your Rights">
          You have the right to access, correct, or delete your personal data. You may also
          opt out of email communications at any time. To exercise these rights, contact us
          at the email below.
        </Section>

        <Section title="9. Contact">
          For privacy-related questions or requests, contact us at:<br />
          <strong>privacy@todayplus.news</strong>
        </Section>

        <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid #d2d2d7', color: '#86868b', fontSize: '14px' }}>
          &copy; 2026 Today+. All rights reserved.
        </div>
      </div>
    </>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '32px' }}>
      <h2 style={{ fontSize: '22px', fontWeight: '600', marginBottom: '12px' }}>{title}</h2>
      <div style={{ fontSize: '16px', color: '#424245' }}>{children}</div>
    </div>
  );
}
