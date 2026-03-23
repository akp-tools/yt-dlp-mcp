import { describe, it, expect } from "vitest";
import { parseVTT, formatTranscript, timestampToSeconds, filterByTimeRange } from "../src/parser.js";

const SAMPLE_VTT = `WEBVTT
Kind: captions
Language: en

00:00:01.000 --> 00:00:04.000
Hello world, this is a test.

00:00:04.000 --> 00:00:07.500
Second line of the transcript.

00:00:07.500 --> 00:00:10.000
Third line here.
`;

const VTT_WITH_TAGS = `WEBVTT

00:00:01.000 --> 00:00:03.000
<c.colorCCCCCC>This has</c> <b>HTML tags</b> in it.

00:00:03.000 --> 00:00:05.000
<i>Italic text</i> and <c>colored text</c>.
`;

const VTT_WITH_DUPES = `WEBVTT

00:00:01.000 --> 00:00:03.000
Hello world

00:00:02.000 --> 00:00:04.000
Hello world

00:00:03.000 --> 00:00:05.000
Hello world

00:00:05.000 --> 00:00:07.000
Something new
`;

const VTT_SHORT_TIMESTAMPS = `WEBVTT

0:00:01.000 --> 0:00:03.000
Short hour format.

00:05.000 --> 00:08.000
Minutes and seconds only.
`;

describe("parseVTT", () => {
  it("parses well-formed VTT with timestamps", () => {
    const lines = parseVTT(SAMPLE_VTT);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toEqual({
      timestamp: "00:00:01",
      text: "Hello world, this is a test.",
    });
    expect(lines[1]).toEqual({
      timestamp: "00:00:04",
      text: "Second line of the transcript.",
    });
    expect(lines[2]).toEqual({
      timestamp: "00:00:07",
      text: "Third line here.",
    });
  });

  it("strips HTML tags from cue text", () => {
    const lines = parseVTT(VTT_WITH_TAGS);
    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe("This has HTML tags in it.");
    expect(lines[1].text).toBe("Italic text and colored text.");
  });

  it("deduplicates consecutive identical lines", () => {
    const lines = parseVTT(VTT_WITH_DUPES);
    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe("Hello world");
    expect(lines[1].text).toBe("Something new");
  });

  it("handles short timestamp formats", () => {
    const lines = parseVTT(VTT_SHORT_TIMESTAMPS);
    expect(lines).toHaveLength(2);
    expect(lines[0].timestamp).toBe("00:00:01");
    expect(lines[1].timestamp).toBe("00:00:05");
  });

  it("returns empty array for empty input", () => {
    expect(parseVTT("")).toEqual([]);
    expect(parseVTT("WEBVTT\n\n")).toEqual([]);
  });

  it("handles multi-line cues as separate entries", () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:03.000
First line
Second line
`;
    const lines = parseVTT(vtt);
    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe("First line");
    expect(lines[1].text).toBe("Second line");
  });

  it("deduplicates scrolling auto-sub overlap", () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:03.000
I have never been this excited to spend

00:00:02.000 --> 00:00:04.000
I have never been this excited to spend
this much money in my life because

00:00:03.000 --> 00:00:05.000
this much money in my life because
what's in front of me is Apple's brand

00:00:04.000 --> 00:00:06.000
what's in front of me is Apple's brand
new MacBook Pros
`;
    const lines = parseVTT(vtt);
    expect(lines).toHaveLength(4);
    expect(lines[0].text).toBe("I have never been this excited to spend");
    expect(lines[1].text).toBe("this much money in my life because");
    expect(lines[2].text).toBe("what's in front of me is Apple's brand");
    expect(lines[3].text).toBe("new MacBook Pros");
  });
});

describe("formatTranscript", () => {
  const lines = [
    { timestamp: "00:00:01", text: "Hello world" },
    { timestamp: "00:00:04", text: "Second line" },
  ];

  it("formats without timestamps", () => {
    const result = formatTranscript(lines, false);
    expect(result).toBe("Hello world\nSecond line");
  });

  it("formats with timestamps", () => {
    const result = formatTranscript(lines, true);
    expect(result).toBe("[00:00:01] Hello world\n[00:00:04] Second line");
  });
});

describe("timestampToSeconds", () => {
  it("converts HH:MM:SS", () => {
    expect(timestampToSeconds("00:00:00")).toBe(0);
    expect(timestampToSeconds("00:01:30")).toBe(90);
    expect(timestampToSeconds("01:00:00")).toBe(3600);
    expect(timestampToSeconds("02:11:40")).toBe(7900);
  });

  it("converts MM:SS", () => {
    expect(timestampToSeconds("30:00")).toBe(1800);
    expect(timestampToSeconds("01:05")).toBe(65);
  });
});

describe("filterByTimeRange", () => {
  const lines = [
    { timestamp: "00:00:10", text: "A" },
    { timestamp: "00:05:00", text: "B" },
    { timestamp: "00:30:00", text: "C" },
    { timestamp: "01:00:00", text: "D" },
    { timestamp: "01:30:00", text: "E" },
  ];

  it("returns all lines when no range specified", () => {
    expect(filterByTimeRange(lines)).toEqual(lines);
    expect(filterByTimeRange(lines, undefined, undefined)).toEqual(lines);
  });

  it("filters with start_time only", () => {
    const result = filterByTimeRange(lines, "00:30:00");
    expect(result.map((l) => l.text)).toEqual(["C", "D", "E"]);
  });

  it("filters with end_time only", () => {
    const result = filterByTimeRange(lines, undefined, "00:30:00");
    expect(result.map((l) => l.text)).toEqual(["A", "B", "C"]);
  });

  it("filters with both start and end (inclusive)", () => {
    const result = filterByTimeRange(lines, "00:05:00", "01:00:00");
    expect(result.map((l) => l.text)).toEqual(["B", "C", "D"]);
  });

  it("accepts MM:SS shorthand", () => {
    const result = filterByTimeRange(lines, "30:00", "60:00");
    expect(result.map((l) => l.text)).toEqual(["C", "D"]);
  });

  it("returns empty array when range matches nothing", () => {
    const result = filterByTimeRange(lines, "02:00:00", "03:00:00");
    expect(result).toEqual([]);
  });
});
