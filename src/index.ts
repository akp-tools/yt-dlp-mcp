#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { listSubtitles, downloadSubtitle, getComments } from "./ytdlp.js";
import { parseVTT, formatTranscript, filterByTimeRange } from "./parser.js";
import type { VideoMetadata } from "./types.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const server = new McpServer({
  name: "yt-dlp-mcp",
  version: "0.2.0",
});

function formatMetadataHeader(meta: VideoMetadata): string {
  const parts = [
    `Title: ${meta.title}`,
    `Channel: ${meta.channel}`,
    `URL: ${meta.url}`,
  ];
  if (meta.uploadDate) {
    const d = meta.uploadDate;
    parts.push(`Uploaded: ${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`);
  }
  if (meta.durationString) parts.push(`Duration: ${meta.durationString}`);
  if (meta.viewCount != null) parts.push(`Views: ${meta.viewCount.toLocaleString()}`);
  if (meta.likeCount != null) parts.push(`Likes: ${meta.likeCount.toLocaleString()}`);
  if (meta.description) parts.push(`\nDescription:\n${meta.description}`);
  return parts.join("\n");
}

server.registerTool("list_subtitles", {
  description:
    "List available subtitle tracks for a video. Works with any site supported by yt-dlp (YouTube, Vimeo, Twitch, etc.). Also returns video metadata.",
  inputSchema: {
    url: z.string().describe("Video URL"),
  },
}, async ({ url }) => {
  try {
    const { metadata, tracks } = await listSubtitles(url);
    const header = formatMetadataHeader(metadata);

    if (tracks.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `${header}\n\n---\nNo subtitle tracks available for this video.`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `${header}\n\n---\nSubtitle tracks:\n${JSON.stringify(tracks, null, 2)}`,
        },
      ],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text" as const, text: `Error: ${message}` }],
      isError: true,
    };
  }
});

server.registerTool("get_transcript", {
  description:
    "Get the transcript of a video. Works with any site supported by yt-dlp. If no language is specified, defaults to English (preferring manual subs over auto-generated). Returns video metadata followed by the transcript. For long videos, use start_time and end_time to fetch specific time ranges instead of the full transcript.",
  inputSchema: {
    url: z.string().describe("Video URL"),
    language: z
      .string()
      .optional()
      .describe("Language code (e.g. 'en', 'es', 'fr'). Defaults to 'en'."),
    include_timestamps: z
      .boolean()
      .optional()
      .describe("Include timestamps in output (e.g. '[00:01:23] Hello'). Defaults to false."),
    output_format: z
      .enum(["text", "json"])
      .optional()
      .describe("Output format. 'text' (default) returns plain transcript. 'json' returns a JSON array of {timestamp, text} objects, useful for searching/filtering."),
    start_time: z
      .string()
      .optional()
      .describe("Start of time range to return, in HH:MM:SS or MM:SS format (e.g. '00:30:00' for 30 minutes in). Inclusive. Useful for chunking long transcripts."),
    end_time: z
      .string()
      .optional()
      .describe("End of time range to return, in HH:MM:SS or MM:SS format (e.g. '01:00:00' for the 1-hour mark). Inclusive. Useful for chunking long transcripts."),
  },
}, async ({ url, language, include_timestamps, output_format, start_time, end_time }) => {
  try {
    const { metadata, vtt } = await downloadSubtitle(url, language);
    const allLines = parseVTT(vtt);

    if (allLines.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Subtitle track was found but contained no text.",
          },
        ],
        isError: true,
      };
    }

    const lines = filterByTimeRange(allLines, start_time, end_time);
    const totalLines = allLines.length;
    const header = formatMetadataHeader(metadata);

    // Include range info when filtering so the caller knows what they got
    const rangeNote = (start_time || end_time)
      ? `\nShowing ${lines.length} of ${totalLines} transcript lines (${start_time ?? "start"} to ${end_time ?? "end"}).`
      : "";

    if (output_format === "json") {
      const result = {
        metadata,
        totalLines,
        ...(start_time || end_time ? { filteredLines: lines.length, start_time: start_time ?? null, end_time: end_time ?? null } : {}),
        transcript: lines,
      };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }

    const transcript = formatTranscript(lines, include_timestamps ?? false);

    return {
      content: [{ type: "text" as const, text: `${header}${rangeNote}\n\n---\nTranscript:\n${transcript}` }],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text" as const, text: `Error: ${message}` }],
      isError: true,
    };
  }
});

