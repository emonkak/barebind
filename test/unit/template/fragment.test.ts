import { describe, expect, it, vi } from 'vitest';
import { PartType } from '@/core.js';
import { HydrationContainer } from '@/hydration.js';
import { Runtime } from '@/runtime.js';
import { FragmentTemplate } from '@/template/fragment.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import {
  MockBackend,
  MockBinding,
  MockDirective,
  MockSlot,
  MockTemplate,
} from '../../mocks.js';
import { serializeNode } from '../../test-utils.js';

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
      const binds = ['foo', 'bar', 'baz'];
      const internalTemplates = [
        new MockTemplate(['[', ']'], ['foo']),
        new MockTemplate(),
        new MockTemplate(['[', ', ', ']'], ['bar', 'baz']),
      ] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const hydrationRoot = document.createElement('div');
      const hydrationTree = new HydrationContainer(hydrationRoot);
      const runtime = new Runtime(new MockBackend());
      const template = new FragmentTemplate(internalTemplates);

      const hydrationSpys = internalTemplates.map((template) =>
        vi.spyOn(template, 'hydrate').mockImplementation(() => {
          const part = {
            type: PartType.ChildNode,
            node: document.createComment(template.binds.join('')),
            childNode: null,
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

      const { childNodes, slots } = template.hydrate(
        binds,
        part,
        hydrationTree,
        runtime,
      );

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
        hydrationTree,
        runtime,
      );
      expect(hydrationSpys[1]).toHaveBeenCalledOnce();
      expect(hydrationSpys[1]).toHaveBeenCalledWith(
        [],
        part,
        hydrationTree,
        runtime,
      );
      expect(hydrationSpys[2]).toHaveBeenCalledOnce();
      expect(hydrationSpys[2]).toHaveBeenCalledWith(
        ['bar', 'baz'],
        part,
        hydrationTree,
        runtime,
      );
    });
  });

  describe('render()', () => {
    it('delegate rendering to internal templates', () => {
      const binds = ['foo', 'bar', 'baz'];
      const internalTemplates = [
        new MockTemplate(['[', ']'], ['foo']),
        new MockTemplate(),
        new MockTemplate(['[', ', ', ']'], ['bar', 'baz']),
      ] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const runtime = new Runtime(new MockBackend());
      const template = new FragmentTemplate(internalTemplates);

      const renderSpys = internalTemplates.map((template) =>
        vi.spyOn(template, 'render').mockImplementation(() => {
          const part = {
            type: PartType.ChildNode,
            node: document.createComment(template.binds.join('')),
            childNode: null,
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

      const { childNodes, slots } = template.render(binds, part, runtime);

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
      expect(renderSpys[0]).toHaveBeenCalledWith(['foo'], part, runtime);
      expect(renderSpys[1]).toHaveBeenCalledOnce();
      expect(renderSpys[1]).toHaveBeenCalledWith([], part, runtime);
      expect(renderSpys[2]).toHaveBeenCalledOnce();
      expect(renderSpys[2]).toHaveBeenCalledWith(['bar', 'baz'], part, runtime);
    });
  });
});
