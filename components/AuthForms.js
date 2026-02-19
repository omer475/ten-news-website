import { useEffect, useState } from 'react';

// Login Form Component
export function LoginForm({ onSubmit, onForgotPassword, formData, setFormData }) {
  const [email, setEmail] = useState(formData?.loginEmail || '');
  const [password, setPassword] = useState(formData?.loginPassword || '');
  const [loading, setLoading] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // Sync with global formData
  useEffect(() => {
    setEmail(formData?.loginEmail || '');
  }, [formData?.loginEmail]);

  useEffect(() => {
    setPassword(formData?.loginPassword || '');
  }, [formData?.loginPassword]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    try {
      await onSubmit(email, password);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) return;

    setResetLoading(true);
    try {
      await onForgotPassword(email);
    } finally {
      setResetLoading(false);
    }
  };

  if (forgotPasswordMode) {
    return (
      <form onSubmit={handleForgotPassword} className="auth-form" style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
        <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '16px', textAlign: 'center' }}>
          Enter your email address and we'll send you a link to reset your password.
        </p>
        <div className="auth-field" style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
          <label htmlFor="reset-email">Email</label>
          <input
            id="reset-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFormData(prev => ({ ...prev, loginEmail: e.target.value }));
            }}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Enter your email"
            required
            style={{ touchAction: 'auto', pointerEvents: 'auto', WebkitUserSelect: 'text', userSelect: 'text' }}
          />
        </div>

        <button
          type="submit"
          className="auth-submit"
          disabled={resetLoading}
          style={{ touchAction: 'auto', pointerEvents: 'auto' }}
        >
          {resetLoading ? 'Sending...' : 'Send Reset Link'}
        </button>

        <button
          type="button"
          onClick={() => setForgotPasswordMode(false)}
          style={{
            background: 'none',
            border: 'none',
            color: '#3b82f6',
            cursor: 'pointer',
            fontSize: '14px',
            marginTop: '12px',
            textDecoration: 'underline'
          }}
        >
          Back to Login
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form" style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
      <div className="auth-field" style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setFormData(prev => ({ ...prev, loginEmail: e.target.value }));
          }}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Enter your email"
          required
          style={{ touchAction: 'auto', pointerEvents: 'auto', WebkitUserSelect: 'text', userSelect: 'text' }}
        />
      </div>

      <div className="auth-field" style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setFormData(prev => ({ ...prev, loginPassword: e.target.value }));
          }}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Enter your password"
          required
          style={{ touchAction: 'auto', pointerEvents: 'auto', WebkitUserSelect: 'text', userSelect: 'text' }}
        />
      </div>

      <button
        type="button"
        onClick={() => setForgotPasswordMode(true)}
        style={{
          background: 'none',
          border: 'none',
          color: '#3b82f6',
          cursor: 'pointer',
          fontSize: '14px',
          marginBottom: '8px',
          textAlign: 'right',
          width: '100%',
          padding: 0
        }}
      >
        Forgot password?
      </button>

      <button
        type="submit"
        className="auth-submit"
        disabled={loading}
        style={{ touchAction: 'auto', pointerEvents: 'auto' }}
      >
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}

