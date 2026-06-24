// Shared auth/identity constants for the dashboard.

// Google Workspace domain allowed to access the dashboard at all.
export const ALLOWED_DOMAIN = 'felice.ed.jp';

// Fallback admin allowlist used for privileged actions (deletes, worker toggles)
// when the live `config/admins` list in Firebase cannot be read. Keep this in sync
// with the worker's ADMIN_EMAILS env var. Lowercase only.
export const FALLBACK_ADMIN_EMAILS = ['john.limpiada@felice.ed.jp'];

// True if the email belongs to the allowed Workspace domain.
export function isAllowedDomain(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

// True if the email is in the provided admin allowlist (case-insensitive).
export function isAdminEmail(
  email: string | null | undefined,
  adminEmails: string[]
): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  return adminEmails.some(a => a.toLowerCase() === lower);
}
