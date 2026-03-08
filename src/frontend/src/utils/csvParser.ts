/**
 * CSV Parser utility
 * Supports comma and semicolon delimiters, handles quoted fields.
 * Supports UTF-8, UTF-8 BOM, UTF-16 LE, and Windows-1252/Latin-1 encoded files.
 */

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * Decode an ArrayBuffer to a string, automatically detecting encoding.
 *
 * Strategy:
 * 1. Check for UTF-16 LE BOM (FF FE) → decode as UTF-16 LE
 * 2. Check for UTF-8 BOM (EF BB BF) → decode as UTF-8 (strip BOM)
 * 3. Heuristic: scan the first 4096 bytes for byte patterns that indicate
 *    Windows-1252 (bytes in 0x80-0x9F range that are printable in win-1252
 *    but are C1 control codes in Unicode). If found, decode as Windows-1252.
 * 4. Try UTF-8. If replacement chars appear, fall back to Windows-1252.
 * 5. Otherwise return the UTF-8 decoded string.
 */
export function decodeFileBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  // Check for UTF-16 LE BOM (FF FE)
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(buffer.slice(2));
  }

  // Check for UTF-8 BOM (EF BB BF)
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    return new TextDecoder("utf-8").decode(buffer.slice(3));
  }

  // Heuristic: scan the first 8192 bytes for Windows-1252 indicator bytes.
  // Bytes 0x80-0x9F are printable in Windows-1252 (e.g. €=0x80, …=0x85, ™=0x99)
  // but are C1 control codes (non-printable) in strict Unicode/ISO-8859-1.
  // Their presence strongly suggests Windows-1252 encoding.
  const sampleSize = Math.min(bytes.length, 8192);
  let win1252Indicators = 0;
  let highBytes = 0;

  for (let i = 0; i < sampleSize; i++) {
    const b = bytes[i];
    if (b >= 0x80 && b <= 0x9f) {
      win1252Indicators++;
    } else if (b >= 0xa0) {
      highBytes++;
    }
  }

  // If we see any Windows-1252 indicator bytes, decode as Windows-1252
  if (win1252Indicators > 0) {
    return new TextDecoder("windows-1252", { fatal: false }).decode(buffer);
  }

  // Try UTF-8
  const utf8Decoder = new TextDecoder("utf-8", { fatal: false });
  const utf8Text = utf8Decoder.decode(buffer);

  // If replacement characters (U+FFFD) are present, the file is not valid UTF-8
  if (utf8Text.includes("\uFFFD")) {
    return new TextDecoder("windows-1252", { fatal: false }).decode(buffer);
  }

  // Additional check: if high bytes exist but no UTF-8 multi-byte sequences
  // decode correctly, try Windows-1252 as well. This catches edge cases.
  if (highBytes > 0) {
    // Count valid UTF-8 multi-byte sequences by checking TextDecoder with fatal=true
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      // If we get here, it's valid UTF-8
    } catch {
      // Not valid UTF-8 - use Windows-1252
      return new TextDecoder("windows-1252", { fatal: false }).decode(buffer);
    }
  }

  return utf8Text;
}

/**
 * Detects the delimiter (comma, semicolon, or tab) based on the first line.
 */
function detectDelimiter(firstLine: string): string {
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  if (tabCount > commaCount && tabCount > semicolonCount) return "\t";
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
 * Clean a header name: remove BOM characters, zero-width spaces,
 * and other invisible Unicode characters that can appear in CSV headers.
 */
function cleanHeaderName(h: string): string {
  // Remove BOM, zero-width space, non-breaking space
  let s = h
    .replace(/^\uFEFF/, "") // UTF-8 BOM at start
    .replace(/\u200B/g, "") // zero-width space
    .replace(/\u00A0/g, " "); // non-breaking space → regular space

  // Remove C0 control characters (codes 0-8, 11, 12, 14-31, 127)
  // keeping tab (9), LF (10), CR (13)
  // Using charCodeAt comparison to avoid biome noControlCharactersInRegex rule
  s = Array.from(s)
    .filter((c) => {
      const code = c.charCodeAt(0);
      if (code <= 8) return false;
      if (code === 11 || code === 12) return false;
      if (code >= 14 && code <= 31) return false;
      if (code === 127) return false;
      return true;
    })
    .join("");

  return s.trim();
}

/**
 * Parse CSV text into headers and rows.
 * Supports comma, semicolon, and tab as delimiters.
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
  // Clean all header names to remove invisible/control characters
  const rawHeaders = parseLine(lines[0], delimiter);
  const headers = rawHeaders.map((h) => cleanHeaderName(h));

  // Filter out completely empty headers (trailing delimiters)
  // but keep track of their original indices to skip those columns
  const validHeaderIndices: number[] = [];
  const validHeaders: string[] = [];
  for (let i = 0; i < headers.length; i++) {
    if (headers[i].length > 0) {
      validHeaderIndices.push(i);
      validHeaders.push(headers[i]);
    }
  }

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i], delimiter);
    const row: Record<string, string> = {};
    for (let j = 0; j < validHeaders.length; j++) {
      const colIdx = validHeaderIndices[j];
      row[validHeaders[j]] = values[colIdx]?.trim() ?? "";
    }
    rows.push(row);
  }

  return { headers: validHeaders, rows };
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
