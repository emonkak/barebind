import { describe, expect, it } from 'vitest';
import { HydrationTree, PartType } from '@/core.js';
import { Runtime } from '@/runtime.js';
import { EmptyTemplate } from '@/template/empty.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { MockBackend, MockTemplate } from '../../mocks.js';

describe('EmptyTemplate', () => {
  describe('arity', () => {
    it('is the number of binds', () => {
      const template = new EmptyTemplate();

      expect(template.arity).toBe(0);
    });
  });

  describe('equals()', () => {
    it('returns true if the value is instance of EmptyTemplate', () => {
      const template = new EmptyTemplate();

      expect(template.equals(template)).toBe(true);
      expect(template.equals(new MockTemplate())).toBe(false);
    });
  });

  describe('hydrate()', () => {
    it('hydrates an empty tree', () => {
      const binds = [] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const tree = new HydrationTree(document.createElement('div'));
      const runtime = Runtime.create(new MockBackend());
      const template = new EmptyTemplate();
      const { childNodes, slots } = template.hydrate(
        binds,
        part,
        tree,
        runtime,
      );

      expect(childNodes).toStrictEqual([]);
      expect(slots).toStrictEqual([]);
    });
  });

  describe('render()', () => {
    it('renders an empty tree', () => {
      const binds = [] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const runtime = Runtime.create(new MockBackend());
      const template = new EmptyTemplate();
      const { childNodes, slots } = template.render(binds, part, runtime);

      expect(childNodes).toStrictEqual([]);
      expect(slots).toStrictEqual([]);
    });
  });
});
