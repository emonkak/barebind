import { describe, expect, it, vi } from 'vitest';
import { BOUNDARY_TYPE_HYDRATION } from '@/core.js';
import { createTreeWalker } from '@/hydration.js';
import {
  createAttributePart,
  createChildNodePart,
  createElementPart,
  createTextPart,
  HTML_NAMESPACE_URI,
} from '@/part.js';
import { SLOT_STATUS_DETACHED, SLOT_STATUS_IDLE, Slot } from '@/slot.js';
import { TemplateBinding } from '@/template/template.js';
import {
  createRuntime,
  createScope,
  MockBinding,
  MockTemplate,
  MockType,
} from '../../mocks.js';
import { createElement } from '../../test-helpers.js';
import { TestUpdater } from '../../test-updater.js';

describe('Template', () => {
  describe('name', () => {
    it('returns the name of the class', () => {
      const template = new MockTemplate();
      expect(template.name).toBe(MockTemplate.name);
    });
  });

  describe('resolveBinding()', () => {
    it('constructs a new TemplateBinding', () => {
      const template = new MockTemplate();
      const values = ['foo'] as const;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const runtime = createRuntime();
      const binding = template.resolveBinding(values, part, runtime);

      expect(binding).toBeInstanceOf(TemplateBinding);
      expect(binding.type).toBe(template);
      expect(binding.value).toBe(values);
      expect(binding.part).toBe(part);
    });

    it('should throw the error if the part is not a child node part', () => {
      const template = new MockTemplate();
      const values = ['foo'] as const;
      const part = createElementPart(document.createElement('div'));
      const runtime = createRuntime();

      expect(() => template.resolveBinding(values, part, runtime)).toThrow(
        'MockTemplate must be used in ChildNodePart.',
      );
    });
  });
});

