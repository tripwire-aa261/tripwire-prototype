# Google Doc tab builders

`build_prototype_tab.py` writes the HTML for the "Product Prototype" tab of the team Google Doc
("Your Seed Pitch Data Package and Prototype"). The walkthrough text lives in this script; the screenshots are in
`prototype_tab_images/`.

    python build_prototype_tab.py prototype_tab_images out.html
    python body_check.py out.html out_body.html   # extracts the body, warns about "$... ($" text that Docs turns into formulas

Paste `out_body.html` into the tab as rich text (select all in the tab, then paste). Pasting replaces the tab, so
comment threads on it become detached: answer or copy them first. Screenshots were taken with headless Edge at
1440 px wide from the twin served locally, then resized to 1100 px.
