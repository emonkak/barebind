import { describe, expect, it, vi } from 'vitest';

import {
  CommitPhase,
  type Hook,
  HookType,
  PartType,
  createUpdateQueue,
} from '../src/baseTypes.js';
import { AttributeBinding } from '../src/bindings/attribute.js';
import { ElementBinding } from '../src/bindings/element.js';
import { EventBinding } from '../src/bindings/event.js';
import { NodeBinding } from '../src/bindings/node.js';
import { PropertyBinding } from '../src/bindings/property.js';
import { ClientRenderHost } from '../src/renderHost.js';
import { LazyTemplate } from '../src/templates/lazyTemplate.js';
import { TaggedTemplate } from '../src/templates/taggedTemplate.js';
import { SyncUpdater } from '../src/updater/syncUpdater.js';
import { MockBlock, TextDirective } from './mocks.js';

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
      const host = new ClientRenderHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const queue = createUpdateQueue();
      const hooks: Hook[] = [];

      const context = host.beginRender(updater, block, queue, hooks);

      host.finishRender(context);

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

  describe('.getHTMLTemplate()', () => {
    it('should create a TaggedTemplate representing HTML fragment', () => {
      const host = new ClientRenderHost();
      const [strings, data] = tmpl`<div>Hello, ${'World'}!</div>`;
      const lazyTemplate = host.getHTMLTemplate(strings, data) as LazyTemplate<
        unknown,
        unknown
      >;

      expect(lazyTemplate).toBeInstanceOf(LazyTemplate);

      const template = lazyTemplate.templateFactory() as TaggedTemplate<
        unknown[]
      >;

      expect(template).toBeInstanceOf(TaggedTemplate);
      expect(template.holes).toStrictEqual([{ type: PartType.Node, index: 2 }]);
      expect(template.element.innerHTML).toBe('<div>Hello, !</div>');
      expect(template.element.content.firstElementChild?.namespaceURI).toBe(
        'http://www.w3.org/1999/xhtml',
      );
    });

    it('should get a template from the cache if avaiable', () => {
      const host = new ClientRenderHost();
      const [strings, data] = tmpl`<div>Hello, ${'World'}!</div>`;
      const template = host.getHTMLTemplate(strings, data);

      expect(template).toBe(host.getHTMLTemplate(strings, data));
    });
  });

  describe('.getSVGTemplate()', () => {
    it('should create a template representing SVG fragment', () => {
      const host = new ClientRenderHost();
      const [strings, data] = tmpl`<text>Hello, ${'World'}!</text>`;
      const lazyTemplate = host.getSVGTemplate(strings, data) as LazyTemplate<
        unknown[],
        unknown
      >;

      expect(lazyTemplate).toBeInstanceOf(LazyTemplate);

      const template = lazyTemplate.templateFactory() as TaggedTemplate<
        unknown[]
      >;

      expect(template).toBeInstanceOf(TaggedTemplate);
      expect(template.holes).toStrictEqual([{ type: PartType.Node, index: 2 }]);
      expect(template.element.innerHTML).toBe('<text>Hello, !</text>');
      expect(template.element.content.firstElementChild?.namespaceURI).toBe(
        'http://www.w3.org/2000/svg',
      );
    });

    it('should get a template from the cache if avaiable', () => {
      const host = new ClientRenderHost();
      const [strings, data] = tmpl`<div>Hello, ${'World'}!</div>`;
      const template = host.getSVGTemplate(strings, data);

      expect(template).toBe(host.getSVGTemplate(strings, data));
    });
  });

  describe('.getScopedValue()', () => {
    it('should get a scoped value from constants', () => {
      const host = new ClientRenderHost({ constants: new Map([['foo', 123]]) });
      const block = new MockBlock();

      expect(host.getScopedValue('foo')).toBe(123);
      expect(host.getScopedValue('foo', block)).toBe(123);
    });

    it('should get a scoped value from the block scope', () => {
      const host = new ClientRenderHost({ constants: new Map([['foo', 123]]) });
      const block = new MockBlock();

      host.setScopedValue('foo', 456, block);
      expect(host.getScopedValue('foo', block)).toBe(456);

      host.setScopedValue('foo', 789, block);
      expect(host.getScopedValue('foo', block)).toBe(789);
    });

    it('should get a scoped value from the parent block scope', () => {
      const host = new ClientRenderHost({ constants: new Map([['foo', 123]]) });
      const parent = new MockBlock();
      const block = new MockBlock(parent);

      host.setScopedValue('foo', 456, parent);

      expect(host.getScopedValue('foo', block)).toBe(456);
    });
  });

  describe('.getUnsafeHTMLTemplate()', () => {
    it('should create a template representing raw HTML string', () => {
      const host = new ClientRenderHost();
      const content = '<div>foo</div>';
      const template = host.getUnsafeHTMLTemplate(content);

      expect(template.content).toBe(content);
    });
  });

  describe('.getUnsafeSVGTemplate()', () => {
    it('should create a template representing raw SVG string', () => {
      const host = new ClientRenderHost();
      const content = '<text>foo</text>';
      const template = host.getUnsafeSVGTemplate(content);

      expect(template.content).toBe(content);
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

function tmpl(
  strings: TemplateStringsArray,
  ...data: unknown[]
): [TemplateStringsArray, unknown[]] {
  return [strings, data];
}
