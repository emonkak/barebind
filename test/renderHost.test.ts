import { describe, expect, it, vi } from 'vitest';

import {
  CommitPhase,
  type Hook,
  HookType,
  PartType,
  type TemplateResult,
  createUpdateQueue,
  literal,
} from '../src/baseTypes.js';
import { AttributeBinding } from '../src/bindings/attributeBinding.js';
import { ElementBinding } from '../src/bindings/elementBinding.js';
import { EventBinding } from '../src/bindings/eventBinding.js';
import { NodeBinding } from '../src/bindings/nodeBinding.js';
import { PropertyBinding } from '../src/bindings/propertyBinding.js';
import { LiteralProcessor } from '../src/literalProcessor.js';
import type { RenderContext } from '../src/renderContext.js';
import { ClientRenderHost } from '../src/renderHost.js';
import { EmptyTemplate } from '../src/templates/emptyTemplate.js';
import { LazyTemplate } from '../src/templates/lazyTemplate.js';
import { TaggedTemplate } from '../src/templates/taggedTemplate.js';
import { UnsafeTemplate } from '../src/templates/unsafeTemplate.js';
import { TextTemplate } from '../src/templates/valueTemplate.js';
import { ChildTemplate } from '../src/templates/valueTemplate.js';
import { SyncUpdater } from '../src/updaters/syncUpdater.js';
import { MockBlock, MockTemplate, TextDirective } from './mocks.js';

const CONTINUOUS_EVENT_TYPES: (keyof DocumentEventMap)[] = [
  'drag',
  'dragenter',
  'dragleave',
  'dragover',
  'mouseenter',
  'mouseleave',
  'mousemove',
  'mouseout',
  'mouseover',
  'pointerenter',
  'pointerleave',
  'pointermove',
  'pointerout',
  'pointerover',
  'scroll',
  'touchmove',
  'wheel',
];

