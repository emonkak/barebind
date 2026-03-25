import { describe, expect, it } from 'vitest';

import {
  createTreeWalker,
  getNamespaceURIByTagName,
  HTML_NAMESPACE_URI,
  MATH_NAMESPACE_URI,
  nextNode,
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

describe('nextNode()', () => {
  it.each([
    ['#comment', document.createComment('')],
    ['#text', document.createTextNode('')],
    ['DIV', document.createElement('div')],
  ] as const)('asserts that the next node has the expected name', (expectedName, node) => {
    const container = document.createElement('div');
    const treeWalker = createTreeWalker(container);
    container.appendChild(node);
    expect(nextNode(expectedName, treeWalker)).toBe(node);
  });

  it.each([
    ['#comment', document.createElement('div')],
    ['#comment', document.createTextNode('')],
    ['#text', document.createComment('')],
    ['#text', document.createElement('div')],
    ['DIV', document.createComment('')],
    ['DIV', document.createTextNode('')],
  ] as const)('throws errors when the node is does not have the expected name', (expectedName, node) => {
    const container = document.createElement('div');
    const treeWalker = createTreeWalker(container);
    container.appendChild(node);
    expect(() => {
      nextNode(expectedName, treeWalker);
    }).toThrow('Hydration is failed because the node name is mismatched.');
  });
});
