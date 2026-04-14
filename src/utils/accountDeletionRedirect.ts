/** Set before sign-out after account delete; Landing reads it to avoid a race redirect. */
export const ACCOUNT_JUST_DELETED_SESSION_KEY = 'perleap_account_just_deleted';

export function setAccountJustDeletedSessionFlag(): void {
  sessionStorage.setItem(ACCOUNT_JUST_DELETED_SESSION_KEY, '1');
}

export function isAccountJustDeletedSessionFlagSet(): boolean {
  return sessionStorage.getItem(ACCOUNT_JUST_DELETED_SESSION_KEY) === '1';
}

export function clearAccountJustDeletedSessionFlag(): void {
  sessionStorage.removeItem(ACCOUNT_JUST_DELETED_SESSION_KEY);
}
