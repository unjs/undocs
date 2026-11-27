/**
 * Opt-in COOP/COEP for SharedArrayBuffer and wasm threads. `credentialless`
 * strips credentials from cross-origin no-cors loads; `require-corp` blocks
 * resources without CORP/CORS. Either mode can break cross-origin iframes.
 * CORP `cross-origin` comes with them, so another cross-origin isolated page
 * can still embed the docs in an iframe (it needs both the frame's COEP and
 * its CORP).
 */

export type CoepPolicy = "credentialless" | "require-corp";

const COEP_POLICIES: readonly CoepPolicy[] = ["credentialless", "require-corp"];

// `true` avoids requiring CORP from every upstream.
const DEFAULT_COEP: CoepPolicy = "credentialless";

// Invalid values disable isolation with a warning rather than failing silently.

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

// Return a map for merging into the existing `/**` rule; a duplicate key would drop ISR.

export function crossOriginIsolationHeaders(input: unknown): Record<string, string> | undefined {
  const coep = normalizeCrossOriginIsolation(input);
  if (!coep) {
    return undefined;
  }
  return {
    // COOP alone does not isolate.
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-embedder-policy": coep,
    // An isolated embedder (COEP require-corp) loads a cross-origin frame only
    // with this; the docs are public, so any origin may.
    "cross-origin-resource-policy": "cross-origin",
  };
}
