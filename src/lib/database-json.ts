/** Repositories pass JSON text to Database.query, as they do to PostgreSQL itself. */
export function serializeDatabaseJSON(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function parseDatabaseJSON(text: string): unknown {
  const value: unknown = JSON.parse(text);
  // Earlier Postgres.js writes serialized JSON text a second time. Read those
  // object/array snapshots without rewriting immutable financial records.
  if (typeof value === 'string' && /^[\s]*[\[{]/.test(value)) {
    try {
      return JSON.parse(value);
    } catch {
      // A genuine JSON string is still a string, even if it begins with a brace.
    }
  }
  return value;
}

export const databaseJSONTypes = {
  json: { to: 114, from: [114, 3802], serialize: serializeDatabaseJSON, parse: parseDatabaseJSON },
};
