/**
 * Text handling for the cross-implementation comparison.
 *
 * AGENTS.md invariant 3 requires the two frontends to render identical user-visible text,
 * including punctuation and date formats. So the only normalisation here is whitespace: runs of
 * spaces/tabs/non-breaking spaces collapse to one space and blank lines are dropped, because
 * those are artefacts of template indentation rather than anything a patient sees. Casing,
 * punctuation (the en dash in time ranges especially) and date formatting are left alone —
 * differences there are exactly the defects this comparison exists to surface.
 */
export function normaliseText(raw: string): string {
  return raw
    .split('\n')
    .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

/** Escapes non-ASCII so an en dash vs. hyphen or an nbsp vs. space is visible in the report. */
function reveal(line: string | undefined): string {
  if (line === undefined) {
    return '<missing line>';
  }
  return JSON.stringify(line).replace(/[^\x20-\x7e]/g, (character) => {
    const code = character.codePointAt(0) ?? 0;
    return `\\u${code.toString(16).padStart(4, '0')}`;
  });
}

/** A readable line-by-line diff, so a failure says what differs rather than "expected true". */
export function describeTextDiff(angular: string, react: string): string {
  const left = angular.split('\n');
  const right = react.split('\n');
  const lines: string[] = [];

  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if (left[index] === right[index]) {
      continue;
    }
    lines.push(`  line ${index + 1}`);
    lines.push(`    angular: ${reveal(left[index])}`);
    lines.push(`    react:   ${reveal(right[index])}`);
  }

  if (lines.length === 0) {
    return '  (no line-level differences)';
  }
  return lines.join('\n');
}
