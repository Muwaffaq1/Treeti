// Keep authentication returns inside known treeti screens, including private invitations.
export function authReturnPath(value?: string | null): string {
  if (value && (/^\/(app|account|activity|debts|agreements|trusted-contacts)(\/[^\\?#\s]*)?$/.test(value) || /^\/(invite|trusted)\/[A-Za-z0-9_-]{43}$/.test(value))) return value;
  return '/app';
}
