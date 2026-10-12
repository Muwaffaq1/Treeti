// Keep authentication returns inside known treeti screens, including private invitations.
export function authReturnPath(value?: string | null): string {
  if (value && (/^\/(app|account|activity|debts|agreements)(\/[^\\?#\s]*)?$/.test(value) || /^\/invite\/[A-Za-z0-9_-]{43}$/.test(value))) return value;
  return '/app';
}
