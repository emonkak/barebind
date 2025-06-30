import { describe, expect, it } from 'vitest';
import { getChildNodes, getStartNode, PartType } from '@/part.js';
import { createElement } from '../testUtils.js';

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
    } as const;

    expect(getStartNode(part)).toBe(part.childNode);
  });
});

describe('getChildNodes()', () => {
  it('returns the part node as the only child node', () => {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      childNode: null,
    } as const;

    expect(getChildNodes(part)).toStrictEqual([expect.exact(part.node)]);
  });

  it('returns child nodes from the child node to the part node if the part has a child node', () => {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      childNode: document.createElement('div'),
    } as const;
    const container = createElement(
      'div',
      {},
      part.childNode,
      'foo',
      part.node,
    );

    expect(getChildNodes(part)).toStrictEqual(
      Array.from(container.childNodes, (node) => expect.exact(node)),
    );
  });
});
