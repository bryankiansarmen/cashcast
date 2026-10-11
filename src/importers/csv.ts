import Papa from "papaparse";
import { importError, type ImportResult } from "./errors";

export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 20_000;
const DELIMITERS = [",", ";", "\t"];

// Papa's guesser is thrown off by blank lines, so pick the delimiter most common in the header line.
function detectDelimiter(text: string): string {
  const header = /^.*\S.*$/m.exec(text)?.[0] ?? "";
  const count = (d: string) => header.split(d).length - 1;
  return DELIMITERS.reduce((best, d) => (count(d) > count(best) ? d : best));
}

export interface CsvRow {
  line: number; // file line number; the header is line 1
  cells: string[];
}
export interface CsvTable {
  headers: string[];
  rows: CsvRow[];
  delimiter: string;
}

/**
 * Reads CSV text (comma, semicolon, or tab). Limits are checked before the rows are parsed.
 * Parsed line numbers assume one record per line; a quoted multi-line field shifts later numbers.
 */
export function readCsv(text: string): ImportResult<CsvTable> {
  if (new TextEncoder().encode(text).length > MAX_BYTES) {
    return importError(`File is larger than ${MAX_BYTES / 1024 / 1024} MB.`);
  }
  const clean = text.replace(/^﻿/, "");
  const parsed = Papa.parse<string[]>(clean, {
    delimiter: detectDelimiter(clean),
    skipEmptyLines: false,
    preview: MAX_ROWS + 2, // header, MAX_ROWS data rows, and one more to detect overflow
  });
  if (parsed.errors.length) {
    return {
      ok: false,
      errors: parsed.errors.map((e) => ({
        line: e.row === undefined ? undefined : e.row + 1,
        message: e.message,
      })),
    };
  }
  const lines = parsed.data
    .map((cells, i) => ({ line: i + 1, cells }))
    .filter((r) => r.cells.some((c) => c.trim() !== ""));
  if (lines.length === 0) return importError("File is empty.");
  const [header, ...rows] = lines;
  if (rows.length > MAX_ROWS)
    return importError(`File has more than ${MAX_ROWS.toLocaleString("en-US")} rows.`);
  return {
    ok: true,
    value: { headers: header.cells.map((h) => h.trim()), rows, delimiter: parsed.meta.delimiter },
    warnings: [],
  };
}
