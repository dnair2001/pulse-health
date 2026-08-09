#!/usr/bin/env node
// Builds apps/mock-api's virtualenv with an interpreter that can actually install its pins.
//
// `python3 -m venv` uses whatever `python3` resolves to first on PATH, and on macOS that is
// still the system 3.9 at /usr/bin/python3. apps/mock-api/pyproject.toml requires >=3.12, so
// the previous one-liner happily created a 3.9 venv and then failed inside pip with a
// resolver error that never mentions the real problem ("Could not find a version that
// satisfies the requirement fastapi==0.141.1"). CI never hit it because setup-python pins
// 3.12 there. This picks the newest interpreter that satisfies pyproject.toml, replaces a
// venv that was built with one that doesn't, and otherwise fails with the versions it found.
//
// Usage: node scripts/setup-api.mjs   (or, preferably, `npm run setup:api`)
// Set PYTHON to force a specific interpreter: PYTHON=/opt/python3.13/bin/python3 npm run setup:api

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const API_DIR = path.join(ROOT, 'apps/mock-api');
const VENV_DIR = path.join(API_DIR, '.venv');

// The minimum comes from pyproject.toml rather than a constant here so this script cannot
// drift from the package metadata mypy and pip already enforce.
function requiredVersion() {
  const pyproject = readFileSync(path.join(API_DIR, 'pyproject.toml'), 'utf8');
  const match = pyproject.match(/^requires-python\s*=\s*"[>=~^]*\s*(\d+)\.(\d+)/m);
  if (!match) {
    throw new Error(
      'Could not read requires-python from apps/mock-api/pyproject.toml. If that pin moved, ' +
        'update the regex in scripts/setup-api.mjs to match.',
    );
  }
  return { major: Number(match[1]), minor: Number(match[2]) };
}

function satisfies(version, minimum) {
  return (
    version.major > minimum.major ||
    (version.major === minimum.major && version.minor >= minimum.minor)
  );
}

function format(version) {
  return `${version.major}.${version.minor}${version.patch === undefined ? '' : `.${version.patch}`}`;
}

// Returns null when the command does not exist or is not a working interpreter, so a PATH full
// of dangling pyenv shims degrades to "not a candidate" instead of aborting the whole script.
function probe(command) {
  let output;
  try {
    output = execFileSync(command, ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    return null;
  }
  const match = output.match(/Python\s+(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }
  return {
    command,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

// Versioned names first so the reported pick is stable when `python3` is a symlink to one of
// them, then the bare names for devs whose 3.12+ only exists as `python3` (pyenv, conda, the
// devcontainer image). The upper bound is just "far enough ahead to keep working for years".
function candidateCommands(minimum) {
  const versioned = [];
  for (let minor = minimum.minor + 12; minor >= minimum.minor; minor -= 1) {
    versioned.push(`python${minimum.major}.${minor}`);
  }
  return [...versioned, `python${minimum.major}`, 'python'];
}

function pickInterpreter(minimum) {
  const override = process.env.PYTHON;
  if (override) {
    const found = probe(override);
    if (!found) {
      throw new Error(`PYTHON=${override} is not a working Python interpreter.`);
    }
    if (!satisfies(found, minimum)) {
      throw new Error(
        `PYTHON=${override} is Python ${format(found)}, but apps/mock-api requires ` +
          `${format(minimum)}+. Point PYTHON at a newer interpreter or unset it to let this ` +
          'script search PATH.',
      );
    }
    return found;
  }

  const found = candidateCommands(minimum)
    .map(probe)
    .filter((candidate) => candidate !== null);

  const usable = found.filter((candidate) => satisfies(candidate, minimum));
  if (usable.length === 0) {
    const summary =
      found.length === 0
        ? '  (no python interpreter found on PATH at all)'
        : found.map((c) => `  ${c.command} -> Python ${format(c)}`).join('\n');
    throw new Error(
      `apps/mock-api requires Python ${format(minimum)}+ and none was found on PATH.\n\n` +
        `Interpreters found:\n${summary}\n\n` +
        `Install Python ${format(minimum)}+ (macOS: \`brew install python@${format(minimum)}\`, ` +
        `Debian/Ubuntu: \`apt-get install python${format(minimum)} python${format(minimum)}-venv\`, ` +
        'or use pyenv), or point PYTHON at an existing one:\n' +
        '  PYTHON=/path/to/python3 npm run setup:api\n\n' +
        'Alternatively build in the devcontainer, which ships the right toolchain.',
    );
  }

  // Newest wins, so a machine with both 3.12 and 3.13 tracks the version CI will eventually
  // move to rather than pinning itself to the floor.
  usable.sort((a, b) => b.major - a.major || b.minor - a.minor || b.patch - a.patch);
  return usable[0];
}

// A venv records the interpreter it was built from in pyvenv.cfg. One built below the minimum
// can't be fixed by re-running `venv` over it (that leaves the old lib/pythonX.Y tree in
// place alongside the new one), so it gets recreated from scratch.
function existingVenvNeedsReplacing(minimum) {
  if (!existsSync(VENV_DIR)) {
    return null;
  }
  if (!existsSync(path.join(VENV_DIR, 'bin/python'))) {
    return 'the existing .venv has no bin/python';
  }
  const configPath = path.join(VENV_DIR, 'pyvenv.cfg');
  if (!existsSync(configPath)) {
    return 'the existing .venv has no pyvenv.cfg';
  }
  const match = readFileSync(configPath, 'utf8').match(/^version\s*=\s*(\d+)\.(\d+)/m);
  if (!match) {
    return 'the existing .venv does not record its Python version';
  }
  const version = { major: Number(match[1]), minor: Number(match[2]) };
  if (!satisfies(version, minimum)) {
    return `the existing .venv was built with Python ${format(version)}`;
  }
  return null;
}

function run(command, args) {
  execFileSync(command, args, { cwd: API_DIR, stdio: 'inherit' });
}

function main() {
  const minimum = requiredVersion();
  const python = pickInterpreter(minimum);
  console.log(`Using ${python.command} (Python ${format(python)}) for apps/mock-api/.venv`);

  const replaceReason = existingVenvNeedsReplacing(minimum);
  const venvArgs = ['-m', 'venv', '.venv'];
  if (replaceReason) {
    console.log(`Recreating the venv: ${replaceReason}, which cannot install this project.`);
    venvArgs.push('--clear');
  }

  run(python.command, venvArgs);
  // pip's own version matters: the wheels these pins resolve to need a pip new enough to read
  // current metadata, and the pip a fresh venv bundles can be older than that.
  run('.venv/bin/pip', ['install', '--upgrade', 'pip', '--quiet']);
  run('.venv/bin/pip', ['install', '-r', 'requirements-dev.txt']);
}

try {
  main();
} catch (error) {
  // These failures are configuration problems with actionable messages, so print the message
  // rather than a stack trace pointing into this script.
  console.error(`\n${error.message}\n`);
  process.exitCode = 1;
}
