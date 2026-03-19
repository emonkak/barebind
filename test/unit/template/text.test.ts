import { describe, expect, it } from 'vitest';
import { PART_TYPE_TEXT, SLOT_STATUS_ATTACHED } from '@/core.js';
import { createTreeWalker, HydrationError } from '@/hydration.js';
import { createChildNodePart, HTML_NAMESPACE_URI } from '@/part.js';
import { TextTemplate } from '@/template/text.js';
import { createElement } from '../../test-helpers.js';
import { TestUpdater } from '../../test-updater.js';

describe('TextTemplate', () => {
  describe('arity', () => {
    it('returns the number of values', () => {
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
      const values = ['foo'] as const;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const container = createElement('div', {}, 'foo');
      const hydrationTarget = createTreeWalker(container);
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.hydrate(values, part, hydrationTarget, session);
      });

      expect(childNodes).toStrictEqual([expect.exact(container.firstChild)]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: values[0],
          part: {
            type: PART_TYPE_TEXT,
            node: expect.exact(container.firstChild),
            precedingText: '(',
            followingText: ')',
          },
          status: SLOT_STATUS_ATTACHED,
        }),
      ]);
    });

    it('should throw the error if there is a tree mismatch', () => {
      const template = new TextTemplate('(', ')');
      const values = ['foo'] as const;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const container = createElement('div', {});
      const hydrationTarget = createTreeWalker(container);
      const updater = new TestUpdater();

      expect(() => {
        updater.startUpdate((session) => {
          template.hydrate(values, part, hydrationTarget, session);
        });
      }).toThrow(HydrationError);
    });
  });

  describe('render()', () => {
    it('renders a template containing a text part', () => {
      const template = new TextTemplate('(', ')');
      const values = ['foo'] as const;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.render(values, part, session);
      });

      expect(childNodes).toStrictEqual([expect.any(Text)]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: values[0],
          part: {
            type: PART_TYPE_TEXT,
            node: expect.any(Text),
            precedingText: '(',
            followingText: ')',
          },
          status: SLOT_STATUS_ATTACHED,
        }),
      ]);
    });
  });
});
