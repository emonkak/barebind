import { describe, expect, it, vi } from 'vitest';
import { createHydrationTree } from '@/hydration.js';
import { HydrationError, PartType } from '@/internal.js';
import {
  getNamespaceURIByTagName,
  HTML_NAMESPACE_URI,
  MATH_NAMESPACE_URI,
  SVG_NAMESPACE_URI,
  TemplateBinding,
} from '@/template/template.js';
import {
  MockBinding,
  MockPrimitive,
  MockSlot,
  MockTemplate,
} from '../../mocks.js';
import {
  createElement,
  createRuntime,
  UpdateHelper,
} from '../../test-helpers.js';

describe('AbstractTemplate', () => {
  describe('name', () => {
    it('return the constructor name', () => {
      const template = new MockTemplate();

      expect(template.name, 'MockTemplate');
    });
  });

  describe('resolveBinding()', () => {
    it('constructs a new TemplateBinding', () => {
      const template = new MockTemplate();
      const binds = ['foo'] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const context = createRuntime();
      const binding = template.resolveBinding(binds, part, context);

      expect(binding.type).toBe(template);
      expect(binding.value).toBe(binds);
      expect(binding.part).toBe(part);
    });

    it('should throw the error if the part is not child part', () => {
      const template = new MockTemplate();
      const binds = ['foo'] as const;
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      };
      const context = createRuntime();

      expect(() => template.resolveBinding(binds, part, context)).toThrow(
        'MockTemplate must be used in a child node part,',
      );
    });
  });
});

