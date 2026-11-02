# Handoff: current state

Last updated 2026-11-01 by Siddarth. History is in `context/SESSION_LOG.md`.

## Current state

- Prototype plan is at the feedback stage; nothing is built yet.
- Latest plan, to send to the teaching team: `Tripwire_Prototype_Feedback_Request_v2.docx` (2 pages). Editable doc: https://claude.ai/artifact/D4PNP9zHLZcvhuRSUZMnTz
- Earlier versions, kept for reference:
  - `Tripwire_Prototype_Feedback_Request.docx`: v1, a digital-twin plan.
  - `Tripwire_Prototype_Proposal.docx`: a detailed 3-page proposal with a technical architecture diagram.
- The Claude Docs links are private to Siddarth's account. Teammates should use the Word copies in this repo unless he shares the docs.
- GitHub repo (private): https://github.com/sura2903/tripwire-prototype

## Decisions in force

- **Software-only prototype.** Hardware is described as the path to product, not built. Reason: the team doesn't trust hardware to work in time; it would be research-paper effort.
- **Core = trade-space evaluator + national site survey.**
  - The evaluator links design choices (signal, listeners, antennas, drone size) to detection range, coverage, kit cost, margin and revenue.
  - The survey scores all 8,495 memo facilities on nearby signal strength, using public tower and broadcast data.
  - Reason: the brief names a "physics based trade-space evaluator" with financial implications as an acceptable prototype.
- **Hardware spec as the bridge to product.** The evaluator outputs what the listener box must do, a parts list and unit cost. This is kept out of the v2 feedback request and saved for the final deliverable.
- **No Starlink.** Its signal format is proprietary. Use LTE/5G, FM radio, terrestrial digital TV and satellite TV (DVB-S2, a published standard).
- **No GPUs.** Everything runs on team laptops.
- **Owner column left blank** in the plan table. Module owners are not assigned yet.
- **Realism check:** reproduce two published field trials before trusting results:
  - Fraunhofer LTE450: a drone detected at about 500 m.
  - arXiv 2412.20788: LTE downlink tracking.

## In progress

- Nothing assigned yet.

## Next steps

1. Team reviews the v2 feedback request; send it to the teaching team.
2. Wait for feedback, then assign module owners.
3. Find Stanford faculty working on passive radar or drone detection, and public datasets for checking the model. We do this ourselves; it is deliberately not asked of the teaching team.
4. Set up the code skeleton (evaluator, site survey, tests) once the plan is approved.

## Open questions

- Is a software-only prototype acceptable to the teaching team? (asked in v2)
- Can this prototype also be used for another course's project? (not yet asked)