describe('ClientRenderHost', () => {
  describe('.beginRender()', () => {
    it('should create a new MockRenderContext', () => {
      const result: TemplateResult<readonly [], RenderContext> = {
        template: new MockTemplate(),
        data: [],
      };
      const props = {};
      const type = vi.fn(() => result);
      const hooks: Hook[] = [];
      const host = new ClientRenderHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const queue = createUpdateQueue();

      expect(
        host.flushComponent(type, props, hooks, updater, block, queue),
      ).toBe(result);
      expect(type).toHaveBeenCalledOnce();
      expect(type).toHaveBeenCalledWith(
        props,
        expect.objectContaining({
          hooks,
          updater,
          block,
          queue,
        }),
      );
      expect(hooks).toStrictEqual([{ type: HookType.Finalizer }]);
    });
  });

  describe('.createRoot()', () => {
    it('should mount a value inside the container', async () => {
      const container = document.createElement('div');
      const host = new ClientRenderHost();
      const updater = new SyncUpdater();

      const value1 = new TextDirective('foo');
      const value2 = new TextDirective('bar');

      const flushUpdateSpy = vi.spyOn(updater, 'flushUpdate');

      const root = host.createRoot(value1, container, updater);
      root.mount();
      await updater.waitForUpdate();

      expect(container.innerHTML).toBe('foo<!--TextDirective-->');
      expect(flushUpdateSpy).toHaveBeenCalled();

      root.update(value2);
      await updater.waitForUpdate();

      expect(container.innerHTML).toBe('bar<!--TextDirective-->');
      expect(flushUpdateSpy).toHaveBeenCalledTimes(2);

      root.unmount();
      await updater.waitForUpdate();

      expect(container.innerHTML).toBe('');
      expect(flushUpdateSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('.flushEffects()', () => {
    it('should perform given effects', () => {
      const host = new ClientRenderHost();
      const effect1 = {
        commit: vi.fn(),
      };
      const effect2 = {
        commit: vi.fn(),
      };
      host.flushEffects([effect1, effect2], CommitPhase.Passive);

      expect(effect1.commit).toHaveBeenCalledOnce();
      expect(effect1.commit).toHaveBeenCalledWith(CommitPhase.Passive);
      expect(effect2.commit).toHaveBeenCalledOnce();
      expect(effect2.commit).toHaveBeenCalledWith(CommitPhase.Passive);
    });
  });

  describe('.getCurrentPriority()', () => {
    it('should return "user-visible" if there is no current event', () => {
      const host = new ClientRenderHost();

      vi.spyOn(globalThis, 'event', 'get').mockReturnValue(undefined);

      expect(host.getCurrentPriority()).toBe('user-visible');
    });

    it('should return "user-blocking" if the current event is not continuous', () => {
      const host = new ClientRenderHost();

      const eventMock = vi
        .spyOn(globalThis, 'event', 'get')
        .mockReturnValue(new MouseEvent('click'));

      expect(host.getCurrentPriority()).toBe('user-blocking');
      expect(eventMock).toHaveBeenCalled();
    });

    it.each(CONTINUOUS_EVENT_TYPES)(
      'should return "user-visible" if the current event is continuous',
      (eventType) => {
        const host = new ClientRenderHost();

        const eventMock = vi
          .spyOn(globalThis, 'event', 'get')
          .mockReturnValue(new CustomEvent(eventType));

        expect(host.getCurrentPriority()).toBe('user-visible');
        expect(eventMock).toHaveBeenCalled();
      },
    );
  });

  describe('.getHostName()', () => {
    it('should return the unpredictable host name', () => {
      expect(
        new ClientRenderHost({
          hostName: '__test__',
        }).getHostName(),
      ).toBe('__test__');
      expect(new ClientRenderHost().getHostName()).toMatch(/^[0-9a-z]+$/);
    });
  });

  describe('.getTemplate()', () => {
    it('should create a TaggedTemplate representing HTML fragment', () => {
      const host = new ClientRenderHost();
      const { strings, values } = tmpl`<div>${'Hello'}, ${'World'}!</div>`;
      const template = host.getTemplate(
        strings,
        values,
        'html',
      ) as LazyTemplate<any, RenderContext>;

      expect(template).toBeInstanceOf(LazyTemplate);

      const innerTemplate = template.templateFactory() as TaggedTemplate<
        unknown[]
      >;

      expect(innerTemplate).toBeInstanceOf(TaggedTemplate);
      expect(innerTemplate.holes).toStrictEqual([
        { type: PartType.Node, index: 1 },
        { type: PartType.Node, index: 3 },
      ]);
      expect(innerTemplate.element.innerHTML).toBe('<div>, !</div>');
      expect(
        innerTemplate.element.content.firstElementChild?.namespaceURI,
      ).toBe('http://www.w3.org/1999/xhtml');
    });

    it('should create a TaggedTemplate representing MathML fragment', () => {
      const host = new ClientRenderHost();
      const { strings, values } = tmpl`<msup><mi>${0}</mi><mn>${1}</mn></msup>`;
      const template = host.getTemplate(
        strings,
        values,
        'math',
      ) as LazyTemplate<any, RenderContext>;

      expect(template).toBeInstanceOf(LazyTemplate);

      const innerTemplate = template.templateFactory() as TaggedTemplate<
        unknown[]
      >;

      expect(innerTemplate).toBeInstanceOf(TaggedTemplate);
      expect(innerTemplate.holes).toStrictEqual([
        { type: PartType.Node, index: 2 },
        { type: PartType.Node, index: 4 },
      ]);
      expect(innerTemplate.element.innerHTML).toBe(
        '<msup><mi></mi><mn></mn></msup>',
      );
      expect(
        innerTemplate.element.content.firstElementChild?.namespaceURI,
      ).toBe('http://www.w3.org/1998/Math/MathML');
    });

    it('should create a TaggedTemplate representing SVG fragment', () => {
      const host = new ClientRenderHost();
      const { strings, values } = tmpl`<text>${'Hello'}, ${'World'}!</text>`;
      const template = host.getTemplate(strings, values, 'svg') as LazyTemplate<
        any,
        RenderContext
      >;

      expect(template).toBeInstanceOf(LazyTemplate);

      const innerTemplate = template.templateFactory() as TaggedTemplate<
        unknown[]
      >;

      expect(innerTemplate).toBeInstanceOf(TaggedTemplate);
      expect(innerTemplate.holes).toStrictEqual([
        { type: PartType.Node, index: 1 },
        { type: PartType.Node, index: 3 },
      ]);
      expect(innerTemplate.element.innerHTML).toBe('<text>, !</text>');
      expect(
        innerTemplate.element.content.firstElementChild?.namespaceURI,
      ).toBe('http://www.w3.org/2000/svg');
    });

    it.each([[tmpl``], [tmpl` `]])(
      'should create a EmptyTemplate if there is no contents',
      ({ strings, values }) => {
        const host = new ClientRenderHost();
        const template = host.getTemplate(strings, values, 'html');

        expect(template).toBeInstanceOf(EmptyTemplate);
      },
    );

    it.each([
      [tmpl`<${'foo'}>`],
      [tmpl`<${'foo'}/>`],
      [tmpl` <${'foo'} /> `],
      [tmpl` <!--${'foo'}--> `],
      [tmpl` <!-- ${'foo'} --> `],
    ])(
      'should create a ChildTemplate if there is a only child value',
      ({ strings, values }) => {
        const host = new ClientRenderHost();
        const template = host.getTemplate(strings, values, 'html');

        expect(template).toBeInstanceOf(ChildTemplate);
      },
    );

    it.each([[tmpl`${'foo'}`], [tmpl` ${'foo'} `]])(
      'should create a TextTemplate if there is a only text value',
      ({ strings, values }) => {
        const host = new ClientRenderHost();
        const template = host.getTemplate(strings, values, 'html');

        expect(template).toBeInstanceOf(TextTemplate);
      },
    );

    it('should get a template from the cache if avaiable', () => {
      const host = new ClientRenderHost();
      const { strings, values } = tmpl`<div>Hello, ${'World'}!</div>`;
      const template = host.getTemplate(strings, values, 'html');

      expect(template).toBeInstanceOf(LazyTemplate);
      expect(template).toBe(host.getTemplate(strings, values, 'html'));
    });
  });

  describe('.getScopedValue()', () => {
    it('should get a scoped value from the block scope', () => {
      const host = new ClientRenderHost({});
      const block = new MockBlock();

      host.setScopedValue('foo', 456, block);
      expect(host.getScopedValue('foo', block)).toBe(456);

      host.setScopedValue('foo', 789, block);
      expect(host.getScopedValue('foo', block)).toBe(789);
    });

    it('should get a scoped value from the parent block scope', () => {
      const host = new ClientRenderHost({});
      const parent = new MockBlock();
      const block = new MockBlock(parent);

      host.setScopedValue('foo', 456, parent);

      expect(host.getScopedValue('foo', block)).toBe(456);
    });
  });

  describe('.getUnsafeTemplate()', () => {
    it('should create a template by raw document string', () => {
      const host = new ClientRenderHost();
      const content = '<div>foo</div>';
      const template = host.getUnsafeTemplate(content, 'html');

      expect(template).toStrictEqual(new UnsafeTemplate(content, 'html'));
    });
  });

  describe('.processLiterals()', () => {
    it('should process literals by LiteralProcessor', () => {
      const literalProcessor = new LiteralProcessor();
      const host = new ClientRenderHost({
        literalProcessor,
      });

      const processLiteralsSpy = vi.spyOn(host, 'processLiterals');

      const { strings, values } =
        tmpl`<${literal('div')}>${'foo'}</${literal('div')}>`;
      const template = host.processLiterals(strings, values);

      expect(template.strings).toStrictEqual(['<div>', '</div>']);
      expect(template.values).toStrictEqual(['foo']);
      expect(processLiteralsSpy).toHaveBeenCalledOnce();
      expect(processLiteralsSpy).toHaveBeenCalledWith(
        ['<', '>', '</', '>'],
        [literal('div'), 'foo', literal('div')],
      );
    });
  });

  describe('.resolveBinding()', () => {
    it('should resolve the value as an AttributeBinding if the part is a AttributePart', () => {
      const host = new ClientRenderHost();
      const value = 'foo';
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'class',
      } as const;
      const binding = host.resolveBinding(value, part);

      expect(binding).toBeInstanceOf(AttributeBinding);
      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
    });

    it('should resolve the value as an EventBinding if the part is a EventPart', () => {
      const host = new ClientRenderHost();
      const value = vi.fn();
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'hello',
      } as const;
      const binding = host.resolveBinding(value, part);

      expect(binding).toBeInstanceOf(EventBinding);
      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
    });

    it('should resolve the value as a PropertyBinding if the part is a PropertyPart', () => {
      const host = new ClientRenderHost();
      const value = 'foo';
      const part = {
        type: PartType.Property,
        node: document.createElement('div'),
        name: 'className',
      } as const;
      const binding = host.resolveBinding(value, part);

      expect(binding).toBeInstanceOf(PropertyBinding);
      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
    });

    it('should resolve the value as a NodeBinding if the part is a NodePart', () => {
      const host = new ClientRenderHost();
      const value = 'foo';
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const binding = host.resolveBinding(value, part);

      expect(binding).toBeInstanceOf(NodeBinding);
      expect(binding.value).toBe(value);
    });

    it('should resolve the value as a NodeBinding if the part is a ChildNodePart', () => {
      const host = new ClientRenderHost();
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = host.resolveBinding(value, part);

      expect(binding).toBeInstanceOf(NodeBinding);
      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
    });

    it('should resolve the value as an ElementBinding if the part is a ElementPart', () => {
      const host = new ClientRenderHost();
      const value = {
        class: 'foo',
        title: 'bar',
      };
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const binding = host.resolveBinding(value, part);

      expect(binding).toBeInstanceOf(ElementBinding);
      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
    });
  });

  describe('.nextIdentifier()', () => {
    it('should return a next identifier', async () => {
      const host = new ClientRenderHost();

      expect(host.nextIdentifier()).toBe(1);
      expect(host.nextIdentifier()).toBe(2);
      expect(host.nextIdentifier()).toBe(3);
    });
  });
});

function tmpl<TData extends readonly any[]>(
  strings: TemplateStringsArray,
  ...values: TData
): { strings: TemplateStringsArray; values: TData } {
  return { strings, values };
}
