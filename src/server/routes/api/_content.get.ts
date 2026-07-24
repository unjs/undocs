import { defineEventHandler, html } from "nitro/h3";
import { getIndex, getDocsDir, invalidateIndex } from "../../content/store";

/**
 * Debug page: content build timing (load/parse/transform/highlight) +
 * sizes, rendered as a simple HTML page.
 *
 * The index is built once and cached (see `store.ts`), so `stats` reflects that
 * one real build. `resolveMs` is how long *this* request waited on `getIndex()`
 * — ~0 on a warm cache hit, ≈ build time right after a cold rebuild.
 *
 * Query:
 *   ?fresh   force a cold rebuild first, so `stats` re-measures a full load.
 */
export default defineEventHandler(async (event) => {
  const q = event.url.searchParams;
  const fresh = q.has("fresh") && q.get("fresh") !== "false";

  if (fresh) invalidateIndex();

  const start = performance.now();
  const index = await getIndex();
  const resolveMs = performance.now() - start;

  const s = index.stats;
  const round = (n: number) => Math.round(n * 100) / 100;
  const fmtMs = (n: number) => `${round(n)} ms`;

  // Phase rows, widest bar = the slowest phase.
  const phaseEntries = Object.entries(s.phases);
  const maxPhase = Math.max(...phaseEntries.map(([, v]) => v), 0.0001);
  const phaseRows = phaseEntries
    .sort((a, b) => b[1] - a[1])
    .map(([name, ms]) => {
      const pct = (ms / s.totalMs) * 100;
      const barPct = (ms / maxPhase) * 100;
      return `<tr>
        <th>${name}</th>
        <td class="num">${fmtMs(ms)}</td>
        <td class="num">${round(pct)}%</td>
        <td class="bar"><span style="width:${round(barPct)}%"></span></td>
      </tr>`;
    })
    .join("");

  const countRows = Object.entries(s.counts)
    .map(([name, n]) => `<tr><th>${name}</th><td class="num">${n}</td></tr>`)
    .join("");

  const age = Math.round((Date.now() - s.builtAt) / 1000);

  return html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Content build stats</title>
        <style>
          :root {
            color-scheme: light dark;
          }
          body {
            font:
              14px/1.5 ui-monospace,
              SFMono-Regular,
              Menlo,
              monospace;
            max-width: 720px;
            margin: 2rem auto;
            padding: 0 1rem;
          }
          h1 {
            font-size: 1.2rem;
            margin: 0 0 0.25rem;
          }
          .meta {
            opacity: 0.7;
            margin: 0 0 1.5rem;
            font-size: 12px;
          }
          .meta code {
            background: color-mix(in srgb, currentColor 12%, transparent);
            padding: 0.1em 0.35em;
            border-radius: 4px;
          }
          h2 {
            font-size: 1rem;
            margin: 1.5rem 0 0.5rem;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th,
          td {
            text-align: left;
            padding: 0.3rem 0.5rem;
            border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent);
          }
          th {
            font-weight: 600;
          }
          .num {
            text-align: right;
            font-variant-numeric: tabular-nums;
            white-space: nowrap;
          }
          td.bar {
            width: 40%;
          }
          td.bar span {
            display: block;
            height: 0.7em;
            border-radius: 3px;
            background: color-mix(in srgb, currentColor 45%, transparent);
          }
          tfoot th,
          tfoot td {
            border-top: 2px solid currentColor;
            border-bottom: none;
            font-weight: 700;
          }
          a {
            color: inherit;
          }
        </style>
      </head>
      <body>
        <h1>Content build stats</h1>
        <p class="meta">
          <code>${getDocsDir()}</code><br />
          total <strong>${fmtMs(s.totalMs)}</strong> · built ${age}s ago · this request resolved in
          ${fmtMs(resolveMs)}${fresh ? " (cold rebuild)" : ""} ·
          <a href="?fresh">rebuild &amp; re-measure</a>
        </p>

        <h2>Phases</h2>
        <table>
          <thead>
            <tr>
              <th>phase</th>
              <th class="num">time</th>
              <th class="num">%</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${phaseRows}
          </tbody>
          <tfoot>
            <tr>
              <th>total</th>
              <td class="num">${fmtMs(s.totalMs)}</td>
              <td class="num">100%</td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        <h2>Counts</h2>
        <table>
          <tbody>
            ${countRows}
          </tbody>
        </table>
      </body>
    </html>`;
});
