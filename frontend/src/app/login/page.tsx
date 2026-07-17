'use client';

import { signIn, useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState, Suspense } from 'react';

function LoginContent() {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const router = useRouter();
  const { status } = useSession();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Check if redirect came with an error (e.g. AccessDenied due to unauthorized email)
    const err = searchParams.get('error');
    if (err) {
      setErrorMsg(t('notAuthorized'));
    }
  }, [searchParams, t]);

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/');
    }
  }, [status, router]);

  const handleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await signIn('google', { callbackUrl: '/' });
    } catch (e) {
      console.error(e);
      setLoading(false);
      setErrorMsg('Failed to sign in. Please try again.');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        backgroundColor: 'var(--color-bg)',
        padding: 'var(--space-6)',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '400px',
          textAlign: 'center',
          padding: 'var(--space-8) var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-6)',
        }}
      >
        <div>
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: 'rgba(27, 67, 50, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-4)',
              color: 'var(--color-primary)',
            }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1
            style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 700,
              color: 'var(--color-primary)',
              marginBottom: 'var(--space-2)',
            }}
          >
            Tractor Hours
          </h1>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-light)',
            }}
          >
            ట్రాక్టర్ గంటలు
          </p>
        </div>

        {errorMsg && (
          <div
            style={{
              backgroundColor: 'rgba(220, 53, 69, 0.1)',
              border: '1px solid var(--color-danger)',
              borderRadius: 'var(--radius-default)',
              padding: 'var(--space-3) var(--space-4)',
              width: '100%',
              textAlign: 'left',
            }}
          >
            <p
              style={{
                color: 'var(--color-danger)',
                fontWeight: 600,
                fontSize: 'var(--text-base)',
                marginBottom: '4px',
              }}
            >
              {errorMsg}
            </p>
            <p
              style={{
                color: 'var(--color-text-medium)',
                fontSize: 'var(--text-sm)',
              }}
            >
              {t('notAuthorizedDesc')}
            </p>
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary"
          style={{ width: '100%', minHeight: '52px' }}
          onClick={handleSignIn}
          disabled={loading || status === 'loading'}
        >
          {loading ? (
            <span>{t('signingIn')}</span>
          ) : (
            <>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                style={{ marginRight: '8px' }}
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              <span>{t('signInWithGoogle')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '100px' }}>Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
