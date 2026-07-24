#!/usr/bin/env node
// Flag long line-comment blocks: runs of more than 3 consecutive `//` lines.
//
// Scans every .ts/.tsx/.mts file under src/** plus the top-level *.ts files.
// A "block" is consecutive lines whose first non-whitespace is `//` (blank
// lines break a run). Blocks longer than the threshold are reported as
// `path:startLine-endLine  (N lines)` — location only, not the comment text.
//
// Usage:
//   node scripts/long-comments.mjs           # default threshold: >3 lines
//   node scripts/long-comments.mjs 5         # custom threshold (>5 lines)

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const SRC = join(ROOT, "src");
const EXTS = [".ts", ".tsx", ".mts"];
const THRESHOLD = Number(process.argv[2]) || 3;

// --- collect source files ------------------------------------------------
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (name === "node_modules") continue;
      walk(p, out);
    } else if (EXTS.includes(extname(p))) {
      out.push(p);
    }
  }
  return out;
}

// src/** (recursive) + top-level *.ts files only (non-recursive).
const topLevel = readdirSync(ROOT)
  .map((n) => join(ROOT, n))
  .filter((p) => statSync(p).isFile() && EXTS.includes(extname(p)));
const files = [...walk(SRC), ...topLevel];

// --- find runs of consecutive `//` lines ---------------------------------
const isLineComment = (l) => /^\s*\/\//.test(l);

const findings = [];
for (const f of files) {
  const lines = readFileSync(f, "utf8").split("\n");
  let start = -1;
  const flush = (end) => {
    if (start === -1) return;
    const len = end - start;
    if (len > THRESHOLD) findings.push({ file: f, start: start + 1, end, len });
    start = -1;
  };
  for (let i = 0; i < lines.length; i++) {
    if (isLineComment(lines[i])) {
      if (start === -1) start = i;
    } else {
      flush(i);
    }
  }
  flush(lines.length);
}

// --- output --------------------------------------------------------------
const rel = (p) => relative(ROOT, p);
findings.sort((a, b) => b.len - a.len);

const line = "─".repeat(60);
console.log(`\n${line}\nLONG COMMENT BLOCKS — runs of > ${THRESHOLD} consecutive \`//\` lines`);
console.log(`${findings.length} block(s) across ${files.length} files\n${line}`);

for (const { file, start, end, len } of findings) {
  console.log(`   ${String(len).padStart(3)}  ${rel(file)}:${start}-${end}`);
}
console.log();
