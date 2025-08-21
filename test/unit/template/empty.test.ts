import { describe, expect, it } from 'vitest';
import { createHydrationTree } from '@/hydration.js';
import { PartType } from '@/internal.js';
import { EmptyTemplate } from '@/template/empty.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { MockTemplate } from '../../mocks.js';
import { UpdateHelper } from '../../test-helpers.js';

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
      const target = createHydrationTree(document.createElement('div'));
      const helper = new UpdateHelper();

      const { childNodes, slots } = helper.startSession((context) => {
        return template.hydrate(binds, part, target, context);
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
      const helper = new UpdateHelper();

      const { childNodes, slots } = helper.startSession((context) => {
        return template.render(binds, part, context);
      });

      expect(childNodes).toStrictEqual([]);
      expect(slots).toStrictEqual([]);
    });
  });
});
