import { describe, expect, it } from 'vitest';
import {
  createChildNodePart,
  createTreeWalker,
  HTML_NAMESPACE_URI,
} from '@/dom.js';
import { EmptyTemplate } from '@/template/empty.js';
import { MockTemplate } from '../../mocks.js';
import { TestUpdater } from '../../test-updater.js';

describe('EmptyTemplate', () => {
  describe('arity', () => {
    it('is the number of expressions', () => {
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
      const exprs = [] as const;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const hydrationTarget = createTreeWalker(document.createElement('div'));
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.hydrate(exprs, part, hydrationTarget, session);
      });

      expect(childNodes).toStrictEqual([]);
      expect(slots).toStrictEqual([]);
    });
  });

  describe('render()', () => {
    it('renders an empty tree', () => {
      const template = new EmptyTemplate();
      const exprs = [] as const;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.render(exprs, part, session);
      });

      expect(childNodes).toStrictEqual([]);
      expect(slots).toStrictEqual([]);
    });
  });
});
