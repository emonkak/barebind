import { describe, expect, it } from 'vitest';
import { PART_TYPE_CHILD_NODE } from '@/core.js';
import { createTreeWalker } from '@/hydration.js';
import { EmptyTemplate } from '@/template/empty.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
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
      const part = {
        type: PART_TYPE_CHILD_NODE,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      } as const;
      const targetTree = createTreeWalker(document.createElement('div'));
      const updater = new TestUpdater();

      const { children, slots } = updater.startUpdate((session) => {
        return template.hydrate(values, part, targetTree, session);
      });

      expect(children).toStrictEqual([]);
      expect(slots).toStrictEqual([]);
    });
  });

  describe('render()', () => {
    it('renders an empty tree', () => {
      const template = new EmptyTemplate();
      const values = [] as const;
      const part = {
        type: PART_TYPE_CHILD_NODE,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      } as const;
      const updater = new TestUpdater();

      const { children, slots } = updater.startUpdate((session) => {
        return template.render(values, part, session);
      });

      expect(children).toStrictEqual([]);
      expect(slots).toStrictEqual([]);
    });
  });
});
