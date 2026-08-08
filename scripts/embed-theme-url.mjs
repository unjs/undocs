/**
 * Build (or decode) an embed-theme URL fragment.
 *
 *   node scripts/embed-theme-url.mjs '{"p":"#0ea5e9","d":{"p":"#38bdf8"}}'
 *   node scripts/embed-theme-url.mjs theme.json
 *   cat theme.json | node scripts/embed-theme-url.mjs
 *   node scripts/embed-theme-url.mjs --url https://docs.example.com/guide theme.json
 *   node scripts/embed-theme-url.mjs --decode '#~eyJwIjoiIzBlYTVlOSJ9'
 *
 * The point is the VALIDATION: the inline program silently drops anything it
 * doesn't recognise (a typo'd key, an over-long value, a `url()`), so a
 * hand-rolled `btoa(JSON.stringify(...))` can look fine and theme nothing. This
 * checks the payload against the same rules — imported from `embed-theme.ts`,
 * so it cannot drift from what actually ships — and refuses to emit a fragment
 * that would be partly ignored.
 *
 * Repo-local tooling: `scripts/` is not published, and embedders need no undocs
 * install to build a fragment. See `docs/1.guide/6.embedding.md` for the
 * dependency-free one-liner.
 */
import { readFile } from "node:fs/promises";
import process from "node:process";
import {
  EMBED_HASH_SEPARATOR,
  EMBED_MAX_PAYLOAD,
  EMBED_MAX_VALUE,
  EMBED_THEME_TOKENS,
} from "../src/app/embed-theme.ts";

const FETCHING_VALUE = /url\(|image-set\(|element\(/i;
const MODES = { l: "light", d: "dark" };

const encode = (value) =>
  Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");

const decode = (raw) =>
  JSON.parse(Buffer.from(raw.replaceAll("-", "+").replaceAll("_", "/"), "base64").toString("utf8"));

/** Everything wrong with `theme`, in the words the runtime would use. */
function validate(theme, errors = [], path = "") {
  if (!theme || typeof theme !== "object" || Array.isArray(theme)) {
    errors.push(`${path || "payload"} must be a JSON object`);
    return errors;
  }

  for (const [key, value] of Object.entries(theme)) {
    const at = `${path}${key}`;

    if (key === "d") {
      if (path) errors.push(`${at}: dark overrides can only be at the top level`);
      else validate(value, errors, "d.");
      continue;
    }

    if (key === "m") {
      if (path) errors.push(`${at}: the color mode can only be set at the top level`);
      else if (!(value in MODES)) {
        errors.push(`m: expected "l" (light) or "d" (dark), got ${JSON.stringify(value)}`);
      }
      continue;
    }

    if (!EMBED_THEME_TOKENS[key]) {
      errors.push(
        `${at}: unknown key — expected one of ${Object.keys(EMBED_THEME_TOKENS).join(", ")}`,
      );
    } else if (typeof value !== "string") {
      errors.push(`${at}: values must be strings, got ${typeof value}`);
    } else if (value.length > EMBED_MAX_VALUE) {
      errors.push(`${at}: value is ${value.length} chars, limit is ${EMBED_MAX_VALUE}`);
    } else if (FETCHING_VALUE.test(value)) {
      errors.push(`${at}: url()/image-set()/element() values are rejected at runtime`);
    }
  }

  return errors;
}

/** Human-readable account of what a payload will do, for the `--decode` path. */
function describe(theme) {
  const lines = [];
  const list = (source, label) => {
    for (const [key, value] of Object.entries(source ?? {})) {
      if (key === "d" || key === "m") continue;
      lines.push(
        `  ${(EMBED_THEME_TOKENS[key] ?? `${key} (unknown)`).padEnd(22)} ${value}${label}`,
      );
    }
  };
  list(theme, "");
  list(theme.d, "   [dark]");
  if (theme.m) lines.push(`  color mode             pinned to ${MODES[theme.m] ?? theme.m}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  if (i === -1) return undefined;
  return argv.splice(i, 2)[1] ?? "";
};
const has = (name) => {
  const i = argv.indexOf(name);
  if (i === -1) return false;
  argv.splice(i, 1);
  return true;
};

const help = has("--help") || has("-h");
const decodeMode = has("--decode");
const base = flag("--url");
const input = argv[0];

if (help) {
  console.log(
    [
      "Build an embed-theme URL fragment for an undocs site.",
      "",
      "  node scripts/embed-theme-url.mjs '<json>'            payload as an argument",
      "  node scripts/embed-theme-url.mjs theme.json          payload from a file",
      "  cat theme.json | node scripts/embed-theme-url.mjs    payload on stdin",
      "",
      "  --url <base>   print a full URL instead of the bare fragment",
      "  --decode <#~…> read a fragment back and explain what it sets",
      "",
      `Keys: ${Object.entries(EMBED_THEME_TOKENS)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")}`,
      '      d={…} dark-mode overrides, m="l"|"d" pins the color mode',
    ].join("\n"),
  );
  process.exit(0);
}

/** The payload text: an argument, a file, or stdin. */
async function readInput() {
  if (input) {
    const trimmed = input.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("#") || decodeMode) return trimmed;
    return (await readFile(input, "utf8")).trim();
  }
  if (process.stdin.isTTY) {
    console.error("No payload given. Try --help.");
    process.exit(1);
  }
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  return text.trim();
}

const raw = await readInput();

if (decodeMode) {
  const payload = raw.slice(raw.indexOf(EMBED_HASH_SEPARATOR) + 1);
  let theme;
  try {
    theme = decode(payload);
  } catch {
    console.error("Not a valid base64url JSON payload.");
    process.exit(1);
  }
  console.log(JSON.stringify(theme, null, 2));
  const described = describe(theme);
  if (described) console.log(`\nSets:\n${described}`);
  const errors = validate(theme);
  if (errors.length) {
    console.error(`\nIgnored at runtime:\n${errors.map((e) => `  ${e}`).join("\n")}`);
    process.exit(1);
  }
  process.exit(0);
}

let theme;
try {
  theme = JSON.parse(raw);
} catch (error) {
  console.error(`Input is not valid JSON: ${error.message}`);
  process.exit(1);
}

const errors = validate(theme);
if (errors.length) {
  console.error(`Refusing to emit a fragment that would be partly ignored:`);
  for (const error of errors) console.error(`  ${error}`);
  process.exit(1);
}

const encoded = encode(theme);
if (encoded.length > EMBED_MAX_PAYLOAD) {
  console.error(`Payload is ${encoded.length} chars, limit is ${EMBED_MAX_PAYLOAD}.`);
  process.exit(1);
}

const fragment = `#${EMBED_HASH_SEPARATOR}${encoded}`;
console.log(base ? `${base}${fragment}` : fragment);