server.registerTool("get_comments", {
  description:
    "Get comments for a video. Works with any site supported by yt-dlp. Comments are sorted by popularity (top). Can be slow on videos with many comments.",
  inputSchema: {
    url: z.string().describe("Video URL"),
    max_comments: z
      .number()
      .int()
      .min(1)
      .max(500)
      .optional()
      .describe("Maximum number of top-level comments to fetch (default: 20, max: 500). Higher values take longer."),
  },
}, async ({ url, max_comments }) => {
  try {
    const { metadata, comments } = await getComments(url, max_comments ?? 20);
    const header = formatMetadataHeader(metadata);

    if (comments.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `${header}\n\n---\nNo comments found for this video.`,
          },
        ],
      };
    }

    const formatted = comments.map((c) => {
      const parts = [
        `${c.author}${c.isPinned ? " [PINNED]" : ""}${c.authorIsUploader ? " [CREATOR]" : ""} (${c.timeText}, ${c.likeCount.toLocaleString()} likes)`,
        c.text,
      ];
      if (c.parentId) parts[0] = `  ↳ ${parts[0]}`;
      return parts.join("\n");
    }).join("\n\n");

    return {
      content: [
        {
          type: "text" as const,
          text: `${header}\n\n---\nComments (${comments.length}):\n\n${formatted}`,
        },
      ],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text" as const, text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// Load the video insights workflow resource
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let videoInsightsMd: string;
try {
  videoInsightsMd = readFileSync(
    resolve(__dirname, "resources", "video-insights.md"),
    "utf-8",
  );
} catch {
  console.error(
    "Fatal: could not load resources/video-insights.md. Run 'npm run build' first.",
  );
  process.exit(1);
}

// Resource registry for the get_resource tool (fallback for clients that can't fetch MCP resources)
const resourceRegistry: Record<string, { description: string; content: string }> = {
  "video-insights": {
    description:
      "Step-by-step workflow for extracting key insights with timestamps from a video using the get_transcript and get_comments tools.",
    content: videoInsightsMd,
  },
};

server.registerTool("get_resource", {
  description:
    "Get a resource by name, or list all available resources if no name is given. Use this to access workflow guides and reference documents provided by this server.",
  inputSchema: {
    resource: z
      .string()
      .optional()
      .describe("Resource name to retrieve (e.g. 'video-insights'). Omit to list all available resources."),
  },
}, async ({ resource }) => {
  if (!resource) {
    const listing = Object.entries(resourceRegistry)
      .map(([name, { description }]) => `- **${name}**: ${description}`)
      .join("\n");
    return {
      content: [{
        type: "text" as const,
        text: `Available resources:\n\n${listing}\n\nPass a resource name to retrieve its full content.`,
      }],
    };
  }

  const entry = resourceRegistry[resource];
  if (!entry) {
    const valid = Object.keys(resourceRegistry).join(", ");
    return {
      content: [{ type: "text" as const, text: `Unknown resource: "${resource}". Available resources: ${valid}` }],
      isError: true,
    };
  }

  return {
    content: [{ type: "text" as const, text: entry.content }],
  };
});

server.registerResource(
  "video-insights",
  "yt-dlp://instructions/video-insights",
  {
    description:
      "Step-by-step workflow for extracting key insights with timestamps from a video using the get_transcript and get_comments tools.",
    mimeType: "text/markdown",
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "text/markdown",
        text: videoInsightsMd,
      },
    ],
  }),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
