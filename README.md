# yt-dlp-mcp

An MCP server that gives AI assistants the ability to retrieve transcripts, comments, and metadata from online videos. Works with any site supported by [yt-dlp](https://github.com/yt-dlp/yt-dlp) — YouTube, Vimeo, Twitch, and [thousands more](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md).

## Features

- **Transcripts** — Download subtitles in plain text or structured JSON, with optional timestamps and time-range filtering for long videos
- **Comments** — Fetch top comments sorted by popularity, including author info, likes, and pinned status
- **Subtitle tracks** — List all available subtitle languages and formats for a video
- **Video metadata** — Title, channel, duration, view count, and more, included with every response
- **Video insights workflow** — Built-in MCP resource with a step-by-step guide for extracting key insights from videos

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) installed and available on your `PATH`

Install yt-dlp:

```bash
# pip
pip install yt-dlp

# brew
brew install yt-dlp

# or download from https://github.com/yt-dlp/yt-dlp/releases
```

## Installation

### Claude Desktop / Claude Code

Add to your MCP server configuration:

```json
{
  "mcpServers": {
    "yt-dlp": {
      "command": "npx",
      "args": ["-y", "@akp-tools/yt-dlp-mcp"]
    }
  }
}
```

### Global install

```bash
npm install -g @akp-tools/yt-dlp-mcp
```

Then run directly:

```bash
yt-dlp-mcp
```

## Tools

### `list_subtitles`

Lists available subtitle tracks for a video. Returns video metadata and all available subtitle languages/formats.

```
url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

### `get_transcript`

Downloads and returns the transcript of a video.

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `url` | Yes | — | Video URL |
| `language` | No | `en` | Subtitle language code |
| `include_timestamps` | No | `false` | Add `[HH:MM:SS]` timestamps |
| `output_format` | No | `text` | `text` or `json` |
| `start_time` | No | — | Start of time range (`HH:MM:SS` or `MM:SS`) |
| `end_time` | No | — | End of time range (`HH:MM:SS` or `MM:SS`) |

For long videos, use `start_time` and `end_time` to fetch specific segments instead of the full transcript.

### `get_comments`

Fetches top comments sorted by popularity.

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `url` | Yes | — | Video URL |
| `max_comments` | No | `20` | Number of comments to fetch (1–500) |

### `get_resource`

Retrieves built-in workflow guides. Useful as a fallback for MCP clients that don't support the resources protocol.

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `resource` | No | — | Resource name (omit to list all available) |

## Resources

| URI | Description |
|-----|-------------|
| `yt-dlp://instructions/video-insights` | Step-by-step workflow for extracting key insights from a video using transcripts and comments |

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Watch mode
pnpm dev

# Run tests
pnpm test
```

## License

MIT
