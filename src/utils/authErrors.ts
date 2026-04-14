import type { TFunction } from 'i18next';

type AuthLikeError = {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
};

function asAuthError(error: unknown): AuthLikeError {
  if (error && typeof error === 'object' && 'message' in error) {
    return error as AuthLikeError;
  }
  return {};
}

export function getAuthErrorMessage(
  error: unknown,
  t: TFunction,
  fallbackKey:
    | 'auth.errors2.signingIn'
    | 'auth.errors2.creatingAccount'
    | 'auth.errors2.signingInGoogle' = 'auth.errors2.signingIn'
): string {
  const { message = '', code = '', status, name = '' } = asAuthError(error);
  const lower = message.toLowerCase();
  const codeLower = (code || '').toLowerCase();

  if (
    name === 'AuthWeakPasswordError' ||
    codeLower.includes('weak_password') ||
    (lower.includes('weak') && lower.includes('guess'))
  ) {
    return t('auth.errors.weakPassword');
  }

  if (
    lower.includes('invalid login') ||
    lower.includes('invalid credentials') ||
    codeLower === 'invalid_credentials'
  ) {
    return t('auth.errors.invalidCredentials');
  }

  if (
    lower.includes('email not confirmed') ||
    lower.includes('email address not confirmed') ||
    codeLower === 'email_not_confirmed'
  ) {
    return t('auth.errors.emailNotConfirmed');
  }

  if (
    lower.includes('email rate limit') ||
    codeLower.includes('over_email_send_rate_limit')
  ) {
    return t('auth.errors.emailSignupRateLimited');
  }

  if (
    lower.includes('too many requests') ||
    status === 429 ||
    codeLower.includes('over_request_rate_limit')
  ) {
    return t('auth.errors.tooManyRequests');
  }

  if (message.trim()) {
    return message;
  }

  return t(fallbackKey);
}
