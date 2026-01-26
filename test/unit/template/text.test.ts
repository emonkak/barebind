import { describe, expect, it } from 'vitest';

import { createTreeWalker, HydrationError } from '@/hydration.js';
import { PartType } from '@/internal.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { TextTemplate } from '@/template/text.js';
import { createElement } from '../../test-helpers.js';
import { TestUpdater } from '../../test-updater.js';

describe('TextTemplate', () => {
  describe('arity', () => {
    it('returns the number of binds', () => {
      const template = new TextTemplate();

      expect(template.arity).toBe(1);
    });
  });

  describe('equals()', () => {
    it('returns true if the preceding and following texts are the same', () => {
      const template = new TextTemplate('foo', 'bar');

      expect(template.equals(template)).toBe(true);
      expect(template.equals(new TextTemplate('foo', 'bar'))).toBe(true);
      expect(template.equals(new TextTemplate('foo', ''))).toBe(false);
      expect(template.equals(new TextTemplate('', 'bar'))).toBe(false);
    });
  });

  describe('hydrate()', () => {
    it('hydrates a tree containing a text part', () => {
      const template = new TextTemplate('(', ')');
      const binds = ['foo'] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const container = createElement('div', {}, 'foo');
      const targetTree = createTreeWalker(container);
      const updater = new TestUpdater();

      const { children, slots } = updater.startUpdate((session) => {
        return template.hydrate(binds, part, targetTree, session);
      });

      expect(children).toStrictEqual([expect.exact(container.firstChild)]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: binds[0],
          part: {
            type: PartType.Text,
            node: expect.exact(container.firstChild),
            precedingText: '(',
            followingText: ')',
          },
          dirty: true,
          committed: false,
        }),
      ]);
    });

    it('should throw the error if there is a tree mismatch', () => {
      const template = new TextTemplate('(', ')');
      const binds = ['foo'] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const container = createElement('div', {});
      const targetTree = createTreeWalker(container);
      const updater = new TestUpdater();

      expect(() => {
        updater.startUpdate((session) => {
          template.hydrate(binds, part, targetTree, session);
        });
      }).toThrow(HydrationError);
    });
  });

  describe('render()', () => {
    it('renders a template containing a text part', () => {
      const template = new TextTemplate('(', ')');
      const binds = ['foo'] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const updater = new TestUpdater();

      const { children, slots } = updater.startUpdate((session) => {
        return template.render(binds, part, session);
      });

      expect(children).toStrictEqual([expect.any(Text)]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: binds[0],
          part: {
            type: PartType.Text,
            node: expect.any(Text),
            precedingText: '(',
            followingText: ')',
          },
          dirty: true,
          committed: false,
        }),
      ]);
    });
  });
});
