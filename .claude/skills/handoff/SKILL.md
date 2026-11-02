---
name: handoff
description: Update the shared team handoff before a commit. Rewrites context/HANDOFF.md with the project's current state and appends a summary of this Claude session's conversation to context/SESSION_LOG.md, then stages both. Use before every git commit in this repo, or when the user says "handoff", "save context" or "wrap up the session".
---

# Team handoff

Five teammates continue each other's work through Claude Code. Your job is to leave the next person, and their Claude, enough context to pick up exactly where this session stopped, without reading this conversation.

## Steps

1. Read `context/HANDOFF.md` and the last few entries of `context/SESSION_LOG.md`.
2. Check what changed: `git status`, `git diff --cached --stat`, and `git log --oneline -10`.
3. Ask the user for their first name if you don't know who is driving this session.
4. **Append** one entry to the top of the entries in `context/SESSION_LOG.md` (newest first), using this template:

   ```markdown
   ## YYYY-MM-DD · <name> · <short title>

   **Asked for:** what the user wanted this session, in one or two sentences.
   **Done:** what was produced or changed, naming files and links.
   **Decided:** each judgement call, with the reason and the alternative rejected.
   **Left open:** anything unfinished, unverified, or waiting on someone.
   ```

   Summarise the conversation; don't paste it. Include the user's important instructions in their own words where wording matters.

5. **Rewrite** `context/HANDOFF.md` so it describes the project as it stands now (not a history). Keep these sections and keep the whole file under about 80 lines:
   - Current state: what exists and where (files, doc links).
   - Decisions in force: the choices later work must respect, each with a one-line reason.
   - In progress: who is doing what, if known.
   - Next steps: ordered, concrete.
   - Open questions: for the team or the teaching team.

   Move anything no longer true out of HANDOFF.md. The log keeps the history.
6. Stage both files: `git add context/HANDOFF.md context/SESSION_LOG.md`.
7. Tell the user in one line that the handoff is staged, then continue with their commit.

## Rules

- Never write secrets, passwords, API keys, tokens or personal contact details.
- State facts plainly: if something was not tested or verified, say so.
- Dates are absolute (2026-11-01), never "today" or "last week".
- Use the US spelling the rest of the repo uses.
