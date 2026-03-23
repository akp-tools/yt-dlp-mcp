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

  // Track seen lines to deduplicate auto-sub scrolling overlap.
  // Auto-subs use multi-line cues where each cue repeats the previous cue's
  // last line(s) as its first line(s). We deduplicate at the individual line
  // level so only genuinely new text gets emitted.
  const seenLines = new Set<string>();

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
      while (
        i < lines.length &&
        lines[i].trim() !== "" &&
        !lines[i].includes("-->")
      ) {
        const text = stripTags(lines[i]).trim();
        if (text && !seenLines.has(text)) {
          seenLines.add(text);
          result.push({ timestamp, text });
        }
        i++;
      }
    } else {
      i++;
    }
  }

  return result;
}

/**
 * Convert an HH:MM:SS timestamp string to total seconds.
 */
export function timestampToSeconds(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

/**
 * Filter transcript lines to a specific time range.
 * Both start and end are inclusive. Accepts HH:MM:SS or MM:SS format.
 */
export function filterByTimeRange(
  lines: TimestampedLine[],
  startTime?: string,
  endTime?: string
): TimestampedLine[] {
  if (!startTime && !endTime) return lines;

  const startSec = startTime ? timestampToSeconds(startTime) : 0;
  const endSec = endTime ? timestampToSeconds(endTime) : Infinity;

  return lines.filter((l) => {
    const sec = timestampToSeconds(l.timestamp);
    return sec >= startSec && sec <= endSec;
  });
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
