/** `line` is the file line number (the header is line 1); absent for whole-file problems. */
export interface ImportIssue {
  line?: number;
  column?: string;
  message: string;
}

export type ImportResult<T> =
  { ok: true; value: T; warnings: ImportIssue[] } | { ok: false; errors: ImportIssue[] };

export const importError = (
  message: string,
  extra: Omit<ImportIssue, "message"> = {},
): ImportResult<never> => ({
  ok: false,
  errors: [{ message, ...extra }],
});
