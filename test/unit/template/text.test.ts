import { describe, expect, it } from 'vitest';
import {
  createChildNodePart,
  createTreeWalker,
  DOM_PART_TYPE_TEXT,
  HTML_NAMESPACE_URI,
} from '@/dom.js';
import { HydrationError } from '@/error.js';
import { TextTemplate } from '@/template/text.js';
import { MockTemplate } from '../../mocks.js';
import { createElement } from '../../test-helpers.js';
import { TestUpdater } from '../../test-updater.js';

describe('TextTemplate', () => {
  describe('arity', () => {
    it('is the number of expressions', () => {
      const template = new TextTemplate();

      expect(template.arity).toBe(1);
    });
  });

  describe('equals()', () => {
    it('returns true if the value is instance of TextTemplate', () => {
      const template = new TextTemplate();

      expect(template.equals(template)).toBe(true);
      expect(template.equals(new TextTemplate())).toBe(true);
      expect(template.equals(new MockTemplate())).toBe(false);
    });
  });

  describe('hydrate()', () => {
    it('hydrates text nodes', () => {
      const template = new TextTemplate();
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const container = createElement('div', {}, 'foo');
      const hydrationTarget = createTreeWalker(container);
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.hydrate(['foo'], part, hydrationTarget, session);
      });

      expect(childNodes).toStrictEqual([expect.exact(container.firstChild)]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          part: {
            type: DOM_PART_TYPE_TEXT,
            node: expect.exact(container.firstChild),
          },
          value: 'foo',
        }),
      ]);
    });

    it('throws errors when mismatch node exists', () => {
      const template = new TextTemplate();
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const container = createElement('div', {}, document.createComment('foo'));
      const hydrationTarget = createTreeWalker(container);
      const updater = new TestUpdater();

      expect(() => {
        updater.startUpdate((session) => {
          template.hydrate(['foo'], part, hydrationTarget, session);
        });
      }).toThrow(HydrationError);
    });
  });

  describe('render()', () => {
    it('renders text nodes', () => {
      const template = new TextTemplate();
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.render(['foo'], part, session);
      });

      expect(childNodes).toStrictEqual([expect.any(Text)]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          part: {
            type: DOM_PART_TYPE_TEXT,
            node: expect.any(Text),
          },
          value: 'foo',
        }),
      ]);
    });
  });
});
