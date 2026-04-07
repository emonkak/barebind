import { describe, expect, it } from 'vitest';
import { annotateNode, annotatePlace, generateNodeFrame } from '@/dom/debug.js';
import {
  AttributeType,
  ChildNodeType,
  ElementType,
  EventType,
  LiveType,
  PropertyType,
  TextType,
} from '@/dom/part.js';
import { createElement } from '../../dom-helpers.js';

describe('generateNodeFrame()', () => {
  it('generates node frames for comment nodes', () => {
    const node = document.createComment('A');
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '<!--${...}-->',
      '^^^^^^^^^^^^^',
    ];
    expect(
      generateNodeFrame(node, annotatePlace({ type: ChildNodeType, node })),
    ).toBe(expectedLines.join('\n'));
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
      '    A',
      '  </div>',
      '  <div>',
      '    B',
      '    <!--${...}-->',
      '    ^^^^^^^^^^^^^',
      '    <div></div>',
      '  </div>',
      '</div>',
    ]
    expect(
      generateNodeFrame(node, annotatePlace({ type: ChildNodeType, node })),
    ).toBe(expectedLines.join('\n'));
  });

  it('generates node frames for element attributes', () => {
    const node = createElement('div', { id: 'a' });
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '<div id="a" class=${...}>',
      '            ^^^^^^^^^^^^',
      '</div>'
    ];
    expect(
      generateNodeFrame(
        node,
        annotatePlace({ type: AttributeType, name: 'class', node }),
      ),
    ).toBe(expectedLines.join('\n'));
  });

  it('generates node frames for element events', () => {
    const node = createElement('div', { id: 'a' });
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '<div id="a" @click=${...}>',
      '            ^^^^^^^^^^^^^',
      '</div>'
    ];
    expect(
      generateNodeFrame(
        node,
        annotatePlace({ type: EventType, name: 'click', node }),
      ),
    ).toBe(expectedLines.join('\n'));
  });

  it('generates node frames for element lives', () => {
    const node = createElement('div');
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '<div $innerHTML=${...}>',
      '     ^^^^^^^^^^^^^^^^^',
      '</div>'
    ];
    expect(
      generateNodeFrame(
        node,
        annotatePlace({ type: LiveType, name: 'innerHTML', node }),
      ),
    ).toBe(expectedLines.join('\n'));
  });

  it('generates node frames for element properties', () => {
    const node = createElement('div', { id: 'a' });
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '<div id="a" .className=${...}>',
      '            ^^^^^^^^^^^^^^^^^',
      '</div>'
    ];
    expect(
      generateNodeFrame(
        node,
        annotatePlace({ type: PropertyType, name: 'className', node }),
      ),
    ).toBe(expectedLines.join('\n'));
  });

  it('generates node frames for element tagNames', () => {
    const node = createElement('div', { id: 'a' });
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '<${...} id="a">',
      ' ^^^^^^',
      '</div>',
    ];
    expect(
      generateNodeFrame(
        node,
        annotatePlace({ type: ElementType, node, unknown: true }),
      ),
    ).toBe(expectedLines.join('\n'));
  });

  it('generates node frames for element tails', () => {
    const node = createElement('div', { id: 'a' });
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '<div id="a" ${...}>',
      '            ^^^^^^',
      '</div>'
    ];
    expect(
      generateNodeFrame(node, annotatePlace({ type: ElementType, node })),
    ).toBe(expectedLines.join('\n'));
  });

  it('generates node frames for unclosed element tagNames', () => {
    const node = createElement('input');
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '<${...}>',
      ' ^^^^^^',
    ];
    expect(
      generateNodeFrame(
        node,
        annotatePlace({ type: ElementType, node, unknown: true }),
      ),
    ).toBe(expectedLines.join('\n'));
  });

  it('generates node frames for unclosed element attribute', () => {
    const node = createElement('input');
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '<input id=${...}>',
      '       ^^^^^^^^^',
    ];
    expect(
      generateNodeFrame(
        node,
        annotatePlace({ type: AttributeType, name: 'id', node }),
      ),
    ).toBe(expectedLines.join('\n'));
  });

  it('generates node frames for unclosed element tails', () => {
    const node = createElement('input');
    // biome-ignore format: keep expected lines
    const expectedLines = [
      '<input ${...}>',
      '       ^^^^^^',
    ];
    expect(
      generateNodeFrame(node, annotatePlace({ type: ElementType, node })),
    ).toBe(expectedLines.join('\n'));
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
      '  A',
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
      'B',
      '^',
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
    expect(
      generateNodeFrame(node, annotatePlace({ type: TextType, node })),
    ).toBe(expectedLines.join('\n'));
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
      '    A',
      '  </div>',
      '  <div>',
      '    B',
      '    ${...}',
      '    ^^^^^^',
      '    <div></div>',
      '  </div>',
      '</div>',
    ];
    expect(
      generateNodeFrame(node, annotatePlace({ type: TextType, node })),
    ).toBe(expectedLines.join('\n'));
  });
});
