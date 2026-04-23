import { describe, expect, it } from 'vitest';
import {
  annotateAttributeHole,
  annotateNode,
  annotateNodeHole,
  generateNodeFrame,
} from '@/dom/debug.js';
import { createElement } from '../../dom-helpers.js';

describe('annotateAttributeHole()', () => {
  it('generates node frames for attribute holes', () => {
    const node = createElement('div', { id: 'a' });
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '<div id="a" class=${...}>',
      '            ^^^^^^^^^^^^',
      '</div>'
    ];
    expect(generateNodeFrame(node, annotateAttributeHole(node, 'class'))).toBe(
      expectedLines.join('\n'),
    );
  });

  it('generates node frames for attribute holes in an unclosed element', () => {
    const node = createElement('input');
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '<input id=${...}>',
      '       ^^^^^^^^^',
    ];
    expect(generateNodeFrame(node, annotateAttributeHole(node, 'id'))).toBe(
      expectedLines.join('\n'),
    );
  });
});

describe('annotateNode()', () => {
  it('generates node frames for elements themselves', () => {
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

  it('generates node frames for comment nodes themselves', () => {
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

  it('generates node frames for text nodes themselves', () => {
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

describe('annotateNodeHole()', () => {
  it('generates node frames for element holes', () => {
    const node = createElement('div', { id: 'a' });
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '<${...} id="a">',
      '^^^^^^^^^^^^^^^',
      '</div>',
    ];
    expect(generateNodeFrame(node, annotateNodeHole(node))).toBe(
      expectedLines.join('\n'),
    );
  });

  it('generates node frames for unclosed element holes', () => {
    const node = createElement('input');
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '<${...}>',
      '^^^^^^^^',
    ];
    expect(generateNodeFrame(node, annotateNodeHole(node))).toBe(
      expectedLines.join('\n'),
    );
  });

  it('generates node frames for comment holes', () => {
    const node = document.createComment('A');
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '<!--${...}-->',
      '^^^^^^^^^^^^^',
    ];
    expect(generateNodeFrame(node, annotateNodeHole(node))).toBe(
      expectedLines.join('\n'),
    );
  });

  it('generates node frames for comment nodes in a tree', () => {
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
      '    <!--${...}-->',
      '    ^^^^^^^^^^^^^',
      '    <div></div>',
      '  </div>',
      '</div>',
    ]
    expect(generateNodeFrame(node, annotateNodeHole(node))).toBe(
      expectedLines.join('\n'),
    );
  });

  it('generates node frames for text holes', () => {
    const node = document.createTextNode('A');
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '"${...}"',
      '^^^^^^^^',
    ]
    expect(generateNodeFrame(node, annotateNodeHole(node))).toBe(
      expectedLines.join('\n'),
    );
  });

  it('generates node frames for text holes in a tree', () => {
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
      '    "${...}"',
      '    ^^^^^^^^',
      '    <div></div>',
      '  </div>',
      '</div>',
    ];
    expect(generateNodeFrame(node, annotateNodeHole(node))).toBe(
      expectedLines.join('\n'),
    );
  });

  it('generates no node frames for holes in a fragment', () => {
    const node = document.createDocumentFragment();
    node.append(
      createElement('input'),
      document.createTextNode('B'),
      document.createComment('C'),
    );
    expect(generateNodeFrame(node, annotateNodeHole(node))).toBe('');
  });
});
