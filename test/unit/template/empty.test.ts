import { describe, expect, it } from 'vitest';
import { createHydrationTarget } from '@/hydration.js';
import { PartType } from '@/internal.js';
import { EmptyTemplate } from '@/template/empty.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { MockTemplate } from '../../mocks.js';
import { TestUpdater } from '../../test-helpers.js';

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
      const template = new EmptyTemplate();
      const binds = [] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const target = createHydrationTarget(document.createElement('div'));
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.hydrate(binds, part, target, session);
      });

      expect(childNodes).toStrictEqual([]);
      expect(slots).toStrictEqual([]);
    });
  });

  describe('render()', () => {
    it('renders an empty tree', () => {
      const template = new EmptyTemplate();
      const binds = [] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.render(binds, part, session);
      });

      expect(childNodes).toStrictEqual([]);
      expect(slots).toStrictEqual([]);
    });
  });
});
