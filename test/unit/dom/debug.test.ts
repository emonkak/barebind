import { describe, expect, it } from 'vitest';
import {
  annotateAttribute,
  annotateNode,
  generateNodeFrame,
} from '@/dom/debug.js';
import { createElement } from '../../dom-helpers.js';

describe('generateNodeFrame()', () => {
  it('generates node frames for comment nodes', () => {
    const node = document.createComment('A');
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '<!--${...}-->',
      '^^^^^^^^^^^^^',
    ];
    expect(generateNodeFrame(node, annotateNode(node))).toBe(
      expectedLines.join('\n'),
    );
  });

  it('generates node frames for comments nodes in a tree', () => {
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
    expect(generateNodeFrame(node, annotateNode(node))).toBe(
      expectedLines.join('\n'),
    );
  });

  it('generates node frames for element attributes', () => {
    const node = createElement('div', { id: 'a' });
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '<div id="a" class=${...}>',
      '            ^^^^^^^^^^^^',
      '</div>'
    ];
    expect(generateNodeFrame(node, annotateAttribute(node, 'class'))).toBe(
      expectedLines.join('\n'),
    );
  });

  it('generates node frames for element tagNames', () => {
    const node = createElement('unknown', { id: 'a' });
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '<${...} id="a">',
      ' ^^^^^^',
      '</div>',
    ];
    expect(generateNodeFrame(node, annotateNode(node))).toBe(
      expectedLines.join('\n'),
    );
  });

  it('generates node frames for unclosed element tagNames', () => {
    const node = createElement('unknown');
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '<${...}>',
      ' ^^^^^^',
    ];
    expect(generateNodeFrame(node, annotateNode(node))).toBe(
      expectedLines.join('\n'),
    );
  });

  it('generates node frames for unclosed element attribute', () => {
    const node = createElement('input');
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '<input id=${...}>',
      '       ^^^^^^^^^',
    ];
    expect(generateNodeFrame(node, annotateAttribute(node, 'id'))).toBe(
      expectedLines.join('\n'),
    );
  });

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
      ' ^^^',
      '  <input>',
      '  "A"',
      '  <!--B-->',
      '</div>',
    ];
    expect(generateNodeFrame(node, annotateNode(node))).toBe(
      expectedLines.join('\n'),
    );
  });

  it('generates node frames for fragments themselves', () => {
    const node = document.createDocumentFragment();
    node.append(
      createElement('input'),
      document.createTextNode('B'),
      document.createComment('C'),
    );
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '<input>',
      '^^^^^^^',
      '"B"',
      '^^^',
      '<!--C-->',
      '^^^^^^^^',
    ];
    expect(generateNodeFrame(node, annotateNode(node))).toBe(
      expectedLines.join('\n'),
    );
  });

  it('generates node frames for text nodes', () => {
    const node = document.createTextNode('A');
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '${...}',
      '^^^^^^',
    ]
    expect(generateNodeFrame(node, annotateNode(node))).toBe(
      expectedLines.join('\n'),
    );
  });

  it('generates node frames for text nodes in a tree', () => {
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
});
