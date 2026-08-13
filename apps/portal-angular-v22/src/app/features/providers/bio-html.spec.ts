import { toBioHtml } from './bio-html';

describe('toBioHtml', () => {
  it('keeps the formatting an onboarding-tool bio is meant to carry', () => {
    expect(toBioHtml('<strong>Dr. Bell</strong> treats <em>skin</em>.<br>Riverside.')).toBe(
      '<strong>Dr. Bell</strong> treats <em>skin</em>.<br>Riverside.',
    );
  });

  it('returns an empty string for a missing bio', () => {
    expect(toBioHtml(undefined)).toBe('');
    expect(toBioHtml('')).toBe('');
  });

  // CVE-2024-8372: srcset is not URL-checked by AngularJS's sanitizer, and Angular's own
  // sanitizer keeps it too, so an image source restriction is bypassable through a bio.
  it('drops images, including a srcset that no sanitizer URL-checks', () => {
    const html = toBioHtml(
      'Board-certified. <img src="https://attacker.example/pixel.png" ' +
        'srcset="https://attacker.example/2x.png 2x"> Riverside.',
    );

    expect(html).toBe('Board-certified.  Riverside.');
    expect(html).not.toContain('attacker.example');
  });

  // CVE-2024-8373: the same bypass through <source srcset> inside a <picture>.
  it('drops a picture/source srcset payload', () => {
    const html = toBioHtml(
      '<picture><source srcset="https://attacker.example/spoof.png"><img src="x"></picture>Bio.',
    );

    expect(html).toBe('Bio.');
    expect(html).not.toContain('srcset');
  });

  it('drops scripts, handlers and every other attribute', () => {
    const html = toBioHtml(
      '<script>window.__pwned = true</script><p class="x" onclick="steal()" ' +
        'style="position:fixed">Text</p>',
    );

    expect(html).toBe('<p>Text</p>');
  });

  it('unwraps unexpected elements instead of losing their words', () => {
    expect(toBioHtml('<div>Outer <a href="https://attacker.example">link text</a></div>')).toBe(
      'Outer link text',
    );
  });

  it('escapes text that only looks like markup', () => {
    expect(toBioHtml('Treats <3 conditions & more')).toBe('Treats &lt;3 conditions &amp; more');
  });
});
