import { describe, expect, it } from 'vitest';
import { createTreeWalker } from '@/hydration.js';
import { createChildNodePart, HTML_NAMESPACE_URI } from '@/part.js';
import { EmptyTemplate } from '@/template/empty.js';
import { MockTemplate } from '../../mocks.js';
import { TestUpdater } from '../../test-updater.js';

describe('EmptyTemplate', () => {
  describe('arity', () => {
    it('is the number of values', () => {
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
      const values = [] as const;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const targetTree = createTreeWalker(document.createElement('div'));
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.hydrate(values, part, targetTree, session);
      });

      expect(childNodes).toStrictEqual([]);
      expect(slots).toStrictEqual([]);
    });
  });

  describe('render()', () => {
    it('renders an empty tree', () => {
      const template = new EmptyTemplate();
      const values = [] as const;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.render(values, part, session);
      });

      expect(childNodes).toStrictEqual([]);
      expect(slots).toStrictEqual([]);
    });
  });
});
