import { describe, expect, it, vi } from 'vitest';

import { HydrationError, HydrationTree } from '@/hydration.js';
import { PartType } from '@/part.js';
import { Runtime } from '@/runtime.js';
import { TemplateBinding } from '@/template/template.js';
import {
  MockBinding,
  MockPrimitive,
  MockRenderHost,
  MockSlot,
  MockTemplate,
} from '../../mocks.js';
import { createElement } from '../../testUtils.js';

describe('TemplateBinding', () => {
  describe('shouldBind()', () => {
    it('returns true if the committed result does not exist', () => {
      const template = new MockTemplate();
      const binds = [] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const binding = new TemplateBinding(template, binds, part);

      expect(binding.shouldBind(binds)).toBe(true);
    });

    it('returns true if the committed binds is different from the new one', () => {
      const template = new MockTemplate();
      const binds1 = ['foo'];
      const binds2 = ['bar'];
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const binding = new TemplateBinding(template, binds1, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(binding.shouldBind(binds1)).toBe(false);
      expect(binding.shouldBind(binds2)).toBe(true);
    });
  });

  describe('hydrate()', () => {
    it('hydrates the template', () => {
      const template = new MockTemplate();
      const binds = [] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const binding = new TemplateBinding(template, binds, part);
      const hydrationRoot = createElement('div', {}, 'foo', part.node);
      const hydrationTree = new HydrationTree(hydrationRoot);
      const runtime = new Runtime(new MockRenderHost());

      const hydrateSpy = vi.spyOn(template, 'hydrate').mockReturnValue({
        childNodes: [hydrationRoot.firstChild!],
        slots: [],
      });

      binding.hydrate(hydrationTree, runtime);

      expect(hydrateSpy).toHaveBeenCalledOnce();
      expect(hydrateSpy).toHaveBeenCalledWith(
        binds,
        part,
        hydrationTree,
        runtime,
      );
      expect(hydrationRoot.innerHTML).toBe('foo<!---->');

      binding.disconnect(runtime);
      binding.rollback(runtime);

      expect(hydrationRoot.innerHTML).toBe('<!---->');
    });

    it('should throw the error if the template has already been rendered', () => {
      const template = new MockTemplate();
      const binds = [] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const binding = new TemplateBinding(template, binds, part);
      const hydrationRoot = document.createElement('div');
      const hydrationTree = new HydrationTree(hydrationRoot);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(() => binding.hydrate(hydrationTree, runtime)).toThrow(
        HydrationError,
      );
    });
  });

  describe('connect()', () => {
    it('renders a template with the element as root', () => {
      const template = new MockTemplate();
      const binds1 = ['foo', 'bar', 'baz'];
      const binds2 = ['qux', 'quux', 'corge'];
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const binding = new TemplateBinding(template, binds1, part);
      const runtime = new Runtime(new MockRenderHost());

      const container = createElement('div', {}, part.node);
      const renderRoot = createElement(
        'div',
        {},
        createElement('div'),
        '',
        document.createComment(''),
      );
      const renderSpy = vi
        .spyOn(template, 'render')
        .mockImplementation((binds, _part, runtime) => {
          const slots = [
            new MockSlot(
              new MockBinding(MockPrimitive, binds[0], {
                type: PartType.Attribute,
                node: renderRoot.firstChild as Element,
                name: 'class',
              }),
            ),
            new MockSlot(
              new MockBinding(MockPrimitive, binds[1], {
                type: PartType.Text,
                node: renderRoot.firstChild!.nextSibling as Text,
                precedingText: '',
                followingText: '',
              }),
            ),
            new MockSlot(
              new MockBinding(MockPrimitive, binds[2], {
                type: PartType.ChildNode,
                node: renderRoot.firstChild!.nextSibling!
                  .nextSibling as Comment,
                childNode: null,
              }),
            ),
          ];
          for (const slot of slots) {
            slot.connect(runtime);
          }
          return { childNodes: [renderRoot], slots };
        });

      binding.connect(runtime);
      binding.commit(runtime);

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(binds1, part, runtime);
      expect(part.childNode).toBe(renderRoot);
      expect(container.innerHTML).toBe(
        '<div><div class="foo"></div>bar<!--baz--></div><!---->',
      );
      expect(binding['_pendingResult']).toStrictEqual({
        childNodes: [renderRoot],
        slots: [
          expect.objectContaining({
            value: binds1[0],
            isConnected: true,
            isCommitted: true,
          }),
          expect.objectContaining({
            value: binds1[1],
            isConnected: true,
            isCommitted: true,
          }),
          expect.objectContaining({
            value: binds1[2],
            isConnected: true,
            isCommitted: true,
          }),
        ],
      });
      expect(binding['_memoizedResult']).toBe(binding['_pendingResult']);

      binding.bind(binds2);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(part.childNode).toBe(renderRoot);
      expect(container.innerHTML).toBe(
        '<div><div class="qux"></div>quux<!--corge--></div><!---->',
      );
      expect(binding['_pendingResult']).toStrictEqual({
        childNodes: [renderRoot],
        slots: [
          expect.objectContaining({
            value: binds2[0],
            isConnected: true,
            isCommitted: true,
          }),
          expect.objectContaining({
            value: binds2[1],
            isConnected: true,
            isCommitted: true,
          }),
          expect.objectContaining({
            value: binds2[2],
            isConnected: true,
            isCommitted: true,
          }),
        ],
      });
      expect(binding['_memoizedResult']).toBe(binding['_pendingResult']);

      binding.disconnect(runtime);
      binding.rollback(runtime);

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(part.childNode).toBe(null);
      expect(container.innerHTML).toBe('<!---->');
      expect(binding['_pendingResult']).toStrictEqual({
        childNodes: [renderRoot],
        slots: [
          expect.objectContaining({
            value: binds2[0],
            isConnected: false,
            isCommitted: true,
          }),
          expect.objectContaining({
            value: binds2[1],
            isConnected: false,
            isCommitted: true,
          }),
          expect.objectContaining({
            value: binds2[2],
            isConnected: false,
            isCommitted: true,
          }),
        ],
      });
      expect(binding['_memoizedResult']).toBe(null);
    });

    it('renders a template with multiple root nodes', () => {
      const template = new MockTemplate();
      const binds1 = ['foo', 'bar', 'baz'];
      const binds2 = ['qux', 'quux', 'corge'];
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const binding = new TemplateBinding(template, binds1, part);
      const runtime = new Runtime(new MockRenderHost());

      const container = createElement('div', {}, part.node);
      const childNodes = [
        document.createComment(''),
        document.createTextNode(''),
        document.createElement('div'),
      ] as const;
      const renderSpy = vi
        .spyOn(template, 'render')
        .mockImplementation((binds) => {
          const slots = [
            new MockSlot(
              new MockBinding(MockPrimitive, binds[0], {
                type: PartType.ChildNode,
                node: childNodes[0],
                childNode: null,
              }),
            ),
            new MockSlot(
              new MockBinding(MockPrimitive, binds[1], {
                type: PartType.Text,
                node: childNodes[1],
                precedingText: '',
                followingText: '',
              }),
            ),
            new MockSlot(
              new MockBinding(MockPrimitive, binds[2], {
                type: PartType.Attribute,
                node: childNodes[2],
                name: 'class',
              }),
            ),
          ];
          for (const slot of slots) {
            slot.connect(runtime);
          }
          return {
            childNodes,
            slots,
          };
        });

      binding.connect(runtime);
      binding.commit(runtime);

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(renderSpy).toHaveBeenCalledWith(binds1, part, runtime);
      expect(part.childNode).toStrictEqual(childNodes[0]);
      expect(container.innerHTML).toBe(
        '<!--foo-->bar<div class="baz"></div><!---->',
      );
      expect(binding['_pendingResult']).toStrictEqual({
        childNodes,
        slots: [
          expect.objectContaining({
            value: binds1[0],
            isConnected: true,
            isCommitted: true,
          }),
          expect.objectContaining({
            value: binds1[1],
            isConnected: true,
            isCommitted: true,
          }),
          expect.objectContaining({
            value: binds1[2],
            isConnected: true,
            isCommitted: true,
          }),
        ],
      });
      expect(binding['_memoizedResult']).toBe(binding['_pendingResult']);

      binding.bind(binds2);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(part.childNode).toStrictEqual(childNodes[0]);
      expect(container.innerHTML).toBe(
        '<!--qux-->quux<div class="corge"></div><!---->',
      );
      expect(binding['_pendingResult']).toStrictEqual({
        childNodes,
        slots: [
          expect.objectContaining({
            value: binds2[0],
            isConnected: true,
            isCommitted: true,
          }),
          expect.objectContaining({
            value: binds2[1],
            isConnected: true,
            isCommitted: true,
          }),
          expect.objectContaining({
            value: binds2[2],
            isConnected: true,
            isCommitted: true,
          }),
        ],
      });
      expect(binding['_memoizedResult']).toBe(binding['_pendingResult']);

      binding.disconnect(runtime);
      binding.rollback(runtime);

      expect(renderSpy).toHaveBeenCalledOnce();
      expect(part.childNode).toBe(null);
      expect(container.innerHTML).toBe('<!---->');
      expect(binding['_pendingResult']).toStrictEqual({
        childNodes,
        slots: [
          expect.objectContaining({
            value: binds2[0],
            isConnected: false,
            isCommitted: false,
          }),
          expect.objectContaining({
            value: binds2[1],
            isConnected: false,
            isCommitted: false,
          }),
          expect.objectContaining({
            value: binds2[2],
            isConnected: false,
            isCommitted: true,
          }),
        ],
      });
      expect(binding['_memoizedResult']).toBe(null);
    });
  });
});
