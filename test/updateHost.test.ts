import { describe, expect, it, vi } from 'vitest';

import {
  CommitPhase,
  type Hook,
  HookType,
  PartType,
  createUpdateQueue,
  directiveTag,
} from '../src/baseTypes.js';
import { Root } from '../src/root.js';
import { UpdateHost } from '../src/updateHost.js';
import { SyncUpdater } from '../src/updater/syncUpdater.js';
import { MockBlock, TextBinding, TextDirective } from './mocks.js';

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

describe('UpdateHost', () => {
  describe('.beginRender()', () => {
    it('should create a new MockRenderContext', () => {
      const host = new UpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const queue = createUpdateQueue();
      const hooks: Hook[] = [];

      const context = host.beginRender(updater, block, queue, hooks);

      host.finishRender(context);

      expect(hooks).toStrictEqual([{ type: HookType.Finalizer }]);
    });
  });

  describe('.flushEffects()', () => {
    it('should perform given effects', () => {
      const host = new UpdateHost();
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
      const host = new UpdateHost();

      vi.spyOn(globalThis, 'event', 'get').mockReturnValue(undefined);

      expect(host.getCurrentPriority()).toBe('user-visible');
    });

    it('should return "user-blocking" if the current event is not continuous', () => {
      const host = new UpdateHost();

      const eventMock = vi
        .spyOn(globalThis, 'event', 'get')
        .mockReturnValue(new MouseEvent('click'));

      expect(host.getCurrentPriority()).toBe('user-blocking');
      expect(eventMock).toHaveBeenCalled();
    });

    it.each(CONTINUOUS_EVENT_TYPES)(
      'should return "user-visible" if the current event is continuous',
      (eventType) => {
        const host = new UpdateHost();

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
        new UpdateHost({
          name: '__test__',
        }).getHostName(),
      ).toBe('__test__');
      expect(new UpdateHost().getHostName()).toMatch(/^[0-9a-z]+$/);
    });
  });

  describe('.getHTMLTemplate()', () => {
    it('should create a HTML template from tokens', () => {
      const host = new UpdateHost();
      const [tokens, data] = tmpl`<div>Hello, ${'World'}!</div>`;
      const template = host.getHTMLTemplate(tokens, data);

      expect(template.holes).toStrictEqual([{ type: PartType.Node, index: 2 }]);
      expect(template.element.innerHTML).toBe('<div>Hello, !</div>');
    });

    it('should get a HTML template from cache if avaiable', () => {
      const host = new UpdateHost();
      const [tokens, data] = tmpl`<div>Hello, ${'World'}!</div>`;
      const template = host.getHTMLTemplate(tokens, data);

      expect(template).toBe(host.getHTMLTemplate(tokens, data));
    });
  });

  describe('.getSVGTemplate()', () => {
    it('should create a SVG template from tokens', () => {
      const host = new UpdateHost();
      const [tokens, data] = tmpl`<text>Hello, ${'World'}!</text>`;
      const template = host.getSVGTemplate(tokens, data);

      expect(template.holes).toStrictEqual([{ type: PartType.Node, index: 2 }]);
      expect(template.element.innerHTML).toBe('<text>Hello, !</text>');
      expect(template.element.content.firstElementChild?.namespaceURI).toBe(
        'http://www.w3.org/2000/svg',
      );
    });

    it('should get a SVG template from cache if avaiable', () => {
      const host = new UpdateHost();
      const [tokens, data] = tmpl`<div>Hello, ${'World'}!</div>`;
      const template = host.getSVGTemplate(tokens, data);

      expect(template).toBe(host.getSVGTemplate(tokens, data));
    });
  });

  describe('.getScopedValue()', () => {
    it('should get a scoped value from constants', () => {
      const host = new UpdateHost({ constants: new Map([['foo', 123]]) });
      const block = new MockBlock();

      expect(host.getScopedValue('foo')).toBe(123);
      expect(host.getScopedValue('foo', block)).toBe(123);
    });

    it('should get a scoped value from the block scope', () => {
      const host = new UpdateHost({ constants: new Map([['foo', 123]]) });
      const block = new MockBlock();

      host.setScopedValue('foo', 456, block);
      expect(host.getScopedValue('foo', block)).toBe(456);

      host.setScopedValue('foo', 789, block);
      expect(host.getScopedValue('foo', block)).toBe(789);
    });

    it('should get a scoped value from the parent block scope', () => {
      const host = new UpdateHost({ constants: new Map([['foo', 123]]) });
      const parent = new MockBlock();
      const block = new MockBlock(parent);

      host.setScopedValue('foo', 456, parent);

      expect(host.getScopedValue('foo', block)).toBe(456);
    });
  });

  describe('.mount()', () => {
    it('should mount a non root value inside the container', async () => {
      const container = document.createElement('div');
      const host = new UpdateHost();
      const updater = new SyncUpdater();

      const value = new TextDirective('foo');

      const directiveSpy = vi.spyOn(value, directiveTag);
      const flushUpdateSpy = vi.spyOn(updater, 'flushUpdate');

      const binding = host.mount(value, container, updater);

      expect(binding).toBeInstanceOf(TextBinding);
      expect(directiveSpy).toHaveBeenCalledOnce();
      expect(flushUpdateSpy).toHaveBeenCalled();

      await updater.waitForUpdate();

      expect(container.innerHTML).toBe('foo<!--TextDirective-->');
    });

    it('should mount a root value inside the container', async () => {
      const container = document.createElement('div');
      const host = new UpdateHost();
      const updater = new SyncUpdater();

      const value = new TextDirective('foo');

      const directiveSpy = vi
        .spyOn(value, directiveTag)
        .mockImplementation(function (this: typeof value, part, context) {
          return new Root(new TextBinding(this, part), context);
        });
      const flushUpdateSpy = vi.spyOn(updater, 'flushUpdate');

      const binding = host.mount(value, container, updater);

      expect(binding).toBeInstanceOf(Root);
      expect(binding.value).toBe(value);
      expect(directiveSpy).toHaveBeenCalledOnce();
      expect(flushUpdateSpy).toHaveBeenCalled();

      await updater.waitForUpdate();

      expect(container.innerHTML).toBe('foo<!--TextDirective-->');
    });
  });

  describe('.nextIdentifier()', () => {
    it('should return a next identifier', async () => {
      const host = new UpdateHost();

      expect(host.nextIdentifier()).toBe(1);
      expect(host.nextIdentifier()).toBe(2);
      expect(host.nextIdentifier()).toBe(3);
    });
  });
});

function tmpl(
  tokens: TemplateStringsArray,
  ...data: unknown[]
): [TemplateStringsArray, unknown[]] {
  return [tokens, data];
}
