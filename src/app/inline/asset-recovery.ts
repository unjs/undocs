/**
 * INLINE PROGRAM — recovery for HTML that outlived its assets. See
 * `inline/README.md`; `entry-server.ts` inlines the compiled artifact and gates
 * it on `import.meta.dev` so it never ships in dev.
 *
 * Bundle files are content-hashed, `immutable` and per-deployment, so a document
 * naming a build the server no longer serves has every `/_undocs/*` reference
 * 404 — including the entry script, in which case `main.ts` never runs and
 * nothing in the bundle (not `vite:preloadError`, not the service worker) can
 * react. This inline listener is the only code guaranteed to have executed by
 * then, so recovery has to live here: reload once onto whatever the server
 * currently serves.
 *
 * Capture phase, because resource load errors don't bubble.
 *
 * The retry is DELAYED and escalating. The window this recovers from is a deploy
 * still settling, which lasts seconds — reloading the instant the first asset
 * fails just lands in the same broken window and wastes the attempt.
 * `scheduled` collapses the burst of errors (every asset in the document fails
 * at once) into a single reload.
 *
 * The attempt budget is keyed to the BUILD, taken from the entry script's hashed
 * URL. Reloading onto a genuinely new build resets it — a later deploy gets full
 * recovery. Reloading onto the SAME build twice means the mismatch is persistent
 * (stale HTML the edge keeps re-serving, or a chunk that is really gone), so we
 * stop and let it fail visibly rather than thrash. That is also what stops a
 * permanently-missing lazy chunk from reload-looping forever.
 */
import { ASSETS_BASE } from "../assets-base.ts";

/** sessionStorage key holding `"<build-url> <attempts>"`. */
const STORAGE_KEY = "undocs:asset-recovery";

/** Escalating reload delays; its length is also the per-build attempt budget. */
const DELAYS = [1500, 5000];

let scheduled = false;

addEventListener(
  "error",
  (event) => {
    const target = event.target as (HTMLScriptElement & HTMLLinkElement) | null;
    if (!target || (target.tagName !== "SCRIPT" && target.tagName !== "LINK")) return;
    if (!(target.src || target.href || "").includes(ASSETS_BASE)) return;
    if (scheduled) return;

    const entry = document.querySelector(`script[type="module"][src*="${ASSETS_BASE}"]`);
    const build = entry?.getAttribute("src") || "";

    let attempts = 0;
    try {
      const previous = (sessionStorage.getItem(STORAGE_KEY) || "").split(" ");
      if (previous[0] === build) attempts = Number(previous[1]) || 0;
      if (attempts >= DELAYS.length) return;
      sessionStorage.setItem(STORAGE_KEY, `${build} ${attempts + 1}`);
    } catch {
      // Storage blocked (private mode / blocked cookies). Without it we can't
      // prove we haven't already reloaded, so don't risk the loop.
      return;
    }

    scheduled = true;
    setTimeout(() => location.reload(), DELAYS[attempts]);
  },
  true,
);
