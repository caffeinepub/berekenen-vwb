/**
 * CSV Parser utility
 * Supports comma and semicolon delimiters, handles quoted fields.
 * Supports UTF-8, UTF-8 BOM, and Windows-1252/Latin-1 encoded files.
 */

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * Decode an ArrayBuffer to a string, automatically detecting encoding.
 * Checks for UTF-8 BOM, falls back to windows-1252 if UTF-8 decoding
 * produces replacement characters (indicating wrong encoding).
 */
export function decodeFileBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  // Check for UTF-8 BOM (EF BB BF)
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    const decoder = new TextDecoder("utf-8");
    // Decode without BOM
    return decoder.decode(buffer.slice(3));
  }

  // Try UTF-8 first (strict — replacement chars indicate wrong encoding)
  const utf8 = new TextDecoder("utf-8", { fatal: false });
  const utf8Text = utf8.decode(buffer);

  // If the text contains replacement character U+FFFD, it likely isn't valid UTF-8
  if (utf8Text.includes("\uFFFD")) {
    const win1252 = new TextDecoder("windows-1252", { fatal: false });
    return win1252.decode(buffer);
  }

  return utf8Text;
}

/**
 * Detects the delimiter (comma vs semicolon) based on the first line.
 */
function detectDelimiter(firstLine: string): string {
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

/**
 * Parse a single CSV line, handling quoted fields correctly.
 */
function parseLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote inside quoted field
        current += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
    i++;
  }

  result.push(current.trim());
  return result;
}

/**
 * Parse CSV text into headers and rows.
 * Supports comma and semicolon as delimiters.
 * Handles quoted fields correctly.
 * Strips UTF-8 BOM from the start if present.
 */
export function parseCsv(text: string): ParsedCsv {
  // Strip UTF-8 BOM if present (in case text was decoded externally with BOM)
  const stripped = text.startsWith("\uFEFF") ? text.slice(1) : text;
  // Normalize line endings
  const normalized = stripped.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseLine(lines[0], delimiter).map((h) => h.trim());

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i], delimiter);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx]?.trim() ?? "";
    });
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Get all unique non-empty values from a specific column in the parsed rows.
 */
export function getUniqueValues(
  rows: Record<string, string>[],
  column: string,
): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    const val = row[column];
    if (val && val.trim().length > 0) {
      seen.add(val.trim());
    }
  }
  return Array.from(seen);
}
