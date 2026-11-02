# Tripwire prototype (AA261 Part II)

Tripwire is a receive-only passive radar: listener boxes pick up drone echoes of signals already in the air (cell towers, FM radio, digital TV, satellite TV) and alert site security. This repo holds the AA261 prototype work. Five founders share it, each using Claude Code, so every session must leave enough context for the next person to continue.

## Handoff workflow (required for everyone)

1. **At the start of a session**, read the current handoff below. It is the shared state of the project: what was decided, what is in progress, and what comes next.
2. **Before every commit**, run the `/handoff` skill. It updates `context/HANDOFF.md` and adds an entry to `context/SESSION_LOG.md` summarising this session's conversation, then stages both files.
3. A hook blocks `git commit` if `context/HANDOFF.md` is not part of the commit. For a commit that genuinely needs no handoff (a typo fix), put `[skip-handoff]` in the commit message.
4. Never write secrets, passwords, API keys or personal contact details into the context files.

@context/HANDOFF.md

## Project facts

- Assignment brief: `Protoype_Assignment_Description.txt`. Seed memo: `Big Idea Investment Memo v2.pdf`. The chat history that produced the idea: `Context_log.txt`.
- Current prototype plan: `Tripwire_Prototype_Feedback_Request_v2.docx`. Earlier versions are kept for reference.
- Every number must come from a cited source or be labelled an assumption. Investors and graders will check.
- Use US spelling ("license", "defense").
