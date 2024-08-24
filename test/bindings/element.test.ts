import { describe, expect, it, vi } from 'vitest';

import { PartType, UpdateContext } from '../../src/baseTypes.js';
import { ElementBinding } from '../../src/bindings/element.js';
import { EventBinding } from '../../src/bindings/event.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockBlock, MockRenderHost, TextDirective } from '../mocks.js';

describe('ElementBinding', () => {
  describe('.constructor()', () => {
    it('should construct a new ElementBinding', () => {
      const value = {};
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const binding = new ElementBinding(value, part);

      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.value).toBe(value);
    });

    it('should throw the error when a non-object value is passed', () => {
      expect(() => {
        new ElementBinding(null, {
          type: PartType.Element,
          node: document.createElement('div'),
        });
      }).toThrow('A value of ElementBinding must be an object,');
    });
  });

  describe('.value', () => {
    it('should throw the error when a non-object value is passed', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = {};
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const binding = new ElementBinding(value, part);

      expect(() => {
        binding.bind(null as any, context);
      }).toThrow('A value of ElementBinding must be an object,');
    });
  });

  describe('.connect()', () => {
    it('should bind element attributes', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = {
        class: 'foo',
        title: 'bar',
      };
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const binding = new ElementBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      expect(part.node.outerHTML).toBe('<div class="foo" title="bar"></div>');
    });

    it('should bind element properities by properities starting with "."', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = {
        '.className': 'foo',
        '.title': 'bar',
      };
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const binding = new ElementBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      expect(part.node.outerHTML).toBe('<div class="foo" title="bar"></div>');
    });

    it('should bind event listeners by properities starting with "@"', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = {
        '@click': () => {},
        '@touchstart': () => {},
      };
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const binding = new ElementBinding(value, part);

      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');

      binding.connect(context);
      context.flushUpdate();

      expect(part.node.outerHTML).toBe('<div></div>');
      expect(addEventListenerSpy).toHaveBeenCalledTimes(2);
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'click',
        expect.any(EventBinding),
      );
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'touchstart',
        expect.any(EventBinding),
      );
    });
  });

  describe('.bind()', () => {
    it('should skip properities with the same value as old one', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = {
        class: 'foo',
        title: 'bar',
      };
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const binding = new ElementBinding(value, part);

      const setAttributeSpy = vi.spyOn(part.node, 'setAttribute');

      binding.connect(context);
      context.flushUpdate();

      binding.bind(
        {
          class: 'foo', // the same value as old one
          title: 'baz',
        },
        context,
      );
      context.flushUpdate();

      expect(part.node.outerHTML).toBe('<div class="foo" title="baz"></div>');
      expect(setAttributeSpy).toHaveBeenCalledTimes(3);
      expect(setAttributeSpy).toHaveBeenNthCalledWith(1, 'class', 'foo');
      expect(setAttributeSpy).toHaveBeenNthCalledWith(2, 'title', 'bar');
      expect(setAttributeSpy).toHaveBeenNthCalledWith(3, 'title', 'baz');
    });

    it('should unbind bindings that no longer exists', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = {
        class: 'foo',
        title: 'bar',
      };
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const binding = new ElementBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      binding.bind({ class: undefined }, context);
      context.flushUpdate();

      expect(part.node.outerHTML).toBe('<div></div>');
    });

    it('should reconnect bindings if the new properities are the same as old ones', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = {
        class: 'foo',
        title: 'bar',
      };
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const binding = new ElementBinding(value, part);

      binding.connect(context);
      binding.disconnect(context);
      context.flushUpdate();

      expect(part.node.outerHTML).toBe('<div></div>');

      binding.bind(value, context);
      context.flushUpdate();

      expect(part.node.outerHTML).toBe('<div class="foo" title="bar"></div>');
    });
  });

  describe('.unbind()', () => {
    it('should unbind all bound properities', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = {
        class: 'foo',
        title: 'bar',
      };
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const binding = new ElementBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      binding.unbind(context);
      context.flushUpdate();

      expect(part.node.outerHTML).toBe('<div></div>');
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect all bound properities', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = {
        foo: new TextDirective(),
        bar: new TextDirective(),
      };
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const binding = new ElementBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      const disconnect1Spy = vi.spyOn(
        binding.bindings.get('foo')!,
        'disconnect',
      );
      const disconnect2Spy = vi.spyOn(
        binding.bindings.get('bar')!,
        'disconnect',
      );

      binding.disconnect(context);

      expect(disconnect1Spy).toHaveBeenCalledOnce();
      expect(disconnect2Spy).toHaveBeenCalledOnce();
    });
  });
});
