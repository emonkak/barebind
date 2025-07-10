import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  getChildNodes,
  getStartNode,
  moveChildNodes,
  PartType,
} from '@/part.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { createElement } from '../test-utils.js';

describe('getStartNode()', () => {
  it.each([
    [
      {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'class',
      },
    ],
    [
      {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      },
    ],
    [
      {
        type: PartType.Text,
        node: document.createTextNode(''),
        precedingText: '',
        followingText: '',
      },
    ],
    [
      {
        type: PartType.Element,
        node: document.createElement('div'),
      },
    ],
    [
      {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'click',
      },
    ],
    [
      {
        type: PartType.Live,
        node: document.createElement('textarea'),
        name: 'value',
        defaultValue: '',
      },
    ],
    [
      {
        type: PartType.Property,
        node: document.createElement('textarea'),
        name: 'value',
        defaultValue: '',
      },
    ],
  ])('returns the node of the part', (part) => {
    expect(getStartNode(part)).toBe(part.node);
  });

  it('returns the child node if the part has a child node', () => {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      childNode: document.createElement('div'),
      namespaceURI: HTML_NAMESPACE_URI,
    };

    expect(getStartNode(part)).toBe(part.childNode);
  });
});

describe('getChildNodes()', () => {
  it('returns a single node when the start node and end node are the same', () => {
    const node = document.createComment('');

    expect(getChildNodes(node, node)).toStrictEqual([expect.exact(node)]);
  });

  it('returns children from the start node to the end node', () => {
    const container = createElement(
      'div',
      {},
      document.createElement('div'),
      'foo',
      document.createComment(''),
    );

    expect(
      getChildNodes(container.firstChild!, container.lastChild!),
    ).toStrictEqual(
      Array.from(container.childNodes, (node) => expect.exact(node)),
    );
  });
});

describe.each([[true], [false]])('moveChildNodes()', (useMoveBefore) => {
  const originalMoveBefore = Element.prototype.moveBefore;

  beforeEach(() => {
    if (useMoveBefore) {
      Element.prototype.moveBefore ??= Element.prototype.insertBefore;
    } else {
      Element.prototype.moveBefore = undefined as any;
    }
  });

  afterEach(() => {
    Element.prototype.moveBefore = originalMoveBefore;
  });

  it('moves child nodes to before reference node', () => {
    const foo = createElement('div', {}, 'foo');
    const bar = createElement('div', {}, 'bar');
    const baz = createElement('div', {}, 'baz');
    const qux = createElement('div', {}, 'qux');
    const container = createElement('div', {}, foo, bar, baz, qux);

    moveChildNodes([foo], qux);

    expect(container.innerHTML).toBe(
      '<div>bar</div><div>baz</div><div>foo</div><div>qux</div>',
    );

    moveChildNodes([foo, qux], bar);

    expect(container.innerHTML).toBe(
      '<div>foo</div><div>qux</div><div>bar</div><div>baz</div>',
    );
  });
});
