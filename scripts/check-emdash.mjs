// Enforces the hard rule from the build spec: never use em-dashes, anywhere,
// in code or copy. Scans tracked source files and fails if it finds one.
// Run with: npm run check:emdash
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'dev-dist', '.vercel', 'coverage']);
const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.html', '.json', '.md', '.svg']);

// U+2014 EM DASH and U+2015 HORIZONTAL BAR (sometimes used as a long dash).
const EM_DASH = /[—―]/;

/** @param {string} dir @param {string[]} out */
function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (SKIP_DIRS.has(name)) continue;
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXTS.has(extname(name))) out.push(full);
  }
}

const files = [];
walk(ROOT, files);

let hits = 0;
for (const file of files) {
  // This script file itself documents the rule, so skip it.
  if (file.endsWith('check-emdash.mjs')) continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (EM_DASH.test(line)) {
      hits += 1;
      console.error(`em-dash found: ${file.replace(ROOT + '/', '')}:${i + 1}`);
      console.error(`  ${line.trim()}`);
    }
  });
}

if (hits > 0) {
  console.error(`\nFound ${hits} em-dash(es). Replace with commas, periods, colons, or parentheses.`);
  process.exit(1);
}
console.log('No em-dashes found.');
