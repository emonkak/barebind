import { describe, expect, it } from 'vitest';
import { createHydrationTree } from '@/hydration.js';
import { PartType } from '@/internal.js';
import { EmptyTemplate } from '@/template/empty.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { MockTemplate } from '../../mocks.js';
import { createUpdateSession } from '../../session-utils.js';

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
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const target = createHydrationTree(document.createElement('div'));
      const session = createUpdateSession();
      const template = new EmptyTemplate();
      const { childNodes, slots } = template.hydrate(
        binds,
        part,
        target,
        session,
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
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const session = createUpdateSession();
      const template = new EmptyTemplate();
      const { childNodes, slots } = template.render(binds, part, session);

      expect(childNodes).toStrictEqual([]);
      expect(slots).toStrictEqual([]);
    });
  });
});