// Signup Form Component
export function SignupForm({ onSubmit, formData, setFormData }) {
  const [email, setEmail] = useState(formData?.signupEmail || '');
  const [password, setPassword] = useState(formData?.signupPassword || '');
  const [fullName, setFullName] = useState(formData?.signupFullName || '');
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Helper function to safely update formData
  const updateFormData = (key, value) => {
    if (setFormData) {
      setFormData(prev => ({ ...prev, [key]: value }));
    }
  };

  // Sync with global formData
  useEffect(() => {
    setEmail(formData?.signupEmail || '');
  }, [formData?.signupEmail]);

  useEffect(() => {
    setPassword(formData?.signupPassword || '');
  }, [formData?.signupPassword]);

  useEffect(() => {
    setFullName(formData?.signupFullName || '');
  }, [formData?.signupFullName]);

  const validatePassword = (pass) => {
    if (pass.length < 8) return 'Password must be at least 8 characters';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password || !fullName) return;

    const error = validatePassword(password);
    if (error) {
      setPasswordError(error);
      return;
    }

    setLoading(true);
    try {
      await onSubmit(email, password, fullName);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = (pass) => {
    setPassword(pass);
    setPasswordError(validatePassword(pass));
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form" style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
      <div className="auth-field" style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
        <label htmlFor="signup-name">Full Name</label>
        <input
          id="signup-name"
          type="text"
          value={fullName}
          onChange={(e) => {
            setFullName(e.target.value);
            updateFormData('signupFullName', e.target.value);
          }}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Enter your full name"
          required
          style={{ touchAction: 'auto', pointerEvents: 'auto', WebkitUserSelect: 'text', userSelect: 'text' }}
        />
      </div>

      <div className="auth-field" style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
        <label htmlFor="signup-email">Email</label>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            updateFormData('signupEmail', e.target.value);
          }}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Enter your email"
          required
          style={{ touchAction: 'auto', pointerEvents: 'auto', WebkitUserSelect: 'text', userSelect: 'text' }}
        />
      </div>

      <div className="auth-field" style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
        <label htmlFor="signup-password">Password</label>
        <input
          id="signup-password"
          type="password"
          value={password}
          onChange={(e) => {
            handlePasswordChange(e.target.value);
            updateFormData('signupPassword', e.target.value);
          }}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Create a password (min 8 characters)"
          required
          style={{ touchAction: 'auto', pointerEvents: 'auto', WebkitUserSelect: 'text', userSelect: 'text' }}
        />
        {passwordError && <span className="auth-field-error">{passwordError}</span>}
      </div>

      <button
        type="submit"
        className="auth-submit"
        disabled={loading || passwordError}
        style={{ touchAction: 'auto', pointerEvents: 'auto' }}
      >
        {loading ? 'Creating Account...' : 'Create Account'}
      </button>
    </form>
  );
}

