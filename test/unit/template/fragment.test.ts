import { describe, expect, it, vi } from 'vitest';
import { createTreeWalker } from '@/hydration.js';
import { createChildNodePart, HTML_NAMESPACE_URI } from '@/part.js';
import { Slot } from '@/slot.js';
import { FragmentTemplate } from '@/template/fragment.js';
import { MockBinding, MockDirective, MockTemplate } from '../../mocks.js';
import { serializeNode } from '../../test-helpers.js';
import { TestUpdater } from '../../test-updater.js';

describe('FragmentTemplate', () => {
  describe('arity', () => {
    it('returns the total arity of the inner templates', () => {
      expect(
        new FragmentTemplate([
          new MockTemplate(['[', ']'], ['foo']),
          new MockTemplate(),
          new MockTemplate(['[', ', ', ']'], ['bar', 'baz']),
        ]).arity,
      ).toBe(3);
      expect(new FragmentTemplate([]).arity).toBe(0);
    });
  });

  describe('equals()', () => {
    it('returns true if all templates are the same', () => {
      const innerTemplate1 = new MockTemplate();
      const innerTemplate2 = new MockTemplate();

      const template = new FragmentTemplate([innerTemplate1, innerTemplate2]);

      expect(template.equals(template)).toBe(true);
      expect(template.equals(new FragmentTemplate([]))).toBe(false);
      expect(
        template.equals(new FragmentTemplate([innerTemplate1, innerTemplate2])),
      ).toBe(true);
      expect(template.equals(new FragmentTemplate([innerTemplate1]))).toBe(
        false,
      );
      expect(
        template.equals(new FragmentTemplate([innerTemplate2, innerTemplate1])),
      ).toBe(false);
    });
  });

  describe('hydrate()', () => {
    it('delegate hydration to inner templates', () => {
      const innerTemplates = [
        new MockTemplate(['[', ']'], ['foo']),
        new MockTemplate(),
        new MockTemplate(['[', ', ', ']'], ['bar', 'baz']),
      ] as const;
      const template = new FragmentTemplate(innerTemplates);
      const values = ['foo', 'bar', 'baz'];
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const container = document.createElement('div');
      const hydrationTarget = createTreeWalker(container);
      const updater = new TestUpdater();

      const hydrationSpys = innerTemplates.map((template) =>
        vi.spyOn(template, 'hydrate').mockImplementation(() => {
          const part = createChildNodePart(
            document.createComment(''),
            HTML_NAMESPACE_URI,
          );
          return {
            childNodes: [part.node],
            slots: [
              new Slot(
                new MockBinding(
                  new MockDirective(),
                  template.values.join(','),
                  part,
                ),
              ),
            ],
          };
        }),
      );

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.hydrate(values, part, hydrationTarget, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([
        '<!---->',
        '<!---->',
        '<!---->',
      ]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: 'foo',
        }),
        expect.objectContaining({
          value: '',
        }),
        expect.objectContaining({
          value: 'bar,baz',
        }),
      ]);
      expect(hydrationSpys[0]).toHaveBeenCalledOnce();
      expect(hydrationSpys[0]).toHaveBeenCalledWith(
        ['foo'],
        part,
        hydrationTarget,
        expect.any(Object),
      );
      expect(hydrationSpys[1]).toHaveBeenCalledOnce();
      expect(hydrationSpys[1]).toHaveBeenCalledWith(
        [],
        part,
        hydrationTarget,
        expect.any(Object),
      );
      expect(hydrationSpys[2]).toHaveBeenCalledOnce();
      expect(hydrationSpys[2]).toHaveBeenCalledWith(
        ['bar', 'baz'],
        part,
        hydrationTarget,
        expect.any(Object),
      );
    });
  });

  describe('render()', () => {
    it('delegate rendering to inner templates', () => {
      const innerTemplates = [
        new MockTemplate(['[', ']'], ['foo']),
        new MockTemplate(),
        new MockTemplate(['[', ', ', ']'], ['bar', 'baz']),
      ] as const;
      const template = new FragmentTemplate(innerTemplates);
      const values = ['foo', 'bar', 'baz'];
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const updater = new TestUpdater();

      const renderSpys = innerTemplates.map((template) =>
        vi.spyOn(template, 'render').mockImplementation(() => {
          const part = createChildNodePart(
            document.createComment(''),
            HTML_NAMESPACE_URI,
          );
          return {
            childNodes: [part.node],
            slots: [
              new Slot(
                new MockBinding(
                  new MockDirective(),
                  template.values.join(','),
                  part,
                ),
              ),
            ],
          };
        }),
      );

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.render(values, part, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([
        '<!---->',
        '<!---->',
        '<!---->',
      ]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: 'foo',
        }),
        expect.objectContaining({
          value: '',
        }),
        expect.objectContaining({
          value: 'bar,baz',
        }),
      ]);
      expect(renderSpys[0]).toHaveBeenCalledOnce();
      expect(renderSpys[0]).toHaveBeenCalledWith(
        ['foo'],
        part,
        expect.any(Object),
      );
      expect(renderSpys[1]).toHaveBeenCalledOnce();
      expect(renderSpys[1]).toHaveBeenCalledWith([], part, expect.any(Object));
      expect(renderSpys[2]).toHaveBeenCalledOnce();
      expect(renderSpys[2]).toHaveBeenCalledWith(
        ['bar', 'baz'],
        part,
        expect.any(Object),
      );
    });
  });
});
