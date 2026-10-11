import type { ImportIssue, ImportResult } from "./errors";

export interface FieldSpec {
  required: boolean;
  /** Accepted header names in priority order, e.g. "due date". Matched after normalization. */
  aliases: readonly string[];
}

/** Lowercase, keeping only letters, digits, and `#`. */
export const normalizeHeader = (header: string): string =>
  header.toLowerCase().replace(/[^a-z0-9#]/g, "");

/** Maps each field to a column index (undefined when an optional field is absent). */
export function mapHeaders<F extends string>(
  headers: readonly string[],
  fields: Record<F, FieldSpec>,
): ImportResult<Record<F, number | undefined>> {
  const normalized = headers.map(normalizeHeader);
  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const columns = {} as Record<F, number | undefined>;
  for (const [field, spec] of Object.entries<FieldSpec>(fields) as [F, FieldSpec][]) {
    // Columns in alias order; within one alias, left to right.
    const matches = spec.aliases.flatMap((alias) =>
      normalized.flatMap((h, i) => (h === normalizeHeader(alias) ? [i] : [])),
    );
    const unique = [...new Set(matches)];
    columns[field] = unique[0];
    if (unique.length === 0 && spec.required) {
      errors.push({
        line: 1,
        column: field,
        message: `Missing required column "${field}". Accepted headers: ${spec.aliases.join(", ")}.`,
      });
    } else if (unique.length > 1) {
      const ignored = unique
        .slice(1)
        .map((i) => `"${headers[i]}"`)
        .join(", ");
      warnings.push({
        line: 1,
        column: field,
        message: `Several columns match "${field}"; using "${headers[unique[0]]}" and ignoring ${ignored}.`,
      });
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: columns, warnings };
}
