# Financial model v2 (pivot) sources

`financial-model-v2.html` is built by concatenating, in order:
1. the first 181 lines of the v1 page head (design tokens and base CSS) from `../financial-model.html`, with the title changed to "Tripwire Model v2";
2. `style_extra.css`, then `body2.html` (extra CSS and the page markup);
3. `model2.js` (the engine: `runModel`, `investorReturns`, all inputs in `FIXED`, `SEGMENTS`, `DEFAULTS`);
4. `ui2.js` (sliders, scenarios, charts, tables).

```bash
head -181 ../financial-model.html | sed 's#<title>Tripwire Financial Model</title>#<title>Tripwire Model v2</title>#' > ../financial-model-v2.html
cat style_extra.css body2.html model2.js ui2.js >> ../financial-model-v2.html
```

Every cost from the twin, every cited figure and every assumption is labelled in the code comments and in the page's "Where the numbers come from" panel. Research notes: `context/research/`.
