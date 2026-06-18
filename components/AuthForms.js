import { useState, useEffect } from 'react';

/* ------------------------------------------------------------------ */
/* Shared styles — namespaced `tpa-`. Clean editorial light system.    */
/* ------------------------------------------------------------------ */
function AuthStyles() {
  return (
    <style jsx global>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500..700&display=swap');
      @import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap');
      .tpa-card {
        --a: #CC2E22; --ink: #17150F; --mut: #6B6760; --line: rgba(23,21,15,0.12); --soft: #F4F1EB;
        width: 100%; max-width: 408px; position: relative;
        background: #FFFFFF; border: 1px solid var(--line); border-radius: 16px; padding: 30px 28px 24px;
        box-shadow: 0 24px 70px rgba(23,21,15,0.22);
        font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif; color: var(--ink);
        animation: tpaPop 0.4s cubic-bezier(0.22,1,0.36,1);
      }
      @keyframes tpaPop { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
      .tpa-close {
        position: absolute; top: 16px; right: 16px; z-index: 2;
        width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--line);
        background: #fff; color: var(--mut); font-size: 18px; line-height: 1; cursor: pointer;
        display: flex; align-items: center; justify-content: center; transition: background 0.15s, color .15s;
      }
      .tpa-close:hover { background: var(--soft); color: var(--ink); }
      .tpa-eyebrow { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; letter-spacing: 1.6px; color: var(--a); text-transform: uppercase; margin-bottom: 12px; }
      .tpa-eyebrow::before { content: ''; width: 16px; height: 2px; background: var(--a); }
      .tpa-title { font-family: 'Fraunces', Georgia, serif; font-size: 28px; font-weight: 600; letter-spacing: -0.4px; color: var(--ink); margin: 0 0 4px; line-height: 1.08; }
      .tpa-sub { font-size: 14.5px; color: var(--mut); margin-bottom: 20px; line-height: 1.5; }
      .tpa-oauth { display: flex; flex-direction: column; gap: 9px; }
      .tpa-oauth-btn {
        width: 100%; height: 48px; border-radius: 11px;
        display: flex; align-items: center; justify-content: center; gap: 10px;
        font-size: 15px; font-weight: 600; cursor: pointer; font-family: inherit;
        border: 1px solid var(--line); background: #fff; color: var(--ink);
        transition: background 0.15s, border-color .15s, transform 0.12s;
      }
      .tpa-oauth-btn:hover { background: var(--soft); }
      .tpa-oauth-btn:active { transform: scale(0.99); }
      .tpa-oauth-btn:disabled { opacity: 0.5; cursor: default; }
      .tpa-oauth-apple { background: #17150F; color: #fff; border-color: #17150F; }
      .tpa-oauth-apple:hover { background: #2a2720; }
      .tpa-divider { display: flex; align-items: center; gap: 12px; margin: 16px 0; color: #A8A296; font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; }
      .tpa-divider::before, .tpa-divider::after { content: ''; flex: 1; height: 1px; background: var(--line); }
      .tpa-field { margin-bottom: 13px; }
      .tpa-field label { display: block; font-size: 11px; font-weight: 700; color: var(--mut); margin-bottom: 7px; letter-spacing: 0.8px; text-transform: uppercase; }
      .tpa-field input {
        width: 100%; height: 48px; padding: 0 14px; font-size: 16px;
        border-radius: 11px; border: 1px solid var(--line); background: #FBFAF8;
        color: var(--ink); outline: none; transition: border 0.15s, box-shadow 0.15s, background .15s; font-family: inherit;
      }
      .tpa-field input:focus { border-color: var(--ink); background: #fff; box-shadow: 0 0 0 3px rgba(23,21,15,0.07); }
      .tpa-field input::placeholder { color: #B0AB9F; }
      .tpa-submit {
        width: 100%; height: 50px; border-radius: 11px; border: none; margin-top: 8px;
        font-size: 16px; font-weight: 700; color: #fff; cursor: pointer; font-family: inherit;
        background: var(--a); transition: transform 0.12s, box-shadow 0.2s, background .2s;
        box-shadow: 0 10px 24px rgba(204,46,34,0.26);
      }
      .tpa-submit:hover:not(:disabled) { background: #B5281D; transform: translateY(-1px); box-shadow: 0 14px 30px rgba(204,46,34,0.34); }
      .tpa-submit:active:not(:disabled) { transform: scale(0.985); }
      .tpa-submit:disabled { opacity: 0.4; cursor: default; box-shadow: none; }
      .tpa-link { background: none; border: none; color: var(--a); font-weight: 600; font-size: 13.5px; cursor: pointer; font-family: inherit; padding: 0; }
      .tpa-link:hover { text-decoration: underline; }
      .tpa-error { background: rgba(204,46,34,0.08); color: var(--a); font-size: 13.5px; font-weight: 600; padding: 11px 14px; border-radius: 10px; margin-bottom: 14px; }
      .tpa-foot { text-align: center; font-size: 14px; color: var(--mut); margin-top: 18px; }
      .tpa-meter { height: 5px; border-radius: 999px; background: var(--soft); margin: 9px 0 2px; overflow: hidden; }
      .tpa-meter > div { height: 100%; border-radius: 999px; transition: width 0.25s, background 0.25s; }
    `}</style>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/><path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 3.58z" fill="#EA4335"/></svg>
  );
}
function AppleIcon() {
  return (
    <svg width="16" height="19" viewBox="0 0 17 20" fill="#fff"><path d="M14.04 15.49c-.26.6-.57 1.16-.93 1.67-.49.7-.9 1.18-1.21 1.45-.49.45-1.01.68-1.57.69-.4 0-.89-.11-1.45-.35-.57-.23-1.09-.34-1.57-.34-.5 0-1.03.11-1.61.34-.58.24-1.05.36-1.41.37-.54.02-1.07-.22-1.59-.71-.34-.29-.77-.79-1.28-1.49-.55-.75-1-1.62-1.36-2.61C.31 13.86.09 12.83.09 11.83c0-1.14.25-2.13.74-2.95.39-.66.9-1.18 1.55-1.57.64-.38 1.34-.58 2.09-.59.42 0 .98.13 1.68.39.7.26 1.15.39 1.34.39.15 0 .65-.15 1.49-.46.8-.28 1.47-.4 2.02-.35 1.49.12 2.61.71 3.35 1.77-1.33.81-1.99 1.94-1.98 3.39.01 1.13.42 2.07 1.23 2.81.37.34.78.61 1.24.8-.1.29-.21.57-.32.83zM11.32.36c0 .85-.31 1.65-.93 2.39-.74.88-1.64 1.39-2.62 1.31a2.62 2.62 0 01-.02-.32c0-.82.36-1.69.99-2.41.32-.36.72-.66 1.21-.9.49-.23.95-.36 1.38-.39.01.11.01.21.01.32z"/></svg>
  );
}
function EnvelopeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
  );
}

export function OAuthButtons({ onOAuthLogin, onMagicLink }) {
  const [busy, setBusy] = useState(null);
  const click = async (p) => { setBusy(p); try { await onOAuthLogin(p); } catch { setBusy(null); } };
  return (
    <div className="tpa-oauth">
      <button type="button" className="tpa-oauth-btn" onClick={() => click('google')} disabled={!!busy}>
        <GoogleIcon />{busy === 'google' ? 'Redirecting…' : 'Continue with Google'}
      </button>
      <button type="button" className="tpa-oauth-btn tpa-oauth-apple" onClick={() => click('apple')} disabled={!!busy}>
        <AppleIcon />{busy === 'apple' ? 'Redirecting…' : 'Continue with Apple'}
      </button>
      {onMagicLink && (
        <button type="button" className="tpa-oauth-btn" onClick={onMagicLink} disabled={!!busy}>
          Email me a sign-in link
        </button>
      )}
    </div>
  );
}

/* Main self-contained auth card. mode: 'login' | 'signup' */
export function AuthPanel({
  mode = 'signup', onModeChange,
  onLogin, onSignup, onOAuthLogin, onMagicLink, onForgotPassword,
  error, onClose,
}) {
  const [sub, setSub] = useState(null); // null | 'forgot' | 'magic'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(null);

  const pwOk = password.length >= 8;
  const strength = Math.min(100, Math.round((Math.min(password.length, 12) / 12) * 100));
  const strengthColor = password.length >= 10 ? '#1F8A4C' : password.length >= 8 ? '#C98A00' : '#CC2E22';

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (sub === 'forgot') { await onForgotPassword(email); setSent('forgot'); }
      else if (sub === 'magic') { await onMagicLink(email); setSent('magic'); }
      else if (mode === 'login') { await onLogin(email, password); }
      else { await onSignup(email, password, fullName); }
    } finally { setLoading(false); }
  };

  if (sent) {
    return (
      <div className="tpa-card" onClick={(e) => e.stopPropagation()}>
        <AuthStyles />
        {onClose && <button className="tpa-close" onClick={onClose}>×</button>}
        <div style={{ textAlign: 'center', padding: '6px 0' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--a)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><EnvelopeIcon /></div>
          <h2 className="tpa-title" style={{ marginBottom: 8 }}>Check your inbox</h2>
          <p className="tpa-sub" style={{ marginBottom: 6 }}>
            We sent a {sent === 'magic' ? 'sign-in link' : 'password reset link'} to<br /><strong style={{ color: 'var(--ink)' }}>{email}</strong>
          </p>
          <p className="tpa-sub" style={{ fontSize: 13 }}>Tap the link to continue. Be sure to check spam.</p>
          <button className="tpa-link" onClick={() => { setSent(null); setSub(null); }} style={{ marginTop: 4 }}>← Back</button>
        </div>
      </div>
    );
  }

  const headline = sub === 'forgot' ? 'Reset your password'
    : sub === 'magic' ? 'Sign in with a link'
    : mode === 'login' ? 'Welcome back' : 'Create your account';
  const subline = sub === 'forgot' ? "We’ll email you a reset link."
    : sub === 'magic' ? 'No password needed — we’ll email you a link.'
    : mode === 'login' ? 'Pick up your briefing where you left off.' : 'Your daily briefing, in under a minute.';
  const eyebrow = sub === 'forgot' ? 'Account recovery' : sub === 'magic' ? 'Passwordless' : mode === 'login' ? 'Welcome back' : 'Join Today+';

  return (
    <div className="tpa-card" onClick={(e) => e.stopPropagation()}>
      <AuthStyles />
      {onClose && <button className="tpa-close" onClick={onClose}>×</button>}

      <div className="tpa-eyebrow">{eyebrow}</div>
      <h2 className="tpa-title">{headline}</h2>
      <p className="tpa-sub">{subline}</p>

      {error && <div className="tpa-error">{error}</div>}

      <form onSubmit={submit}>
        {sub ? (
          <>
            <div className="tpa-field">
              <label>Email</label>
              <input type="email" value={email} required placeholder="you@example.com"
                onKeyDown={(e) => e.stopPropagation()} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button type="submit" className="tpa-submit" disabled={loading || !email}>
              {loading ? 'Sending…' : sub === 'magic' ? 'Send sign-in link' : 'Send reset link'}
            </button>
            <p className="tpa-foot"><button type="button" className="tpa-link" onClick={() => setSub(null)}>← Back to {mode === 'login' ? 'log in' : 'sign up'}</button></p>
          </>
        ) : (
          <>
            {onOAuthLogin && <OAuthButtons onOAuthLogin={onOAuthLogin} onMagicLink={onMagicLink ? () => setSub('magic') : null} />}
            {onOAuthLogin && <div className="tpa-divider">or with email</div>}

            {mode === 'signup' && (
              <div className="tpa-field">
                <label>Name</label>
                <input type="text" value={fullName} required placeholder="Your name"
                  onKeyDown={(e) => e.stopPropagation()} onChange={(e) => setFullName(e.target.value)} />
              </div>
            )}

            <div className="tpa-field">
              <label>Email</label>
              <input type="email" value={email} required placeholder="you@example.com"
                onKeyDown={(e) => e.stopPropagation()} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="tpa-field">
              <label>Password</label>
              <input type="password" value={password} required
                placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
                onKeyDown={(e) => e.stopPropagation()} onChange={(e) => setPassword(e.target.value)} />
              {mode === 'signup' && password.length > 0 && (
                <div className="tpa-meter"><div style={{ width: `${strength}%`, background: strengthColor }} /></div>
              )}
              {mode === 'login' && (
                <div style={{ textAlign: 'right', marginTop: 6 }}>
                  <button type="button" className="tpa-link" onClick={() => setSub('forgot')}>Forgot password?</button>
                </div>
              )}
            </div>

            <button type="submit" className="tpa-submit"
              disabled={loading || !email || !password || (mode === 'signup' && (!pwOk || !fullName))}>
              {loading ? (mode === 'login' ? 'Signing in…' : 'Creating…') : (mode === 'login' ? 'Sign in' : 'Create account')}
            </button>
          </>
        )}
      </form>

      {!sub && onModeChange && (
        <p className="tpa-foot">
          {mode === 'login'
            ? <>New to Today+? <button className="tpa-link" onClick={() => onModeChange('signup')}>Create an account</button></>
            : <>Already have an account? <button className="tpa-link" onClick={() => onModeChange('login')}>Sign in</button></>}
        </p>
      )}
    </div>
  );
}

/* Legacy shims */
export function LoginForm({ onSubmit, onForgotPassword, onOAuthLogin }) {
  return <AuthPanel mode="login" onLogin={onSubmit} onForgotPassword={onForgotPassword} onOAuthLogin={onOAuthLogin} onMagicLink={null} onSignup={() => {}} />;
}
export function SignupForm({ onSubmit, onOAuthLogin }) {
  return <AuthPanel mode="signup" onSignup={onSubmit} onOAuthLogin={onOAuthLogin} onMagicLink={null} onLogin={() => {}} onForgotPassword={() => {}} />;
}

export function EmailConfirmation({ email, type, onBack }) {
  const isReset = type === 'reset';
  return (
    <div className="tpa-card" onClick={(e) => e.stopPropagation()}>
      <AuthStyles />
      {onBack && <button className="tpa-close" onClick={onBack}>×</button>}
      <div style={{ textAlign: 'center', padding: '4px 0' }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--a)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><EnvelopeIcon /></div>
        <h2 className="tpa-title" style={{ marginBottom: 8 }}>{isReset ? 'Reset link sent' : 'Verify your email'}</h2>
        <p className="tpa-sub">
          We sent a {isReset ? 'password reset' : 'verification'} link to<br /><strong style={{ color: 'var(--ink)' }}>{email}</strong>
        </p>
        <div style={{ background: 'var(--soft)', border: '1px solid var(--line)', borderRadius: 12, padding: 16, textAlign: 'left', margin: '4px 0' }}>
          <ol style={{ margin: 0, paddingLeft: 18, color: 'var(--mut)', fontSize: 14, lineHeight: 1.7 }}>
            <li>Open your inbox (and check spam)</li>
            <li>Tap the {isReset ? 'reset' : 'verification'} link</li>
            <li>{isReset ? 'Choose a new password' : 'You’re in — start reading'}</li>
          </ol>
        </div>
        <p className="tpa-foot">Didn’t get it? <button className="tpa-link" onClick={onBack}>Try again</button></p>
      </div>
    </div>
  );
}

export function ResetPasswordModal({ supabase, onSuccess, onCancel }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [settingUpSession, setSettingUpSession] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
          const hp = new URLSearchParams(hash.substring(1));
          const access_token = hp.get('access_token');
          const refresh_token = hp.get('refresh_token');
          if (access_token && refresh_token) {
            const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) { setError('Failed to verify reset link. Please request a new one.'); setSettingUpSession(false); return; }
            if (data?.session) setSessionReady(true);
          }
        } else {
          const { data } = await supabase.auth.getSession();
          if (data?.session) setSessionReady(true);
          else setError('Reset link expired or invalid. Please request a new one.');
        }
      } catch { setError('Failed to verify reset link. Please try again.'); }
      finally { setSettingUpSession(false); }
    };
    run();
  }, [supabase]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!sessionReady) { setError('Session not ready. Please wait or request a new reset link.'); return; }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) { setError(updateError.message); setLoading(false); return; }
      setSuccess(true);
      setTimeout(() => onSuccess(), 1800);
    } catch (err) { setError(err.message); setLoading(false); }
  };

  if (settingUpSession) {
    return (
      <div className="tpa-card" onClick={(e) => e.stopPropagation()}>
        <AuthStyles />
        <h2 className="tpa-title">Reset password</h2>
        <p className="tpa-sub">Verifying your reset link…</p>
      </div>
    );
  }
  if (success) {
    return (
      <div className="tpa-card" onClick={(e) => e.stopPropagation()}>
        <AuthStyles />
        <div style={{ textAlign: 'center' }}>
          <h2 className="tpa-title">Password updated</h2>
          <p className="tpa-sub">Redirecting you in…</p>
        </div>
      </div>
    );
  }
  return (
    <div className="tpa-card" onClick={(e) => e.stopPropagation()}>
      <AuthStyles />
      {onCancel && <button className="tpa-close" onClick={onCancel}>×</button>}
      <div className="tpa-eyebrow">Account recovery</div>
      <h2 className="tpa-title">Reset password</h2>
      <p className="tpa-sub">Choose a new password below.</p>
      {error && <div className="tpa-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="tpa-field">
          <label>New password</label>
          <input type="password" value={newPassword} required placeholder="At least 8 characters"
            onKeyDown={(e) => e.stopPropagation()} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <div className="tpa-field">
          <label>Confirm password</label>
          <input type="password" value={confirmPassword} required placeholder="Repeat your password"
            onKeyDown={(e) => e.stopPropagation()} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>
        <button type="submit" className="tpa-submit" disabled={loading}>{loading ? 'Updating…' : 'Update password'}</button>
      </form>
    </div>
  );
}
