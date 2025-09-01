import { describe, expect, it, vi } from 'vitest';
import { createHydrationTarget } from '@/hydration.js';
import { PartType } from '@/internal.js';
import { FragmentTemplate } from '@/template/fragment.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import {
  MockBinding,
  MockDirective,
  MockSlot,
  MockTemplate,
} from '../../mocks.js';
import { serializeNode, UpdateHelper } from '../../test-helpers.js';

describe('FragmentTemplate', () => {
  describe('arity', () => {
    it('returns the total arity of the internal templates', () => {
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
      const internalTemplate1 = new MockTemplate();
      const internalTemplate2 = new MockTemplate();

      const template = new FragmentTemplate([
        internalTemplate1,
        internalTemplate2,
      ]);

      expect(template.equals(template)).toBe(true);
      expect(template.equals(new FragmentTemplate([]))).toBe(false);
      expect(
        template.equals(
          new FragmentTemplate([internalTemplate1, internalTemplate2]),
        ),
      ).toBe(true);
      expect(template.equals(new FragmentTemplate([internalTemplate1]))).toBe(
        false,
      );
      expect(
        template.equals(
          new FragmentTemplate([internalTemplate2, internalTemplate1]),
        ),
      ).toBe(false);
    });
  });

  describe('hydrate()', () => {
    it('delegate hydration to internal templates', () => {
      const innerTemplates = [
        new MockTemplate(['[', ']'], ['foo']),
        new MockTemplate(),
        new MockTemplate(['[', ', ', ']'], ['bar', 'baz']),
      ] as const;
      const template = new FragmentTemplate(innerTemplates);
      const binds = ['foo', 'bar', 'baz'];
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const container = document.createElement('div');
      const target = createHydrationTarget(container);
      const helper = new UpdateHelper();

      const hydrationSpys = innerTemplates.map((template) =>
        vi.spyOn(template, 'hydrate').mockImplementation(() => {
          const part = {
            type: PartType.ChildNode,
            node: document.createComment(template.binds.join('')),
            anchorNode: null,
            namespaceURI: HTML_NAMESPACE_URI,
          };
          return {
            childNodes: [part.node],
            slots: [
              new MockSlot(
                new MockBinding(new MockDirective(), template.binds, part),
              ),
            ],
          };
        }),
      );

      const { childNodes, slots } = helper.startUpdate((session) => {
        return template.hydrate(binds, part, target, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([
        '<!--foo-->',
        '<!---->',
        '<!--barbaz-->',
      ]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: ['foo'],
        }),
        expect.objectContaining({
          value: [],
        }),
        expect.objectContaining({
          value: ['bar', 'baz'],
        }),
      ]);
      expect(hydrationSpys[0]).toHaveBeenCalledOnce();
      expect(hydrationSpys[0]).toHaveBeenCalledWith(
        ['foo'],
        part,
        target,
        expect.any(Object),
      );
      expect(hydrationSpys[1]).toHaveBeenCalledOnce();
      expect(hydrationSpys[1]).toHaveBeenCalledWith(
        [],
        part,
        target,
        expect.any(Object),
      );
      expect(hydrationSpys[2]).toHaveBeenCalledOnce();
      expect(hydrationSpys[2]).toHaveBeenCalledWith(
        ['bar', 'baz'],
        part,
        target,
        expect.any(Object),
      );
    });
  });

  describe('render()', () => {
    it('delegate rendering to internal templates', () => {
      const innerTemplates = [
        new MockTemplate(['[', ']'], ['foo']),
        new MockTemplate(),
        new MockTemplate(['[', ', ', ']'], ['bar', 'baz']),
      ] as const;
      const template = new FragmentTemplate(innerTemplates);
      const binds = ['foo', 'bar', 'baz'];
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const helper = new UpdateHelper();

      const renderSpys = innerTemplates.map((template) =>
        vi.spyOn(template, 'render').mockImplementation(() => {
          const part = {
            type: PartType.ChildNode,
            node: document.createComment(template.binds.join('')),
            anchorNode: null,
            namespaceURI: HTML_NAMESPACE_URI,
          };
          return {
            childNodes: [part.node],
            slots: [
              new MockSlot(
                new MockBinding(new MockDirective(), template.binds, part),
              ),
            ],
          };
        }),
      );

      const { childNodes, slots } = helper.startUpdate((session) => {
        return template.render(binds, part, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([
        '<!--foo-->',
        '<!---->',
        '<!--barbaz-->',
      ]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: ['foo'],
        }),
        expect.objectContaining({
          value: [],
        }),
        expect.objectContaining({
          value: ['bar', 'baz'],
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
