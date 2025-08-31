import { describe, expect, it, vi } from 'vitest';

import { PartType } from '@/internal.js';
import { EventBinding, EventPrimitive } from '@/primitive/event.js';
import { createRuntime, UpdateHelper } from '../../test-helpers.js';

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
      };
      const ensureValue: NonNullable<typeof EventPrimitive.ensureValue> =
        EventPrimitive.ensureValue!;

      expect(() => {
        ensureValue.call(EventPrimitive, null, part);
        ensureValue.call(EventPrimitive, undefined, part);
        ensureValue.call(EventPrimitive, () => {}, part);
        ensureValue.call(EventPrimitive, { handleEvent: () => {} }, part);
      }).not.toThrow();
    });

    it('throws an error if the value is not valid', () => {
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'click',
      };
      const ensureValue: NonNullable<typeof EventPrimitive.ensureValue> =
        EventPrimitive.ensureValue!;

      expect(() => {
        ensureValue.call(EventPrimitive, {}, part);
      }).toThrow(
        'The value of EventPrimitive must be an EventListener, EventListenerObject, null or undefined,',
      );
    });
  });

  describe('resolveBinding()', () => {
    it('constructs a new EventBinding', () => {
      const handler = () => {};
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'click',
      };
      const runtime = createRuntime();
      const binding = EventPrimitive.resolveBinding(handler, part, runtime);

      expect(binding.type).toBe(EventPrimitive);
      expect(binding.value).toBe(handler);
      expect(binding.part).toBe(part);
    });

    it('should throw the error if the part is not an event part', () => {
      const handler = () => {};
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      };
      const runtime = createRuntime();

      expect(() =>
        EventPrimitive.resolveBinding(handler, part, runtime),
      ).toThrow('EventPrimitive must be used in an event part,');
    });
  });
});

