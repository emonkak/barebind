import { describe, expect, it, vi } from 'vitest';
import {
  BOUNDARY_TYPE_HYDRATION,
  PART_TYPE_ATTRIBUTE,
  PART_TYPE_CHILD_NODE,
  PART_TYPE_ELEMENT,
  PART_TYPE_TEXT,
  SLOT_STATUS_DETACHED,
  SLOT_STATUS_IDLE,
} from '@/core.js';
import { createTreeWalker } from '@/hydration.js';
import {
  getNamespaceURIByTagName,
  HTML_NAMESPACE_URI,
  MATH_NAMESPACE_URI,
  SVG_NAMESPACE_URI,
  TemplateBinding,
} from '@/template/template.js';
import {
  createRuntime,
  createScope,
  MockBinding,
  MockPrimitive,
  MockSlot,
  MockTemplate,
} from '../../mocks.js';
import { createElement } from '../../test-helpers.js';
import { TestUpdater } from '../../test-updater.js';

describe('AbstractTemplate', () => {
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
      const part = {
        type: PART_TYPE_CHILD_NODE,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      } as const;
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
      const part = {
        type: PART_TYPE_ELEMENT,
        node: document.createElement('div'),
      } as const;
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
      const part = {
        type: PART_TYPE_CHILD_NODE,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      } as const;
      const binding = new TemplateBinding(template, values, part);

      expect(binding.shouldUpdate(values)).toBe(true);
    });

    it('returns true if the committed values is different from the new one', () => {
      const template = new MockTemplate();
      const args1 = ['foo'];
      const args2 = ['bar'];
      const part = {
        type: PART_TYPE_CHILD_NODE,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      } as const;
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
      const part = {
        type: PART_TYPE_CHILD_NODE,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      } as const;
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
            new MockSlot(
              new MockBinding(MockPrimitive, values[0], {
                type: PART_TYPE_ATTRIBUTE,
                node: fragment.firstChild as Element,
                name: 'class',
              }),
            ),
            new MockSlot(
              new MockBinding(MockPrimitive, values[1], {
                type: PART_TYPE_TEXT,
                node: fragment.firstChild!.nextSibling as Text,
                precedingText: '',
                followingText: '',
              }),
            ),
            new MockSlot(
              new MockBinding(MockPrimitive, values[2], {
                type: PART_TYPE_CHILD_NODE,
                node: fragment.firstChild!.nextSibling!.nextSibling as Comment,
                anchorNode: null,
                namespaceURI: HTML_NAMESPACE_URI,
              }),
            ),
          ];
          for (const slot of slots) {
            slot.attach(session);
          }
          return { children: [fragment], slots };
        });

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(renderSpy).toHaveBeenCalledOnce();
        expect(renderSpy).toHaveBeenCalledWith(args1, part, expect.any(Object));
        expect(part.anchorNode).toBe(fragment);
        expect(container.innerHTML).toBe(
          '<div><div class="foo"></div>bar<!--baz--></div><!---->',
        );
        expect(binding['_pendingResult']).toStrictEqual({
          children: [fragment],
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
        expect(part.anchorNode).toBe(fragment);
        expect(container.innerHTML).toBe(
          '<div><div class="qux"></div>quux<!--corge--></div><!---->',
        );
        expect(binding['_pendingResult']).toStrictEqual({
          children: [fragment],
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
        expect(part.anchorNode).toBe(null);
        expect(container.innerHTML).toBe('<!---->');
        expect(binding['_pendingResult']).toStrictEqual({
          children: [fragment],
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
      const part = {
        type: PART_TYPE_CHILD_NODE,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      } as const;
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
            new MockSlot(
              new MockBinding(MockPrimitive, values[0], {
                type: PART_TYPE_CHILD_NODE,
                node: fragment[0],
                anchorNode: null,
                namespaceURI: HTML_NAMESPACE_URI,
              }),
            ),
            new MockSlot(
              new MockBinding(MockPrimitive, values[1], {
                type: PART_TYPE_TEXT,
                node: fragment[1],
                precedingText: '',
                followingText: '',
              }),
            ),
            new MockSlot(
              new MockBinding(MockPrimitive, values[2], {
                type: PART_TYPE_ATTRIBUTE,
                node: fragment[2],
                name: 'class',
              }),
            ),
          ];
          for (const slot of slots) {
            slot.attach(session);
          }
          return {
            children: fragment,
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
        expect(part.anchorNode).toStrictEqual(fragment[0]);
        expect(container.innerHTML).toBe(
          '<!--foo-->bar<div class="baz"></div><!---->',
        );
        expect(binding['_pendingResult']).toStrictEqual({
          children: fragment,
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
        expect(part.anchorNode).toStrictEqual(fragment[0]);
        expect(container.innerHTML).toBe(
          '<!--qux-->quux<div class="corge"></div><!---->',
        );
        expect(binding['_pendingResult']).toStrictEqual({
          children: fragment,
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
        expect(part.anchorNode).toBe(null);
        expect(container.innerHTML).toBe('<!---->');
        expect(binding['_pendingResult']).toStrictEqual({
          children: fragment,
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
      const part = {
        type: PART_TYPE_CHILD_NODE,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      } as const;
      const binding = new TemplateBinding(template, values, part);
      const container = createElement('div', {}, 'foo', part.node);
      const scope = createScope();
      const targetTree = createTreeWalker(container);
      const updater = new TestUpdater(scope);

      const hydrateSpy = vi.spyOn(template, 'hydrate').mockReturnValue({
        children: [container.firstChild!],
        slots: [],
      });

      scope.boundary = {
        type: BOUNDARY_TYPE_HYDRATION,
        next: scope.boundary,
        targetTree,
      };

      updater.startUpdate((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(hydrateSpy).toHaveBeenCalledOnce();
      expect(hydrateSpy).toHaveBeenCalledWith(
        values,
        part,
        targetTree,
        expect.any(Object),
      );
      expect(part.anchorNode).toBe(container.firstChild);
      expect(container.innerHTML).toBe('foo<!---->');
    });
  });
});

describe('getNamespaceURIByTagName()', () => {
  it('returns the namespace URI from the tag name', () => {
    expect(getNamespaceURIByTagName('HTML')).toBe(HTML_NAMESPACE_URI);
    expect(getNamespaceURIByTagName('MATH')).toBe(MATH_NAMESPACE_URI);
    expect(getNamespaceURIByTagName('SVG')).toBe(SVG_NAMESPACE_URI);
    expect(getNamespaceURIByTagName('html')).toBe(HTML_NAMESPACE_URI);
    expect(getNamespaceURIByTagName('math')).toBe(MATH_NAMESPACE_URI);
    expect(getNamespaceURIByTagName('svg')).toBe(SVG_NAMESPACE_URI);
    expect(getNamespaceURIByTagName('div')).toBe(null);
  });
});
