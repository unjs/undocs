/**
 * Cross-origin isolation (`crossOriginIsolation` in `.config/docs.*`).
 *
 * OPT-IN, off by default. When enabled, every response carries
 * `Cross-Origin-Opener-Policy: same-origin` plus a `Cross-Origin-Embedder-Policy`,
 * which is what makes a page `crossOriginIsolated` — the precondition for
 * `SharedArrayBuffer`, wasm threads and `performance.measureUserAgentSpecificMemory()`.
 * Docs that embed a wasm-threaded playground (a Rust/Emscripten demo, a
 * SQLite/FFmpeg build, anything using `Atomics.wait`) need it; nothing else does,
 * which is why it is not the default: COEP is the header most likely to break a
 * third-party embed, and a docs site that never touches `SharedArrayBuffer` pays
 * that risk for nothing.
 *
 * Two COEP values are accepted, and the difference is who has to cooperate:
 *
 *   - `credentialless` (the default, and what `true` means) sends cross-origin
 *     no-cors subresource requests WITHOUT credentials, so a third-party image,
 *     font or script loads whether or not its server sends
 *     `Cross-Origin-Resource-Policy`. Nothing upstream has to change.
 *   - `require-corp` is the stricter, older mode: every cross-origin subresource
 *     must opt in explicitly (`Cross-Origin-Resource-Policy: cross-origin`, or
 *     CORS), and anything that does not is BLOCKED. Pick it only when you control
 *     — or have verified — every cross-origin asset the docs load.
 *
 * Under either value a cross-origin IFRAME must send COEP of its own, so an
 * embedded StackBlitz/CodeSandbox/YouTube frame can stop loading. That is a
 * property of cross-origin isolation itself, not of the value chosen.
 *
 * `nitro.config.ts` folds the returned headers into its `/**` route rule, which
 * covers `undocs dev` and the built output from one declaration. Pure config
 * normalization — no node imports — but server-only: the client never sees it.
 */

/** The accepted `Cross-Origin-Embedder-Policy` values, in config spelling. */
export type CoepPolicy = "credentialless" | "require-corp";

const COEP_POLICIES: readonly CoepPolicy[] = ["credentialless", "require-corp"];

/** `true` picks this one: isolation without asking every upstream to send CORP. */
const DEFAULT_COEP: CoepPolicy = "credentialless";

/**
 * Normalize the user-authored `crossOriginIsolation` value to a COEP policy, or
 * `undefined` when isolation is off (the default).
 *
 * `true` → `credentialless`; either policy name passes through. Anything else is
 * off AND warned about: silently serving no isolation for a typo'd
 * `require_corp` is a long afternoon in devtools.
 */
export function normalizeCrossOriginIsolation(input: unknown): CoepPolicy | undefined {
  if (input === undefined || input === null || input === false) {
    return undefined;
  }
  if (input === true) {
    return DEFAULT_COEP;
  }
  if (typeof input === "string" && COEP_POLICIES.includes(input as CoepPolicy)) {
    return input as CoepPolicy;
  }
  console.warn(
    `[undocs] ignoring invalid \`crossOriginIsolation\` value ${JSON.stringify(input)}: ` +
      `expected true, false, ${COEP_POLICIES.map((p) => `"${p}"`).join(" or ")}. ` +
      `Cross-origin isolation stays OFF.`,
  );
  return undefined;
}

/**
 * The response headers for the configured mode, or `undefined` when off.
 *
 * Returned as a plain map (not a route rule) so the caller can merge it into an
 * EXISTING `/**` rule — spreading a second `/**` key would drop the ISR rule it
 * collides with.
 */
export function crossOriginIsolationHeaders(input: unknown): Record<string, string> | undefined {
  const coep = normalizeCrossOriginIsolation(input);
  if (!coep) {
    return undefined;
  }
  return {
    // Severs the opener/openee relationship with cross-origin documents. Both
    // headers are required: COOP alone does not isolate.
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-embedder-policy": coep,
  };
}
