import { describe, expect, it } from 'vitest';
import {
  createHydrationTree,
  treatNodeName,
  treatNodeType,
} from '@/hydration.js';

describe('treatNodeType()', () => {
  it.each([
    [Node.COMMENT_NODE, document.createComment('')],
    [Node.ELEMENT_NODE, document.createElement('div')],
    [Node.TEXT_NODE, document.createTextNode('')],
  ] as const)(
    'asserts that the node is the expected type',
    (expectedType, node) => {
      const tree = createHydrationTree(document.createElement('div'));
      expect(treatNodeType(expectedType, node, tree)).toBe(node);
    },
  );

  it.each([
    [Node.COMMENT_NODE, document.createElement('div')],
    [Node.COMMENT_NODE, document.createTextNode('')],
    [Node.ELEMENT_NODE, document.createComment('')],
    [Node.ELEMENT_NODE, document.createTextNode('')],
    [Node.TEXT_NODE, document.createComment('')],
    [Node.TEXT_NODE, document.createElement('div')],
  ] as const)(
    'throws an error if the node is not the expected type',
    (expectedType, node) => {
      const tree = createHydrationTree(document.createElement('div'));
      expect(() => {
        treatNodeType(expectedType, node, tree);
      }).toThrow('Hydration is failed because the node type is mismatched.');
    },
  );
});

describe('treatNodeName()', () => {
  it.each([
    ['#comment', document.createComment('')],
    ['#text', document.createTextNode('')],
    ['DIV', document.createElement('div')],
  ] as const)(
    'asserts that the node is the expected name',
    (expectedName, node) => {
      const tree = createHydrationTree(document.createElement('div'));
      expect(treatNodeName(expectedName, node, tree)).toBe(node);
    },
  );

  it.each([
    ['#comment', document.createElement('div')],
    ['#comment', document.createTextNode('')],
    ['#text', document.createComment('')],
    ['#text', document.createElement('div')],
    ['DIV', document.createComment('')],
    ['DIV', document.createTextNode('')],
  ] as const)(
    'throws an error if the node is not the expected name',
    (expectedName, node) => {
      const tree = createHydrationTree(document.createElement('div'));
      expect(() => {
        treatNodeName(expectedName, node, tree);
      }).toThrow('Hydration is failed because the node type is mismatched.');
    },
  );
});