describe('TemplateBinding', () => {
  describe('shouldBind()', () => {
    it('returns true if the committed result does not exist', () => {
      const template = new MockTemplate();
      const binds = [] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
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
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new TemplateBinding(template, binds1, part);
      const helper = new UpdateHelper();

      SESSION: {
        helper.startSession((context) => {
          binding.connect(context);
          binding.commit();
        });

        expect(binding.shouldBind(binds1)).toBe(false);
        expect(binding.shouldBind(binds2)).toBe(true);
      }
    });
  });

  describe('hydrate()', () => {
    it('hydrates the template', () => {
      const template = new MockTemplate();
      const binds = [] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new TemplateBinding(template, binds, part);
      const container = createElement('div', {}, 'foo', part.node);
      const target = createHydrationTree(container);
      const helper = new UpdateHelper();

      const hydrateSpy = vi.spyOn(template, 'hydrate').mockReturnValue({
        childNodes: [container.firstChild!],
        slots: [],
      });

      helper.startSession((context) => {
        binding.hydrate(target, context);
        binding.commit();
      });

      expect(hydrateSpy).toHaveBeenCalledOnce();
      expect(hydrateSpy).toHaveBeenCalledWith(
        binds,
        part,
        target,
        expect.any(Object),
      );
      expect(part.anchorNode).toBe(container.firstChild);
      expect(container.innerHTML).toBe('foo<!---->');
    });

    it('should throw the error if the template has already been rendered', () => {
      const template = new MockTemplate();
      const binds = [] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new TemplateBinding(template, binds, part);
      const container = document.createElement('div');
      const target = createHydrationTree(container);
      const helper = new UpdateHelper();

      helper.startSession((context) => {
        binding.connect(context);
        binding.commit();
      });

      expect(() => {
        helper.startSession((context) => {
          binding.hydrate(target, context);
        });
      }).toThrow(HydrationError);
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
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new TemplateBinding(template, binds1, part);
      const helper = new UpdateHelper();

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
        .mockImplementation((binds, _part, context) => {
          const slots = [
            new MockSlot(
              new MockBinding(MockPrimitive, binds[0], {
                type: PartType.Attribute,
                node: fragment.firstChild as Element,
                name: 'class',
              }),
            ),
            new MockSlot(
              new MockBinding(MockPrimitive, binds[1], {
                type: PartType.Text,
                node: fragment.firstChild!.nextSibling as Text,
                precedingText: '',
                followingText: '',
              }),
            ),
            new MockSlot(
              new MockBinding(MockPrimitive, binds[2], {
                type: PartType.ChildNode,
                node: fragment.firstChild!.nextSibling!.nextSibling as Comment,
                anchorNode: null,
                namespaceURI: HTML_NAMESPACE_URI,
              }),
            ),
          ];
          for (const slot of slots) {
            slot.connect(context);
          }
          return { childNodes: [fragment], slots };
        });

      SESSION1: {
        helper.startSession((context) => {
          binding.connect(context);
          binding.commit();
        });

        expect(renderSpy).toHaveBeenCalledOnce();
        expect(renderSpy).toHaveBeenCalledWith(
          binds1,
          part,
          expect.any(Object),
        );
        expect(part.anchorNode).toBe(fragment);
        expect(container.innerHTML).toBe(
          '<div><div class="foo"></div>bar<!--baz--></div><!---->',
        );
        expect(binding['_pendingResult']).toStrictEqual({
          childNodes: [fragment],
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
      }

      SESSION2: {
        helper.startSession((context) => {
          binding.value = binds2;
          binding.connect(context);
          binding.commit();
        });

        expect(renderSpy).toHaveBeenCalledOnce();
        expect(part.anchorNode).toBe(fragment);
        expect(container.innerHTML).toBe(
          '<div><div class="qux"></div>quux<!--corge--></div><!---->',
        );
        expect(binding['_pendingResult']).toStrictEqual({
          childNodes: [fragment],
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
      }

      SESSION3: {
        helper.startSession((context) => {
          binding.disconnect(context);
          binding.rollback();
        });

        expect(renderSpy).toHaveBeenCalledOnce();
        expect(part.anchorNode).toBe(null);
        expect(container.innerHTML).toBe('<!---->');
        expect(binding['_pendingResult']).toStrictEqual({
          childNodes: [fragment],
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
      }
    });

    it('renders a template with multiple root nodes', () => {
      const template = new MockTemplate();
      const binds1 = ['foo', 'bar', 'baz'];
      const binds2 = ['qux', 'quux', 'corge'];
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new TemplateBinding(template, binds1, part);
      const helper = new UpdateHelper();

      const container = createElement('div', {}, part.node);
      const fragment = [
        document.createComment(''),
        document.createTextNode(''),
        document.createElement('div'),
      ] as const;

      const renderSpy = vi
        .spyOn(template, 'render')
        .mockImplementation((binds, _part, context) => {
          const slots = [
            new MockSlot(
              new MockBinding(MockPrimitive, binds[0], {
                type: PartType.ChildNode,
                node: fragment[0],
                anchorNode: null,
                namespaceURI: HTML_NAMESPACE_URI,
              }),
            ),
            new MockSlot(
              new MockBinding(MockPrimitive, binds[1], {
                type: PartType.Text,
                node: fragment[1],
                precedingText: '',
                followingText: '',
              }),
            ),
            new MockSlot(
              new MockBinding(MockPrimitive, binds[2], {
                type: PartType.Attribute,
                node: fragment[2],
                name: 'class',
              }),
            ),
          ];
          for (const slot of slots) {
            slot.connect(context);
          }
          return {
            childNodes: fragment,
            slots,
          };
        });

      SESSION1: {
        helper.startSession((context) => {
          binding.connect(context);
          binding.commit();
        });

        expect(renderSpy).toHaveBeenCalledOnce();
        expect(renderSpy).toHaveBeenCalledWith(
          binds1,
          part,
          expect.any(Object),
        );
        expect(part.anchorNode).toStrictEqual(fragment[0]);
        expect(container.innerHTML).toBe(
          '<!--foo-->bar<div class="baz"></div><!---->',
        );
        expect(binding['_pendingResult']).toStrictEqual({
          childNodes: fragment,
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
      }

      SESSION2: {
        helper.startSession((context) => {
          binding.value = binds2;
          binding.connect(context);
          binding.commit();
        });

        expect(renderSpy).toHaveBeenCalledOnce();
        expect(part.anchorNode).toStrictEqual(fragment[0]);
        expect(container.innerHTML).toBe(
          '<!--qux-->quux<div class="corge"></div><!---->',
        );
        expect(binding['_pendingResult']).toStrictEqual({
          childNodes: fragment,
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
      }

      SESSION3: {
        helper.startSession((context) => {
          binding.disconnect(context);
          binding.rollback();
        });

        expect(renderSpy).toHaveBeenCalledOnce();
        expect(part.anchorNode).toBe(null);
        expect(container.innerHTML).toBe('<!---->');
        expect(binding['_pendingResult']).toStrictEqual({
          childNodes: fragment,
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
      }
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
