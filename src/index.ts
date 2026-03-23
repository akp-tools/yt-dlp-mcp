#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { listSubtitles, downloadSubtitle, getComments } from "./ytdlp.js";
import { parseVTT, formatTranscript } from "./parser.js";
import type { VideoMetadata } from "./types.js";

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
    "Get the transcript of a video. Works with any site supported by yt-dlp. If no language is specified, defaults to English (preferring manual subs over auto-generated). Returns video metadata followed by the transcript.",
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
  },
}, async ({ url, language, include_timestamps, output_format }) => {
  try {
    const { metadata, vtt } = await downloadSubtitle(url, language);
    const lines = parseVTT(vtt);

    if (lines.length === 0) {
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

    const header = formatMetadataHeader(metadata);

    if (output_format === "json") {
      const result = {
        metadata,
        transcript: lines,
      };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }

    const transcript = formatTranscript(lines, include_timestamps ?? false);

    return {
      content: [{ type: "text" as const, text: `${header}\n\n---\nTranscript:\n${transcript}` }],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text" as const, text: `Error: ${message}` }],
      isError: true,
    };
  }
});

    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text" as const, text: `Error: ${message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
