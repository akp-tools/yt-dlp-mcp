#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { listSubtitles, downloadSubtitle } from "./ytdlp.js";
import { parseVTT, formatTranscript } from "./parser.js";

const server = new McpServer({
  name: "yt-dlp-mcp",
  version: "0.1.0",
});

server.registerTool("list_subtitles", {
  description:
    "List available subtitle tracks for a video. Works with any site supported by yt-dlp (YouTube, Vimeo, Twitch, etc.).",
  inputSchema: {
    url: z.string().describe("Video URL"),
  },
}, async ({ url }) => {
  try {
    const tracks = await listSubtitles(url);

    if (tracks.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No subtitle tracks available for this video.",
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(tracks, null, 2),
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
    "Get the transcript of a video. Works with any site supported by yt-dlp. If no language is specified, defaults to English (preferring manual subs over auto-generated).",
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
  },
}, async ({ url, language, include_timestamps }) => {
  try {
    const vttContent = await downloadSubtitle(url, language);
    const lines = parseVTT(vttContent);

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

    const transcript = formatTranscript(lines, include_timestamps ?? false);

    return {
      content: [{ type: "text" as const, text: transcript }],
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