describe('TemplateBinding', () => {
  describe('shouldUpdate()', () => {
    it('returns true if the committed result does not exist', () => {
      const template = new MockTemplate();
      const values = [] as const;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const binding = new TemplateBinding(template, values, part);

      expect(binding.shouldUpdate(values)).toBe(true);
    });

    it('returns true if the committed values is different from the new one', () => {
      const template = new MockTemplate();
      const args1 = ['foo'];
      const args2 = ['bar'];
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const binding = new TemplateBinding(template, args1, part);
      const updater = new TestUpdater();

      SESSION: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(binding.shouldUpdate(args1)).toBe(false);
        expect(binding.shouldUpdate(args2)).toBe(true);
      }
    });
  });

  describe('attach()', () => {
    it('renders a template with the element as root', () => {
      const template = new MockTemplate();
      const args1 = ['foo', 'bar', 'baz'];
      const args2 = ['qux', 'quux', 'corge'];
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const binding = new TemplateBinding(template, args1, part);
      const updater = new TestUpdater();

      const container = createElement('div', {}, part.node);
      const fragment = createElement(
        'div',
        {},
        createElement('div'),
        '',
        document.createComment(''),
      );

      const renderSpy = vi
        .spyOn(template, 'render')
        .mockImplementation((values, _part, session) => {
          const slots = [
            new Slot(
              new MockBinding(
                new MockType(),
                values[0],
                createAttributePart(fragment.firstChild as Element, 'class'),
              ),
            ),
            new Slot(
              new MockBinding(
                new MockType(),
                values[1],
                createTextPart(
                  fragment.firstChild!.nextSibling as Text,
                  '',
                  '',
                ),
              ),
            ),
            new Slot(
              new MockBinding(
                new MockType(),
                values[2],
                createChildNodePart(
                  fragment.firstChild!.nextSibling!.nextSibling as Comment,
                  HTML_NAMESPACE_URI,
                ),
              ),
            ),
          ];
          for (const slot of slots) {
            slot.attach(session);
          }
          return { childNodes: [fragment], slots };
        });

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(renderSpy).toHaveBeenCalledOnce();
        expect(renderSpy).toHaveBeenCalledWith(args1, part, expect.any(Object));
        expect(part.node).toBe(fragment);
        expect(container.innerHTML).toBe(
          '<div><div class="foo"></div>bar<!--baz--></div><!---->',
        );
        expect(binding['_pendingResult']).toStrictEqual({
          childNodes: [fragment],
          slots: [
            expect.objectContaining({
              value: args1[0],
              status: SLOT_STATUS_IDLE,
            }),
            expect.objectContaining({
              value: args1[1],
              status: SLOT_STATUS_IDLE,
            }),
            expect.objectContaining({
              value: args1[2],
              status: SLOT_STATUS_IDLE,
            }),
          ],
        });
        expect(binding['_memoizedResult']).toBe(binding['_pendingResult']);
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.value = args2;
          binding.attach(session);
          binding.commit();
        });

        expect(renderSpy).toHaveBeenCalledOnce();
        expect(part.node).toBe(fragment);
        expect(container.innerHTML).toBe(
          '<div><div class="qux"></div>quux<!--corge--></div><!---->',
        );
        expect(binding['_pendingResult']).toStrictEqual({
          childNodes: [fragment],
          slots: [
            expect.objectContaining({
              value: args2[0],
              status: SLOT_STATUS_IDLE,
            }),
            expect.objectContaining({
              value: args2[1],
              status: SLOT_STATUS_IDLE,
            }),
            expect.objectContaining({
              value: args2[2],
              status: SLOT_STATUS_IDLE,
            }),
          ],
        });
        expect(binding['_memoizedResult']).toBe(binding['_pendingResult']);
      }

      SESSION3: {
        updater.startUpdate((session) => {
          binding.detach(session);
          binding.rollback();
        });

        expect(renderSpy).toHaveBeenCalledOnce();
        expect(part.node).toBe(part.sentinelNode);
        expect(container.innerHTML).toBe('<!---->');
        expect(binding['_pendingResult']).toStrictEqual({
          childNodes: [fragment],
          slots: [
            expect.objectContaining({
              value: args2[0],
              status: SLOT_STATUS_DETACHED,
            }),
            expect.objectContaining({
              value: args2[1],
              status: SLOT_STATUS_DETACHED,
            }),
            expect.objectContaining({
              value: args2[2],
              status: SLOT_STATUS_DETACHED,
            }),
          ],
        });
        expect(binding['_memoizedResult']).toBe(null);
      }
    });

    it('renders a template with multiple root nodes', () => {
      const template = new MockTemplate();
      const args1 = ['foo', 'bar', 'baz'];
      const args2 = ['qux', 'quux', 'corge'];
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const binding = new TemplateBinding(template, args1, part);
      const updater = new TestUpdater();

      const container = createElement('div', {}, part.node);
      const fragment = [
        document.createComment(''),
        document.createTextNode(''),
        document.createElement('div'),
      ] as const;

      const renderSpy = vi
        .spyOn(template, 'render')
        .mockImplementation((values, _part, session) => {
          const slots = [
            new Slot(
              new MockBinding(
                new MockType(),
                values[0],
                createChildNodePart(fragment[0], HTML_NAMESPACE_URI),
              ),
            ),
            new Slot(
              new MockBinding(
                new MockType(),
                values[1],
                createTextPart(fragment[1], '', ''),
              ),
            ),
            new Slot(
              new MockBinding(
                new MockType(),
                values[2],
                createAttributePart(fragment[2], 'class'),
              ),
            ),
          ];
          for (const slot of slots) {
            slot.attach(session);
          }
          return {
            childNodes: fragment,
            slots,
          };
        });

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(renderSpy).toHaveBeenCalledOnce();
        expect(renderSpy).toHaveBeenCalledWith(args1, part, expect.any(Object));
        expect(part.node).toStrictEqual(fragment[0]);
        expect(container.innerHTML).toBe(
          '<!--foo-->bar<div class="baz"></div><!---->',
        );
        expect(binding['_pendingResult']).toStrictEqual({
          childNodes: fragment,
          slots: [
            expect.objectContaining({
              value: args1[0],
              status: SLOT_STATUS_IDLE,
            }),
            expect.objectContaining({
              value: args1[1],
              status: SLOT_STATUS_IDLE,
            }),
            expect.objectContaining({
              value: args1[2],
              status: SLOT_STATUS_IDLE,
            }),
          ],
        });
        expect(binding['_memoizedResult']).toBe(binding['_pendingResult']);
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.value = args2;
          binding.attach(session);
          binding.commit();
        });

        expect(renderSpy).toHaveBeenCalledOnce();
        expect(part.node).toStrictEqual(fragment[0]);
        expect(container.innerHTML).toBe(
          '<!--qux-->quux<div class="corge"></div><!---->',
        );
        expect(binding['_pendingResult']).toStrictEqual({
          childNodes: fragment,
          slots: [
            expect.objectContaining({
              value: args2[0],
              status: SLOT_STATUS_IDLE,
            }),
            expect.objectContaining({
              value: args2[1],
              status: SLOT_STATUS_IDLE,
            }),
            expect.objectContaining({
              value: args2[2],
              status: SLOT_STATUS_IDLE,
            }),
          ],
        });
        expect(binding['_memoizedResult']).toBe(binding['_pendingResult']);
      }

      SESSION3: {
        updater.startUpdate((session) => {
          binding.detach(session);
          binding.rollback();
        });

        expect(renderSpy).toHaveBeenCalledOnce();
        expect(part.node).toBe(part.sentinelNode);
        expect(container.innerHTML).toBe('<!---->');
        expect(binding['_pendingResult']).toStrictEqual({
          childNodes: fragment,
          slots: [
            expect.objectContaining({
              value: args2[0],
              status: SLOT_STATUS_IDLE,
            }),
            expect.objectContaining({
              value: args2[1],
              status: SLOT_STATUS_IDLE,
            }),
            expect.objectContaining({
              value: args2[2],
              status: SLOT_STATUS_DETACHED,
            }),
          ],
        });
        expect(binding['_memoizedResult']).toBe(null);
      }
    });

    it('hydrates a template', () => {
      const template = new MockTemplate();
      const values = [] as const;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const binding = new TemplateBinding(template, values, part);
      const container = createElement('div', {}, 'foo', part.node);
      const scope = createScope();
      const hydrationTarget = createTreeWalker(container);
      const updater = new TestUpdater(scope);

      const hydrateSpy = vi.spyOn(template, 'hydrate').mockReturnValue({
        childNodes: [container.firstChild!],
        slots: [],
      });

      scope.boundary = {
        type: BOUNDARY_TYPE_HYDRATION,
        next: scope.boundary,
        target: hydrationTarget,
      };

      updater.startUpdate((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(hydrateSpy).toHaveBeenCalledOnce();
      expect(hydrateSpy).toHaveBeenCalledWith(
        values,
        part,
        hydrationTarget,
        expect.any(Object),
      );
      expect(part.node).toBe(container.firstChild);
      expect(container.innerHTML).toBe('foo<!---->');
    });
  });
});
