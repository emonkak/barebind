import { describe, expect, it, vi } from 'vitest';
import { createEventPart } from '@/part.js';
import { EventBinding, EventType } from '@/primitive/event.js';
import { createRuntime } from '../../mocks.js';
import { TestUpdater } from '../../test-updater.js';

describe('EventType', () => {
  describe('ensureValue()', () => {
    it('asserts the value is an event listener, null or undefined', () => {
      const part = createEventPart(document.createElement('div'), 'click');

      expect(() => {
        EventType.ensureValue!.call(EventType, null, part);
        EventType.ensureValue!.call(EventType, undefined, part);
        EventType.ensureValue!.call(EventType, () => {}, part);
        EventType.ensureValue!.call(EventType, { handleEvent: () => {} }, part);
      }).not.toThrow();
    });

    it('throws an error if the value is not valid', () => {
      const part = createEventPart(document.createElement('div'), 'click');

      expect(() => {
        EventType.ensureValue!.call(EventType, {}, part);
      }).toThrow(
        'EventType values must be EventListener, EventListenerObject, null or undefined.',
      );
    });
  });

  describe('resolveBinding()', () => {
    it('constructs a new EventBinding', () => {
      const listener = () => {};
      const part = createEventPart(document.createElement('div'), 'click');
      const runtime = createRuntime();
      const binding = EventType.resolveBinding(listener, part, runtime);

      expect(binding).toBeInstanceOf(EventBinding);
      expect(binding.type).toBe(EventType);
      expect(binding.value).toBe(listener);
      expect(binding.part).toBe(part);
    });
  });
});

describe('EventBinding', () => {
  describe('shouldUpdate()', () => {
    it('returns true when there is no current listener', () => {
      const listener = () => {};
      const part = createEventPart(document.createElement('div'), 'click');
      const binding = new EventBinding(listener, part);

      expect(binding.shouldUpdate(listener)).toBe(true);
    });

    it('returns true when the new listener is different', () => {
      const handler1 = () => {};
      const handler2 = () => {};
      const part = createEventPart(document.createElement('div'), 'click');
      const binding = new EventBinding(handler1, part);
      const updater = new TestUpdater();

      SESSION: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(binding.shouldUpdate(handler1)).toBe(false);
        expect(binding.shouldUpdate(handler2)).toBe(true);
      }
    });
  });

  describe('commit()', () => {
    it('delegates events to event listener functions', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const part = createEventPart(document.createElement('div'), 'click');
      const binding = new EventBinding(listener1, part);
      const updater = new TestUpdater();

      const event = new MouseEvent('click');
      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(part.node, 'removeEventListener');

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });
      }

      part.node.dispatchEvent(event);

      SESSION2: {
        updater.startUpdate((session) => {
          binding.value = listener2;
          binding.attach(session);
          binding.commit();
        });
      }

      part.node.dispatchEvent(event);

      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'click',
        binding,
        listener1,
      );
      expect(removeEventListenerSpy).not.toHaveBeenCalled();
      expect(listener1).toHaveBeenCalledOnce();
      expect(listener1).toHaveBeenCalledWith(event);
      expect(listener2).toHaveBeenCalledOnce();
      expect(listener2).toHaveBeenCalledWith(event);
    });

    it('delegates events to event listener objects', () => {
      const listener1 = { handleEvent: vi.fn() };
      const listener2 = { handleEvent: vi.fn() };
      const part = createEventPart(document.createElement('div'), 'click');
      const binding = new EventBinding(listener1, part);
      const updater = new TestUpdater();

      const event = new MouseEvent('click');
      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(part.node, 'removeEventListener');

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });
      }

      part.node.dispatchEvent(event);

      SESSION2: {
        updater.startUpdate((session) => {
          binding.value = listener2;
          binding.attach(session);
          binding.commit();
        });
      }

      part.node.dispatchEvent(event);

      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'click',
        binding,
        listener1,
      );
      expect(removeEventListenerSpy).not.toHaveBeenCalled();
      expect(listener1.handleEvent).toHaveBeenCalledOnce();
      expect(listener1.handleEvent).toHaveBeenCalledWith(event);
      expect(listener2.handleEvent).toHaveBeenCalledOnce();
      expect(listener2.handleEvent).toHaveBeenCalledWith(event);
    });

    it.for([
      null,
      undefined,
    ])('aborts event delegations when the new listener is nullish', (listener2) => {
      const listener1 = { handleEvent: () => {} };
      const part = createEventPart(document.createElement('div'), 'click');
      const binding = new EventBinding(listener1, part);
      const updater = new TestUpdater();

      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(part.node, 'removeEventListener');

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.value = listener2;
          binding.attach(session);
          binding.commit();
        });
      }

      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'click',
        binding,
        listener1,
      );
      expect(removeEventListenerSpy).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'click',
        binding,
        listener1,
      );
    });

    it('restarts event delegations when options change', () => {
      const listener1 = { handleEvent: () => {}, capture: false };
      const listener2 = { handleEvent: () => {}, capture: true };
      const part = createEventPart(document.createElement('div'), 'click');
      const binding = new EventBinding(listener1, part);
      const updater = new TestUpdater();

      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(part.node, 'removeEventListener');

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.value = listener2;
          binding.attach(session);
          binding.commit();
        });
      }

      expect(addEventListenerSpy).toHaveBeenCalledTimes(2);
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'click',
        binding,
        listener1,
      );
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'click',
        binding,
        listener2,
      );
      expect(removeEventListenerSpy).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'click',
        binding,
        listener1,
      );
    });
  });

  describe('rollback()', () => {
    it('does nothing when there is no curernt event listener', () => {
      const listener = () => {};
      const part = createEventPart(document.createElement('div'), 'click');
      const binding = new EventBinding(listener, part);
      const updater = new TestUpdater();

      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(part.node, 'removeEventListener');

      SESSION1: {
        updater.startUpdate((session) => {
          binding.detach(session);
          binding.rollback();
        });
      }

      expect(addEventListenerSpy).not.toHaveBeenCalled();
      expect(removeEventListenerSpy).not.toHaveBeenCalled();
    });

    it('aborts event delegations when started', () => {
      const listener = () => {};
      const part = createEventPart(document.createElement('div'), 'click');
      const binding = new EventBinding(listener, part);
      const updater = new TestUpdater();

      const addEventListenerSpy = vi.spyOn(part.node, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(part.node, 'removeEventListener');

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.detach(session);
          binding.rollback();
        });
      }

      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'click',
        binding,
        listener,
      );
      expect(removeEventListenerSpy).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'click',
        binding,
        listener,
      );
    });
  });
});
