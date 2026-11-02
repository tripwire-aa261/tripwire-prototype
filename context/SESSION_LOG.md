# Session log

One entry per Claude Code session, newest first. Written by the `/handoff` skill before each commit. The chat history from before this repo existed is in `Context_log.txt`.

## 2026-11-01 · Siddarth · Remove remaining hardware-spec mentions from v2

**Asked for:** Remove feedback question 4 and the diagram's "Hardware spec" box. Siddarth briefly reversed this, then confirmed the removal.
**Done:** Both removed from the v2 doc. `Tripwire_Prototype_Feedback_Request_v2.docx` rebuilt; it now has 3 feedback questions.
**Decided:** v2 makes no mention of the hardware spec. It stays in the detailed proposal and the final deliverable.
**Left open:** Feedback question 1 still says "with hardware as the path to product", which is kept as written.

## 2026-11-01 · Siddarth · Drop "Path to a product" from the v2 feedback request

**Asked for:** Remove the path-to-product section from the feedback-request version.
**Done:** Deleted the section (hardware spec, engineering, testing, manufacturing, approvals, cost) from the v2 doc and rebuilt `Tripwire_Prototype_Feedback_Request_v2.docx`. The path-to-product content still exists in `Tripwire_Prototype_Proposal.docx` and in Decisions in force in HANDOFF.md.
**Decided:** The feedback request describes only the prototype; path to product is saved for the final deliverable.
**Left open:** Feedback question 4 still mentions "the hardware spec", and the diagram still has a "Hardware spec" box. Neither is explained in v2 any more. Siddarth to decide whether to keep them.

## 2026-11-01 · Siddarth · Trim the v2 feedback questions

**Asked for:** Remove the v2 feedback question asking the teaching team for datasets or Stanford contacts. Siddarth: "They will shoot back at us that we are supposed to find relevant profs working in this field... this is something we can do on our own."
**Done:** Deleted that question from the v2 doc and rebuilt `Tripwire_Prototype_Feedback_Request_v2.docx`, which now has 4 feedback questions. Finding faculty and datasets moved to Next steps in HANDOFF.md.
**Decided:** The team sources faculty contacts and datasets itself rather than asking the teaching team.
**Left open:** v2 still not sent to the teaching team.

## 2026-11-01 · Siddarth · Repo setup, prototype proposal, feedback request v1 and v2

**Asked for:**
- Set up this folder as a git repo shared with the team.
- Read the brief, memo, idea notes and chat log.
- Plan a prototype that impresses investors and meets the brief, and can extend to other industries and signal sources.
- Write a short, low-jargon doc asking the teaching team for feedback.
- Make every commit carry Claude chat context so teammates can continue.

**Done:**
- Created the private GitHub repo `sura2903/tripwire-prototype` and pushed it.
- Wrote a detailed proposal (`Tripwire_Prototype_Proposal.docx`), then two 2-page feedback requests (`..._Feedback_Request.docx` and `..._v2.docx`), each with a Claude Docs version.
- Added this handoff workflow: `CLAUDE.md`, the `/handoff` skill, and a commit hook in `.claude/settings.json`.

**Decided:**
- Dropped Starlink as a signal source because its format is proprietary. Using FM radio, digital TV and satellite TV (DVB-S2) instead.
- Dropped GPU-dependent ray tracing; the team has no GPUs.
- Owner column left blank (Siddarth cleared it in Word).
- Pivoted from a 3D digital-twin demo to a trade-space evaluator plus national site survey. Reasons: a simulation-only twin risks looking like a 20-minute rebuild, and building hardware is too risky. Hardware is the written path to product.
- Kept the detailed proposal at 3 pages rather than trimming it, at Siddarth's request.

**Left open:**
- v2 not yet sent to the teaching team.
- Go-to-market ideas for other industries were discussed in chat but not written into any doc:
  - channel partners (Anduril Lattice, Dedrone)
  - tower companies as hosts
  - a low-altitude airspace data feed
  - bird and bat monitoring for wind farms and airports
  - perimeter intrusion detection
  - remote sites
- The commit hook was tested by piping sample inputs, and on Siddarth's Windows machine. It is not yet confirmed on a teammate's Mac.
