# Video Insights Workflow

You have access to tools for extracting transcripts and comments from videos. Follow this workflow to produce a structured list of key insights from a video.

## Step 1: Get the Transcript

Call `get_transcript` with:
- `url`: the video URL
- `include_timestamps`: `true`

This returns the full transcript with timestamps like `[00:01:23] text`. You will use these timestamps to anchor your insights.

## Step 2: Get the Comments

Call `get_comments` with:
- `url`: the video URL
- `max_comments`: `50` (adjust higher for popular videos if needed)

Comments are sorted by popularity. They provide audience reactions, corrections, and supplementary context.

**Note:** Some videos have comments disabled or restricted. If this call fails, skip to Step 3 and work with the transcript alone.

## Step 3: Analyze and Extract Key Insights

Review the transcript and comments together. Identify key insights using these categories:

1. **Core ideas** — The main points, arguments, or teachings from the video. Include the timestamp where each idea is first introduced or best articulated.
2. **Notable quotes or moments** — Particularly impactful, surprising, or well-phrased statements. Include exact timestamps.
3. **Audience perspective** — Points from the comments that add value: widespread agreement/disagreement, corrections to claims made in the video, additional context, or notable reactions. Attribute these as "from comments" rather than from the video itself.

## Step 4: Present the Insights

Format your output as a structured list. For each insight:
- Lead with the **timestamp** in `[HH:MM:SS]` format (omit for comment-sourced insights)
- Follow with a **concise summary** of the insight
- Add brief **context or detail** where helpful

Example format:

### Key Insights from "[Video Title]"

1. **[00:02:15]** The speaker argues that X leads to Y — this is the central thesis of the video and is revisited throughout.
2. **[00:08:42]** A surprising statistic is cited: "Z% of cases result in W." This is the most concrete evidence presented.
3. **[00:14:03]** The speaker shares a personal anecdote about Q, which illustrates the broader point about R.
4. **[From comments]** Multiple top comments point out that the statistic at 00:08:42 may be outdated, citing a 2024 study with different figures.
5. **[00:21:30]** The conclusion offers three actionable takeaways: A, B, and C.

## Guidelines

- Aim for 5-15 insights depending on video length and density.
- Prioritize quality over quantity — skip filler or repetitive points.
- Always include timestamps for transcript-sourced insights so readers can jump to that point in the video.
- When comments contradict or enrich a transcript point, pair them together.
- Keep each insight concise (1-3 sentences).
