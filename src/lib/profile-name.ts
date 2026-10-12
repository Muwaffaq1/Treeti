export function profileName(metadata?: {full_name?: unknown} | null): string | undefined {
  const name = typeof metadata?.full_name === 'string' ? metadata.full_name.trim() : '';
  return name.length >= 2 && name.length <= 120 && !name.includes('@') ? name : undefined;
}
