---
description: End-of-session — update PRIMER.md and append to SESSION-LOG.md
---

Do TWO things at end of session:

FIRST — Append to SESSION-LOG.md at the project root.
Add a new entry at the TOP of the file (newest first) with:

### Session — [today's date] [approximate time]
**Focus:** One-line summary of what this session was about
**Changes:**
- List every file created/modified/deleted
- List every commit made
**Decisions:** Any architecture or approach decisions made
**Issues Found:** Bugs or problems discovered
---

Do NOT delete existing entries. Always append to the top.
This file is a permanent log.

SECOND — Rewrite PRIMER.md as a fresh snapshot. Include:

## Current State
What's working, deployed, overall status.

## Recent Sessions (last 3)
Summary of the last 3 sessions from SESSION-LOG.md —
one bullet per session with date and focus area.

## In Progress
Anything started but not finished across recent sessions.

## Known Issues
All current bugs, broken things, tech debt.

## Next Session
What to tackle next, in priority order. Be specific enough
that a fresh Claude Code session can pick this up cold.

## Key Decisions
Running list of important decisions that affect how code
should be written. Pull from SESSION-LOG.md entries.

Keep PRIMER.md under 100 lines. Keep it factual, no filler.
