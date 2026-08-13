#!/usr/bin/env node
// Keeps the "170 pytest + 12 Karma + 22 Vitest = 204" claim in AGENTS.md, README.md,
// CONTRIBUTING.md and .github/pull_request_template.md honest, the same way
// apps/mock-api/scripts/generate_openapi.py + the CI diff check keep openapi.json honest:
// this recomputes the live numbers and fails loudly, with a clear diff, the moment any of
// the four documents disagrees with reality. It never edits the docs itself — that decision
// is left to whoever is reconciling counts across concurrent branches.
//
// Usage: node scripts/check-test-count-freshness.mjs
// Exit code 0 means every documented count matches the live suites; non-zero means at least
// one file is stale (see the printed diff for which file/number).

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Some test runners color their summary lines with ANSI escapes even when stdout is piped,
// which can land between a label and its count and break a plain `\s+` regex.
function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

function run(command, args, options) {
  const output = execFileSync(command, args, {
    encoding: 'utf8',
    cwd: ROOT,
    // Each live suite can fail on its own terms (coverage gates, flaky specs, etc.); this
    // script only cares about the count it can scrape from stdout, so a non-zero exit code
    // from the test runner itself must not abort count collection.
    ...options,
  });
  return stripAnsi(output);
}

function countPytest() {
  // pyproject.toml's addopts already bakes in `-q` and `--cov`; passing another `-q`
  // doubles the quiet level and collapses per-test output into per-file summaries with no
  // `::`, and leaving `--cov` in makes pytest-cov's fail-under check fire (and exit 1) on
  // collection-only coverage. `--no-cov` disables that plugin; otherwise this relies on the
  // single `-q` already in addopts.
  let output;
  try {
    output = run('.venv/bin/pytest', ['--collect-only', '--no-cov'], {
      cwd: path.join(ROOT, 'apps/mock-api'),
    });
  } catch (err) {
    output = stripAnsi((err.stdout ?? '') + (err.stderr ?? ''));
  }
  const matches = output.match(/::/g) ?? [];
  return matches.length;
}

function countKarma() {
  let output;
  try {
    output = run('npm', ['run', 'test:ci'], {
      cwd: path.join(ROOT, 'apps/portal-angular'),
    });
  } catch (err) {
    output = stripAnsi((err.stdout ?? '') + (err.stderr ?? ''));
  }
  const match = output.match(/TOTAL:\s*(\d+)\s*SUCCESS/);
  if (!match) {
    throw new Error(
      `Could not find "TOTAL: N SUCCESS" in Karma output. Output tail:\n${output.slice(-2000)}`,
    );
  }
  return Number(match[1]);
}

function countVitest() {
  let output;
  try {
    output = run('npm', ['run', 'test:ci'], {
      cwd: path.join(ROOT, 'apps/portal-angular-v22'),
    });
  } catch (err) {
    output = stripAnsi((err.stdout ?? '') + (err.stderr ?? ''));
  }
  // "Tests  22 passed (22)" when green, "Tests  1 failed | 21 passed (22)" when not: the
  // parenthesised number is the total either way, which is what the docs quote.
  const match = output.match(/Tests\s+[^\n]*\((\d+)\)/);
  if (!match) {
    throw new Error(
      `Could not find "Tests ... (N)" in Vitest output. Output tail:\n${output.slice(-2000)}`,
    );
  }
  return Number(match[1]);
}

// Matches every documented variant seen in this repo:
//   "170 pytest + 12 Karma + 22 Vitest = 204"
//   "170 pytest + 12 Karma + 22 Vitest = **204**"   (AGENTS.md's markdown bold)
//   "170 + 12 + 22 = 204 tests"                      (README.md's terser phrasing)
const COUNT_PATTERN =
  /(\d+)\s*(?:pytest)?\s*\+\s*(\d+)\s*(?:Karma)?\s*\+\s*(\d+)\s*(?:Vitest)?\s*=\s*\*{0,2}(\d+)\*{0,2}/;

const DOC_FILES = ['AGENTS.md', 'README.md', 'CONTRIBUTING.md', '.github/pull_request_template.md'];

function extractDocumentedCounts(relativePath) {
  const text = readFileSync(path.join(ROOT, relativePath), 'utf8');
  const match = text.match(COUNT_PATTERN);
  if (!match) {
    throw new Error(
      `Could not find a "N pytest + N Karma + N Vitest = N" style count in ${relativePath}`,
    );
  }
  const [, pytest, karma, vitest, total] = match.map(Number);
  return { pytest, karma, vitest, total };
}

function main() {
  console.log('Collecting live test counts (this runs every suite once)...\n');

  const live = {
    pytest: countPytest(),
    karma: countKarma(),
    vitest: countVitest(),
  };
  live.total = live.pytest + live.karma + live.vitest;

  console.log(
    `Live: ${live.pytest} pytest + ${live.karma} Karma + ${live.vitest} Vitest = ${live.total}\n`,
  );

  const mismatches = [];

  for (const relativePath of DOC_FILES) {
    const documented = extractDocumentedCounts(relativePath);
    for (const key of ['pytest', 'karma', 'vitest', 'total']) {
      if (documented[key] !== live[key]) {
        mismatches.push({
          file: relativePath,
          field: key,
          expected: live[key],
          documented: documented[key],
        });
      }
    }
  }

  if (mismatches.length > 0) {
    console.error('Documented test counts are stale:\n');
    for (const { file, field, expected, documented } of mismatches) {
      console.error(`  ${file}: documented ${field} = ${documented}, live ${field} = ${expected}`);
    }
    console.error(
      `\nUpdate the affected file(s) to say "${live.pytest} pytest + ${live.karma} Karma + ` +
        `${live.vitest} Vitest = ${live.total}" (or the equivalent phrasing already used in ` +
        'that file) and re-run this script.',
    );
    process.exitCode = 1;
    return;
  }

  console.log('All documented test counts match the live suites.');
}

main();
