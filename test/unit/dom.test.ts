import { describe, expect, it } from 'vitest';

import {
  getNamespaceURIByTagName,
  HTML_NAMESPACE_URI,
  MATH_NAMESPACE_URI,
  SVG_NAMESPACE_URI,
} from '@/dom.js';

describe('getNamespaceURIByTagName()', () => {
  it('returns the namespace URI from the tag name', () => {
    expect(getNamespaceURIByTagName('HTML')).toBe(HTML_NAMESPACE_URI);
    expect(getNamespaceURIByTagName('MATH')).toBe(MATH_NAMESPACE_URI);
    expect(getNamespaceURIByTagName('SVG')).toBe(SVG_NAMESPACE_URI);
    expect(getNamespaceURIByTagName('html')).toBe(HTML_NAMESPACE_URI);
    expect(getNamespaceURIByTagName('math')).toBe(MATH_NAMESPACE_URI);
    expect(getNamespaceURIByTagName('svg')).toBe(SVG_NAMESPACE_URI);
    expect(getNamespaceURIByTagName('div')).toBe(null);
  });
});