describe('EventBinding', () => {
  describe('shouldBind()', () => {
    it('returns true if the committed value does not exist', () => {
      const handler = () => {};
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'click',
      };
      const binding = new EventBinding(handler, part);

      expect(binding.shouldBind(handler)).toBe(true);
    });

    it('returns true if the committed value is different from the new one', () => {
      const handler1 = () => {};
      const handler2 = () => {};
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'click',
      };
      const binding = new EventBinding(handler1, part);
      const helper = new UpdateHelper();

      SESSION: {
        helper.startUpdate((session) => {
          binding.connect(session);
          binding.commit();
        });

        expect(binding.shouldBind(handler1)).toBe(false);
        expect(binding.shouldBind(handler2)).toBe(true);
      }
    });
  });

  describe('commit()', () => {
    it('attaches the event listener function', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'click',
      };
      const binding = new EventBinding(handler1, part);
      const helper = new UpdateHelper();

      const event = new MouseEvent('click');
      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(part.node, 'removeEventListener');

      SESSION1: {
        helper.startUpdate((session) => {
          binding.connect(session);
          binding.commit();
        });

        expect(addEventListenerSpy).toHaveBeenCalledOnce();
        expect(addEventListenerSpy).toHaveBeenCalledWith('click', binding);
        expect(removeEventListenerSpy).not.toHaveBeenCalled();
      }

      part.node.dispatchEvent(event);

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).not.toHaveBeenCalled();

      SESSION2: {
        helper.startUpdate((session) => {
          binding.value = handler2;
          binding.connect(session);
          binding.commit();
        });

        expect(addEventListenerSpy).toHaveBeenCalledOnce();
        expect(addEventListenerSpy).toHaveBeenCalledWith('click', binding);
        expect(removeEventListenerSpy).not.toHaveBeenCalled();
      }

      part.node.dispatchEvent(event);

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledWith(event);
    });

    it('attaches the event listener object', () => {
      const handler1 = { handleEvent: vi.fn() };
      const handler2 = { handleEvent: vi.fn() };
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'click',
      };
      const binding = new EventBinding(handler1, part);
      const helper = new UpdateHelper();

      const event = new MouseEvent('click');
      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(part.node, 'removeEventListener');

      SESSION1: {
        helper.startUpdate((session) => {
          binding.connect(session);
          binding.commit();
        });

        expect(addEventListenerSpy).toHaveBeenCalledTimes(1);
        expect(addEventListenerSpy).toHaveBeenCalledWith(
          'click',
          binding,
          handler1,
        );
        expect(removeEventListenerSpy).not.toHaveBeenCalled();
      }

      part.node.dispatchEvent(event);

      expect(handler1.handleEvent).toHaveBeenCalledOnce();
      expect(handler1.handleEvent).toHaveBeenCalledWith(event);
      expect(handler2.handleEvent).not.toHaveBeenCalled();

      SESSION2: {
        helper.startUpdate((session) => {
          binding.value = handler2;
          binding.connect(session);
          binding.commit();
        });

        expect(addEventListenerSpy).toHaveBeenCalledTimes(2);
        expect(addEventListenerSpy).toHaveBeenCalledWith(
          'click',
          binding,
          handler2,
        );
        expect(removeEventListenerSpy).toHaveBeenCalledTimes(1);
        expect(removeEventListenerSpy).toHaveBeenCalledWith(
          'click',
          binding,
          handler1,
        );
      }

      part.node.dispatchEvent(event);

      expect(handler1.handleEvent).toHaveBeenCalledOnce();
      expect(handler2.handleEvent).toHaveBeenCalledOnce();
      expect(handler2.handleEvent).toHaveBeenCalledWith(event);
    });

    it.for([null, undefined])(
      'detaches the old event listener if the new event listener is null or undefined',
      (handler2) => {
        const handler1 = { handleEvent: () => {} };
        const part = {
          type: PartType.Event,
          node: document.createElement('div'),
          name: 'click',
        };
        const binding = new EventBinding(handler1, part);
        const helper = new UpdateHelper();

        const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
        const removeEventListenerSpy = vi.spyOn(
          part.node,
          'removeEventListener',
        );

        SESSION1: {
          helper.startUpdate((session) => {
            binding.connect(session);
            binding.commit();
          });

          expect(addEventListenerSpy).toHaveBeenCalledOnce();
          expect(addEventListenerSpy).toHaveBeenCalledWith(
            'click',
            binding,
            handler1,
          );
          expect(removeEventListenerSpy).not.toHaveBeenCalled();
        }

        SESSION2: {
          helper.startUpdate((session) => {
            binding.value = handler2;
            binding.connect(session);
            binding.commit();
          });

          expect(addEventListenerSpy).toHaveBeenCalledOnce();
          expect(removeEventListenerSpy).toHaveBeenCalledOnce();
          expect(removeEventListenerSpy).toHaveBeenCalledWith(
            'click',
            binding,
            handler1,
          );
        }
      },
    );
  });

  describe('rollback()', () => {
    it('should do nothing if the attached event listener does not exist', () => {
      const handler = () => {};
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'click',
      };
      const binding = new EventBinding(handler, part);
      const helper = new UpdateHelper();

      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(part.node, 'removeEventListener');

      SESSION1: {
        helper.startUpdate((session) => {
          binding.disconnect(session);
          binding.rollback();
        });

        expect(addEventListenerSpy).not.toHaveBeenCalled();
        expect(removeEventListenerSpy).not.toHaveBeenCalled();
      }
    });

    it('detaches the event listener', () => {
      const handler = () => {};
      const part = {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'click',
      };
      const binding = new EventBinding(handler, part);
      const helper = new UpdateHelper();

      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(part.node, 'removeEventListener');

      SESSION1: {
        helper.startUpdate((session) => {
          binding.connect(session);
          binding.commit();
        });

        expect(addEventListenerSpy).toHaveBeenCalledOnce();
        expect(addEventListenerSpy).toHaveBeenCalledWith('click', binding);
        expect(removeEventListenerSpy).not.toHaveBeenCalled();
      }

      SESSION2: {
        helper.startUpdate((session) => {
          binding.disconnect(session);
          binding.rollback();
        });

        expect(addEventListenerSpy).toHaveBeenCalledOnce();
        expect(removeEventListenerSpy).toHaveBeenCalledOnce();
        expect(removeEventListenerSpy).toHaveBeenCalledWith('click', binding);
      }
    });
  });
});
