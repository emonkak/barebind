import { describe, expect, it } from 'vitest';
import { getPartChild, PartType } from '../src/part.js';

describe('getPartChild()', () => {
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
  ])('returns a part node', (part) => {
    expect(getPartChild(part)).toBe(part.node);
  });

  it('returns a child node if the part is ChildNodePart having a child node', () => {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      childNode: document.createElement('div'),
    } as const;

    expect(getPartChild(part)).toBe(part.childNode);
  });
});
