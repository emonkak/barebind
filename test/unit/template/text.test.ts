import { describe, expect, it } from 'vitest';

import { createHydrationTarget, HydrationError, PartType } from '@/internal.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { TextTemplate } from '@/template/text.js';
import { createElement, UpdateHelper } from '../../test-helpers.js';

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
      const target = createHydrationTarget(container);
      const helper = new UpdateHelper();

      const { childNodes, slots } = helper.startSession((context) => {
        return template.hydrate(binds, part, target, context);
      });

      expect(childNodes).toStrictEqual([expect.exact(container.firstChild)]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: binds[0],
          part: {
            type: PartType.Text,
            node: expect.exact(container.firstChild),
            precedingText: '(',
            followingText: ')',
          },
          isConnected: true,
          isCommitted: false,
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
      const target = createHydrationTarget(container);
      const helper = new UpdateHelper();

      expect(() => {
        helper.startSession((context) => {
          template.hydrate(binds, part, target, context);
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
      const helper = new UpdateHelper();

      const { childNodes, slots } = helper.startSession((context) => {
        return template.render(binds, part, context);
      });

      expect(childNodes).toStrictEqual([expect.any(Text)]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: binds[0],
          part: {
            type: PartType.Text,
            node: expect.any(Text),
            precedingText: '(',
            followingText: ')',
          },
          isConnected: true,
          isCommitted: false,
        }),
      ]);
    });
  });
});