// Email Confirmation Component
export function EmailConfirmation({ email, type, onBack }) {
  const isReset = type === 'reset';

  return (
    <div className="auth-modal" onClick={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()} style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
      <div className="auth-modal-header" style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
        <h2>Check Your Email</h2>
        <button className="auth-close" onClick={onBack} onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} style={{ touchAction: 'auto', pointerEvents: 'auto' }}>×</button>
      </div>

      <div className="auth-modal-body" style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px',
            opacity: '0.8'
          }}>{isReset ? '🔐' : '📧'}</div>

          <h3 style={{
            color: '#1f2937',
            fontSize: '20px',
            fontWeight: '600',
            margin: '0 0 12px 0'
          }}>{isReset ? 'Password Reset Email Sent!' : 'Verification Email Sent!'}</h3>

          <p style={{
            color: '#6b7280',
            fontSize: '16px',
            lineHeight: '1.5',
            margin: '0 0 20px 0'
          }}>
            {isReset
              ? <>We've sent a password reset link to <strong>{email}</strong></>
              : <>We've sent a verification link to <strong>{email}</strong></>
            }
          </p>

          <div style={{
            background: '#f3f4f6',
            padding: '16px',
            borderRadius: '8px',
            margin: '20px 0',
            textAlign: 'left'
          }}>
            <h4 style={{
              color: '#1f2937',
              fontSize: '16px',
              fontWeight: '600',
              margin: '0 0 8px 0'
            }}>Next steps:</h4>
            <ol style={{
              color: '#4b5563',
              margin: '0',
              paddingLeft: '20px',
              lineHeight: '1.6'
            }}>
              <li>Check your email inbox (and spam folder)</li>
              <li>Click the {isReset ? 'reset' : 'verification'} link</li>
              <li>{isReset ? 'Create a new password' : 'Return here and log in with your credentials'}</li>
            </ol>
          </div>

          <p style={{
            color: '#6b7280',
            fontSize: '14px',
            margin: '16px 0 0 0'
          }}>
            Didn't receive the email? Check your spam folder or{' '}
            <button
              onClick={onBack}
              style={{
                background: 'none',
                border: 'none',
                color: '#3b82f6',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '14px'
              }}
            >
              try again
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// Reset Password Modal Component
export function ResetPasswordModal({ supabase, onSuccess, onCancel }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [settingUpSession, setSettingUpSession] = useState(true);

  // Set up session from URL tokens when modal mounts
  useEffect(() => {
    const setupSession = async () => {
      try {
        // Check if there are tokens in the URL hash
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
          console.log('🔐 Found tokens in URL, setting up session...');
          const hashParams = new URLSearchParams(hash.substring(1));
          const access_token = hashParams.get('access_token');
          const refresh_token = hashParams.get('refresh_token');

          if (access_token && refresh_token) {
            const { data, error } = await supabase.auth.setSession({
              access_token,
              refresh_token
            });

            if (error) {
              console.error('❌ Error setting session:', error);
              setError('Failed to verify reset link. Please request a new one.');
              setSettingUpSession(false);
              return;
            }

            if (data?.session) {
              console.log('✅ Session established for password reset');
              setSessionReady(true);
            }
          }
        } else {
          // Try to get existing session
          const { data } = await supabase.auth.getSession();
          if (data?.session) {
            console.log('✅ Existing session found');
            setSessionReady(true);
          } else {
            setError('Reset link expired or invalid. Please request a new one.');
          }
        }
      } catch (err) {
        console.error('❌ Session setup error:', err);
        setError('Failed to verify reset link. Please try again.');
      } finally {
        setSettingUpSession(false);
      }
    };

    setupSession();
  }, [supabase]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!sessionReady) {
      setError('Session not ready. Please wait or request a new reset link.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 2000);

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (settingUpSession) {
    return (
      <div className="auth-modal" onClick={(e) => e.stopPropagation()} style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
        <div className="auth-modal-header">
          <h2>Reset Password</h2>
        </div>
        <div className="auth-modal-body" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>⏳</div>
          <p style={{ color: '#666', fontSize: '16px' }}>
            Verifying reset link...
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="auth-modal" onClick={(e) => e.stopPropagation()} style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
        <div className="auth-modal-header">
          <h2>Password Updated!</h2>
        </div>
        <div className="auth-modal-body" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
          <p style={{ color: '#22c55e', fontSize: '16px', fontWeight: '500' }}>
            Your password has been successfully updated.
          </p>
          <p style={{ color: '#666', fontSize: '14px', marginTop: '8px' }}>
            Redirecting...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-modal" onClick={(e) => e.stopPropagation()} style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
      <div className="auth-modal-header">
        <h2>Reset Password</h2>
        <button className="auth-close" onClick={onCancel}>×</button>
      </div>

      <div className="auth-modal-body" style={{ touchAction: 'auto', pointerEvents: 'auto' }}>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px', textAlign: 'center' }}>
          Enter your new password below
        </p>

        {error && (
          <div className="auth-error" style={{ marginBottom: '16px' }}>{error}</div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label htmlFor="new-password">New Password</label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="Enter new password (min 8 characters)"
              required
              style={{ touchAction: 'auto', pointerEvents: 'auto', WebkitUserSelect: 'text', userSelect: 'text' }}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="confirm-password">Confirm Password</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="Confirm new password"
              required
              style={{ touchAction: 'auto', pointerEvents: 'auto', WebkitUserSelect: 'text', userSelect: 'text' }}
            />
          </div>

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
            style={{ touchAction: 'auto', pointerEvents: 'auto' }}
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              color: '#666',
              fontSize: '14px',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
