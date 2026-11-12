# Tripwire prototype

AA261 Part II prototype for Tripwire, a receive-only passive radar that turns signals already in the air (cell towers, FM radio, digital TV, satellite TV) into low-altitude drone detection.

## Start here

- **`context/HANDOFF.md`**: where the project stands, decisions in force, and next steps.
- **`context/SESSION_LOG.md`**: what each Claude Code session did and why, newest first.

## Working with Claude Code on this repo

Claude Code loads `CLAUDE.md` automatically, which pulls in the current handoff. Before each commit, run `/handoff`: it updates both context files and stages them. A hook blocks `git commit` until `context/HANDOFF.md` is in the commit. Put `[skip-handoff]` in the message for trivial commits.

The first time you open the repo, Claude Code may ask you to trust the project's settings and hook. Accept it so the workflow applies. The hook needs `bash`, which macOS has and which Git for Windows provides.

## What's here

| File | What it is |
|---|---|
| `BUSINESS_PLAN_UPDATE_BRIEF.md` | How to update the business plan from the prototype (setup, reading order, rules, starter prompt) |
| `Tripwire_Assumptions_and_Figures.md` | Every assumption and figure behind the prototype, generated from the twin (`prototype/tools/build_assumptions_doc.py`) |
| `Iterations.docx` | One short entry per prototype build, lessons for the product, risks, key assumptions |
| `prototype/` | The digital twin and its viewer (start with `prototype/README.md`) |
| `Tripwire_Prototype_Feedback_Request_v2.docx` | Current prototype plan: trade-space evaluator + national site survey (2 pages) |
| `Tripwire_Prototype_Feedback_Request.docx` | v1 feedback request: digital-twin plan |
| `Tripwire_Prototype_Proposal.docx` | Detailed 3-page proposal with technical architecture |
| `Protoype_Assignment_Description.txt` | Part II assignment brief |
| `Big Idea Investment Memo v2.pdf` | Seed investment memo (Oct 22, 2026) |
| `OriginalIdea.rtf` | First "Tripwire Twin" pitch to the team |
| `Context_log.txt` | Chat history that led to the idea, before this repo existed |

## Team

Ashlynn Sweet, Nimalan S/O Anbhuarasan, Siddarth Ramasubramanian, Taras Yushchenko, Adeline Zuckerman
