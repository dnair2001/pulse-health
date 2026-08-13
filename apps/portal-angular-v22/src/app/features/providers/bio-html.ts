/**
 * The formatting a provider bio is allowed to carry. Care coordinators write bios in an
 * internal onboarding tool that offers bold/italic/line breaks and lists -- nothing else.
 */
const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'P', 'SPAN', 'UL', 'OL', 'LI']);

/**
 * Elements dropped together with their text. Everything else that is not allowed is
 * unwrapped instead, so a bio wrapped in an unexpected `<div>` still shows its words.
 */
const DROPPED_WITH_CONTENT = new Set([
  'SCRIPT',
  'STYLE',
  'TEMPLATE',
  'IFRAME',
  'FRAME',
  'OBJECT',
  'EMBED',
  'APPLET',
  'SVG',
  'MATH',
  'IMG',
  'PICTURE',
  'SOURCE',
  'VIDEO',
  'AUDIO',
  'TRACK',
  'CANVAS',
  'FORM',
  'INPUT',
  'BUTTON',
  'SELECT',
  'TEXTAREA',
]);

function copyAllowedNodes(source: Node, target: Node, doc: Document): void {
  for (const node of Array.from(source.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      target.appendChild(doc.createTextNode(node.nodeValue ?? ''));
      continue;
    }

    // Comments and processing instructions carry no visible text worth keeping.
    if (node.nodeType !== Node.ELEMENT_NODE) {
      continue;
    }

    const element = node as Element;
    const tagName = element.tagName.toUpperCase();

    if (DROPPED_WITH_CONTENT.has(tagName)) {
      continue;
    }

    if (!ALLOWED_TAGS.has(tagName)) {
      copyAllowedNodes(element, target, doc);
      continue;
    }

    // Rebuilt rather than cloned, which is what drops every attribute: a bio needs none, and
    // an attribute that survives is an attribute that has to be argued about.
    const clean = doc.createElement(tagName.toLowerCase());
    copyAllowedNodes(element, clean, doc);
    target.appendChild(clean);
  }
}

/**
 * Narrows a provider bio to plain text plus the inline formatting above.
 *
 * The bio is care-coordinator-authored HTML from a tool this app does not control, and it is
 * rendered with `[innerHTML]`, which runs Angular's sanitizer. That sanitizer strips scripts
 * and event handlers, but it keeps `img`/`picture`/`source` and passes `srcset` through
 * without any URL check, so a bio can still pull an arbitrary external image into a patient's
 * page -- request-time tracking and content spoofing, the same gap CVE-2024-8372 and
 * CVE-2024-8373 describe in AngularJS's sanitizer. Bios have no reason to contain media, so
 * this removes the whole class before the sanitizer ever sees the value.
 *
 * This only ever removes markup. The result is still bound through `[innerHTML]` and
 * sanitized again, and must never be handed to `DomSanitizer.bypassSecurityTrust*`: this is a
 * second, narrower gate in front of the sanitizer, not a replacement for it.
 */
export function toBioHtml(raw: string | null | undefined): string {
  if (!raw) {
    return '';
  }

  // DOMParser builds an inert document: nothing is fetched and no handler runs while the
  // markup is inspected here.
  const parsed = new DOMParser().parseFromString(raw, 'text/html');
  const clean = parsed.createElement('div');
  copyAllowedNodes(parsed.body, clean, parsed);

  return clean.innerHTML;
}
