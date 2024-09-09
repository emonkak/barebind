import { describe, expect, it, vi } from 'vitest';

import { PartType, UpdateContext } from '../../src/baseTypes.js';
import { EventBinding } from '../../src/bindings/event.js';
import { SyncUpdater } from '../../src/updaters/syncUpdater.js';
import { MockBlock, MockRenderHost } from '../mocks.js';

describe('EventBinding', () => {
  describe('.constructor()', () => {
    it('should construct a new EventBinding', () => {
      const value = () => {};
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'hello',
      } as const;
      const binding = new EventBinding(value, part);

      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.value).toBe(value);
    });

    it('should throw the error if the value other than an event listner is passed', () => {
      expect(() => {
        new EventBinding(
          {},
          {
            type: PartType.Event,
            node: document.createElement('div'),
            name: 'hello',
          },
        );
      }).toThrow(
        'A value of EventBinding must be EventListener, EventListenerObject, null or undefined.',
      );
    });
  });

  describe('.connect()', () => {
    it('should do nothing if the update is already scheduled', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = () => {};
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'click',
      } as const;
      const binding = new EventBinding(value, part);

      const enqueueMutationEffectSpy = vi.spyOn(
        context,
        'enqueueMutationEffect',
      );

      binding.connect(context);
      binding.connect(context);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });
  });

  describe('.bind()', () => {
    it('should connect the function to the element as an event listener', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value1 = vi.fn();
      const value2 = vi.fn();
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'hello',
      } as const;
      const event = new CustomEvent('hello');
      const binding = new EventBinding(value1, part);

      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');

      binding.connect(context);
      context.flushUpdate();
      part.node.dispatchEvent(event);

      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(addEventListenerSpy).toHaveBeenCalledWith('hello', binding);
      expect(value1).toHaveBeenCalledOnce();
      expect(value1).toHaveBeenCalledWith(event);
      expect(value2).not.toHaveBeenCalled();

      binding.bind(value2, context);
      context.flushUpdate();
      part.node.dispatchEvent(event);

      expect(value1).toHaveBeenCalledOnce();
      expect(value2).toHaveBeenCalledWith(event);
    });

    it('should connect the object to the element as an event listener', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value1 = {
        capture: true,
        handleEvent: vi.fn(),
      };
      const value2 = {
        capture: false,
        handleEvent: vi.fn(),
      };
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'hello',
      } as const;
      const event = new CustomEvent('hello');
      const binding = new EventBinding(value1, part);

      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(part.node, 'removeEventListener');

      binding.connect(context);
      context.flushUpdate();
      part.node.dispatchEvent(event);

      expect(addEventListenerSpy).toHaveBeenCalledTimes(1);
      expect(addEventListenerSpy).toHaveBeenLastCalledWith(
        'hello',
        binding,
        value1,
      );
      expect(value1.handleEvent).toHaveBeenCalledOnce();
      expect(value1.handleEvent).toHaveBeenCalledWith(event);
      expect(value2.handleEvent).not.toHaveBeenCalled();

      binding.bind(value2, context);
      context.flushUpdate();
      part.node.dispatchEvent(event);

      expect(addEventListenerSpy).toHaveBeenCalledTimes(2);
      expect(addEventListenerSpy).toHaveBeenLastCalledWith(
        'hello',
        binding,
        value2,
      );
      expect(removeEventListenerSpy).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'hello',
        binding,
        value1,
      );
      expect(value2.handleEvent).toHaveBeenCalledOnce();
      expect(value2.handleEvent).toHaveBeenCalledWith(event);
    });

    it('should not connect the event listener if the new and current listeners are the same', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = () => {};
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'hello',
      } as const;
      const binding = new EventBinding(value, part);

      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(part.node, 'removeEventListener');

      binding.connect(context);
      context.flushUpdate();

      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).not.toHaveBeenCalled();

      binding.bind(value, context);

      expect(context.isPending()).toBe(false);
    });

    it.each([[null], [undefined]])(
      'should unbind the active event listener when null or undefined is passed',
      (value2) => {
        const context = new UpdateContext(
          new MockRenderHost(),
          new SyncUpdater(),
          new MockBlock(),
        );

        const value1 = vi.fn();
        const part = {
          type: PartType.Event,
          node: document.createElement('div'),
          name: 'hello',
        } as const;
        const event = new CustomEvent('hello');
        const binding = new EventBinding(value1, part);

        const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
        const removeEventListenerSpy = vi.spyOn(
          part.node,
          'removeEventListener',
        );

        binding.connect(context);
        context.flushUpdate();
        part.node.dispatchEvent(event);

        binding.bind(value2, context);
        context.flushUpdate();
        part.node.dispatchEvent(event);

        expect(addEventListenerSpy).toHaveBeenCalledOnce();
        expect(addEventListenerSpy).toHaveBeenCalledWith('hello', binding);
        expect(removeEventListenerSpy).toHaveBeenCalledOnce();
        expect(removeEventListenerSpy).toHaveBeenCalledWith('hello', binding);
        expect(value1).toHaveBeenCalledOnce();
        expect(value1).toHaveBeenCalledWith(event);
      },
    );

    it('should throw the error if the value other than an event listner is assigned', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'hello',
      } as const;
      const binding = new EventBinding(null, part);

      expect(() => {
        binding.bind({} as any, context);
      }).toThrow(
        'A value of EventBinding must be EventListener, EventListenerObject, null or undefined.',
      );
    });
  });

  describe('.unbind()', () => {
    it('should unbind the active event listener', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = vi.fn();
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'hello',
      } as const;
      const event = new CustomEvent('hello');
      const binding = new EventBinding(value, part);

      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(part.node, 'removeEventListener');

      binding.connect(context);
      context.flushUpdate();
      part.node.dispatchEvent(event);

      binding.unbind(context);
      context.flushUpdate();
      part.node.dispatchEvent(event);

      expect(binding.value).toBe(value);
      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(addEventListenerSpy).toHaveBeenCalledWith('hello', binding);
      expect(removeEventListenerSpy).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('hello', binding);
      expect(value).toHaveBeenCalledOnce();
      expect(value).toHaveBeenCalledWith(event);
    });

    it('should do nothing if the update is already scheduled', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = () => {};
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'click',
      } as const;
      const binding = new EventBinding(value, part);

      const enqueueMutationEffectSpy = vi.spyOn(
        context,
        'enqueueMutationEffect',
      );

      binding.connect(context);
      context.flushUpdate();

      binding.unbind(context);
      binding.unbind(context);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledTimes(2);
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });

    it('should do nothing if there is no active listner', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = () => {};
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'click',
      } as const;
      const binding = new EventBinding(value, part);

      const enqueueMutationEffectSpy = vi.spyOn(
        context,
        'enqueueMutationEffect',
      );

      binding.unbind(context);
      binding.unbind(context);

      expect(enqueueMutationEffectSpy).not.toHaveBeenCalled();
    });

    it('should cancel mounting', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = () => {};
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'hello',
      } as const;
      const binding = new EventBinding(value, part);

      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');

      binding.connect(context);
      binding.unbind(context);
      context.flushUpdate();

      expect(addEventListenerSpy).not.toHaveBeenCalled();
    });
  });

  describe('.disconnect()', () => {
    it('should unregister the active event listener function', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = () => {};
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'hello',
      } as const;
      const binding = new EventBinding(value, part);

      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(part.node, 'removeEventListener');

      binding.connect(context);
      context.flushUpdate();

      binding.disconnect(context);

      expect(context.isPending()).toBe(false);
      expect(binding.value).toBe(value);
      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(addEventListenerSpy).toHaveBeenCalledWith('hello', binding);
      expect(removeEventListenerSpy).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('hello', binding);
    });

    it('should unregister the active event listener object', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = { handleEvent: () => {}, capture: true };
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'hello',
      } as const;
      const binding = new EventBinding(value, part);

      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(part.node, 'removeEventListener');

      binding.connect(context);
      context.flushUpdate();

      binding.disconnect(context);

      expect(context.isPending()).toBe(false);
      expect(binding.value).toBe(value);
      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(addEventListenerSpy).toHaveBeenCalledWith('hello', binding, value);
      expect(removeEventListenerSpy).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'hello',
        binding,
        value,
      );
    });

    it('should cancel mounting', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = () => {};
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'hello',
      } as const;
      const binding = new EventBinding(value, part);

      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');

      binding.connect(context);
      binding.disconnect(context);
      context.flushUpdate();

      expect(addEventListenerSpy).not.toHaveBeenCalled();
    });
  });
});
