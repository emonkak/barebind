import { describe, expect, it } from 'vitest';
import {
  annotateAttribute,
  annotateNode,
  generateNodeFrame,
} from '@/dom/debug.js';
import { createElement } from '../../dom-helpers.js';

describe('annotateAttribute()', () => {
  it('generates node frames for attributes', () => {
    const element = createElement('div', { id: 'a', class: 'b' });
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '<div id="a" class="b">',
      '            ^^^^^^^^^',
      '</div>'
    ];
    expect(
      generateNodeFrame(
        element,
        annotateAttribute(element.getAttributeNode('class')!),
      ),
    ).toBe(expectedLines.join('\n'));
  });

  it('generates node frames for attributes in self-closing elements', () => {
    const element = createElement('input', { id: 'a', class: 'b' });
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '<input id="a" class="b">',
      '       ^^^^^^',
    ];
    expect(
      generateNodeFrame(
        element,
        annotateAttribute(element.getAttributeNode('id')!),
      ),
    ).toBe(expectedLines.join('\n'));
  });
});

describe('annotateNode()', () => {
  it('generates node frames for elements', () => {
    const node = createElement(
      'div',
      {},
      createElement('input'),
      document.createTextNode('A'),
      document.createComment('B'),
    );
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '<div>',
      '^^^^^',
      '  <input>',
      '  "A"',
      '  <!--B-->',
      '</div>',
    ];
    expect(generateNodeFrame(node, annotateNode(node))).toBe(
      expectedLines.join('\n'),
    );
  });

  it('generates node frames for self-closing elements', () => {
    const node = createElement('input');
    createElement(
      'div',
      {},
      node,
      document.createTextNode('A'),
      document.createComment('B'),
    );
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '<div>',
      '  <input>',
      '  ^^^^^^^',
      '  "A"',
      '  <!--B-->',
      '</div>',
    ];
    expect(generateNodeFrame(node, annotateNode(node))).toBe(
      expectedLines.join('\n'),
    );
  });

  it('generates node frames for comment nodes', () => {
    const node = document.createComment('A');
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '<!--A-->',
      '^^^^^^^^',
    ];
    expect(generateNodeFrame(node, annotateNode(node))).toBe(
      expectedLines.join('\n'),
    );
  });

  it('generates node frames for comment nodes in trees', () => {
    const node = document.createComment('C');
    createElement(
      'div',
      {},
      createElement('div', {}, 'A'),
      createElement('div', {}, 'B', node, createElement('div')),
    );
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '<div>',
      '  <div>',
      '    "A"',
      '  </div>',
      '  <div>',
      '    "B"',
      '    <!--C-->',
      '    ^^^^^^^^',
      '    <div></div>',
      '  </div>',
      '</div>',
    ]
    expect(generateNodeFrame(node, annotateNode(node))).toBe(
      expectedLines.join('\n'),
    );
  });

  it('generates node frames for text nodes', () => {
    const node = document.createTextNode('A');
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '"A"',
      '^^^',
    ];
    expect(generateNodeFrame(node, annotateNode(node))).toBe(
      expectedLines.join('\n'),
    );
  });

  it('generates node frames for text nodes in trees', () => {
    const node = document.createTextNode('C');
    createElement(
      'div',
      {},
      createElement('div', {}, 'A'),
      createElement('div', {}, 'B', node, createElement('div')),
    );
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '<div>',
      '  <div>',
      '    "A"',
      '  </div>',
      '  <div>',
      '    "B"',
      '    "C"',
      '    ^^^',
      '    <div></div>',
      '  </div>',
      '</div>',
    ];
    expect(generateNodeFrame(node, annotateNode(node))).toBe(
      expectedLines.join('\n'),
    );
  });

  it('generates node frames for nodes in fragments', () => {
    const node = document.createDocumentFragment();
    node.append(
      createElement('input'),
      document.createTextNode('B'),
      document.createComment('C'),
    );
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '<#document-fragment>',
      '^^^^^^^^^^^^^^^^^^^^',
      '  <input>',
      '  "B"',
      '  <!--C-->',
      '</#document-fragment>',
    ];
    expect(generateNodeFrame(node, annotateNode(node))).toBe(
      expectedLines.join('\n'),
    );
  });
});
