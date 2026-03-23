import type { TimestampedLine } from "./types.js";

/**
 * Parse a WebVTT file into timestamped lines.
 * Strips HTML tags, deduplicates consecutive identical lines (common in auto-subs),
 * and normalizes whitespace.
 */
export function parseVTT(content: string): TimestampedLine[] {
  const lines = content.split(/\r?\n/);
  const result: TimestampedLine[] = [];

  let i = 0;

  // Skip WEBVTT header and any metadata block
  while (i < lines.length && !lines[i].includes("-->")) {
    i++;
  }

  while (i < lines.length) {
    const line = lines[i];

    // Match timestamp line: "00:00:01.000 --> 00:00:04.000"
    const timestampMatch = line.match(
      /(\d{1,2}(?::\d{2}){1,2})\.\d{3}\s+-->\s+\d{1,2}(?::\d{2}){1,2}\.\d{3}/
    );

    if (timestampMatch) {
      const timestamp = normalizeTimestamp(timestampMatch[1]);
      i++;

      // Collect all text lines until blank line or next timestamp
      const textParts: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() !== "" &&
        !lines[i].includes("-->")
      ) {
        textParts.push(lines[i]);
        i++;
      }

      const text = stripTags(textParts.join(" ")).trim();
      if (text) {
        // Deduplicate: skip if identical to previous line
        if (result.length === 0 || result[result.length - 1].text !== text) {
          result.push({ timestamp, text });
        }
      }
    } else {
      i++;
    }
  }

  return result;
}

/**
 * Format parsed lines into a transcript string.
 */
export function formatTranscript(
  lines: TimestampedLine[],
  includeTimestamps: boolean
): string {
  if (includeTimestamps) {
    return lines.map((l) => `[${l.timestamp}] ${l.text}`).join("\n");
  }
  return lines.map((l) => l.text).join("\n");
}

/**
 * Strip HTML/VTT tags from text (e.g. <c>, <b>, <i>, alignment tags).
 */
function stripTags(text: string): string {
  return text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
}

/**
 * Normalize timestamp to HH:MM:SS format.
 * Input may be "H:MM:SS" or "HH:MM:SS" or "MM:SS".
 */
function normalizeTimestamp(ts: string): string {
  const parts = ts.split(":");
  if (parts.length === 2) {
    return `00:${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
  }
  return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}:${parts[2].padStart(2, "0")}`;
}
