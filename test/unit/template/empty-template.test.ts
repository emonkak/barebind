import { describe, expect, it } from 'vitest';

import { HydrationTree } from '@/hydration.js';
import { PartType } from '@/part.js';
import { Runtime } from '@/runtime.js';
import { EmptyTemplate } from '@/template/empty-template.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { MockHostEnvironment, MockTemplate } from '../../mocks.js';

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
      const hydrationTree = new HydrationTree(document.createElement('div'));
      const runtime = new Runtime(new MockHostEnvironment());
      const template = new EmptyTemplate();
      const { childNodes, slots } = template.hydrate(
        binds,
        part,
        hydrationTree,
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
      const runtime = new Runtime(new MockHostEnvironment());
      const template = new EmptyTemplate();
      const { childNodes, slots } = template.render(binds, part, runtime);

      expect(childNodes).toStrictEqual([]);
      expect(slots).toStrictEqual([]);
    });
  });
});
