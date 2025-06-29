import { describe, expect, it, vi } from 'vitest';

import { PartType } from '../../src/part.js';
import { EventBinding, EventPrimitive } from '../../src/primitive/event.js';
import { UpdateEngine } from '../../src/updateEngine.js';
import { MockRenderHost } from '../mocks.js';

describe('EventPrimitive', () => {
  describe('name', () => {
    it('is a string that represents the primitive itself', () => {
      expect(EventPrimitive.name, 'EventPrimitive');
    });
  });

  describe('ensureValue()', () => {
    it('asserts the value is an event listener, null or undefined', () => {
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'click',
      } as const;
      const ensureValue: (typeof EventPrimitive)['ensureValue'] =
        EventPrimitive.ensureValue;

      expect(() => {
        ensureValue(null, part);
        ensureValue(undefined, part);
        ensureValue(() => {}, part);
        ensureValue({ handleEvent: () => {} }, part);
      }).not.toThrow();
    });

    it('throws the error if the value is not valid', () => {
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'click',
      } as const;
      const ensureValue: (typeof EventPrimitive)['ensureValue'] =
        EventPrimitive.ensureValue;

      expect(() => {
        ensureValue({}, part);
      }).toThrow(
        'The value of EventPrimitive must be EventListener, EventListenerObject, null or undefined,',
      );
    });
  });

  describe('resolveBinding()', () => {
    it('constructs a new EventBinding', () => {
      const listener = () => {};
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'click',
      } as const;
      const context = new UpdateEngine(new MockRenderHost());
      const binding = EventPrimitive.resolveBinding(listener, part, context);

      expect(binding.directive).toBe(EventPrimitive);
      expect(binding.value).toBe(listener);
      expect(binding.part).toBe(part);
    });

    it('should throw the error if the part is not an event part', () => {
      const listener = () => {};
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const context = new UpdateEngine(new MockRenderHost());

      expect(() =>
        EventPrimitive.resolveBinding(listener, part, context),
      ).toThrow('EventPrimitive must be used in an event part,');
    });
  });
});

describe('EventBinding', () => {
  describe('shouldBind()', () => {
    it('returns true if the committed value does not exist', () => {
      const listener = () => {};
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'click',
      } as const;
      const binding = new EventBinding(listener, part);

      expect(binding.shouldBind(listener)).toBe(true);
    });

    it('returns true if the committed value is different from the new one', () => {
      const listener1 = () => {};
      const listener2 = () => {};
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'click',
      } as const;
      const binding = new EventBinding(listener1, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit();

      expect(binding.shouldBind(listener1)).toBe(false);
      expect(binding.shouldBind(listener2)).toBe(true);
    });
  });

  describe('commit()', () => {
    it('attaches the event listener function', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'click',
      } as const;
      const binding = new EventBinding(listener1, part);
      const context = new UpdateEngine(new MockRenderHost());

      const event = new MouseEvent('click');
      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(part.node, 'removeEventListener');

      binding.connect(context);
      binding.commit();
      part.node.dispatchEvent(event);

      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(addEventListenerSpy).toHaveBeenCalledWith('click', binding);
      expect(removeEventListenerSpy).not.toHaveBeenCalled();
      expect(listener1).toHaveBeenCalledOnce();
      expect(listener1).toHaveBeenCalledWith(event);
      expect(listener2).not.toHaveBeenCalled();

      binding.bind(listener2);
      binding.connect(context);
      binding.commit();
      part.node.dispatchEvent(event);

      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(addEventListenerSpy).toHaveBeenCalledWith('click', binding);
      expect(removeEventListenerSpy).not.toHaveBeenCalled();
      expect(listener1).toHaveBeenCalledOnce();
      expect(listener2).toHaveBeenCalledOnce();
      expect(listener2).toHaveBeenCalledWith(event);
    });

    it('attaches the event listener object', () => {
      const listener1 = { handleEvent: vi.fn() };
      const listener2 = { handleEvent: vi.fn() };
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'click',
      } as const;
      const binding = new EventBinding(listener1, part);
      const context = new UpdateEngine(new MockRenderHost());

      const event = new MouseEvent('click');
      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(part.node, 'removeEventListener');

      binding.connect(context);
      binding.commit();
      part.node.dispatchEvent(event);

      expect(addEventListenerSpy).toHaveBeenCalledTimes(1);
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'click',
        binding,
        listener1,
      );
      expect(removeEventListenerSpy).not.toHaveBeenCalled();
      expect(listener1.handleEvent).toHaveBeenCalledOnce();
      expect(listener1.handleEvent).toHaveBeenCalledWith(event);
      expect(listener2.handleEvent).not.toHaveBeenCalled();

      binding.bind(listener2);
      binding.connect(context);
      binding.commit();
      part.node.dispatchEvent(event);

      expect(addEventListenerSpy).toHaveBeenCalledTimes(2);
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'click',
        binding,
        listener2,
      );
      expect(removeEventListenerSpy).toHaveBeenCalledTimes(1);
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'click',
        binding,
        listener1,
      );
      expect(listener1.handleEvent).toHaveBeenCalledOnce();
      expect(listener2.handleEvent).toHaveBeenCalledOnce();
      expect(listener2.handleEvent).toHaveBeenCalledWith(event);
    });

    it.each([[null], [undefined]])(
      'detaches the event listener if the new event listener is null or undefined',
      (listener2) => {
        const listener1 = { handleEvent: () => {} };
        const part = {
          type: PartType.Event,
          node: document.createElement('div'),
          name: 'click',
        } as const;
        const binding = new EventBinding(listener1, part);
        const context = new UpdateEngine(new MockRenderHost());

        const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
        const removeEventListenerSpy = vi.spyOn(
          part.node,
          'removeEventListener',
        );

        binding.connect(context);
        binding.commit();

        expect(addEventListenerSpy).toHaveBeenCalledOnce();
        expect(addEventListenerSpy).toHaveBeenCalledWith(
          'click',
          binding,
          listener1,
        );
        expect(removeEventListenerSpy).not.toHaveBeenCalled();

        binding.bind(listener2);
        binding.connect(context);
        binding.commit();

        expect(addEventListenerSpy).toHaveBeenCalledOnce();
        expect(removeEventListenerSpy).toHaveBeenCalledOnce();
        expect(removeEventListenerSpy).toHaveBeenCalledWith(
          'click',
          binding,
          listener1,
        );
      },
    );
  });

  describe('rollback()', () => {
    it('should do nothing if the attached event listener does not exist', () => {
      const listener = () => {};
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'click',
      } as const;
      const binding = new EventBinding(listener, part);
      const context = new UpdateEngine(new MockRenderHost());

      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(part.node, 'removeEventListener');

      binding.disconnect(context);
      binding.rollback();

      expect(addEventListenerSpy).not.toHaveBeenCalled();
      expect(removeEventListenerSpy).not.toHaveBeenCalled();
    });

    it('detaches the event listener', () => {
      const listener = () => {};
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'click',
      } as const;
      const binding = new EventBinding(listener, part);
      const context = new UpdateEngine(new MockRenderHost());

      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(part.node, 'removeEventListener');

      binding.connect(context);
      binding.commit();

      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(addEventListenerSpy).toHaveBeenCalledWith('click', binding);
      expect(removeEventListenerSpy).not.toHaveBeenCalled();

      binding.disconnect(context);
      binding.rollback();

      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('click', binding);
    });
  });
});
